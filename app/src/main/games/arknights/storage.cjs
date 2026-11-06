"use strict";

const fs = require("node:fs");
const path = require("node:path");
const randomExecutable = require("../../runtime/random-executable.cjs");

const STAGE_PREFIX = "DISABLE_QAQR_stage_";
const BUILD_PREFIX = "bundle-build-";
const BACKUP_PREFIX = ".qaqr-backup-";

function directorySize(directory) {
  if (!fs.existsSync(directory)) return 0;
  let total = 0;
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  }
  return total;
}

function physicalSize(directories) {
  const seen = new Set();
  let total = 0;
  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;
    const stack = [directory];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) { stack.push(full); continue; }
        if (!entry.isFile()) continue;
        try {
          const stat = fs.statSync(full);
          const key = stat.ino ? `${stat.dev}:${stat.ino}` : full.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          total += stat.size;
        } catch {}
      }
    }
  }
  return total;
}

function sizeOf(directory) {
  try { return { path: directory, bytes: directorySize(directory) }; } catch { return { path: directory, bytes: 0 }; }
}

function ownedDeployment(directory) {
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(directory, ".qaqr-m4a.json"), "utf8"));
    return marker.owner === "qaqr-arknights-v1";
  } catch { return false; }
}

function ownedBundles(directory) {
  return fs.existsSync(path.join(directory, ".qaqr-generated"));
}

function staleDirectories(root, prefix) {
  const result = [];
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return result; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    result.push(path.join(root, entry.name));
  }
  return result;
}

function inspect(p, appRoot = path.dirname(process.execPath)) {
  const previousDeployment = path.join(path.dirname(p.destination), "DISABLE_QAQR_previous");
  const previousBundles = path.join(p.root, "PC-Bundles.previous");
  const stale = [...staleDirectories(path.dirname(p.destination), STAGE_PREFIX), ...staleDirectories(p.root, BUILD_PREFIX)];
  const backups = staleDirectories(appRoot, BACKUP_PREFIX);
  const randomFiles = [];
  try {
    for (const name of fs.readdirSync(appRoot)) {
      if (!/^[a-z][a-f0-9]{8,24}\.exe$/i.test(name)) continue;
      if (name.toLowerCase() === path.basename(process.execPath).toLowerCase()) continue;
      randomFiles.push(path.join(appRoot, name));
    }
  } catch {}
  return {
    library: sizeOf(p.library),
    resources: sizeOf(p.destination),
    physicalBytes: physicalSize([p.library, p.destination]),
    previousDeployment: sizeOf(previousDeployment),
    previousBundles: sizeOf(previousBundles),
    stale: stale.map(sizeOf).reduce((sum, item) => sum + item.bytes, 0),
    backups: backups.map(sizeOf).reduce((sum, item) => sum + item.bytes, 0),
    randomCopies: randomFiles.map(sizeOf).reduce((sum, item) => sum + item.bytes, 0),
    previousDeploymentPath: previousDeployment,
    previousBundlesPath: previousBundles,
    stalePaths: stale,
    backupPaths: backups,
    randomPaths: randomFiles,
  };
}

function removePath(target, root) {
  const resolved = path.resolve(target);
  const base = path.resolve(root);
  if (resolved === base || !resolved.toLowerCase().startsWith(base.toLowerCase() + path.sep)) return 0;
  if (!fs.existsSync(resolved)) return 0;
  const before = directorySize(resolved);
  try { fs.rmSync(resolved, { recursive: true, force: true }); return before; } catch { return 0; }
}

function cleanup(p, appRoot = path.dirname(process.execPath)) {
  const before = inspect(p, appRoot);
  let freed = 0;
  const destinationExists = fs.existsSync(p.destination);
  // Only remove the old deployment snapshot when the current deployment is
  // present and owned; this is a rollback copy, not a second active tree.
  if (destinationExists && ownedDeployment(p.destination) && fs.existsSync(before.previousDeploymentPath)) {
    freed += removePath(before.previousDeploymentPath, p.root);
  }
  // A previous bundle tree is only safe to remove when the active tree exists.
  if (fs.existsSync(p.bundleRoot) && ownedBundles(p.bundleRoot) && fs.existsSync(before.previousBundlesPath)) {
    freed += removePath(before.previousBundlesPath, p.root);
  }
  for (const directory of before.stalePaths) freed += removePath(directory, p.root);
  // Old version backups are explicit cleanup targets; the current application
  // files are never touched.
  for (const directory of before.backupPaths) freed += removePath(directory, appRoot);
  // Remove superseded random-name manager images. The running image and its
  // marker are excluded by cleanupExecutables.
  const source = path.join(appRoot, "QAQ-Revival.exe");
  try { randomExecutable.cleanupExecutables(source); } catch {}
  const after = inspect(p, appRoot);
  freed += Math.max(0, before.randomCopies - after.randomCopies);
  return { success: true, freed, storage: after };
}

module.exports = { inspect, cleanup, directorySize };
