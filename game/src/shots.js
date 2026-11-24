// Screenshot scenes behind ?shot=cover|onfoot|race|roadblock|title. Each one sets up a real moment of play,
// runs the game's own simulation for a few seconds with scripted controls, then frames the camera.
import { CITY } from './config.js';
import { roadX, roadZ } from './city.js';
import { Car } from './vehicles.js';
const THREE = window.THREE;

function scriptedInput(keys) {
  const held = new Set(keys);
  return {
    keys: held, pressed: new Set(), mouseDown: false, dx: 0, dy: 0, wheel: 0,
    down: (c) => held.has(c),
    hit: () => false,
    axis(n, p) { return (held.has(p) ? 1 : 0) - (held.has(n) ? 1 : 0); },
    endFrame() {},
  };
}

function run(G, seconds, input) {
  G.input = input;
  const dt = 1 / 30;
  for (let i = 0; i < seconds * 30; i++) G.step(dt);
}

function playMode(G) {
  document.getElementById('title').classList.add('hidden');
  G.hud.show(true);
  G.state = 'play';
  G.menus.mode = 'play';
  // a still frame should not catch the mission banner halfway through its fade-out
  document.getElementById('hud-banner').style.transition = 'none';
}

function putInCar(G, model, color, x, z, heading) {
  // clear the boulevard so the scripted run is a clean high-speed drive
  for (const c of G.traffic.cars) if (Math.hypot(c.pos.x - x, c.pos.z - z) < 140) c.remove();
  G.traffic.cars = G.traffic.cars.filter((c) => !c.removed);
  G.traffic.target = 10;
  const car = new Car(G.scene, model, color, x, z, heading);
  car.driver = 'player';
  car.keep = true;
  car.speed = 22;
  G.traffic.cars.push(car);
  G.player.car = car;
  G.player.body.group.visible = false;
  G.player.yaw = heading;
  G.hud.carName(car.model.name);
  return car;
}

function pointBeam(h, tx, tz) {
  const hp = h.group.position;
  const len = Math.hypot(hp.x - tx, hp.y, hp.z - tz);
  h.beam.scale.set(1, len, 1);
  h.beam.position.set((hp.x + tx) / 2, hp.y / 2, (hp.z + tz) / 2);
  h.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hp.x - tx, hp.y, hp.z - tz).normalize());
  h.pool.position.set(tx, 0.3, tz);
}

function clearFeed(G) {
  for (const f of G.hud.feedItems) f.el.remove();
  G.hud.feedItems = [];
}

function setDusk(G, v) {
  G.dusk = v;
  G.sky.setDusk(v);
  G.world.setNight(v);
}

function frameCamera(G, pos, look, fov = 60) {
  G.player.camPos.copy(pos);
  G.player.camLook.copy(look);
  G.camera.fov = fov;
  G.camera.updateProjectionMatrix();
  G.camera.position.copy(pos);
  G.camera.lookAt(look);
}

