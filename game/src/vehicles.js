// Cars: low-poly models built from boxes, arcade driving physics, drifting, damage and fire.
import { CAR_MODELS, PALETTE } from './config.js';
import { clamp, angleDiff } from './rng.js';
const THREE = window.THREE;

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9d9e0, metalness: 0.8, roughness: 0.3 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2a3c, metalness: 0.6, roughness: 0.1 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.6 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.9, roughness: 0.2 });
const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff1f3d, toneMapped: false });
const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x2f7bff, toneMapped: false });

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[2];
}

function part(geo, mat, x, y, z, parent, shadow = false) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

function buildCarMesh(model, color) {
  const g = new THREE.Group();
  const L = model.len, W = model.wid, H = model.hgt;
  const base = 0.45;
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.28 });
  part(new THREE.BoxGeometry(W, H * 0.55, L), paint, 0, base + H * 0.27, 0, g, true);
  const nose = part(new THREE.BoxGeometry(W * 0.98, H * 0.25, L * 0.3), paint, 0, base + H * 0.5, L * 0.32, g);
  nose.rotation.x = 0.12;
  // bumpers and a grille give every model a face
  part(new THREE.BoxGeometry(W * 1.02, 0.18, 0.18), chromeMat, 0, base + 0.12, L / 2, g);
  part(new THREE.BoxGeometry(W * 1.02, 0.18, 0.18), chromeMat, 0, base + 0.12, -L / 2, g);
  part(new THREE.BoxGeometry(W * 0.4, 0.16, 0.04), blackMat, 0, base + H * 0.33, L / 2 + 0.02, g);

  if (model.kind === 'van') {
    part(new THREE.BoxGeometry(W, H * 0.75, L * 0.72), paint, 0, base + H * 0.75, -L * 0.12, g, true);
    part(new THREE.BoxGeometry(W * 0.92, H * 0.35, 0.1), glassMat, 0, base + H * 0.78, L * 0.245, g);
  } else if (model.top > 0) {
    const sport = model.kind === 'sport';
    part(new THREE.BoxGeometry(W * 0.84, model.top, L * (sport ? 0.42 : 0.5)), glassMat, 0, base + H * 0.55 + model.top / 2, -L * 0.05, g, true);
    part(new THREE.BoxGeometry(W * 0.8, 0.08, L * (sport ? 0.34 : 0.42)), paint, 0, base + H * 0.55 + model.top, -L * 0.07, g);
  } else {
    const ws = part(new THREE.BoxGeometry(W * 0.86, 0.45, 0.08), glassMat, 0, base + H * 0.72, L * 0.12, g);
    ws.rotation.x = -0.5;
    part(new THREE.BoxGeometry(W * 0.8, 0.4, L * 0.3), new THREE.MeshStandardMaterial({ color: 0xc89a6a }), 0, base + H * 0.6, -L * 0.1, g);
  }
  if (model.kind === 'sport') {
    part(new THREE.BoxGeometry(W * 0.9, 0.08, 0.4), blackMat, 0, base + H * 0.78, -L * 0.46, g);
    for (const sx of [-0.35, 0.35]) part(new THREE.BoxGeometry(0.08, 0.25, 0.08), blackMat, sx * W, base + H * 0.66, -L * 0.46, g);
  }
  if (model.kind === 'taxi') {
    part(new THREE.BoxGeometry(0.8, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe14a }), 0, base + H * 0.55 + model.top + 0.18, -L * 0.07, g);
    part(new THREE.BoxGeometry(W * 1.01, 0.12, L * 0.8), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, base + H * 0.45, 0, g);
  }
  const sirens = [];
  if (model.kind === 'police') {
    part(new THREE.BoxGeometry(W * 1.01, H * 0.2, L * 0.5), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }), 0, base + H * 0.3, 0, g);
    const y = base + H * 0.55 + model.top + 0.12;
    const red = part(new THREE.BoxGeometry(0.6, 0.18, 0.3), sirenRed.clone(), -0.35, y, -L * 0.07, g);
    const blue = part(new THREE.BoxGeometry(0.6, 0.18, 0.3), sirenBlue.clone(), 0.35, y, -L * 0.07, g);
    part(new THREE.BoxGeometry(W * 0.9, 0.3, 0.12), blackMat, 0, base + 0.25, L / 2 + 0.12, g);   // push bar
    sirens.push(red, blue);
  }
  for (const sx of [-1, 1]) {
    part(new THREE.BoxGeometry(0.45, 0.14, 0.05), headMat, sx * W * 0.33, base + H * 0.4, L / 2 + 0.01, g);
    part(new THREE.BoxGeometry(0.45, 0.14, 0.05), tailMat, sx * W * 0.33, base + H * 0.42, -L / 2 - 0.01, g);
  }
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(wheelGeo, wheelMat));
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 8), rimMat);
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    w.position.set(sx * (W / 2 - 0.12), 0.42, sz * L * 0.33);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, sirens, paint };
}

let nextId = 1;

