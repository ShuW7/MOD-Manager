import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Modal } from "../../../components/Modal.jsx";
export function MarketDownloadPrompt({
  downloadPrompt,
  isActive,
  setDownloadPrompt,
  onRecheckLogin,
  onOpenWebsite,
}) {
  if (!downloadPrompt || !isActive) return null;
  return (
    <Modal
      open={true}
      onClose={() => setDownloadPrompt(null)}
      overlayClassName="modal-backdrop market-stacked-backdrop"
      ariaLabel={t("market.downloadPrompt.unavailableTitle")}
    >
      <h3 className="dialog-title">
        {t("market.downloadPrompt.unavailableTitle")}
      </h3>
      <p className="dialog-desc">
        {downloadPrompt.type === "login_required"
          ? downloadPrompt.sessionExpired
            ? t("market.downloadPrompt.sessionExpired")
            : t("market.downloadPrompt.loginRequired")
          : t("market.downloadPrompt.sourceUnavailable")}
      </p>
      <div className="dialog-actions">
        {downloadPrompt.type === "login_required" && (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenWebsite?.()}
            >
              {t("market.downloadPrompt.openLogin")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onRecheckLogin?.()}
            >
              {t("market.downloadPrompt.recheckLogin")}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDownloadPrompt(null)}
        >
          {t("common.actions.acknowledge")}
        </button>
      </div>
    </Modal>
  );
}
