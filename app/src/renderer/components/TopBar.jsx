import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { DownloadManagerButton } from "./DownloadManagerButton.jsx";
import { LaunchControls } from "./LaunchControls.jsx";
import { WindowControls } from "./WindowControls.jsx";
import { Icon } from "./Icon.jsx";
import { useSortableOrder } from "../hooks/useSortableOrder.js";

const SETTINGS_TABS = ["settings"];

const TopBar = React.memo(function TopBar({
  activeTab,
  setActiveTab,
  activeGame,
  currentCharacter,
  onHome,
}) {
  const menuItems = [
    {
      id: "characters",
      label: t("navigation.charactersOverview"),
      icon: "users",
    },
    {
      id: "ui",
      label: t("navigation.uiResources"),
      icon: "image",
    },
    {
      id: "modmarket",
      label: t("navigation.modDownloads"),
      icon: "store",
    },
    {
      id: "presets",
      label: t("navigation.presetSettings"),
      icon: "layers",
    },
  ];
  const sorting = useSortableOrder(menuItems, "qaqm.navigationOrder.v2", true, void 0, "x");
  const settingsActive = SETTINGS_TABS.includes(activeTab);
  return (
    <header className="app-topbar">
      <div className="window-drag-region" aria-hidden={true} />
      <button
        type="button"
        className="logo"
        onClick={onHome}
        title={t("navigation.charactersOverview")}
      >
        {"Q"}
        <span className="logo-mouth">{"A"}</span>
        {"QR"}
      </button>
      <span className="topbar-game-name">{activeGame?.shortName || activeGame?.name}</span>
      {(activeTab === "characters" || activeTab === "ui") && currentCharacter && (
        <>
          <span className="topbar-divider" aria-hidden={true} />
          <button
            type="button"
            className="topbar-breadcrumb-current"
            onClick={() =>
              setActiveTab(activeTab === "ui" ? "ui" : "characters")
            }
            title={t("navigation.charactersOverview")}
          >
            {currentCharacter}
          </button>
        </>
      )}
      <span className="topbar-divider" aria-hidden={true} />
      <nav className="nav-menu" aria-label={t("navigation.mainNavigation")}>
        {sorting.items.map((item) => (
          <button
            {...sorting.itemProps(item.id)}
            type="button"
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            aria-label={item.label}
            aria-current={activeTab === item.id ? "page" : void 0}
            onClick={() => setActiveTab(item.id)}
            title={t("navigation.tabSortHint", { label: item.label })}
            key={item.id}
          >
            <Icon name={item.icon} className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sort-announcement sr-only" role="status">
        {sorting.announcement}
      </div>
      {sorting.error && (
        <div className="topbar-error" role="alert">
          {sorting.error}
        </div>
      )}
      <div className="topbar-actions">
        <DownloadManagerButton />
        <button
          type="button"
          className={`icon-btn topbar-settings ${settingsActive ? "is-active" : ""}`}
          aria-label={t("navigation.systemSettings")}
          aria-current={settingsActive ? "page" : void 0}
          title={t("navigation.systemSettings")}
          onClick={() => setActiveTab("settings")}
        >
          <Icon name="gear" size={18} />
        </button>
        <LaunchControls
          activeGame={activeGame}
          settingsActive={activeTab === "settings"}
          onOpenSettings={() => {
            try {
              localStorage.setItem("qaqm.settings.category.v2", "game");
            } catch {}
            setActiveTab("settings");
          }}
        />
      </div>
      <WindowControls />
    </header>
  );
});
export { TopBar };
