import React from "react";
import { createRoot } from "react-dom/client";
import ModView from "../../../app/src/renderer/features/mods/ModView.jsx";
import "../../../app/src/renderer/styles/index.css";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (value, message) => { if (!value) throw Error(message); };
const root = createRoot(document.getElementById("root"));
const characterA = "测试角色 A";
const characterB = "测试角色 B";
const mods = [
  { name: "二皮", path: "fixture/二皮", enabled: false, tags: [], type: "m4a" },
  { name: "二皮半身", path: "fixture/二皮半身", enabled: true, tags: [], type: "m4a" },
];
let calls = 0, pending, rejectNext = false, holdRefresh = false, refreshPending;
let listReads = 0;
let saveBeforeReply = false;
const changeListeners = new Set();
const loading = () => document.querySelector(".appearance-section-loading");
const switches = () => [...document.querySelectorAll('.mod-library-panel [role="switch"]')];
window.api = {
  getConfig: async () => ({}),
  arknightsStatus: async () => ({ success: true, loaderReady: true, workerReady: true }),
  getMods: async characterName => {
    if (characterName === characterA) listReads++;
    if (holdRefresh) await new Promise(resolve => { refreshPending = resolve; });
    return { success: true, mods: mods.map(mod => ({ ...mod })), sections: [{ id: "base", name: "默认" }] };
  },
  getModDetails: async () => ({ success: true, hotkeyGroups: [], hotkeys: [], notes: "" }),
  onModsChanged: callback => { changeListeners.add(callback); return () => changeListeners.delete(callback); },
  toggleMod: async (characterName, name, enabled) => {
    calls++;
    // Observe the actual rendered panel at the IPC boundary, not a state setter.
    check(loading()?.textContent.includes("加载中"), "Loading feedback is missing when the toggle IPC starts");
    check(document.querySelector('.mod-library-panel[aria-busy="true"]'), "Panel is not marked busy");
    const mod = mods.find(item => item.name === name);
    if (saveBeforeReply) mod.enabled = enabled;
    await new Promise(resolve => { pending = resolve; });
    if (rejectNext) { rejectNext = false; throw Error("fixture IPC failure"); }
    mod.enabled = enabled;
    notify({ characterName: "__all__", changedCharacterName: characterName, reason: "toggle" });
    notify({ characterName, reason: "mod-selection" });
    return { success: true, autoReloaded: true, bundleCount: 1 };
  },
};

function notify(detail) {
  changeListeners.forEach(callback => callback({ gameId: "arknights", ...detail }));
}

async function until(predicate, message) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await delay(10);
  }
  throw Error(message);
}

async function mount(mode, characterName = characterA, busy = false) {
  localStorage.setItem("modview-view-mode", mode);
  root.render(<ModView key={`${mode}:${characterName}`} characterName={characterName} activeGameId="arknights" devMode={false} onBack={() => {}} />);
  await until(() => document.querySelector(".mod-view-title")?.textContent === characterName &&
    document.querySelector(`.mod-${mode === "gallery" ? "gallery" : "list"}-panel`) && switches().length === 2 &&
    (busy || !loading()), "Mod list did not finish initial loading");
}

async function toggleWithSlowReply(mode, enabled, screenshot) {
  const before = calls;
  pending = null;
  const start = performance.now();
  const toggle = switches().find(button => button.getAttribute("aria-checked") === String(!enabled));
  check(toggle, "Toggle not found");
  toggle.click();
  await until(() => pending || document.querySelector(".toast-error"), "Toggle IPC did not start");
  check(pending, document.querySelector(".toast-error")?.textContent || "No pending toggle");
  check(loading(), "Loading feedback was delayed until the IPC reply");
  check(switches().every(button => button.disabled), "Switches were not disabled during the operation");
  switches().forEach(button => button.click());
  check(calls === before + 1, "Repeat clicks sent duplicate operations");
  // An unrelated list refresh must not clear the operation's loading feedback.
  notify({ characterName: characterA });
  await delay(150);
  check(loading(), "A background refresh hid feedback while toggle IPC was pending");
  if (screenshot) await window.captureToggleTest(screenshot);
  await delay(850);
  check(loading(), "Loading feedback disappeared during slow backend work");
  holdRefresh = true;
  const readsBeforeCompletion = listReads;
  pending();
  await until(() => refreshPending, "Final list refresh was not started");
  check(loading(), "Feedback disappeared before final refresh completed");
  holdRefresh = false;
  refreshPending(); refreshPending = null;
  await until(() => !loading(), "Loading feedback did not clear after completion");
  check(switches().every(button => !button.disabled), "Switches stayed disabled after completion");
  check(listReads === readsBeforeCompletion + 1, "Toggle completion read the same character more than once");
  return { mode, enabled, delayedBackendMs: 1000, elapsedMs: Math.round(performance.now() - start) };
}

async function toggleAcrossNavigation() {
  pending = null;
  saveBeforeReply = true;
  const before = calls;
  const name = mods[0].name;
  const targetSwitch = () => switches().find(button => button.getAttribute("aria-label").endsWith(` ${name}`));
  targetSwitch().click();
  await until(() => pending, "Navigation case did not reach IPC");
  await mount("list", characterB);
  check(!loading(), "Another character inherited the first character's loading status");
  await mount("list", characterA, true);
  await delay(100);
  check(targetSwitch().getAttribute("aria-checked") === "true", "Returned view did not show the already-saved library state");
  check(loading(), "Returning to the character hid feedback before the toggle replied");
  targetSwitch().click();
  check(calls === before + 1, "Returning to the character allowed a duplicate toggle");
  holdRefresh = true;
  const readsBeforeCompletion = listReads;
  pending();
  await until(() => refreshPending, "Returned view did not start its final refresh");
  check(loading(), "Returned view hid feedback while its final refresh was pending");
  holdRefresh = false;
  refreshPending(); refreshPending = null;
  await until(() => !loading(), "Returned view stayed busy after completion");
  check(targetSwitch().getAttribute("aria-checked") === "true", "Returned view did not display the committed state");
  check(listReads === readsBeforeCompletion + 1, "Returned view read the same character more than once on completion");
  saveBeforeReply = false;
}

window.runToggleFeedbackTest = async () => {
  localStorage.clear(); sessionStorage.clear();
  const results = [];
  for (const mode of ["list", "gallery"]) {
    await mount(mode);
    results.push(await toggleWithSlowReply(mode, true, `${mode}-pending.png`));
    results.push(await toggleWithSlowReply(mode, false));
  }
  await mount("list");
  await toggleAcrossNavigation();
  rejectNext = true; pending = null;
  switches()[0].click();
  await until(() => pending, "Failure case did not reach IPC");
  pending();
  await until(() => !loading() && document.querySelector(".toast-error"), "Failure did not clear feedback and show error");
  check(switches().every(button => !button.disabled), "IPC rejection left switches disabled");
  return { success: true, results, navigationRetainedProgress: true, rejectedReplyRecovered: true };
};
