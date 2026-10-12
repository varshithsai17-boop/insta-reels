// People: the #08 person builder (sculpted head, eyes, hair, torso texture) plus
// summer clothes, a waist/body rig for collapses, pose blending, and an instanced crowd.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smooth, rng, h2, col, V, STD, BASIC, mesh, box, rbox, cyl, sph } from './util.js';

export const SKIN = ['#efcdb2', '#e0b394', '#c99573', '#a8714d', '#7d5033', '#5a3923', '#d9a786', '#f2d8c2', '#8f5e3c'];
export const HAIRC = ['#1b1511', '#2c2019', '#45311f', '#6a4a2e', '#8a6844', '#a7a197', '#d2cdc2', '#101010', '#5b3a22'];
const HS = V(.09, .112, .1);

function headDeform(x0, y0, z0, feat){
  const fr = smooth(z0 * 2.4 + .1), jaw = smooth((-y0 - .12) / .88);
  let x = x0 * .88 * (1 - .2 * jaw * jaw), y = y0, z = z0 * (1 - .08 * jaw);
  if (z0 < 0) z *= 1 + .1 * smooth(y0 + .2);
  if (feat){
    z += .05 * jaw * Math.exp(-x0 * x0 / .08) * fr;
    if (z > .62) z = .62 + (z - .62) * .55;
    z += .055 * Math.exp(-((y0 - .27) ** 2) / 5e-3) * Math.exp(-x0 * x0 / .2) * fr;
    for (const s of [-1, 1]) z -= .06 * Math.exp(-((x0 - s * .36) ** 2) / .016 - (y0 - .13) ** 2 / .01) * fr;
    z += (.17 * Math.exp(-x0 * x0 / 6e-3 - (y0 + .02) ** 2 / .045) + .12 * Math.exp(-x0 * x0 / .012 - (y0 + .19) ** 2 / 6e-3)) * fr;
    for (const s of [-1, 1]) z += .03 * Math.exp(-((x0 - s * .1) ** 2) / 4e-3 - (y0 + .22) ** 2 / 3e-3) * fr;
    z += .03 * Math.exp(-x0 * x0 / .035 - (y0 + .41) ** 2 / 3e-3) * fr;
    for (const s of [-1, 1]) z += .03 * Math.exp(-((x0 - s * .46) ** 2) / .03 - (y0 + .04) ** 2 / .02) * fr;
  }
  return [x, y, z];
}
const EYE = (() => { const z0 = Math.sqrt(.8535); const [x, y, z] = headDeform(.36, .13, z0, true); return { x: x * HS.x, y: y * HS.y, z: z * HS.z }; })();

