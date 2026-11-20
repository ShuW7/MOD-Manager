"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert/strict");

let shortcuts;

before(async () => {
  shortcuts = await import(
    "../app/src/renderer/lib/globalShortcuts.js"
  );
});

function event(overrides = {}) {
  return {
    defaultPrevented: false,
    repeat: false,
    isComposing: false,
    keyCode: 70,
    target: { tagName: "BODY" },
    ...overrides,
  };
}

test("normal shortcut is accepted", () => {
  assert.equal(shortcuts.shouldHandleGlobalShortcut(event()), true);
});

test("typing targets are ignored", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
    assert.equal(
      shortcuts.shouldHandleGlobalShortcut(event({ target: { tagName } })),
      false,
    );
  }
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(
      event({ target: { tagName: "DIV", isContentEditable: true } }),
    ),
    false,
  );
});

test("open modal blocks the shortcut even when focus is on the body", () => {
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(event(), { modalOpen: true }),
    false,
  );
});

test("repeat, composition and prevented events are ignored", () => {
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(event({ repeat: true })),
    false,
  );
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(event({ isComposing: true })),
    false,
  );
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(event({ keyCode: 229 })),
    false,
  );
  assert.equal(
    shortcuts.shouldHandleGlobalShortcut(event({ defaultPrevented: true })),
    false,
  );
});

test("hasOpenModal accepts an injected root", () => {
  assert.equal(shortcuts.hasOpenModal(null), false);
  assert.equal(
    shortcuts.hasOpenModal({
      querySelector: (selector) => (selector ? {} : null),
    }),
    true,
  );
});
