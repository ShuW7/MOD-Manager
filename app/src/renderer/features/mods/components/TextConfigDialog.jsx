import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";

export function TextConfigDialog({ characterName, mod, onClose, onSaved }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [info, setInfo] = React.useState(null);
  const [textType, setTextType] = React.useState("story");
  const [textRoot, setTextRoot] = React.useState("text");
  const [autoMap, setAutoMap] = React.useState(true);
  const [priority, setPriority] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.api.arknightsTextConfigInspect({
          characterName,
          modName: mod.name,
        });
        if (!result?.success) throw Error(result?.error || t("arknights.errors.textConfigNoFiles"));
        if (cancelled) return;
        setInfo(result);
        setTextType(result.type || "story");
        setTextRoot(result.textRoot || "text");
        setAutoMap(result.auto !== false);
        setPriority(Number(result.priority) || 0);
      } catch (cause) {
        if (!cancelled) setError(cause.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterName, mod.name]);

  async function save(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    try {
      const result = await window.api.arknightsTextConfigSave({
        characterName,
        modName: mod.name,
        textType,
        textRoot,
        autoMap,
        priority,
      });
      if (!result?.success) throw Error(result?.error || t("arknights.errors.textConfigNoFiles"));
      onSaved?.(result);
      onClose?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onClick={() => !saving && onClose?.()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose?.();
      }}
    >
      <form
        className="modal-content arknights-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-config-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
      >
        <div className="arknights-dialog-heading">
          <div className="arknights-dialog-title">
            <div id="text-config-title" className="dialog-title">
              {t("arknights.textConfig")}
            </div>
            <div className="dialog-desc">
              {mod.name} · {t("arknights.textConfigHint")}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            title={t("common.actions.close")}
            aria-label={t("common.actions.close")}
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {loading && (
          <p className="arknights-status" role="status">
            <span className="spinner" />
            {t("arknights.analyzing")}
          </p>
        )}
        {error && (
          <div className="notice notice-danger arknights-error" role="alert">
            <Icon name="alert" size={14} />
            <span>{error}</span>
          </div>
        )}
        {!loading && info && (
          <>
            <p className="arknights-hint">
              {t("arknights.textFiles", { count: info.files })}
            </p>
            <div className="dialog-body text-config-form">
              <label className="form-field">
                <span>{t("arknights.textType")}</span>
                <select
                  className="input"
                  value={textType}
                  disabled={saving}
                  onChange={(event) => setTextType(event.target.value)}
                >
                  {["story", "voice", "archive", "direct_match"].map((type) => (
                    <option key={type} value={type}>
                      {t(`arknights.textTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{t("arknights.textRoot")}</span>
                <input
                  className="input"
                  type="text"
                  value={textRoot}
                  disabled={saving}
                  onChange={(event) => setTextRoot(event.target.value)}
                />
              </label>
              <label className="form-field checkbox-field">
                <input
                  type="checkbox"
                  checked={autoMap}
                  disabled={saving}
                  onChange={(event) => setAutoMap(event.target.checked)}
                />
                <span>{t("arknights.autoMapByStem")}</span>
              </label>
              <label className="form-field">
                <span>{t("arknights.priority")}</span>
                <input
                  className="input"
                  type="number"
                  value={priority}
                  disabled={saving}
                  onChange={(event) => setPriority(Number(event.target.value) || 0)}
                />
              </label>
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" disabled={saving} onClick={onClose}>
            {t("common.actions.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || loading || !info}
          >
            {saving ? t("common.status.saving") : t("common.actions.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
