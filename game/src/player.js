// Ness Calderon: walking, sprinting, jumping, getting in and out of cars, carjacking and the chase camera.
import { Human } from './people.js';
import { clamp, angleDiff } from './rng.js';
const THREE = window.THREE;

const tmpLook = new THREE.Vector3();
const tmpShake = new THREE.Vector3();

export class Player {
  constructor(scene, rng, x, z) {
    this.body = new Human(scene, rng, 'player', x, z);
    this.health = 100;
    this.armor = 0;
    this.yaw = Math.PI;
    this.pitch = 0.18;
    this.car = null;
    this.vy = 0;
    this.y = 0;
    this.camPos = new THREE.Vector3(x, 6, z - 10);
    this.camLook = new THREE.Vector3(x, 1.5, z);
    this.weaponIndex = 0;
    this.owned = { fists: true, pistol: true };
    this.ammo = { pistol: 48, smg: 0, shotgun: 0 };
    this.stamina = 1;
  }

  get x() { return this.car ? this.car.pos.x : this.body.pos.x; }
  get z() { return this.car ? this.car.pos.z : this.body.pos.z; }
  get inCar() { return !!this.car; }
  get pos() { return this.car ? this.car.pos : this.body.pos; }

  update(dt, input, G) {
    this.yaw -= input.dx * 0.0032;
    this.pitch = clamp(this.pitch + input.dy * 0.0024, -0.35, 0.75);
    if (input.down('ArrowLeft')) this.yaw += dt * 2.2;
    if (input.down('ArrowRight')) this.yaw -= dt * 2.2;
    if (this.car) this.driveCar(dt, input, G);
    else this.walk(dt, input, G);
    if (input.hit('KeyF')) this.toggleCar(G);
  }

  walk(dt, input, G) {
    const b = this.body;
    const f = input.axis('KeyS', 'KeyW'), s = input.axis('KeyD', 'KeyA');
    const sprint = input.down('ShiftLeft') && this.stamina > 0.05;
    let speed = 0;
    if (f || s) {
      const a = this.yaw + Math.atan2(s, f);
      speed = sprint ? 7.5 : 4.2;
      b.pos.x += Math.sin(a) * speed * dt;
      b.pos.z += Math.cos(a) * speed * dt;
      b.heading += angleDiff(b.heading, input.mouseDown ? this.yaw : a) * Math.min(1, dt * 12);
      if (sprint && Math.random() < dt * 8) G.effects.dust(b.pos.x, 0.2, b.pos.z);
    } else if (input.mouseDown) {
      b.heading += angleDiff(b.heading, this.yaw) * Math.min(1, dt * 14);
    }
    this.stamina = clamp(this.stamina + (sprint && speed ? -0.25 : 0.2) * dt, 0, 1);
    if (input.hit('Space') && this.y <= 0) this.vy = 5.5;
    this.vy -= 16 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    G.world.collideCircle(b.pos, b.radius);
    for (const c of G.allCars()) {
      const dx = b.pos.x - c.pos.x, dz = b.pos.z - c.pos.z, r = c.radius * 0.8 + 0.4, d = Math.hypot(dx, dz);
      if (d < r && d > 0.01) {
        if (Math.abs(c.speed) > 8 && c.driver !== 'player') G.hurtPlayer(Math.abs(c.speed) * 1.4, 'hit by a car');
        b.pos.x = c.pos.x + (dx / d) * r;
        b.pos.z = c.pos.z + (dz / d) * r;
      }
    }
    b.aiming = input.mouseDown && G.weapon().id !== 'fists';
    b.animate(dt, speed);
    b.sync();
    b.group.position.y = this.y;
  }

  driveCar(dt, input, G) {
    const c = this.car;
    const boost = input.down('ShiftLeft') && G.nitro > 0;
    c.drive(dt, { throttle: input.axis('KeyS', 'KeyW'), steer: input.axis('KeyD', 'KeyA'), brake: input.down('Space'), boost }, G.world);
    if (boost && c.speed > 10) {
      G.nitro = Math.max(0, G.nitro - dt * 0.2);
      G.effects.fire(c.pos.x - (Math.sin(c.heading) * c.model.len) / 2, 0.6, c.pos.z - (Math.cos(c.heading) * c.model.len) / 2);
    }
    if (c.lastCrash > 12) {
      G.audio.crash();
      G.shake = Math.min(1, c.lastCrash / 30);
    }
    if (c.drift) G.effects.smoke(c.pos.x - Math.sin(c.heading) * 1.8, 0.3, c.pos.z - Math.cos(c.heading) * 1.8);
    // the camera swings back behind the car whenever the mouse is idle
    if (!input.dx) this.yaw += angleDiff(this.yaw, c.heading) * Math.min(1, dt * 2.2);
    this.body.pos.copy(c.pos);
  }

  toggleCar(G) {
    if (this.car) {
      const c = this.car;
      if (Math.abs(c.speed) > 6) return;
      c.driver = null;
      c.speed = 0;
      this.car = null;
      const off = c.model.wid / 2 + 0.8;
      this.body.pos.set(c.pos.x + Math.cos(c.heading) * off, 0, c.pos.z - Math.sin(c.heading) * off);
      this.body.group.visible = true;
      G.hud.feed('Out of the ' + c.model.name);
      return;
    }
    let best = null, bestD = 5.5;
    for (const c of G.allCars()) {
      if (c.dead) continue;
      const d = Math.hypot(c.pos.x - this.body.pos.x, c.pos.z - this.body.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return;
    if (best.driver === 'ai' || best.driver === 'cop') G.onCarjack(best);
    best.driver = 'player';
    best.ai = null;
    best.keep = true;
    this.car = best;
    this.body.group.visible = false;
    G.hud.carName(best.model.name);
  }

  // Third-person camera: over the shoulder on foot, further back and lower in a car, wider with speed.
  updateCamera(camera, dt, shake) {
    const inCar = !!this.car;
    const dist = inCar ? 9.5 + Math.min(4, Math.abs(this.car.speed) / 12) : 5.2;
    const height = inCar ? 3.2 : 2.3;
    const target = inCar ? this.car.pos : this.body.pos;
    const pitch = inCar ? this.pitch * 0.5 + 0.1 : this.pitch;
    const want = new THREE.Vector3(
      target.x - Math.sin(this.yaw) * dist * Math.cos(pitch),
      height + Math.sin(pitch) * dist,
      target.z - Math.cos(this.yaw) * dist * Math.cos(pitch),
    );
    if (!inCar) {
      want.x += Math.cos(this.yaw) * -0.9;
      want.z += Math.sin(this.yaw) * 0.9;
    }
    this.camPos.lerp(want, Math.min(1, dt * (inCar ? 6 : 10)));
    tmpLook.set(target.x + Math.sin(this.yaw) * 4, (inCar ? 1.4 : 1.6) + this.y, target.z + Math.cos(this.yaw) * 4);
    this.camLook.lerp(tmpLook, Math.min(1, dt * 10));
    camera.position.copy(this.camPos);
    if (shake > 0) camera.position.add(tmpShake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake));
    camera.lookAt(this.camLook);
    const fov = inCar ? 62 + Math.min(14, Math.abs(this.car.speed) / 3) : 60;
    if (Math.abs(camera.fov - fov) > 0.1) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
  }

  snapCamera(camera) {
    this.camPos.set(1e9, 0, 0);
    this.updateCamera(camera, 1, 0);
  }
}
