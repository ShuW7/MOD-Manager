import { t } from "../../shared/i18n/index.mjs";

export function getModTypeLabels(mod) {
  if (!mod.arknightsScope) return [];
  const labels = [];
  if (mod.appearanceSectionId === "base") labels.push(t("mods.types.base"));
  else if (mod.appearanceSectionId?.startsWith("skin:")) labels.push(t("mods.types.skin"));
  const translated = { static: t("mods.types.static"), dynamic: t("mods.types.dynamic"), voice: t("mods.types.voice"), assetbundle: t("mods.types.assetbundle"), text: t("mods.types.text") };
  const textLabels = {
    story: t("mods.types.textStory"),
    voice: t("mods.types.textVoice"),
    archive: t("mods.types.textArchive"),
    direct_match: t("mods.types.textDirect"),
  };
  const textType = mod.arknightsScope.textConfig?.type;
  for (const type of mod.arknightsScope.contentTypes || []) {
    if (type === "text" && textLabels[textType]) labels.push(textLabels[textType]);
    else if (translated[type]) labels.push(translated[type]);
  }
  return labels;
}

export function collectModTags(mods) {
  const tags = new Map();
  for (const mod of mods) for (const value of mod.tags || []) {
    const name = String(value).trim();
    if (name) tags.set(name.toLowerCase(), name);
  }
  return [...tags].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
}
