// The Vistamar Police Department: wanted stars, pursuit cruisers, officers on foot, roadblocks
// with striped barriers, and the SKYHAWK-7 helicopter with its searchlight.
import { CITY } from './config.js';
import { roadX, roadZ } from './city.js';
import { Car } from './vehicles.js';
import { Human } from './people.js';
import { DIRS, nodePos } from './traffic.js';
import { makeGlowTexture } from './textures.js';
import { angleDiff } from './rng.js';
const THREE = window.THREE;

// cruisers in pursuit at each wanted level
const CAR_COUNT = [0, 2, 3, 4, 5, 7];
const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function buildHelicopter() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2433, metalness: 0.4, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x223a55, metalness: 0.7, roughness: 0.1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10), dark);
  body.scale.set(1, 0.9, 1.6);
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), glass);
  canopy.scale.set(1.1, 0.8, 1);
  canopy.position.set(0, 0.2, 1.6);
  g.add(canopy);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 3), white);
  stripe.position.y = -0.2;
  g.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 6), dark);
  tail.position.set(0, 0.3, -4.5);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), white);
  fin.position.set(0, 1, -7.3);
  g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.5), dark);
  rotor.position.y = 1.9;
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  g.add(rotor2);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.25), dark);
  tailRotor.position.set(0.3, 1, -7.3);
  g.add(tailRotor);
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4), dark);
    skid.position.set(sx * 1.2, -1.8, 0);
    g.add(skid);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false }));
  beacon.position.set(0, -1.1, 0);
  g.add(beacon);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 7, 1, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xfff1c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.scale.set(16, 16, 1);
  return { group: g, rotors: [rotor, rotor2], tailRotor, beacon, beam, pool };
}

// A striped sawhorse barrier for roadblocks.
function buildBarrier() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xe23a2a, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.6 });
  for (let k = 0; k < 6; k++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.12), k % 2 ? red : white);
    seg.position.set(-1.5 + k * 0.6, 1, 0);
    g.add(seg);
  }
  for (const sx of [-1.4, 1.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.5), white);
    leg.position.set(sx, 0.5, 0);
    g.add(leg);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffb020, toneMapped: false }));
  lamp.position.set(0, 1.25, 0);
  g.add(lamp);
  g.userData.lamp = lamp;
  return g;
}

function addHeli(scene, h) { scene.add(h.group, h.beam, h.pool); }
function removeHeli(scene, h) { scene.remove(h.group, h.beam, h.pool); }

export class Police {
  constructor(G) {
    this.G = G;
    this.level = 0;
    this.evade = 0;
    this.cars = [];
    this.officers = [];
    this.barriers = [];
    this.heli = null;
    this.roadblockCool = 6;
    this.spawnCool = 0;
    this.seen = false;
    this.bustTimer = 0;
    this.lastSeen = { x: 0, z: 0 };
  }

  get flashing() { return this.level > 0 && !this.seen; }

  setLevel(n, why) {
    const before = this.level;
    this.level = Math.max(0, Math.min(5, n));
    if (this.level > before) {
      this.evade = 0;
      this.G.hud.feed(why ? 'Wanted: ' + why : 'Wanted level up');
      if (this.level >= 3 && before < 3) this.roadblockCool = Math.min(this.roadblockCool, 4);
    }
    if (this.level === 0 && before > 0) this.clear();
  }

  crime(stars, why, x, z) {
    // a crime counts when an officer is near, the heat is already on, or someone calls it in
    const units = this.cars.concat(this.officers);
    const witnessed = this.level > 0 || units.some((c) => Math.hypot(c.pos.x - x, c.pos.z - z) < 90) || Math.random() < 0.55;
    if (!witnessed) return;
    this.setLevel(Math.max(this.level, Math.min(5, this.level + stars)), why);
    this.lastSeen = { x, z };
  }

  heard(x, z) {
    if (this.level > 0) this.lastSeen = { x, z };
  }

  clear() {
    for (const c of this.cars) {
      c.sirenOn = false;
      if (c.driver === 'player') continue;
      c.driver = null;
      c.keep = false;
      c.remove();
    }
    for (const o of this.officers) o.remove();
    for (const b of this.barriers) this.G.scene.remove(b);
    this.cars = this.cars.filter((c) => !c.removed);
    this.officers = [];
    this.barriers = [];
    if (this.heli) {
      removeHeli(this.G.scene, this.heli);
      this.heli = null;
    }
    this.G.hud.feed('You lost the VMPD');
  }

  spawnCar(minD = 80, maxD = 150) {
    const G = this.G, rng = G.rng;
    for (let t = 0; t < 30; t++) {
      const i = rng.int(0, CITY.cols), j = rng.int(0, CITY.rows);
      const d = Math.hypot(roadX(i) - G.player.x, roadZ(j) - G.player.z);
      if (d < minD || d > maxD) continue;
      const dir = rng.int(0, 3), p = nodePos(i, j, dir);
      const car = new Car(G.scene, 'police', 0x14161c, p.x, p.z, Math.atan2(DIRS[dir][0], DIRS[dir][1]));
      car.driver = 'cop';
      car.sirenOn = true;
      car.keep = true;
      car.shootCool = 2 + rng.next() * 2;
      this.cars.push(car);
      return car;
    }
    return null;
  }

