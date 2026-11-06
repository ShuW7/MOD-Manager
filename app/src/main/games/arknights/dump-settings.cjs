"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseIni } = require("./ab-mod.cjs");

const DEFAULTS = { hotkey: "Ctrl+T", enabled: false };
const MODIFIERS = new Set(["ctrl", "control", "alt", "shift", "win", "windows"]);
const NAMED = new Set([
  "space", "tab", "esc", "escape", "enter", "return", "backspace", "delete", "del",
  "home", "end", "pageup", "pgup", "pagedown", "pgdn", "up", "down", "left", "right",
]);
const PUNCTUATION = new Set(["-", "=", "[", "]", ";", "'", ",", ".", "/", "`"]);

function configPath(root) {
  return path.join(root, "TextDump", "dump.ini");
}

function normalizeHotkey(value) {
  const tokens = String(value || "")
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) throw Error("invalid hotkey");
  const modifiers = [];
  for (let index = 0; index < tokens.length - 1; index++) {
    const token = tokens[index].toLowerCase();
    if (!MODIFIERS.has(token)) throw Error("invalid hotkey");
    if (token === "control") modifiers.push("Ctrl");
    else if (token === "windows") modifiers.push("Win");
    else {
      const label = token.charAt(0).toUpperCase() + token.slice(1);
      if (!modifiers.includes(label)) modifiers.push(label);
    }
  }
  const raw = tokens.at(-1);
  const lower = raw.toLowerCase();
  let key;
  if (/^[a-z0-9]$/.test(lower)) key = lower.toUpperCase();
  else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) key = raw.toUpperCase();
  else if (NAMED.has(lower)) key = raw.toUpperCase();
  else if (PUNCTUATION.has(raw)) key = raw;
  else throw Error("invalid hotkey");
  return [...new Set(modifiers), key].join("+");
}

function read(root) {
  const file = configPath(root);
  let config = { ...DEFAULTS };
  if (fs.existsSync(file)) {
    try {
      const sections = parseIni(fs.readFileSync(file, "utf8"));
      const dump = sections.dump || {};
      if (dump.hotkey) {
        try { config.hotkey = normalizeHotkey(dump.hotkey); } catch {}
      }
      if (dump.enabled !== undefined) {
        config.enabled = ["1", "true", "yes", "on"].includes(String(dump.enabled).toLowerCase());
      }
    } catch {}
  }
  return { ...config, file };
}

function write(root, { hotkey, enabled } = {}) {
  const current = read(root);
  const next = {
    hotkey: hotkey === undefined ? current.hotkey : normalizeHotkey(hotkey),
    enabled: enabled === undefined ? current.enabled : Boolean(enabled),
  };
  fs.mkdirSync(path.dirname(configPath(root)), { recursive: true });
  const text = `[dump]\r\nhotkey = ${next.hotkey}\r\nenabled = ${next.enabled ? "true" : "false"}\r\n`;
  fs.writeFileSync(configPath(root), text, "utf8");
  return { ...next, file: configPath(root) };
}

module.exports = { DEFAULTS, configPath, normalizeHotkey, read, write };
