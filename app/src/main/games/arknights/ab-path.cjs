"use strict";

const fs = require("node:fs");
const path = require("node:path");
const i18n = require("../../../shared/i18n/core.cjs");
const abMod = require("./ab-mod.cjs");

async function selectConfig(gamePath, modDir, dialog) {
  if (!abMod.abFiles(modDir, { bundleRoot: "" }).length) throw Error(i18n.t("arknights.errors.abNoBundles"));
  const root = path.join(path.dirname(gamePath), "Arknights_Data", "StreamingAssets", "AB", "Windows");
  const selection = await dialog.showOpenDialog({
    title: i18n.t("arknights.abFolder"),
    defaultPath: fs.existsSync(root) ? root : path.dirname(gamePath),
    properties: ["openDirectory"]
  });
  if (selection.canceled || !selection.filePaths.length) return null;
  const directory = selection.filePaths[0];
  let derived, entries;
  try {
    if (!fs.statSync(directory).isDirectory()) throw Error("directory");
    derived = abMod.deriveConfig(gamePath, directory, modDir);
    entries = abMod.matchBundles(gamePath, modDir, derived);
  } catch { throw Error(i18n.t("arknights.errors.abFolderInvalid")); }
  for (const entry of entries) {
    if (entry.target) continue;
    const selected = await dialog.showOpenDialog({
      title: i18n.t(entry.ambiguous ? "arknights.abFileAmbiguous" : "arknights.abFileMissing", { file: entry.relative }),
      defaultPath: directory,
      properties: ["openFile"],
      filters: [{ name: "Unity AssetBundle", extensions: ["ab"] }]
    });
    if (selected.canceled || !selected.filePaths.length) return null;
    entry.target = selected.filePaths[0];
  }
  try { return abMod.mappedConfig(gamePath, derived, entries); }
  catch (error) {
    throw Error(i18n.t(error.message === "duplicate" ? "arknights.errors.abDuplicateTarget" : "arknights.errors.abPathInvalid"));
  }
}

module.exports = { selectConfig };
