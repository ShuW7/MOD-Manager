const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageUrl, mergeCharacters, createCharacterCatalogService, fetchCharacters } = require('../app/src/main/characters/catalog-source.cjs');
const image = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/synthetic.png';
const records = ['新角色', '阿米娅', '凯尔希', '陈', '能天使'].map((name, id) => ({ name, en: `char_${1000 + id}_test`, image }));
const table = (items = records) => Object.fromEntries(items.map(record => [record.en, { name: record.name, appellation: record.name, isNotObtainable: false }]));
const response = (items = records) => new Response(JSON.stringify(table(items)), { headers: { 'content-type': 'application/json' } });

test('merging catalogs keeps custom categories, canonical aliases and local metadata', () => {
  const base = { defaultCharacters: ['人工分类', '阿米娅', 'NPC'], manualMappings: { 'char_1000_test': { displayName: '人工分类' } }, characterNameMap: { pairs: [] } };
  const original = JSON.stringify(base);
  const merged = mergeCharacters(base, records);
  assert.equal(JSON.stringify(base), original);
  assert.equal(merged.defaultCharacters[0], '人工分类');
  assert.equal(merged.defaultCharacters.at(-1), 'NPC');
  assert.equal(merged.defaultCharacters.includes('新角色'), false);
  assert.equal(merged.manualMappings['新角色'].displayName, '人工分类');
  assert.equal(merged.characterImages['人工分类'], records[0].image);
  assert.ok(merged.defaultCharacters.includes('能天使'));
});
test('remote metadata rejects filesystem names and non-HTTPS image payloads', () => {
  const merged = mergeCharacters({ defaultCharacters: [] }, [...records, { name: '../escape', image: 'file:///secret' }]);
  assert.equal(merged.defaultCharacters.includes('../escape'), false);
  for (const url of ['file:///secret', 'data:image/svg+xml,secret', 'http://localhost/a.png', 'https://evil.test/a.png', 'https://user:pass@raw.githubusercontent.com/a.png']) assert.equal(imageUrl(url), null);
  assert.throws(() => mergeCharacters({}, [{ name: 'only one' }]));
});
test('updates are cached atomically, deduplicated, and preserved when offline', async t => {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'qaqm-catalog-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(directory)), parent); fs.rmSync(directory, { recursive: true, force: true }); });
  let calls = 0, updates = 0, offline = false;
  const service = createCharacterCatalogService({ cacheDir: directory, fetchFn: async () => { calls++; if (offline) throw Error('offline'); return response(); }, onUpdate: () => updates++ });
  const [a, b] = await Promise.all([service.refresh('arknights', true), service.refresh('arknights', true)]);
  assert.deepEqual(a, b); assert.equal(a.success, true); assert.equal(calls, 1); assert.equal(updates, 1);
  const saved = fs.readFileSync(path.join(directory, 'arknights.json'), 'utf8');
  await service.refresh('arknights'); assert.equal(calls, 1);
  offline = true;
  assert.equal((await service.refresh('arknights', true)).success, false);
  assert.equal(fs.readFileSync(path.join(directory, 'arknights.json'), 'utf8'), saved);
  const reloaded = createCharacterCatalogService({ cacheDir: directory });
  assert.ok(reloaded.merge('arknights', { defaultCharacters: ['我的分类'] }).defaultCharacters.includes('新角色'));
  assert.equal((await service.refresh('../escape', true)).success, false);
});
test('oversized and invalid responses are not accepted as new catalogs', async () => {
  const oversized = { ok: true, headers: { get: () => '999999999' }, body: new Response('{}').body };
  await assert.rejects(fetchCharacters('arknights', async () => oversized), /too large/);
  await assert.rejects(fetchCharacters('arknights', async () => new Response('{broken')));
});
test('EXDEV catalog saves survive restart and a failed copy keeps the previous catalog', async t => {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'qaqm-catalog-exdev-'));
  t.after(() => { t.mock.restoreAll(); assert.equal(path.dirname(fs.realpathSync(directory)), parent); fs.rmSync(directory, { recursive: true, force: true }); });
  const file = path.join(directory, 'arknights.json');
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === file) throw Object.assign(Error('rename rejected'), { code: 'EXDEV' });
    return rename(from, to);
  });
  let nextRecords = records;
  const service = createCharacterCatalogService({ cacheDir: directory, fetchFn: async () => response(nextRecords) });
  assert.equal((await service.refresh('arknights', true)).success, true);
  const saved = fs.readFileSync(file, 'utf8');
  assert.ok(createCharacterCatalogService({ cacheDir: directory }).merge('arknights', {}).defaultCharacters.includes('新角色'));
  nextRecords = records.map((record, index) => index ? record : { ...record, name: '另一位新角色' });
  t.mock.method(fs, 'copyFileSync', (_, to) => { fs.writeFileSync(to, '{partial'); throw Object.assign(Error('disk full'), { code: 'ENOSPC' }); });
  assert.equal((await service.refresh('arknights', true)).success, false);
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
  for (const catalog of [service, createCharacterCatalogService({ cacheDir: directory })]) {
    const merged = catalog.merge('arknights', {});
    assert.ok(merged.defaultCharacters.includes('新角色'));
    assert.equal(merged.defaultCharacters.includes('另一位新角色'), false);
  }
});
