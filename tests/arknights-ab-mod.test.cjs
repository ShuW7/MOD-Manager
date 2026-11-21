const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const abMod = require('../app/src/main/games/arknights/ab-mod.cjs');
const abPath = require('../app/src/main/games/arknights/ab-path.cjs');
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
  return { root, games, game, mod, bundledir, exe: path.join(game, 'Arknights.exe') };
}

function writeBundle(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from('UnityFS'), Buffer.alloc(32)]));
  return file;
}

function selections(...paths) {
  const calls = [];
  return {
    calls,
    async showOpenDialog(options) {
      assert.ok(calls.length < paths.length, 'Unexpected file picker');
      const selected = paths[calls.length];
      calls.push(options);
      return { canceled: selected === null, filePaths: selected === null ? [] : [selected] };
    },
  };
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

test('selecting a folder auto-maps all same-name bundles without a file picker', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'second.ab'));
  writeBundle(path.join(f.bundledir, 'second.ab'));
  const dialog = selections(f.bundledir);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(dialog.calls.length, 1);
  assert.deepEqual(dialog.calls[0].properties, ['openDirectory']);
  assert.equal(config.auto, true);
  assert.equal(config.bundleRoot, 'shopkeeper');
  abMod.writeConfig(f.mod, config);
  assert.doesNotMatch(fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8'), /\[map\]/);
  const targets = abMod.bundleTargets(f.exe, f.mod, abMod.readConfig(f.mod));
  assert.equal(targets.length, 2);
  assert.ok(targets.every(file => file.source));
});

test('only unmatched bundles prompt for a file and all mappings survive saving', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom.ab'));
  const original = writeBundle(path.join(f.bundledir, 'original.ab'));
  const dialog = selections(f.bundledir, original);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(dialog.calls.length, 2);
  assert.deepEqual(dialog.calls[1].properties, ['openFile']);
  assert.match(dialog.calls[1].title, /shopkeeper\/custom\.ab/);
  assert.equal(config.auto, false);
  abMod.writeConfig(f.mod, config);
  const saved = abMod.readConfig(f.mod);
  assert.equal(saved.auto, false);
  assert.deepEqual(saved.map, { 'original.ab': 'shopkeeper/custom.ab', 'live_007_closre.ab': 'shopkeeper/live_007_closre.ab' });
  const targets = abMod.bundleTargets(f.exe, f.mod, saved);
  assert.equal(targets.length, 2);
  assert.equal(targets.find(file => file.key === 'original.ab').path, path.join(f.mod, 'shopkeeper', 'custom.ab'));
  assert.ok(targets.every(file => file.source));
  assert.equal(files.assertLoadable(f.mod).abBundles.length, 2);
});

test('each missing bundle gets its own fallback file picker', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom_a.ab'));
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom_b.ab'));
  const a = writeBundle(path.join(f.bundledir, 'original_a.ab'));
  const b = writeBundle(path.join(f.bundledir, 'original_b.ab'));
  const dialog = selections(f.bundledir, a, b);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(dialog.calls.length, 3);
  assert.match(dialog.calls[1].title, /custom_a\.ab/);
  assert.match(dialog.calls[2].title, /custom_b\.ab/);
  assert.equal(Object.keys(config.map).length, 3);
});

test('a unique same-name match in a subfolder is mapped without a file picker', async t => {
  const f = fixture(t);
  const dialog = selections(path.dirname(f.bundledir));
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(dialog.calls.length, 1);
  assert.equal(config.auto, false);
  assert.deepEqual(config.map, { 'shopkeeper/live_007_closre.ab': 'shopkeeper/live_007_closre.ab' });
  abMod.writeConfig(f.mod, config);
  assert.equal(abMod.bundleTargets(f.exe, f.mod, abMod.readConfig(f.mod))[0].source, path.join(f.bundledir, 'live_007_closre.ab'));
});

