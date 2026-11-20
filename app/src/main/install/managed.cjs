"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  getManagedTargetGameId,
  describeManagedInstallTarget,
  buildManagedDropScanItem
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const fixesService = require("../fixes/service.cjs");
const gamesSettings = require("../games/settings.cjs");
const installPaths = require("./paths.cjs");
const systemWindows = require("../system/windows.cjs");
const MANAGED_UPDATE_ARCHIVE_EXTS = new Set([".zip", ".rar", ".7z", ".exe"]);

function getManagedTargetGameId(requestedGameId, _importerName = "") {
  const candidate = String(requestedGameId || gamesSettings.getActiveGameScopeId()).trim();
  if (candidate && (gamesSettings.getGameById(candidate) || gamesSettings.getBuiltInGameDefinition(candidate))) return candidate;
  return gamesSettings.getActiveGameScopeId();
}
function describeManagedInstallTarget(contentType, requestedGameId, _importerName = "") {
  const normalizedType = installPaths.normalizeManagedInstallContentType(contentType);
  const gameId2 = getManagedTargetGameId(requestedGameId);
  if (normalizedType === "fixer") {
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: "",
      targetPath: path.join(electron.app.getPath("userData"), "fix", gameId2, "user"),
      label: i18n.t("backend.install.managed.independentFixerTitle", {
        name: gamesSettings.getGameById(gameId2)?.name || gamesSettings.getBuiltInGameDefinition(gameId2)?.name || gameId2
      })
    };
  }
  return {
    ok: true,
    contentType: "mod",
    gameId: gameId2,
    importerName: "",
    targetPath: ""
  };
}
function buildManagedDropScanItem(sourcePath, requestedGameId = gamesSettings.getActiveGameScopeId()) {
  const inferred = installPaths.inferManagedInstallFromName(sourcePath, requestedGameId);
  if (inferred.contentType === "mod") return null;
  let stat;
  try {
    stat = fs.statSync(sourcePath);
  } catch (_) {
    return null;
  }
  const ext = stat.isFile() ? path.extname(sourcePath).toLowerCase() : "";
  if (stat.isFile() && !MANAGED_UPDATE_ARCHIVE_EXTS.has(ext)) return null;
  const target = describeManagedInstallTarget(inferred.contentType, inferred.targetGameId);
  return {
    name: stat.isFile() && ext ? path.basename(sourcePath, ext) : path.basename(sourcePath),
    path: sourcePath,
    type: stat.isDirectory() ? "folder" : ext ? ext.slice(1) : "file",
    installContentType: inferred.contentType,
    suggestedContentType: inferred.contentType,
    targetGameId: target.gameId,
    importerName: "",
    managedTargetPath: target.targetPath || "",
    managedTargetLabel: target.label || "",
    managedTargetError: target.error || ""
  };
}
function registerIpc() {
  electron.ipcMain.handle("managed-package:install", async (_, payload = {}) => {
    try {
      const rawSourcePath = String(payload.sourcePath || "").trim();
      if (!rawSourcePath) return {
        success: false,
        error: i18n.t("backend.install.managed.installSourceEmpty")
      };
      const sourcePath = path.resolve(rawSourcePath);
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          error: i18n.t("backend.install.managed.installSourceMissing", {
            sourcePath: payload.sourcePath || ""
          })
        };
      }
      const contentType = installPaths.normalizeManagedInstallContentType(payload.installContentType);
      if (contentType !== "fixer") {
        return {
          success: false,
          error: i18n.t("backend.install.managed.modInstallFlowRequired")
        };
      }
      const target = describeManagedInstallTarget(contentType, payload.gameId);
      if (!target.ok) return {
        success: false,
        error: target.error,
        installContentType: contentType
      };
      return await fixesService.installManagedFixerFromSource(sourcePath, target.gameId);
    } catch (error) {
      coreLogger.logger.error(`[ManagedInstall] Failed: ${error?.stack || error}`);
      return {
        success: false,
        error: systemWindows.formatWindowsFileOperationError(error, {
          path: payload?.sourcePath,
          operation: "managed-package-install"
        })
      };
    }
  });
}
