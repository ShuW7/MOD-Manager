const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveDataRoot, getDefaultModsPath, isUnusedDefaultModsPath, migrateLegacyArknights } = require('../app/src/main/runtime/data-paths.cjs');

test('installed default Mods directories follow the executable, including randomized manager names', () => {
  const install = path.resolve('test-results/portable-install');
  const data = resolveDataRoot({ isPackaged: true, execPath: path.join(install, 'r123456789.exe') });
  assert.equal(data, path.join(install, 'data'));
  assert.equal(getDefaultModsPath('arknights', data), path.join(data, 'Arknights/Mods'));
  assert.equal(getDefaultModsPath('future-game', data), path.join(data, 'future-game/Mods'));
});

test('only the default Mods folder without files counts as unused, so detection never hides existing Mods', t => {
  const base = path.resolve('test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'default-mods-'));
  t.after(() => { assert.equal(path.dirname(root), base); fs.rmSync(root, { recursive: true, force: true }); });
  const data = path.join(root, 'data'), mods = getDefaultModsPath('arknights', data);
  assert.equal(isUnusedDefaultModsPath(mods, 'arknights', data), false, 'a missing folder is left to the existence check');
  fs.mkdirSync(path.join(mods, '阿米娅'), { recursive: true });
  assert.equal(isUnusedDefaultModsPath(mods, 'arknights', data), true, 'empty character folders are created automatically');
  assert.equal(isUnusedDefaultModsPath(mods.toUpperCase(), 'arknights', data), true);
  const custom = path.join(root, 'custom/Mods');
  fs.mkdirSync(custom, { recursive: true });
  assert.equal(isUnusedDefaultModsPath(custom, 'arknights', data), false, 'a chosen folder is never replaced, even when empty');
  assert.equal(isUnusedDefaultModsPath('', 'arknights', data), false);
  fs.writeFileSync(path.join(mods, '阿米娅/mod.ini'), '[Assets]');
  assert.equal(isUnusedDefaultModsPath(mods, 'arknights', data), false);
});

test('legacy Arknights library and enabled resources migrate together, retaining originals and refusing conflicting data', t => {
  const base = path.resolve('test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'data-paths-'));
  t.after(() => { assert.equal(path.dirname(root), base); fs.rmSync(root, { recursive: true, force: true }); });
  const legacy = path.join(root, 'old/arknights'), data = path.join(root, 'install/data');
  for (const name of ['Mods/角色/模组/image.png', 'Resources/illust.png', 'PC-Bundles/manifest.tsv']) {
    fs.mkdirSync(path.dirname(path.join(legacy, name)), { recursive: true });
    fs.writeFileSync(path.join(legacy, name), name);
  }
  fs.mkdirSync(path.join(data, 'Arknights/Mods'), { recursive: true });
  const migrated = migrateLegacyArknights(legacy, data);
  assert.equal(migrated, path.join(data, 'Arknights'));
  assert.equal(fs.readFileSync(path.join(migrated, 'Mods/角色/模组/image.png'), 'utf8'), 'Mods/角色/模组/image.png');
  assert.ok(fs.existsSync(path.join(legacy, 'Resources/illust.png')));
  assert.equal(migrateLegacyArknights(legacy, data), migrated);
  fs.writeFileSync(path.join(migrated, 'Resources/illust.png'), 'new enabled content');
  assert.throws(() => migrateLegacyArknights(legacy, data), /conflicts/);
  assert.equal(fs.readFileSync(path.join(migrated, 'Resources/illust.png'), 'utf8'), 'new enabled content');
});
