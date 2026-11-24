// The story of Golden Hour: eight missions for Teo Bravo against the Coralinos and Commissioner Kroll.
import { CITY } from './config.js';
import { roadX, roadZ } from './city.js';
import { Car } from './vehicles.js';
import { Human } from './people.js';
import { makeGlowTexture } from './textures.js';
const THREE = window.THREE;

const node = (i, j, dx = 0, dz = 0) => ({ x: roadX(i) + dx, z: roadZ(j) + dz });

export function storyMissions(pois) {
  const beach = CITY.rows;
  return [
    {
      id: 'homecoming', title: 'HOMECOMING', giver: 'Teo', start: pois.safehouse, reward: 500, respect: 1,
      intro: [['Teo', 'Ness Calderon. Three years and not even a postcard.'], ['Ness', 'The postcard was me coming back alive, Teo.'], ['Teo', 'Then come back to the garage. Bravo Motors, Casco Viejo. Drive something nice.']],
      steps: [{ type: 'enterCar', text: 'Get a car' }, { type: 'goto', at: pois.garage, text: 'Drive to Bravo Motors', inCar: true }],
      outro: [['Teo', 'Still drive like the road owes you money. Good. I have work.']],
    },
    {
      id: 'borrowed', title: 'BORROWED WHEELS', giver: 'Teo', start: pois.garage, reward: 1500, respect: 1,
      intro: [['Teo', 'Silvio Marr parks his Ardent GT outside Club Coral every night like he owns the Strip.'], ['Ness', 'Maybe tonight he walks.']],
      steps: [
        { type: 'steal', model: 'ardent', color: 0xffc21a, at: node(6, 6, 0, -14), heading: Math.PI, text: "Steal Marr's gold Ardent GT" },
        { type: 'goto', at: pois.garage, text: 'Bring the Ardent to Bravo Motors', inCar: 'target' },
      ],
      outro: [['Teo', 'Gold paint. Of course. We strip it by morning.']],
    },
    {
      id: 'collection', title: 'BEACHFRONT COLLECTION', giver: 'Teo', start: pois.garage, reward: 2000, respect: 1,
      intro: [['Teo', 'Three shops on the Strip pay me to keep the Coralinos out. They stopped paying.'], ['Ness', 'I will remind them, nicely.']],
      steps: [
        { type: 'goto', at: node(2, beach, 0, -9), text: 'Collect from Tacos 24H' },
        { type: 'goto', at: node(5, beach, 0, -9), text: 'Collect from Luna Bar' },
        { type: 'goto', at: node(7, beach, 0, -9), text: 'Collect from Surf Shop' },
        { type: 'goto', at: pois.garage, text: 'Bring the money to Teo' },
      ],
      outro: [['Teo', 'All of it? You did not even shoot anybody. I am almost disappointed.']],
    },
    {
      id: 'neonrun', title: 'NEON RUN', giver: 'Lupe', start: node(1, beach), reward: 2500, respect: 1,
      intro: [['Lupe', "You are Teo's driver? Prove it. Sunset race down the Strip, loser buys the drinks."], ['Ness', 'Hope you brought a wallet.']],
      steps: [{ type: 'race', time: 75, points: [node(3, beach), node(5, beach), node(8, beach), node(8, 4), node(5, 4), node(5, 2), node(2, 2), node(1, 5)], text: 'Win the race on the Neon Strip' }],
      outro: [['Lupe', 'Fine. You can drive. Teo was right about you.']],
    },
    {
      id: 'dockrats', title: 'DOCK RATS', giver: 'Teo', start: pois.garage, reward: 3500, respect: 2,
      intro: [['Teo', 'The Coralinos run product through Port Varela in teal vans. Marr keeps three on the quay.'], ['Ness', 'Keeps. Present tense.']],
      steps: [{ type: 'destroy', count: 3, at: node(9, 2, 18, 0), text: 'Destroy the Coralino vans at Port Varela' }],
      outro: [['Teo', 'Half the port heard that. Marr will know your name now.']],
    },
    {
      id: 'heatwave', title: 'HEAT WAVE', giver: 'Lupe', start: node(4, 3), reward: 3000, respect: 1,
      intro: [["Lupe", "Kroll's cops are sitting on the warehouse. Pull every unit downtown and lose them."], ['Ness', 'Making friends everywhere.']],
      steps: [{ type: 'wanted', level: 3, text: 'Get a 3-star wanted level' }, { type: 'lose', text: 'Lose the VMPD' }],
      outro: [['Lupe', 'The warehouse is empty. Whatever Kroll hid there is ours now.']],
    },
    {
      id: 'ledger', title: 'THE KROLL LEDGER', giver: 'Teo', start: pois.garage, reward: 5000, respect: 2,
      intro: [['Teo', "A courier is moving Commissioner Kroll's ledger. Every payoff on the coast is in it."], ['Ness', 'Then the courier is having a bad day.']],
      steps: [
        { type: 'chase', model: 'suv', color: 0x222222, at: node(6, 1), text: "Stop the courier's black Toro SUV" },
        { type: 'goto', at: null, fromTarget: true, text: 'Grab the ledger from the wreck' },
      ],
      outro: [['Ness', 'Names, dates, amounts. Kroll and Marr on the same page.']],
    },
    {
      id: 'lastlight', title: 'LAST LIGHT', giver: 'Teo', start: pois.safehouse, reward: 10000, respect: 3,
      intro: [['Teo', 'A reporter waits at the end of Pier 9. Get the ledger there and Kroll is finished.'], ['Ness', 'And every cop he owns will be between me and the pier.']],
      steps: [{ type: 'survive', level: 4, at: pois.pier, text: 'Get the ledger to the end of Pier 9' }],
      outro: [['Ness', "Sun's going down on Kroll. Vistamar is ours."]],
    },
  ];
}

