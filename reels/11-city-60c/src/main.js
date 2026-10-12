// #11 — What if your city hit 60 °C?
// Still reel: one locked camera on top of the TKTS red steps, looking south down Times Square.
// The temperature climbs from 22 °C to 60 °C; the crowd thins, people collapse and are helped,
// the city breaks down, then a storm breaks the heat and the square comes back (loop).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smooth, ease, rng, kf, fadeWin, after, col, hash, noise1, V, STD, BASIC, canvasTex, mesh, box, rbox, cyl, sph, softTex, puffTex, glowSprite } from './util.js';
import { SKIN, HAIRC, makePerson, POSE, setPose, poseAt, blendPose, walkLegs, makeCrowd, updateCrowd } from './people.js';

const W = 1080, H = 1920, GW = window.GL_W || 576, GH = window.GL_H || 1024;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let TL = null, B = null;

// ---------- renderer (as #08: straight to the canvas, no bloom; shimmer and grade are done in 2D) ----------
const glc = document.getElementById('gl'); glc.width = GW; glc.height = GH;
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: window.MSAA !== 0, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(GW, GH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, W / H, 0.3, 5000);
const CAM = { p: V(1.0, 5.2, 7.6), look: V(-1.2, 2.1, -40) };
camera.position.copy(CAM.p); camera.lookAt(CAM.look);
const SHIM = { heat: 0, storm: 0 };

// ---------- sky (the #08 sky shader, daylight only) ----------
const skyU = { zen: { value: col('#3c6fb8') }, hor: { value: col('#cfe0ee') }, sunDir: { value: V(0, 1, 0) }, haloK: { value: .4 }, sunCol: { value: col('#ffe2b8') }, below: { value: col('#4a4a4c') }, cloud: { value: 0 }, t: { value: 0 } };
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 sunDir; uniform float haloK; uniform vec3 sunCol; uniform vec3 below; uniform float cloud; uniform float t; varying vec3 vP;
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), u.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), u.x), u.y); }
    void main(){ vec3 d = normalize(vP); float up = max(d.y, 0.0);
      vec3 c = mix(hor, zen, pow(clamp(up * 1.15, 0.0, 1.0), 0.5));
      float sd = max(dot(d, normalize(sunDir)), 0.0);
      c += sunCol * haloK * (0.3 * pow(sd, 6.0) + 1.6 * pow(sd, 700.0));
      if (cloud > 0.0){ vec2 p = d.xz / max(d.y, 0.08) * 1.4 + vec2(t * 0.05, 0.0); float n = vn(p) * 0.6 + vn(p * 2.3) * 0.3 + vn(p * 5.1) * 0.1;
        c = mix(c, mix(vec3(0.24, 0.26, 0.3), vec3(0.42, 0.44, 0.48), n), cloud * smoothstep(0.02, 0.25, up)); }
      if (d.y < -0.02) c = mix(c, below, smoothstep(0.02, 0.2, -d.y));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; sky.scale.setScalar(4500); scene.add(sky);
const SUN = V(-.45, .82, .36).normalize();
skyU.sunDir.value.copy(SUN);
const sunL = new THREE.DirectionalLight(0xffe9cc, 2.7); sunL.castShadow = true; scene.add(sunL, sunL.target);
{ const S = window.SHADOW ? Math.min(window.SHADOW, 4096) : 2048; sunL.shadow.mapSize.set(S, S); sunL.shadow.bias = -3e-4; sunL.shadow.normalBias = .04; sunL.shadow.radius = 2;
  const c = sunL.shadow.camera; c.left = -60; c.right = 60; c.top = 95; c.bottom = -95; c.near = 1; c.far = 700; }
sunL.target.position.set(-2, 0, -60); sunL.position.copy(sunL.target.position).addScaledVector(SUN, 300);
const hemi = new THREE.HemisphereLight(0xbcd2f0, 0x6a5e50, .85); scene.add(hemi);
scene.fog = new THREE.Fog(0xcfe0ee, 160, 1500);

const R = rng(6060);

// ---------- static geometry, merged per material ----------
const STATIC = new Map();
function addStatic(geo, mat, matrix){ let g = geo.index ? geo.toNonIndexed() : geo; if (matrix) g.applyMatrix4(matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv){ g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); } if (!STATIC.has(mat)) STATIC.set(mat, []); STATIC.get(mat).push(g); }
function sbox(w, h, d, mat, x, y, z, ry = 0){ const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); addStatic(g, mat); }
function flushStatic(){ for (const [mat, list] of STATIC){ const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); } STATIC.clear(); }