function headGeo(seg = 48, feat = true, crowd = false){
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75));
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++){
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i), [x, y, z] = headDeform(x0, y0, z0, feat);
    p.setXYZ(i, x * HS.x, y * HS.y, z * HS.z);
    const fr = smooth(z0 * 2.4 + .1); let r = 1, gg = 1, b = 1;
    if (feat){ const lip = Math.exp(-x0 * x0 / .03 - (y0 + .41) ** 2 / 28e-4) * fr; r = lerp(1, .82, lip); gg = lerp(1, .55, lip); b = lerp(1, .53, lip); const cheek = Math.exp(-((Math.abs(x0) - .45) ** 2) / .03 - (y0 + .12) ** 2 / .03) * fr * .06; gg -= cheek; b -= cheek; }
    c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  const parts = [g], tint = (geo, r, gg, b) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  for (const s of [-1, 1]){ const e = new THREE.SphereGeometry(1, 12, 10); e.scale(9e-3, .029, .019); e.translate(s * .078, -4e-3, -6e-3); parts.push(tint(e, .96, .9, .88)); }
  const nk = new THREE.CylinderGeometry(.052, .058, .13, 16); nk.translate(0, -.125, -.014); parts.push(tint(nk, .95, .93, .92));
  if (crowd) for (const s of [-1, 1]){
    const e = new THREE.SphereGeometry(1, 8, 6); e.scale(9e-3, 65e-4, 6e-3); e.translate(s * EYE.x, EYE.y, EYE.z + 6e-3); parts.push(tint(e, .12, .1, .1));
    const br = new THREE.BoxGeometry(.026, 6e-3, 6e-3); br.rotateZ(-s * .12); br.translate(s * EYE.x, .031, EYE.z + .01); parts.push(tint(br, .3, .25, .22));
  }
  return mergeGeometries(parts.map(q => q.index ? q.toNonIndexed() : q).map(q => { q.deleteAttribute('uv'); return q; }));
}
function hairGeo(style, seg = 40){
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)), p = g.attributes.position, keep = new Uint8Array(p.count), HL = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++){
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i), a = Math.abs(Math.atan2(x0, z0)) / Math.PI; let hl;
    if (style === 'long') hl = a < .5 ? lerp(.42, -.25, smooth(a / .5)) : lerp(-.25, -.95, smooth((a - .5) / .5));
    else if (style === 'reced') hl = a < .5 ? lerp(.66, .16, smooth(a / .5)) : lerp(.16, -.6, smooth((a - .5) / .5));
    else if (style === 'bun') hl = a < .5 ? lerp(.44, .12, smooth(a / .5)) : lerp(.12, -.5, smooth((a - .5) / .5));
    else hl = a < .5 ? lerp(.45, .14, smooth(a / .5)) : lerp(.14, -.62, smooth((a - .5) / .5));
    keep[i] = y0 > hl ? 1 : 0; HL[i] = hl;
  }
  const idx0 = g.index.array, used = new Uint8Array(p.count), ni = [];
  for (let i = 0; i < idx0.length; i += 3) if (keep[idx0[i]] || keep[idx0[i + 1]] || keep[idx0[i + 2]]){ ni.push(idx0[i], idx0[i + 1], idx0[i + 2]); used[idx0[i]] = used[idx0[i + 1]] = used[idx0[i + 2]] = 1; }
  for (let i = 0; i < p.count; i++){
    let x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
    if (used[i] && !keep[i]){ const hl = HL[i], rxz = Math.hypot(x0, z0), want = Math.sqrt(Math.max(0, 1 - hl * hl)); if (rxz > 1e-6){ x0 *= want / rxz; z0 *= want / rxz; } y0 = hl; }
    const a = Math.abs(Math.atan2(x0, z0)) / Math.PI, infl = style === 'long' ? 1.09 : 1.06; let [x, y, z] = headDeform(x0, y0, z0, false);
    if (style === 'long' && y0 < .1 && a > .3){ x *= 1.08; z -= .04; }
    p.setXYZ(i, x * HS.x * infl, (y + .02) * HS.y * infl, z * HS.z * infl);
  }
  g.setIndex(ni); g.computeVertexNormals();
  let out = g.toNonIndexed(); out.deleteAttribute('uv');
  if (style === 'long'){ const fall = rbox(.15, .2, .05, .02); fall.translate(0, -.12, -.075); fall.deleteAttribute('uv'); out = mergeGeometries([out, fall.toNonIndexed()]); }
  if (style === 'bun'){ const bn = new THREE.SphereGeometry(.04, 14, 10); bn.translate(0, .05, -.1); bn.deleteAttribute('uv'); out = mergeGeometries([out, bn.toNonIndexed()]); }
  return out;
}
const HEAD_HI = headGeo(48, true), HAIR_HI = { short: hairGeo('short', 56), long: hairGeo('long', 56), reced: hairGeo('reced', 56), bun: hairGeo('bun', 56) };
function torsoProfile(female = false, jacketLen = .84){
  const sw = female ? .9 : 1;
  return [[0, jacketLen], [.168, jacketLen], [.164, .95], [female ? .145 : .158, 1.05], [.172, 1.17], [.188 * sw, 1.27], [.198 * sw, 1.35], [.2 * sw, 1.4], [.185 * sw, 1.445], [.14, 1.48], [.085, 1.505], [.062, 1.515], [0, 1.52]].map(([r, y]) => new THREE.Vector2(r, y));
}
function torsoGeo(female = false){ const g = new THREE.LatheGeometry(torsoProfile(female), 36); g.scale(1, 1, .62); return g; }
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const vHalf = (y, top, bot, w) => clamp((y - bot) / (top - bot), 0, 1) * w;
const TEXCACHE = {};
// jacket/shirt texture from #08; `tee` draws a plain T-shirt with a crew neck and an optional chest print
function torsoTex(o){
  const key = [o.female, o.jacket, o.shirt, o.tie, o.open, o.tee, o.print, o.stripe].join('|'); if (TEXCACHE[key]) return TEXCACHE[key];
  const S = 256, prof = torsoProfile(!!o.female), n = prof.length, cv2 = document.createElement('canvas'); cv2.width = cv2.height = S;
  const g = cv2.getContext('2d'), im = g.createImageData(S, S), d = im.data, J = hexRGB(o.jacket || '#23262d'), SH = hexRGB(o.shirt || '#dcd9d2'), T = o.tie ? hexRGB(o.tie) : null, PR = o.print ? hexRGB(o.print) : null, ST = o.stripe ? hexRGB(o.stripe) : null;
  const vb = o.female ? 1.33 : 1.27, vw = o.female ? .072 : .066, aa = (dist, w = 25e-4) => clamp(.5 - dist / w, 0, 1);
  for (let py = 0; py < S; py++){
    const f = (1 - (py + .5) / S) * (n - 1), j = Math.min(n - 2, Math.floor(f)), k = f - j, r = lerp(prof[j].x, prof[j + 1].x, k), y = lerp(prof[j].y, prof[j + 1].y, k);
    for (let px = 0; px < S; px++){
      const u = (px + .5) / S, ph = u * Math.PI * 2, x = Math.sin(ph) * r, z = Math.cos(ph) * r * .62;
      const nz = (h2(px >> 1, py >> 1) - .5) * 6; let c = J.map(q => q + nz);
      if (o.tee){
        // crew neck + optional print + hi-vis stripe
        if (z > 0 && y > 1.47 && Math.abs(x) < .07) c = c.map(q => q * .78);
        if (PR && z > 0 && y > 1.2 && y < 1.36 && Math.abs(x) < .08) c = PR.slice();
        if (ST && Math.abs(y - 1.12) < .022) c = ST.slice();
      } else if (z > 0){
        const hw = y > vb ? vHalf(y, 1.49, vb, vw) : -1, dV = Math.abs(x) - hw; let shirt = y > vb ? aa(dV) : 0; if (y > 1.494) shirt = 1;
        const lap = y > vb - .02 && y < 1.49 ? aa(Math.abs(dV - 6e-3) - 3e-3, 2e-3) * .55 : 0;
        c = c.map(q => q * (1 - lap)); c = c.map((q, i) => lerp(q, SH[i], shirt));
        if (T && y > 1.24 && y < 1.488){ const tw = y > 1.458 ? .021 : .0165 + (1.458 - y) * .028, ti = aa(Math.abs(x) - tw) * (y < 1.25 ? aa(1.25 - y, 4e-3) : 1); c = c.map((q, i) => lerp(q, T[i], ti)); }
        if (!o.open) for (const by of [1.205, 1.115]){ const bd = Math.hypot(x, y - by) - 75e-4, bc = aa(bd, 15e-4); c = c.map(q => q * (1 - .55 * bc)); }
      }
      const o4 = (py * S + px) * 4; d[o4] = clamp(c[0], 0, 255); d[o4 + 1] = clamp(c[1], 0, 255); d[o4 + 2] = clamp(c[2], 0, 255); d[o4 + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const tx = new THREE.CanvasTexture(cv2); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; TEXCACHE[key] = tx; return tx;
}
const TORSO_M = torsoGeo(false), TORSO_F = torsoGeo(true);
const armUpperGeo = cyl(.056, .049, .3, 14); armUpperGeo.translate(0, -.15, 0);
const armForeGeo = cyl(.048, .04, .27, 14); armForeGeo.translate(0, -.135, 0);
const handGeo = (() => { const p = rbox(.07, .095, .032, .014); p.translate(0, -.045, 0); const th = new THREE.CapsuleGeometry(.012, .035, 3, 8); th.rotateZ(.5); th.translate(.032, -.02, .012); const f = new THREE.CapsuleGeometry(.03, .02, 3, 10); f.scale(1.05, 1, .5); f.translate(0, -.1, 0); [p, th, f].forEach(q => q.deleteAttribute('uv')); return mergeGeometries([p.toNonIndexed(), th.toNonIndexed(), f.toNonIndexed()]); })();
const thighGeo = cyl(.085, .068, .45, 12); thighGeo.translate(0, -.225, 0);
const shinGeo = cyl(.064, .05, .42, 12); shinGeo.translate(0, -.21, 0);
const shoeGeo = rbox(.105, .08, .28, .03);
const eyeWhite = STD('#d8d2c8', .45), eyeIris = STD('#3a2618', .35), browMat = c => STD(c, .95);
const shadeMat = STD('#0b0b0d', .25);

// o: { jacket, pants, shirt, tie, skin, hair, hairStyle, female, tee, shorts, cap, print, stripe, shoe, sunglasses }
export function makePerson(o){
  const g = new THREE.Group(), U = {};
  const jm = STD(o.jacket || '#23262d', .9), pm = STD(o.pants || o.jacket || '#23262d', .9), sk = new THREE.MeshStandardMaterial({ color: o.skin, roughness: .62, metalness: 0, vertexColors: true }), skm = STD(o.skin, .62);
  const body = new THREE.Group(); g.add(body);
  const hips = new THREE.Group(); body.add(hips);
  const legs = [-1, 1].map(s => {
    const th = new THREE.Group(); th.position.set(s * .1, .95, 0); hips.add(th);
    mesh(thighGeo, pm, 0, 0, 0, th, 1);
    const kn = new THREE.Group(); kn.position.y = -.45; th.add(kn);
    mesh(shinGeo, o.shorts ? skm : pm, 0, 0, 0, kn, 1);
    mesh(shoeGeo, STD(o.shoe || '#121212', .55), 0, -.42, .045, kn, 1);
    return { th, kn };
  });
  if (o.skirt) mesh(cyl(.19, .26, .42, 20, true), STD(o.skirt, .9, { side: THREE.DoubleSide }), 0, .72, 0, hips, 1);
  const waist = new THREE.Group(); waist.position.y = .95; body.add(waist);
  const torso = new THREE.Group(); torso.position.y = -.95; waist.add(torso);
  mesh(o.female ? TORSO_F : TORSO_M, STD('#ffffff', .9, { map: torsoTex(o) }), 0, 0, 0, torso, 3);
  for (const s of [-1, 1]) mesh(sph(.06, 14, 10), jm, s * (o.female ? .18 : .198), 1.4, 0, torso, 1).scale.set(1, .85, .9);
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * (o.female ? .182 : .2), 1.4, 0); torso.add(sh);
    mesh(armUpperGeo, jm, 0, 0, 0, sh, 1);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    mesh(armForeGeo, o.tee ? skm : jm, 0, 0, 0, el, 1);
    const hd = new THREE.Group(); hd.position.y = -.275; el.add(hd);
    mesh(handGeo, skm, 0, 0, 0, hd, 1); hd.rotation.y = s * .2;
    return { sh, el, hd };
  });
  const neck = new THREE.Group(); neck.position.set(0, 1.548, 8e-3); torso.add(neck);
  const head = new THREE.Group(); neck.add(head); head.position.y = .1;
  const face = new THREE.Group(); head.add(face);
  mesh(HEAD_HI, sk, 0, 0, 0, face, 1);
  for (const s of [-1, 1]){
    const ez = EYE.z - 6e-3;
    mesh(sph(.0118, 12, 10), eyeWhite, s * EYE.x, EYE.y, ez, face);
    const ir = mesh(sph(74e-4, 10, 8), eyeIris, s * EYE.x, EYE.y - 5e-4, ez + 85e-4, face); ir.scale.z = .45;
    mesh(sph(.0128, 12, 8), sk, s * EYE.x, EYE.y + 68e-4, ez + 5e-4, face).scale.set(1.08, .5, 1.02);
    const br = mesh(rbox(.028, 58e-4, 8e-3, 26e-4), browMat(o.brow || (o.hair || '#2a2018')), s * (EYE.x + 2e-3), EYE.y + .0165, EYE.z + 6e-3, face); br.rotation.z = -s * .1;
  }
  if (o.hair !== null){ const hm = new THREE.Mesh(HAIR_HI[o.hairStyle || 'short'], STD(o.hair || '#2a2018', .95, { side: THREE.DoubleSide })); hm.castShadow = true; face.add(hm); }
  if (o.cap){ const c = new THREE.Group(); c.position.set(0, .07, 0); face.add(c); mesh(sph(.104, 20, 10).scale(1, .62, 1.08), STD(o.cap, .85), 0, 0, -.005, c, 1); mesh(cyl(.075, .075, .008, 18).scale(1, 1, .7), STD(o.cap, .85), 0, -.02, .1, c, 1); }
  // sunglasses (hidden until the beat)
  U.shades = new THREE.Group(); face.add(U.shades); U.shades.visible = !!o.sunglasses;
  for (const s of [-1, 1]) mesh(rbox(.034, .022, .008, .006), shadeMat, s * .03, EYE.y + .002, EYE.z + .012, U.shades);
  mesh(box(.014, .004, .004), shadeMat, 0, EYE.y + .008, EYE.z + .014, U.shades);
  Object.assign(U, { body, hips, waist, torso, legs, arms, neck, head, face, skm, jm });
  g.userData = U;
  g.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  setPose(g, POSE.stand);
  return g;
}