// The cover: LAST LIGHT, Ness's gold Ardent tearing down the beach road with cruisers and SKYHAWK-7 behind.
function coverShot(G, beach) {
  G.money = 48250;
  G.respect = 12;
  G.missions.index = 7;
  const car = putInCar(G, 'ardent', 0xffb21a, roadX(1) + 10, beach + 3.8, Math.PI / 2);
  G.missions.begin(7);
  G.missions.subs = [];
  G.player.owned.smg = true;
  G.player.ammo.smg = 140;
  G.player.weaponIndex = 2;
  G.nitro = 0.7;
  G.player.armor = 60;
  G.player.health = 84;
  for (const [dx, lane] of [[-22, 3.8], [-34, -3.8], [-48, 3.8]]) {
    const cop = new Car(G.scene, 'police', 0x14161c, car.pos.x + dx, beach + lane, Math.PI / 2);
    cop.driver = 'cop';
    cop.sirenOn = true;
    cop.keep = true;
    cop.shootCool = 5;
    cop.speed = 20;
    G.police.cars.push(cop);
  }
  car.maxHealth = car.health = 900;
  run(G, 3.2, scriptedInput(['KeyW']));
  car.maxHealth = 100;
  car.health = 82;
  G.hud.bannerTime = 0;
  clearFeed(G);
  G.hud.feed('SKYHAWK-7 is in the air');
  G.hud.feed('Wanted: the ledger');
  G.hud.subtitle('Ness', 'Every cop he owns is between me and the pier.');
  car.speed = 41;
  car.steer = -0.25;
  car.heading = Math.PI / 2 - 0.06;
  car.sync();
  // keep only the three scripted cruisers in frame, and no roadblock officers
  for (const extra of G.police.cars.slice(3)) extra.remove();
  G.police.cars = G.police.cars.slice(0, 3);
  for (const o of G.police.officers) if (o.group) o.group.visible = false;
  for (const b of G.police.barriers) b.visible = false;
  const slots = [[-10, -7.6, 0.05], [-19, 0.2, -0.04], [-29, -6.8, 0.0]];
  G.police.cars.forEach((cop, i) => {
    const [dx, dz, h] = slots[i];
    cop.pos.set(car.pos.x + dx, 0, car.pos.z + dz);
    cop.heading = Math.PI / 2 + h;
    cop.speed = 38;
    cop.sync();
  });
  if (!G.police.heli) G.police.launchHeli();
  G.police.heli.group.position.set(car.pos.x - 36, 19, car.pos.z - 10);
  G.police.heli.group.rotation.set(0.12, Math.PI / 2, 0);
  pointBeam(G.police.heli, car.pos.x - 22, car.pos.z - 3);
  frameCamera(G, new THREE.Vector3(car.pos.x + 8.5, 1.55, car.pos.z + 4.6), new THREE.Vector3(car.pos.x - 12, 2.9, car.pos.z - 2.2), 62);
  G.hud.update(G, 0);
}

// DOCK RATS: a shootout among the Coralino vans at Port Varela.
function onFootShot(G) {
  G.money = 21400;
  G.respect = 7;
  G.missions.index = 4;
  const at = { x: roadX(9) + 18, z: roadZ(2) };
  G.player.body.pos.set(at.x - 26, 0, at.z + 4);
  G.player.owned.smg = true;
  G.player.ammo.smg = 162;
  G.player.weaponIndex = 2;
  G.missions.begin(4);
  G.missions.subs = [];
  G.police.setLevel(2, 'gunfire at the docks');
  run(G, 1.0, scriptedInput([]));
  const van = G.missions.targets[1];
  van.damage(200);
  G.missions.targets[2].burning = 4;
  G.missions.targets[2].health = 28;
  G.player.yaw = Math.atan2(van.pos.x - G.player.x, van.pos.z - G.player.z) - 0.25;
  G.player.body.heading = G.player.yaw;
  const inp = scriptedInput([]);
  inp.mouseDown = true;
  run(G, 0.6, inp);
  G.player.body.aiming = true;
  G.player.body.animate(0, 0);
  G.player.body.armR.rotation.x = -1.5;
  G.effects.explosion(van.pos.x, 1, van.pos.z);
  G.effects.update(0.12);
  const hand = new THREE.Vector3(G.player.x + Math.sin(G.player.yaw) * 0.9, 1.45, G.player.z + Math.cos(G.player.yaw) * 0.9);
  G.effects.muzzle(hand.x, hand.y, hand.z);
  const foe = G.missions.gang.find((h) => !h.dead);
  if (foe) G.effects.tracer(hand, new THREE.Vector3(foe.pos.x, 1.3, foe.pos.z));
  G.player.snapCamera(G.camera);
  G.hud.bannerTime = 0;
  G.hud.subtitle('Teo', 'Half the port heard that. Keep moving!');
  G.hud.update(G, 0);
}

