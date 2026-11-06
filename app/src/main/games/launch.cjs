"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const gamesSettings = require("./settings.cjs");
const { resolveOfficialLauncherPath } = require("./official-launcher.cjs");
const systemWindows = require("../system/windows.cjs");

let launchInProgress = false;

function registerIpc() {
  electron.ipcMain.handle("launch-game", async (_, { launchMode, gameId } = {}) => {
    if (launchInProgress) return { success: false, error: i18n.t("backend.games.launch.launchInProgress") };
    launchInProgress = true;
    try {
      const activeGame = gamesSettings.getActiveGame();
      if (!activeGame || activeGame.id !== "arknights") {
        return { success: false, error: i18n.t("backend.games.launch.gameChanged") };
      }
      if (gameId && gameId !== activeGame.id) {
        return { success: false, error: i18n.t("backend.games.launch.gameChanged") };
      }
      const { gamePath } = gamesSettings.getResolvedActiveGamePaths();
      if (launchMode === "OFFICIAL") {
        const launcherPath = resolveOfficialLauncherPath(activeGame, { gamePath });
        if (!launcherPath) return { success: false, error: i18n.t("backend.games.launch.officialLauncherMissing") };
        return await systemWindows.windowsLauncher.launch(launcherPath, path.dirname(launcherPath), [], { requireElevation: false });
      }
      if (launchMode === "VANILLA") {
        if (!gamePath || !fs.existsSync(gamePath)) {
          return { success: false, error: i18n.t("backend.games.launch.gamePathNotSetOrInvalid") };
        }
        systemWindows.launchWindowsExecutableViaStart(gamePath);
        return { success: true };
      }
      if (launchMode === "DIRECT" || launchMode === "ARKNIGHTS" || launchMode === void 0) {
        return await require("./arknights/service.cjs").launch();
      }
      return { success: false, error: i18n.t("arknights.errors.launchMode") };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      launchInProgress = false;
    }
  });
}

module.exports = { registerIpc };