// ---------- poses ----------
// fields: drop (hips down), by/bx (body offset), lz/lx (body roll/pitch about the feet), bend/tilt/twist (waist),
// legs [th, kn] L/R, arms [shX, shZ, elX] L/R, hx/hy (head)
const P0 = { drop: 0, bx: 0, by: 0, bz: 0, lz: 0, lx: 0, bend: 0, tilt: 0, twist: 0, lL: [0, 0], lR: [0, 0], aL: [0, -.08, -.1], aR: [0, .08, -.1], hx: 0, hy: 0, hz: 0 };
const P = o => Object.assign({}, P0, o);
export const POSE = {
  stand: P({}),
  fan: P({ aR: [-1.9, .35, -1.5], hx: -.05 }),
  brow: P({ aR: [-2.5, .15, -2.1], hx: -.15 }),
  phone: P({ aR: [-1.55, .1, -.25], hx: -.12 }),
  drink: P({ aR: [-2.1, .25, -2.2], hx: -.35 }),
  sway: P({ tilt: .12, bend: .12, hx: .25, aL: [-.2, -.25, -.4], aR: [-.1, .3, -.3] }),
  steady: P({ aL: [-.9, -.75, -.3], hy: .35, twist: .25 }),            // hand on a friend's shoulder
  buckle: P({ drop: -.39, lL: [-1.0, 1.9], lR: [-.9, 1.85], bend: .35, hx: .5, aL: [-.15, -.25, -.2], aR: [-.1, .3, -.2] }),
  sitGround: P({ drop: -.82, lL: [-1.45, .2], lR: [-1.35, .35], bend: -.1, aL: [.55, -.25, -.2], aR: [.5, .25, -.2] }),
  slump: P({ drop: -.82, lL: [-1.5, .1], lR: [-1.2, .6], bend: .45, tilt: .35, hx: .6, hz: .3, aL: [.1, -.15, -.1], aR: [.0, .2, -.15] }),
  lieSide: P({ by: .2, lz: 1.5, lL: [-.35, .5], lR: [-.15, .2], bend: .15, aL: [-.8, -.2, -.3], aR: [-1.2, .2, -.6], hz: -.2 }),
  lieBack: P({ by: .14, lx: -1.5, bz: .0, lL: [-.1, .1], lR: [.05, .05], aL: [.1, -.5, -.1], aR: [.2, .6, -.2], hx: -.15 }),
  kneel: P({ drop: -.45, lL: [-1.5, 1.55], lR: [.08, 1.5], bend: .55, hx: .45, aL: [-.75, -.15, -.25], aR: [-.95, .2, -.3] }),
  kneelCPR: P({ drop: -.45, lL: [-1.5, 1.55], lR: [.08, 1.5], bend: .8, hx: .5, aL: [-1.25, .25, -.15], aR: [-1.25, -.25, -.15] }),
  sitStep: P({ drop: -.5, lL: [-1.5, 1.45], lR: [-1.45, 1.4], bend: .1, aL: [-.35, -.1, -.6], aR: [-.35, .1, -.6] }),
  sitStepFan: P({ drop: -.5, lL: [-1.5, 1.45], lR: [-1.45, 1.4], bend: .15, aL: [-.35, -.1, -.6], aR: [-1.9, .35, -1.6] }),
  carry: P({ aL: [-.35, -.05, -.5], aR: [-.35, .05, -.5] }),
  holdHead: P({ aL: [-.3, -.25, -.9], aR: [-.3, .25, -.9] }),
};
export function blendPose(a, b, k){ if (k <= 0) return a; if (k >= 1) return b; const o = {}; for (const key in P0){ const va = a[key], vb = b[key]; o[key] = Array.isArray(va) ? va.map((x, i) => lerp(x, vb[i], k)) : lerp(va, vb, k); } return o; }
export function setPose(g, p){
  const u = g.userData;
  u.body.position.set(p.bx, p.drop + p.by, p.bz); u.body.rotation.set(p.lx, 0, p.lz);
  u.waist.rotation.set(p.bend, p.twist, p.tilt);
  u.legs[0].th.rotation.set(p.lL[0], 0, 0); u.legs[0].kn.rotation.set(p.lL[1], 0, 0);
  u.legs[1].th.rotation.set(p.lR[0], 0, 0); u.legs[1].kn.rotation.set(p.lR[1], 0, 0);
  u.arms[0].sh.rotation.set(p.aL[0], 0, p.aL[1]); u.arms[0].el.rotation.set(p.aL[2], 0, 0);
  u.arms[1].sh.rotation.set(p.aR[0], 0, p.aR[1]); u.arms[1].el.rotation.set(p.aR[2], 0, 0);
  u.head.rotation.set(p.hx, p.hy, p.hz);
}
// pose track: [[t, poseName], ...] with smooth crossfades of `d` seconds
export function poseAt(track, t, d = .7){
  let cur = POSE[track[0][1]];
  for (let i = 1; i < track.length; i++){
    const [ti, name, di] = track[i]; if (t < ti) break;
    cur = blendPose(cur, POSE[name], smooth((t - ti) / (di || d)));
  }
  return cur;
}
export function walkLegs(p, ph, amt = 1){
  const s = Math.sin(ph);
  p.lL = [s * .45 * amt, Math.max(0, -Math.cos(ph)) * .65 * amt]; p.lR = [-s * .45 * amt, Math.max(0, Math.cos(ph)) * .65 * amt];
  p.aL = [-s * .3 * amt + p.aL[0] * (1 - amt), p.aL[1], p.aL[2]]; p.aR = [s * .3 * amt + p.aR[0] * (1 - amt), p.aR[1], p.aR[2]];
  return p;
}

