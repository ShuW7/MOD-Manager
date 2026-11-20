// Reordering works on the rows the user sees. Local collections collapse
// several variant folders into one row, so a drop must move the whole variant
// block instead of a single folder.
function findDisplayIndex(displayMods, mod) {
  return displayMods.findIndex(
    (row) =>
      (mod?.path && row.path === mod.path) || row.name === mod.name,
  );
}

export function reorderDisplayBlocks({
  displayMods,
  sortedMods,
  draggedMod,
  targetMod,
}) {
  const draggedIndex = findDisplayIndex(displayMods, draggedMod);
  const targetIndex = findDisplayIndex(displayMods, targetMod);
  if (
    draggedIndex === -1 ||
    targetIndex === -1 ||
    draggedIndex === targetIndex
  )
    return null;
  const sortedIndexByName = new Map(
    sortedMods.map((mod, index) => [mod.name, index]),
  );
  const blocks = displayMods.map((row) => {
    const variants = row._localCollection?.variants;
    if (!Array.isArray(variants) || variants.length < 2) return [row];
    const memberNames = new Set(variants.map((variant) => variant.name));
    return sortedMods
      .filter((mod) => memberNames.has(mod.name))
      .sort(
        (a, b) =>
          (sortedIndexByName.get(a.name) ?? 0) -
          (sortedIndexByName.get(b.name) ?? 0),
      );
  });
  const [movedBlock] = blocks.splice(draggedIndex, 1);
  // Downward drops insert after the target, upward drops insert before it;
  // because the dragged block was removed first, targetIndex already accounts
  // for the shift.
  blocks.splice(targetIndex, 0, movedBlock);
  return blocks.flat();
}
