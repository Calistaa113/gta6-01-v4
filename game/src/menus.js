// Menus: the title screen, pause menu with stats, the city map, and the shops
// (Cinder Arms for guns, Bravo Motors for upgrades, Sunset Spray for a fresh coat).
import { WEAPONS } from './config.js';
import { hasSave } from './save.js';

const $ = (id) => document.getElementById(id);
const SHOP_TITLES = { guns: 'CINDER ARMS', garage: 'BRAVO MOTORS', spray: 'SUNSET SPRAY' };

export class Menus {
  constructor(G) {
    this.G = G;
    this.mode = 'title';
    this.shopKind = null;
    $('title-menu').addEventListener('click', (e) => this.titleAction(e.target.dataset.act));
    $('pause-menu').addEventListener('click', (e) => this.pauseAction(e.target.dataset.act));
    $('shop-items').addEventListener('click', (e) => {
      const el = e.target.closest('.shop-item');
      if (el) this.buy(el.dataset.id);
    });
    $('btn-continue').classList.toggle('hidden', !hasSave());
  }

  titleAction(act) {
    if (!act) return;
    if (act === 'new') this.G.startGame(false);
    else if (act === 'continue') this.G.startGame(true);
    else if (act === 'controls') $('title-controls').classList.toggle('hidden');
    else if (act === 'credits') $('title-credits').classList.toggle('hidden');
  }

  pauseAction(act) {
    const G = this.G;
    if (act === 'resume') this.close();
    else if (act === 'map') this.openMap();
    else if (act === 'save') {
      G.save();
      G.hud.feed('Game saved');
      this.close();
    } else if (act === 'volume') {
      G.audio.setEnabled(!G.audio.enabled);
      document.querySelector('[data-act=volume]').textContent = 'Sound: ' + (G.audio.enabled ? 'On' : 'Off');
    } else if (act === 'quit') {
      location.reload();
    }
  }

  openPause() {
    const G = this.G, s = G.stats;
    this.mode = 'pause';
    $('pause').classList.remove('hidden');
    const done = Math.min(G.missions.index, G.missions.list.length);
    $('pause-stats').innerHTML =
      '<h4>STORY</h4>' + done + ' / ' + G.missions.list.length + ' missions' +
      '<h4>STATS</h4>Cars jacked: ' + s.jacked +
      '<br>Cops escaped: ' + s.escapes +
      '<br>Wrecks caused: ' + s.wrecks +
      '<br>Distance driven: ' + (s.driven / 1000).toFixed(1) + ' km' +
      '<h4>GARAGE</h4>Engine ' + G.upgrades.engine + '/3 &middot; Armor ' + G.upgrades.armor + '/3 &middot; Nitro ' + Math.round(G.nitro * 100) + '%';
    document.exitPointerLock?.();
  }

  openMap() {
    this.mode = 'map';
    $('pause').classList.add('hidden');
    $('mapview').classList.remove('hidden');
    this.G.hud.drawMap($('map-canvas'), this.G, $('map-legend'));
    document.exitPointerLock?.();
  }

  shopItems(kind) {
    const G = this.G;
    if (kind === 'guns') {
      const items = WEAPONS.filter((w) => w.price).map((w) => {
        const owned = G.player.owned[w.id];
        return { id: 'w:' + w.id, label: w.name + (owned ? ' (ammo refill)' : ''), price: owned ? Math.round(w.price / 4) : w.price };
      });
      items.push({ id: 'armor', label: 'Body armor', price: 500, owned: G.player.armor >= 100 });
      return items;
    }
    if (kind === 'garage') {
      return [
        { id: 'engine', label: 'Engine tune ' + Math.min(3, G.upgrades.engine + 1) + '/3', price: 1500 * (G.upgrades.engine + 1), owned: G.upgrades.engine >= 3 },
        { id: 'carmor', label: 'Armored body ' + Math.min(3, G.upgrades.armor + 1) + '/3', price: 1200 * (G.upgrades.armor + 1), owned: G.upgrades.armor >= 3 },
        { id: 'nitro', label: 'Fill nitro tank', price: 600, owned: G.nitro >= 1 },
        { id: 'repair', label: 'Repair current car', price: 200 },
      ];
    }
    return [{ id: 'respray', label: 'Respray car (clears wanted level)', price: 300 }];
  }

  openShop(kind) {
    this.mode = 'shop';
    this.shopKind = kind;
    $('shop').classList.remove('hidden');
    $('shop-title').textContent = SHOP_TITLES[kind];
    $('shop-items').innerHTML = this.shopItems(kind)
      .map((i) => '<div class="shop-item' + (i.owned ? ' owned' : '') + '" data-id="' + i.id + '" data-price="' + i.price + '"><span>' + i.label + '</span><span>' + (i.owned ? 'MAX' : '$' + i.price.toLocaleString()) + '</span></div>')
      .join('');
    $('shop-cash').textContent = 'Cash: $' + Math.floor(this.G.money).toLocaleString();
    document.exitPointerLock?.();
  }

  buy(id) {
    const G = this.G, el = document.querySelector('.shop-item[data-id="' + id + '"]');
    if (!el || el.classList.contains('owned')) return;
    const price = Number(el.dataset.price);
    if (G.money < price) {
      G.audio.blip(200, 0.2);
      G.hud.feed('Not enough cash');
      return;
    }
    const car = G.player.car;
    if ((id === 'repair' || id === 'respray') && !car) {
      G.hud.feed('Drive a car in first');
      return;
    }
    G.money -= price;
    if (id.startsWith('w:')) {
      const w = WEAPONS.find((x) => x.id === id.slice(2));
      G.player.owned[w.id] = true;
      G.player.ammo[w.id] = (G.player.ammo[w.id] || 0) + w.ammo;
    } else if (id === 'armor') G.player.armor = 100;
    else if (id === 'engine') G.upgrades.engine++;
    else if (id === 'carmor') G.upgrades.armor++;
    else if (id === 'nitro') G.nitro = 1;
    else if (id === 'repair') {
      car.health = car.maxHealth;
      car.burning = 0;
    } else if (id === 'respray') {
      car.paint.color.setHSL(Math.random(), 0.7, 0.5);
      G.police.setLevel(0);
      G.hud.feed('Fresh paint. The VMPD lost you.');
    }
    if (car) Object.assign(car.upgrade, G.upgrades);
    G.audio.blip(1040, 0.1);
    this.openShop(this.shopKind);
  }

  close() {
    for (const id of ['pause', 'mapview', 'shop']) $(id).classList.add('hidden');
    this.mode = 'play';
  }
}