  // Two cruisers parked across the junction ahead of the player, barriers and officers behind them.
  roadblock(distance = 85) {
    const G = this.G, p = G.player;
    const fwd = p.inCar ? p.car.forward() : new THREE.Vector3(Math.sin(p.body.heading), 0, Math.cos(p.body.heading));
    const ax = p.x + fwd.x * distance, az = p.z + fwd.z * distance;
    let best = null, bestD = 1e9;
    for (let i = 0; i <= CITY.cols; i++) {
      for (let j = 0; j <= CITY.rows; j++) {
        const d = Math.hypot(roadX(i) - ax, roadZ(j) - az);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    if (!best || bestD > 60) return false;
    const cx = roadX(best[0]), cz = roadZ(best[1]);
    const alongX = Math.abs(fwd.x) > Math.abs(fwd.z);
    const sgn = alongX ? Math.sign(fwd.x) || 1 : Math.sign(fwd.z) || 1;
    for (const off of [-3.6, 3.6]) {
      const car = new Car(G.scene, 'police', 0x14161c, cx + (alongX ? 0 : off), cz + (alongX ? off : 0), alongX ? 0.15 : Math.PI / 2 + 0.15);
      car.driver = 'parked';
      car.sirenOn = true;
      car.keep = true;
      car.roadblock = true;
      this.cars.push(car);
      const o = new Human(G.scene, G.rng, 'cop', cx + (alongX ? sgn * 5 : off * 1.6), cz + (alongX ? off * 1.6 : sgn * 5));
      o.shootCool = 1 + G.rng.next();
      o.holdGround = true;
      this.officers.push(o);
    }
    for (const off of [-6.5, 0, 6.5]) {
      const bar = buildBarrier();
      bar.position.set(cx + (alongX ? -sgn * 4 : off), 0, cz + (alongX ? off : -sgn * 4));
      bar.rotation.y = alongX ? Math.PI / 2 : 0;
      G.scene.add(bar);
      this.barriers.push(bar);
    }
    G.hud.feed('VMPD roadblock ahead!');
    return true;
  }

  launchHeli() {
    const G = this.G, p = G.player;
    this.heli = buildHelicopter();
    this.heli.hp = 260;
    this.heli.shootCool = 3;
    this.heli.group.position.set(p.x + 80, 45, p.z + 80);
    addHeli(G.scene, this.heli);
    G.hud.feed('SKYHAWK-7 is in the air');
  }

  hitHeli(dmg) {
    if (!this.heli) return;
    this.heli.hp -= dmg;
    if (this.heli.hp > 0) return;
    const p = this.heli.group.position;
    this.G.effects.explosion(p.x, p.y, p.z);
    this.G.audio.explosion();
    removeHeli(this.G.scene, this.heli);
    this.heli = null;
    this.G.hud.feed('SKYHAWK-7 shot down!');
    this.G.addRespect(3);
  }

  update(dt) {
    const G = this.G, p = G.player;
    G.audio.rotor(this.heli ? Math.max(0, 1 - Math.hypot(this.heli.group.position.x - p.x, this.heli.group.position.z - p.z) / 160) : 0);
    if (this.level === 0) {
      this.seen = false;
      return;
    }
    // line of sight from any unit refreshes the hunt; otherwise the evade timer runs down
    this.seen = false;
    for (const u of [...this.cars, ...this.officers]) {
      if (u.dead) continue;
      const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z);
      if (d < 70 && !G.world.blocked(u.pos.x, u.pos.z, p.x, p.z)) { this.seen = true; break; }
    }
    if (this.heli && Math.hypot(this.heli.group.position.x - p.x, this.heli.group.position.z - p.z) < 45) this.seen = true;
    if (this.seen) {
      this.evade = 0;
      this.lastSeen = { x: p.x, z: p.z };
    } else {
      this.evade += dt;
      if (this.evade > 8 + this.level * 3) { this.setLevel(0); return; }
    }

    this.spawnCool -= dt;
    const chasing = this.cars.filter((c) => !c.dead && !c.roadblock && c.driver === 'cop').length;
    if (chasing < CAR_COUNT[this.level] && this.spawnCool <= 0) { this.spawnCar(); this.spawnCool = 3; }
    this.roadblockCool -= dt;
    if (this.level >= 3 && this.roadblockCool <= 0 && p.inCar) this.roadblockCool = this.roadblock() ? 28 : 3;
    if (this.level >= 4 && !this.heli) this.launchHeli();

    const target = this.seen ? { x: p.x, z: p.z } : this.lastSeen;
    for (const car of this.cars) {
      if (car.dead || car.driver !== 'cop') continue;
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      if (!p.inCar && d < 12 && Math.abs(car.speed) < 6) {
        // officers bail out and give chase on foot
        car.driver = 'parked';
        for (const s of [-1, 1]) {
          const o = new Human(G.scene, G.rng, 'cop', car.pos.x + s * 2, car.pos.z);
          o.shootCool = 1 + G.rng.next();
          this.officers.push(o);
        }
        continue;
      }
      // aim ahead of a moving car so cruisers cut it off instead of trailing it
      const lead = p.inCar ? Math.min(1.2, d / 30) : 0;
      const tx = target.x + (p.inCar ? Math.sin(p.car.heading) * p.car.speed * lead : 0);
      const tz = target.z + (p.inCar ? Math.cos(p.car.heading) * p.car.speed * lead : 0);
      car.steerToward(tx, tz, dt, d < 12 && !p.inCar ? 3 : 24 + this.level * 4, G.world, d < 10 && !p.inCar);
      car.shootCool -= dt;
      if (this.level >= 2 && d < 35 && car.shootCool <= 0) {
        car.shootCool = 2.2 - this.level * 0.2;
        G.combat.npcShoot({ x: car.pos.x, z: car.pos.z, y: 1.6 }, 0.25, 6);
      }
    }
    for (const car of this.cars) if (car.driver === 'parked' && !car.dead) car.drive(dt, { throttle: 0, steer: 0, brake: true }, G.world);
    for (const bar of this.barriers) bar.userData.lamp.visible = Math.floor(G.time * 3) % 2 === 0;

    let near = false;
    for (const o of this.officers) {
      if (o.dead) { o.sync(); continue; }
      const dx = p.x - o.pos.x, dz = p.z - o.pos.z, d = Math.hypot(dx, dz);
      o.heading += angleDiff(o.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      let speed = 0;
      if (d > 7 && !(o.holdGround && d < 60)) {
        speed = 5;
        o.pos.x += Math.sin(o.heading) * speed * dt;
        o.pos.z += Math.cos(o.heading) * speed * dt;
      }
      o.aiming = d < 30;
      o.shootCool -= dt;
      if (d < 30 && o.shootCool <= 0 && this.level >= 2) {
        o.shootCool = 1.4 + G.rng.next();
        G.combat.npcShoot({ x: o.pos.x, z: o.pos.z, y: 1.6 }, 0.35, 7);
      }
      if (d < 2.6 && !p.inCar) near = true;
      G.world.collideCircle(o.pos, 0.4);
      o.animate(dt, speed);
      o.sync();
    }
    // busted: an officer within arm's reach of the player on foot at low heat
    if (near && this.level <= 2 && !p.inCar) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.6) { this.bustTimer = 0; G.busted(); }
    } else {
      this.bustTimer = 0;
    }

    if (this.heli) this.flyHeli(dt, target);
    this.cars = this.cars.filter((c) => !c.removed);
    this.officers = this.officers.filter((o) => !o.removed);
    for (const c of this.cars) if (c.driver !== 'player' && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 320) c.remove();
    // roadblocks left far behind are cleared away with their cruisers
    this.barriers = this.barriers.filter((b) => {
      const keep = Math.hypot(b.position.x - p.x, b.position.z - p.z) < 320;
      if (!keep) G.scene.remove(b);
      return keep;
    });
  }