// ---------- ground ----------
const ROAD_L = -18, ROAD_R = -4, FAC = 26;
const noiseTex = (w, h, base, amp, f) => canvasTex(w, h, (g) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rng(w + h); for (let i = 0; i < w * h / 6; i++){ const v = (r() - .5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } if (f) f(g, w, h, r); });
const asphTex = noiseTex(256, 256, '#3a3b3e', .12, (g, w, h, r) => { for (let i = 0; i < 18; i++){ g.strokeStyle = 'rgba(20,20,22,.35)'; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++){ x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); } });
asphTex.wrapS = asphTex.wrapT = THREE.RepeatWrapping; asphTex.repeat.set(4, 60);
const paverTex = noiseTex(256, 256, '#8d8780', .1, (g, w, h) => { g.strokeStyle = 'rgba(40,36,34,.35)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 32){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64){ g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = 'rgba(200,200,205,.5)'; for (let i = 0; i < 4; i++){ g.beginPath(); g.arc(40 + i * 60, 100 + (i % 2) * 90, 4, 0, 7); g.fill(); } });
paverTex.wrapS = paverTex.wrapT = THREE.RepeatWrapping; paverTex.repeat.set(7, 80);
const asphalt = STD('#ffffff', .82, { map: asphTex });
const plazaMat = STD('#ffffff', .86, { map: paverTex });
const walkMat = STD('#7b7772', .9), curbMat = STD('#8e8a84', .85), lineMat = STD('#d8d4ca', .8), yellowLine = STD('#d7a52a', .8);
{
  const g = new THREE.PlaneGeometry(ROAD_R - ROAD_L, 900); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, asphalt); m.position.set((ROAD_L + ROAD_R) / 2, .01, -420); m.receiveShadow = true; scene.add(m);
  const g2 = new THREE.PlaneGeometry(FAC - ROAD_R, 900); g2.rotateX(-Math.PI / 2); const m2 = new THREE.Mesh(g2, plazaMat); m2.position.set((ROAD_R + FAC) / 2, .14, -420); m2.receiveShadow = true; scene.add(m2);
}
sbox(8, .28, 900, walkMat, -FAC + 4, .14, -420);
sbox(.3, .3, 900, curbMat, ROAD_L - .15, .15, -420); sbox(.3, .3, 900, curbMat, ROAD_R + .15, .15, -420);
sbox(500, .1, 1400, STD('#2a2a2c'), 0, -.06, -500);
// lane lines (not the warping crosswalk, which is built separately)
for (const lx of [-13.4, -8.6]) for (let z = 4; z > -800; z -= 12) sbox(.15, .02, 4.5, lineMat, lx, .025, z);
for (const cz of [-150, -290]) for (let x = ROAD_L + .8; x < ROAD_R; x += 1.5) sbox(.75, .02, 4.4, lineMat, x, .028, cz);
// the near crosswalk: its stripes are separate meshes so they can soften and wobble
const XWALK = [];
{ const g = new THREE.PlaneGeometry(.75, 4.6, 1, 24); g.rotateX(-Math.PI / 2);
  for (let x = ROAD_L + .8; x < ROAD_R; x += 1.5){ const m = new THREE.Mesh(g.clone(), lineMat); m.position.set(x, .03, -31); m.receiveShadow = true; scene.add(m); XWALK.push({ m, base: m.geometry.attributes.position.array.slice(), x }); } }
// bollards along the plaza edge
const bollard = STD('#3a3c40', .6);
for (let z = -3; z > -300; z -= 6) sbox(.32, 1, .32, bollard, ROAD_R + .7, .64, z);

// ---------- textures for buildings and screens ----------
function facadeTex(seed, kind){
  const r = rng(seed);
  return canvasTex(256, 256, (g) => {
    if (kind === 0){ // glass curtain wall
      g.fillStyle = '#6f8296'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++){ const v = 95 + r() * 40 | 0; g.fillStyle = `rgb(${v - 20},${v},${v + 22})`; g.fillRect(x * 32 + 2, y * 16 + 2, 28, 12); }
      g.fillStyle = 'rgba(40,46,54,.6)'; for (let x = 0; x < 8; x++) g.fillRect(x * 32, 0, 2, 256);
    } else if (kind === 1){ // limestone with punched windows
      g.fillStyle = '#b8a98f'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ g.fillStyle = `rgb(${50 + r() * 30 | 0},${58 + r() * 30 | 0},${70 + r() * 30 | 0})`; g.fillRect(x * 16 + 4, y * 16 + 3, 8, 10); }
    } else if (kind === 2){ // brick
      g.fillStyle = '#8a5a46'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ g.fillStyle = '#d8d0c0'; g.fillRect(x * 16 + 3, y * 16 + 2, 10, 11); g.fillStyle = `rgb(${60 + r() * 25 | 0},${70 + r() * 25 | 0},${82 + r() * 25 | 0})`; g.fillRect(x * 16 + 4, y * 16 + 3, 8, 9); }
    } else { // dark modern
      g.fillStyle = '#3c4046'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 32; y++){ const v = 70 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v + 8},${v + 18})`; g.fillRect(0, y * 8 + 1, 256, 5); }
    }
  });
}
const FACADES = [0, 1, 2, 3, 0, 1].map((k, i) => { const t = facadeTex(10 + i, k); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
// invented ads (from #03), plus heat alerts
const ADS = [
  (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff2d8a'); gr.addColorStop(1, '#5b2bff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `700 ${h * .42}px Tinos`; g.textAlign = 'center'; g.fillText('NOVA', w / 2, h * .62); },
  (g, w, h) => { g.fillStyle = '#0b3d91'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(w * .5, h * .55, h * .3, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${h * .14}px Tinos`; g.textAlign = 'center'; g.fillText('SUNNY DAYS AHEAD', w / 2, h * .18); },
  (g, w, h) => { g.fillStyle = '#e8202a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = h * .06; g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * .55 + Math.sin(x / w * 9) * h * .12); g.stroke(); g.fillStyle = '#fff'; g.font = `italic 700 ${h * .3}px Tinos`; g.textAlign = 'center'; g.fillText('Fizz', w / 2, h * .38); },
  (g, w, h) => { g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `700 ${h * .24}px Tinos`; g.textAlign = 'center'; g.fillText('LANTERN', w / 2, h * .45); g.font = `400 ${h * .1}px Tinos`; g.fillText('THE MUSICAL', w / 2, h * .65); },
  (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#00c2a8'); gr.addColorStop(1, '#00577a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `700 ${h * .3}px Tinos`; g.textAlign = 'center'; g.fillText('WAVE', w / 2, h * .45); },
  (g, w, h) => { g.fillStyle = '#14121a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(w * .5, h * .15); g.lineTo(w * .62, h * .8); g.lineTo(w * .38, h * .8); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${h * .11}px Tinos`; g.textAlign = 'center'; g.fillText('DAWN  ·  PART II', w / 2, h * .95); },
  (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b3b'; g.beginPath(); g.ellipse(w * .5, h * .55, w * .32, h * .16, -.2, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = `700 ${h * .2}px Tinos`; g.textAlign = 'center'; g.fillText('STRIDE', w / 2, h * .25); },
  (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2a0845'); gr.addColorStop(1, '#6441a5'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9ef9'; g.font = `italic 700 ${h * .26}px Tinos`; g.textAlign = 'center'; g.fillText('Tonight', w / 2, h * .6); },
  (g, w, h) => { g.fillStyle = '#5ab0ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * .2, h * .6); g.lineTo(w * .8, h * .35); g.lineTo(w * .8, h * .42); g.lineTo(w * .25, h * .66); g.fill(); g.font = `700 ${h * .16}px Tinos`; g.textAlign = 'left'; g.fillText('FLY ARCA', w * .08, h * .22); },
  (g, w, h) => { g.fillStyle = '#00a651'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `700 ${h * .2}px Tinos`; g.textAlign = 'center'; g.fillText('FRESH', w / 2, h * .42); g.fillText('& FAST', w / 2, h * .68); },
  (g, w, h) => { g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f5f5f5'; g.lineWidth = h * .03; g.beginPath(); g.arc(w * .5, h * .5, h * .32, 0, 7); g.stroke(); g.fillStyle = '#d4af37'; g.font = `400 ${h * .1}px Tinos`; g.textAlign = 'center'; g.fillText('MERIDIAN', w / 2, h * .95); },
  (g, w, h) => { g.fillStyle = '#e94e1b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff3d6'; g.font = `700 ${h * .22}px Tinos`; g.textAlign = 'center'; g.fillText('ICE COLD', w / 2, h * .45); g.font = `400 ${h * .11}px Tinos`; g.fillText('SPARKLING WATER', w / 2, h * .66); }
];
const ALERT = (g, w, h) => { g.fillStyle = '#9e1016'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 ${h * .2}px Tinos`; g.fillText('EXTREME HEAT', w / 2, h * .42); g.font = `400 ${h * .12}px Tinos`; g.fillText('STAY INDOORS  ·  CALL 911', w / 2, h * .66); };
const adTex = ADS.map(fn => [canvasTex(512, 320, fn), canvasTex(320, 512, fn)]);
const alertTex = [canvasTex(512, 320, ALERT), canvasTex(320, 512, (g, w, h) => { g.fillStyle = '#9e1016'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 ${w * .17}px Tinos`; g.fillText('EXTREME', w / 2, h * .4); g.fillText('HEAT', w / 2, h * .52); g.font = `400 ${w * .09}px Tinos`; g.fillText('STAY INDOORS', w / 2, h * .66); })];
// a live temperature screen
const tempCv = document.createElement('canvas'); tempCv.width = 512; tempCv.height = 320; const tempG = tempCv.getContext('2d');
const tempTex = new THREE.CanvasTexture(tempCv); tempTex.colorSpace = THREE.SRGBColorSpace;
const BOARDS = [];
const frameMat = STD('#1a1b1e', .7);
function billboard(x, y, z, w, h, rotY, adIdx, o = {}){
  const portrait = h > w * 1.1;
  const mat = new THREE.MeshBasicMaterial({ map: o.temp ? tempTex : adTex[adIdx % ADS.length][portrait ? 1 : 0], toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
  const fo = new THREE.Object3D(); fo.position.set(x, y, z); fo.rotation.y = rotY; fo.translateZ(-.35); fo.updateMatrix(); addStatic(new THREE.BoxGeometry(w + .5, h + .5, .5), frameMat, fo.matrix);
  const b = { mat, portrait, order: R(), phase: R() * 10, tex1: mat.map, tex2: adTex[(adIdx + 5) % ADS.length][portrait ? 1 : 0], swap: 7 + R() * 7, alert: !o.temp && R() < .38, temp: !!o.temp };
  BOARDS.push(b); return b;
}
// ---------- buildings ----------
function building(x0, x1, z0, z1, h, k){
  const w = x1 - x0, d = z0 - z1; const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, nrm = g.attributes.normal, ox = R(), oy = R();
  for (let i = 0; i < uv.count; i++){ const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); const sx = nx > .5 ? d : w, sy = ny > .5 ? d : h; uv.setXY(i, uv.getX(i) * sx / 64 + ox, uv.getY(i) * sy / 64 + oy); }
  const m = new THREE.Mesh(g, STD('#ffffff', .8, { map: FACADES[k % FACADES.length] })); m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  sbox(w + .4, 1.2, d + .4, STD('#55575c', .8), m.position.x, h + .6, m.position.z);
}
let adi = 0;
function side(sign, seed){
  const r = rng(seed); let z = 14, idx = 0;
  while (z > -360){
    const len = 18 + r() * 26, h = z > -60 ? 30 + r() * 30 : z > -170 ? 50 + r() * 70 : 75 + r() * 90;
    const xin = sign * FAC, xout = sign * (FAC + 30 + r() * 30);
    building(Math.min(xin, xout), Math.max(xin, xout), z, z - len, h, idx + (sign > 0 ? 3 : 0));
    const rot = sign < 0 ? Math.PI / 2 : -Math.PI / 2;
    const n = 1 + (r() < .75 ? 1 : 0) + (r() < .4 ? 1 : 0); let yb = 5 + r() * 4;
    for (let i = 0; i < n; i++){ const bw = len * (.55 + r() * .35), bh = 7 + r() * 16; if (yb + bh > h - 2) break;
      billboard(sign * (FAC - .4), yb + bh / 2, z - len / 2 + (r() - .5) * (len - bw) * .5, bw, bh, rot, adi++ % ADS.length, { temp: sign > 0 && idx === 2 && i === 1 });
      yb += bh + 2 + r() * 5; }
    z -= len + .5; idx++;
  }
}
side(-1, 5); side(1, 9);
// One Times Square with its stack of screens and the news ticker
const OTS = V(4, 0, -380);
building(OTS.x - 12, OTS.x + 12, OTS.z + 9, OTS.z - 9, 112, 3);
[[92, 20, 14], [74, 22, 16], [54, 23, 18], [36, 23, 12], [17, 23, 11]].forEach(([y, w, h], i) => billboard(OTS.x, y, OTS.z + 9.6, w, h, 0, (i * 5 + 2) % ADS.length));
building(-80, -6, -402, -450, 120, 1); building(30, 110, -402, -460, 105, 2); building(-62, -16, -330, -370, 80, 0);
billboard(-34, 44, -329.4, 26, 18, 0, 8); billboard(-44, 18, -329.4, 22, 14, 0, 3);
const tickCv = document.createElement('canvas'); tickCv.width = 2048; tickCv.height = 96; const tickG = tickCv.getContext('2d');
const tickTex = new THREE.CanvasTexture(tickCv); tickTex.colorSpace = THREE.SRGBColorSpace;
const tickMat = new THREE.MeshBasicMaterial({ map: tickTex, toneMapped: false });
const ticker = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.4), tickMat); ticker.position.set(OTS.x, 27, OTS.z + 9.7); scene.add(ticker);

// ---------- the TKTS red steps (camera stands on top) ----------
const stepRed = STD('#b3262a', .45), stepEdge = STD('#e8d8cf', .5), glassRail = STD('#cfd8dc', .2, { transparent: true, opacity: .35 });
const STEPS = { x0: -5.5, x1: 8.5, zTop: 9.6, zBot: -1.2, n: 12 };
{ const dz = (STEPS.zTop - STEPS.zBot) / STEPS.n, dy = 4.6 / STEPS.n;
  for (let i = 0; i < STEPS.n; i++){ const z = STEPS.zBot + dz * (i + .5), y = dy * (i + 1);
    sbox(STEPS.x1 - STEPS.x0, y, dz, stepRed, (STEPS.x0 + STEPS.x1) / 2, y / 2 + .14, z);
    sbox(STEPS.x1 - STEPS.x0, .02, .04, i % 2 ? stepRed : STD('#8f1c20', .5), (STEPS.x0 + STEPS.x1) / 2, y + .15, z - dz / 2 + .02); }
  sbox(STEPS.x1 - STEPS.x0, 4.6, 4, stepRed, (STEPS.x0 + STEPS.x1) / 2, 2.44, STEPS.zTop + 2);
  for (const x of [STEPS.x0 - .1, STEPS.x1 + .1]){ const g = new THREE.BoxGeometry(.06, 1.1, 11); g.rotateX(Math.atan2(4.6, 10.8)); g.translate(x, 2.9, (STEPS.zTop + STEPS.zBot) / 2); const m = new THREE.Mesh(g, glassRail); scene.add(m); }
}
const stepY = z => clamp((z - STEPS.zBot) / (STEPS.zTop - STEPS.zBot), 0, 1) * 4.6;
const stepSeat = row => { const dz = (STEPS.zTop - STEPS.zBot) / STEPS.n; return { z: STEPS.zBot + dz * (row + .5), y: 4.6 / STEPS.n * (row + 1) + .14 }; };

// ---------- street furniture ----------
const poleMat = STD('#2e3034', .55), lampMat = BASIC('#d8d4ca');
function lampPost(x, z, armDir = -1){ sbox(.22, 9, .22, poleMat, x, 4.5, z); sbox(2.2, .18, .18, poleMat, x + armDir * 1.1, 8.95, z); sbox(.8, .22, .45, poleMat, x + armDir * 2.05, 8.8, z); }
for (let z = -41; z > -320; z -= 30){ lampPost(ROAD_R + 1.2, z, -1); lampPost(ROAD_L - 1.2, z, 1); }
const PIGEON_POLE = V(ROAD_R + 1.0, 0, -11.5); lampPost(PIGEON_POLE.x, PIGEON_POLE.z, -1);
lampPost(7.8, -21, 1);
// vertical banners on two poles (they sag in the heat)
const bannerTex = canvasTex(64, 192, (g, w, h) => { g.fillStyle = '#1f4fa0'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe6'; g.font = '700 15px Tinos'; g.textAlign = 'center'; for (const [i, s] of ['T', 'I', 'M', 'E', 'S', ' ', 'S', 'Q'].entries()) g.fillText(s, w / 2, 24 + i * 21); });
const BANNERS = [[PIGEON_POLE.x + .16, 6.2, PIGEON_POLE.z], [7.8 - .16, 6.2, -21]].map(([x, y, z]) => { const g = new THREE.PlaneGeometry(.7, 2.2, 1, 16); const m = new THREE.Mesh(g, STD('#ffffff', .85, { map: bannerTex, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = Math.PI / 2; m.castShadow = true; scene.add(m); return { m, base: g.attributes.position.array.slice() }; });
// subway entrance: green railings, globe lamps, stairs going down
const SUBWAY = V(6.6, 0, -25);
{ const green = STD('#24513a', .6); sbox(.08, 1.1, 5, green, SUBWAY.x - 1.3, .69, SUBWAY.z - 2.3); sbox(.08, 1.1, 5, green, SUBWAY.x + 1.3, .69, SUBWAY.z - 2.3); sbox(2.68, 1.1, .08, green, SUBWAY.x, .69, SUBWAY.z - 4.8);
  sbox(2.5, .2, 5, STD('#121212', .9), SUBWAY.x, .05, SUBWAY.z - 2.3);
  for (const s of [-1, 1]){ sbox(.1, 2.2, .1, green, SUBWAY.x + s * 1.3, 1.24, SUBWAY.z + .1); const gl = mesh(sph(.16, 12, 10), STD('#7fd39a', .3, { emissive: '#3a9a5a', emissiveIntensity: .6 }), SUBWAY.x + s * 1.3, 2.45, SUBWAY.z + .1, scene); } }
const subwayHole = mesh(new THREE.PlaneGeometry(2.4, 4.8).rotateX(-Math.PI / 2), BASIC('#050506'), SUBWAY.x, .16, SUBWAY.z - 2.3, scene);
// manhole on the road
const MANHOLE = V(-7.2, 0, -33);
mesh(cyl(.42, .42, .02, 24), STD('#1e1f22', .5), MANHOLE.x, .02, MANHOLE.z, scene);
// shade awnings on the left building fronts (people lie in their shade later)
for (const z of [-60, -84, -110]) sbox(2.4, .15, 14, STD('#6b2b2b', .8), -FAC + 1.2, 4.2, z);

// ---------- carts: hot dogs (with the duck), ice cream; a water cooler ----------
const CART = V(3.0, 0, -5.0);
const cartBody = STD('#c9ccd0', .45, { metalness: .4 }), umbMatA = STD('#2f6fb4', .85), umbMatB = STD('#e8e2d2', .85);
const cartG = new THREE.Group(); cartG.position.copy(CART); scene.add(cartG);
mesh(rbox(1.9, 1.0, 1.0, .06), cartBody, 0, .95, 0, cartG, 3); mesh(box(1.9, .08, 1.0), STD('#8a8e94', .4, { metalness: .5 }), 0, 1.49, 0, cartG, 3);
for (const s of [-1, 1]) mesh(cyl(.22, .22, .1, 16).rotateZ(Math.PI / 2), STD('#151515', .9), s * .7, .22, .45, cartG, 1);
mesh(box(1.4, .3, .02), STD('#ffffff', .8, { map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#d63a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6e0'; g.font = '700 34px Tinos'; g.textAlign = 'center'; g.fillText('HOT DOGS  $3', w / 2, 44); }) }), 0, 1.1, .51, cartG);
mesh(cyl(.03, .03, 1.6, 8), STD('#8a8e94', .4), .1, 2.25, 0, cartG, 1);
const umbrella = new THREE.Group(); umbrella.position.set(.1, 3.05, 0); cartG.add(umbrella);
for (let i = 0; i < 8; i++){ const g = new THREE.ConeGeometry(1.35, .45, 2, 1, true, i * Math.PI / 4, Math.PI / 4); mesh(g, i % 2 ? umbMatA : umbMatB, 0, 0, 0, umbrella, 1).material.side = THREE.DoubleSide; }
// the duck (rewatch hook): sits on the cart and slowly melts
const duck = new THREE.Group(); { const y = STD('#f2c230', .5), o = STD('#e8792b', .5);
  const b = mesh(sph(.13, 14, 10), y, 0, 0, 0, duck, 1); b.scale.set(1.25, .8, 1); const h = mesh(sph(.08, 12, 10), y, .11, .12, 0, duck, 1);
  const k = mesh(new THREE.ConeGeometry(.03, .08, 8), o, .2, .11, 0, duck); k.rotation.z = -Math.PI / 2;
  duck.position.set(-.62, 1.6, .25); duck.rotation.y = -1.1; cartG.add(duck); duck.userData = { b, h, k }; }
const ICE = V(-2.0, 0, -9.2);
const iceG = new THREE.Group(); iceG.position.copy(ICE); iceG.rotation.y = .25; scene.add(iceG);
mesh(rbox(1.6, 1.0, .9, .06), STD('#f0ece2', .6), 0, .95, 0, iceG, 3);
mesh(box(1.4, .3, .02), STD('#ffffff', .8, { map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#ff8fb6'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 34px Tinos'; g.textAlign = 'center'; g.fillText('ICE CREAM', w / 2, 44); }) }), 0, 1.15, .46, iceG);
mesh(cyl(.03, .03, 1.5, 8), STD('#8a8e94', .4), 0, 2.15, 0, iceG); { const u = new THREE.Group(); u.position.set(0, 2.9, 0); iceG.add(u); for (let i = 0; i < 8; i++){ const g = new THREE.ConeGeometry(1.15, .4, 2, 1, true, i * Math.PI / 4, Math.PI / 4); const m = mesh(g, i % 2 ? STD('#ff8fb6', .85) : STD('#f2efe6', .85), 0, 0, 0, u, 1); m.material.side = THREE.DoubleSide; } }
const COOLER = V(-.7, 0, -3.4);
const coolerG = new THREE.Group(); coolerG.position.copy(COOLER); scene.add(coolerG);
mesh(rbox(.8, .5, .5, .05), STD('#2d6fc0', .6), 0, .4, 0, coolerG, 3); mesh(rbox(.82, .08, .52, .03), STD('#f0ece2', .6), 0, .68, 0, coolerG, 1);
for (let i = 0; i < 6; i++) mesh(cyl(.035, .035, .22, 8), STD('#9fd0ff', .2, { transparent: true, opacity: .8 }), -.25 + i * .1, .84, 0, coolerG);

// ---------- vehicles ----------
const NCAR = 26;
const carBodyG = (() => { const s = new THREE.Shape(); [[-2.2, .3], [2.2, .3], [2.25, .75], [1.3, .85], [.8, 1.4], [-1.1, 1.42], [-1.7, .9], [-2.25, .8]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }); g.translate(0, 0, -.9); g.rotateY(Math.PI / 2); g.deleteAttribute('uv'); return g; })();
const carGlassG = (() => { const s = new THREE.Shape(); [[1.22, .86], [.78, 1.36], [-1.05, 1.38], [-1.6, .9]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1.84, bevelEnabled: false }); g.translate(0, 0, -.92); g.rotateY(Math.PI / 2); g.deleteAttribute('uv'); return g; })();
const carPaint = STD('#ffffff', .35, { metalness: .2 });
const CARM = { body: new THREE.InstancedMesh(carBodyG, carPaint, NCAR + 2), glass: new THREE.InstancedMesh(carGlassG, STD('#1c242c', .15, { metalness: .4 }), NCAR + 2), wheel: new THREE.InstancedMesh(cyl(.34, .34, .24, 16).rotateZ(Math.PI / 2), STD('#141414', .9), (NCAR + 2) * 4), sign: new THREE.InstancedMesh(rbox(.9, .28, .3, .05), BASIC('#f4efe0'), NCAR + 2) };
Object.values(CARM).forEach(m => { m.castShadow = true; m.frustumCulled = false; scene.add(m); });
const CARS = [];
{ const r = rng(2012), lanes = [-16, -11, -6.5];
  for (let i = 0; i < NCAR; i++){ const lane = lanes[i % 3]; CARS.push({ x: lane + (r() - .5) * .3, z0: 20 - r() * 380, sp: 6 + r() * 4, taxi: r() < .65, rank: r(), c: ['#e9e9e9', '#20252c', '#8a1f1f', '#3a5f8a', '#6a6f75'][(r() * 5) | 0] }); }
  CARS.forEach((c, i) => CARM.body.setColorAt(i, col(c.taxi ? '#f2b21c' : c.c)));
  CARS.push({ x: -11, z0: -36, sp: 0, taxi: true, abandoned: true, rank: 2 }); CARM.body.setColorAt(NCAR, col('#f2b21c'));
}
// ambulance
const amb = new THREE.Group(); scene.add(amb);
{ const white = STD('#e8e6e0', .5), red = STD('#c4202a', .6);
  mesh(rbox(2.3, 2.3, 4.6, .12), white, 0, 1.75, -.8, amb, 3);
  mesh(rbox(2.2, 1.5, 1.9, .12), white, 0, 1.3, 2.4, amb, 3);
  mesh(box(2.32, .3, 4.62), red, 0, 1.55, -.8, amb);
  mesh(box(2.0, .7, .05), STD('#1c242c', .15), 0, 1.65, 3.36, amb);
  for (const [x, z] of [[-1, 2.4], [1, 2.4], [-1, -2.2], [1, -2.2]]) mesh(cyl(.4, .4, .3, 16).rotateZ(Math.PI / 2), STD('#141414', .9), x, .4, z, amb, 1);
  amb.userData.bar = [mesh(box(.5, .16, .25), BASIC('#ff2a2a'), -.5, 2.98, 1.4, amb), mesh(box(.5, .16, .25), BASIC('#f4efe0'), .5, 2.98, 1.4, amb)];
  amb.userData.glow = [glowSprite('#ff3030'), glowSprite('#ffffff')]; amb.userData.glow.forEach((s, i) => { s.position.set(i ? .5 : -.5, 3.0, 1.4); s.scale.setScalar(3); amb.add(s); });
}
const STRETCH = new THREE.Group(); scene.add(STRETCH);
{ mesh(rbox(.62, .12, 2.0, .03), STD('#d8d4ca', .8), 0, .85, 0, STRETCH, 3); mesh(box(.66, .04, 2.2), STD('#3a3c40', .5), 0, .76, 0, STRETCH, 1); for (const z of [-.85, .85]) for (const x of [-.25, .25]) mesh(cyl(.02, .02, .7, 6), STD('#3a3c40', .5), x, .4, z, STRETCH); STRETCH.visible = false; }
// airliner (far, in the sky window over the street)
const plane = new THREE.Group(); scene.add(plane);
{ const sk = STD('#cfd3d8', .5, { fog: false }); mesh(cyl(1.9, 1.9, 38, 12).rotateX(Math.PI / 2), sk, 0, 0, 0, plane); mesh(box(36, .5, 6), sk, 0, -.4, 1, plane); mesh(box(12, .4, 3), sk, 0, .4, -16, plane); mesh(box(.4, 7, 4), sk, 0, 3.8, -16, plane); plane.scale.setScalar(1); }
// pigeons on the lamp arm
const PIGEONS = [];
{ const grey = STD('#7d8088', .8), dark = STD('#4a4d55', .8);
  for (let i = 0; i < 5; i++){ const p = new THREE.Group(); const b = mesh(sph(.13, 10, 8), grey, 0, 0, 0, p, 1); b.scale.set(.8, .75, 1.3); mesh(sph(.07, 8, 6), dark, 0, .11, .12, p, 1); mesh(box(.06, .02, .2), dark, 0, -.02, -.2, p);
    const a = .3 + i * 1.25, r = .62; const x = ICE.x + Math.sin(a) * r, z = ICE.z + Math.cos(a) * r; p.position.set(x, 3.08 - .36 * r / 1.15 + .1, z); p.rotation.y = a; scene.add(p); PIGEONS.push({ g: p, x0: x, z0: z, y0: p.position.y, a, d: i * .5 }); } }

// ---------- smoke / steam sprites ----------
function puffSet(n, c){ return Array.from({ length: n }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: c, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); return { s, r: hash(i * 3.7 + n), r2: hash(i * 7.1 + 3), r3: hash(i * 1.3 + 9) }; }); }
const PLUME = puffSet(26, '#8f8b86'), HAZE = puffSet(10, '#e8e4dc'), STEAM = puffSet(70, '#f0f0f0'), UMB = puffSet(8, '#bdb8b0');

// ---------- people ----------
const SHIRTS = ['#c0533c', '#3d6fa3', '#e1b74a', '#5b8f5a', '#8a5a9e', '#e07a5f', '#2f4858', '#d9d4c7', '#a33b3b', '#4c8c9c', '#e5e2da', '#222831', '#f08a4b', '#6fa8dc', '#b5d36b', '#f2c4ce'];
const PANTS = ['#2f3b52', '#3a3f4a', '#8a7a5c', '#1f2228', '#5a5a60', '#4a5d7a', '#b8a888', '#2b2b2b'];
// crowd spots
const CROWD = [];
{ const r = rng(314);
  const add = (x, z, o = {}) => { const female = r() < .5; CROWD.push(Object.assign({ x, z, dir: 0, sp: 0, female, s: (female ? .93 : 1) * (.95 + r() * .1), rank: r(), ph: r() * 6.3, yaw: (r() - .5) * 2, shirt: SHIRTS[(r() * SHIRTS.length) | 0], pant: PANTS[(r() * PANTS.length) | 0], skin: SKIN[(r() * SKIN.length) | 0], hair: HAIRC[(r() * 7) | 0], hs: female ? (r() < .6 ? 'long' : r() < .5 ? 'bun' : 'short') : (r() < .25 ? 'reced' : 'short'), tee: r() < .8, phone: r() < .3, fan: r() < .35, lie: 0 }, o)); };
  const CLEAR = [[.9, -8.8], [1.9, -8.2], [-.45, -9.35], [.95, -9.65], [-.35, -7.45], [-.6, -12.2], [.1, -12.6], [5.4, -13.5], [2.2, -17], [-2.3, -5.4], [3.0, -5.0], [1.55, -5.2], [.9, -4.1], [-2.0, -9.2], [-1.6, -7.5], [-1.4, -6.6], [-.7, -3.4], [-.1, -3.9], [6.6, -25], [6.6, -27.5], [-3, -11.5], [3.4, -13.8], [4.0, -14.2]];
  const clear = (x, z) => CLEAR.every(([cx, cz]) => Math.hypot(x - cx, z - cz) > 1.7) && !(x > -1.2 && x < 3.4 && z > -11 && z < -2.5) && !(x > 2 && x < 5 && z > -9 && z < -2.5);
  for (let i = 0; i < 260; i++){
    const walker = r() < .42;
    if (walker){ add(8.6 + r() * 15, -4 - r() * 224, { dir: r() < .5 ? 1 : -1, sp: 1.1 + r() * .4 }); continue; }
    let x, z, tries = 0; do { x = ROAD_R + 1.0 + r() * (FAC - ROAD_R - 2.4); z = -2.5 - Math.pow(r(), 1.15) * 200; tries++; } while (tries < 30 && !clear(x, z));
    if (clear(x, z)) add(x, z);
  }
  for (let i = 0; i < 70; i++){ let x, z, tries = 0; do { x = ROAD_R + .9 + r() * 16; z = -3 - r() * 30; tries++; } while (tries < 40 && !clear(x, z)); if (clear(x, z)) add(x, z, { near: true }); }
  for (let i = 0; i < 90; i++) add(-FAC + 1 + r() * 6.5, 10 - r() * 260, { dir: r() < .5 ? 1 : -1, sp: 1.1 + r() * .4 });
  // people who end up lying in the shade (left sidewalk under the awnings, and the plaza far side)
  CROWD.forEach(p => { p.liePick = r(); });
  CROWD.forEach(p => { const shadeZone = p.x < -17 || (p.x > 16 && p.z < -30); p.willLie = shadeZone && p.liePick < .35; p.lieT = 41 + p.liePick * 30; p.goneT = 54 + r() * 16; });
}
// keep walkers off the cart/ice-cream/cooler/subway and out of the hero area
const crowd = makeCrowd(CROWD, R); scene.add(crowd.group);

// hero cast (full rigs). Positions are in front of the steps, 13–35 m from the lens.
const CAST = {};
const tee = (shirt, pants, skin, hair, o = {}) => Object.assign({ jacket: shirt, shirt, pants, skin, hair, tee: true, open: true, hairStyle: 'short' }, o);
function hero(name, o, x, z, yaw = 0){ const g = makePerson(o); g.position.set(x, .14, z); g.rotation.y = yaw; scene.add(g); CAST[name] = g; g.userData.home = V(x, .14, z); g.userData.yaw0 = yaw; return g; }
hero('old', tee('#d9d4c7', '#6a6f75', SKIN[1], HAIRC[6], { hairStyle: 'reced', cap: '#2f4f7a' }), .9, -8.8, .35);
hero('help', tee('#e07a5f', '#2f3b52', SKIN[4], HAIRC[1], { female: true, hairStyle: 'long' }), 1.9, -8.2, -.6);
hero('sway', tee('#6fa8dc', '#b8a888', SKIN[0], HAIRC[3], { female: true, hairStyle: 'bun', shorts: true }), -.6, -12.2, .2);
hero('friend', tee('#222831', '#2f3b52', SKIN[3], HAIRC[0]), .1, -12.6, -.3);
hero('f2', tee('#f2c4ce', '#2b2b2b', SKIN[7], HAIRC[4], { female: true, hairStyle: 'long', shorts: true }), 5.4, -13.5, -.4);
hero('f3', tee('#5b8f5a', '#3a3f4a', SKIN[5], HAIRC[7]), 2.2, -17.0, .3);
hero('vendor', tee('#e8e4da', '#3a3f4a', SKIN[2], HAIRC[0], { cap: '#c0533c' }), CART.x - 1.45, CART.z - .2, 1.1);
hero('witness', tee('#3d6fa3', '#2f3b52', SKIN[6], HAIRC[2]), CART.x + 1.4, CART.z - .2, -1.2);
hero('iceman', tee('#f2efe6', '#3a3f4a', SKIN[3], HAIRC[0], { cap: '#ff8fb6' }), ICE.x - .1, ICE.z - .9, .25);
hero('seller', tee('#f08a4b', '#2f3b52', SKIN[5], HAIRC[0], { cap: '#222831' }), COOLER.x - .75, COOLER.z - .3, .5);
hero('medic1', { jacket: '#1d2a44', shirt: '#1d2a44', pants: '#1d2a44', skin: SKIN[2], hair: HAIRC[1], tee: true, open: true, stripe: '#d8d36a' }, -.45, -9.35, .5);
hero('medic2', { jacket: '#1d2a44', shirt: '#1d2a44', pants: '#1d2a44', skin: SKIN[6], hair: HAIRC[0], tee: true, open: true, stripe: '#d8d36a', female: true, hairStyle: 'bun' }, .95, -9.65, -.6);
hero('walkA', tee('#a33b3b', '#2f3b52', SKIN[2], HAIRC[2]), 3.5, -16, Math.PI);
hero('walkB', tee('#e1b74a', '#3a3f4a', SKIN[8], HAIRC[0], { female: true, hairStyle: 'long' }), 4.2, -16.4, Math.PI);
// ice cream line
const LINE = [0, 1, 2, 3].map(i => hero('line' + i, tee(SHIRTS[(i * 5 + 3) % SHIRTS.length], PANTS[i % PANTS.length], SKIN[(i * 2 + 1) % 9], HAIRC[i % 6], { female: i % 2 === 1, hairStyle: i % 2 ? 'long' : 'short', shorts: i === 2 }), ICE.x + .4 + i * .15, ICE.z + 1.3 + i * .85, Math.PI + .2));
// people sitting on the red steps, backs to the camera
const SITTERS = [];
[[-3.9, 0], [-2.2, 1], [-.3, 0], [1.6, 1], [3.5, 0], [5.4, 1], [7.1, 0], [.7, 2]].forEach(([x, row], i) => {
  const s = stepSeat(row); const g = hero('sit' + i, tee(SHIRTS[(i * 7 + 1) % SHIRTS.length], PANTS[(i * 3) % PANTS.length], SKIN[(i * 4 + 2) % 9], HAIRC[(i * 3) % 7], { female: i % 3 === 1, hairStyle: i % 3 === 1 ? 'long' : 'short', shorts: i % 2 === 0 }), x, s.z + .1, Math.PI);
  g.position.y = s.y - .38; g.userData.home.y = s.y - .38; SITTERS.push({ g, i, fan: i % 2 === 0 });
});
// Elmo: a costumed character; at the beat he pulls the head off
const elmo = hero('elmo', { jacket: '#d4231c', shirt: '#d4231c', pants: '#d4231c', skin: '#d4231c', hair: '#2c2019', tee: false, open: true, shoe: '#e07a1e' }, -2.3, -5.4, .2);
{ const fur = STD('#d4231c', 1.0); elmo.userData.arms.forEach(a => a.sh.traverse(m => { if (m.isMesh) m.material = fur; }));
  const eh = new THREE.Group(); mesh(sph(.33, 22, 16), fur, 0, 0, 0, eh, 1).scale.set(1, 1.05, .95);
  for (const s of [-1, 1]){ mesh(sph(.085, 14, 10), STD('#f2efe6', .4), s * .1, .14, .27, eh); mesh(sph(.035, 10, 8), STD('#0b0b0d', .3), s * .09, .14, .345, eh); }
  mesh(sph(.085, 14, 10), STD('#f08a1e', .5), 0, .02, .33, eh); mesh(box(.28, .1, .05), STD('#3a0a0a', .7), 0, -.13, .27, eh);
  eh.position.set(0, .06, 0); elmo.userData.head.add(eh); elmo.userData.elmoHead = eh; elmo.userData.face.visible = false; }
flushStatic();

// ---------- state ----------
const T = t => kf(TL.temp, t, false);
const heatK = t => clamp((T(t) - 24) / 36, 0, 1);
function survivalHours(temp){ const s = TL.survival; if (temp <= s[0][0]) return s[0][1]; for (let i = 1; i < s.length; i++) if (temp <= s[i][0]){ const k = (temp - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return Math.exp(lerp(Math.log(s[i - 1][1]), Math.log(s[i][1]), k)); } return s[s.length - 1][1]; }
const isStorm = t => kf(TL.storm, t);

function updateWorld(t){
  const temp = T(t), hk = heatK(t), storm = isStorm(t);
  // sky + light
  const zen = col('#3c6fb8').lerp(col('#7f9cc0'), hk * .8), hor = col('#cfe0ee').lerp(col('#efe4c8'), hk);
  zen.lerp(col('#3e4450'), storm); hor.lerp(col('#6a6e76'), storm);
  skyU.zen.value.copy(zen); skyU.hor.value.copy(hor); skyU.haloK.value = .45 + hk * .9 - storm * .45; skyU.cloud.value = storm; skyU.t.value = t;
  sunL.intensity = lerp(2.7, 3.1, hk) * (1 - storm * .85); sunL.color.set('#ffe9cc').lerp(col('#fff3d8'), hk);
  hemi.intensity = lerp(.85, 1.0, hk) * (1 - storm * .35); hemi.color.set('#bcd2f0').lerp(col('#e9dfc8'), hk).lerp(col('#8a929e'), storm);
  scene.fog.color.copy(hor); scene.fog.near = lerp(160, 100, hk) * (1 - storm * .4); scene.fog.far = lerp(1500, 1000, hk) * (1 - storm * .3);
  renderer.toneMappingExposure = lerp(1.0, 1.1, hk) * (1 - storm * .12);
  SHIM.heat = hk * (1 - storm); SHIM.storm = storm;
  // screens: swap ads, alerts after the heat emergency, then go dark block by block
  const scr = kf(TL.screens, t, false), alertOn = t > B.warp && t < B.return;
  BOARDS.forEach(b => {
    if (b.temp){ drawTempScreen(temp, t); }
    else b.mat.map = alertOn && b.alert ? alertTex[b.portrait ? 1 : 0] : (Math.floor((t + b.phase) / b.swap) % 2 ? b.tex2 : b.tex1);
    const on = scr > b.order ? 1 : 0, flick = scr < 1 && scr > 0 && Math.abs(scr - b.order) < .06 ? (noise1(t * 20 + b.phase) > .5 ? 1 : .1) : 1;
    b.mat.color.setScalar(on ? .9 * flick : .035);
  });
  let msg = TL.ticker[0][1]; for (const [tt, m] of TL.ticker) if (t >= tt) msg = m;
  tickG.fillStyle = '#05070a'; tickG.fillRect(0, 0, 2048, 96); tickG.font = '700 64px Tinos'; tickG.fillStyle = '#ffd34d'; tickG.textBaseline = 'middle';
  const wpx = tickG.measureText(msg).width, off = (t * 220) % wpx; tickG.fillText(msg.repeat(4), -off, 50); tickTex.needsUpdate = true;
  tickMat.color.setScalar(scr > .3 ? .9 : .03);
  // crosswalk stripes soften and wobble
  const warp = after(t, B.warp, 5) * (1 - after(t, B.return, 2));
  XWALK.forEach((w, i) => { const a = w.m.geometry.attributes.position, b0 = w.base; for (let v = 0; v < a.count; v++){ const z = b0[v * 3 + 2]; a.array[v * 3] = b0[v * 3] + warp * (Math.sin(z * 1.7 + i * 1.3) * .16 + Math.sin(z * 4.1 + i) * .05); } a.needsUpdate = true; });
  // banners sag
  const sag = after(t, B.banners, 4) * (1 - after(t, B.return, 1.5));
  BANNERS.forEach((bn, i) => { const a = bn.m.geometry.attributes.position, b0 = bn.base; for (let v = 0; v < a.count; v++){ const y = b0[v * 3 + 1], x = b0[v * 3]; const k = (1.1 - y) / 2.2; a.array[v * 3 + 1] = y - sag * k * k * .7; a.array[v * 3 + 2] = sag * k * k * .35 * (1 + x); } a.needsUpdate = true; bn.m.geometry.computeVertexNormals(); });
  // the duck melts
  const melt = clamp((temp - 30) / 30, 0, 1) * (t < B.return ? 1 : 1 - after(t, B.return + 1, 3));
  duck.scale.set(1 + melt * .35, 1 - melt * .55, 1 + melt * .35); duck.position.y = 1.6 - melt * .05; duck.userData.h.position.set(.11 + melt * .05, .12 - melt * .07, 0); duck.rotation.z = -melt * .25;
  // plume from the manhole
  const pl = after(t, B.manhole, .6) * (1 - after(t, B.manhole + 9, 4));
  PLUME.forEach((p, i) => { const age = ((t - B.manhole) * .5 + p.r) % 1; p.s.visible = pl > .01; if (!p.s.visible) return; p.s.position.set(MANHOLE.x + (p.r2 - .5) * .8 + age * 2, .4 + age * 11, MANHOLE.z + (p.r3 - .5) * .8); p.s.scale.setScalar(1.0 + age * 5); p.s.material.opacity = pl * (1 - age) * .75; });
  // haze breathing out of the subway entrance
  const hz = after(t, B.subwayHaze, 1.2) * (1 - after(t, B.subwayHaze + 8, 3));
  HAZE.forEach((p, i) => { const age = ((t - B.subwayHaze) * .35 + p.r) % 1; p.s.visible = hz > .01; if (!p.s.visible) return; p.s.position.set(SUBWAY.x + (p.r2 - .5) * 2, .5 + age * 4, SUBWAY.z - 1.5 + (p.r3 - .5) * 2); p.s.scale.setScalar(2 + age * 4); p.s.material.opacity = hz * (1 - age) * .22; });
  // umbrella smoke
  const um = after(t, B.umbrella, 1) * (1 - after(t, B.rain + .5, 1));
  UMB.forEach(p => { const age = ((t - B.umbrella) * .4 + p.r) % 1; p.s.visible = um > .01; if (!p.s.visible) return; p.s.position.set(CART.x + .1 + (p.r2 - .5) * 1.4 + age * .8, 3.2 + age * 3.5, CART.z + (p.r3 - .5) * 1.4); p.s.scale.setScalar(.6 + age * 2.4); p.s.material.opacity = um * (1 - age) * .4; });
  umbMatA.color.set('#2f6fb4').lerp(col('#6a6050'), um * .5); umbMatB.color.set('#e8e2d2').lerp(col('#a89a80'), um * .5);
  // steam when the rain hits the hot road
  const st = kf(TL.steam, t);
  STEAM.forEach((p, i) => { p.s.visible = st > .01; if (!p.s.visible) return; const age = ((t - B.steamUp) * .45 + p.r) % 1; const x = lerp(-17, 22, p.r2), z = -6 - p.r3 * 90; p.s.position.set(x + age * 1.5, .3 + age * 5, z); p.s.scale.setScalar(2.5 + age * 7 + p.r3 * 5); p.s.material.opacity = st * (1 - age) * .5; });
  // pigeons fall one by one
  PIGEONS.forEach(p => { const k = clamp((t - B.pigeons - p.d) / .7, 0, 1) * (t < B.return ? 1 : 0); const fall = k * k, out = .55 + k * .5; p.g.position.set(ICE.x + Math.sin(p.a) * out, lerp(p.y0, .24, fall), ICE.z + Math.cos(p.a) * out); p.g.rotation.set(0, p.a, k * 1.5); p.g.visible = true; });
  // plane: crosses the sky window, then banks and turns away
  const pk = (t - B.plane) / 6; plane.visible = pk > 0 && pk < 1;
  if (plane.visible){ const turn = smooth((pk - .35) / .5); const a = lerp(-.2, -1.6, turn); plane.position.set(lerp(30, 150, pk) + turn * 60, 350 + pk * 15, -1200 - turn * 700); plane.rotation.set(0, Math.PI / 2 + a, -turn * .55); }
  // ambulance: drives in, parks by the plaza, then leaves
  const inK = ease(clamp((t - B.ambIn) / (B.ambStop - B.ambIn), 0, 1)), outK = ease(clamp((t - B.ambOut) / 5, 0, 1));
  amb.visible = t > B.ambIn && outK < 1;
  amb.position.set(-7.4, 0, lerp(-240, -22, inK) + outK * 60); amb.rotation.y = Math.PI;
  const fl = Math.sin(t * 14) > 0; amb.userData.bar[0].material.color.set(fl ? '#ff2a2a' : '#4a0a0a'); amb.userData.bar[1].material.color.set(!fl ? '#f4efe0' : '#3a3a3a'); amb.userData.glow[0].material.opacity = fl ? .9 : 0; amb.userData.glow[1].material.opacity = fl ? 0 : .7;
  // traffic
  const tr = kf(TL.traffic, t, false); let ci = 0; const dummy = new THREE.Object3D();
  CARS.forEach((c, i) => {
    let z = c.z0 - c.sp * t; if (!c.abandoned) z = 20 - ((20 - z) % 400 + 400) % 400;
    const vis = c.abandoned ? (t > B.cabAbandon && t < B.return + 1) : c.rank < tr;
    dummy.position.set(c.x, 0, z); dummy.rotation.set(0, c.abandoned ? .35 : 0, 0); dummy.scale.setScalar(vis ? 1 : 0); dummy.updateMatrix();
    CARM.body.setMatrixAt(i, dummy.matrix); CARM.glass.setMatrixAt(i, dummy.matrix);
    for (let w = 0; w < 4; w++){ const wx = w % 2 ? .82 : -.82, wz = w < 2 ? 1.4 : -1.5; const m = dummy.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(wx, .34, wz)); CARM.wheel.setMatrixAt(i * 4 + w, m); }
    const sm = dummy.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.6, -.1)); if (!c.taxi) sm.scale(V(0, 0, 0)); CARM.sign.setMatrixAt(i, sm);
  });
  Object.values(CARM).forEach(m => { m.instanceMatrix.needsUpdate = true; });
  CARM.body.count = CARM.glass.count = CARM.sign.count = CARS.length; CARM.wheel.count = CARS.length * 4;
}
function drawTempScreen(temp, t){
  const g = tempG, w = 512, h = 320; g.fillStyle = '#07090c'; g.fillRect(0, 0, w, h);
  const hot = temp >= 41; g.fillStyle = hot ? '#ff5a2a' : '#ffd34d'; g.textAlign = 'center'; g.font = '700 168px Tinos'; g.fillText(Math.round(temp) + '°', w / 2, 200);
  g.font = '400 40px Tinos'; g.fillStyle = '#e8e4da'; g.fillText(Math.round(temp * 9 / 5 + 32) + '°F  ·  TIMES SQ', w / 2, 270); tempTex.needsUpdate = true;
}

// crowd state per frame
const CSTATE = CROWD.map(() => ({}));
function updatePeople(t){
  const dens = kf(TL.crowd, t, false), hk = heatK(t);
  CROWD.forEach((p, i) => {
    const s = CSTATE[i];
    let z = p.z, x = p.x;
    if (p.dir){ const span = p.x < -17 ? 270 : 224, top = p.x < -17 ? 12 : -4; z = top - (((top - (p.z + p.dir * p.sp * t)) % span) + span) % span; }
    const lying = p.willLie && t > p.lieT && t < p.goneT && t < B.return;
    s.x = x; s.z = z; s.yaw = p.dir ? (p.dir > 0 ? 0 : Math.PI) : p.yaw;
    s.walk = p.dir && !lying ? (p.sp * t * 6 + p.ph) : null;
    if (lying){ s.walk = null; s.z = p.z; }
    s.vis = lying || (p.rank < dens);
    s.lie = lying ? 1 : 0;
    s.phone = !lying && p.phone && t < 30;
    s.fan = !lying && !p.dir && p.fan && hk > .2;
    s.hx = lying ? 0 : (hk > .4 ? .25 : 0);
  });
  updateCrowd(crowd, CSTATE, t);

  // ---- hero cast ----
  const show = (g, v) => { g.visible = v; };
  // sunglasses come out
  Object.values(CAST).forEach(g => { if (g.userData.shades) g.userData.shades.visible = t > B.sunglasses && t < B.return + 1 && hash(g.id) < .6; });
  const C = CAST, back = t > B.return + .5;
  // the old man: fans himself, faints, is helped, medics, stretcher
  { const g = C.old;
    const track = [[0, 'stand'], [14, 'fan'], [B.faint1 - 1.2, 'sway', .6], [B.faint1, 'buckle', .45], [B.faint1 + .45, 'lieSide', .7]];
    let p = poseAt(track, t);
    const onStretcher = t > B.stretcher;
    show(g, !onStretcher || t < B.stretcher + 7 ? true : false);
    if (onStretcher){
      const k = clamp((t - B.stretcher) / 6, 0, 1);
      STRETCH.visible = k < 1; const sx = lerp(.7, -5.6, ease(k)), sz = lerp(-8.8, -20.5, ease(k));
      STRETCH.position.set(sx, .14, sz); STRETCH.rotation.y = Math.atan2(-5.6 - .7, -20.5 + 8.8);
      const ry = STRETCH.rotation.y; g.position.set(sx + Math.sin(ry) * .85, .14 + .95, sz + Math.cos(ry) * .85); g.rotation.y = ry; p = blendPose(POSE.lieBack, POSE.lieBack, 0); p = Object.assign({}, p, { by: 0 });
      g.visible = k < 1;
    } else { g.position.copy(g.userData.home); g.rotation.y = g.userData.yaw0; STRETCH.visible = false; }
    if (p.aR && t > 14 && t < B.faint1 - 1.2){ p = Object.assign({}, p, { aR: [p.aR[0], p.aR[1] + .12 * Math.sin(t * 9), p.aR[2] + .3 * Math.sin(t * 11)] }); }
    setPose(g, p); if (back) g.visible = true, g.position.copy(g.userData.home), setPose(g, POSE.stand);
  }
  // the woman who helps him, then steps back for the medics
  { const g = C.help; const track = [[0, 'phone'], [B.faint1 + .2, 'stand', .3], [B.help1, 'kneel', .6], [B.medics, 'stand', .7], [B.medics + .8, 'holdHead', .6]];
    show(g, t < B.stretcher + 2 || back); setPose(g, back ? POSE.phone : poseAt(track, t));
    if (t > B.help1 - .3 && t < B.medics + .5){ g.position.set(-.35, .14, -7.45); g.rotation.y = 3.0; } else if (t >= B.medics + .5){ g.position.set(2.8, .14, -7.4); g.rotation.y = -1.4; } else { g.position.copy(g.userData.home); g.rotation.y = g.userData.yaw0; } }
  // medics
  for (const [k, name] of [[0, 'medic1'], [1, 'medic2']]){ const g = C[name]; const on = t > B.medics - 1.2 && t < B.ambOut;
    show(g, on); if (!on) continue;
    const walkIn = clamp((t - (B.medics - 1.2)) / 1.2, 0, 1);
    if (t < B.stretcher){ const from = V(-6.2, .14, -20 + k), to = g.userData.home; g.position.lerpVectors(from, to, ease(walkIn)); g.rotation.y = walkIn < 1 ? Math.atan2(to.x - from.x, to.z - from.z) : g.userData.yaw0;
      let p = walkIn < 1 ? walkLegs(Object.assign({}, POSE.stand), t * 7, 1) : poseAt([[0, 'stand'], [B.medics, 'kneelCPR', .5]], t); if (k === 1 && walkIn >= 1) p = POSE.kneel; setPose(g, p); }
    else { const s = clamp((t - B.stretcher) / 6, 0, 1); const sx = lerp(.7, -5.6, ease(s)), sz = lerp(-8.8, -20.5, ease(s)); const ang = Math.atan2(-6.3, -11.7);
      g.position.set(sx + Math.sin(ang) * (k ? 1.25 : -1.25), .14, sz + Math.cos(ang) * (k ? 1.25 : -1.25)); g.rotation.y = ang; setPose(g, s < 1 ? walkLegs(Object.assign({}, POSE.carry), t * 6 + k * 3, .8) : POSE.stand); } }
  // the woman who sways and her friend who steadies her; later she sits, then lies down
  { const g = C.sway, f = C.friend;
    setPose(g, back ? POSE.stand : poseAt([[0, 'stand'], [B.sway, 'sway', .8], [B.sway + 3.5, 'stand', 1], [B.faint3 - .6, 'buckle', .5], [B.faint3, 'sitGround', .7], [B.faint3 + 2.2, 'lieBack', 1.2]], t));
    setPose(f, back ? POSE.stand : poseAt([[0, 'stand'], [B.sway + .5, 'steady', .6], [B.sway + 4, 'stand', .8], [B.faint3 - .2, 'kneel', .6]], t));
    const gone = t > 60 && !back; show(g, !gone); show(f, !gone); }
  // two more collapse at 41°
  { const g = C.f2; setPose(g, back ? POSE.stand : poseAt([[0, 'stand'], [18, 'brow', .8], [B.faint2 - .7, 'sway', .5], [B.faint2, 'buckle', .4], [B.faint2 + .4, 'lieSide', .6]], t)); show(g, back || t < 57); }
  { const g = C.f3; setPose(g, back ? POSE.stand : poseAt([[0, 'stand'], [22, 'drink', .8], [B.faint3 + .3, 'sitGround', .9], [B.faint3 + 2.5, 'slump', 1]], t)); show(g, back || t < 61); }
  // Elmo: head comes off, then he slumps against the pigeon pole
  { const g = C.elmo, eh = g.userData.elmoHead, u = g.userData;
    const off = t > B.elmoHead && !back, k = clamp((t - B.elmoHead) / .8, 0, 1);
    u.face.visible = off && k > .4;
    const hand = u.arms[1].hd;
    if (off && k >= 1){ if (eh.parent !== hand){ hand.add(eh); } eh.position.set(0, -.3, .12); eh.rotation.set(0, 0, 0); }
    else { if (eh.parent !== u.head) u.head.add(eh); eh.position.set(0, .06 + (off ? k * .35 : 0), off ? k * .2 : 0); }
    let p = back ? POSE.stand : poseAt([[0, 'stand'], [5, 'phone', .5], [8, 'stand', .5], [B.elmoHead - .3, 'holdHead', .4], [B.elmoHead + 1.0, 'stand', .5], [B.elmoSlump, 'slump', 1.0]], t);
    g.position.copy(g.userData.home); g.rotation.y = g.userData.yaw0;
    setPose(g, p); show(g, back || t < 63); }
  // hot-dog vendor collapses behind his cart; a man kneels by him
  { const g = C.vendor, w = C.witness;
    setPose(g, back ? POSE.stand : poseAt([[0, 'stand'], [16, 'brow', .8], [B.vendor - 1, 'sway', .5], [B.vendor, 'buckle', .45], [B.vendor + .45, 'lieSide', .7]], t));
    show(g, back || t < 66);
    const wOn = t > B.witness - 1.5 && t < 66 && !back; show(w, wOn);
    if (wOn){ const k = clamp((t - (B.witness - 1.5)) / 1.4, 0, 1); w.position.set(lerp(CART.x - 1.2, CART.x - 2.1, ease(k)), .14, lerp(CART.z - 5, CART.z + .9, ease(k))); w.rotation.y = k < 1 ? -.1 : 2.6; setPose(w, k < 1 ? walkLegs(Object.assign({}, POSE.stand), t * 7, 1) : POSE.kneel); }
    else if (back){ w.visible = false; } }
  // ice cream man and his line (they leave as it gets hot)
  { const on = t > B.iceLine - .5 && t < 26; LINE.forEach((g, i) => { show(g, on && t < 22 - i * .9); setPose(g, i === 0 ? POSE.phone : POSE.stand); }); show(C.iceman, t < 40 || back); setPose(C.iceman, t > 30 && !back ? POSE.brow : POSE.stand); }
  // water seller
  { const g = C.seller; show(g, t > B.water - .4 && t < 44); coolerG.visible = t > B.water - .4 && t < 44; setPose(g, poseAt([[0, 'stand'], [B.water, 'drink', .5]], t)); g.userData.arms[1].sh.rotation.x = -2.5 + .15 * Math.sin(t * 5); }
  // people on the steps fan themselves, then leave
  SITTERS.forEach(({ g, i, fan }) => { const leave = 29 + i * .7; const on = t > B.stepsSit - 1 + i * .25 && t < leave; show(g, on); let p = fan && t > B.stepsSit ? POSE.sitStepFan : POSE.sitStep; if (fan && t > B.stepsSit){ p = Object.assign({}, p, { aR: [p.aR[0], p.aR[1] + .1 * Math.sin(t * 10 + i), p.aR[2] + .35 * Math.sin(t * 12 + i)] }); } setPose(g, p); });
  // the last two walk into the subway
  { const on = t > B.subwayWalk - 1 && t < B.subwayWalk + 6; for (const [k, name] of [[0, 'walkA'], [1, 'walkB']]){ const g = C[name]; show(g, on || back); if (!on){ setPose(g, POSE.stand); g.position.copy(g.userData.home); continue; }
      const s = clamp((t - (B.subwayWalk - 1)) / 5, 0, 1); const from = V(3.0 + k * .6, .14, -13.8), to = V(SUBWAY.x - .3 + k * .6, .14, SUBWAY.z - 3.8);
      g.position.lerpVectors(from, to, s); g.position.y = .14 - Math.max(0, (s - .55) / .45) * 2.4; g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      let p = walkLegs(Object.assign({}, k ? POSE.stand : POSE.steady), t * 6 + k, .9); setPose(g, p); } }
}

// ---------- 2D text layer (#02/#08 layout) ----------
function shadowOn(a = .45){ ctx.shadowColor = `rgba(0,0,0,${Math.min(1, a * 1.4)})`; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; }
const AMBER = '#f5a33b';
function counterBlock(x, y, label, value, sub, alpha, vcol = '#fff'){
  ctx.save(); ctx.globalAlpha = alpha; shadowOn(.9); ctx.shadowBlur = 18; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.font = '400 21px Tinos'; ctx.letterSpacing = '5px'; ctx.globalAlpha = alpha * .88; ctx.fillText(label, x, y);
  ctx.font = '400 66px Tinos'; ctx.letterSpacing = '1px'; ctx.globalAlpha = alpha; ctx.fillStyle = vcol; ctx.fillText(value, x - 2, y + 66); ctx.fillStyle = '#fff';
  if (sub){ ctx.font = '400 17px Tinos'; ctx.letterSpacing = '4px'; ctx.globalAlpha = alpha * .82; ctx.fillText(sub, x, y + 98); }
  ctx.restore();
}
function fmtSurv(hrs){ if (hrs >= 47.5){ const d = Math.round(hrs / 24); return `≈ ${d} days`; } const h = Math.round(hrs); return `≈ ${h} hours`; }
function resolve(v, t){
  const temp = T(t);
  if (v === '@temp') return `${Math.round(temp)} °C`;
  if (v === '@tempF') return `${Math.round(temp * 9 / 5 + 32)} °F`;
  if (v === '@surv') return fmtSurv(survivalHours(temp));
  return v;
}
function drawCounters(t){
  const pos = [[64, 250], [64, 420]];
  for (const set of TL.counters){ const [a, b] = set.t; if (t < a - .01 || t > b + .01) continue;
    set.items.forEach((it, i) => { const start = Math.max(a, it.from != null ? it.from : a), end = Math.min(b, it.to != null ? it.to : b), al = fadeWin(t, start, end, .45); if (al <= 0) return;
      const slot = it.slot != null ? it.slot : i; const hot = it.value === '@temp' && T(t) >= 41 || it.value === '@surv' && survivalHours(T(t)) < 24;
      counterBlock(pos[slot][0], pos[slot][1], it.label, resolve(it.value, t), resolve(it.sub, t), al, hot ? AMBER : '#fff'); }); }
}
function drawCaption(t){
  for (const c of TL.captions){ const [a, b, text] = c; if (t < a || t > b) continue;
    const al = fadeWin(t, a, b, .3), y0 = c[3] || TL.captionY || 1010;
    ctx.save(); ctx.globalAlpha = al; shadowOn(.85); ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'italic 400 48px Tinos'; ctx.letterSpacing = '0px';
    const lines = text.split('\n'); lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * 60 - (lines.length - 1) * 30)); ctx.restore(); }
}
function drawTitle(t){
  // full title from frame 0, no fade-in (video rule 1)
  const al = t < 3 ? 1 : clamp(1 - (t - 3) / .5, 0, 1); if (al <= 0) return;
  ctx.save(); ctx.globalAlpha = al; shadowOn(.8); ctx.shadowBlur = 20; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '400 76px Tinos'; ctx.letterSpacing = '0px';
  ctx.fillText(TL.title[0], W / 2, 330); ctx.fillText(TL.title[1], W / 2, 418); ctx.restore();
}
function drawBar(t, alpha){
  if (alpha <= 0) return;
  const marks = TL.bar.marks, p = kf(TL.bar.progress, t), Y = 152, X0 = marks[0][1], X1 = 1000;
  const xAt = q => { const i = Math.floor(clamp(q, 0, marks.length - 1)), f = q - i; if (i >= marks.length - 1) return marks[marks.length - 1][1]; return lerp(marks[i][1], marks[i + 1][1], f); };
  ctx.save(); ctx.globalAlpha = alpha; shadowOn(.45);
  ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X0, Y); ctx.lineTo(X1, Y); ctx.stroke();
  ctx.strokeStyle = AMBER; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X0, Y); ctx.lineTo(xAt(p), Y); ctx.stroke();
  marks.forEach(([label, x], i) => { const reached = p >= i - .001, now = reached && p < i + 1 - .001;
    ctx.beginPath(); ctx.arc(x, Y, now ? 10 : 8, 0, Math.PI * 2); ctx.fillStyle = reached ? AMBER : '#1d2230'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = reached ? AMBER : 'rgba(255,255,255,.65)'; ctx.stroke();
    ctx.font = '400 23px Tinos'; ctx.letterSpacing = '5px'; ctx.textAlign = 'left'; ctx.fillStyle = reached ? AMBER : 'rgba(255,255,255,.72)'; ctx.fillText(label, x - 14, Y + 42); });
  ctx.restore();
}
function sceneEnd(t, t0){
  const a = smooth((t - t0 - .3) / .8) * (TL.loopAt ? 1 - smooth((t - (TL.loopAt - .45)) / .45) : 1);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '400 64px Tinos'; ctx.letterSpacing = '0px'; ctx.fillText(TL.title[0], W / 2, 860); ctx.fillText(TL.title[1], W / 2, 940);
  ctx.globalAlpha = a * .85; ctx.font = '400 30px Tinos'; ctx.letterSpacing = '3px';
  const parts = TL.endCard.fine.split('  ·  '); ctx.fillText(parts[0], W / 2, 1050);
  if (parts[1]){ const words = parts[1].split(' '); let line = '', y = 1100; for (const w of words){ const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > 900){ ctx.fillText(line, W / 2, y); y += 44; line = w; } else line = test; } if (line) ctx.fillText(line, W / 2, y); }
  ctx.globalAlpha = a * smooth((t - t0 - 1.6) / .8) * .92; ctx.font = '400 30px Tinos'; ctx.letterSpacing = '6px'; ctx.fillText(TL.endCard.hook, W / 2, 1290); ctx.restore();
}
// rain streaks (2D, over the picture)
function drawRain(t, k){
  if (k <= .01) return; const r = rng(Math.floor(t * 30) + 7);
  ctx.save(); ctx.strokeStyle = `rgba(220,228,236,${.32 * k})`; ctx.lineWidth = 2;
  ctx.beginPath(); for (let i = 0; i < 520 * k; i++){ const x = r() * W * 1.2 - 60, y = r() * H, l = 40 + r() * 70; ctx.moveTo(x, y); ctx.lineTo(x - l * .18, y + l); } ctx.stroke(); ctx.restore();
}

// the 3D picture onto the 2D canvas: warm grade, then heat shimmer as wobbling horizontal slices
function drawPicture(t){
  const hk = SHIM.heat, st = SHIM.storm;
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const f = [];
  if (hk > .01) f.push(`sepia(${(.42 * hk).toFixed(3)})`, `saturate(${(1 + .18 * hk).toFixed(3)})`, `brightness(${(1 + .1 * hk).toFixed(3)})`, `contrast(${(1 - .12 * hk).toFixed(3)})`);
  if (st > .01) f.push(`saturate(${(1 - .35 * st).toFixed(3)})`, `brightness(${(1 - .12 * st).toFixed(3)})`);
  ctx.filter = f.length ? f.join(' ') : 'none';
  ctx.drawImage(glc, 0, 0, W, H);
  if (hk > .02){
    // shimmer: strongest across the far street, around mid-frame
    const S = 4, gh = glc.height / H;
    for (let y = Math.floor(H * .25); y < H * .72; y += S){
      const band = Math.exp(-Math.pow((y / H - .47) / .13, 2));
      // smooth, slowly rising waves (no slice-to-slice jumps)
      const off = Math.sin(y * .045 - t * 5.3) * .6 + Math.sin(y * .017 + t * 2.1) * .4 + (noise1(y * .02 - t * 1.7) - .5) * .8;
      const dx = off * 3.2 * hk * band; if (Math.abs(dx) < .25) continue;
      ctx.drawImage(glc, 0, y * gh, glc.width, S * gh + 1, dx, y, W, S + 1);
    }
  }
  ctx.filter = 'none';
  // haze veil and storm tint
  if (hk > .01){ const g = ctx.createLinearGradient(0, H * .2, 0, H * .7); g.addColorStop(0, `rgba(250,232,196,${.24 * hk})`); g.addColorStop(1, `rgba(250,228,190,${.06 * hk})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (st > .01){ ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,165,185,${.6 * st})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}

// ---------- frame ----------
window.setup = (tl) => { TL = tl; B = tl.beats; return true; };
window.renderFrame = (t) => {
  if (TL.loopAt && t >= TL.loopAt){ const k = smooth((t - TL.loopAt) / (TL.duration - 1 / 30 - TL.loopAt)); window.renderFrame(0); ctx.fillStyle = `rgba(0,0,0,${1 - k})`; ctx.fillRect(0, 0, W, H); return; }
  if (t >= TL.endAt){ sceneEnd(t, TL.endAt); return; }
  updateWorld(t); updatePeople(t);
  renderer.render(scene, camera);
  drawPicture(t);
  const hk = heatK(t) * (1 - isStorm(t));
  // sun glare from the top right as it heats up
  if (hk > .05){ const g = ctx.createRadialGradient(W * .9, -80, 0, W * .9, -80, 900); g.addColorStop(0, `rgba(255,236,190,${.75 * hk})`); g.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  drawRain(t, kf(TL.storm, t));
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * .34, W / 2, H / 2, H * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const tg = ctx.createLinearGradient(0, 0, 0, 600); tg.addColorStop(0, 'rgba(0,0,0,.42)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 600);
  const bg = ctx.createLinearGradient(0, H - 700, 0, H); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = bg; ctx.fillRect(0, H - 700, W, 700);
  // fade from black only on the very first frames of the end-card return (frame 0 itself is fully lit: rule 1)
  const endFade = clamp((t - (TL.endAt - .6)) / .6, 0, 1);
  drawBar(t, 1 - endFade); drawTitle(t); drawCounters(t); drawCaption(t);
  if (endFade > 0){ ctx.fillStyle = `rgba(0,0,0,${endFade})`; ctx.fillRect(0, 0, W, H); }
};
window.setRes = (w, h) => { renderer.setSize(w, h, false); };
window.DBG = { THREE, scene, camera, renderer, CAST, CAM };
window.ready = true;