// ---------- instanced crowd (distant people) ----------
function instGeo(g){ const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); if (n.attributes.color && !g.keepColor) {} return n; }
export function makeCrowd(spots, R){
  const n = spots.length;
  const legG = (() => { const t = cyl(.082, .056, .9, 8); t.translate(0, -.45, 0); const s = rbox(.1, .08, .26, .03); s.translate(0, -.91, .04); return mergeGeometries([instGeo(t), instGeo(s)]); })();
  const shoulders = fs => { const parts = [instGeo(fs)]; for (const s of [-1, 1]){ const q = sph(.058, 10, 8); q.scale(1, .85, .9); q.translate(s * .198, 1.4, 0); parts.push(instGeo(q)); } return mergeGeometries(parts); };
  const headC = headGeo(24, true, true), hairC = { short: hairGeo('short', 20), long: hairGeo('long', 20), reced: hairGeo('reced', 20), bun: hairGeo('bun', 20) };
  const handC = instGeo((() => { const h = rbox(.066, .095, .032, .013); h.translate(0, -.05, 0); return h; })());
  const mk = (geo, cnt, mat) => { const m = new THREE.InstancedMesh(geo, mat, cnt); m.castShadow = true; m.frustumCulled = false; return m; };
  const C = { list: spots };
  C.leg = mk(legG, n * 2, STD('#ffffff', .9));
  C.topM = mk(shoulders(TORSO_M.clone()), n, STD('#ffffff', .9)); C.topF = mk(shoulders(TORSO_F.clone()), n, STD('#ffffff', .9));
  C.head = mk(headC, n, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .65, vertexColors: true }));
  C.hair = {}; for (const k in hairC) C.hair[k] = mk(hairC[k], n, STD('#ffffff', .95, { side: THREE.DoubleSide }));
  C.upper = mk(instGeo(cyl(.055, .05, .3, 8).translate(0, -.15, 0)), n * 2, STD('#ffffff', .9));
  C.fore = mk(instGeo(cyl(.048, .042, .28, 8).translate(0, -.14, 0)), n * 2, STD('#ffffff', .9));
  C.hand = mk(handC, n * 2, STD('#ffffff', .62));
  C.phone = mk(rbox(.075, .15, .012, .008), n, STD('#141518', .5));
  C.screen = mk(new THREE.PlaneGeometry(.065, .135), n, BASIC('#cfe2ff'));
  const cnt = { topM: 0, topF: 0 }; const hc = {}; for (const k in C.hair) hc[k] = 0;
  spots.forEach((p, i) => {
    for (let a = 0; a < 2; a++){ C.leg.setColorAt(i * 2 + a, col(p.pant)); C.upper.setColorAt(i * 2 + a, col(p.shirt)); C.fore.setColorAt(i * 2 + a, col(p.tee ? p.skin : p.shirt)); C.hand.setColorAt(i * 2 + a, col(p.skin)); }
    const tm = p.female ? C.topF : C.topM; p.topIdx = p.female ? cnt.topF++ : cnt.topM++; tm.setColorAt(p.topIdx, col(p.shirt));
    C.head.setColorAt(i, col(p.skin)); p.hairIdx = hc[p.hs]++; C.hair[p.hs].setColorAt(p.hairIdx, col(p.hair));
  });
  C.topM.count = cnt.topM; C.topF.count = cnt.topF; for (const k in C.hair) C.hair[k].count = hc[k];
  C.group = new THREE.Group();
  C.meshes = [C.leg, C.topM, C.topF, C.head, C.upper, C.fore, C.hand, C.phone, C.screen, ...Object.values(C.hair)];
  C.meshes.forEach(m => C.group.add(m));
  return C;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const M4 = (x, y, z, rx, ry, rz, s = 1) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, s, s));
