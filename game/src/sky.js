// Golden-hour sky dome, sun with soft shadows, the animated sea and the lights that sell the sunset.
import { PALETTE, CITY } from './config.js';
const THREE = window.THREE;

const SKY_VERT = `varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform float dusk;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
  col = mix(col, top, smoothstep(0.15, 0.7, h));
  col = mix(col, vec3(0.9, 0.55, 0.45), smoothstep(0.02, -0.2, h));
  float s = max(dot(normalize(vDir), sunDir), 0.0);
  col += vec3(1.0, 0.75, 0.45) * pow(s, 9.0) * 0.55 + vec3(1.0, 0.9, 0.7) * pow(s, 380.0) * 2.5;
  // thin streaks of pink cloud just above the horizon
  float band = sin(vDir.x * 9.0 + vDir.z * 4.0) * 0.5 + 0.5;
  col += vec3(0.25, 0.08, 0.12) * smoothstep(0.05, 0.12, h) * smoothstep(0.24, 0.12, h) * band * 0.6;
  // a few early stars once dusk falls
  float star = step(0.9975, fract(sin(dot(floor(vDir.xz * 420.0), vec2(12.9898, 78.233))) * 43758.5453));
  col += vec3(star) * dusk * smoothstep(0.25, 0.6, h) * 0.8;
  col = mix(col, col * vec3(0.45, 0.4, 0.7), dusk);
  gl_FragColor = vec4(col, 1.0);
}`;

const SEA_VERT = `uniform float time; varying vec3 vW; varying float vH;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float h = sin(w.x * 0.05 + time * 1.2) * 0.35 + sin(w.z * 0.08 + time * 0.9) * 0.25;
  w.y += h; vH = h; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SEA_FRAG = `uniform vec3 sunDir; uniform float time; uniform vec3 fogColor; varying vec3 vW; varying float vH;
void main() {
  vec3 view = normalize(cameraPosition - vW);
  vec3 n = normalize(vec3(sin(vW.x * 0.3 + time) * 0.08, 1.0, cos(vW.z * 0.25 + time * 1.3) * 0.08));
  vec3 r = reflect(-view, n);
  float spec = pow(max(dot(r, sunDir), 0.0), 60.0);
  float fres = pow(1.0 - max(dot(view, n), 0.0), 3.0);
  vec3 deep = vec3(0.07, 0.25, 0.38);
  vec3 sky = vec3(0.95, 0.55, 0.5);
  vec3 col = mix(deep, sky, fres * 0.8) + vec3(1.0, 0.75, 0.45) * spec * 1.6 + vH * 0.05;
  float d = length(cameraPosition - vW);
  col = mix(col, fogColor, smoothstep(250.0, 1300.0, d));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color(PALETTE.skyTop) },
    mid: { value: new THREE.Color(PALETTE.skyMid) },
    horizon: { value: new THREE.Color(PALETTE.horizon) },
    sunDir: { value: new THREE.Vector3(0.2, 0.12, 1).normalize() },
    dusk: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 16),
    new THREE.ShaderMaterial({ uniforms, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG }),
  );
  dome.renderOrder = -10;
  scene.add(dome);

  scene.fog = new THREE.Fog(PALETTE.fog, 120, 900);
  const hemi = new THREE.HemisphereLight(0xffc6b0, 0x4a3a66, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 10; sc.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x7a6cff, 0.35);
  fill.position.set(-200, 120, -300);
  scene.add(fill);

  // The sea: a wide plane with a vertex swell, fresnel sky reflection and the sun's glitter path.
  const seaU = { time: { value: 0 }, sunDir: uniforms.sunDir, fogColor: { value: new THREE.Color(PALETTE.fog) } };
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 1400, 120, 40),
    new THREE.ShaderMaterial({ uniforms: seaU, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, CITY.shoreZ + 690);
  scene.add(sea);

  const sunPos = new THREE.Vector3();
  return {
    sun,
    hemi,
    uniforms,
    update(dt, focus, t) {
      seaU.time.value = t;
      // keep the shadow camera centred on the action
      sunPos.copy(uniforms.sunDir.value).multiplyScalar(320).add(focus);
      sun.position.copy(sunPos);
      sun.target.position.copy(focus);
    },
    setDusk(v) {
      uniforms.dusk.value = v;
      sun.intensity = 1.9 * (1 - v * 0.75);
      hemi.intensity = 0.75 * (1 - v * 0.5);
    },
  };
}
