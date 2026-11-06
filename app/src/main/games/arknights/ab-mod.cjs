"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TYPE = "assetbundle";
const MAGIC = ["UnityFS", "UnityWeb", "UnityRaw"];

function parseIni(text) {
  const sections = {};
  let current = "";
  for (const line of String(text || "").split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith(";") || stripped.startsWith("#")) continue;
    if (stripped.startsWith("[") && stripped.endsWith("]")) {
      current = stripped.slice(1, -1).trim().toLowerCase();
      sections[current] = sections[current] || {};
      continue;
    }
    const index = stripped.indexOf("=");
    if (index < 0) continue;
    sections[current] = sections[current] || {};
    sections[current][stripped.slice(0, index).trim().toLowerCase()] = stripped.slice(index + 1).trim();
  }
  return sections;
}

function readConfig(modDir) {
  const file = path.join(modDir, "mod.ini");
  if (!fs.existsSync(file)) return null;
  const sections = parseIni(fs.readFileSync(file, "utf8"));
  const mod = sections.mod || {};
  if (String(mod.type || "").toLowerCase() !== TYPE) return null;
  const auto = !["0", "false", "no", "off"].includes(String(mod.auto_map_by_stem || "true").toLowerCase());
  return {
    keyRoot: String(mod.key_root || "").trim(),
    bundleRoot: String(mod.bundle_root || "").trim(),
    auto,
    map: { ...(sections.map || {}) },
    file,
  };
}

function safeRelative(value) {
  const text = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!text) return "";
  if (path.posix.isAbsolute(text) || text.includes(":")) throw Error("invalid path");
  const parts = text.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) throw Error("invalid path");
  return parts.join("/");
}

function gameRoot(gamePath) {
  return path.dirname(path.resolve(gamePath));
}

function insideGame(gamePath, file) {
  const root = gameRoot(gamePath).toLowerCase();
  const target = path.resolve(file).toLowerCase();
  return target.startsWith(root + path.sep);
}

function abFiles(modDir, config) {
  const bundleRoot = config.bundleRoot ? path.join(modDir, config.bundleRoot) : modDir;
  if (!fs.existsSync(bundleRoot) || !fs.statSync(bundleRoot).isDirectory()) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error("linked");
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".ab")) {
        const stat = fs.statSync(file);
        result.push({ path: file, relative: path.relative(modDir, file).split(path.sep).join("/"), size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  };
  visit(bundleRoot);
  return result;
}

function keyRootRelative(gamePath, keyRoot) {
  const game = gameRoot(gamePath);
  const parts = safeRelative(keyRoot).split("/");
  if (parts.length && parts[0].toLowerCase() === path.basename(game).toLowerCase()) parts.shift();
  if (!parts.length || parts[0].toLowerCase() !== "arknights_data") throw Error("outside");
  return parts.join("/");
}

function overlaySource(gamePath, relative) {
  const game = gameRoot(gamePath);
  const marker = "arknights_data/streamingassets/ab/";
  const lowered = relative.toLowerCase();
  if (lowered.startsWith(marker)) {
    const tail = relative.slice(marker.length).split("/").slice(1).join("/");
    const candidate = path.join(game, "Arknights_Data", "PersistentData", "Bundles", ...tail.split("/"));
    if (tail && fs.existsSync(candidate)) return candidate;
  }
  const direct = path.join(game, ...relative.split("/"));
  return fs.existsSync(direct) ? direct : null;
}

function bundleTargets(gamePath, modDir, config) {
  const keyRoot = keyRootRelative(gamePath, config.keyRoot);
  const prefix = config.bundleRoot && config.bundleRoot !== "." ? safeRelative(config.bundleRoot) + "/" : "";
  return abFiles(modDir, config).map((file) => {
    const key = prefix && file.relative.startsWith(prefix) ? file.relative.slice(prefix.length) : file.relative;
    const relative = keyRoot + "/" + key;
    return { ...file, key, target: relative.replace(/\/+/g, "/"), source: overlaySource(gamePath, relative) };
  });
}

function commonBundleRoot(modDir) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".ab")) files.push(path.dirname(full));
    }
  };
  if (!fs.existsSync(modDir)) return "";
  visit(modDir);
  if (!files.length) return "";
  const relative = files.map((directory) => path.relative(modDir, directory).split(path.sep).join("/"));
  if (relative.every((value) => value === relative[0])) return relative[0] === "" ? "." : relative[0];
  return ".";
}

function deriveConfig(gamePath, selectedFile, modDir) {
  if (!insideGame(gamePath, selectedFile)) throw Error("outside");
  if (path.extname(selectedFile).toLowerCase() !== ".ab") throw Error("bundle");
  const games = path.dirname(gameRoot(gamePath));
  const keyRoot = path.relative(games, path.dirname(path.resolve(selectedFile))).split(path.sep).join("\\");
  if (!keyRoot || keyRoot.startsWith("..")) throw Error("outside");
  return { keyRoot, bundleRoot: commonBundleRoot(modDir), auto: true };
}

function writeConfig(modDir, { keyRoot, bundleRoot, auto = true, map = {} }) {
  const lines = ["[mod]", "type = assetbundle", "key_root = " + String(keyRoot || "").trim(), "", "bundle_root = " + String(bundleRoot || ".").trim().replace(/\//g, "\\"), "auto_map_by_stem = " + (auto ? "true" : "false")];
  if (!auto) {
    for (const [key, value] of Object.entries(map || {})) lines.push(`${key} = ${value}`);
  }
  fs.writeFileSync(path.join(modDir, "mod.ini"), lines.join("\r\n") + "\r\n", "utf8");
}

function isAssetBundleFile(file) {
  try {
    const header = Buffer.alloc(8);
    const fd = fs.openSync(file, "r");
    try { fs.readSync(fd, header, 0, 8, 0); } finally { fs.closeSync(fd); }
    return MAGIC.some((magic) => header.toString("latin1").startsWith(magic));
  } catch { return false; }
}

module.exports = { TYPE, parseIni, readConfig, abFiles, keyRootRelative, overlaySource, bundleTargets, commonBundleRoot, deriveConfig, writeConfig, gameRoot, insideGame, isAssetBundleFile };
