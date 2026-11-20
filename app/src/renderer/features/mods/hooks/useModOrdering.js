import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { getModAppearanceSectionId } from "../model/modHelpers.js";
import { buildLocalCollectionView } from "../model/localCollections.js";
import { reorderDisplayBlocks } from "../model/modOrder.js";
export function useModOrdering({
  characterName,
  mods,
  activeAppearanceSectionId,
  setMods,
  setToast,
  localCollectionsEnabled = false,
  selectedLocalCollectionVariants = {},
  characterAliases = [],
}) {
  const [modSearchQuery, setModSearchQuery] = React.useState("");
  const [selectedTagFilters, setSelectedTagFilters] = React.useState(
    () => new Set(),
  );
  const toggleTagFilter = React.useCallback((tag) => {
    const key = String(tag || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    setSelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearTagFilters = React.useCallback(() => {
    setSelectedTagFilters((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);
  const [sortMethod, setSortMethod] = React.useState(() => {
    return localStorage.getItem("modview-sort") || "name";
  });
  const [sortedMods, setSortedMods] = React.useState([]);
  const [modInteractionOrder, setModInteractionOrder] = React.useState(() => {
    try {
      const saved = localStorage.getItem(
        `modview-interaction-order-${characterName}`,
      );
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedMod, setDraggedMod] = React.useState(null);
  const [dragOverMod, setDragOverMod] = React.useState(null);
  React.useEffect(() => {
    applySort(
      mods.filter(
        (mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId,
      ),
      sortMethod,
    );
    localStorage.setItem("modview-sort", sortMethod);
  }, [
    mods,
    sortMethod,
    modInteractionOrder,
    modSearchQuery,
    selectedTagFilters,
    activeAppearanceSectionId,
  ]);
  function sortPinnedModsFirst(list, sortRest) {
    const pinned = list
      .filter((mod) => mod.pinned)
      .sort((a, b) => {
        const diff =
          (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "zh-CN");
      });
    const normal = list.filter((mod) => !mod.pinned);
    if (typeof sortRest === "function") {
      normal.sort(sortRest);
    }
    return [...pinned, ...normal];
  }
  function applySort(list, method) {
    let filtered = list;
    if (modSearchQuery) {
      const q = modSearchQuery.toLowerCase();
      filtered = list.filter((m) => {
        if (m.name && m.name.toLowerCase().includes(q)) return true;
        if (
          Array.isArray(m.tags) &&
          m.tags.some((t) => String(t).toLowerCase().includes(q))
        )
          return true;
        if (m.notes && String(m.notes).toLowerCase().includes(q)) return true;
        return false;
      });
    }
    if (selectedTagFilters.size > 0) {
      filtered = filtered.filter((m) => {
        if (!Array.isArray(m.tags) || m.tags.length === 0) return false;
        const modTagKeys = new Set(m.tags.map((t) => String(t).toLowerCase()));
        for (const sel of selectedTagFilters) {
          if (!modTagKeys.has(sel)) return false;
        }
        return true;
      });
    }
    if (method === "custom") {
      setSortedMods(sortPinnedModsFirst(filtered));
      return;
    }
    const order = modInteractionOrder;
    const sorted = sortPinnedModsFirst(filtered, (a, b) => {
      if (method === "name") {
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "time") {
        const timeDiff = (b.addedAtMs || 0) - (a.addedAtMs || 0);
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "enabled") {
        const aIdx = order.indexOf(a.name);
        const bIdx = order.indexOf(b.name);
        const aInteracted = aIdx !== -1;
        const bInteracted = bIdx !== -1;
        if (aInteracted && !bInteracted) return -1;
        if (!aInteracted && bInteracted) return 1;
        if (aInteracted && bInteracted) return aIdx - bIdx;
        return a.name.localeCompare(b.name, "zh-CN");
      }
      return 0;
    });
    setSortedMods(sorted);
  }
  function handleModDragStart(e, mod) {
    setDraggedMod(mod);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", mod.name);
    setTimeout(() => {
      e.target.style.opacity = "0.5";
    }, 0);
  }
  function handleModDragEnd(e) {
    e.target.style.opacity = "1";
    setDraggedMod(null);
    setDragOverMod(null);
  }
  async function applyReorderedMods(nextSortedMods) {
    const reorderedNames = new Set(nextSortedMods.map((mod) => mod.name));
    const replacementQueue = [...nextSortedMods];
    const mergedOrder = mods.map((mod) =>
      getModAppearanceSectionId(mod) === activeAppearanceSectionId &&
      reorderedNames.has(mod.name)
        ? replacementQueue.shift()
        : mod,
    );
    const previousSortedMods = sortedMods;
    const previousMods = mods;
    const previousSortMethod = sortMethod;
    setSortedMods(nextSortedMods);
    setMods(mergedOrder);
    setSortMethod("custom");
    try {
      const orderArray = mergedOrder.map((m) => m.name);
      const result = await window.api.saveModOrder(characterName, orderArray);
      if (!result?.success)
        throw new Error(result?.error || t("common.errors.unknown"));
      setToast({
        type: "success",
        message: t("mods.library.orderSaved"),
      });
    } catch (err) {
      setSortedMods(previousSortedMods);
      setMods(previousMods);
      setSortMethod(previousSortMethod);
      setToast({
        type: "error",
        message: t("mods.library.orderSaveFailed", {
          error: err?.message || String(err),
        }),
      });
    }
  }
  async function handleModDrop(e, targetMod) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedMod || draggedMod.name === targetMod.name) {
      setDraggedMod(null);
      setDragOverMod(null);
      return;
    }
    // Reorder the rows the user can actually see. A local collection renders
    // as one row backed by several variant folders; moving one variant must
    // move the whole block, otherwise moving the group down can leave the
    // first-occurrence position unchanged.
    const displayMods = localCollectionsEnabled
      ? buildLocalCollectionView(
          sortedMods,
          characterName,
          selectedLocalCollectionVariants,
          characterAliases,
        ).displayMods
      : sortedMods;
    const nextSortedMods = reorderDisplayBlocks({
      displayMods,
      sortedMods,
      draggedMod,
      targetMod,
    });
    if (nextSortedMods) await applyReorderedMods(nextSortedMods);
    setDraggedMod(null);
    setDragOverMod(null);
  }
  return {
    modSearchQuery,
    setModSearchQuery,
    selectedTagFilters,
    toggleTagFilter,
    clearTagFilters,
    sortMethod,
    setSortMethod,
    sortedMods,
    setModInteractionOrder,
    draggedMod,
    dragOverMod,
    setDragOverMod,
    handleModDragStart,
    handleModDragEnd,
    handleModDrop,
  };
}
