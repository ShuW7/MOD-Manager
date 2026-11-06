"use strict";

const path = require("node:path");
const files = require("./files.cjs");
const abMod = require("./ab-mod.cjs");
const textMod = require("./text-config.cjs");
const SHARED_SECTION = "arknights:shared";
const normalize = value => String(value || "").toLowerCase().replace(/[@#]/g, "_");
const APPEARANCE_TARGET = /^(charavatars|charportraits)_(.+)\.png$/i;
const APPEARANCE_ASSET_START = /(?:sp_char_|char_|token_|trap_|npc_|avg_)/i;
const COSMETIC_TARGET = /^(namecardskin|namecardstyle|hometheme|nc|tm)_(.+)\.png$/i;
const COSMETIC_PREFIXES = { namecardskin: "namecard", namecardstyle: "namecard", nc: "namecard", hometheme: "hometheme", tm: "hometheme" };
const COSMETIC_FOLDERS = { namecardskin: "namecard", namecardstyle: "namecard", hometheme: "hometheme" };

// Name card styles and home themes are account-wide cosmetics, not operator
// outfits: they are never assigned to a single skin section.  Community Mods
// use the namecardstyle_ prefix or the bare <style>_<role> / <theme>_<role>
// names, so all of those forms are recognised.
function parseCosmeticSource(value) {
  const posix = String(value || "").replace(/\\/g, "/");
  const base = path.posix.basename(posix);
  const direct = COSMETIC_TARGET.exec(base);
  if (direct) return { family: COSMETIC_PREFIXES[direct[1].toLowerCase()] };
  const parts = posix.split("/");
  const index = parts.findIndex(part => Object.hasOwn(COSMETIC_FOLDERS, part.toLowerCase()));
  if (index < 0 || parts.length - index < 3 || path.posix.extname(parts[parts.length - 1]).toLowerCase() !== ".png") return null;
  return { family: COSMETIC_FOLDERS[parts[index].toLowerCase()] };
}

function parseAppearanceTarget(value) {
  const match = APPEARANCE_TARGET.exec(String(value || ""));
  if (!match) return null;
  const rest = match[2];
  const start = rest.search(APPEARANCE_ASSET_START);
  if (start < 0) return null;
  return {
    family: match[1].toLowerCase() === "charavatars" ? "avatar" : "portrait",
    folder: rest.slice(0, start).replace(/_+$/, "").toLowerCase(),
    asset: rest.slice(start),
  };
}

// Mods that keep the game folder layout (charavatars/elite/…) have no binding
// yet, so the folder itself identifies the appearance family.
function parseAppearanceSource(value) {
  const posix = String(value || "").replace(/\\/g, "/");
  const direct = parseAppearanceTarget(path.posix.basename(posix));
  if (direct) return direct;
  const parts = posix.split("/");
  const index = parts.findIndex(part => /^(?:charavatars|charportraits)$/i.test(part));
  if (index < 0 || index >= parts.length - 1) return null;
  const family = /^charavatars$/i.test(parts[index]) ? "avatar" : "portrait";
  const folder = parts.slice(index + 1, -1).join("_");
  const file = parts[parts.length - 1];
  const extension = path.posix.extname(file);
  if (extension.toLowerCase() !== ".png") return null;
  const stem = file.slice(0, -extension.length);
  return parseAppearanceTarget(`${family === "avatar" ? "charavatars" : "charportraits"}_${folder ? folder + "_" : ""}${stem}.png`);
}

function matchingAppearanceSkins(asset, sections) {
  const key = normalize(asset).replace(/\+$/, "");
  return sections.filter(section => (section.aliases || []).some(alias => normalize(alias).replace(/\+$/, "") === key));
}

function classifyAppearance({ family, folder, asset }, sections) {
  // Promotion (elite) avatars belong to the original outfit, never to a skin.
  if (folder === "elite") return "base";
  const matches = matchingAppearanceSkins(asset, sections);
  if (matches.length === 1) return matches[0].sectionId;
  if (matches.length > 1) return SHARED_SECTION;
  // A shared page bundle holds several outfits: an unmatched skins/ asset is
  // undecided, while a base/elite asset is the operator's own appearance.
  return folder === "skins" ? SHARED_SECTION : "base";
}

function matchingSkins(name, sections, transform = value => value) {
  return sections.filter(section => section.kind === "official-skin" || section.sectionId?.startsWith("skin:")).filter(section =>
    (section.aliases || []).some(alias => {
      if (!/char_\d+_/.test(alias)) return false;
      const normalized = transform(normalize(alias)), index = name.indexOf(normalized);
      return index >= 0 && !/[0-9]/.test(name[index + normalized.length] || "");
    })
  );
}

function classifyResources(resources, sections) {
  const affected = new Set();
  for (const value of resources) {
    const bundle = typeof value === "string" ? "" : normalize(value.bundle);
    const target = typeof value === "string" ? value : value.target || value.resource || "";
    // Avatars and half-body portraits are packed into shared page bundles, so
    // their canonical resource name, not the bundle, identifies the outfit.
    const appearance = parseAppearanceSource(target);
    if (appearance) {
      affected.add(classifyAppearance(appearance, sections));
      continue;
    }
    // Account-wide cosmetics (name card styles, home themes) never belong to a
    // single outfit, so they are reported as shared resources.
    if (parseCosmeticSource(target)) {
      affected.add(SHARED_SECTION);
      continue;
    }
    // Voice lines belong to the operator; only a skin-specific bundle stem
    // moves them to that outfit's section.
    if (/\.wav$/i.test(String(target)) || /\/audio\//i.test(bundle)) {
      const voiceMatches = matchingSkins(normalize(target), sections);
      affected.add(voiceMatches.length === 1 ? voiceMatches[0].sectionId : "base");
      continue;
    }
    if (/^chararts\//.test(bundle) || /^arts\/dynchars\/char_\d+_[a-z0-9]+_[12]\.ab$/.test(bundle)) {
      affected.add("base");
      continue;
    }
    // A bound dynamic bundle belongs to one outfit. Its effect texture names
    // can retain another outfit's name and must not widen that bundle's scope.
    if (bundle.startsWith("arts/dynchars/")) {
      const bundleMatches = matchingSkins(bundle, sections);
      if (bundleMatches.length === 1) { affected.add(bundleMatches[0].sectionId); continue; }
    }
    // Reference aliases may accompany otherwise unnamed material textures in
    // a resource manifest after their PC prefab dependencies are inspected.
    const references = typeof value === "object" && Array.isArray(value.appearanceAliases) ? matchingSkins(value.appearanceAliases.map(normalize).join(" "), sections) : [];
    if (references.length) { affected.add(references.length === 1 ? references[0].sectionId : SHARED_SECTION); continue; }
    const name = normalize(typeof value === "string" ? value : value.resource || path.basename(value.target || ""));
    const token = bundle.match(/^(?:skinpack|chararts)\/(token_[a-z0-9_]+)\.ab$/)?.[1];
    const matches = matchingSkins(name, sections, alias => token ? alias.replace(/^char_\d+_[a-z0-9]+/, token) : alias);
    if (token && matches.length === 0) {
      const tokenIndex = name.indexOf(token);
      const suffix = tokenIndex < 0 ? "" : name.slice(tokenIndex + token.length).replace(/\[alpha\](?=\.)/, "");
      if (tokenIndex >= 0 && /^(?:_[12])?(?:__atlas\d+)?(?:__page\d+)?\.(png|skel|atlas|json)$/.test(suffix)) { affected.add("base"); continue; }
    }
    if (matches.length === 1) {
      affected.add(matches[0].sectionId);
      continue;
    }
    if (matches.length > 1 || /\.(ab|bundle|unity3d)$/.test(name) || name.includes("__texture_")) {
      affected.add(SHARED_SECTION);
      continue;
    }
    const character = name.match(/char_\d+_[a-z0-9]+/);
    if (!character) { affected.add(SHARED_SECTION); continue; }
    const suffix = name.slice(character.index + character[0].length).replace(/\[alpha\](?=\.)/, "");
    affected.add(/^(?:_[12](?:b|\+)?)?(?:_start)?(?:__atlas\d+)?(?:__page\d+)?\.(png|skel|atlas|json)$/.test(suffix) ? "base" : SHARED_SECTION);
  }
  const sectionIds = [...affected];
  return { sectionId: sectionIds.length === 1 ? sectionIds[0] : SHARED_SECTION, sectionIds, uncertain: affected.has(SHARED_SECTION) };
}

function inspectAppearance(modDir, sections) {
  const entries = files.walk(modDir);
  const { bindings } = files.readBindings(modDir);
  const names = [...entries.filter(file => files.RESOURCES.has(file.ext) && ![".txt", ".ini"].includes(file.ext)).map(file => {
    const binding = bindings.get(file.path.toLowerCase());
    // The relative path keeps folder-layout Mods (charavatars/…) identifiable
    // before any PC binding exists.
    return binding ? { resource: binding.target, bundle: binding.bundle, appearanceAliases: binding.appearanceAliases } : file.relative.split(path.sep).join("/");
  }), ...entries.filter(file => files.BUNDLES.has(file.ext)).map(file => file.name)];
  // Battle/base chibis also contain animated Spine skeletons. Only portrait
  // resources identify a dynamic illustration; a .skel extension does not.
  const dynamic = entries.some(file => {
    const binding = bindings.get(file.path.toLowerCase());
    const target = path.posix.basename(String(binding?.target || file.name).replace(/\\/g, "/"));
    return /^arts\/dynchars\//i.test(binding?.bundle || "") || /^(?:(?:sp_|entry_)?dyn_(?:illust|portrait|entrance)_)/i.test(target);
  });
  const contentTypes = [];
  if (dynamic) contentTypes.push("dynamic");
  else if (entries.some(file => file.ext === ".png")) contentTypes.push("static");
  if (entries.some(file => file.ext === ".wav")) contentTypes.push("voice");
  const assetKindList = names.flatMap(item => {
    const target = typeof item === "string" ? item : item.resource || "";
    const kind = parseAppearanceSource(target)?.family || parseCosmeticSource(target)?.family;
    if (/\.wav$/i.test(String(target))) return ["voice"];
    return kind ? [kind] : [];
  });
  // A prebuilt AssetBundle Mod is redirected by the loader; show it as an AB
  // item after the content type (静态 / 动态 / 语音).
  const ab = abMod.readConfig(modDir);
  if (ab) {
    if (!contentTypes.includes("static") && !contentTypes.includes("dynamic") && !contentTypes.includes("voice")) contentTypes.push("static");
    contentTypes.push("assetbundle");
    assetKindList.push("assetbundle");
  }
  const text = (() => {
    try { return textMod.readConfig(modDir); } catch { return null; }
  })();
  if (text) {
    contentTypes.push("text");
    assetKindList.push("text");
  }
  const assetKinds = [...new Set(assetKindList)];
  return { ...classifyResources(names, sections), contentTypes, assetKinds, ...(ab ? { assetBundle: { keyRoot: ab.keyRoot, bundleRoot: ab.bundleRoot } } : {}), ...(text ? { textConfig: { type: text.type, textRoot: text.textRoot, autoMapByStem: text.auto, priority: text.priority } } : {}) };
}

let appearanceWorker = null;
let nextRequestId = 0;
const pending = new Map();
function inspectAppearances(modDirs, sections) {
  if (!modDirs.length) return Promise.resolve([]);
  return requestWorker({ modDirs, sections });
}
function inspectResourceConflicts(entries) {
  if (entries.length < 2) return Promise.resolve([]);
  return requestWorker({ action: "conflicts", entries });
}
function requestWorker(payload) {
  if (!appearanceWorker) {
    const { Worker } = require("node:worker_threads");
    const worker = new Worker(path.join(__dirname, "appearance-worker.cjs"));
    appearanceWorker = worker;
    const fail = error => {
      if (appearanceWorker !== worker) return;
      appearanceWorker = null;
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    };
    worker.on("message", ({ id, result, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error));
      else request.resolve(result);
      if (!pending.size) worker.unref();
    });
    worker.on("error", fail);
    worker.on("exit", code => fail(new Error(`Appearance worker exited (${code})`)));
    worker.unref();
  }
  const worker = appearanceWorker;
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    pending.set(id, { resolve, reject });
    worker.ref();
    try { worker.postMessage({ id, ...payload }); }
    catch (error) {
      pending.delete(id);
      if (!pending.size) worker.unref();
      reject(error);
    }
  });
}

module.exports = { SHARED_SECTION, classifyResources, inspectAppearance, inspectAppearances, inspectResourceConflicts };
