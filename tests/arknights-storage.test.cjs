"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const storage = require("../app/src/main/games/arknights/storage.cjs");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test("storage cleanup removes redundant deployment and staging copies only", t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "qaqr-storage-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const appRoot = path.join(fixture, "app");
  const root = path.join(fixture, "data", "Arknights");
  const library = path.join(root, "Mods");
  const destination = path.join(root, "Resources");
  const bundleRoot = path.join(root, "PC-Bundles");
  write(path.join(library, "operator", "mod", "a.png"), "library payload");
  write(path.join(destination, ".qaqr-m4a.json"), JSON.stringify({ owner: "qaqr-arknights-v1" }));
  write(path.join(destination, "mod", "a.png"), "deployed payload");
  write(path.join(root, "DISABLE_QAQR_previous", ".qaqr-m4a.json"), JSON.stringify({ owner: "qaqr-arknights-v1" }));
  write(path.join(root, "DISABLE_QAQR_previous", "mod", "a.png"), "old deployed payload");
  write(path.join(bundleRoot, ".qaqr-generated"), "arknights-bundles-v1");
  write(path.join(bundleRoot, "manifest.tsv"), "manifest");
  write(path.join(root, "PC-Bundles.previous", ".qaqr-generated"), "arknights-bundles-v1");
  write(path.join(root, "PC-Bundles.previous", "old.ab"), "old bundle");
  write(path.join(root, "DISABLE_QAQR_stage_stale", "partial", "x.png"), "stale stage");
  write(path.join(root, "bundle-build-stale", "partial.ab"), "stale build");
  write(path.join(appRoot, ".qaqr-backup-old", "resources-app", "x"), "old app backup");

  const p = { root, library, destination, bundleRoot };
  const before = storage.inspect(p, appRoot);
  assert(before.previousDeployment.bytes > 0);
  assert(before.previousBundles.bytes > 0);
  assert(before.stale > 0);
  assert(before.backups > 0);

  const result = storage.cleanup(p, appRoot);
  assert(result.freed > 0);
  assert(fs.existsSync(path.join(library, "operator", "mod", "a.png")));
  assert(fs.existsSync(path.join(destination, ".qaqr-m4a.json")));
  assert(fs.existsSync(path.join(destination, "mod", "a.png")));
  assert(!fs.existsSync(path.join(root, "DISABLE_QAQR_previous")));
  assert(!fs.existsSync(path.join(root, "PC-Bundles.previous")));
  assert(!fs.existsSync(path.join(root, "DISABLE_QAQR_stage_stale")));
  assert(!fs.existsSync(path.join(root, "bundle-build-stale")));
  assert(!fs.existsSync(path.join(appRoot, ".qaqr-backup-old")));
});
