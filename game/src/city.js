// The city of Vistamar: road grid, districts, buildings, beach, Pier 9, Port Varela and street props.
import { CITY, PALETTE, DISTRICTS } from './config.js';
import { makeFacadeTextures, makeRoadTexture, makeCrossingTexture, makeSignTexture, makeGlowTexture, mergeGeometries, tint } from './textures.js';
const THREE = window.THREE;

export const roadX = (i) => CITY.x0 + i * CITY.pitch + CITY.road / 2;
export const roadZ = (j) => CITY.z0 + j * CITY.pitch + CITY.road / 2;
export const blockMin = (c, r) => ({ x: CITY.x0 + c * CITY.pitch + CITY.road, z: CITY.z0 + r * CITY.pitch + CITY.road });

export function districtOf(c, r) {
  return DISTRICTS.find((d) => d.test(c, r));
}

export function districtAt(x, z) {
  if (z > roadZ(CITY.rows) + CITY.road / 2) return { id: 'beach', name: 'PLAYA DORADA' };
  const c = Math.max(0, Math.min(CITY.cols - 1, Math.floor((x - CITY.x0) / CITY.pitch)));
  const r = Math.max(0, Math.min(CITY.rows - 1, Math.floor((z - CITY.z0) / CITY.pitch)));
  return districtOf(c, r);
}

const SIGNS = ['MOTEL ALBA', 'CLUB CORAL', 'TACOS 24H', 'LUNA BAR', 'HOTEL MIRAGE', 'DISCO PALMA', 'CASINO SOL', 'ARCADE', 'SURF SHOP', 'BAR TROPIC'];
const PARKS = new Set(['4,4', '1,5', '6,1']);

