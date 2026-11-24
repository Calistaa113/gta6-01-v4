// Entry point: builds the renderer and the world, wires every system together and runs the frame loop.
import { CITY, RADIO } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { createSky } from './sky.js';
import { Traffic } from './traffic.js';
import { Crowd, Human } from './people.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Menus } from './menus.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { resolveCarContacts } from './vehicles.js';
import { writeSave, readSave, applySave } from './save.js';
import { runShot } from './shots.js';
const THREE = window.THREE;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!shotName });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 2400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const rng = makeRng(seed);
const G = {
  scene, camera, renderer, rng, params,
  money: 300, respect: 0, nitro: 0, shake: 0, time: 0, dusk: 0,
  upgrades: { engine: 0, armor: 0 },
  stats: { jacked: 0, escapes: 0, wrecks: 0, driven: 0 },
  state: 'title',
};
G.world = buildCity(scene, rng);
G.sky = createSky(scene);
G.effects = new Effects(scene);
G.audio = new Audio();
G.hud = new Hud();
G.input = new Input(canvas);
const spawn = G.world.pois.safehouse;
G.player = new Player(scene, rng, spawn.x, spawn.z - 1);
G.traffic = new Traffic(scene, G.world, rng);
G.crowd = new Crowd(scene, G.world, rng);
G.police = new Police(G);
G.combat = new Combat(G);
G.missions = new Missions(G);
G.menus = new Menus(G);

G.allCars = () => {
  const s = new Set(G.traffic.cars);
  for (const c of G.police.cars) s.add(c);
  return [...s].filter((c) => !c.removed);
};
G.allHumans = () => [...G.crowd.people, ...G.police.officers, ...G.missions.gang].filter((h) => !h.removed);
G.weapon = () => G.combat.weapon();
G.addRespect = (n) => { G.respect += n; };
G.save = () => writeSave(G);

G.hurtPlayer = (dmg, why) => {
  const p = G.player;
  if (G.state !== 'play') return;
  const soak = Math.min(p.armor, dmg * 0.7);
  p.armor -= soak;
  p.health -= dmg - soak;
  G.shake = Math.max(G.shake, 0.3);
  document.getElementById('hurt').style.opacity = String(Math.min(0.7, dmg / 30));
  if (p.health <= 0) G.wasted(why);
};

function respawnAt(poi, title, sub) {
  const p = G.player;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
    p.body.group.visible = true;
  }
  p.body.pos.set(poi.x, 0, poi.z);
  p.health = 100;
  G.police.setLevel(0);
  if (G.missions.active) G.missions.fail(sub);
  G.hud.banner(title, sub, 4);
  p.snapCamera(camera);
}
G.wasted = () => {
  G.money = Math.max(0, G.money - 500);
  respawnAt(G.world.pois.hospital, 'WASTED', 'Santa Brisa Medical patched you up: -$500');
};
G.busted = () => {
  G.money = Math.max(0, G.money - 300);
  respawnAt(G.world.pois.hospital, 'BUSTED', 'Bail paid: -$300. Weapons kept, pride not.');
};

G.onCarjack = (car) => {
  G.stats.jacked++;
  const wasCop = car.driver === 'cop';
  const thrown = new Human(scene, rng, wasCop ? 'cop' : 'ped', car.pos.x + 2, car.pos.z + 1);
  thrown.state = 'flee';
  thrown.fear = 8;
  thrown.fleeFrom = { x: car.pos.x, z: car.pos.z };
  G.crowd.people.push(thrown);
  G.police.crime(wasCop ? 2 : 1, wasCop ? 'stole a cruiser' : 'carjacking', car.pos.x, car.pos.z);
  G.hud.feed('Jacked a ' + car.model.name);
};
G.onCarShot = (car) => {
  if (car.driver === 'cop' || car.model.kind === 'police') G.police.crime(1, 'shot at police', car.pos.x, car.pos.z);
};
G.onHumanHit = (h, killed) => {
  if (h.kind === 'cop') G.police.crime(killed ? 2 : 1, killed ? 'cop down' : 'assault on an officer', h.pos.x, h.pos.z);
  else if (h.kind === 'ped') G.police.crime(killed ? 1 : 0, killed ? 'murder' : '', h.pos.x, h.pos.z);
  if (killed && h.kind === 'gang') {
    G.money += 60;
    G.hud.feed('Coralino down +$60');
  }
  if (killed && h.kind === 'ped' && rng.chance(0.5)) G.money += rng.int(5, 40);
};

