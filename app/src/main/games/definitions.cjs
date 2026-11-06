"use strict";

const i18n = require("../../shared/i18n/core.cjs");
// Kept for persisted-data migration code that still recognises old profiles.
const WUWA_FIX_GAME_ID = "wuthering-waves";
const BUILTIN_GAMES = [{
  id: "arknights",
  name: "明日方舟",
  shortName: "明日方舟",
  description: i18n.t("arknights.description"),
  imageFile: "arknights.png",
  defaultLaunchMode: "ARKNIGHTS",
  supportedLaunchModes: ["ARKNIGHTS"],
  modLoaderLabel: "QAQR Arknights Loader",
  executableHint: "Arknights.exe",
  marketGameId: "arknights"
}];
const BUILTIN_GAME_MAP = new Map(BUILTIN_GAMES.map(game => [game.id, game]));
module.exports = {
  WUWA_FIX_GAME_ID,
  BUILTIN_GAMES,
  BUILTIN_GAME_MAP
};
