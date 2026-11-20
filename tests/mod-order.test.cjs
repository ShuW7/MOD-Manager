"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert/strict");

let reorderDisplayBlocks;

before(async () => {
  ({ reorderDisplayBlocks } = await import(
    "../app/src/renderer/features/mods/model/modOrder.js"
  ));
});

function mod(name) {
  return { name, path: `C:/mods/${name}` };
}

test("dragging down inserts after the target row", () => {
  const sortedMods = [mod("A"), mod("B"), mod("C")];
  const result = reorderDisplayBlocks({
    displayMods: sortedMods,
    sortedMods,
    draggedMod: sortedMods[0],
    targetMod: sortedMods[1],
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ["B", "A", "C"],
  );
});

test("dragging up inserts before the target row", () => {
  const sortedMods = [mod("A"), mod("B"), mod("C")];
  const result = reorderDisplayBlocks({
    displayMods: sortedMods,
    sortedMods,
    draggedMod: sortedMods[2],
    targetMod: sortedMods[0],
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ["C", "A", "B"],
  );
});

test("a collection row moves its whole variant block", () => {
  const c1 = mod("C1");
  const c2 = mod("C2");
  const d1 = mod("D1");
  const d2 = mod("D2");
  const sortedMods = [c1, c2, d1, d2];
  const displayMods = [
    { ...c1, _localCollection: { variants: [c2, c1] } },
    { ...d1, _localCollection: { variants: [d1, d2] } },
  ];
  const down = reorderDisplayBlocks({
    displayMods,
    sortedMods,
    draggedMod: displayMods[0],
    targetMod: displayMods[1],
  });
  assert.deepEqual(
    down.map((item) => item.name),
    ["D1", "D2", "C1", "C2"],
  );
  const up = reorderDisplayBlocks({
    displayMods,
    sortedMods,
    draggedMod: displayMods[1],
    targetMod: displayMods[0],
  });
  assert.deepEqual(
    up.map((item) => item.name),
    ["D1", "D2", "C1", "C2"],
  );
});

test("dropping a row onto itself is a no-op", () => {
  const sortedMods = [mod("A"), mod("B")];
  assert.equal(
    reorderDisplayBlocks({
      displayMods: sortedMods,
      sortedMods,
      draggedMod: sortedMods[0],
      targetMod: sortedMods[0],
    }),
    null,
  );
});
