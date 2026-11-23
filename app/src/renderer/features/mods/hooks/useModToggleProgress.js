import React from "react";

// Selecting another character replaces ModView, but the IPC request keeps
// running. Track it for the lifetime of the manager window.
const operations = new Map();
const views = new Map();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish() {
  listeners.forEach(listener => listener());
}

export function beginModToggle(scope, modName) {
  if (operations.has(scope)) return null;
  const operation = { modName, refreshRequested: false };
  operations.set(scope, operation);
  publish();

  async function refresh(options) {
    operation.refreshRequested = false;
    await views.get(scope)?.loadMods(options);
  }

  return {
    refresh,
    showToast(toast) { views.get(scope)?.setToast(toast); },
    async finish() {
      try {
        // If notifications arrived during the last read or the request
        // failed after a library change, fetch the latest list before leaving.
        while (operation.refreshRequested) await refresh({ syncCharacterCache: true });
      } finally {
        operations.delete(scope);
        publish();
      }
    }
  };
}

export function deferModToggleRefresh(scope, characterName, data) {
  const operation = operations.get(scope);
  if (!operation || (data.changedCharacterName || data.characterName) !== characterName ||
      !["toggle", "manager-toggle", "mod-selection"].includes(data.reason)) return false;
  // The request's final read includes the same changes as these notices.
  operation.refreshRequested = true;
  return true;
}

export function useModToggleProgress(scope, loadMods, setToast) {
  const getSnapshot = React.useCallback(() => operations.get(scope)?.modName || "", [scope]);
  const togglingMod = React.useSyncExternalStore(subscribe, getSnapshot);
  React.useLayoutEffect(() => {
    const view = { loadMods, setToast };
    views.set(scope, view);
    return () => { if (views.get(scope) === view) views.delete(scope); };
  }, [scope, loadMods, setToast]);
  return togglingMod;
}
