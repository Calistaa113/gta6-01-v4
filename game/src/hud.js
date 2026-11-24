// The heads-up display: money, wanted stars, weapon, objective, subtitles, speedometer and the rotating minimap.
import { CITY, RANKS } from './config.js';
import { roadX, roadZ, districtAt, blockMin, districtOf } from './city.js';

const $ = (id) => document.getElementById(id);
const DISTRICT_COLORS = { downtown: '#6c7894', heights: '#8a7a6a', port: '#6a6f75', strip: '#9a6f8a', oldtown: '#7f7468' };
const MAP_LABELS = [
  ['PALM HEIGHTS', CITY.x0 + 80, 0],
  ['DOWNTOWN SOLANA', 0, CITY.z0 + 120],
  ['PORT VARELA', -CITY.x0 - 60, -40],
  ['NEON STRIP', 0, CITY.z0 + CITY.depth - 50],
  ['CASCO VIEJO', -120, 60],
  ['PLAYA DORADA', 160, CITY.shoreZ - 18],
];

export class Hud {
  constructor() {
    this.el = $('hud');
    this.mini = $('hud-minimap').getContext('2d');
    this.feedItems = [];
    this.bannerTime = 0;
    this.radioTime = 0;
    this.hintTime = 0;
    this.lastStars = '';
    this.base = this.drawCityLayer(4);
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  // Pre-render the street map once; the minimap rotates and crops it every frame.
  drawCityLayer(scale) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(((CITY.width + 200) / scale) * 2);
    c.height = Math.ceil(((CITY.depth + 260) / scale) * 2);
    const g = c.getContext('2d'), k = 2 / scale;
    const ox = -CITY.x0 + 100, oz = -CITY.z0 + 100;
    g.fillStyle = '#2b3a2e';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#e3c595';
    g.fillRect(0, (CITY.z0 + CITY.depth + oz) * k, c.width, CITY.beachDepth * k);
    g.fillStyle = '#2a6f9a';
    g.fillRect(0, (CITY.shoreZ + oz) * k, c.width, c.height);
    for (let cc = 0; cc < CITY.cols; cc++) {
      for (let r = 0; r < CITY.rows; r++) {
        const b = blockMin(cc, r);
        g.fillStyle = DISTRICT_COLORS[districtOf(cc, r).id];
        g.fillRect((b.x + ox) * k, (b.z + oz) * k, CITY.block * k, CITY.block * k);
      }
    }
    g.fillStyle = '#d8d2c8';
    for (let i = 0; i <= CITY.cols; i++) g.fillRect((roadX(i) - CITY.road / 2 + ox) * k, (CITY.z0 + oz) * k, CITY.road * k, CITY.depth * k);
    for (let j = 0; j <= CITY.rows; j++) g.fillRect((CITY.x0 + ox) * k, (roadZ(j) - CITY.road / 2 + oz) * k, CITY.width * k, CITY.road * k);
    return { canvas: c, k, ox, oz };
  }

