// Visual effects: smoke, fire, sparks, blood, muzzle flashes, tracers and explosions.
import { makeGlowTexture } from './textures.js';
const THREE = window.THREE;

const rand = (s = 1) => (Math.random() - 0.5) * s;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeGlowTexture();
    this.parts = [];
    this.tracers = [];
    this.flashes = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 });
    // one pooled light for blasts, so no shader recompiles happen mid-game
    this.boom = new THREE.PointLight(0xff8a3a, 0, 45, 2);
    scene.add(this.boom);
  }

  spawn(x, y, z, o) {
    const mat = new THREE.SpriteMaterial({
      map: this.tex,
      color: o.color,
      transparent: true,
      depthWrite: false,
      opacity: o.opacity ?? 1,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.setScalar(o.size);
    this.scene.add(s);
    this.parts.push({
      s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life, max: o.life, grow: o.grow || 0, size: o.size,
      gravity: o.gravity || 0, fade: o.opacity ?? 1,
    });
  }

  smoke(x, y, z, dark = false) {
    this.spawn(x + rand(), y, z + rand(), { color: dark ? 0x2a2626 : 0x9c938c, size: 1.4, grow: 2.4, vy: 2.2, vx: rand(), vz: rand(), life: 2.4, opacity: 0.55 });
  }

  fire(x, y, z) {
    this.spawn(x + rand(1.2), y, z + rand(1.2), { color: Math.random() < 0.5 ? 0xff7a1a : 0xffc23a, size: 1.6, grow: -0.8, vy: 3.5, life: 0.7, additive: true });
  }

  sparks(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      this.spawn(x, y, z, { color: 0xffd27a, size: 0.25, vx: rand(10), vy: Math.random() * 6, vz: rand(10), gravity: 18, life: 0.4, additive: true });
    }
  }

  blood(x, y, z) {
    for (let i = 0; i < 5; i++) {
      this.spawn(x, y, z, { color: 0x8a0f16, size: 0.3, vx: rand(4), vy: Math.random() * 3, vz: rand(4), gravity: 12, life: 0.5 });
    }
  }

  dust(x, y, z) {
    this.spawn(x + rand(0.6), y, z + rand(0.6), { color: 0xcbb8a4, size: 0.8, grow: 1.6, vy: 0.6, life: 0.9, opacity: 0.35 });
  }

  muzzle(x, y, z) {
    this.spawn(x, y, z, { color: 0xffe08a, size: 1.1, life: 0.06, additive: true });
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  explosion(x, y, z) {
    for (let i = 0; i < 26; i++) {
      this.spawn(x, y + 1, z, { color: i % 3 ? 0xff8a1a : 0xffe36a, size: 2.5 + Math.random() * 2, grow: 5, vx: rand(16), vy: Math.random() * 10, vz: rand(16), life: 0.9, additive: true });
    }
    for (let i = 0; i < 14; i++) {
      this.spawn(x, y + 2, z, { color: 0x2b2522, size: 3, grow: 4, vx: rand(5), vy: 3 + Math.random() * 4, vz: rand(5), life: 3.2, opacity: 0.7 });
    }
    this.sparks(x, y + 1, z, 20);
    this.boom.position.set(x, y + 3, z);
    this.flashes.push({ light: this.boom, life: 0.5 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const k = Math.max(0, p.life / p.max);
      p.size = Math.max(0.05, p.size + p.grow * dt);
      p.s.scale.setScalar(p.size);
      p.s.material.opacity = p.fade * k;
      if (p.life <= 0) {
        this.scene.remove(p.s);
        p.s.material.dispose();
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.tracers) {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
      }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const f of this.flashes) {
      f.life -= dt;
      f.light.intensity = Math.max(0, f.life * 12);
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }
}
