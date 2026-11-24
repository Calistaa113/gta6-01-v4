// Save and load the story, money, weapons and garage upgrades in the browser's localStorage.
const KEY = 'vistamar-golden-hour-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave(G) {
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    mission: G.missions.index,
    money: Math.floor(G.money),
    respect: G.respect,
    health: G.player.health,
    armor: G.player.armor,
    owned: G.player.owned,
    ammo: G.player.ammo,
    upgrades: G.upgrades,
    nitro: G.nitro,
    stats: G.stats,
    pos: { x: G.player.x, z: G.player.z },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function applySave(G, data) {
  if (!data) return;
  G.missions.index = data.mission ?? 0;
  G.money = data.money ?? 0;
  G.respect = data.respect ?? 0;
  G.player.health = data.health ?? 100;
  G.player.armor = data.armor ?? 0;
  Object.assign(G.player.owned, data.owned || {});
  Object.assign(G.player.ammo, data.ammo || {});
  Object.assign(G.upgrades, data.upgrades || {});
  G.nitro = data.nitro ?? 0;
  Object.assign(G.stats, data.stats || {});
  if (data.pos) G.player.body.pos.set(data.pos.x, 0, data.pos.z);
}
