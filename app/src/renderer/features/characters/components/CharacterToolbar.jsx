import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
export function CharacterToolbar({
  visibleCharacters,
  characters,
  totalVisibleMods,
  totalVisibleSkins,
  handleBatchImportClick,
  loading,
  missingPath,
  handleIntegratedPackageImportClick,
  renderToolbarActions,
  searchQuery,
  setSearchQuery,
  scope = "characters",
  sharedMods = 0,
  showAllCharacters,
  setShowAllCharacters,
  sortMethod,
  setSortMethod,
  showReorderHint,
  pendingMoveMod,
  onCancelPendingMove,
}) {
  return (
    <div className="page-header character-toolbar-shell">
      <div className="page-heading character-toolbar-head">
        <h1 className="page-title">
          {scope === "shared"
            ? t("characters.shared.title")
            : t("characters.list.title")}
        </h1>
        <span className="page-subtitle character-toolbar-subtitle">
          {scope === "shared"
            ? t("characters.shared.summary", {
                count: visibleCharacters.length,
                mods: sharedMods,
              })
            : t("characters.list.summary", {
                visibleCharactersCount: visibleCharacters.length,
                charactersCount: characters.length,
                totalVisibleMods,
                totalVisibleSkins,
              })}
        </span>
      </div>
      <div className="page-actions">
        <div
          className="character-import-actions"
          role="group"
          aria-label={t("characters.import.title")}
        >
          <button
            type="button"
            className="btn btn-primary batch-import-trigger-btn"
            onClick={handleBatchImportClick}
            disabled={loading || missingPath}
          >
            <Icon name="archive" size={18} />
            {t("characters.import.batchTitle")}
          </button>
          <button
            type="button"
            className="btn elevated-action-btn"
            onClick={handleIntegratedPackageImportClick}
            disabled={loading || missingPath}
          >
            {t("characters.import.integratedTitle")}
          </button>
        </div>
        {renderToolbarActions()}
      </div>
      <div className="page-toolbar character-toolbar-controls">
        <div className="search-field character-search-box">
          <Icon name="search" size={15} className="character-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            placeholder={t("characters.search.placeholder")}
            aria-label={t("characters.search.placeholder")}
            className="character-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-btn search-clear character-search-clear"
              onClick={() => setSearchQuery("")}
              title={t("common.actions.clearSearch")}
              aria-label={t("common.actions.clearSearch")}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        {scope !== "shared" && (
          <div className="character-sort-group">
            <div
              className="segmented"
              role="group"
              aria-label={t("common.fields.display")}
            >
              <span className="segment-label">
                {t("common.fields.display")}
              </span>
              <button
                type="button"
                className={`character-sort-option ${!showAllCharacters ? "active" : ""}`}
                aria-pressed={!showAllCharacters}
                onClick={() => setShowAllCharacters(false)}
                title={t("characters.filter.withContentHint")}
              >
                {t("characters.filter.withContent")}
              </button>
              <button
                type="button"
                className={`character-sort-option ${showAllCharacters ? "active" : ""}`}
                aria-pressed={showAllCharacters}
                onClick={() => setShowAllCharacters(true)}
                title={t("characters.filter.allHint")}
              >
                {t("characters.filter.all")}
              </button>
            </div>
          </div>
        )}
        {scope !== "shared" && (
          <div className="character-sort-group">
            <div
              className="segmented"
              role="group"
              aria-label={t("common.fields.sort")}
            >
              <span className="segment-label">{t("common.fields.sort")}</span>
              <button
                type="button"
                className={`character-sort-option ${sortMethod === "common" ? "active" : ""}`}
                aria-pressed={sortMethod === "common"}
                onClick={() => setSortMethod("common")}
                title={t("characters.sort.usageHint")}
              >
                {t("characters.sort.usage")}
              </button>
              <button
                type="button"
                className={`character-sort-option ${sortMethod === "modCount" ? "active" : ""}`}
                aria-pressed={sortMethod === "modCount"}
                onClick={() => setSortMethod("modCount")}
                title={t("characters.sort.modCountHint")}
              >
                {t("characters.sort.modCount")}
              </button>
              <button
                type="button"
                className={`character-sort-option ${sortMethod === "name" ? "active" : ""}`}
                aria-pressed={sortMethod === "name"}
                onClick={() => setSortMethod("name")}
                title={t("characters.sort.nameHint")}
              >
                {t("common.fields.name")}
              </button>
            </div>
          </div>
        )}
      </div>
      {showReorderHint && (
        <div className="notice character-toolbar-tip">
          <Icon name="info" size={14} />
          {t("characters.sort.dragHint")}
        </div>
      )}
      {pendingMoveMod && (
        <div className="notice notice-info character-toolbar-tip character-move-tip">
          <Icon name="info" size={14} />
          <span>
            {t("characters.move.chooseTarget", {
              modName: pendingMoveMod.modName,
            })}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onCancelPendingMove}
          >
            {t("characters.move.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
