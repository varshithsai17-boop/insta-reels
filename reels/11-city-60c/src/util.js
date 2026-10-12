// Shared helpers (same names and behaviour as #08's).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
export const ease = k => { k = clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function kf(arr, t, easeIt = true){ if (t <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++){ if (t <= arr[i][0]){ const a = arr[i-1], b = arr[i]; const k = (t - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], easeIt ? ease(k) : k); } } return arr[arr.length-1][1]; }
export function fadeWin(t, a, b, f = .4){ return clamp(Math.min((t - a) / f, (b - t) / f), 0, 1); }
// 0 before t0, ramps to 1 over d seconds
export const after = (t, t0, d = 1) => smooth((t - t0) / d);
export const col = h => new THREE.Color(h);
export function hash(n){ const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
export function noise1(x){ const i = Math.floor(x), f = x - i; return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f)); }
export function h2(i, j){ const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); }
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
// matte by default (look rules): roughness ~0.88, no metal
export const STD = (c, rough = .88, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: rough, metalness: 0 }, o));
export const BASIC = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
export function canvasTex(w, h, draw, srgb = true){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = 0){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (shadow & 1) m.castShadow = true; if (shadow & 2) m.receiveShadow = true; if (parent) parent.add(m); return m; }
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = .02, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
export const cyl = (r1, r2, h, s = 16, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
export const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
export const softTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
// puffy smoke/steam sprite texture
export const puffTex = canvasTex(128, 128, (g) => { const r = rng(7); for (let i = 0; i < 26; i++){ const x = 64 + (r() - .5) * 56, y = 64 + (r() - .5) * 56, rad = 14 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } });
export const glowSprite = (c, add = true) => new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: c, transparent: true, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: false }));
