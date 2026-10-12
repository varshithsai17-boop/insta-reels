# Builds the self-contained GPU renderer page for a reel (the #08 v6 / #09 v3 design).
#   python build_renderer.py <reel dir> <out.html> "#NN - <title>"
# Needs: ffmpeg, and in <reel dir>/node_modules: three@0.160.0, mp4-muxer@5.2.1, esbuild@0.24.0
#   (npm i three@0.160.0 mp4-muxer@5.2.1 esbuild@0.24.0 @fontsource/tinos@5.3.0)
# What it does:
#   1. encodes audio.wav to AAC (192 kbps, 48 kHz stereo) here in the cloud and embeds the raw AAC frames,
#      so the browser never decodes or encodes sound (it copies the frames into the MP4);
#   2. bundles renderer.js (+ src/, timeline.json, three.js, mp4-muxer) into one inline module with esbuild,
#      so nothing loads from a script CDN at view time (only the Tinos font, from Google Fonts, capped at 6 s);
#   3. writes the page: boot script first (shows the stage and error if the page doesn't start, logs every
#      open to the db `boots`), then the UI, the module, and the sound data.
import sys, os, json, subprocess, base64, tempfile, datetime, html

reel, out, label = sys.argv[1], sys.argv[2], sys.argv[3]
reel = os.path.abspath(reel)
tl = json.load(open(os.path.join(reel, 'timeline.json')))
num = label.split(' ')[0]
title_line = label.split(' - ', 1)[1] if ' - ' in label else label
filename = label.replace('?', '').strip() + '.mp4'
build = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')
nf = round(tl['duration'] * tl['fps'])
length = f"{int(tl['duration'] // 60)}:{int(round(tl['duration'] % 60)):02d} · {nf:,} frames"

# 1. sound -> raw AAC frames
wav = os.path.join(reel, 'audio.wav')
if not os.path.exists(wav): sys.exit('audio.wav missing: run audio.py first')
with tempfile.TemporaryDirectory() as td:
    adts = os.path.join(td, 'a.aac')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-f', 'adts', adts], check=True)
    data = open(adts, 'rb').read()
frames, i = [], 0
while i + 7 <= len(data):
    if data[i] != 0xFF or (data[i + 1] & 0xF6) != 0xF0: raise SystemExit(f'bad ADTS sync at {i}')
    prot_absent = data[i + 1] & 1
    flen = ((data[i + 3] & 3) << 11) | (data[i + 4] << 3) | (data[i + 5] >> 5)
    hlen = 7 if prot_absent else 9
    frames.append(data[i + hlen:i + flen]); i += flen
raw = b''.join(frames)
sizes = [len(f) for f in frames]
print(f'sound: {len(frames)} AAC frames, {len(raw) / 1e6:.2f} MB')

# 2. bundle
esb = os.path.join(reel, 'node_modules', '.bin', 'esbuild')
bundle = subprocess.run([esb, os.path.join(reel, 'renderer.js'), '--bundle', '--format=esm', '--minify-whitespace', '--minify-syntax', '--target=es2020', '--log-level=warning', '--loader:.json=json'],
                        cwd=reel, check=True, capture_output=True, text=True).stdout
bundle = bundle.replace('</script', '<\\/script')
print(f'bundle: {len(bundle) / 1e6:.2f} MB')

# 3. page
boot = """<script>
(function(){
  var t0 = Date.now(), done = false, logged = false; window.__stage = 'reading the page'; window.__BUILD = BUILD_; window.__LABEL = LABEL_; window.__FILENAME = FILENAME_;
  function st(m){ var s = document.getElementById('status'); if (s) s.textContent = m; }
  function logBoot(o){ if (logged) return; logged = true;
    try { var c = window.claude; if (!c || !c.use) return;
      c.use('db').then(function(d){ if (!d) return; var r = d.collection('boots').doc();
        return r.set(Object.assign({ at: new Date().toISOString(), reel: LABEL_, ua: navigator.userAgent, ms: Date.now() - t0, build: BUILD_ }, o)); }).catch(function(){}); } catch (e) {} }
  window.__bootOK = function(gpu){ if (done) return; done = true; logBoot({ ok: true, gpu: String(gpu || '') }); };
  window.__bootFail = function(msg){ if (done) return; done = true; msg = String(msg || 'unknown error');
    st('Could not start (' + window.__stage + '): ' + msg); var b = document.getElementById('retry'); if (b) b.hidden = false;
    logBoot({ ok: false, stage: window.__stage, error: msg.slice(0, 800) }); };
  window.addEventListener('error', function(e){ if (!done) window.__bootFail((e && e.message) || 'script error'); });
  window.addEventListener('unhandledrejection', function(e){ if (!done) window.__bootFail(e && e.reason && e.reason.message || String(e && e.reason)); });
  setTimeout(function(){ if (!done) st('Still loading… (' + window.__stage + ')'); }, 12000);
  setTimeout(function(){ if (!done) window.__bootFail('still not ready after 90 seconds'); }, 90000);
  document.addEventListener('DOMContentLoaded', function(){ var b = document.getElementById('retry'); if (b) b.addEventListener('click', function(){ location.reload(); }); });
})();
</script>""".replace('BUILD_', json.dumps(build)).replace('LABEL_', json.dumps(label)).replace('FILENAME_', json.dumps(filename))

