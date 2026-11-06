import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { ThemeContext } from "../../app/ThemeContext.js";
import { Icon } from "../../components/Icon.jsx";
import { SoftwareUpdateSettings } from "./SoftwareUpdates.jsx";
import PersistStateManager from "./PersistStateBrowser.jsx";
import { GameSettingsPanel } from "./GameSettingsPanel.jsx";
import {
  remembered,
  remember,
  applyCompatibility,
} from "./settingsPreferences.js";
import {
  check,
  Button,
  Section,
  Row,
  Choices,
  Range,
  PathControl,
  Switch,
  SettingsFrame,
} from "./SettingsControls.jsx";
const DEFAULT_SERVER = "https://qaqm.top";
const CARD_IMAGE_RATIOS = ["4:3", "16:9", "16:10", "1:1", "3:4"];
function getCategories() {
  return [
    {
      id: "general",
      icon: "sliders",
      label: t("settings.categories.application"),
    },
    {
      id: "game",
      icon: "gamepad",
      label: t("settings.categories.game"),
    },
    {
      id: "appearance",
      icon: "palette",
      label: t("settings.categories.appearance"),
    },
    {
      id: "downloads",
      icon: "download",
      label: t("settings.categories.downloads"),
    },
    {
      id: "shortcuts",
      icon: "keyboard",
      label: t("settings.categories.shortcuts"),
    },
    {
      id: "about",
      icon: "info",
      label: t("settings.categories.about"),
    },
  ];
}
function SettingsView({ devMode = false, games = [], activeGame = null }) {
  const [categoryId, setCategoryId] = React.useState(() =>
    remembered("qaqm.settings.category.v2", "game"),
  );
  const [appVersion, setAppVersion] = React.useState("");
  const [config, setConfig] = React.useState(null);
  const [overlay, setOverlay] = React.useState({});
  const [download, setDownload] = React.useState(null);
  const [hotkey, setHotkey] = React.useState("");
  const [closeBehavior, setCloseBehavior] = React.useState("ask");
  const [server, setServer] = React.useState(DEFAULT_SERVER);
  const [loadError, setLoadError] = React.useState("");
  const [toast, setToast] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const [recording, setRecording] = React.useState(false);
  const [draftHotkey, setDraftHotkey] = React.useState("");
  const [loadTick, setLoadTick] = React.useState(0);
  const pane = React.useRef(null);
  const theme = React.useContext(ThemeContext);
  const category =
    getCategories().find((item) => item.id === categoryId) ||
    getCategories().find((item) => item.id === "game") ||
    getCategories()[0];
  const notify = (type, message) =>
    setToast({
      type,
      message,
    });
  React.useEffect(() => {
    window.api
      .getRuntimeInfo()
      .then((info) => setAppVersion(info.appVersion || ""))
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setLoadError("");
    Promise.all([
      window.api.getConfig(),
      window.api.overlayGetSettings(),
      window.api.marketGetDownloadSettings(),
      window.api.getOverlayHotkey(),
      window.api.getCloseBehavior(),
    ])
      .then(([c, o, d, k, b]) => {
        [c, o, d, k, b].forEach(check);
        if (canceled) return;
        setConfig(c.config);
        setOverlay(o.settings);
        setDownload(d);
        setHotkey(k.hotkey || "Alt+F");
        setCloseBehavior(
          b.closeBehavior === "exit" ? "quit" : b.closeBehavior || "ask",
        );
        setServer(c.config.serverUrl || DEFAULT_SERVER);
      })
      .catch((e) => {
        if (!canceled) setLoadError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [loadTick]);
  React.useEffect(() => {
    const handle = (event) => {
      if (getCategories().some((item) => item.id === event.detail?.category))
        chooseCategory(event.detail.category);
    };
    window.addEventListener("qaqm:settings-section", handle);
    return () => window.removeEventListener("qaqm:settings-section", handle);
  }, []);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  React.useEffect(() => {
    pane.current?.scrollTo(0, 0);
    setRecording(false);
  }, [category.id]);
  function chooseCategory(id) {
    setCategoryId(id);
    remember("qaqm.settings.category.v2", id);
  }
  async function run(action, message) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
      if (message) notify("success", message);
    } catch (e) {
      notify("error", e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function updateConfig(key, value, save, apply) {
    await run(async () => {
      check(await save(value));
      setConfig((previous) => ({
        ...previous,
        [key]: value,
      }));
      apply?.(value);
    });
  }
  async function updateOverlay(key, value) {
    await run(
      async () => {
        check(
          await window.api.overlayUpdateSettings({
            [key]: value,
          }),
        );
        setOverlay((previous) => ({
          ...previous,
          [key]: value,
        }));
      },
      key === "persistBridgeEnabled"
        ? t("settings.persist.restartRequired")
        : undefined,
    );
  }
  const levelValue = Number(config?.compatibilityLevel);
  const level = Number.isFinite(levelValue)
    ? Math.max(0, Math.min(3, levelValue))
    : config?.compatibilityMode
      ? 3
      : 0;
  const marketScale =
    {
      small: 88,
      medium: 100,
      large: 122,
    }[config?.modMarketCardSize] ||
    Number(config?.modMarketCardSize) ||
    100;
  let content;
  if (loadError)
    content = (
      <div className="settings-state" role="alert">
        {t("settings.errors.readConfiguration", {
          loadError,
        })}
        <Button onClick={() => setLoadTick((v) => v + 1)}>
          {t("common.actions.reload")}
        </Button>
      </div>
    );
  else if (!config)
    content = (
      <div className="settings-state" role="status">
        <span className="spinner" />
        {t("settings.status.loading")}
      </div>
    );
  else if (category.id === "general")
    content = (
      <React.Fragment>
        <Section id="window" title={t("settings.window.title")}>
          <Row title={t("settings.window.closeBehavior")}>
            <Choices
              label={t("settings.window.closeBehavior")}
              value={closeBehavior}
              disabled={busy}
              onChange={(value) =>
                run(async () => {
                  check(await window.api.setCloseBehavior(value));
                  setCloseBehavior(value);
                })
              }
              options={[
                {
                  value: "ask",
                  label: t("settings.window.askEveryTime"),
                },
                {
                  value: "minimize",
                  label: t("settings.window.minimizeToTray"),
                  desc: t("settings.window.trayDescription"),
                },
                {
                  value: "quit",
                  label: t("settings.window.exit"),
                },
              ]}
            />
          </Row>
        </Section>
        <Section id="random-launch" title={t("settings.randomLaunch.title")}>
          <Row
            title={t("settings.randomLaunch.manager")}
            description={t("settings.randomLaunch.managerHint")}
          >
            <Switch
              label={t("settings.randomLaunch.manager")}
              checked={config.randomLaunch?.manager !== false}
              disabled={busy}
              onChange={(enabled) =>
                run(async () => {
                  const result = check(
                    await window.api.updateRandomLaunchSettings({
                      manager: enabled,
                    }),
                  );
                  setConfig((previous) => ({
                    ...previous,
                    randomLaunch: result.settings,
                  }));
                  notify(
                    "success",
                    result.restartRequired
                      ? t("settings.randomLaunch.managerRestart")
                      : t("common.status.saved"),
                  );
                })
              }
            />
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "game")
    content = (
      <div id="settings-game">
        {activeGame?.id ? (
          <React.Fragment>
            <GameSettingsPanel
              key={activeGame.id}
              gameId={activeGame.id}
              notify={notify}
            />
            <Section id="persist" title={t("settings.categories.persist")}>
              <PersistStateManager games={games} />
            </Section>
          </React.Fragment>
        ) : (
          <div className="settings-state">
            {t("settings.game.chooseFirst")}
          </div>
        )}
      </div>
    );
  else if (category.id === "appearance")
    content = (
      <React.Fragment>
        <Section id="theme" title={t("settings.theme.title")}>
          <Row title={t("settings.theme.mode")}>
            <Choices
              label={t("settings.theme.mode")}
              value={theme?.mode}
              onChange={(value) => theme?.setMode(value)}
              options={[
                {
                  value: "dark",
                  label: t("settings.theme.dark"),
                },
                {
                  value: "light",
                  label: t("settings.theme.light"),
                },
                {
                  value: "system",
                  label: t("settings.theme.system"),
                },
              ]}
            />
          </Row>
        </Section>
        <Section
          id="scale"
          title={t("settings.scale.title")}
          actions={
            <Button
              small={true}
              ghost={true}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  check(await window.api.setUiZoom(1));
                  check(await window.api.setModMarketCardSize(100));
                  setConfig((c) => ({
                    ...c,
                    uiZoom: 1,
                    modMarketCardSize: 100,
                  }));
                  window.dispatchEvent(
                    new CustomEvent("qaqm:mod-market-card-size-changed", {
                      detail: {
                        size: 100,
                      },
                    }),
                  );
                })
              }
            >
              {t("settings.scale.restoreFull")}
            </Button>
          }
        >
          <Row title={t("settings.scale.sidebar")}>
            <Range
              label={t("settings.scale.sidebar")}
              value={Math.round((config.uiZoom || 1) * 100)}
              min={70}
              max={140}
              step={5}
              disabled={busy}
              onChange={(value) =>
                updateConfig("uiZoom", value / 100, window.api.setUiZoom)
              }
            />
          </Row>
          <Row title={t("settings.scale.marketCards")}>
            <Range
              label={t("settings.scale.marketCards")}
              value={marketScale}
              min={80}
              max={140}
              disabled={busy}
              onChange={(value) =>
                updateConfig(
                  "modMarketCardSize",
                  value,
                  window.api.setModMarketCardSize,
                  (size) =>
                    window.dispatchEvent(
                      new CustomEvent("qaqm:mod-market-card-size-changed", {
                        detail: {
                          size,
                        },
                      }),
                    ),
                )
              }
            />
          </Row>
          <Row
            title={t("settings.cards.coverRatio")}
            hint={t("settings.cards.coverRatioHint")}
          >
            <Choices
              label={t("settings.cards.coverRatioLabel")}
              disabled={busy}
              value={
                CARD_IMAGE_RATIOS.includes(config.modDownloadImageRatio)
                  ? config.modDownloadImageRatio
                  : "4:3"
              }
              options={CARD_IMAGE_RATIOS.map((value) => ({
                value,
                label: value,
              }))}
              onChange={(value) =>
                updateConfig(
                  "modDownloadImageRatio",
                  value,
                  window.api.setModDownloadImageRatio,
                  (ratio) =>
                    document.documentElement.style.setProperty(
                      "--mod-download-image-ratio",
                      ratio.replace(":", " / "),
                    ),
                )
              }
            />
          </Row>
        </Section>
        <Section id="compatibility" title={t("settings.compatibility.title")}>
          <Row
            title={t("settings.compatibility.mode")}
            description={t("settings.compatibility.description")}
          >
            <Choices
              label={t("settings.compatibility.mode")}
              value={level}
              disabled={busy}
              onChange={(value) =>
                updateConfig(
                  "compatibilityLevel",
                  value,
                  window.api.setCompatibilityMode,
                  applyCompatibility,
                )
              }
              options={[
                {
                  value: 0,
                  label: t("common.actions.close"),
                },
                {
                  value: 1,
                  label: t("settings.compatibility.light"),
                  desc: t("settings.compatibility.lightHint"),
                },
                {
                  value: 2,
                  label: t("settings.compatibility.medium"),
                  desc: t("settings.compatibility.mediumHint"),
                },
                {
                  value: 3,
                  label: t("settings.compatibility.minimal"),
                  desc: t("settings.compatibility.minimalHint"),
                },
              ]}
            />
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "downloads")
    content = (
      <React.Fragment>
        <Section id="cache" title={t("settings.downloadStorage.title")}>
          <Row
            title={t("settings.downloadStorage.directory")}
            hint={t("settings.downloadStorage.description")}
            path={true}
          >
            <PathControl
              label={t("settings.downloadStorage.directory")}
              value={download?.cacheDir}
              disabled={busy}
              onSelect={() =>
                run(async () => {
                  const r = await window.api.marketSelectDownloadCacheDir();
                  if (r.canceled) return;
                  check(r);
                  setDownload(r);
                })
              }
            >
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = check(
                      await window.api.marketResetDownloadCacheDir(),
                    );
                    setDownload(r);
                  })
                }
              >
                {t("common.actions.restoreDefault")}
              </Button>
            </PathControl>
          </Row>
        </Section>
        <Section id="server" title={t("settings.server.title")}>
          <Row
            title={t("settings.server.address")}
            hint={t("settings.server.defaultHint", {
              dEFAULT_SERVER: DEFAULT_SERVER,
            })}
            path={true}
          >
            <form
              className="path-control"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  const r = check(
                    await window.api.setServerUrl(
                      server.trim() || DEFAULT_SERVER,
                      {
                        devMode,
                      },
                    ),
                  );
                  setServer(r.serverUrl || server.trim() || DEFAULT_SERVER);
                }, t("settings.server.saved"));
              }}
            >
              <input
                className="input settings-mono-input"
                type="url"
                aria-label={t("settings.server.address")}
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder={DEFAULT_SERVER}
              />
              <Button disabled={busy} onClick={() => setServer(DEFAULT_SERVER)}>
                {t("settings.server.fillDefault")}
              </Button>
              <Button primary={true} type="submit" disabled={busy}>
                {t("common.actions.save")}
              </Button>
            </form>
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "shortcuts")
    content = (
      <Section id="overlay" title={t("settings.overlay.title")}>
        <Row
          title={t("settings.overlay.toggle")}
          hint={t("settings.overlay.toggleHint")}
        >
          <kbd className="kbd-key">{hotkey}</kbd>
          <Button
            disabled={busy}
            onClick={() => {
              setRecording(true);
              setDraftHotkey("");
            }}
          >
            {t("settings.overlay.changeHotkey")}
          </Button>
        </Row>
        {recording && (
          <Row
            title={t("settings.overlay.recordHotkey")}
            description={t("settings.overlay.recordHint")}
            path={true}
          >
            <div className="path-control">
              <input
                autoFocus={true}
                readOnly={true}
                className="input settings-mono-input"
                aria-label={t("settings.overlay.recordHotkey")}
                value={draftHotkey}
                placeholder={t("settings.overlay.pressHotkey")}
                onKeyDown={(event) => {
                  if (event.key === "Tab") return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    setRecording(false);
                    return;
                  }
                  if (["Control", "Alt", "Shift", "Meta"].includes(event.key))
                    return;
                  setDraftHotkey(
                    [
                      event.ctrlKey && "Ctrl",
                      event.altKey && "Alt",
                      event.shiftKey && "Shift",
                      event.metaKey && "Super",
                      event.key === " "
                        ? "Space"
                        : event.key.length === 1
                          ? event.key.toUpperCase()
                          : event.key,
                    ]
                      .filter(Boolean)
                      .join("+"),
                  );
                }}
              />
              <Button onClick={() => setRecording(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                primary={true}
                disabled={busy || !draftHotkey}
                onClick={() =>
                  run(async () => {
                    const r = check(
                      await window.api.setOverlayHotkey(draftHotkey),
                    );
                    setHotkey(r.hotkey);
                    setRecording(false);
                  }, t("settings.overlay.hotkeySaved"))
                }
              >
                {t("common.actions.save")}
              </Button>
            </div>
          </Row>
        )}
        {[
          [
            "autoReloadEnabled",
            t("settings.overlay.reloadAfterToggle"),
            t("settings.overlay.reloadAfterToggleHint"),
          ],
          [
            "presetAutoReloadEnabled",
            t("settings.overlay.reloadAfterPreset"),
            t("settings.overlay.reloadAfterPresetHint"),
          ],
          [
            "clickableHotkeysEnabled",
            t("settings.overlay.clickModHotkeys"),
            t("settings.overlay.clickModHotkeysHint"),
          ],
        ].map(([key, title, hint]) => (
          <Row key={key} title={title} hint={hint}>
            <Switch
              label={title}
              checked={!!overlay[key]}
              disabled={busy}
              onChange={(value) => updateOverlay(key, value)}
            />
          </Row>
        ))}
        <Row
          title={t("settings.overlay.preview")}
          hint={t("settings.overlay.previewHint")}
        >
          <Button
            onClick={() =>
              run(async () => {
                check(await window.api.toggleOverlayFromUI());
              })
            }
          >
            {t("settings.overlay.showOrHide")}
          </Button>
        </Row>
      </Section>
    );
  else
    content = (
      <React.Fragment>
        <Section id="about" title={t("settings.about.appInfo")}>
          <Row
            title="QAQ-Revival"
            description={t("settings.about.description")}
          >
            <span className="system-version">{appVersion}</span>
          </Row>
        </Section>
        <SoftwareUpdateSettings />
        <Section id="help" title={t("settings.maintenance.troubleshooting")}>
          <Row
            title={t("settings.maintenance.modTroubleshooting")}
            hint={t("settings.maintenance.helpHint")}
          >
            <Button
              onClick={() =>
                window.api.openExternalUrl("https://www.qaqm.top/faq")
              }
            >
              {t("settings.maintenance.openHelp")}
            </Button>
          </Row>
        </Section>
      </React.Fragment>
    );
  return (
    <SettingsFrame
      scope="general"
      paneRef={pane}
      toast={toast}
      nav={
        <nav
          className="settings-categories"
          aria-label={t("settings.about.categoryNavigation")}
        >
          {getCategories().map((item) => (
            <button
              key={item.id}
              type="button"
              className="settings-category"
              data-category={item.id}
              aria-current={category.id === item.id ? "page" : undefined}
              disabled={busy}
              onClick={() => chooseCategory(item.id)}
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      }
    >
      {content}
    </SettingsFrame>
  );
}
export { SettingsView as default };
