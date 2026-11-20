"use strict";

const i18n = require("../../shared/i18n/core.cjs");
// The manager is single-game by product scope. Keeping the definition table
// (rather than inline literals) means a future game can be added by extending
// this list without touching the IPC or renderer layers.
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
  BUILTIN_GAMES,
  BUILTIN_GAME_MAP
};
