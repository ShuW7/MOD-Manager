const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const textConfig = require('../app/src/main/games/arknights/text-config.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-text-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

test('inspects and writes a story text mod.ini', t => {
  const mod = path.join(fixture(t), 'Mod');
  write(path.join(mod, 'text', 'story', 'a.txt'), '[entry]\ncmd = dialog@1[content]\nsrc <<<\nA\n>>>\ntext <<<\nB\n>>>\n');
  const inspected = textConfig.inspectMod(mod);
  assert.equal(inspected.type, 'story');
  assert.equal(inspected.textRoot, 'text');
  assert.equal(inspected.files, 1);
  assert.equal(inspected.buckets.story, 1);
  const saved = textConfig.writeConfig(mod, { textType: 'story', textRoot: 'text', autoMap: true, priority: 7 });
  assert.equal(saved.existing.type, 'story');
  const ini = fs.readFileSync(path.join(mod, 'mod.ini'), 'utf8');
  assert.match(ini, /type = text/);
  assert.match(ini, /text_type = story/);
  assert.match(ini, /priority = 7/);
});

test('keeps an explicit map when auto mapping is disabled', t => {
  const mod = path.join(fixture(t), 'Mod');
  write(path.join(mod, 'custom.txt'), '[entry]\nsrc <<<\nA\n>>>\ntext <<<\nB\n>>>\n');
  write(path.join(mod, 'mod.ini'), '[mod]\ntype = text\ntext_type = story\ntext_root = .\nauto_map_by_stem = false\n\n[map]\ncustom = custom.txt\n');
  textConfig.writeConfig(mod, { textType: 'story', textRoot: '.', autoMap: false, priority: 0 });
  const ini = fs.readFileSync(path.join(mod, 'mod.ini'), 'utf8');
  assert.match(ini, /auto_map_by_stem = false/);
  assert.match(ini, /custom = custom\.txt/);
});

test('detects direct match files and rejects non-text mod.ini', t => {
  const mod = path.join(fixture(t), 'Mod');
  write(path.join(mod, 'text', 'a.txt'), '[entry]\nmatch_mode = strict\nsrc <<<\nA\n>>>\ntext <<<\nB\n>>>\n');
  write(path.join(mod, 'mod.ini'), '[mod]\ntype = assetbundle\nkey_root = x\n');
  assert.throws(() => textConfig.writeConfig(mod, { textType: 'direct_match', textRoot: 'text' }), /type conflict/);
});

test('rejects mods without text files', t => {
  const mod = path.join(fixture(t), 'Mod');
  fs.mkdirSync(mod, { recursive: true });
  fs.writeFileSync(path.join(mod, 'preview.png'), 'x');
  assert.throws(() => textConfig.writeConfig(mod, { textType: 'story', textRoot: 'text' }), /no text files/);
});
