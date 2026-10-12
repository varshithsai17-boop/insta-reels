// GPU renderer page logic (from the #08 v6 renderer): draws every frame on this computer's graphics card,
// encodes H.264 with WebCodecs, copies the pre-encoded AAC sound straight into the MP4 (no audio decoding
// in the browser), writes to the page's private storage when it can, and logs runs to the db `renders`.
import { Muxer, StreamTarget, ArrayBufferTarget } from 'mp4-muxer';
import TLD from './timeline.json';
import './src/main.js';

const AUDIO_B64 = window.AUDIO_B64 || '', AUDIO_SIZES = window.AUDIO_SIZES || [];
const FPS = TLD.fps, NF = window.TEST_NF || Math.round(TLD.duration * FPS);
const LABEL = window.__LABEL || '', BUILD = window.__BUILD || '', FILENAME = window.__FILENAME || 'reel.mp4';
const cv = document.getElementById('c');
const useCap = name => (window.claude && window.claude.use ? window.claude.use(name) : Promise.resolve(null)).catch(() => null);
const $ = id => document.getElementById(id);
const yieldNow = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);
let busy = false, result = null, runRef = null, dbP = null, logQ = Promise.resolve();
function db(){ return dbP || (dbP = useCap('db')), dbP; }
function log(patch, create){
  return logQ = logQ.then(async () => {
    try {
      const d = await within(db(), 12e3); if (!d) return;
      if (create || !runRef){ runRef = d.collection('renders').doc(); await within(runRef.set(Object.assign({ at: new Date().toISOString(), reel: LABEL, ua: navigator.userAgent, build: BUILD }, patch)), 12e3); }
      else await within(runRef.update(patch), 12e3);
    } catch (e){ console.error('log', e); }
  }), logQ;
}
function say(m){ $('status').textContent = m; }
function fmt(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
async function pickVideo(){
  for (const codec of window.TEST_VCODEC ? [window.TEST_VCODEC] : ['avc1.640033', 'avc1.640034', 'avc1.4d0033']){
    const cfg = { codec, width: 1080, height: 1920, bitrate: window.TEST_BITRATE || 14e6, framerate: FPS, latencyMode: 'quality' };
    if (codec.startsWith('avc')) cfg.avc = { format: 'avc' };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch {}
  }
  return null;
}
function audioFeeder(){
  const n = Math.min(AUDIO_SIZES.length, Math.ceil(TLD.duration * 48e3 / 1024));
  if (!n) throw new Error('no sound data in the page');
  const bytes = Uint8Array.from(atob(AUDIO_B64), c => c.charCodeAt(0)), asc = new Uint8Array([17, 144]), fd = 1024 / 48e3 * 1e6;
  let i = 0, off = 0;
  return { n, upTo(muxer, tSec){
    const lim = tSec * 1e6;
    while (i < n && i * fd <= lim){
      const d = bytes.subarray(off, off + AUDIO_SIZES[i]); off += AUDIO_SIZES[i];
      muxer.addAudioChunkRaw(d, 'key', Math.round(i * fd), Math.round(fd), i === 0 ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48e3, numberOfChannels: 2, description: asc } } : undefined); i++;
    }
    return i;
  } };
}
const KEEP_NAME = 'finished-render.mp4', KEEP_META = 'whatif-render-meta', CRUMB = 'whatif-render-progress';
// a breadcrumb every 30 frames; if the tab dies, the next open of the page reports where it stopped
function crumb(o){ try { if (o) localStorage.setItem(CRUMB, JSON.stringify(o)); else localStorage.removeItem(CRUMB); } catch {} }
function lastCrash(){ try { const c = JSON.parse(localStorage.getItem(CRUMB) || 'null'); localStorage.removeItem(CRUMB); return c; } catch { return null; } }
async function openOutput(nVideo, nAudio){
  try {
    if (window.TEST_FORCE_MEMORY || !navigator.storage || !navigator.storage.getDirectory) throw 0;
    const root = await within(navigator.storage.getDirectory(), 8e3), fh = await root.getFileHandle('rendering.mp4', { create: true });
    if (!fh.createWritable) throw 0;
    const w = await within(fh.createWritable(), 8e3); let err = null, q = Promise.resolve(), queued = 0;
    return { kind: 'disk', target: new StreamTarget({ chunked: true, chunkSize: 4 * 1048576, onData: (data, position) => { queued += data.byteLength; q = q.then(() => w.write({ type: 'write', position, data })).then(() => { queued -= data.byteLength; }, e => { err = err || e; }); } }),
      fastStart: { expectedVideoChunks: nVideo, expectedAudioChunks: nAudio }, error: () => err, backlog: () => queued, drain: () => q,
      async finish(){ await q; if (err) throw err; await w.close(); try { await root.removeEntry(KEEP_NAME); } catch {} let fin = fh; try { await fh.move(KEEP_NAME); } catch { fin = fh; }
        const file = await fin.getFile(), name = fin.name; try { localStorage.setItem(KEEP_META, JSON.stringify({ name, size: file.size, at: new Date().toISOString(), build: BUILD })); } catch {} return file; } };
  } catch {
    return { kind: 'memory', target: new ArrayBufferTarget(), fastStart: 'in-memory', error: () => null, backlog: () => 0, drain: () => Promise.resolve(), async finish(muxer){ return new Blob([muxer.target.buffer], { type: 'video/mp4' }); } };
  }
}
async function keptRender(){
  try {
    const m = JSON.parse(localStorage.getItem(KEEP_META) || 'null'); if (!m || m.build !== BUILD) return null;
    const file = await (await (await within(navigator.storage.getDirectory(), 8e3)).getFileHandle(m.name)).getFile();
    if (file.size !== m.size || !file.size) return null;
    return { file, at: new Date(m.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) };
  } catch { return null; }
}
async function renderAll(){
  if (busy) return; busy = true; result = null; window.__result = null; window.__blob = null;
  $('go').disabled = true; $('save').hidden = true; $('done').hidden = true; $('scrub').disabled = true;
  const t0 = performance.now();
  try {
    if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video (no WebCodecs).');
    const vcfg = await pickVideo(); if (!vcfg) throw new Error('No H.264 encoder available here.');
    let feed = null, aErr = null; try { feed = audioFeeder(); } catch (e){ aErr = String(e && e.message || e); }
    const out = await openOutput(NF, feed ? feed.n : 0);
    log({ status: 'rendering', frames: NF, gpu: $('gpu').textContent, videoCodec: vcfg.codec, audioCodec: 'aac (pre-encoded)', output: out.kind }, true);
    const muxer = new Muxer(Object.assign({ target: out.target, video: { codec: 'avc', width: 1080, height: 1920, frameRate: FPS }, firstTimestampBehavior: 'offset' }, feed ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48e3 } } : {}, { fastStart: out.fastStart }));
    let verr = null;
    const venc = new VideoEncoder({ output: (c, m) => { try { muxer.addVideoChunk(c, m); } catch (e){ verr = verr || e; } }, error: e => { verr = e; } });
    venc.configure(vcfg);
    const dur = Math.round(1e6 / FPS);
    for (let n = 0; n < NF; n++){
      window.renderFrame(n / FPS);
      const f = new VideoFrame(cv, { timestamp: Math.round(n * 1e6 / FPS), duration: dur });
      venc.encode(f, { keyFrame: n % (FPS * 2) === 0 }); f.close();
      if (feed) feed.upTo(muxer, (n + 1) / FPS);
      if (verr) throw verr; if (out.error()) throw out.error();
      while (venc.encodeQueueSize > 6) await yieldNow();
      if (out.backlog() > 24 * 1048576) await out.drain();
      if (n % 30 === 0) crumb({ build: BUILD, frame: n, total: NF, at: new Date().toISOString() });
      if (n % 10 === 0 || n === NF - 1){ const el = (performance.now() - t0) / 1e3, per = el / (n + 1);
        $('bar').style.width = ((n + 1) / NF * 100).toFixed(1) + '%'; say('Drawing frame ' + (n + 1).toLocaleString() + ' of ' + NF.toLocaleString() + '  ·  ' + (per * 1e3).toFixed(0) + ' ms a frame  ·  about ' + fmt(per * (NF - n - 1)) + ' left'); await yieldNow(); }
      if (n && n % 150 === 0) log({ lastFrame: n, msPerFrameSoFar: Math.round((performance.now() - t0) / (n + 1)), jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
    }
    crumb(null); say('Finishing the video…'); await venc.flush(); venc.close(); if (verr) throw verr;
    let aN = 0; if (feed) try { aN = feed.upTo(muxer, Infinity); } catch (e){ aErr = String(e && e.message || e); }
    muxer.finalize(); say('Writing the file…');
    const blob = await out.finish(muxer), secs = (performance.now() - t0) / 1e3;
    result = blob; window.__result = { size: blob.size, secs, output: out.kind }; if (window.TEST_NF) window.__blob = blob;
    const mb = blob.size / 1048576;
    say('Done in ' + fmt(secs) + '. ' + mb.toFixed(1) + ' MB, ' + (aErr ? 'WITHOUT sound (' + aErr + ')' : 'with sound') + '.'); $('bar').style.width = '100%';
    log({ status: 'done', seconds: Math.round(secs), msPerFrame: Math.round(secs * 1e3 / NF), sizeMB: +mb.toFixed(1), audio: !aErr, audioFrames: aN, audioError: aErr, output: out.kind });
    await offerSave(out.kind === 'disk');
  } catch (e){ crumb(null); say('Stopped: ' + (e && e.message ? e.message : e)); log({ status: 'error', error: String(e && e.stack || e).slice(0, 1500) }); }
  busy = false; $('go').disabled = false; $('scrub').disabled = false;
}
async function offerSave(kept, at){
  const dl = await useCap('downloads');
  $('save').hidden = !dl; $('done').hidden = false;
  $('done').textContent = dl ? (at ? 'A finished render from ' + at + ' is still here. Press Save to put the MP4 on your computer, or render again.' : 'Press Save to put the MP4 on your computer.' + (kept ? ' The video is also kept in this page, so if the page closes before you save, reopen it and it will still be here.' : '')) : 'Saving files is not available in this view. Open this page in the Claude app on your computer.';
}
async function saveIt(){
  if (!result) return;
  const dl = await useCap('downloads'); if (!dl){ $('done').textContent = 'Saving files is not available in this view.'; return; }
  $('save').disabled = true; $('done').textContent = 'Handing the file over…'; log({ saveStarted: new Date().toISOString(), saveMB: +(result.size / 1048576).toFixed(1) });
  try { const r = await dl.save({ filename: FILENAME, data: result }); $('done').textContent = 'Saved. Tell Claude it is done.'; log({ saved: true, saveStatus: r && r.status || 'saved' }); }
  catch (e){ $('done').textContent = e && e.code === 'declined' ? 'Not saved. Press Save again when you are ready.' : 'Could not save (' + (e && e.code || e) + '). Press Save to try again.'; log({ saveError: String(e && e.code || e) }); }
  $('save').disabled = false;
}
(async () => {
  try {
    window.__stage = 'loading the fonts';
    await Promise.race([Promise.all(['400 40px Tinos', 'italic 400 40px Tinos', '700 40px Tinos'].map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 6e3))]);
    window.__stage = 'setting up the timeline'; window.setup(TLD);
    const gl = window.DBG.renderer.getContext();
    if (!gl || gl.isContextLost()) throw new Error('the graphics card did not give this page a WebGL context');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    $('gpu').textContent = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    window.__stage = 'drawing the first frame'; window.renderFrame(0);
    $('go').disabled = false; $('scrub').disabled = false; say('Ready. Rendering takes a few minutes; keep this window open until it finishes.');
    const dead = lastCrash();
    if (dead){ window.__crash = dead; say('The last render stopped at frame ' + dead.frame + ' of ' + dead.total + ' (the tab closed or crashed). Close other tabs, then press Render again.');
      useCap('db').then(d => d && d.collection('renders').doc().set({ at: new Date().toISOString(), reel: LABEL, build: BUILD, status: 'crashed earlier', crashedRunBuild: dead.build, crashedAtFrame: dead.frame, crashedAt: dead.at, ua: navigator.userAgent })).catch(() => {}); }
    window.__bootOK && window.__bootOK($('gpu').textContent);
    const kept = await keptRender(); if (kept && !busy){ result = kept.file; await offerSave(true, kept.at); }
  } catch (e){ window.__bootFail ? window.__bootFail(e && e.message ? e.message : String(e)) : say('Could not start: ' + (e && e.message ? e.message : e)); }
})();
$('go').addEventListener('click', renderAll);
$('save').addEventListener('click', saveIt);
$('scrub').addEventListener('input', e => { if (busy) return; const t = +e.target.value; $('scrubT').textContent = t.toFixed(1) + ' s'; window.renderFrame(t); });
