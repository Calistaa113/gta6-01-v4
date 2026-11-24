// People on the street: pedestrians, Coralino gang members, police officers on foot and Ness herself.
import { CITY } from './config.js';
import { blockMin } from './city.js';
import { angleDiff } from './rng.js';
const THREE = window.THREE;

const SKIN = [0xf1c7a3, 0xd9a07a, 0xb37a52, 0x8a5a3c, 0x5e3c28];
const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xf7f7f7, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfee440, 0x2ec4b6];
const PANTS = [0x2b2d42, 0x3d5a80, 0xd6ccc2, 0x6c584c, 0x1d3557];
const HAIR = [0x2a1a12, 0x6b4423, 0xd9b26f, 0x111111];

const legGeo = new THREE.BoxGeometry(0.22, 0.85, 0.24);
legGeo.translate(0, -0.42, 0);
const armGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
armGeo.translate(0, -0.36, 0);
const shoeGeo = new THREE.BoxGeometry(0.24, 0.12, 0.36);
shoeGeo.translate(0, -0.86, 0.05);
const handGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
handGeo.translate(0, -0.78, 0);

const matCache = new Map();
function mat(c) {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  return matCache.get(c);
}

export function buildHuman(o) {
  const g = new THREE.Group();
  const shirt = mat(o.shirt), pants = mat(o.pants), skin = mat(o.skin);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.32), shirt);
  torso.position.y = 1.32;
  torso.castShadow = true;
  g.add(torso);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.34), mat(0x1a1410));
  belt.position.y = 0.96;
  g.add(belt);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), skin);
  neck.position.y = 1.74;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin);
  head.position.y = 1.9;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), mat(o.hair ?? 0x2a1a12));
  hair.position.y = 2.1;
  g.add(hair);
  if (o.ponytail) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), mat(o.hair));
    tail.position.set(0, 1.92, -0.22);
    g.add(tail);
  }
  if (o.shades) {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), mat(0x0b0b10));
    shades.position.set(0, 1.94, 0.18);
    g.add(shades);
  }
  if (o.cap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.5), mat(o.cap));
    cap.position.set(0, 2.14, 0.06);
    g.add(cap);
  }
  if (o.jacket) {
    // open jacket: two front panels and a collar over the shirt
    for (const sx of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.05), mat(o.jacket));
      panel.position.set(sx * 0.2, 1.32, 0.17);
      g.add(panel);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.76, 0.05), mat(o.jacket));
    back.position.set(0, 1.32, -0.17);
    g.add(back);
  }
  const legL = new THREE.Mesh(legGeo, pants), legR = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.15, 0.9, 0);
  legR.position.set(0.15, 0.9, 0);
  legL.add(new THREE.Mesh(shoeGeo, mat(o.shoes ?? 0x1c1c22)));
  legR.add(new THREE.Mesh(shoeGeo, mat(o.shoes ?? 0x1c1c22)));
  g.add(legL, legR);
  const sleeve = o.jacket ? mat(o.jacket) : shirt;
  const armL = new THREE.Mesh(armGeo, sleeve), armR = new THREE.Mesh(armGeo, sleeve);
  armL.position.set(-0.4, 1.66, 0);
  armR.position.set(0.4, 1.66, 0);
  armL.add(new THREE.Mesh(handGeo, skin));
  armR.add(new THREE.Mesh(handGeo, skin));
  g.add(armL, armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), mat(0x15151a));
  gun.position.set(0, -0.7, 0.18);
  gun.visible = false;
  armR.add(gun);
  return { group: g, legL, legR, armL, armR, gun, torso };
}

function lookFor(kind, rng) {
  if (kind === 'cop') return { shirt: 0x24324f, pants: 0x1b2236, skin: rng.pick(SKIN), cap: 0x111827 };
  if (kind === 'gang') return { shirt: 0x14b8a6, pants: 0x111111, skin: rng.pick(SKIN), cap: 0x0f766e, shoes: 0xf2f2f2 };
  if (kind === 'player') return { shirt: 0xf4efe6, jacket: 0xff6a45, pants: 0x2a2f45, skin: 0xd9a07a, hair: 0x1a0f0a, ponytail: true, shades: true, shoes: 0xe8e0d2 };
  return { shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), skin: rng.pick(SKIN), hair: rng.pick(HAIR) };
}

export class Human {
  constructor(scene, rng, kind, x, z) {
    this.kind = kind; // 'ped' | 'gang' | 'cop' | 'player'
    Object.assign(this, buildHuman(lookFor(kind, rng)));
    this.scene = scene;
    scene.add(this.group);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.vel = 0;
    this.phase = rng.next() * 6;
    this.health = { cop: 60, gang: 70, player: 100 }[kind] ?? 30;
    this.dead = false;
    this.deadTime = 0;
    this.state = 'walk';
    this.fear = 0;
    this.cool = 0;
    this.radius = 0.4;
    this.rng = rng;
    if (kind === 'cop' || kind === 'gang') this.gun.visible = true;
  }