// state per person: { x, z, yaw, vis(0/1), walk(phase or null), lie (0..1), phone(0/1), fan(0/1) }
export function updateCrowd(C, states, t){
  let np = 0;
  C.list.forEach((p, i) => {
    const st = states[i];
    if (!st.vis){
      for (let a = 0; a < 2; a++){ C.leg.setMatrixAt(i * 2 + a, ZERO); C.upper.setMatrixAt(i * 2 + a, ZERO); C.fore.setMatrixAt(i * 2 + a, ZERO); C.hand.setMatrixAt(i * 2 + a, ZERO); }
      (p.female ? C.topF : C.topM).setMatrixAt(p.topIdx, ZERO); C.head.setMatrixAt(i, ZERO); C.hair[p.hs].setMatrixAt(p.hairIdx, ZERO); return;
    }
    const lie = st.lie || 0, walking = st.walk != null;
    const bob = walking ? Math.abs(Math.sin(st.walk)) * .03 : 0;
    // body root: lying people roll onto their side about the feet
    const base = M4(st.x, bob + lie * .2, st.z, 0, st.yaw, lie * 1.5, p.s);
    C.topMat = base;
    (p.female ? C.topF : C.topM).setMatrixAt(p.topIdx, base);
    const hm = base.clone().multiply(M4(0, 1.648, 0, (st.hx || 0) - .05 * (1 - lie), st.hy || 0, 0));
    C.head.setMatrixAt(i, hm); C.hair[p.hs].setMatrixAt(p.hairIdx, hm);
    for (let a = 0; a < 2; a++){
      const sd = a ? 1 : -1;
      const sw = walking ? Math.sin(st.walk + a * Math.PI) * .45 : 0;
      const legRx = lie ? (a ? -.3 : -.05) : sw;
      C.leg.setMatrixAt(i * 2 + a, base.clone().multiply(M4(sd * .1, .95, 0, legRx, 0, 0)));
      let ux = walking ? -sw * .7 : 0, uz = sd * .08, fx = -.12;
      if (st.fan && a === 1){ ux = -1.9 + .1 * Math.sin(t * 9 + p.ph); uz = .35; fx = -1.5 + .25 * Math.sin(t * 11 + p.ph); }
      if (st.phone && a === 1){ ux = -1.5; uz = .1; fx = -1.1; }
      if (lie){ ux = a ? -1.0 : -.4; uz = sd * .2; fx = -.4; }
      const sh = base.clone().multiply(M4(sd * (p.female ? .18 : .2), 1.4, 0, ux, 0, uz));
      C.upper.setMatrixAt(i * 2 + a, sh);
      const el = sh.clone().multiply(M4(0, -.3, 0, fx, 0, 0)); C.fore.setMatrixAt(i * 2 + a, el);
      const hd = el.clone().multiply(new THREE.Matrix4().makeTranslation(0, -.28, 0)); C.hand.setMatrixAt(i * 2 + a, hd);
      if (a === 1 && st.phone && np < C.list.length){ const ph = hd.clone().multiply(M4(0, -.07, .03, -Math.PI / 2 - ux - fx, 0, 0)); C.phone.setMatrixAt(np, ph); C.screen.setMatrixAt(np, ph.clone().multiply(M4(0, 0, -.0065, 0, Math.PI, 0))); np++; }
    }
  });
  C.phone.count = C.screen.count = np;
  C.meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
}
export { headGeo, hairGeo, TORSO_M, TORSO_F };
