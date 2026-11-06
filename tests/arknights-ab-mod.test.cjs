const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const abMod = require('../app/src/main/games/arknights/ab-mod.cjs');
const files = require('../app/src/main/games/arknights/files.cjs');
const appearance = require('../app/src/main/games/arknights/appearance.cjs');
const deployment = require('../app/src/main/games/arknights/deployment.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-ab-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const games = path.join(root, 'games');
  const game = path.join(games, 'Arknights');
  const bundledir = path.join(game, 'Arknights_Data', 'StreamingAssets', 'AB', 'Windows', 'prefabs', 'shop', 'shopkeeper');
  fs.mkdirSync(bundledir, { recursive: true });
  fs.writeFileSync(path.join(bundledir, 'live_007_closre.ab'), Buffer.concat([Buffer.from('UnityFS'), Buffer.alloc(64)]));
  const mod = path.join(root, 'mod');
  fs.mkdirSync(path.join(mod, 'shopkeeper'), { recursive: true });
  fs.writeFileSync(path.join(mod, 'shopkeeper', 'live_007_closre.ab'), Buffer.concat([Buffer.from('UnityFS'), Buffer.alloc(32)]));
  fs.writeFileSync(path.join(mod, 'mod.ini'), [
    '[mod]',
    'type = assetbundle',
    'key_root = Arknights\\Arknights_Data\\StreamingAssets\\AB\\Windows\\prefabs\\shop\\shopkeeper',
    '',
    'bundle_root = shopkeeper',
    'auto_map_by_stem = true',
    '',
  ].join('\r\n'));
  return { root, games, game, mod, exe: path.join(game, 'Arknights.exe') };
}

test('assetbundle mod.ini is parsed and mapped by relative bundle path', t => {
  const f = fixture(t);
  const config = abMod.readConfig(f.mod);
  assert.equal(config.keyRoot, 'Arknights\\Arknights_Data\\StreamingAssets\\AB\\Windows\\prefabs\\shop\\shopkeeper');
  assert.equal(config.bundleRoot, 'shopkeeper');
  assert.equal(config.auto, true);
  const targets = abMod.bundleTargets(f.exe, f.mod, config);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].target, 'Arknights_Data/StreamingAssets/AB/Windows/prefabs/shop/shopkeeper/live_007_closre.ab');
  assert.ok(targets[0].source && fs.existsSync(targets[0].source));
});

test('selecting a game bundle derives key_root and bundle_root', t => {
  const f = fixture(t);
  const selected = path.join(f.game, 'Arknights_Data', 'StreamingAssets', 'AB', 'Windows', 'prefabs', 'shop', 'shopkeeper', 'live_007_closre.ab');
  const derived = abMod.deriveConfig(f.exe, selected, f.mod);
  assert.equal(derived.keyRoot, 'Arknights\\Arknights_Data\\StreamingAssets\\AB\\Windows\\prefabs\\shop\\shopkeeper');
  assert.equal(derived.bundleRoot, 'shopkeeper');
  abMod.writeConfig(f.mod, derived);
  const config = abMod.readConfig(f.mod);
  assert.equal(config.keyRoot, derived.keyRoot);
  assert.equal(config.bundleRoot, 'shopkeeper');
  assert.equal(config.auto, true);
});

test('assertLoadable accepts a valid AssetBundle Mod and reports the AB type', t => {
  const f = fixture(t);
  const report = files.assertLoadable(f.mod);
  assert.equal(report.ab.keyRoot.startsWith('Arknights\\'), true);
  assert.equal(report.abBundles.length, 1);
  const scope = appearance.inspectAppearance(f.mod, []);
  assert.deepEqual(scope.contentTypes, ['static', 'assetbundle']);
  assert.deepEqual(scope.assetKinds, ['assetbundle']);
});

test('assertLoadable rejects damaged AssetBundle files and empty AB Mods', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.mod, 'shopkeeper', 'live_007_closre.ab'), 'not a bundle');
  assert.throws(() => files.assertLoadable(f.mod), /Unity AssetBundle/);
  fs.rmSync(path.join(f.mod, 'shopkeeper', 'live_007_closre.ab'));
  assert.throws(() => files.assertLoadable(f.mod), /AB 配置|AB configuration/);
});

test('enabling an AB Mod deploys its bundles next to mod.ini', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-ab-deploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const library = path.join(root, 'library');
  const destination = path.join(root, 'destination');
  const mod = path.join(library, 'char_003_kalts', 'Shopkeeper');
  fs.mkdirSync(path.join(mod, 'shopkeeper'), { recursive: true });
  fs.writeFileSync(path.join(mod, 'mod.ini'), '[mod]\ntype = assetbundle\nkey_root = Arknights\\Arknights_Data\\StreamingAssets\\AB\\Windows\\shop\nbundle_root = shopkeeper\n');
  fs.writeFileSync(path.join(mod, 'shopkeeper', 'live.ab'), Buffer.concat([Buffer.from('UnityFS'), Buffer.alloc(32)]));
  const gamePath = path.join(root, 'game', 'Arknights.exe');
  fs.mkdirSync(path.dirname(gamePath), { recursive: true });
  const summary = deployment.deploy({ entries: [{ path: mod, name: 'char_003_kalts/Shopkeeper', characterIds: [] }], library, destination, gamePath });
  assert.equal(summary.modCount, 1);
  const directory = fs.readdirSync(destination, { withFileTypes: true }).find(entry => entry.isDirectory()).name;
  assert.ok(fs.existsSync(path.join(destination, directory, 'shopkeeper', 'live.ab')));
  assert.ok(fs.existsSync(path.join(destination, directory, 'mod.ini')));
});
