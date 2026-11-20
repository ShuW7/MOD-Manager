"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const configStore = require("../config/store.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const gamesSettings = require("../games/settings.cjs");
const { isOfficialLauncherPath, resolveOfficialLauncherPath } = require("../games/official-launcher.cjs");

function registerIpc() {
  electron.ipcMain.handle("game:get-settings", async (_, gameId) => {
    try {
      const game = gamesSettings.getSettingsGame(gameId);
      const paths = gamesSettings.getResolvedGamePaths(game.id);
      require("../runtime/path-report.cjs").writeRuntimePathReport(electron.app, configStore.currentConfig, configStore.configPath);
      return {
        success: true,
        game: {
          ...gamesSettings.serializeGameForRenderer(game),
          modFolderPath: paths.modsPath,
          gamePath: paths.gamePath,
          officialLauncherPath: resolveOfficialLauncherPath(game, { gamePath: paths.gamePath }),
          modLoaderPath: paths.modLoaderPath
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:list", async () => {
    gamesSettings.ensureBuiltInGamesConfigured();
    return {
      success: true,
      games: (configStore.currentConfig.games || []).filter(game => game.hidden !== true).map(gamesSettings.serializeGameForRenderer),
      activeGameId: configStore.currentConfig.activeGameId
    };
  });
  electron.ipcMain.handle("game:update", async (_, {
    gameId: gameId2,
    updates
  }) => {
    try {
      if (!configStore.currentConfig.games) return {
        error: i18n.t("backend.ipc.games.gameConfigMissing")
      };
      const game = configStore.currentConfig.games.find(g => g.id === gameId2);
      if (!game) return {
        error: i18n.t("backend.ipc.characters.gameMissing")
      };
      let resolvedModFolderPath = null;
      if (updates.modFolderPath !== void 0) {
        if (!updates.modFolderPath) {
          resolvedModFolderPath = "";
        } else {
          const modsFolderResult = gamesSettings.resolveSelectedModsFolder(updates.modFolderPath, {
            gameId: gameId2
          });
          if (!modsFolderResult.ok) return {
            error: modsFolderResult.error
          };
          resolvedModFolderPath = modsFolderResult.path;
        }
      }
      if (updates.officialLauncherPath && !isOfficialLauncherPath(game, updates.officialLauncherPath)) return {
        success: false,
        error: i18n.t("backend.games.launch.officialLauncherInvalid")
      };
      if (game.id === "arknights") require("../games/arknights/service.cjs").validateLibrary(resolvedModFolderPath || game.modFolderPath, updates.gamePath || game.gamePath);
      if (updates.name !== void 0) game.name = updates.name.trim();
      if (updates.gamePath !== void 0) game.gamePath = updates.gamePath;
      if (updates.officialLauncherPath !== void 0) game.officialLauncherPath = updates.officialLauncherPath;
      if (updates.modFolderPath !== void 0) game.modFolderPath = resolvedModFolderPath;
      if (updates.launchMode !== void 0) game.launchMode = updates.launchMode;
      if (updates.launchArgs !== void 0) game.launchArgs = updates.launchArgs;
      if (updates.icon !== void 0) game.icon = updates.icon;
      configStore.saveConfig(configStore.currentConfig);
      gamesSettings.notifyGamesChanged();
      return {
        success: true,
        game: gamesSettings.serializeGameForRenderer(game)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-file", async (_, options) => {
    try {
      const dialogOpts = {
        title: options?.title || i18n.t("backend.ipc.games.chooseFile"),
        properties: ["openFile"],
        buttonLabel: i18n.t("backend.fixes.service.selectPrefix")
      };
      if (options?.filters) {
        dialogOpts.filters = options.filters;
      }
      const result = await electron.dialog.showOpenDialog(dialogOpts);
      if (!result.canceled && result.filePaths.length > 0) {
        return {
          success: true,
          filePath: result.filePaths[0]
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-mods-folder", async (_, gameId) => {
    try {
      const targetGame = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectModsFolder"),
        properties: ["openDirectory"],
        buttonLabel: "Select"
      });
      if (result.canceled || result.filePaths.length === 0) return {
        success: false,
        canceled: true
      };
      const selectedPath = result.filePaths[0];
      const resolved = gamesSettings.resolveSelectedModsFolder(selectedPath, {
        gameId: targetGame.id
      });
      if (!resolved.ok) return {
        success: false,
        error: resolved.error,
        candidates: resolved.candidates || []
      };
      const modsPath = resolved.path;
      const gameId2 = targetGame.id;
      gamesSettings.updateActiveGameConfig({
        modFolderPath: modsPath
      }, gameId2);
      const scanResult = charactersOrganization.scanImportCandidates(modsPath, gameId2);
      let importSummary = {
        migratedCategoryCount: 0,
        migratedModCount: 0,
        skippedConflicts: [],
        sourceRoots: []
      };
      if (scanResult.hasCandidates) {
        const movePlan = charactersOrganization.buildImportMovePlan(scanResult, modsPath, gameId2);
        const previewTargets = Array.from(new Set(movePlan.moves.map(move => move.targetDisplayName))).slice(0, 8);
        const previewText = previewTargets.length > 0 ? i18n.t("backend.ipc.games.organizationTargets", {
          path: previewTargets.join("、")
        }) : "";
        const importPrompt = await electron.dialog.showMessageBox(desktopWindows.mainWindowRef, {
          type: "question",
          title: i18n.t("backend.ipc.games.legacyFoldersDetected"),
          message: i18n.t("backend.ipc.games.legacyFoldersPlan", {
            categoryCount: movePlan.categoryCount,
            modCount: movePlan.modCount
          }),
          detail: i18n.t("backend.ipc.games.legacyFoldersDetail", {
            previewText
          }),
          buttons: [i18n.t("backend.ipc.games.confirmOrganization"), i18n.t("backend.ipc.games.deferOrganization")],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        if (importPrompt.response === 0) {
          importSummary = charactersOrganization.executeImportMovePlan(movePlan);
          charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId2);
        } else {
          importSummary = {
            ...importSummary,
            sourceRoots: scanResult.sourceRoots,
            deferred: true
          };
        }
      } else {
        charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId2);
      }
      return {
        success: true,
        ...resolved,
        path: modsPath,
        importSummary
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-game-path", async (_, gameId) => {
    try {
      const activeGame = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectGameExecutable", {
          executableHint: activeGame?.executableHint || "Game.exe"
        }),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: "Select"
      });
      if (result.canceled || result.filePaths.length === 0) return {
        success: false,
        canceled: true
      };
      const selectedPath = result.filePaths[0];
      gamesSettings.updateActiveGameConfig({
        gamePath: selectedPath
      }, activeGame.id);
      return {
        success: true,
        path: selectedPath
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-official-launcher-path", async (_, gameId) => {
    try {
      const game = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectOfficialLauncher"),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        defaultPath: resolveOfficialLauncherPath(game) || undefined
      });
      if (result.canceled || result.filePaths.length === 0) return {
        success: false,
        canceled: true
      };
      const selectedPath = result.filePaths[0];
      if (!isOfficialLauncherPath(game, selectedPath)) return {
        success: false,
        error: i18n.t("backend.games.launch.officialLauncherInvalid")
      };
      gamesSettings.updateActiveGameConfig({
        officialLauncherPath: selectedPath
      }, game.id);
      return {
        success: true,
        path: selectedPath
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("auto-detect-paths", async (_, gameId) => {
    try {
      const activeGame = gamesSettings.getSettingsGame(gameId);
      const gameId2 = activeGame?.id || "arknights";
      const candidates = ["C", "D", "E", "F", "G"].flatMap(drive => ["Arknights", "Arknights Game"].map(folder => path.join(`${drive}:\\`, "Hypergryph Launcher", "games", folder, "Arknights.exe")));
      if (!activeGame.gamePath || !fs.existsSync(activeGame.gamePath)) {
        const found = candidates.find(file => fs.existsSync(file));
        if (found) gamesSettings.updateActiveGameConfig({ gamePath: found }, gameId2);
      }
      require("../games/arknights/service.cjs").initialize();
      return { success: true, config: gamesSettings.buildRendererConfig() };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}

module.exports = {
  registerIpc
};
