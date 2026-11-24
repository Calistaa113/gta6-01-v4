// Civilian traffic: cars that keep to the right-hand lane of the road grid and turn at junctions.
import { CITY, PALETTE } from './config.js';
import { roadX, roadZ } from './city.js';
import { Car } from './vehicles.js';

// Travel directions in grid steps (di along x, dj along z); index 0 means +z.
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const LANE = 3.8;
const POOL = ['sedan', 'sedan', 'taxi', 'suv', 'van', 'cabrio', 'ardent', 'sedan', 'suv'];

/** Lane centre at junction (i, j) for a car travelling in `dir`: the right of forward (di, dj) is (-dj, di). */
export function nodePos(i, j, dir) {
  const [di, dj] = DIRS[dir];
  return { x: roadX(i) - dj * LANE, z: roadZ(j) + di * LANE };
}

const onGrid = (i, j) => i >= 0 && j >= 0 && i <= CITY.cols && j <= CITY.rows;

export class Traffic {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.target = 28;
  }

  spawnAt(i, j, dir, modelId) {
    const [di, dj] = DIRS[dir];
    const ni = i + di, nj = j + dj;
    if (!onGrid(ni, nj)) return null;
    const a = nodePos(i, j, dir), b = nodePos(ni, nj, dir);
    const t = 0.25 + this.rng.next() * 0.5;
    const car = new Car(this.scene, modelId || this.rng.pick(POOL), this.rng.pick(PALETTE.carColors), a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, Math.atan2(di, dj));
    car.driver = 'ai';
    car.ai = { i: ni, j: nj, dir, cruise: 10 + this.rng.next() * 5 };
    this.cars.push(car);
    return car;
  }

  randomSpawnNear(px, pz, minD, maxD) {
    for (let tries = 0; tries < 20; tries++) {
      const i = this.rng.int(0, CITY.cols), j = this.rng.int(0, CITY.rows);
      const d = Math.hypot(roadX(i) - px, roadZ(j) - pz);
      if (d < minD || d > maxD) continue;
      return this.spawnAt(i, j, this.rng.int(0, 3));
    }
    return null;
  }

  // At a junction, pick any way on except straight back (unless it is a dead end).
  chooseNext(ai) {
    const back = (ai.dir + 2) % 4;
    const ways = [];
    for (let d = 0; d < 4; d++) {
      if (d === back) continue;
      if (onGrid(ai.i + DIRS[d][0], ai.j + DIRS[d][1])) ways.push(d);
    }
    const d = ways.length ? ways[Math.floor(this.rng.next() * ways.length)] : back;
    ai.dir = d;
    ai.i += DIRS[d][0];
    ai.j += DIRS[d][1];
  }

  update(dt, player, allCars) {
    const px = player.x, pz = player.z;
    for (const car of this.cars) {
      if (car.driver !== 'ai' || car.dead) continue;
      const ai = car.ai;
      const node = nodePos(ai.i, ai.j, ai.dir);
      if (Math.hypot(node.x - car.pos.x, node.z - car.pos.z) < 5) this.chooseNext(ai);
      const tgt = nodePos(ai.i, ai.j, ai.dir);
      // slow for anything ahead in the lane: other cars, or the player on foot
      let limit = ai.panic ? 22 : ai.cruise;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (const o of allCars) {
        if (o === car) continue;
        const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z, ahead = dx * fx + dz * fz;
        if (ahead > 0 && ahead < 13 && Math.abs(dx * fz - dz * fx) < 2.6) limit = Math.min(limit, (ahead - 6) * 1.2);
      }
      const pdx = px - car.pos.x, pdz = pz - car.pos.z, pa = pdx * fx + pdz * fz;
      if (!player.inCar && pa > 0 && pa < 9 && Math.abs(pdx * fz - pdz * fx) < 2 && !ai.panic) limit = 0;
      car.steerToward(tgt.x, tgt.z, dt, Math.max(0, limit), this.world, limit <= 0.5);
    }
    // keep a living ring of traffic around the player
    for (const car of this.cars) {
      if (car.driver === 'player' || car.keep) continue;
      if (Math.hypot(car.pos.x - px, car.pos.z - pz) > 300) car.remove();
    }
    this.cars = this.cars.filter((c) => !c.removed);
    let n = this.cars.filter((c) => c.driver === 'ai').length;
    for (let guard = 0; n < this.target && guard < 4; guard++) {
      if (this.randomSpawnNear(px, pz, 90, 240)) n++;
    }
  }
}
