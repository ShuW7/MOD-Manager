"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  getRandomLaunchSettings
} = require("../runtime/random-executable.cjs");
const {
  migratePersistSettings
} = require("../persist/settings.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesDefinitions = require("./definitions.cjs");
const marketAccess = require("../market/access.cjs");
const systemPaths = require("../system/paths.cjs");
const dataPaths = require("../runtime/data-paths.cjs");
let arknightsMigrationAttempted = false;

const LEGACY_GAME_KEYS = ["dx12LauncherPath", "nevernessDx12DisabledModsDir", "modLoaderPath", "xxmiPath", "efmiPath", "loaderPath"];

function getBuiltInGameDefinition(gameId) {
  return gamesDefinitions.BUILTIN_GAME_MAP.get(gameId) || null;
}
function getBuiltInGameImagePath(fileName) {
  const candidates = [path.join(electron.app.getAppPath(), "resources", "pics", "games", fileName), path.join(process.resourcesPath || "", "pics", "games", fileName)].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return null;
}
function getImageDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp"
    }[ext] || "image/png";
    return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch (_) {
    return null;
  }
}
function createBuiltInGameConfig(definition, overrides = {}) {
  return {
    id: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    description: definition.description,
    gamePath: "",
    officialLauncherPath: "",
    modFolderPath: definition.id === "arknights" && configStore.currentConfig.arknightsLegacyDataRoot ? path.join(configStore.currentConfig.arknightsLegacyDataRoot, "Mods") : dataPaths.getDefaultModsPath(definition.id),
    launchMode: definition.defaultLaunchMode,
    supportedLaunchModes: definition.supportedLaunchModes || ["ARKNIGHTS"],
    launchArgs: definition.defaultLaunchArgs || "",
    icon: definition.imageFile,
    marketGameId: definition.marketGameId,
    isBuiltIn: true,
    ...overrides
  };
}
function ensureBuiltInGamesConfigured() {
  let changed = false;
  const legacyArknights = path.join(electron.app.getPath("userData"), "arknights");
  const arknightsGame = Array.isArray(configStore.currentConfig.games) ? configStore.currentConfig.games.find(game => game.id === "arknights") : null;
  if (!arknightsMigrationAttempted && fs.existsSync(legacyArknights) && (!arknightsGame || systemPaths.isSameResolvedPath(arknightsGame.modFolderPath, path.join(legacyArknights, "Mods")) || !fs.existsSync(path.join(dataPaths.getDataRoot(), "Arknights")))) {
    arknightsMigrationAttempted = true;
    try {
      dataPaths.migrateLegacyArknights(legacyArknights);
      if (configStore.currentConfig.arknightsLegacyDataRoot || configStore.currentConfig.arknightsMigrationError) {
        delete configStore.currentConfig.arknightsLegacyDataRoot;
        delete configStore.currentConfig.arknightsMigrationError;
        changed = true;
      }
      if (arknightsGame && systemPaths.isSameResolvedPath(arknightsGame.modFolderPath, path.join(legacyArknights, "Mods"))) {
        arknightsGame.modFolderPath = dataPaths.getDefaultModsPath("arknights");
        changed = true;
      }
    } catch (error) {
      configStore.currentConfig.arknightsLegacyDataRoot = legacyArknights;
      configStore.currentConfig.arknightsMigrationError = error.message;
      if (arknightsGame && systemPaths.isSameResolvedPath(arknightsGame.modFolderPath, dataPaths.getDefaultModsPath("arknights"))) arknightsGame.modFolderPath = path.join(legacyArknights, "Mods");
      coreLogger.logger.warn("Arknights migration deferred; continuing with the legacy directory:", error.message);
      changed = true;
    }
  }
  if (!Array.isArray(configStore.currentConfig.games)) {
    configStore.currentConfig.games = [];
    changed = true;
  }
  // Arknights-only manager: discard saved entries for other games instead of
  // continuing to show dead game modules after an upgrade.
  const allowedGameIds = new Set(gamesDefinitions.BUILTIN_GAMES.map(game => game.id));
  const retainedGames = configStore.currentConfig.games.filter(game => game && allowedGameIds.has(game.id));
  if (retainedGames.length !== configStore.currentConfig.games.length) {
    configStore.currentConfig.games = retainedGames;
    changed = true;
  }
  for (const definition of gamesDefinitions.BUILTIN_GAMES) {
    let game = configStore.currentConfig.games.find(item => item.id === definition.id || item.name === definition.name);
    if (!game) {
      game = createBuiltInGameConfig(definition);
      configStore.currentConfig.games.push(game);
      changed = true;
    }
    const normalizedGame = createBuiltInGameConfig(definition, game);
    const keys = Object.keys(normalizedGame);
    for (const key of keys) {
      if (game[key] !== normalizedGame[key]) {
        game[key] = normalizedGame[key];
        changed = true;
      }
    }
    for (const legacyKey of LEGACY_GAME_KEYS) {
      if (Object.hasOwn(game, legacyKey)) {
        delete game[legacyKey];
        changed = true;
      }
    }
    const expectedSupportedLaunchModes = definition.supportedLaunchModes || ["ARKNIGHTS"];
    if (JSON.stringify(game.supportedLaunchModes || []) !== JSON.stringify(expectedSupportedLaunchModes)) {
      game.supportedLaunchModes = [...expectedSupportedLaunchModes];
      changed = true;
    }
    if (game.launchMode && !expectedSupportedLaunchModes.includes(game.launchMode)) {
      game.launchMode = definition.defaultLaunchMode;
      changed = true;
    }
    if (definition.defaultLaunchArgs && !String(game.launchArgs || "").trim()) {
      game.launchArgs = definition.defaultLaunchArgs;
      changed = true;
    }
    if (game.icon !== definition.imageFile && !getBuiltInGameImagePath(game.icon || "")) {
      game.icon = definition.imageFile;
      changed = true;
    }
    if (!game.modFolderPath) {
      game.modFolderPath = dataPaths.getDefaultModsPath(game.id);
      changed = true;
    }
    const defaultModsPath = dataPaths.getDefaultModsPath(game.id);
    if (systemPaths.isSameResolvedPath(game.modFolderPath, defaultModsPath)) fs.mkdirSync(defaultModsPath, { recursive: true });
  }
  if (!configStore.currentConfig.games.length) {
    configStore.currentConfig.games.push(createBuiltInGameConfig(gamesDefinitions.BUILTIN_GAMES[0]));
    changed = true;
  }
  if (migratePersistSettings(configStore.currentConfig)) changed = true;
  // Always retain an accessible selection, including after loading older backups.
  let visibleGames = configStore.currentConfig.games.filter(game => game.hidden !== true);
  if (!visibleGames.length) {
    configStore.currentConfig.games[0].hidden = false;
    visibleGames = [configStore.currentConfig.games[0]];
    changed = true;
  }
  if (configStore.currentConfig.activeGameId !== "arknights" || !visibleGames.some(game => game.id === "arknights")) {
    configStore.currentConfig.activeGameId = "arknights";
    changed = true;
  }
  if (changed) {
    configStore.saveConfig(configStore.currentConfig);
  }
}
function serializeGameForRenderer(game) {
  const definition = getBuiltInGameDefinition(game.id);
  const iconPath = getBuiltInGameImagePath(game.icon || "") || getBuiltInGameImagePath(definition?.imageFile || "");
  return {
    ...game,
    description: game.description || definition?.description || "",
    shortName: game.shortName || definition?.shortName || game.name,
    marketGameId: game.marketGameId || definition?.marketGameId || game.id,
    supportedLaunchModes: definition?.supportedLaunchModes || game.supportedLaunchModes || ["ARKNIGHTS"],
    modLoaderLabel: definition?.modLoaderLabel || i18n.t("backend.games.settings.modLoader"),
    executableHint: definition?.executableHint || i18n.t("backend.games.settings.gameExecutable"),
    coverUrl: getImageDataUrl(iconPath)
  };
}
function getResolvedGamePaths(gameId2 = getActiveGameScopeId()) {
  const targetGame = getGameById(gameId2);
  if (targetGame) {
    return {
      activeGame: targetGame,
      modsPath: targetGame.modFolderPath || "",
      gamePath: targetGame.gamePath || "",
      modLoaderPath: ""
    };
  }
  const activeGame = getActiveGame();
  if (String(gameId2 || "").trim() && activeGame?.id && activeGame.id !== gameId2) {
    return {
      activeGame: null,
      modsPath: "",
      gamePath: "",
      modLoaderPath: ""
    };
  }
  return {
    activeGame,
    modsPath: activeGame?.modFolderPath || "",
    gamePath: activeGame?.gamePath || "",
    modLoaderPath: ""
  };
}
function getSettingsGame(gameId) {
  const game = gameId === undefined ? getActiveGame() : getGameById(gameId);
  if (!game) throw new Error(i18n.t("backend.games.settings.gameConfigMissing"));
  return game;
}
function updateActiveGameConfig(updates, gameId) {
  const activeGame = gameId === undefined ? getActiveGame() : getSettingsGame(gameId);
  if (activeGame) {
    if (activeGame.id === "arknights") require("./arknights/service.cjs").validateLibrary(updates.modFolderPath || activeGame.modFolderPath, updates.gamePath || activeGame.gamePath);
    Object.entries(updates || {}).forEach(([key, value]) => {
      activeGame[key] = value;
    });
    configStore.saveConfig(configStore.currentConfig);
    notifyGamesChanged();
    return activeGame;
  }
  return null;
}
function isExistingDirectory(targetPath) {
  try {
    return !!targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}
function resolveSelectedModsFolder(selectedPath, {
  gameId: gameId2 = getActiveGameScopeId()
} = {}) {
  if (!isExistingDirectory(selectedPath)) {
    return {
      ok: false,
      error: i18n.t("backend.games.settings.existingFolderRequired")
    };
  }
  const basePath = path.resolve(selectedPath);
  if (gameId2 === "arknights" || getBuiltInGameDefinition(gameId2)) {
    try {
      require("./arknights/service.cjs").validateLibrary(basePath);
      return { ok: true, path: basePath, modsPath: basePath, originalPath: basePath, adjusted: false };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  return {
    ok: true,
    path: basePath,
    modsPath: basePath,
    originalPath: basePath,
    adjusted: false
  };
}
function shouldResolveFolderSelectionAsMods(title, options = {}) {
  if (options?.modsFolder) return true;
  return /\bmods\b/i.test(String(title || ""));
}
function buildRendererConfig() {
  ensureBuiltInGamesConfigured();
  const {
    activeGame,
    modsPath,
    gamePath
  } = getResolvedActiveGamePaths();
  return {
    ...configStore.currentConfig,
    randomLaunch: getRandomLaunchSettings(configStore.currentConfig),
    compatibilityMode: configStore.isCompatibilityModeEnabled(),
    compatibilityLevel: configStore.getCompatibilityLevel(),
    activeGame: activeGame ? serializeGameForRenderer(activeGame) : null,
    modsPath,
    gamePath,
    games: (configStore.currentConfig.games || []).map(serializeGameForRenderer)
  };
}
function notifyGamesChanged() {
  const activeGame = getActiveGame();
  const payload = {
    activeGameId: configStore.currentConfig.activeGameId,
    activeGame: activeGame ? serializeGameForRenderer(activeGame) : null,
    games: (configStore.currentConfig.games || []).map(serializeGameForRenderer)
  };
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send("games-changed", payload);
    }
  });
}
function getResolvedActiveGamePaths() {
  return getResolvedGamePaths(getActiveGameScopeId());
}
function getActiveGame() {
  if (configStore.currentConfig.activeGameId && configStore.currentConfig.games && configStore.currentConfig.games.length > 0) {
    return configStore.currentConfig.games.find(g => g.id === configStore.currentConfig.activeGameId) || null;
  }
  return null;
}
function getGameById(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = String(gameId2 || "").trim();
  if (!normalizedGameId || !Array.isArray(configStore.currentConfig.games)) return null;
  return configStore.currentConfig.games.find(game => game.id === normalizedGameId) || null;
}
function getActiveGameScopeId() {
  return getActiveGame()?.id || configStore.currentConfig.activeGameId || "arknights";
}
function normalizeMarketGameId(gameId2) {
  return String(gameId2 || "").trim() || "arknights";
}
function getMarketGameId(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = normalizeMarketGameId(gameId2);
  const game = configStore.currentConfig.games?.find(entry => entry.id === normalizedGameId);
  return game?.marketGameId || getBuiltInGameDefinition(normalizedGameId)?.marketGameId || normalizedGameId;
}
function getModCachePath(gameId2 = getActiveGameScopeId()) {
  const marketGameId = normalizeMarketGameId(getMarketGameId(gameId2));
  return path.join(electron.app.getPath("userData"), `mod-market-cache-${marketGameId}.json`);
}
const CACHE_SCHEMA_VERSION = 5;
function normalizeCachePayload(cache) {
  return {
    mods: Array.isArray(cache?.mods) ? cache.mods : [],
    lastSyncTimestamp: cache?.lastSyncTimestamp || null,
    marketVersion: cache?.marketVersion || null,
    responseRevision: Number.isFinite(cache?.responseRevision) ? cache.responseRevision : 0,
    marketAccess: marketAccess.normalizeMarketAccessPayload(cache?.marketAccess),
    authScope: String(cache?.authScope || ""),
    accessCheckedAt: cache?.accessCheckedAt || null,
    schemaVersion: Number.isFinite(cache?.schemaVersion) ? cache.schemaVersion : 0
  };
}
function getScopedCharacterOrder() {
  const gameId2 = getActiveGameScopeId();
  if (Array.isArray(configStore.currentConfig.characterOrdersByGame?.[gameId2])) {
    return configStore.currentConfig.characterOrdersByGame[gameId2];
  }
  return [];
}
function setScopedCharacterOrder(characterOrder) {
  const gameId2 = getActiveGameScopeId();
  if (!configStore.currentConfig.characterOrdersByGame || typeof configStore.currentConfig.characterOrdersByGame !== "object") {
    configStore.currentConfig.characterOrdersByGame = {};
  }
  const previous = configStore.currentConfig.characterOrdersByGame[gameId2];
  configStore.currentConfig.characterOrdersByGame[gameId2] = Array.isArray(characterOrder) ? characterOrder : [];
  if (configStore.saveConfig(configStore.currentConfig)) return true;
  if (previous === undefined) delete configStore.currentConfig.characterOrdersByGame[gameId2];else configStore.currentConfig.characterOrdersByGame[gameId2] = previous;
  return false;
}
function getModsPath(gameId2 = getActiveGameScopeId()) {
  return getResolvedGamePaths(gameId2).modsPath || "";
}
function getModsPathStatus({
  requireExisting = true,
  gameId: gameId2 = getActiveGameScopeId()
} = {}) {
  const modsPath = getModsPath(gameId2);
  if (!modsPath) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_SET",
      error: i18n.t("backend.games.settings.modsPathNotConfigured")
    };
  }
  if (requireExisting && !fs.existsSync(modsPath)) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_FOUND",
      error: i18n.t("backend.games.settings.modsPathMissing")
    };
  }
  return {
    ok: true,
    modsPath
  };
}
function getModAddedAtScopeKey() {
  const activeGame = getActiveGame();
  if (activeGame?.id) return `game:${activeGame.id}`;
  const modsPath = getModsPath();
  if (modsPath) return `mods:${modsPath}`;
  return "__default__";
}
function getDirectoryBirthtimeMs(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    if (Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0) {
      return Math.round(stats.birthtimeMs);
    }
    if (Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0) {
      return Math.round(stats.mtimeMs);
    }
  } catch (_) {}
  return Date.now();
}
function createModAddedAtAccessor() {
  if (!configStore.currentConfig.modAddedAt || typeof configStore.currentConfig.modAddedAt !== "object") {
    configStore.currentConfig.modAddedAt = {};
  }
  const scopeKey = getModAddedAtScopeKey();
  if (!configStore.currentConfig.modAddedAt[scopeKey] || typeof configStore.currentConfig.modAddedAt[scopeKey] !== "object") {
    configStore.currentConfig.modAddedAt[scopeKey] = {};
  }
  const scopeStore = configStore.currentConfig.modAddedAt[scopeKey];
  let dirty = false;
  return {
    get(characterName, modName, modDirPath) {
      const key = `${characterName}/${modName}`;
      if (!Number.isFinite(scopeStore[key])) {
        scopeStore[key] = getDirectoryBirthtimeMs(modDirPath);
        dirty = true;
      }
      const addedAtMs = scopeStore[key];
      return {
        addedAtMs,
        addedAt: new Date(addedAtMs).toISOString()
      };
    },
    saveIfDirty() {
      if (dirty) {
        configStore.saveConfig(configStore.currentConfig);
      }
    }
  };
}
function initialize() {
  ensureBuiltInGamesConfigured();
}
module.exports = {
  initialize,
  getBuiltInGameDefinition,
  createBuiltInGameConfig,
  ensureBuiltInGamesConfigured,
  serializeGameForRenderer,
  getResolvedGamePaths,
  getSettingsGame,
  updateActiveGameConfig,
  isExistingDirectory,
  resolveSelectedModsFolder,
  shouldResolveFolderSelectionAsMods,
  buildRendererConfig,
  notifyGamesChanged,
  getResolvedActiveGamePaths,
  getActiveGame,
  getGameById,
  getActiveGameScopeId,
  normalizeMarketGameId,
  getMarketGameId,
  getModCachePath,
  normalizeCachePayload,
  getScopedCharacterOrder,
  setScopedCharacterOrder,
  getModsPath,
  getModsPathStatus,
  createModAddedAtAccessor,
  CACHE_SCHEMA_VERSION
};
