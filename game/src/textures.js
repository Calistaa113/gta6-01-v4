// Procedural textures (facades, roads, neon signs, glows) and a geometry merger that turns
// thousands of small boxes into one draw call per material.
const THREE = window.THREE;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(tex, aniso = 4) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = aniso;
  return tex;
}

// Facade: rows of windows on a white wall (tinted by vertex colour); lit windows glow through
// the emissive map at dusk.
export function makeFacadeTextures(rng, style) {
  const tower = style === 'tower';
  const [c, g] = canvas(256, 256);
  const [e, ge] = canvas(256, 256);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000000';
  ge.fillRect(0, 0, 256, 256);
  const cols = tower ? 8 : 4;
  const rows = tower ? 8 : 4;
  const cw = 256 / cols;
  const rh = 256 / rows;
  for (let y = 0; y < rows; y++) {
    if (!tower) {
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, y * rh + rh - 6, 256, 6);
    }
    for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.18;
      const py = y * rh + rh * 0.2;
      const pw = cw * 0.64;
      const ph = rh * 0.55;
      const grad = g.createLinearGradient(px, py, px, py + ph);
      grad.addColorStop(0, tower ? '#4a6f95' : '#5d7891');
      grad.addColorStop(1, tower ? '#1c2c44' : '#26323f');
      g.fillStyle = grad;
      g.fillRect(px, py, pw, ph);
      if (!tower) {
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(px - 2, py + ph, pw + 4, 3);
      }
      if (rng.chance(tower ? 0.35 : 0.28)) {
        const warm = rng.chance(0.75);
        ge.fillStyle = warm ? `rgb(255,${180 + rng.int(0, 50)},${100 + rng.int(0, 40)})` : 'rgb(160,220,255)';
        ge.fillRect(px, py, pw, ph);
        g.fillStyle = warm ? '#ffd9a0' : '#bfe6ff';
        g.fillRect(px, py, pw, ph);
      }
    }
  }
  return { map: finish(new THREE.CanvasTexture(c)), emissive: finish(new THREE.CanvasTexture(e)) };
}

// Road surface: speckled asphalt, double yellow centre line and dashed lane lines.
export function makeRoadTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#3d3c46';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i++) {
    const v = 50 + Math.random() * 30;
    g.fillStyle = `rgb(${v},${v},${v + 6})`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  g.fillStyle = '#f3e3b0';
  g.fillRect(61, 0, 2, 256);
  g.fillRect(65, 0, 2, 256);
  g.fillStyle = '#e8e2d6';
  for (let y = 0; y < 256; y += 64) {
    g.fillRect(28, y, 3, 34);
    g.fillRect(97, y, 3, 34);
  }
  g.fillStyle = '#d9d4c9';
  g.fillRect(2, 0, 3, 256);
  g.fillRect(123, 0, 3, 256);
  return finish(new THREE.CanvasTexture(c), 8);
}

// Intersection: zebra crossings on all four sides.
export function makeCrossingTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#3d3c46';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8e2d6';
  for (let i = 0; i < 8; i++) {
    g.fillRect(4 + i * 15, 2, 8, 14);
    g.fillRect(4 + i * 15, 112, 8, 14);
    g.fillRect(2, 4 + i * 15, 14, 8);
    g.fillRect(112, 4 + i * 15, 14, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// Neon sign: glowing italic text and a tube border on a dark board.
export function makeSignTexture(text, color) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = 'rgba(12,6,20,0.9)';
  g.fillRect(0, 0, 512, 128);
  const hex = '#' + color.toString(16).padStart(6, '0');
  g.font = 'bold italic 72px "DejaVu Sans", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = hex;
  g.shadowBlur = 28;
  g.fillStyle = hex;
  g.fillText(text, 256, 66);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  g.strokeStyle = hex;
  g.lineWidth = 6;
  g.shadowBlur = 20;
  g.strokeRect(8, 8, 496, 112);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// Soft round sprite for lights, smoke, fire and glows.
export function makeGlowTexture() {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Merge non-indexed geometries (position, normal, uv, optional colour) into a single geometry.
export function mergeGeometries(list) {
  let count = 0;
  const parts = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Paint a whole geometry one vertex colour, for merged vertex-coloured meshes.
export function tint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
