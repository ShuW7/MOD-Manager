"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const fs = require("fs");

// Formats a byte size for the import dialogs. Kept separate from the archive
// code so the same wording is used by every import path.
function getFileSizeLabel(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    if (size >= 1024 * 1024) return i18n.t("backend.install.advice.mB", {
      progress: (size / 1024 / 1024).toFixed(1)
    });
    if (size >= 1024) return i18n.t("backend.install.advice.kB", {
      progress: (size / 1024).toFixed(1)
    });
    return i18n.t("backend.install.advice.b", {
      size
    });
  } catch (_) {
    return i18n.t("backend.install.advice.sizeUnavailable");
  }
}

module.exports = {
  getFileSizeLabel
};
