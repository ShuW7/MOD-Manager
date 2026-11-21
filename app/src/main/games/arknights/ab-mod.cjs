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
  const bundleRoot = path.join(modDir, safeRelative(config.bundleRoot));
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
  const entries = config.auto ? abFiles(modDir, config).map(file => ({ ...file, key: bundleKey(file, config) }))
    : Object.entries(config.map || {}).map(([key, value]) => {
      const relative = safeRelative(value), file = path.join(modDir, relative);
      const stat = fs.statSync(file);
      key = safeRelative(key);
      if (!key.toLowerCase().endsWith(".ab")) key += ".ab";
      return { path: file, relative, size: stat.size, mtimeMs: stat.mtimeMs, key };
    });
  return entries.map((file) => {
    const { key } = file;
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
  return path.relative(modDir, commonDirectory(files)).split(path.sep).join("/") || ".";
}

function commonDirectory(directories) {
  let common = path.resolve(directories[0]);
  for (const directory of directories.slice(1)) {
    while (path.relative(common, directory).split(path.sep)[0] === ".." || path.isAbsolute(path.relative(common, directory))) {
      const parent = path.dirname(common);
      if (parent === common) throw Error("outside");
      common = parent;
    }
  }
  return common;
}

function deriveConfig(gamePath, selectedPath, modDir) {
  if (!insideGame(gamePath, selectedPath)) throw Error("outside");
  const stat = fs.statSync(selectedPath);
  if (!stat.isDirectory() && (!stat.isFile() || path.extname(selectedPath).toLowerCase() !== ".ab")) throw Error("bundle");
  const directory = stat.isDirectory() ? selectedPath : path.dirname(selectedPath);
  const games = path.dirname(gameRoot(gamePath));
  const keyRoot = path.relative(games, path.resolve(directory)).split(path.sep).join("\\");
  keyRootRelative(gamePath, keyRoot);
  return { keyRoot, bundleRoot: commonBundleRoot(modDir), auto: true };
}

function bundleKey(file, config) {
  const prefix = safeRelative(config.bundleRoot);
  return prefix ? file.relative.slice(prefix.length + 1) : file.relative;
}

function matchBundles(gamePath, modDir, config) {
  const directory = path.join(gameRoot(gamePath), keyRootRelative(gamePath, config.keyRoot));
  const targets = abFiles(directory, { bundleRoot: "" });
  const byPath = new Map(), byName = new Map();
  for (const target of targets) {
    byPath.set(target.relative.toLowerCase(), target.path);
    const name = path.basename(target.path).toLowerCase();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(target.path);
  }
  const entries = abFiles(modDir, config).map(file => {
    const key = bundleKey(file, config);
    const exact = byPath.get(key.toLowerCase());
    const candidates = exact ? [exact] : byName.get(path.basename(file.path).toLowerCase()) || [];
    return { ...file, key, target: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
  });
  // Never silently let two Mod files overwrite the same game bundle.
  const counts = new Map();
  for (const entry of entries) if (entry.target) counts.set(entry.target, (counts.get(entry.target) || 0) + 1);
  return entries.map(entry => counts.get(entry.target) > 1 ? { ...entry, target: null, ambiguous: true } : entry);
}

function mappedConfig(gamePath, config, entries) {
  const directory = path.join(gameRoot(gamePath), keyRootRelative(gamePath, config.keyRoot));
  for (const entry of entries) {
    if (!entry.target || !insideGame(gamePath, entry.target)) throw Error("outside");
    keyRootRelative(gamePath, path.relative(gameRoot(gamePath), entry.target));
    if (path.extname(entry.target).toLowerCase() !== ".ab" || !fs.statSync(entry.target).isFile()) throw Error("bundle");
  }
  const root = commonDirectory([directory, ...entries.map(entry => path.dirname(entry.target))]);
  const map = {}, seen = new Set();
  let auto = true;
  for (const entry of entries) {
    const key = path.relative(root, entry.target).split(path.sep).join("/");
    if (seen.has(key.toLowerCase())) throw Error("duplicate");
    seen.add(key.toLowerCase());
    map[key] = entry.relative;
    if (key.toLowerCase() !== entry.key.toLowerCase()) auto = false;
  }
  return { ...config, keyRoot: path.relative(path.dirname(gameRoot(gamePath)), root).split(path.sep).join("\\"), auto, map: auto ? {} : map };
}

function writeConfig(modDir, { keyRoot, bundleRoot, auto = true, map = {} }) {
  const lines = ["[mod]", "type = assetbundle", "key_root = " + String(keyRoot || "").trim(), "", "bundle_root = " + String(bundleRoot || ".").trim().replace(/\//g, "\\"), "auto_map_by_stem = " + (auto ? "true" : "false")];
  if (!auto) {
    lines.push("", "[map]");
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

module.exports = { TYPE, parseIni, readConfig, abFiles, keyRootRelative, overlaySource, bundleTargets, commonBundleRoot, deriveConfig, matchBundles, mappedConfig, writeConfig, gameRoot, insideGame, isAssetBundleFile };