  // SKYHAWK-7 circles the target, sweeping its searchlight and firing from the door.
  flyHeli(dt, target) {
    const G = this.G, h = this.heli, hp = h.group.position;
    const a = G.time * 0.35;
    const tx = target.x + Math.cos(a) * 28, tz = target.z + Math.sin(a) * 28;
    hp.x += (tx - hp.x) * Math.min(1, dt * 0.8);
    hp.z += (tz - hp.z) * Math.min(1, dt * 0.8);
    hp.y += (38 - hp.y) * dt;
    h.group.rotation.y = Math.atan2(target.x - hp.x, target.z - hp.z);
    h.group.rotation.x = 0.12;
    for (const r of h.rotors) r.rotation.y += dt * 30;
    h.tailRotor.rotation.x += dt * 40;
    h.beacon.visible = Math.floor(G.time * 2) % 2 === 0;
    tmpA.set(target.x, 0, target.z);
    h.beam.scale.set(1, hp.distanceTo(tmpA), 1);
    h.beam.position.set((hp.x + target.x) / 2, hp.y / 2, (hp.z + target.z) / 2);
    h.beam.quaternion.setFromUnitVectors(UP, tmpB.set(hp.x - target.x, hp.y, hp.z - target.z).normalize());
    h.pool.position.set(target.x, 0.3, target.z);
    h.shootCool -= dt;
    if (h.shootCool <= 0) {
      h.shootCool = 2.4;
      G.combat.npcShoot({ x: hp.x, z: hp.z, y: hp.y - 2 }, 0.3, 8);
    }
  }
}
