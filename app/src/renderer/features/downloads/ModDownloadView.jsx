import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import PawchiveView from "./PawchiveView.jsx";
import ModMarketView from "../market/ModMarketView.jsx";
import ModSiteView from "./ModSiteView.jsx";
import { SiteManagerDialog } from "./SiteManagerDialog.jsx";
import { Icon } from "../../components/Icon.jsx";

const BASE_SOURCES = [
  ["qaqm", "QAQR"],
  ["kemono", "Kemono"],
  ["pawchive", "Pawchive"],
];
const FALLBACK_SITES = [
  { id: "gamebanana", label: t("downloads.sources.gamebanana") },
  { id: "arca", label: t("downloads.sources.arca") },
  { id: "loverslab", label: "LoversLab" },
  { id: "huiyue", label: t("downloads.sources.hui") },
  { id: "keke", label: t("downloads.sources.cocoa") },
];
function sourceList(sites = FALLBACK_SITES) {
  return [...BASE_SOURCES, ...sites.map((site) => [site.id, site.label])];
}
function rememberedSource(sources) {
  try {
    const saved = localStorage.getItem("qaqm.downloadSource");
    if (sources.some(([id]) => id === saved)) return saved;
  } catch {
    /* Storage is optional. */
  }
  return "qaqm";
}
function SourceTabs({ sources, value, onChange, onManage }) {
  function navigate(event) {
    const index = sources.findIndex(([id]) => id === value);
    const target = {
      ArrowRight: (index + 1) % sources.length,
      ArrowLeft: (index - 1 + sources.length) % sources.length,
      Home: 0,
      End: sources.length - 1,
    }[event.key];
    if (target === void 0) return;
    event.preventDefault();
    onChange(sources[target][0]);
  }
  return (
    <div className="source-tabs-row">
      <div
        className="segmented source-tabs"
        role="tablist"
        aria-label={t("downloads.sources.title")}
        onKeyDown={navigate}
      >
        {sources.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`mod-download-source-option ${value === id ? "active" : ""}`}
            aria-selected={value === id}
            tabIndex={value === id ? 0 : -1}
            data-source={id}
            onClick={() => onChange(id)}
          >
            <strong className="mod-download-source-name">{label}</strong>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm source-manager-button"
        title={t("downloads.siteManager.title")}
        aria-label={t("downloads.siteManager.title")}
        onClick={onManage}
      >
        <Icon name="gear" size={15} />
        {t("downloads.siteManager.manage")}
      </button>
    </div>
  );
}
function ModDownloadView({
  isActive = true,
  marketKey,
  onQaqmActiveChange,
  ...marketProps
}) {
  const [source, setSource] = React.useState(() => rememberedSource(sourceList()));
  const [catalog, setCatalog] = React.useState(null);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [visited, setVisited] = React.useState(() => new Set([source]));
  const sources = React.useMemo(() => sourceList(catalog || FALLBACK_SITES), [catalog]);
  const current = marketProps.pendingDetailMod ? "qaqm" : source;
  const restoreTabFocus = React.useRef(false);
  const loadCatalog = React.useCallback(async () => {
    try {
      const result = await window.api.modSiteCatalog();
      if (result?.success && Array.isArray(result.sites)) setCatalog(result.sites);
    } catch {
      /* Keep the built-in source list. */
    }
  }, []);
  React.useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);
  React.useEffect(() => {
    if (!catalog) return;
    let saved = "";
    try {
      saved = localStorage.getItem("qaqm.downloadSource") || "";
    } catch {}
    if (saved && sources.some(([id]) => id === saved) && saved !== source) {
      setSource(saved);
      setVisited((items) => new Set([...items, saved]));
    } else if (!sources.some(([id]) => id === source)) {
      selectSource("qaqm");
    }
  }, [catalog, sources, source]);
  React.useEffect(() => {
    onQaqmActiveChange?.(isActive && current === "qaqm");
    return () => onQaqmActiveChange?.(false);
  }, [isActive, current, onQaqmActiveChange]);
  function selectSource(value) {
    setSource(value);
    setVisited((items) => new Set([...items, value]));
    try {
      localStorage.setItem("qaqm.downloadSource", value);
    } catch {
      /* Keep the session selection. */
    }
  }
  function chooseSource(value) {
    restoreTabFocus.current = true;
    selectSource(value);
  }
  // Each provider renders the switcher into its own header, so focus has to follow the switch.
  React.useLayoutEffect(() => {
    if (!restoreTabFocus.current) return;
    restoreTabFocus.current = false;
    document
      .querySelector(`.mod-download-source-option[data-source="${current}"]`)
      ?.focus({ preventScroll: true });
  }, [current]);
  React.useEffect(() => {
    if (marketProps.pendingDetailMod) selectSource("qaqm");
  }, [marketProps.pendingDetailMod]);
  async function sitesChanged(site) {
    await loadCatalog();
    if (site?.id) selectSource(site.id);
    else selectSource("qaqm");
  }
  const tabs = (
    <SourceTabs
      sources={sources}
      value={current}
      onChange={chooseSource}
      onManage={() => setManagerOpen(true)}
    />
  );
  return (
    <section
      className="mod-download-view"
      aria-label={t("navigation.modDownloads")}
    >
      <h1 className="sr-only">{t("navigation.modDownloads")}</h1>
      {managerOpen && (
        <SiteManagerDialog
          sites={catalog || FALLBACK_SITES}
          onClose={() => setManagerOpen(false)}
          onChanged={sitesChanged}
        />
      )}
      {sources
        .filter(([id]) => visited.has(id) || id === current)
        .map(([id]) => (
          <div
            key={id}
            className="mod-download-provider"
            hidden={current !== id}
            data-source={id}
          >
            {id === "qaqm" ? (
              <ModMarketView
                {...marketProps}
                key={marketKey}
                isActive={isActive && current === id}
                sourceTabs={current === id ? tabs : null}
              />
            ) : ["kemono", "pawchive"].includes(id) ? (
              <PawchiveView
                source={id}
                isActive={isActive && current === id}
                sourceTabs={current === id ? tabs : null}
              />
            ) : (
              <ModSiteView
                key={`${id}:${marketProps.activeGameId}`}
                source={id}
                gameId={marketProps.activeGameId}
                isActive={isActive && current === id}
                sourceTabs={current === id ? tabs : null}
              />
            )}
          </div>
        ))}
    </section>
  );
}
export { ModDownloadView as default };