test('common bundle root preserves nested structure and exact paths disambiguate names', async t => {
  const f = fixture(t);
  // A wrapper contains sibling bundle folders with the same file names.
  fs.renameSync(path.join(f.mod, 'shopkeeper'), path.join(f.mod, 'wrapper'));
  fs.mkdirSync(path.join(f.mod, 'wrapper', 'a'));
  fs.renameSync(path.join(f.mod, 'wrapper', 'live_007_closre.ab'), path.join(f.mod, 'wrapper', 'a', 'same.ab'));
  writeBundle(path.join(f.mod, 'wrapper', 'b', 'same.ab'));
  writeBundle(path.join(f.bundledir, 'a', 'same.ab'));
  writeBundle(path.join(f.bundledir, 'b', 'same.ab'));
  const dialog = selections(f.bundledir);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(config.bundleRoot, 'wrapper');
  assert.equal(config.auto, true);
  assert.equal(dialog.calls.length, 1);
  assert.equal(abMod.bundleTargets(f.exe, f.mod, config).length, 2);
});

test('automatic name matching ignores case including the AB extension', async t => {
  const f = fixture(t);
  fs.renameSync(path.join(f.mod, 'shopkeeper', 'live_007_closre.ab'), path.join(f.mod, 'shopkeeper', 'LIVE_007_CLOSRE.AB'));
  const dialog = selections(f.bundledir);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(config.auto, true);
  assert.equal(dialog.calls.length, 1);
});

test('ambiguous same-name matches prompt instead of selecting an arbitrary target', async t => {
  const f = fixture(t);
  const other = writeBundle(path.join(path.dirname(f.bundledir), 'other', 'live_007_closre.ab'));
  const dialog = selections(path.dirname(f.bundledir), other);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(dialog.calls.length, 2);
  assert.match(dialog.calls[1].title, /live_007_closre\.ab/);
  assert.deepEqual(config.map, { 'other/live_007_closre.ab': 'shopkeeper/live_007_closre.ab' });
});

test('manual targets outside the selected folder widen key_root and retain automatic matches', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom.ab'));
  const other = writeBundle(path.join(path.dirname(f.bundledir), 'other', 'original.ab'));
  const dialog = selections(f.bundledir, other);
  const config = await abPath.selectConfig(f.exe, f.mod, dialog);
  assert.equal(config.keyRoot.endsWith('prefabs\\shop'), true);
  assert.deepEqual(config.map, {
    'other/original.ab': 'shopkeeper/custom.ab',
    'shopkeeper/live_007_closre.ab': 'shopkeeper/live_007_closre.ab',
  });
});

test('canceling the folder or a fallback leaves the existing mod.ini unchanged', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom_a.ab'));
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom_b.ab'));
  const a = writeBundle(path.join(f.bundledir, 'original_a.ab'));
  const before = fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8');
  for (const dialog of [selections(null), selections(f.bundledir, null), selections(f.bundledir, a, null)]) {
    assert.equal(await abPath.selectConfig(f.exe, f.mod, dialog), null);
    assert.equal(fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8'), before);
  }
});

test('duplicate destinations are rejected without changing mod.ini', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom.ab'));
  const before = fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8');
  const dialog = selections(f.bundledir, path.join(f.bundledir, 'live_007_closre.ab'));
  await assert.rejects(abPath.selectConfig(f.exe, f.mod, dialog), /同一个|same game AB/);
  assert.equal(fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8'), before);
});

test('invalid directories and fallback files are rejected without changing mod.ini', async t => {
  const f = fixture(t);
  writeBundle(path.join(f.mod, 'shopkeeper', 'custom.ab'));
  const outside = writeBundle(path.join(f.root, 'outside.ab'));
  const wrongDirectory = writeBundle(path.join(f.game, 'other', 'outside.ab'));
  const wrongExtension = path.join(f.bundledir, 'readme.txt');
  fs.writeFileSync(wrongExtension, 'readme');
  const before = fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8');
  for (const directory of [f.root, f.game, path.dirname(wrongDirectory), path.join(f.bundledir, 'live_007_closre.ab')]) {
    await assert.rejects(abPath.selectConfig(f.exe, f.mod, selections(directory)), /AB 文件夹|AB folder/);
  }
  for (const file of [outside, wrongDirectory, wrongExtension, f.bundledir, path.join(f.bundledir, 'missing.ab')]) {
    await assert.rejects(abPath.selectConfig(f.exe, f.mod, selections(f.bundledir, file)), /\.ab/);
  }
  assert.equal(fs.readFileSync(path.join(f.mod, 'mod.ini'), 'utf8'), before);
});

test('a Mod without AB files fails before opening a picker', async t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.mod, 'shopkeeper', 'live_007_closre.ab'));
  await assert.rejects(abPath.selectConfig(f.exe, f.mod, selections()), /不包含|no \.ab files/);
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
