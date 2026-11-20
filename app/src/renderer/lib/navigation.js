// "角色" and "界面资源" share CharacterView/ModView, so the selected
// character is only valid while its originating tab is active. Entering the
// other shared tab, or re-selecting the current tab, must return to that tab's
// root list.
const SHARED_CHARACTER_TABS = ["characters", "ui"];
// Shared UI resources are stored under this pseudo-character by the import
// pipeline. Entering the UI tab opens its Mod manager directly.
export const UI_CHARACTER_NAME = "UI";

export function isOperatorCharacter(character) {
  return !!character?.name && character.name !== UI_CHARACTER_NAME;
}

export function shouldResetCharacterOnTabChange(tab, activeTab, selectedTab) {
  if (!SHARED_CHARACTER_TABS.includes(tab)) return false;
  return activeTab === tab || selectedTab !== tab;
}