function flatPlane(w, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const grid = new Map();
  const cellOf = (x, z) => [Math.floor((x - CITY.x0) / CITY.pitch), Math.floor((z - CITY.z0) / CITY.pitch)];
  const addCollider = (minX, maxX, minZ, maxZ, tag = 'building') => {
    const b = { minX, maxX, minZ, maxZ, tag };
    colliders.push(b);
    const [c0, r0] = cellOf(minX, minZ);
    const [c1, r1] = cellOf(maxX, maxZ);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const k = c + ',' + r;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(b);
      }
    }
  };

  // Ground, asphalt base, beach sand and a ring of far hills.
  scene.add(flatPlane(3000, 3000, new THREE.MeshStandardMaterial({ color: 0x6d7a55, roughness: 1 }), 0, -0.05, 0));
  scene.add(flatPlane(CITY.width + 40, CITY.depth + 40, new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 }), 0, 0, 0));
  const beachZ0 = CITY.z0 + CITY.depth;
  scene.add(flatPlane(3000, CITY.beachDepth + 60, new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }), 0, 0.01, beachZ0 + (CITY.beachDepth + 60) / 2 - 2));
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f6a8a, roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.05 + (i / 26) * 0.9);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rng.range(90, 180), rng.range(60, 150), 7), hillMat);
    hill.position.set(Math.cos(a) * 820, 0, Math.sin(a) * 620 - 80);
    scene.add(hill);
  }

  // Roads: long textured strips, with zebra crossings at every junction.
  const roadTex = makeRoadTexture();
  const texH = roadTex.clone();
  texH.needsUpdate = true;
  roadTex.repeat.set(1, CITY.depth / 32);
  texH.repeat.set(1, CITY.width / 32);
  const roadMatV = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
  const roadMatH = new THREE.MeshStandardMaterial({ map: texH, roughness: 0.85 });
  for (let i = 0; i <= CITY.cols; i++) scene.add(flatPlane(CITY.road, CITY.depth, roadMatV, roadX(i), 0.02, 0));
  for (let j = 0; j <= CITY.rows; j++) {
    const m = flatPlane(CITY.road, CITY.width, roadMatH, 0, 0.025, roadZ(j));
    m.rotation.z = Math.PI / 2;
    scene.add(m);
  }
  const crossMat = new THREE.MeshStandardMaterial({ map: makeCrossingTexture(), roughness: 0.85 });
  for (let i = 0; i <= CITY.cols; i++) {
    for (let j = 0; j <= CITY.rows; j++) scene.add(flatPlane(CITY.road, CITY.road, crossMat, roadX(i), 0.03, roadZ(j)));
  }

  // Buildings by district style, merged per material so the whole skyline is a few draw calls.
  const towerTex = makeFacadeTextures(rng, 'tower');
  const lowTex = makeFacadeTextures(rng, 'low');
  const towerParts = [], lowParts = [], plainParts = [], walkParts = [], grassParts = [];
  const palms = [], lamps = [], signs = [];

  // A box standing on y, uv-tiled so facade windows keep their size whatever the wall size.
  const box = (w, h, d, x, y, z, color, tileW, tileH) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    if (tileW) {
      const spans = [d, d, 0, 0, w, w];
      for (let f = 0; f < 6; f++) {
        for (let k = 0; k < 4; k++) {
          const idx = f * 4 + k;
          if (spans[f] === 0) { uv.setXY(idx, 0.02, 0.98); continue; }
          uv.setXY(idx, uv.getX(idx) * Math.max(1, Math.round(spans[f] / tileW)), uv.getY(idx) * Math.max(1, Math.round(h / tileH)));
        }
      }
    }
    g.translate(x, y + h / 2, z);
    return tint(g, color);
  };

  const B = CITY.block, S = CITY.sidewalk;
  for (let c = 0; c < CITY.cols; c++) {
    for (let r = 0; r < CITY.rows; r++) {
      const d = districtOf(c, r);
      const b = blockMin(c, r);
      walkParts.push(box(B, 0.22, B, b.x + B / 2, 0, b.z + B / 2, PALETTE.sidewalk));
      if (PARKS.has(c + ',' + r)) {
        grassParts.push(box(B - 2 * S, 0.3, B - 2 * S, b.x + B / 2, 0.01, b.z + B / 2, PALETTE.grass));
        for (let k = 0; k < 9; k++) palms.push([b.x + S + 6 + rng.range(0, B - 2 * S - 12), b.z + S + 6 + rng.range(0, B - 2 * S - 12)]);
        plainParts.push(box(8, 1.2, 8, b.x + B / 2, 0.2, b.z + B / 2, 0xe9dccb));   // fountain basin
        plainParts.push(box(2, 4, 2, b.x + B / 2, 1.2, b.z + B / 2, 0xf4ead8));
        continue;
      }
      const inner = B - 2 * S;
      const lotsX = d.id === 'heights' ? 3 : 2;
      const lotsZ = d.id === 'port' ? 1 : 2;
      const lw = inner / lotsX, ld = inner / lotsZ;
      for (let lx = 0; lx < lotsX; lx++) {
        for (let lz = 0; lz < lotsZ; lz++) {
          const gap = d.id === 'heights' ? 5 : 1.5;
          const w = lw - gap, dd = ld - gap;
          const cx = b.x + S + lw * lx + lw / 2, cz = b.z + S + ld * lz + ld / 2;
          const color = rng.pick(PALETTE.buildings);
          let h;
          if (d.id === 'downtown') {
            h = rng.range(45, 120) * (r <= 1 ? 1.15 : 0.9);
            towerParts.push(box(w, h, dd, cx, 0.2, cz, rng.pick([0xcfe0ee, 0xb6c8e6, 0xe9d6c8, 0xd8e8e0]), 24, 28));
            plainParts.push(box(w * 0.6, 4, dd * 0.6, cx, 0.2 + h, cz, 0xd0c8c0));
            if (rng.chance(0.5)) plainParts.push(box(1, 14, 1, cx, 4.2 + h, cz, 0xeeeeee));   // antenna
          } else if (d.id === 'heights') {
            h = rng.range(6, 11);
            lowParts.push(box(w, h, dd, cx, 0.2, cz, rng.pick([0xffd3c4, 0xc3efe6, 0xfff0c9, 0xf6c6e0, 0xd2e4ff]), 12, 12));
            plainParts.push(box(w + 1, 0.8, dd + 1, cx, 0.2 + h, cz, 0xb3593e));             // terracotta roof
            if (rng.chance(0.6)) palms.push([cx + w / 2 + 1.5, cz + dd / 2 + 1.5]);
          } else if (d.id === 'port') {
            h = rng.range(9, 15);
            plainParts.push(box(w, h, dd, cx, 0.2, cz, rng.pick([0x9aa7b4, 0xb59b7e, 0x7f8f9c, 0xc7b8a0])));
            plainParts.push(box(w + 0.5, 0.6, dd + 0.5, cx, 0.2 + h, cz, 0x5c6670));
          } else if (d.id === 'strip') {
            h = rng.range(14, 34);
            lowParts.push(box(w, h, dd, cx, 0.2, cz, color, 12, 12));
            plainParts.push(box(w + 0.6, 1, dd + 0.6, cx, 0.2 + h, cz, 0xffffff));
            if (lz === 1) signs.push({ x: cx, z: cz + dd / 2 + 0.3, y: Math.min(h - 3, 9 + rng.range(0, 5)), text: rng.pick(SIGNS), color: rng.pick(PALETTE.neon), w: Math.min(w * 0.9, 16) });
          } else {
            h = rng.range(12, 30);
            lowParts.push(box(w, h, dd, cx, 0.2, cz, color, 12, 12));
            plainParts.push(box(w + 0.4, 0.8, dd + 0.4, cx, 0.2 + h, cz, 0xeee4d8));
            if (rng.chance(0.4)) plainParts.push(box(3, 2.5, 3, cx + rng.range(-w / 4, w / 4), 1 + h, cz + rng.range(-dd / 4, dd / 4), 0x9aa0a8));
            if (rng.chance(0.25)) signs.push({ x: cx, z: cz + dd / 2 + 0.3, y: 7, text: rng.pick(SIGNS), color: rng.pick(PALETTE.neon), w: Math.min(w * 0.8, 12) });
          }
          addCollider(cx - w / 2, cx + w / 2, cz - dd / 2, cz + dd / 2);
        }
      }
      lamps.push([b.x + 4, b.z + B - 1.2], [b.x + B - 4, b.z + B - 1.2]);
    }
  }

  const vc = { vertexColors: true };
  const towerMat = new THREE.MeshStandardMaterial({ ...vc, map: towerTex.map, emissiveMap: towerTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.35 });
  const lowMat = new THREE.MeshStandardMaterial({ ...vc, map: lowTex.map, emissiveMap: lowTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.8 });
  const plainMat = new THREE.MeshStandardMaterial({ ...vc, roughness: 0.85 });
  const addMerged = (parts, mat, shadow = true) => {
    if (!parts.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  addMerged(towerParts, towerMat);
  addMerged(lowParts, lowMat);
  addMerged(plainParts, plainMat);
  addMerged(walkParts, plainMat, false);
  addMerged(grassParts, plainMat, false);

  // Port Varela: stacked shipping containers and two gantry cranes on the east quay.
  const portParts = [];
  const quayX = roadX(CITY.cols) + CITY.road / 2;
  for (let k = 0; k < 40; k++) {
    const x = quayX + 8 + (k % 4) * 7, z = CITY.z0 + 30 + Math.floor(k / 4) * 16;
    const stack = rng.int(1, 3);
    for (let s = 0; s < stack; s++) portParts.push(box(6, 2.6, 12.5, x, s * 2.6, z, rng.pick([0xc0392b, 0x2471a3, 0xd68910, 0x1e8449, 0x7d3c98, 0xe5e7e9])));
    addCollider(x - 3, x + 3, z - 6.25, z + 6.25, 'container');
  }
  for (let k = 0; k < 2; k++) {
    const z = CITY.z0 + 90 + k * 170, x = quayX + 50;
    for (const dz of [-6, 6]) for (const dx of [-6, 6]) portParts.push(box(1.4, 38, 1.4, x + dx, 0, z + dz, 0xe6a23c));
    portParts.push(box(60, 3, 14, x + 12, 38, z, 0xe6a23c));
    portParts.push(box(8, 6, 8, x - 4, 32, z, 0x34495e));
  }
  addMerged(portParts, plainMat);

  // Pier 9 with the Rueda del Sol ferris wheel, out over the sea from the beach.
  const pierX = roadX(4) + CITY.pitch / 2, pierZ0 = beachZ0 + 6;
  const pierParts = [box(18, 1, 150, pierX, 0.6, pierZ0 + 75, 0x8a6a4a)];
  for (let k = 0; k < 15; k++) for (const dx of [-8, 8]) pierParts.push(box(0.8, 4, 0.8, pierX + dx, -3, pierZ0 + k * 10, 0x5a4535));
  for (let k = 0; k < 14; k++) for (const dx of [-8.6, 8.6]) pierParts.push(box(0.3, 1.2, 10, pierX + dx, 1.6, pierZ0 + 5 + k * 10, 0xf2e6d8));
  addMerged(pierParts, plainMat);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  wheel.add(spin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff6fb5, emissiveIntensity: 0.6, roughness: 0.4 });
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(22, 0.6, 8, 48), wheelMat));
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(15, 0.35, 6, 40), wheelMat));
  for (let k = 0; k < 16; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 44, 0.3), wheelMat);
    spoke.rotation.z = (k / 16) * Math.PI;
    spin.add(spoke);
    const col = PALETTE.neon[k % 5];
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 }));
    const a = (k / 16) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 22, Math.sin(a) * 22 - 1.6, 0);
    cab.userData.a = a;
    spin.add(cab);
  }
  wheel.position.set(pierX, 25, pierZ0 + 115);
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
  for (const dz of [-3, 3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 27, 6), legMat);
    leg.position.set(pierX, 13, pierZ0 + 115 + dz);
    scene.add(leg);
  }

  // Palms along the beach boulevard, in parks, in Palm Heights and scattered on the sand.
  for (let x = CITY.x0 + 10; x < CITY.x0 + CITY.width; x += 18) {
    palms.push([x, roadZ(CITY.rows) + CITY.road / 2 + 3]);
    palms.push([x + 9, roadZ(CITY.rows) - CITY.road / 2 - 1.6]);
  }
  for (let x = CITY.x0 - 60; x < CITY.x0 + CITY.width + 60; x += 26) palms.push([x + rng.range(-5, 5), beachZ0 + rng.range(18, 34)]);
  const trunkParts = [], leafParts = [];
  for (const [x, z] of palms) {
    const h = rng.range(9, 15), lean = rng.range(-0.15, 0.15);
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.CylinderGeometry(0.28 - s * 0.03, 0.34 - s * 0.03, h / 5, 6);
      seg.translate(x + lean * s * 2, s * (h / 5) + h / 10, z);
      trunkParts.push(tint(seg, s % 2 ? 0x8b6a4a : 0x7a5b3e));
    }
    const top = new THREE.Vector3(x + lean * 10, h, z);
    for (let k = 0; k < 8; k++) {
      const leaf = new THREE.ConeGeometry(0.9, 6.5, 4);
      leaf.scale(1, 1, 0.25);
      leaf.translate(0, 3.2, 0);
      leaf.rotateX(1.9);
      leaf.rotateY((k / 8) * Math.PI * 2 + rng.range(0, 0.4));
      leaf.translate(top.x, top.y, top.z);
      leafParts.push(tint(leaf, k % 2 ? 0x3f8f3a : 0x2f7a35));
    }
    addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 'palm');
  }
  addMerged(trunkParts, plainMat);
  addMerged(leafParts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));

  // Street lamps with glowing heads, then the neon signs.
  const lampParts = [];
  const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  for (const [x, z] of lamps) {
    lampParts.push(box(0.25, 7, 0.25, x, 0, z, 0x2c2c34));
    lampParts.push(box(0.25, 0.25, 2.2, x, 7, z + 1, 0x2c2c34));
    const g = new THREE.Sprite(glowMat);
    g.position.set(x, 6.8, z + 2);
    g.scale.set(4, 4, 1);
    scene.add(g);
  }
  addMerged(lampParts, plainMat, false);
  const signMeshes = [];
  for (const s of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w / 4), new THREE.MeshBasicMaterial({ map: makeSignTexture(s.text, s.color), toneMapped: false }));
    m.position.set(s.x, s.y, s.z);
    scene.add(m);
    signMeshes.push(m);
  }

  // Points of interest for missions, shops and saving, each on the curb of a named block.
  const curb = (c, r, side = 'south') => {
    const b = blockMin(c, r);
    if (side === 'south') return { x: b.x + B / 2, z: b.z + B + 4 };
    if (side === 'north') return { x: b.x + B / 2, z: b.z - 4 };
    if (side === 'east') return { x: b.x + B + 4, z: b.z + B / 2 };
    return { x: b.x - 4, z: b.z + B / 2 };
  };
  const pois = {
    garage: { ...curb(2, 4), name: 'BRAVO MOTORS', kind: 'garage' },
    guns: { ...curb(5, 2), name: 'CINDER ARMS', kind: 'guns' },
    spray: { ...curb(6, 4, 'east'), name: 'SUNSET SPRAY', kind: 'spray' },
    safehouse: { ...curb(3, 5), name: "NESS'S PLACE", kind: 'save' },
    hospital: { ...curb(1, 2, 'east'), name: 'SANTA BRISA MEDICAL', kind: 'hospital' },
    pier: { x: pierX, z: pierZ0 + 20, name: 'PIER 9', kind: 'landmark' },
  };
  const shopColor = { guns: 0xff4f4f, spray: 0xffd23f };
  for (const key of ['garage', 'guns', 'spray', 'safehouse']) {
    const p = pois[key];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: makeSignTexture(p.name, shopColor[key] ?? 0x22e4ff), toneMapped: false }));
    if (key === 'spray') {
      m.position.set(p.x - 4 - S - 0.5, 6, p.z);
      m.rotation.y = Math.PI / 2;
    } else {
      m.position.set(p.x, 6, p.z - 4 - S - 0.5);
    }
    scene.add(m);
  }

  function queryColliders(x, z) {
    const [c, r] = cellOf(x, z);
    const out = [];
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const list = grid.get((c + dc) + ',' + (r + dr));
        if (list) for (const b of list) out.push(b);
      }
    }
    return out;
  }

  // Push a circle out of any box it overlaps; returns the hit normal and tag, or null.
  function collideCircle(pos, radius) {
    let hit = null;
    for (const b of queryColliders(pos.x, pos.z)) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.001;
        let nx = dx / d, nz = dz / d;
        if (d2 === 0) { nx = 0; nz = 1; }
        pos.x = cx + nx * radius;
        pos.z = cz + nz * radius;
        hit = { nx, nz, tag: b.tag };
      }
    }
    pos.x = Math.max(-900, Math.min(900, pos.x));
    pos.z = Math.max(CITY.z0 - 60, Math.min(CITY.shoreZ + 10, pos.z));
    return hit;
  }

  // Does the segment a->b pass through a building? Police use it for line of sight.
  function blocked(ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const b of queryColliders(x, z)) {
        if (b.tag === 'building' && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
      }
    }
    return false;
  }

  return {
    colliders, pois, queryColliders, collideCircle, blocked, wheel, signMeshes, towerMat, lowMat,
    update(t) {
      spin.rotation.z = t * 0.05;
      for (const cab of spin.children) if (cab.userData.a !== undefined) cab.rotation.z = -t * 0.05;
      // neon flicker
      for (let i = 0; i < signMeshes.length; i++) signMeshes[i].material.color.setScalar(Math.sin(t * 3 + i * 7) > 0.97 ? 0.5 : 1);
    },
    setNight(v) {
      towerMat.emissiveIntensity = 0.55 + v * 0.9;
      lowMat.emissiveIntensity = 0.55 + v * 0.9;
    },
  };
}