  animate(dt, speed) {
    this.phase += dt * speed * 2.4;
    const s = Math.min(1, speed / 3) * 0.7;
    this.legL.rotation.x = Math.sin(this.phase) * s;
    this.legR.rotation.x = -Math.sin(this.phase) * s;
    if (this.aiming) {
      this.armR.rotation.x = -1.5;
      this.armL.rotation.x = -1.2;
    } else {
      this.armL.rotation.x = -Math.sin(this.phase) * s;
      this.armR.rotation.x = Math.sin(this.phase) * s;
    }
    this.torso.rotation.y = Math.sin(this.phase) * s * 0.12;
  }

  sync() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    if (this.dead) {
      this.group.rotation.set(-Math.PI / 2, this.heading, 0, 'YXZ');
      this.group.position.y = 0.25;
    } else {
      this.group.rotation.set(0, this.heading, 0);
    }
  }

  hurt(amount) {
    if (this.dead) return false;
    this.health -= amount;
    this.fear = 10;
    if (this.health <= 0) {
      this.dead = true;
      this.health = 0;
      this.sync();
      return true;
    }
    return false;
  }

  remove() {
    this.scene.remove(this.group);
    this.removed = true;
  }
}

// The sidewalk loop around a block: four corners just inside the curb.
function blockRing(c, r) {
  const b = blockMin(c, r), i = 1.4, B = CITY.block;
  return [[b.x + i, b.z + i], [b.x + B - i, b.z + i], [b.x + B - i, b.z + B - i], [b.x + i, b.z + B - i]];
}

export class Crowd {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.people = [];
    this.target = 46;
  }

  spawnNear(px, pz) {
    for (let t = 0; t < 10; t++) {
      const c = this.rng.int(0, CITY.cols - 1), r = this.rng.int(0, CITY.rows - 1);
      const b = blockMin(c, r);
      const d = Math.hypot(b.x + 32 - px, b.z + 32 - pz);
      if (d < 40 || d > 190) continue;
      const ring = blockRing(c, r), k = this.rng.int(0, 3), next = (k + 1) % 4, f = this.rng.next();
      const p = new Human(this.scene, this.rng, 'ped', ring[k][0] + (ring[next][0] - ring[k][0]) * f, ring[k][1] + (ring[next][1] - ring[k][1]) * f);
      p.ring = ring;
      p.dirSign = this.rng.chance(0.5) ? 1 : -1;
      p.leg = p.dirSign > 0 ? next : k;
      p.walkSpeed = 1.2 + this.rng.next() * 0.6;
      this.people.push(p);
      return p;
    }
    return null;
  }

  // A loud event (gunshot, crash, explosion) makes nearby people panic and run.
  alarm(x, z, radius) {
    for (const p of this.people) {
      if (!p.dead && Math.hypot(p.pos.x - x, p.pos.z - z) < radius) {
        p.state = 'flee';
        p.fear = 8;
        p.fleeFrom = { x, z };
      }
    }
  }

  update(dt, focus) {
    for (const p of this.people) {
      if (p.dead) {
        p.deadTime += dt;
        p.sync();
        continue;
      }
      let speed = 0;
      if (p.state === 'flee') {
        const a = Math.atan2(p.pos.x - p.fleeFrom.x, p.pos.z - p.fleeFrom.z);
        p.heading += angleDiff(p.heading, a) * Math.min(1, dt * 6);
        speed = 5.2;
        p.fear -= dt;
        if (p.fear <= 0) p.state = 'walk';
      } else if (p.ring) {
        const [tx, tz] = p.ring[p.leg];
        p.heading += angleDiff(p.heading, Math.atan2(tx - p.pos.x, tz - p.pos.z)) * Math.min(1, dt * 5);
        speed = p.walkSpeed;
        if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 0.8) p.leg = (p.leg + (p.dirSign > 0 ? 1 : 3)) % 4;
      }
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      this.world.collideCircle(p.pos, p.radius);
      p.animate(dt, speed);
      p.sync();
    }
    for (const p of this.people) {
      if (Math.hypot(p.pos.x - focus.x, p.pos.z - focus.z) > 230 || p.deadTime > 30) p.remove();
    }
    this.people = this.people.filter((p) => !p.removed);
    let n = this.people.length;
    for (let guard = 0; n < this.target && guard < 4; guard++) if (this.spawnNear(focus.x, focus.z)) n++;
  }
}