G.startGame = (load) => {
  if (load) applySave(G, readSave());
  document.getElementById('title').classList.add('hidden');
  G.hud.show(true);
  G.state = 'play';
  G.menus.mode = 'play';
  G.input.wantLock = true;
  G.audio.start();
  G.player.snapCamera(camera);
  const next = G.missions.list[Math.min(G.missions.index, G.missions.list.length - 1)];
  G.hud.objective('', 'Meet ' + next.giver + ' at the yellow marker');
  G.hud.banner('VISTAMAR', 'Golden hour on the Costa Dorada', 3.5);
};

// A car blows up: fireball, chain damage to everything close, and heat if it was a cruiser.
function explode(c) {
  G.effects.explosion(c.pos.x, 0.5, c.pos.z);
  G.audio.explosion();
  G.shake = 0.8;
  G.stats.wrecks++;
  G.crowd.alarm(c.pos.x, c.pos.z, 60);
  if (c.model.kind === 'police') G.police.crime(1, 'destroyed a cruiser', c.pos.x, c.pos.z);
  for (const h of G.allHumans()) if (Math.hypot(h.pos.x - c.pos.x, h.pos.z - c.pos.z) < 6) h.hurt(80);
  const p = G.player;
  if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < 6) {
    if (p.car === c) {
      p.toggleCar(G);
      G.hurtPlayer(60, 'explosion');
    } else if (!p.inCar) {
      G.hurtPlayer(45, 'explosion');
    }
  }
  for (const o of G.allCars()) if (o !== c && Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 7) o.damage(45);
}

// Burning wrecks, engine smoke and explosions.
function updateWrecks(dt) {
  for (const c of G.allCars()) {
    if (c.burning > 0 && !c.dead) {
      c.burning -= dt;
      c.damage(dt * 6);
      if (Math.random() < 0.5) G.effects.fire(c.pos.x, 1.2, c.pos.z);
    } else if (c.health < 50 && Math.random() < dt * 6) {
      const k = c.model.len * 0.4;
      G.effects.smoke(c.pos.x + Math.sin(c.heading) * k, 1.1, c.pos.z + Math.cos(c.heading) * k, c.health < 30);
    }
    if (c.dead && Math.random() < dt * 8) G.effects.smoke(c.pos.x, 1.4, c.pos.z, true);
    if (c.explodeNow) {
      c.explodeNow = false;
      explode(c);
    }
  }
}

// Shops and save points: stand at the door and press E.
const INTERACTIVE = ['garage', 'guns', 'spray', 'save'];
function updateInteractions() {
  const p = G.player;
  for (const poi of Object.values(G.world.pois)) {
    if (!INTERACTIVE.includes(poi.kind)) continue;
    if (Math.hypot(p.x - poi.x, p.z - poi.z) > 6) continue;
    G.hud.hint('Press E: ' + (poi.kind === 'save' ? 'save your game' : 'enter ' + poi.name), 0.3);
    if (!G.input.hit('KeyE')) continue;
    if (poi.kind === 'save') {
      G.save();
      p.health = 100;
      G.hud.feed('Saved at ' + poi.name + '. Health restored.');
    } else if (poi.kind === 'spray' && !p.inCar) {
      G.hud.feed('Bring a car to Sunset Spray');
    } else {
      G.menus.openShop(poi.kind);
    }
  }
}

// Fast cars knock people down; the player's kills count as crimes.
function runOver(cars) {
  for (const c of cars) {
    if (Math.abs(c.speed) < 7) continue;
    for (const h of G.allHumans()) {
      if (h.dead || Math.hypot(h.pos.x - c.pos.x, h.pos.z - c.pos.z) >= c.radius * 0.8) continue;
      h.hurt(Math.abs(c.speed) * 4);
      G.effects.blood(h.pos.x, 1, h.pos.z);
      if (c.driver === 'player') G.onHumanHit(h, h.dead);
    }
  }
}

function drawMinimap() {
  const blips = [];
  const flash = Math.floor(G.time * 4) % 2 ? '#ff2b4a' : '#3b7bff';
  for (const c of G.police.cars) if (!c.dead) blips.push({ x: c.pos.x, z: c.pos.z, color: flash, size: 4 });
  for (const t of G.missions.targets) if (!t.dead) blips.push({ x: t.pos.x, z: t.pos.z, color: '#ff4f9a', size: 5, pin: true });
  for (const h of G.missions.gang) if (!h.dead) blips.push({ x: h.pos.x, z: h.pos.z, color: '#2ee6c8', size: 3 });
  for (const poi of Object.values(G.world.pois)) blips.push({ x: poi.x, z: poi.z, color: '#22e4ff', size: 4, shape: 'square' });
  const obj = G.missions.objectivePoint();
  if (obj) blips.push({ x: obj.x, z: obj.z, color: '#ffc23a', size: 6, pin: true });
  if (G.police.heli) blips.push({ x: G.police.heli.group.position.x, z: G.police.heli.group.position.z, color: '#ffffff', size: 5, shape: 'square', pin: true });
  G.hud.minimap(G.player.x, G.player.z, G.player.yaw, blips, G.police.level > 0);
}