export class Missions {
  constructor(G) {
    this.G = G;
    this.list = storyMissions(G.world.pois);
    this.index = 0; // next story mission
    this.active = null;
    this.step = 0;
    this.subs = [];
    this.subTime = 0;
    this.timer = 0;
    this.cool = 0;
    this.targets = [];
    this.gang = [];
    this.raceIdx = 0;
    this.lastWreck = null;
    const glow = makeGlowTexture();
    this.marker = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 3, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.markerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc23a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.markerGlow.scale.set(5, 5, 1);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd65a }));
    this.arrow.rotation.x = Math.PI;
    G.scene.add(this.marker, this.markerGlow, this.arrow);
  }

  get current() { return this.active ? this.active.steps[this.step] : null; }

  // Where the yellow marker and minimap blip should point right now.
  objectivePoint() {
    if (!this.active) return this.index < this.list.length ? this.list[this.index].start : null;
    const s = this.current;
    if (!s) return null;
    if (s.type === 'race') return s.points[this.raceIdx];
    if (s.type === 'steal' || s.type === 'chase') return this.targets[0] ? this.targets[0].pos : s.at;
    if (s.type === 'destroy') {
      const t = this.targets.find((c) => !c.dead);
      return t ? t.pos : null;
    }
    if (s.type === 'lose' || s.type === 'wanted' || s.type === 'enterCar') return null;
    return s.at;
  }

  say(lines) {
    this.subs = lines.map(([who, text]) => ({ who, text }));
    this.subTime = 0;
  }

  begin(i) {
    const m = this.list[i];
    this.active = m;
    this.step = 0;
    this.raceIdx = 0;
    this.G.hud.banner(m.title, 'Mission ' + (i + 1) + ' of ' + this.list.length);
    this.say(m.intro);
    this.enterStep();
  }

  spawnTarget(s) {
    const G = this.G;
    const car = new Car(G.scene, s.model, s.color, s.at.x, s.at.z, s.heading ?? 0);
    car.keep = true;
    car.mission = true;
    if (s.type === 'chase') {
      car.driver = 'ai';
      car.ai = { i: 6, j: 1, dir: 1, cruise: 20, panic: true };
      car.health = 160;
    }
    G.traffic.cars.push(car);
    return car;
  }

  enterStep() {
    const G = this.G, s = this.current;
    // only a car being delivered survives into the next step
    if (!(s && s.type === 'goto' && s.inCar === 'target')) this.targets = [];
    if (!s) { this.complete(); return; }
    if (s.type === 'steal' || s.type === 'chase') this.targets = [this.spawnTarget(s)];
    if (s.type === 'destroy') {
      this.targets = [];
      this.gang = [];
      for (let k = 0; k < s.count; k++) {
        const car = new Car(G.scene, 'van', 0x13a89e, s.at.x + (k - 1) * 9, s.at.z + k * 14, Math.PI / 2);
        car.keep = true;
        car.mission = true;
        G.traffic.cars.push(car);
        this.targets.push(car);
        for (let g = 0; g < 2; g++) {
          const h = new Human(G.scene, G.rng, 'gang', car.pos.x + (g ? 3 : -3), car.pos.z + 3);
          h.shootCool = 1 + G.rng.next() * 2;
          this.gang.push(h);
        }
      }
    }
    if (s.type === 'race') {
      this.timer = s.time;
      this.raceIdx = 0;
    }
    if (s.type === 'survive') G.police.setLevel(s.level, 'the ledger');
    if (s.type === 'goto' && s.fromTarget && this.lastWreck) s.at = { x: this.lastWreck.x, z: this.lastWreck.z };
    G.hud.objective(this.active.title, s.text);
    G.audio.blip(990, 0.1);
  }

  next() {
    this.step++;
    this.enterStep();
  }

  complete() {
    const G = this.G, m = this.active;
    G.money += m.reward;
    G.addRespect(m.respect);
    G.hud.banner('MISSION PASSED', '+$' + m.reward.toLocaleString() + '   RESPECT +' + m.respect);
    G.audio.missionPassed();
    this.say(m.outro);
    for (const t of this.targets) t.keep = false;
    for (const h of this.gang) h.remove();
    this.targets = [];
    this.gang = [];
    this.active = null;
    this.index++;
    this.cool = 8;
    G.hud.objective('', this.index < this.list.length ? 'Next: meet ' + this.list[this.index].giver + ' (yellow marker)' : 'Vistamar is yours. Free roam.');
    G.save();
  }

  fail(why) {
    const G = this.G;
    G.hud.banner('MISSION FAILED', why);
    G.hud.timer(null);
    G.audio.missionFailed();
    for (const t of this.targets) { t.keep = false; t.mission = false; }
    for (const h of this.gang) h.remove();
    this.targets = [];
    this.gang = [];
    this.active = null;
    this.cool = 4;
    G.hud.objective('', 'Try again: return to the yellow marker');
  }

  near(p, at, r = 4.5) { return at && Math.hypot(p.x - at.x, p.z - at.z) < r; }

  updateMarker() {
    const G = this.G, point = this.objectivePoint();
    this.marker.visible = this.markerGlow.visible = this.arrow.visible = !!point;
    if (!point) return;
    const isRace = this.current?.type === 'race';
    this.marker.position.set(point.x, 1.5, point.z);
    this.marker.scale.setScalar(isRace ? 3 : 1);
    this.marker.material.opacity = 0.35 + Math.sin(G.time * 4) * 0.1;
    this.markerGlow.position.set(point.x, 0.4, point.z);
    this.arrow.position.set(point.x, 6 + Math.sin(G.time * 3) * 0.6, point.z);
    this.arrow.rotation.y = G.time * 2;
  }

  updateGang(dt) {
    const G = this.G, p = G.player;
    for (const h of this.gang) {
      if (h.dead || h.removed) { h.sync(); continue; }
      const d = Math.hypot(h.pos.x - p.x, h.pos.z - p.z);
      h.heading = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
      h.aiming = d < 40;
      h.shootCool -= dt;
      if (d < 40 && h.shootCool <= 0) {
        h.shootCool = 1.5 + G.rng.next();
        G.combat.npcShoot({ x: h.pos.x, z: h.pos.z, y: 1.6 }, 0.3, 6);
      }
      h.animate(dt, 0);
      h.sync();
    }
  }

  update(dt) {
    const G = this.G, p = G.player;
    // subtitles: each line holds for a few seconds
    if (this.subs.length) {
      this.subTime += dt;
      const line = this.subs[0];
      G.hud.subtitle(line.who, line.text);
      if (this.subTime > 3.8) {
        this.subs.shift();
        this.subTime = 0;
        if (!this.subs.length) G.hud.subtitle('', '');
      }
    }
    this.updateMarker();
    if (!this.active) {
      this.cool = Math.max(0, this.cool - dt);
      if (this.cool <= 0 && this.index < this.list.length && this.near(p, this.list[this.index].start)) this.begin(this.index);
      return;
    }
    const s = this.current;
    if (!s) return;
    if (s.type === 'enterCar') {
      if (p.inCar) this.next();
    } else if (s.type === 'goto') {
      if (s.inCar === 'target' && this.targets[0]?.dead) { this.fail('The Ardent was destroyed'); return; }
      if (s.inCar === true && !p.inCar) G.hud.hint('Get a car');
      else if (s.inCar === 'target' && p.car !== this.targets[0]) G.hud.hint('Get back in the Ardent');
      else if (this.near(p, s.at, p.inCar ? 6 : 4)) this.next();
    } else if (s.type === 'steal') {
      if (this.targets[0]?.dead) { this.fail('The car was destroyed'); return; }
      if (p.car === this.targets[0]) {
        const car = p.car;
        this.next();
        this.targets = [car];
      }
    } else if (s.type === 'race') {
      this.timer -= dt;
      G.hud.timer(this.timer);
      if (this.near(p, s.points[this.raceIdx], 10)) {
        this.raceIdx++;
        G.audio.blip(1200, 0.08);
        if (this.raceIdx >= s.points.length) { G.hud.timer(null); this.next(); return; }
      }
      if (this.timer <= 0) this.fail('Too slow');
    } else if (s.type === 'destroy') {
      this.updateGang(dt);
      const left = this.targets.filter((c) => !c.dead).length;
      G.hud.objective(this.active.title, s.text + ' (' + (s.count - left) + '/' + s.count + ')');
      if (!left) this.next();
    } else if (s.type === 'wanted') {
      if (G.police.level >= s.level) this.next();
    } else if (s.type === 'lose') {
      if (G.police.level === 0) this.next();
    } else if (s.type === 'chase') {
      const t = this.targets[0];
      if (t && (t.dead || t.health < 25)) {
        this.lastWreck = { x: t.pos.x, z: t.pos.z };
        t.driver = null;
        t.speed = 0;
        this.next();
      } else if (t && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) > 260) {
        this.fail('The courier got away');
      }
    } else if (s.type === 'survive') {
      if (G.police.level < 2) G.police.setLevel(s.level, 'the ledger');
      if (this.near(p, s.at, 7)) this.next();
    }
  }
}
