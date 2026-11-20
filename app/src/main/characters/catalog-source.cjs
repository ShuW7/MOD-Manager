const i18n = require("../../shared/i18n/core.cjs");
const path = require('node:path');
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../core/json-store.cjs");
const SOURCES = {
  arknights: ['https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json']
};
const RESOURCE_DIRS = {
  arknights: 'arknights'
};
const CATEGORIES = new Set(['NPC', '其他', 'UI', '功能', '大世界', '武器', '载具', '滑翔翼', '光锥']);
const safeName = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value) && !/^(\.{1,2}|CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value);
function imageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hosts = ['raw.githubusercontent.com', 'web.hycdn.cn'];
    return hosts.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
function normalizeRecords(records) {
  if (!Array.isArray(records) || records.length > 2000) throw Error(i18n.t("backend.characterCatalog.invalidCharacterList"));
  const valid = records.filter(item => item && safeName(item.name)).map(item => ({
    name: item.name,
    en: typeof item.en === 'string' ? item.en.slice(0, 100) : '',
    aliases: Array.isArray(item.aliases) ? item.aliases.filter(safeName).slice(0, 16) : [],
    image: imageUrl(item.image)
  }));
  if (valid.length < 5) throw Error(i18n.t("backend.characterCatalog.characterSourceReturnedTooFewValidEntries"));
  return valid;
}
function parseSource(gameId, texts) {
  if (gameId !== 'arknights') throw Error(i18n.t("backend.characterCatalog.unsupportedCharacterSource"));
  const records = Object.entries(JSON.parse(texts[0])).filter(([id, item]) => /^char_\d+_[a-z0-9]+$/i.test(id) && item.isNotObtainable !== true).map(([id, item]) => ({
    name: item.name,
    en: id,
    aliases: [id, item.appellation].filter(Boolean),
    image: `https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/assets/dyn/arts/charavatars/${id}.png`
  }));
  return normalizeRecords(records);
}
async function fetchCharacters(gameId, fetchFn = fetch) {
  if (!Object.hasOwn(SOURCES, gameId)) throw Error(i18n.t("backend.characterCatalog.unsupportedGame"));
  const maxBytes = 48 * 1024 * 1024;
  const texts = await Promise.all(SOURCES[gameId].map(async url => {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error(i18n.t("backend.characterCatalog.characterSourceReturnedHTTP", {
      status: response.status
    }));
    if (Number(response.headers.get('content-length')) > maxBytes) throw Error(i18n.t("backend.characterCatalog.characterSourceTooLarge"));
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw Error(i18n.t("backend.characterCatalog.characterSourceTooLarge"));
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks).toString('utf8');
  }));
  return parseSource(gameId, texts);
}
function mergeCharacters(base, records) {
  const defaults = [...(base.defaultCharacters || [])];
  const mappings = {
    ...base.manualMappings
  };
  const images = {
    ...base.characterImages
  };
  const pairs = [...(base.characterNameMap?.pairs || [])];
  for (const item of normalizeRecords(records)) {
    const alias = item.en && mappings[item.en.toLowerCase()];
    const pair = item.en && pairs.find(entry => String(entry.en || '').toLowerCase() === item.en.toLowerCase());
    const name = defaults.includes(item.name) ? item.name : alias?.displayName || pair?.zh || item.name;
    if (!safeName(name)) continue;
    if (!defaults.includes(name)) {
      const index = defaults.findIndex(value => CATEGORIES.has(value));
      defaults.splice(index < 0 ? defaults.length : index, 0, name);
    }
    if (item.image) images[name] = item.image;
    for (const key of [item.name, item.en, ...item.aliases].filter(Boolean)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key.toLowerCase())) continue;
      if (!Object.hasOwn(mappings, key.toLowerCase())) mappings[key.toLowerCase()] = {
        displayName: name,
        canonicalEnName: item.en || name
      };
    }
    if (item.en && !pairs.some(entry => entry.zh === name)) pairs.push({
      zh: name,
      en: item.en,
      jasmName: item.en
    });
  }
  return {
    ...base,
    defaultCharacters: defaults,
    manualMappings: mappings,
    characterImages: images,
    characterNameMap: {
      ...base.characterNameMap,
      pairs
    }
  };
}
function createCharacterCatalogService({
  cacheDir,
  fetchFn = fetch,
  onUpdate = () => {},
  now = Date.now
}) {
  const loaded = new Map(),
    pending = new Map(),
    attempted = new Map();
  function read(gameId) {
    if (!Object.hasOwn(SOURCES, gameId)) return null;
    if (loaded.has(gameId)) return loaded.get(gameId);
    let cache = null;
    try {
      const parsed = readJsonFileSync(path.join(cacheDir, gameId + '.json'));
      if (parsed.gameId === gameId && Number.isFinite(parsed.checkedAt) && parsed.checkedAt <= now()) {
        cache = {
          ...parsed,
          records: normalizeRecords(parsed.records)
        };
      }
    } catch {/* Offline and first-run fallback uses the bundled text catalog. */}
    loaded.set(gameId, cache);
    return cache;
  }
  function refresh(gameId, force = false) {
    if (!Object.hasOwn(SOURCES, gameId)) return Promise.resolve({
      success: false,
      error: i18n.t("backend.characterCatalog.gameSourceUnavailable")
    });
    if (pending.has(gameId)) return pending.get(gameId);
    const cached = read(gameId);
    if (!force && (cached && now() - cached.checkedAt < 86400000 || attempted.has(gameId) && now() - attempted.get(gameId) < 3600000)) return Promise.resolve({
      success: true,
      updated: false
    });
    attempted.set(gameId, now());
    const request = (async () => {
      try {
        const records = await fetchCharacters(gameId, fetchFn);
        const next = {
          schemaVersion: 1,
          gameId,
          checkedAt: now(),
          records
        };
        const file = path.join(cacheDir, gameId + '.json');
        writeJsonFileSync(file, next);
        loaded.set(gameId, next);
        const changed = JSON.stringify(cached?.records) !== JSON.stringify(records);
        if (changed) onUpdate(gameId);
        return {
          success: true,
          updated: changed,
          count: records.length
        };
      } catch (error) {
        return {
          success: false,
          error: i18n.t("backend.characterCatalog.updateFailed", {
            reason: error.message
          })
        };
      } finally {
        pending.delete(gameId);
      }
    })();
    pending.set(gameId, request);
    return request;
  }
  return {
    refresh,
    merge: (gameId, base) => {
      const cache = read(gameId);
      return cache ? mergeCharacters(base, cache.records) : base;
    }
  };
}
module.exports = {
  SOURCES,
  RESOURCE_DIRS,
  imageUrl,
  normalizeRecords,
  parseSource,
  fetchCharacters,
  mergeCharacters,
  createCharacterCatalogService
};
