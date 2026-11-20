const i18n = require("../../shared/i18n/core.cjs");

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url, {
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) {
    await response.body?.cancel();
    throw Error(i18n.t("backend.characterSkinSources.requestFailed", {
      status: response.status
    }));
  }
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw Error(i18n.t("backend.characterSkinSources.responseTooLarge"));
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function fetchSkinCatalog(gameId, base, config, fetchFn = fetch) {
  if (gameId !== 'arknights') throw Error(i18n.t("backend.characterSkinSources.gameSourceUnavailable"));
  const { SKIN_SOURCE, parseSkins } = require('../games/arknights/catalog.cjs');
  return parseSkins(await fetchJson(SKIN_SOURCE, fetchFn), config);
}
module.exports = {
  fetchSkinCatalog
};
