"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert/strict");

let shouldResetCharacterOnTabChange;
let UI_CHARACTER_NAME;
let isOperatorCharacter;

before(async () => {
  ({ shouldResetCharacterOnTabChange, UI_CHARACTER_NAME, isOperatorCharacter } = await import(
    "../app/src/renderer/lib/navigation.js"
  ));
});

test("UI tab opens the shared UI pseudo-character directly", () => {
  assert.equal(UI_CHARACTER_NAME, "UI");
});

test("operator lists exclude shared UI even when it has enabled Mods or matches search", () => {
  const characters = [{ name: "UI", modCount: 15, enabledCount: 15 }, { name: "Mon3tr", modCount: 3 }, { name: "阿", modCount: 0 }];
  const operators = characters.filter(isOperatorCharacter);
  assert.deepEqual(operators.map(item => item.name), ["Mon3tr", "阿"]);
  assert.deepEqual(operators.filter(item => item.name.includes("UI")), []);
  assert.equal(isOperatorCharacter(null), false);
});

test("switching from characters to ui clears a character selected under characters", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("ui", "characters", "characters"),
    true,
  );
});

test("switching from ui to characters clears a character selected under ui", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("characters", "ui", "ui"),
    true,
  );
});

test("re-selecting the current shared tab returns to its root", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("characters", "characters", "characters"),
    true,
  );
  assert.equal(
    shouldResetCharacterOnTabChange("ui", "ui", "ui"),
    true,
  );
});

test("returning from settings preserves a character that belongs to the target tab", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("characters", "settings", "characters"),
    false,
  );
  assert.equal(
    shouldResetCharacterOnTabChange("ui", "settings", "ui"),
    false,
  );
});

test("entering a shared tab with a character from the other tab clears it", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("ui", "settings", "characters"),
    true,
  );
  assert.equal(
    shouldResetCharacterOnTabChange("characters", "settings", "ui"),
    true,
  );
});

test("other tabs are unaffected", () => {
  assert.equal(
    shouldResetCharacterOnTabChange("modmarket", "characters", "characters"),
    false,
  );
  assert.equal(
    shouldResetCharacterOnTabChange("settings", "characters", "characters"),
    false,
  );
});
