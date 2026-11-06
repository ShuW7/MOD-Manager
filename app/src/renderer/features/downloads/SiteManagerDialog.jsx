import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../components/Icon.jsx";

export function SiteManagerDialog({ sites = [], onClose, onChanged }) {
  const [label, setLabel] = React.useState("");
  const [url, setUrl] = React.useState("https://");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [deleting, setDeleting] = React.useState("");

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await window.api.modSiteCreate({ label, home: url });
      if (!result?.success) throw Error(result?.error || t("downloads.siteManager.createFailed"));
      setLabel("");
      setUrl("https://");
      await onChanged?.(result.site);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(site) {
    if (busy) return;
    setDeleting(site.id);
    setBusy(true);
    setError("");
    try {
      const result = await window.api.modSiteDelete({ source: site.id });
      if (!result?.success) throw Error(result?.error || t("downloads.siteManager.deleteFailed"));
      await onChanged?.(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setDeleting("");
    }
  }

  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content site-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("downloads.siteManager.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="dialog-title">{t("downloads.siteManager.title")}</h3>
        <p className="dialog-desc">{t("downloads.siteManager.description")}</p>
        <div className="site-manager-list">
          {sites.map((site) => (
            <div className="site-manager-row" key={site.id}>
              <div className="site-manager-copy">
                <strong>{site.label}</strong>
                <span>{site.home}</span>
              </div>
              {site.deletable ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => remove(site)}
                >
                  <Icon name="trash" size={14} />
                  {deleting === site.id
                    ? t("downloads.siteManager.deleting")
                    : t("downloads.siteManager.delete")}
                </button>
              ) : (
                <span className="site-manager-lock">
                  <Icon name="lock" size={13} />
                  {t("downloads.siteManager.builtIn")}
                </span>
              )}
            </div>
          ))}
        </div>
        <form className="site-manager-form" onSubmit={create}>
          <h4>{t("downloads.siteManager.addTitle")}</h4>
          <label className="feedback-field">
            <span>{t("downloads.siteManager.name")}</span>
            <input
              className="input"
              value={label}
              maxLength={80}
              required
              placeholder={t("downloads.siteManager.namePlaceholder")}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="feedback-field">
            <span>{t("downloads.siteManager.url")}</span>
            <input
              className="input"
              type="url"
              value={url}
              maxLength={2000}
              required
              placeholder="https://example.com/arknights"
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          {error && (
            <p className="notice notice-danger" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              {t("common.actions.close")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !label.trim()}>
              {busy ? t("common.status.processing") : t("downloads.siteManager.add")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default SiteManagerDialog;