const focusVec = new THREE.Vector3();
G.step = (dt) => {
  G.time += dt;
  const inp = G.input;
  if (G.state === 'play' && G.menus.mode === 'play') {
    if (inp.hit('Escape') || inp.hit('KeyP')) G.menus.openPause();
    if (inp.hit('KeyM')) G.menus.openMap();
    if (inp.hit('KeyR') && G.player.inCar) G.hud.radio(G.audio.nextStation());
    const before = G.player.inCar;
    G.player.update(dt, inp, G);
    if (!before && G.player.inCar) G.hud.radio(RADIO[G.audio.station].name);
    if (G.player.car) {
      Object.assign(G.player.car.upgrade, G.upgrades);
      G.stats.driven += Math.abs(G.player.car.speed) * dt;
    }
    G.combat.update(dt, inp, camera);
    updateInteractions();
  } else if (G.state === 'play' && inp.hit('Escape')) {
    G.menus.close();
  }
  if (G.state === 'play' && G.menus.mode !== 'play') { inp.endFrame(); return; }
  const focus = { x: G.player.x, z: G.player.z, inCar: G.player.inCar };
  G.traffic.update(dt, focus, G.allCars());
  G.crowd.update(dt, focus);
  const lvl = G.police.level;
  G.police.update(dt);
  if (lvl > 0 && G.police.level === 0) G.stats.escapes++;
  G.missions.update(dt);
  const cars = G.allCars();
  resolveCarContacts(cars, (a, b, rel) => {
    a.damage(rel * 0.8);
    b.damage(rel * 0.8);
    if (G.player.car !== a && G.player.car !== b) return;
    G.audio.crash();
    G.shake = Math.min(1, rel / 25);
    const other = G.player.car === a ? b : a;
    if (other.model.kind === 'police') G.police.crime(1, 'rammed a cruiser', other.pos.x, other.pos.z);
  });
  runOver(cars);
  updateWrecks(dt);
  G.effects.update(dt);
  G.world.update(G.time);
  // the day slowly slides between golden hour and neon dusk
  G.dusk = Math.min(0.65, Math.max(0, (Math.sin(G.time / 240) * 0.5 + 0.5) * 0.65));
  G.sky.setDusk(G.dusk);
  G.world.setNight(G.dusk);
  G.sky.update(dt, focusVec.set(G.player.x, 0, G.player.z), G.time);
  G.player.updateCamera(camera, dt, G.shake);
  G.shake = Math.max(0, G.shake - dt * 2);
  const sirens = G.police.cars.filter((c) => c.sirenOn && Math.hypot(c.pos.x - G.player.x, c.pos.z - G.player.z) < 120).length;
  G.audio.update({ speed: G.player.inCar ? G.player.car.speed : 0, inCar: G.player.inCar, sirens });
  if (G.state === 'play') {
    G.hud.update(G, dt);
    drawMinimap();
    const hurt = document.getElementById('hurt');
    const o = Number(hurt.style.opacity || 0);
    if (o > 0) hurt.style.opacity = String(Math.max(0, o - dt * 1.5));
  }
  inp.endFrame();
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

if (shotName) {
  runShot(G, shotName).then(() => {
    renderer.render(scene, camera);
    window.__shotReady = true;
  });
} else {
  // the title screen orbits the Strip at sunset behind the menu
  const orbit = (now) => {
    if (G.state !== 'title') return;
    const t = now / 1000;
    G.time = t;
    G.world.update(t);
    G.sky.update(0.016, focusVec.set(0, 0, 0), t);
    camera.position.set(Math.sin(t * 0.05) * 160, 60, CITY.z0 + CITY.depth + 40 + Math.cos(t * 0.05) * 30);
    camera.lookAt(0, 20, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(orbit);
  };
  requestAnimationFrame(orbit);
  const begin = () => {
    if (G.state === 'play') {
      last = performance.now();
      requestAnimationFrame(frame);
    } else setTimeout(begin, 50);
  };
  begin();
}
window.G = G;
