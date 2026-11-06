"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseIni } = require("./ab-mod.cjs");

const TYPES = ["story", "voice", "archive", "direct_match"];

function safeRoot(value) {
  const text = String(value || "").replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  if (!text || text === ".") return ".";
  if (path.posix.isAbsolute(text) || text.includes(":")) throw Error("invalid text_root");
  const parts = text.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) throw Error("invalid text_root");
  return parts.join("/");
}

function readConfig(modDir) {
  const file = path.join(modDir, "mod.ini");
  if (!fs.existsSync(file)) return null;
  const sections = parseIni(fs.readFileSync(file, "utf8"));
  const mod = sections.mod || {};
  if (String(mod.type || "").toLowerCase() !== "text") return null;
  let type = String(mod.text_type || "").toLowerCase();
  if (type === "direct") type = "direct_match";
  return {
    type: TYPES.includes(type) ? type : "",
    textRoot: safeRoot(mod.text_root || mod.scan_root || "text"),
    auto: !["0", "false", "no", "off"].includes(String(mod.auto_map_by_stem || "true").toLowerCase()),
    priority: Number.isFinite(Number(mod.priority)) ? Math.trunc(Number(mod.priority)) : 0,
    sections,
  };
}

function walkTextFiles(root) {
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) result.push(full);
    }
  };
  if (fs.existsSync(root)) visit(root);
  return result;
}

function bucketFromFile(file, modDir) {
  const relative = path.relative(modDir, file).replace(/\\/g, "/").toLowerCase();
  if (relative.includes("story")) return "story";
  if (relative.includes("voice")) return "voice";
  if (relative.includes("archive")) return "archive";
  try {
    const header = fs.readFileSync(file, "utf8").slice(0, 4096);
    const match = header.match(/^\s*#\s*bucket\s*=\s*(\w+)/im);
    if (match && TYPES.includes(match[1].toLowerCase())) return match[1].toLowerCase();
  } catch {}
  return "";
}

function inspectMod(modDir) {
  const existing = readConfig(modDir);
  const files = walkTextFiles(modDir);
  const buckets = { story: 0, voice: 0, archive: 0, direct_match: 0 };
  for (const file of files) {
    const bucket = bucketFromFile(file, modDir);
    if (bucket === "story" || bucket === "voice" || bucket === "archive") buckets[bucket]++;
  }
  let type = existing?.type || "";
  if (!type) {
    type = Object.entries(buckets).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || "story";
  }
  let textRoot = existing?.textRoot || "";
  if (!textRoot) {
    if (["story", "voice", "archive"].some((name) => fs.existsSync(path.join(modDir, "text", name)))) textRoot = "text";
    else if (buckets[type]) textRoot = ".";
    else textRoot = "text";
  }
  return {
    existing: existing ? { type: existing.type, textRoot: existing.textRoot, auto: existing.auto, priority: existing.priority } : null,
    type,
    textRoot,
    auto: existing?.auto ?? true,
    priority: existing?.priority ?? 0,
    files: files.length,
    buckets,
  };
}

function writeConfig(modDir, { textType, textRoot, autoMap = true, priority = 0 }) {
  const type = String(textType || "").toLowerCase() === "direct" ? "direct_match" : String(textType || "").toLowerCase();
  if (!TYPES.includes(type)) throw Error("invalid text_type");
  const root = safeRoot(textRoot);
  const detected = inspectMod(modDir);
  const existing = readConfig(modDir);
  if (!detected.files) throw Error("no text files");
  if (existing === null) {
    const file = path.join(modDir, "mod.ini");
    if (fs.existsSync(file)) {
      const sections = parseIni(fs.readFileSync(file, "utf8"));
      if (sections.mod && String(sections.mod.type || "").toLowerCase() !== "text") throw Error("type conflict");
    }
  }
  const lines = [
    "[mod]",
    "type = text",
    `text_type = ${type}`,
    `text_root = ${root}`,
    `auto_map_by_stem = ${autoMap ? "true" : "false"}`,
    `priority = ${Math.max(-1000000, Math.min(1000000, Math.trunc(Number(priority) || 0)))}`,
  ];
  if (!autoMap) {
    const previous = existing?.sections?.map || {};
    for (const [key, value] of Object.entries(previous)) lines.push(`${key} = ${value}`);
  }
  fs.writeFileSync(path.join(modDir, "mod.ini"), lines.join("\r\n") + "\r\n", "utf8");
  return inspectMod(modDir);
}

module.exports = { TYPES, inspectMod, writeConfig, readConfig };
