import React from "react";
import ReactDOM from "react-dom";
import { t } from "../../../shared/i18n/index.mjs";
import { Icon } from "../../components/Icon.jsx";
import {
  Button,
  Notice,
  Row,
  PathControl,
  Section,
  check,
} from "../settings/SettingsControls.jsx";
import { ArknightsCursorSettings } from "./ArknightsCursorSettings.jsx";

function formatStorageSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export function ArknightsSettings({ notify, gamePath }) {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [dump, setDump] = React.useState(null);
  const [dumpBusy, setDumpBusy] = React.useState(false);
  const [storage, setStorage] = React.useState(null);
  const [storageBusy, setStorageBusy] = React.useState(false);
  const [hotkeyDraft, setHotkeyDraft] = React.useState("");
  const hotkeyRef = React.useRef(null);
  React.useEffect(() => {
    window.api.arknightsStatus().then(setState);
  }, [gamePath]);
  React.useEffect(() => {
    let canceled = false;
    window.api.arknightsStorageStatus().then((result) => {
      if (!canceled && result?.success) setStorage(result.storage);
    }).catch(() => {});
    return () => { canceled = true; };
  }, [gamePath]);
  React.useEffect(() => {
    let canceled = false;
    const refresh = () =>
      window.api.arknightsDumpConfigGet().then((result) => {
        if (canceled || !result?.success) return;
        setDump(result);
        if (document.activeElement !== hotkeyRef.current) setHotkeyDraft(result.hotkey);
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      canceled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function cleanStorage() {
    if (storageBusy) return;
    setStorageBusy(true);
    try {
      const result = await window.api.arknightsStorageCleanup();
      check(result);
      setStorage(result.storage);
      notify("success", result.freed > 0
        ? t("arknights.storage.freed", { size: formatStorageSize(result.freed) })
        : t("arknights.storage.none"));
    } catch (error) {
      notify("error", t("arknights.storage.failed", { error: error.message }));
    } finally {
      setStorageBusy(false);
    }
  }
  async function updateDump(payload, message) {
    if (dumpBusy) return;
    setDumpBusy(true);
    try {
      const result = await window.api.arknightsDumpConfigSave(payload);
      check(result);
      setDump(result);
      setHotkeyDraft(result.hotkey);
      if (result.warning) notify("warning", result.warning);
      else notify("success", message ? t(message, result) : t("common.status.saved"));
    } catch (error) {
      notify("error", error.message);
    } finally {
      setDumpBusy(false);
    }
  }
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      setState(await window.api.arknightsStatus());
      notify("success", message ? t(message, result) : t("common.status.saved"));
    } catch (error) {
      notify("error", error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ArknightsCursorSettings key={gamePath || ""} notify={notify} />
      <Section id="arknights-dump" title={t("arknights.dump.title")}>
        <Row
          title={t("arknights.dump.hotkey")}
          hint={t("arknights.dump.hotkeyHint")}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={hotkeyRef}
              className="input settings-mono-input"
              value={hotkeyDraft}
              disabled={dumpBusy}
              spellCheck={false}
              placeholder="Ctrl+T"
              onChange={(event) => setHotkeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && hotkeyDraft.trim()) {
                  updateDump({ hotkey: hotkeyDraft }, "arknights.dump.saved");
                }
              }}
            />
            <Button
              disabled={dumpBusy || !hotkeyDraft.trim()}
              onClick={() =>
                updateDump({ hotkey: hotkeyDraft }, "arknights.dump.saved")
              }
            >
              {t("arknights.dump.save")}
            </Button>
          </div>
        </Row>
        <Row
          title={t("arknights.dump.state")}
          hint={t("arknights.dump.stateHint")}
        >
          <Button
            disabled={dumpBusy || !dump}
            onClick={() =>
              updateDump(
                { enabled: !dump?.enabled },
                dump?.enabled ? "arknights.dump.disabled" : "arknights.dump.enabled",
              )
            }
          >
            {dump?.enabled
              ? t("arknights.dump.disable")
              : t("arknights.dump.enable")}
          </Button>
        </Row>
        {dump?.file && (
          <p className="settings-footnote">
            {t("arknights.dump.file", { path: dump.file })}
          </p>
        )}
      </Section>
      <Section id="arknights-tools" title={t("arknights.settings.title")}>
        {state?.migrationError && (
          <Notice kind="warning" role="alert">
            {t("settings.mi.legacyMigrationDeferred", {
              error: state.migrationError,
            })}
          </Notice>
        )}
        <Row
          title={t("arknights.settings.loader")}
          hint={t("arknights.settings.loaderHint")}
          path={true}
        >
          <PathControl
            label={t("arknights.settings.loader")}
            value={state?.loader}
            disabled={busy}
          >
            <Button
              disabled={busy}
              onClick={() =>
                act(
                  () => window.api.arknightsPrepareLoader(),
                  "arknights.settings.prepared",
                )
              }
            >
              {t("arknights.settings.prepare")}
            </Button>
          </PathControl>
        </Row>
        <Row
          title={t("arknights.settings.destination")}
          hint={t("arknights.settings.destinationHint")}
          path={true}
        >
          <PathControl
            label={t("arknights.settings.destination")}
            value={state?.destination}
            disabled={busy}
          >
            <Button
              disabled={busy}
              onClick={() =>
                act(() => window.api.arknightsSync(), "arknights.settings.synced")
              }
            >
              {t("arknights.settings.sync")}
            </Button>
          </PathControl>
        </Row>
        <Row
          title={t("arknights.settings.source")}
          hint={t("arknights.settings.sourceHint")}
        >
          <Button
            onClick={() =>
              window.api.openExternalUrl(
                "https://github.com/QAQ-Revival/Arknights-Mod-Tools",
              )
            }
          >
            {t("arknights.settings.viewSource")}
          </Button>
        </Row>
        {state && !state.workerReady && (
          <Notice kind="warning">{t("arknights.settings.workerMissing")}</Notice>
        )}
        {state?.componentError && (
          <Notice kind="danger" role="alert">
            {state.componentError}
          </Notice>
        )}
        {state?.sync?.error && (
          <Notice kind="danger" role="alert">
            {t("arknights.syncFailed", { error: state.sync.error })}
          </Notice>
        )}
        <Row
          title={t("arknights.storage.title")}
          hint={storage
            ? t("arknights.storage.hint", {
                used: formatStorageSize(storage.physicalBytes),
                redundant: formatStorageSize((storage.previousDeployment?.bytes || 0) + (storage.previousBundles?.bytes || 0) + (storage.stale || 0) + (storage.backups || 0) + (storage.randomCopies || 0)),
                previous: formatStorageSize((storage.previousDeployment?.bytes || 0) + (storage.previousBundles?.bytes || 0)),
                temporary: formatStorageSize((storage.stale || 0) + (storage.backups || 0) + (storage.randomCopies || 0)),
              })
            : t("arknights.storage.checking")}
        >
          <Button disabled={storageBusy} onClick={cleanStorage}>
            {t("arknights.storage.cleanup")}
          </Button>
        </Row>
        <p className="settings-footnote">{t("arknights.settings.readOnly")}</p>
      </Section>
    </>
  );
}

export function ArknightsLibraryNotice() {
  const [error, setError] = React.useState("");
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    let canceled = false;
    const refresh = () =>
      window.api.arknightsStatus().then((state) => {
        if (!canceled) setError(state.sync?.error || "");
      });
    refresh();
    const off = window.api.onModsChanged?.(refresh);
    return () => {
      canceled = true;
      off?.();
    };
  }, []);
  if (dismissed && !error) return null;
  return (
    <div
      className={`notice ${error ? "notice-danger" : ""} arknights-library-notice${error ? " is-error" : ""}`}
      role={error ? "alert" : "note"}
    >
      <Icon name={error ? "alert" : "info"} size={14} />
      <span>
        {error ? t("arknights.syncFailed", { error }) : t("arknights.libraryHint")}
      </span>
      {!error && (
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title={t("common.actions.dismissNotice")}
          aria-label={t("common.actions.dismissNotice")}
          onClick={() => setDismissed(true)}
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function ArknightsToolsDialog({ characterName, mod, onClose, onCreated }) {
  const [report, setReport] = React.useState(null);
  const [busy, setBusy] = React.useState("analyze");
  const [error, setError] = React.useState("");
  const [created, setCreated] = React.useState(null);
  const [revision, setRevision] = React.useState(0);
  const [selected, setSelected] = React.useState(new Set());
  const closeRef = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setBusy("analyze");
    setError("");
    setReport(null);
    window.api
      .arknightsAnalyze({ characterName, modName: mod.name })
      .then((result) => {
        check(result);
        if (!canceled) {
          setReport(result);
          const scopes = new Set(
            result.plans.map((plan) => plan.appearanceSectionId),
          );
          setSelected(
            new Set(
              result.plans
                .filter(
                  (plan) =>
                    result.kind !== "bundle" ||
                    (scopes.size === 1 &&
                      plan.matched &&
                      plan.comparison !== "identical" &&
                      !plan.extraTexture),
                )
                .map((plan) => plan.id),
            ),
          );
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      })
      .finally(() => {
        if (!canceled) setBusy("");
      });
    return () => {
      canceled = true;
    };
  }, [characterName, mod.name, revision]);
  async function create() {
    if (busy || !report) return;
    setBusy("create");
    setError("");
    try {
      const result = await window.api.arknightsCreateCopy({
        token: report.token,
        selectedIds: [...selected],
      });
      check(result);
      setCreated(result);
      onCreated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const groups = report
    ? report.sections.filter((section) =>
        report.plans.some((plan) => plan.appearanceSectionId === section.id),
      )
    : [];
  function selectPlans(plans, enabled) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const plan of plans) {
        if (enabled) next.add(plan.id);
        else next.delete(plan.id);
      }
      return next;
    });
  }
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Tab") {
          const buttons = [
            ...e.currentTarget.querySelectorAll(
              "button:not(:disabled), input:not(:disabled)",
            ),
          ];
          const first = buttons[0],
            last = buttons.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        className="modal-content arknights-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arknights-tools-title"
        aria-busy={!!busy}
      >
        <div className="arknights-dialog-heading">
          <div className="arknights-dialog-title">
            <div id="arknights-tools-title" className="dialog-title">
              {t("arknights.tools")}
            </div>
            <div className="dialog-desc">
              {characterName} · {mod.name}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            title={t("common.actions.close")}
            aria-label={t("common.actions.close")}
            disabled={busy === "create"}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="arknights-hint">{t("arknights.copyHint")}</p>
        {busy && (
          <p className="arknights-status" role="status">
            <span className="spinner" />
            {t(busy === "analyze" ? "arknights.analyzing" : "arknights.creating")}
          </p>
        )}
        {error && (
          <div className="notice notice-danger arknights-error" role="alert">
            <Icon name="alert" size={14} />
            <span>{error}</span>
          </div>
        )}
        {created && (
          <div className="notice notice-success arknights-result" role="status">
            <Icon name="check" size={14} />
            <span>
              {t("arknights.created", {
                name: created.modName,
                count: created.count,
              })}
            </span>
          </div>
        )}
        {report && (
          <>
            <p className="arknights-summary">
              {t("arknights.summary", {
                count: report.plans.length,
                matched: report.matched,
                renamed: report.renamed,
              })}
            </p>
            {report.kind === "bundle" && (
              <p className="arknights-hint">{t("arknights.selectionHint")}</p>
            )}
            {report.kind === "assetbundle" && (
              <p className="arknights-hint">{t("arknights.abNoConvertHint")}</p>
            )}
            <div className="arknights-resource-groups">
              {groups.map((group) => {
                const plans = report.plans.filter(
                  (plan) => plan.appearanceSectionId === group.id,
                );
                return (
                  <label key={group.id}>
                    <input
                      type="checkbox"
                      disabled={!!busy || !!created}
                      checked={plans.every((plan) => selected.has(plan.id))}
                      onChange={(event) =>
                        selectPlans(plans, event.target.checked)
                      }
                    />
                    {group.name} ({plans.length})
                  </label>
                );
              })}
            </div>
            <div className="arknights-selection-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={!!busy || !!created}
                onClick={() =>
                  setSelected(
                    new Set(
                      report.plans
                        .filter((plan) => plan.comparison !== "identical")
                        .map((plan) => plan.id),
                    ),
                  )
                }
              >
                {t("arknights.selectDifferences")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!!busy || !!created}
                onClick={() => setSelected(new Set())}
              >
                {t("arknights.clearSelection")}
              </button>
              <span>{t("arknights.selectedCount", { count: selected.size })}</span>
            </div>
            {report.warnings.length > 0 && (
              <div className="notice notice-warning arknights-warnings">
                <Icon name="alert" size={14} />
                <ul>
                  {report.warnings.map((warning, index) => (
                    <li key={index}>
                      {t(`arknights.warnings.${warning.code}`)}
                      {warning.file ? ` · ${warning.file}` : ""}
                      {warning.asset ? ` · ${warning.asset}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="arknights-plan">
              <table>
                <thead>
                  <tr>
                    <th>{t("arknights.include")}</th>
                    <th>{t("arknights.source")}</th>
                    <th>{t("arknights.target")}</th>
                    <th>{t("arknights.comparisonTitle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.plans.map((plan) => (
                    <tr key={plan.id}>
                      <td className="arknights-select-cell">
                        <input
                          type="checkbox"
                          aria-label={t("arknights.selectResource", {
                            name: plan.resource || plan.target,
                          })}
                          disabled={!!busy || !!created}
                          checked={selected.has(plan.id)}
                          onChange={(event) =>
                            selectPlans([plan], event.target.checked)
                          }
                        />
                      </td>
                      <td>
                        {plan.asset}
                        <small>
                          {
                            report.sections.find(
                              (section) =>
                                section.id === plan.appearanceSectionId,
                            )?.name
                          }
                          {plan.assetKind
                            ? ` · ${t(`arknights.assetKind.${plan.assetKind}`)}`
                            : ""}
                        </small>
                      </td>
                      <td>
                        {plan.resource || plan.target}
                        {plan.bundle && <small>{plan.bundle}</small>}
                      </td>
                      <td>
                        {t(`arknights.comparison.${plan.comparison || "unknown"}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => {
              setCreated(null);
              setRevision((v) => v + 1);
            }}
          >
            {t("arknights.analyzeAgain")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !!busy ||
              !report ||
              report.kind === "assetbundle" ||
              !selected.size ||
              !!created ||
              !!report.collisions?.length
            }
            onClick={create}
          >
            {t(report?.kind === "bundle" ? "arknights.convert" : "arknights.repair")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