export class Car {
  constructor(scene, modelId, color, x, z, heading) {
    this.id = nextId++;
    this.model = modelById(modelId);
    this.color = color ?? PALETTE.carColors[this.id % PALETTE.carColors.length];
    Object.assign(this, buildCarMesh(this.model, this.color));
    this.scene = scene;
    scene.add(this.group);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;          // radians, 0 = +z
    this.speed = 0;                  // m/s along the heading
    this.steer = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.radius = Math.max(this.model.len, this.model.wid) * 0.48;
    this.driver = null;              // 'player' | 'ai' | 'cop' | null
    this.ai = null;
    this.burning = 0;
    this.dead = false;
    this.upgrade = { engine: 0, armor: 0 };
    this.sirenOn = false;
    this.roll = 0;
    this.drift = false;
    this.sync();
  }

  get topSpeed() { return this.model.speed * (1 + this.upgrade.engine * 0.12); }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  // input: { throttle -1..1, steer -1..1, brake bool, boost bool }
  drive(dt, input, world) {
    if (this.dead) {
      this.speed *= Math.pow(0.2, dt);
      input = { throttle: 0, steer: 0, brake: true };
    }
    const m = this.model;
    const top = this.topSpeed * (input.boost ? 1.18 : 1);
    if (input.throttle > 0) {
      const reverseKick = this.speed < 0 ? 2.2 : 1;
      this.speed += m.accel * (1 + this.upgrade.engine * 0.15) * input.throttle * dt * reverseKick * (1 - Math.max(0, this.speed) / (top * 1.05));
    } else if (input.throttle < 0) {
      this.speed += (this.speed > 0 ? -m.accel * 2.2 : -m.accel * 0.6) * -input.throttle * dt;
    } else {
      this.speed *= Math.pow(0.55, dt);
    }
    if (input.brake) this.speed *= Math.pow(0.08, dt);
    this.speed = clamp(this.speed, -14, top);
    this.steer += (input.steer - this.steer) * Math.min(1, dt * 6);
    // steering bites less at a crawl and softens at top speed
    const sf = clamp(Math.abs(this.speed) / 8, 0, 1) * (1 - clamp(Math.abs(this.speed) / (top * 1.6), 0, 0.5));
    const turn = this.steer * m.grip * 0.55 * sf * Math.sign(this.speed || 1) * (input.brake ? 1.5 : 1);
    this.heading += turn * dt;
    this.drift = input.brake && Math.abs(this.speed) > 14 && Math.abs(this.steer) > 0.3;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    const hit = world.collideCircle(this.pos, this.radius * 0.8);
    if (hit) {
      const impact = Math.abs(this.speed);
      if (impact > 9) this.damage(((impact - 9) * 1.6) / (1 + this.upgrade.armor * 0.35), 'crash');
      this.speed *= -0.25;
      this.lastCrash = impact;
    } else {
      this.lastCrash = 0;
    }
    this.roll += (-this.steer * clamp(this.speed / 40, -1, 1) * 0.06 - this.roll) * Math.min(1, dt * 4);
    for (let i = 0; i < 4; i++) {
      this.wheels[i].children[0].rotation.x += (this.speed * dt) / 0.42;
      if (i < 2) this.wheels[i].rotation.y = this.steer * 0.45;
    }
    if (this.sirens.length) {
      const on = this.sirenOn && Math.floor(performance.now() / 160 + this.id) % 2 === 0;
      this.sirens[0].material.color.setHex(on || !this.sirenOn ? 0xff1f3d : 0x33060c);
      this.sirens[1].material.color.setHex(!on || !this.sirenOn ? 0x2f7bff : 0x081633);
    }
    this.sync();
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health < 30 && !this.burning) this.burning = 6;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.explodeNow = true;
      this.paint.color.multiplyScalar(0.18);
    }
  }

  steerToward(tx, tz, dt, maxSpeed, world, brake = false) {
    const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    const d = angleDiff(this.heading, want);
    const steer = clamp(d * 2.2, -1, 1);
    const throttle = Math.abs(d) > 1.6 ? -0.6 : this.speed < maxSpeed ? 1 : 0;
    this.drive(dt, { throttle, steer: throttle < 0 ? -steer : steer, brake }, world);
  }

  sync() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.set(0, this.heading, this.roll, 'YXZ');
  }

  remove() {
    this.scene.remove(this.group);
    this.removed = true;
  }
}

// Separate overlapping cars so they shove each other instead of passing through.
export function resolveCarContacts(cars, onHit) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, r = (a.radius + b.radius) * 0.75;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 0.0001) continue;
      const d = Math.sqrt(d2), push = (r - d) / 2, nx = dx / d, nz = dz / d;
      a.pos.x -= nx * push; a.pos.z -= nz * push;
      b.pos.x += nx * push; b.pos.z += nz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 6) onHit?.(a, b, rel);
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.7;
      b.speed = avg * 0.7;
      a.sync();
      b.sync();
    }
  }
}
