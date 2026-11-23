const test = require('node:test');
const assert = require('node:assert/strict');
const progress = import('../app/src/renderer/features/mods/hooks/useModToggleProgress.js');

test('toggle progress is scoped to the current library and character and survives a view closing', async () => {
  const { beginModToggle, deferModToggleRefresh } = await progress;
  const scope = JSON.stringify(['arknights', 'first library', 'A']);
  const operation = beginModToggle(scope, 'original Mod');
  assert(operation);
  assert.equal(beginModToggle(scope, 'second Mod'), null);
  const other = beginModToggle(JSON.stringify(['arknights', 'other library', 'A']), 'original Mod');
  assert(other);
  assert.equal(deferModToggleRefresh(scope, 'A', { reason: 'toggle', characterName: '__all__', changedCharacterName: 'B' }), false);
  assert.equal(deferModToggleRefresh(scope, 'A', { reason: 'import', characterName: 'A' }), false);
  assert.equal(deferModToggleRefresh(scope, 'A', { reason: 'toggle', characterName: '__all__', changedCharacterName: 'A' }), true);
  // Finishing without a mounted view must release the operation too.
  await operation.finish();
  assert.equal(deferModToggleRefresh(scope, 'A', { reason: 'mod-selection', characterName: 'A' }), false);
  const next = beginModToggle(scope, 'second Mod');
  assert(next);
  await Promise.all([next.finish(), other.finish()]);
});