page = f"""<title>{html.escape(num)} Renderer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400&display=swap">
<style>
/* one fixed dark look, same as every reel's renderer page: amber on deep slate, Tinos throughout */
:root{{--bg:#0e1114;--panel:#161b20;--fg:#e9ecee;--sub:#9aa6ad;--line:#28313a;--amber:#f5a33b;--ink:#0e1114;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font-family:Tinos,Georgia,'Times New Roman',serif;padding-inline:16px;padding-block:24px 48px}}
.wrap{{max-width:960px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,320px);gap:28px;align-items:start}}
@media (max-width:760px){{.wrap{{grid-template-columns:minmax(0,1fr)}}}}
.k{{font:600 11px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.16em;color:var(--amber);margin:0 0 6px}}
h1{{font-weight:400;font-style:italic;font-size:clamp(24px,4vw,34px);line-height:1.15;margin:0 0 10px;text-wrap:balance}}
p{{margin:0;line-height:1.5}}
.lede{{color:var(--sub);font-size:17px;max-width:60ch}}
.facts{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 18px;margin:22px 0}}
.facts div{{display:grid;gap:3px;min-width:0}}
.facts span{{font:600 10.5px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.14em;color:var(--sub)}}
.facts b{{font-weight:400;font-size:17px;overflow-wrap:anywhere}}
.row{{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0 10px}}
button{{font:600 15px ui-monospace,Consolas,monospace;letter-spacing:.05em;border:0;border-radius:3px;padding:13px 20px;cursor:pointer}}
button:focus-visible{{outline:2px solid var(--amber);outline-offset:2px}}
#go{{background:var(--amber);color:var(--ink)}}
#save,#retry{{background:var(--fg);color:var(--ink)}}
button:disabled{{opacity:.4;cursor:default}}
.track{{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin:6px 0 10px}}
#bar{{height:100%;width:0;background:var(--amber)}}
#status{{font:500 14px/1.5 ui-monospace,Consolas,monospace;color:var(--fg);font-variant-numeric:tabular-nums}}
#done{{color:var(--amber);margin-top:8px}}
.note{{color:var(--sub);font-size:15px;margin-top:18px;max-width:60ch}}
.side{{display:grid;gap:10px}}
#c{{width:100%;height:auto;display:block;border:1px solid var(--line);background:#000}}
#gl{{position:absolute;left:-99999px;top:0}}
.scrub{{display:flex;gap:10px;align-items:center;font:500 12px ui-monospace,Consolas,monospace;color:var(--sub)}}
.scrub input{{flex:1;min-width:0;accent-color:var(--amber)}}
</style>
<script>window.GL_W = window.GL_W || 1080; window.GL_H = window.GL_H || 1920; window.MSAA = window.MSAA != null ? window.MSAA : 4; window.SHADOW = window.SHADOW || 4096;</script>
<div class="wrap">
  <main>
    <p class="k">WHAT IF REELS · GPU RENDERER</p>
    <h1>{html.escape(num)} - {html.escape(title_line)}</h1>
    <p class="lede">This page draws every frame of the reel on this computer's graphics card at full quality, adds the sound, and gives you the finished MP4.</p>
    <div class="facts">
      <div><span>GRAPHICS</span><b id="gpu">checking…</b></div>
      <div><span>SIZE</span><b>1080 × 1920, {tl['fps']} fps</b></div>
      <div><span>LENGTH</span><b>{length}</b></div>
    </div>
    <div class="row"><button id="go" type="button" disabled>Render the reel</button><button id="save" type="button" hidden>Save the video</button><button id="retry" type="button" hidden>Try again</button></div>
    <div class="track"><div id="bar"></div></div>
    <p id="status">Loading the scene…</p>
    <p id="done" hidden></p>
    <p class="note">Keep this window open and on screen while it renders. The preview on the right shows each frame as it is drawn.</p>
  </main>
  <aside class="side">
    <canvas id="gl" width="1080" height="1920"></canvas>
    <canvas id="c" width="1080" height="1920"></canvas>
    <label class="scrub">Preview <input id="scrub" type="range" min="0" max="{tl['duration'] - .05:.2f}" step="0.1" value="0" disabled><span id="scrubT">0.0 s</span></label>
  </aside>
</div>
{boot}
<script type="module">{bundle}</script>
<script>window.AUDIO_B64 = '{base64.b64encode(raw).decode()}'; window.AUDIO_SIZES = {json.dumps(sizes)};</script>
"""
open(out, 'w', encoding='utf8').write(page)
print(f'{out}: {len(page.encode()) / 1e6:.2f} MB, build {build}, file "{filename}"')
