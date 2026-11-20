"use strict";

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
function resolveDataRoot({ isPackaged, execPath, appPath, override } = {}) {
  return override ? path.resolve(override) : path.join(isPackaged ? path.dirname(execPath) : appPath, "data");
}
function getDataRoot() {
  const { app } = require("electron");
  return resolveDataRoot({ isPackaged: app.isPackaged, execPath: process.execPath, appPath: app.getAppPath(), override: process.env.QAQR_DATA_DIR });
}
function getDefaultModsPath(gameId = "arknights", dataRoot = getDataRoot()) {
  return path.join(dataRoot, gameId === "arknights" ? "Arknights" : gameId, "Mods");
}
// The default folder is pre-filled and pre-created, so only its contents can show that the user adopted it.
function isUnusedDefaultModsPath(modsPath, gameId, dataRoot = getDataRoot()) {
  if (!modsPath || path.resolve(modsPath).toLowerCase() !== path.resolve(getDefaultModsPath(gameId, dataRoot)).toLowerCase()) return false;
  try {
    return fs.readdirSync(modsPath, { recursive: true, withFileTypes: true }).every(entry => entry.isDirectory());
  } catch { return false; }
}
function inventory(root) {
  const result = {};
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error("Linked legacy game data");
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    result[path.relative(root, file)] = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  }
  return result;
}
function migrateLegacyDirectory(legacyRoot, destination) {
  if (!fs.existsSync(legacyRoot) || path.resolve(legacyRoot).toLowerCase() === path.resolve(destination).toLowerCase()) return destination;
  if (fs.lstatSync(legacyRoot).isSymbolicLink()) throw Error("Linked legacy game data");
  const sourceFiles = inventory(legacyRoot);
  const targetFiles = fs.existsSync(destination) ? inventory(destination) : {};
  for (const [name, hash] of Object.entries(sourceFiles)) if (Object.hasOwn(targetFiles, name) && targetFiles[name] !== hash) throw Error("Legacy game data conflicts with the data directory");
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const staged = path.join(parent, `.game-migration-${crypto.randomUUID()}`);
  const copied = [];
  try {
    fs.cpSync(legacyRoot, staged, { recursive: true, errorOnExist: true, force: false });
    if (JSON.stringify(inventory(staged)) !== JSON.stringify(sourceFiles)) throw Error("Legacy game data verification failed");
    if (!fs.existsSync(destination)) fs.renameSync(staged, destination);
    else {
      for (const entry of fs.readdirSync(staged, { recursive: true, withFileTypes: true })) if (entry.isDirectory()) fs.mkdirSync(path.join(destination, path.relative(staged, path.join(entry.parentPath, entry.name))), { recursive: true });
      for (const [name, hash] of Object.entries(sourceFiles)) {
        if (Object.hasOwn(targetFiles, name)) continue;
        const target = path.join(destination, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(staged, name), target, fs.constants.COPYFILE_EXCL);
        copied.push({ target, hash });
        if (crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") !== hash) throw Error("Legacy game data verification failed");
      }
    }
    // Leave the original intact until the user has verified the deployed app.
    return destination;
  } catch (error) {
    for (const { target, hash } of copied.reverse()) {
      try {
        if (fs.existsSync(target) && crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") === hash) fs.unlinkSync(target);
      } catch { /* Keep both originals and any copy whose state cannot be established. */ }
    }
    throw error;
  } finally {
    if (fs.existsSync(staged)) fs.rmSync(staged, { recursive: true, force: true });
  }
}
function migrateLegacyArknights(legacyRoot, dataRoot = getDataRoot()) {
  return migrateLegacyDirectory(legacyRoot, path.join(dataRoot, "Arknights"));
}
module.exports = { resolveDataRoot, getDataRoot, getDefaultModsPath, isUnusedDefaultModsPath, migrateLegacyDirectory, migrateLegacyArknights };
