// Combat: weapon switching, hitscan shots along the camera's aim, melee, and NPC gunfire at the player.
import { WEAPONS } from './config.js';
const THREE = window.THREE;

const tmp = new THREE.Vector3();

/** Distance along a unit ray to a sphere, or -1 when it misses. */
function raySphere(origin, dir, center, radius) {
  tmp.subVectors(center, origin);
  const t = tmp.dot(dir);
  if (t < 0) return -1;
  const d2 = tmp.lengthSq() - t * t;
  return d2 <= radius * radius ? t - Math.sqrt(radius * radius - d2) : -1;
}

export class Combat {
  constructor(G) {
    this.G = G;
    this.cool = 0;
  }

  weapon() { return WEAPONS[this.G.player.weaponIndex]; }

  // Step to the next owned weapon that still has ammo (fists always do).
  cycle(step) {
    const p = this.G.player;
    for (let k = 1; k <= WEAPONS.length; k++) {
      const i = (p.weaponIndex + step * k + WEAPONS.length * 4) % WEAPONS.length;
      const w = WEAPONS[i];
      if (p.owned[w.id] && (w.id === 'fists' || p.ammo[w.id] > 0)) {
        p.weaponIndex = i;
        this.G.audio.blip(660, 0.05);
        return;
      }
    }
  }

  // Everything a bullet can hit: people (one body sphere), cars and the helicopter.
  targets() {
    const G = this.G, list = [];
    for (const h of G.allHumans()) {
      if (!h.dead && h !== G.player.body) list.push({ kind: 'human', obj: h, center: new THREE.Vector3(h.pos.x, 1.3, h.pos.z), r: 0.55 });
    }
    for (const c of G.allCars()) {
      if (c.driver !== 'player' && !c.dead) list.push({ kind: 'car', obj: c, center: new THREE.Vector3(c.pos.x, 0.9, c.pos.z), r: c.radius * 0.7 });
    }
    if (G.police.heli) list.push({ kind: 'heli', obj: G.police.heli, center: G.police.heli.group.position.clone(), r: 4 });
    return list;
  }

  update(dt, input, camera) {
    const G = this.G, p = G.player;
    this.cool -= dt;
    if (input.hit('KeyQ') || input.wheel > 0) this.cycle(1);
    if (input.wheel < 0) this.cycle(-1);
    for (let k = 0; k < WEAPONS.length; k++) {
      const w = WEAPONS[k];
      if (input.hit('Digit' + (k + 1)) && p.owned[w.id] && (w.id === 'fists' || p.ammo[w.id] > 0)) p.weaponIndex = k;
    }
    if (p.inCar || !input.mouseDown || this.cool > 0) return;
    const w = this.weapon();
    if (w.id !== 'fists' && p.ammo[w.id] <= 0) { this.cycle(1); return; }
    this.cool = w.rate;
    if (w.id === 'fists') { this.punch(); return; }
    p.ammo[w.id]--;
    this.fire(w, camera);
  }

  punch() {
    const G = this.G, b = G.player.body;
    G.audio.punch();
    b.armR.rotation.x = -1.6;
    for (const h of G.allHumans()) {
      if (h.dead || h === b) continue;
      const dx = h.pos.x - b.pos.x, dz = h.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && (dx * Math.sin(b.heading) + dz * Math.cos(b.heading)) / d > 0.5) {
        this.hitHuman(h, 18, b.pos);
        break;
      }
    }
  }

  fire(w, camera) {
    const G = this.G, b = G.player.body;
    G.audio.gunshot(w.id);
    G.crowd.alarm(b.pos.x, b.pos.z, 45);
    G.police.heard(b.pos.x, b.pos.z);
    G.shake = Math.max(G.shake, w.id === 'shotgun' ? 0.25 : 0.08);
    const muzzle = new THREE.Vector3(b.pos.x + Math.sin(b.heading) * 0.7, 1.55, b.pos.z + Math.cos(b.heading) * 0.7);
    G.effects.muzzle(muzzle.x, muzzle.y, muzzle.z);
    const aimDir = new THREE.Vector3();
    camera.getWorldDirection(aimDir);
    const aimPoint = camera.position.clone().addScaledVector(aimDir, 60);
    const targets = this.targets();
    for (let k = 0; k < w.pellets; k++) {
      const dir = aimPoint.clone().sub(muzzle).normalize();
      dir.x += (Math.random() - 0.5) * w.spread;
      dir.y += (Math.random() - 0.5) * w.spread;
      dir.z += (Math.random() - 0.5) * w.spread;
      dir.normalize();
      let best = null, bestT = w.range;
      for (const t of targets) {
        const d = raySphere(muzzle, dir, t.center, t.r);
        if (d >= 0 && d < bestT) { bestT = d; best = t; }
      }
      const end = muzzle.clone().addScaledVector(dir, bestT);
      G.effects.tracer(muzzle, end);
      if (!best) {
        if (bestT < w.range) G.effects.sparks(end.x, end.y, end.z, 3);
        continue;
      }
      if (best.kind === 'human') {
        this.hitHuman(best.obj, w.dmg, b.pos);
      } else if (best.kind === 'car') {
        best.obj.damage(w.dmg * 0.6);
        G.effects.sparks(end.x, end.y, end.z, 5);
        if (best.obj.driver === 'ai') best.obj.ai.panic = true;
        G.onCarShot(best.obj);
      } else {
        G.police.hitHeli(w.dmg);
        G.effects.sparks(end.x, end.y, end.z, 6);
      }
    }
  }

  hitHuman(h, dmg, from) {
    const G = this.G;
    G.effects.blood(h.pos.x, 1.3, h.pos.z);
    const killed = h.hurt(dmg);
    if (h.kind === 'ped') h.state = 'flee';
    h.fleeFrom = { x: from.x, z: from.z };
    G.onHumanHit(h, killed);
  }

  // An NPC shoots at the player: the chance to hit falls with distance and with the player's speed.
  npcShoot(shooter, accuracy, dmg) {
    const G = this.G, p = G.player;
    const from = new THREE.Vector3(shooter.x, shooter.y ?? 1.5, shooter.z);
    const to = new THREE.Vector3(p.x, 1.2, p.z);
    const d = from.distanceTo(to);
    if (d > 60 || G.world.blocked(from.x, from.z, to.x, to.z)) return;
    G.audio.gunshot('pistol', Math.max(0.25, 1 - d / 60));
    G.effects.muzzle(from.x, from.y, from.z);
    const speedPenalty = p.inCar ? Math.min(0.6, Math.abs(p.car.speed) / 60) : 0;
    const hit = Math.random() < accuracy * (1 - d / 70) * (1 - speedPenalty);
    const end = hit ? to : to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random(), (Math.random() - 0.5) * 4));
    G.effects.tracer(from, end);
    if (!hit) return;
    if (p.inCar) p.car.damage(dmg * 0.5);
    else G.hurtPlayer(dmg, 'shot');
  }
}
