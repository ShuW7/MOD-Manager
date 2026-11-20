import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { DownloadManagerButton } from "./DownloadManagerButton.jsx";
import { LaunchControls } from "./LaunchControls.jsx";
import { WindowControls } from "./WindowControls.jsx";
import { Icon } from "./Icon.jsx";
import { useSortableOrder } from "../hooks/useSortableOrder.js";

const TopBar = React.memo(function TopBar({
  activeTab,
  setActiveTab,
  activeGame,
  currentCharacter,
  onHome,
}) {
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("qaqr.sidebar.collapsed") === "true";
    } catch {
      return false;
    }
  });
  const menuItems = [
    {
      id: "characters",
      label: t("navigation.charactersOverview"),
      icon: "users",
    },
    { id: "ui", label: t("navigation.uiResources"), icon: "image" },
    { id: "modmarket", label: t("navigation.modDownloads"), icon: "store" },
    { id: "presets", label: t("navigation.presetSettings"), icon: "layers" },
  ];
  const sorting = useSortableOrder(
    menuItems,
    "qaqm.navigationOrder.v2",
    true,
    void 0,
    "y",
  );
  function toggleSidebar() {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("qaqr.sidebar.collapsed", String(!collapsed));
    } catch {}
  }
  return (
    <>
      <header className="app-topbar">
        <div className="window-drag-region" aria-hidden={true} />
        <span className="app-window-name">QAQ-Revival</span>
        {(activeTab === "characters" || activeTab === "ui") &&
          currentCharacter && (
            <button
              type="button"
              className="topbar-breadcrumb-current"
              onClick={() => setActiveTab(activeTab)}
              title={t("navigation.charactersOverview")}
            >
              <Icon name="chevron-right" size={12} /> {currentCharacter}
            </button>
          )}
        <WindowControls />
      </header>
      <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
        <div className="sidebar-brand-row">
          <button
            type="button"
            className="sidebar-logo"
            onClick={onHome}
            title={t("navigation.charactersOverview")}
          >
            QAQR
          </button>
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={t(
              collapsed
                ? "navigation.expandSidebar"
                : "navigation.collapseSidebar",
            )}
            title={t(
              collapsed
                ? "navigation.expandSidebar"
                : "navigation.collapseSidebar",
            )}
            aria-expanded={!collapsed}
          >
            <Icon
              name={collapsed ? "chevron-right" : "chevron-left"}
              size={16}
            />
          </button>
        </div>
        <div className="sidebar-game">
          <span className="sidebar-game-icon">
            <Icon name="gamepad" size={25} />
          </span>
          <div className="sidebar-game-copy">
            <span>ARKNIGHTS</span>
            <strong>
              {activeGame?.shortName ||
                activeGame?.name ||
                t("navigation.currentGame")}
            </strong>
          </div>
        </div>
        <nav className="nav-menu" aria-label={t("navigation.mainNavigation")}>
          {sorting.items.map((item) => (
            <button
              {...sorting.itemProps(item.id)}
              type="button"
              className={`nav-item nav-${item.id} ${activeTab === item.id ? "active" : ""}`}
              aria-label={item.label}
              aria-current={activeTab === item.id ? "page" : void 0}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              key={item.id}
            >
              <Icon name={item.icon} size={21} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
          <div className="sidebar-nav-divider" />
          <button
            type="button"
            className={`nav-item nav-settings ${activeTab === "settings" ? "active" : ""}`}
            aria-current={activeTab === "settings" ? "page" : void 0}
            title={t("navigation.systemSettings")}
            aria-label={t("navigation.systemSettings")}
            onClick={() => setActiveTab("settings")}
          >
            <Icon name="wrench" size={21} className="nav-icon" />
            <span className="nav-label">{t("navigation.systemSettings")}</span>
          </button>
        </nav>
        <div className="sort-announcement sr-only" role="status">
          {sorting.announcement}
        </div>
        {sorting.error && (
          <div className="sidebar-error" role="alert">
            {sorting.error}
          </div>
        )}
        <div className="sidebar-launch-card">
          <div className="sidebar-download-row">
            <span>{t("downloads.title")}</span>
            <DownloadManagerButton />
          </div>
          <LaunchControls activeGame={activeGame} />
        </div>
      </aside>
    </>
  );
});
export { TopBar };
