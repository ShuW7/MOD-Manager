"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const dump = require("../app/src/main/games/arknights/dump-settings.cjs");

test("dump settings defaults and round-trip", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qaqr-dump-"));
  try {
    const initial = dump.read(root);
    assert.equal(initial.hotkey, "Ctrl+T");
    assert.equal(initial.enabled, false);
    assert.equal(initial.file, path.join(root, "TextDump", "dump.ini"));

    const saved = dump.write(root, { hotkey: "ctrl+shift+d", enabled: true });
    assert.equal(saved.hotkey, "Ctrl+Shift+D");
    assert.equal(saved.enabled, true);
    assert.equal(dump.read(root).hotkey, "Ctrl+Shift+D");
    assert.equal(dump.read(root).enabled, true);

    assert.equal(dump.normalizeHotkey("f9"), "F9");
    assert.throws(() => dump.normalizeHotkey("Ctrl+"), /invalid hotkey/);
    assert.throws(() => dump.normalizeHotkey("Hyper+T"), /invalid hotkey/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