// NEON RUN: the street race down the Strip at neon dusk, nitro lit.
function raceShot(G, beach) {
  G.money = 9800;
  G.respect = 4;
  G.missions.index = 3;
  const car = putInCar(G, 'cabrio', 0xff3d8b, roadX(2) + 30, beach - 3.8, Math.PI / 2);
  G.missions.begin(3);
  G.missions.subs = [];
  G.missions.raceIdx = 1;
  G.missions.timer = 51.4;
  const rival = new Car(G.scene, 'ardent', 0x22e4ff, car.pos.x + 12, beach + 3.8, Math.PI / 2);
  rival.driver = 'ai';
  rival.ai = { i: 4, j: CITY.rows, dir: 1, cruise: 24, panic: true };
  rival.keep = true;
  G.traffic.cars.push(rival);
  run(G, 2.5, scriptedInput(['KeyW', 'ShiftLeft']));
  car.speed = 44;
  car.steer = 0.15;
  rival.pos.set(car.pos.x + 13, 0, car.pos.z + 5.2);
  rival.heading = Math.PI / 2 - 0.05;
  rival.speed = 45;
  rival.sync();
  G.nitro = 0.45;
  G.effects.fire(car.pos.x - 2.3, 0.6, car.pos.z);
  G.time = 520;
  setDusk(G, 0.55);
  G.player.snapCamera(G.camera);
  G.hud.subtitle('Lupe', 'Sunset race down the Strip. Loser buys the drinks!');
  G.hud.bannerTime = 0;
  G.hud.update(G, 0);
  G.hud.radio('NEON DRIFT FM');
}

// HEAT WAVE: three stars downtown and the VMPD has thrown a roadblock across the avenue.
function roadblockShot(G) {
  G.money = 16900;
  G.respect = 6;
  G.missions.index = 5;
  const z = roadZ(3) - 3.8;
  const car = putInCar(G, 'sedan', 0x2f7bff, roadX(2) + 6, z, Math.PI / 2);
  G.police.setLevel(3, 'Kroll wants you');
  G.police.roadblockCool = 99;
  run(G, 1.4, scriptedInput(['KeyW']));
  for (const c of G.police.cars) c.remove();
  G.police.cars = [];
  car.heading = Math.PI / 2;
  car.speed = 30;
  car.sync();
  G.police.roadblock(34);
  // pull the car up so the barriers fill the middle of the frame
  const mid = G.police.barriers[1];
  if (mid) car.pos.x = mid.position.x - 19;
  car.sync();
  run(G, 0.2, scriptedInput(['KeyW']));
  car.speed = 33;
  setDusk(G, 0.4);
  G.missions.active = null;
  G.hud.objective('HEAT WAVE', 'Lose the VMPD');
  const fwd = car.forward();
  frameCamera(
    G,
    new THREE.Vector3(car.pos.x - fwd.x * 7 - 2.2, 3.1, car.pos.z - fwd.z * 7 + 1.8),
    new THREE.Vector3(car.pos.x + fwd.x * 24, 1.2, car.pos.z + fwd.z * 24),
    56,
  );
  G.hud.bannerTime = 0;
  G.hud.subtitle('Lupe', 'Roadblock! Find a gap or make one!');
  G.hud.update(G, 0);
}

export async function runShot(G, name) {
  const beach = roadZ(CITY.rows);
  if (name === 'title') {
    G.time = 40;
    G.world.update(40);
    G.sky.update(0.016, new THREE.Vector3(0, 0, 0), 40);
    G.camera.position.set(-150, 34, beach + 70);
    G.camera.lookAt(40, 22, beach - 40);
    return;
  }
  playMode(G);
  if (name === 'cover') coverShot(G, beach);
  else if (name === 'onfoot') onFootShot(G);
  else if (name === 'race') raceShot(G, beach);
  else if (name === 'roadblock') roadblockShot(G);
}