  // blips: [{x, z, color, size, shape}]; blips beyond the rim are pinned to the edge.
  minimap(px, pz, heading, blips, wantedFlash) {
    const g = this.mini, W = 220, R = W / 2, B = this.base, zoom = 1.25;
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(R, R, R, 0, Math.PI * 2);
    g.clip();
    g.translate(R, R);
    g.rotate(heading + Math.PI);
    g.scale(zoom, zoom);
    g.drawImage(B.canvas, -(px + B.ox) * B.k, -(pz + B.oz) * B.k);
    const rim = (R - 10) / zoom;
    for (const b of blips) {
      let x = (b.x - px) * B.k, z = (b.z - pz) * B.k;
      const len = Math.hypot(x, z);
      if (len > rim && b.pin) { x *= rim / len; z *= rim / len; }
      g.fillStyle = b.color;
      g.beginPath();
      if (b.shape === 'square') g.rect(x - b.size, z - b.size, b.size * 2, b.size * 2);
      else g.arc(x, z, b.size, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#000';
      g.lineWidth = 1;
      g.stroke();
    }
    g.restore();
    // the rim pulses red and blue while the police are hunting
    if (wantedFlash) {
      g.strokeStyle = Math.floor(performance.now() / 250) % 2 ? 'rgba(255,40,70,.9)' : 'rgba(60,110,255,.9)';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(R, R, R - 5, 0, Math.PI * 2);
      g.stroke();
    }
    // the player arrow always points up
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(R, R - 9);
    g.lineTo(R + 7, R + 7);
    g.lineTo(R, R + 3);
    g.lineTo(R - 7, R + 7);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', R + Math.sin(heading + Math.PI) * 96, R - Math.cos(heading + Math.PI) * 96 + 5);
  }

  update(G, dt) {
    const p = G.player;
    $('hud-money').textContent = '$' + Math.floor(G.money).toLocaleString();
    const lvl = G.police.level;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += '<span class="star' + (i < lvl ? ' on' : '') + '">&#9733;</span>';
    const w = $('hud-wanted');
    if (stars !== this.lastStars) { w.innerHTML = stars; this.lastStars = stars; }
    w.classList.toggle('flash', G.police.flashing);
    const wp = G.combat.weapon();
    $('hud-weapon-name').textContent = wp.name;
    $('hud-ammo').textContent = wp.id === 'fists' ? '' : p.ammo[wp.id];
    $('hud-respect-rank').textContent = RANKS[Math.min(RANKS.length - 1, Math.floor(G.respect / 3))];
    $('hud-health').style.width = Math.max(0, p.health) + '%';
    $('hud-armor').style.width = Math.max(0, p.armor) + '%';
    $('hud-district').textContent = districtAt(p.x, p.z).name;
    $('hud-crosshair').style.display = p.inCar ? 'none' : 'block';
    $('hud-speed').classList.toggle('hidden', !p.inCar);
    if (p.inCar) {
      $('hud-speed-num').textContent = Math.round(Math.abs(p.car.speed) * 3.6);
      $('hud-car-hp').style.width = (p.car.health / p.car.maxHealth) * 100 + '%';
      $('hud-nitro').style.width = Math.max(0, G.nitro) * 100 + '%';
    }
    this.bannerTime -= dt;
    if (this.bannerTime <= 0) $('hud-banner').classList.remove('show');
    this.radioTime -= dt;
    if (this.radioTime <= 0) $('hud-radio').classList.remove('show');
    this.hintTime -= dt;
    if (this.hintTime <= 0) $('hud-hint').textContent = '';
    for (const f of this.feedItems) f.t -= dt;
    this.feedItems = this.feedItems.filter((f) => {
      if (f.t <= 0) f.el.remove();
      return f.t > 0;
    });
  }

  objective(title, text) {
    $('hud-mission-title').textContent = title;
    $('hud-mission-text').textContent = text;
  }
  subtitle(who, text) { $('hud-subtitle').innerHTML = who ? '<b>' + who + ':</b> ' + text : ''; }
  timer(t) { $('hud-timer').textContent = t === null ? '' : Math.max(0, t).toFixed(1); }
  banner(big, small, time = 4) {
    $('hud-banner-big').textContent = big;
    $('hud-banner-small').textContent = small;
    $('hud-banner').classList.add('show');
    this.bannerTime = time;
  }
  radio(name) {
    $('hud-radio').textContent = name;
    $('hud-radio').classList.add('show');
    this.radioTime = 2.5;
  }
  hint(text, t = 2) {
    $('hud-hint').textContent = text;
    this.hintTime = t;
  }
  carName(name) { $('hud-car-name').textContent = name; }
  feed(text) {
    const el = document.createElement('div');
    el.textContent = text;
    $('hud-feed').prepend(el);
    this.feedItems.push({ el, t: 5 });
    if (this.feedItems.length > 4) this.feedItems.shift().el.remove();
  }

  // Full city map for the pause menu: districts, landmarks, the player and the next objective.
  drawMap(canvas, G, legend) {
    const g = canvas.getContext('2d'), B = this.base;
    g.fillStyle = '#16202c';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(canvas.width / B.canvas.width, canvas.height / B.canvas.height);
    const ox = (canvas.width - B.canvas.width * s) / 2, oy = (canvas.height - B.canvas.height * s) / 2;
    g.drawImage(B.canvas, ox, oy, B.canvas.width * s, B.canvas.height * s);
    const toMap = (x, z) => [ox + (x + B.ox) * B.k * s, oy + (z + B.oz) * B.k * s];
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    for (const [name, x, z] of MAP_LABELS) {
      const [mx, my] = toMap(x, z);
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillText(name, mx + 1, my + 1);
      g.fillStyle = '#ffe8c8';
      g.fillText(name, mx, my);
    }
    for (const poi of Object.values(G.world.pois)) {
      const [mx, my] = toMap(poi.x, poi.z);
      g.fillStyle = '#22e4ff';
      g.fillRect(mx - 5, my - 5, 10, 10);
      g.fillStyle = '#fff';
      g.fillText(poi.name, mx, my - 9);
    }
    const obj = G.missions.objectivePoint();
    if (obj) {
      const [mx, my] = toMap(obj.x, obj.z);
      g.fillStyle = '#ffc23a';
      g.beginPath();
      g.arc(mx, my, 8, 0, Math.PI * 2);
      g.fill();
    }
    const [px, py] = toMap(G.player.x, G.player.z);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(px, py, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#000';
    g.stroke();
    legend.innerHTML = '<span style="color:#fff">&#9679; You</span> &nbsp; <span style="color:#ffc23a">&#9679; Objective</span> &nbsp; <span style="color:#22e4ff">&#9632; Garage, shops, safehouse</span>';
  }
}
