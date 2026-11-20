import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import PawchiveView from "./PawchiveView.jsx";
import ModMarketView from "../market/ModMarketView.jsx";

const SOURCES = [
  ["qaqm", "QAQR"],
  ["kemono", "Kemono"],
  ["pawchive", "Pawchive"],
];
function rememberedSource(sources) {
  try {
    const saved = localStorage.getItem("qaqm.downloadSource");
    if (sources.some(([id]) => id === saved)) return saved;
  } catch {
    /* Storage is optional. */
  }
  return "qaqm";
}
function SourceTabs({ sources, value, onChange }) {
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
    </div>
  );
}
function ModDownloadView({
  isActive = true,
  marketKey,
  onQaqmActiveChange,
  ...marketProps
}) {
  const [source, setSource] = React.useState(() => rememberedSource(SOURCES));
  const [visited, setVisited] = React.useState(() => new Set([source]));
  const current = marketProps.pendingDetailMod ? "qaqm" : source;
  const restoreTabFocus = React.useRef(false);
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
  const tabs = (
    <SourceTabs sources={SOURCES} value={current} onChange={chooseSource} />
  );
  return (
    <section
      className="mod-download-view"
      aria-label={t("navigation.modDownloads")}
    >
      <h1 className="sr-only">{t("navigation.modDownloads")}</h1>
      {SOURCES.filter(
        ([id]) => visited.has(id) || id === current,
      ).map(([id]) => (
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
          ) : (
            <PawchiveView
              source={id}
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
