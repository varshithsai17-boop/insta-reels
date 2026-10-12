# What-if reels: build playbook

How a reel gets made, start to finish. Read it together with the style spec (`claude/what-if-reels-style-spec.md` in the "insta reels" project) and the video rules (`claude/video-rules.md`, also `VIDEO-RULES.md` in the insta reels folder). If they clash, the order is: Varshith's own words, then the style spec, then the video rules, then this playbook.

## Where everything lives
- **Project "insta reels"**: the style spec, the video rules and this playbook.
- **Post bank** artifact: https://claude.ai/artifact/QeY7MhYDMEmCPF8axpgxUo. Its db collection `reels` has one doc per reel: title, num, status (Idea, Scripting, Building, Rendered, Scheduled, Posted), type (Still/Moving), date, setting, fact, body, keywords, hashtags, file, notes, platforms {insta, yt}. Writes need `if_version`. A reel gets its number when it leaves Idea. Varshith schedules and ticks Instagram/YouTube himself.
- **His laptop folder**: `D:\Vibe coding (claude code, Antigravity)\insta reels\` holds the reference reels, `VIDEO-RULES.md`, `CLAUDE.md` / `AGENTS.md` and this playbook. Finished reels go in `my reels\` as `#NN - <title without the ?>.mp4`, `#NN - cover.jpg` (frame 0) and `#NN - source.zip`.
- **Renderer pages** (artifacts named "#05 Renderer", "#06 Renderer", ...): one per reel, built by `build_renderer.py` (included in each source zip). Each page logs its runs to its db collection `renders`, and from #08 v6 / #09 v3 every page open to `boots` (ok with the GPU, or the stage and error where it failed).

## How Varshith likes to work
- A bare "what if X" from him: answer in chat (the timeline, the hook, a real anchor, the twist, how it would look as a reel), then ask whether to add it to the bank. "add to bank" means an Idea doc only.
- For a build he often wants the plan first and, for moving reels, the visual plan, then says "build". He may swap the location after the pitch.
- Send a test-frame sheet before anything long. Keep narration short. Don't start long background jobs or extra test passes he hasn't asked for; he will stop them.
- **Every reel is rendered by Varshith on his own laptop's graphics card** with the renderer page (his standing call from #07 on). Never run a full cloud render, a cloud test of the renderer page, or a background render job; the cloud is only for test-frame previews. He wants the single full-quality file (14 Mbps, about 140 MB). Saving a 136 MB file once froze his laptop; if that happens again, offer a lower bitrate or saving in parts, and let him choose.
- When he says a reel looks bad, go through the whole render and report every flaw first, then fix only after he says so.
- Global audience; an Indian setting now and then is fine.
- Caption (the bank's body): `What if #NN — <title>`, a short hook paragraph ending "Did you spot the duck?", then search keywords separated by " · ", then at most 5 hashtags.
- Short replies. Be honest about what is uncertain; don't promise quality you haven't checked.

## Build steps
1. Read the style spec, the video rules and this playbook. Re-read the idea's bank doc.
2. Pick the type: still (one locked camera, the scene changes) or moving. "You inside X" ideas are moving POV reels that ride the event.
3. Fact-check every number with a web search and keep the sources for the README. Label estimates as estimates.
4. Write `timeline.json`: a two-line title, fps 30, duration about 95 s, `endAt` about 4.4 s before the end, `loopAt`, captions `[t0, t1, text, y]`, counters (slot 0 only after the title fades), timeline-bar marks and progress, the dip, and scene-state curves. At least 40% consequences, one or more forwardable lines, an end-card fact and "DID YOU SPOT THE DUCK?". Then mark the set pieces (video rule 4): only the consequences that would really happen, would be visible from this camera and would look striking, usually 3–5, getting bigger. In a POV reel, add a witness only if the situation naturally has someone else there.
5. Build `reel.html`, starting from the most recent reel (#08 v3 is the base for people, interiors and the two-pass render). Keep the `window.GL_W / GL_H / MSAA / SHADOW` overrides (`BLOOM` is now ignored), `setup(tl)`, `renderFrame(t)`, `window.ready`, and the #02 text layer (counters, captions, title, bar, end card, loop fade).
6. Test frames: `python render.py preview <dir> t1 t2 ...` then `./sheet.sh <dir> <columns>`. Look, fix, repeat. Send Varshith the sheet early. Check a few frames at full quality before publishing the renderer (see Look rules).
7. Sound in `audio.py`, procedural on the same timeline. Use `TRIM=` to land at -13 to -15 LUFS (check with ffmpeg `ebur128`). Fade in with the picture; the end crossfades softly into the opening, so the opening must start quiet (a loud hit near 0 s comes out as a blast at the end).
8. Renderer: `python build_renderer.py <reel dir> <out.html> "#NN - <title>"` (needs esbuild, three@0.160.0 and mp4-muxer@5.2.1 installed in `/home/claude/bundler`; `npm i esbuild@0.24.0 three@0.160.0 mp4-muxer@5.2.1` there in a fresh session), then publish it as an artifact with capabilities `{db: {}, downloads: true}`. Varshith opens it in the Claude app on his laptop or iPhone, presses Render, then Save. Read the page's `boots` and `renders` collections for opens, progress and errors.
9. After he saves: find the file in `my reels` (or ask where it went), check frame 0, the loop, the sound and frames across the reel through the computer link, add the cover and source zip, set the bank doc to Rendered with the file name, and give him the caption.
10. Add the reel and any lessons to the style spec.

## Technical notes (traps already hit)
- Cloud previews run headless Chromium with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`), with files served through Playwright `page.route`. About 0.6 to 1.3 s a frame at 576x1024 (a crowd of 1,300 people takes about 7 s), so use it only for test frames, never for the full reel.
- Instanced meshes and points that move need `frustumCulled = false`; stale bounding spheres made #04's debris vanish.
- Hide an instance by scaling all three axes to 0, never just one (NaN normals turned regions black).
- Never write `smoothstep` with the first edge bigger than the second (e.g. `smoothstep(1.0, 0.86, x)`); use `1.0 - smoothstep(0.86, 1.0, x)`. On Varshith's AMD card the reversed form returns NaN (#07 Jupiter and Titan got black rectangles).
- Camera paths: use a spline through the keys (`spl`), not eased per-key lerps, which stop at every key.
- Check any object a caption names across several frames of that caption, not one.
- Decide day and night from the sun's elevation; otherwise the sun lights the scene from below at dusk. Keep the time of day consistent across cuts (#08 v3 runs sunset → dusk → blue hour → night).
- Keep a clear view in front of the lens when things grow or fly (trees, debris).
- **Renderer pages are self-contained** (from #08 v6 / #09 v3). three.js and mp4-muxer are bundled into one inline module with esbuild, so nothing loads from a script CDN at view time. Before that the page pulled three from jsdelivr `+esm` and mp4-muxer from a blocking `<script src>` placed before the page markup, so a slow or blocked jsdelivr left the page blank or stuck on "Loading the scene…" with no error ("08 renderer not opening"). Only Tinos still comes from Google Fonts, and the font wait is capped at 6 s with failures ignored. A plain boot script runs first: it shows the stage and the error if the page doesn't start (with a Try again button) and logs every open to `boots`.
- Sound is encoded to AAC in the cloud when the page is built, and its frames are copied straight into the MP4 (`addAudioChunkRaw`, synchronous, errors reported as "WITHOUT sound"), so the browser never decodes or encodes audio. The old way (Opus decoded and re-encoded in the browser) gave a silent track when #08 was rendered on his iPhone. Renders also work from the Claude app on his iPhone (Apple GPU, about 40 ms a frame). WebCodecs only works on a secure origin, so local tests must use an `https://` route.
- His laptop: AMD Radeon 610M, 8 threads, 16 GB. About 37 ms a frame for simple scenes and about 100 ms a frame for #05 at full quality (about 5 minutes for 2,835 frames).
- Files sent through the chat or written to his laptop from the cloud are capped at 30 MB each (relevant for covers, source zips and sound previews, not the reel itself).
- The shell's safety check blocks `rm` with relative globs; move files instead.
- An artifact's `<title>` tag wins over the publish `title` parameter.

## Look rules (learned rebuilding #08)
- **No bloom.** On his GPU the renderer's half-float target let every lit white (pages, shirts, lamps) bloom into a glow, while the cloud test frames ran without bloom and looked fine, so the problem was never seen before he rendered. Glows are now additive sprites only, and what a test frame shows is what his GPU renders. Before publishing a renderer, check a few frames at full quality: `RINIT="window.GL_W=1080;window.GL_H=1920;window.GL_AA=1;window.SHADOW=4096;" python render.py preview <dir> t...`.
- **Matte by default.** MeshStandard with roughness about 0.85 to 0.9, no pure whites (cap light colours around #d8d4ca). Only car paint, glass and the plane's skin reflect, using a small sky environment (PMREM) per time of day.
- **People, not pegs.** Use the #08 person builder: a sculpted head (nose, brows, eyes with whites and irises, ears, hair with a smooth hairline), a jacket drawn as a texture on the torso (shirt V, tie, lapels, buttons), uniforms with ribbons and shoulder boards, varied skin tones and real clothing colours. Use the instanced version for crowds, with arms that clap, wave, hold flags or phones.
- **Windows are real openings.** Render each frame in two passes: the world with a far camera, then the interior you're in with a near camera after clearing depth. The camera can then turn its head and see out of a car or plane window. The world gets its own exposure (`EXPW`) so dusk and night still read through the glass.
- **Distant lights.** City lights need a point size of at least 1.5 px and a soft falloff. They must sit well above the ground, with a world near plane of 20 m or more when they're kilometres away, or they z-fight out of sight.
- **Lights use physical units** (three r160): spot and point lights with decay 2; intensities are in candela.
- **Openings.** Fade in from black over about 0.35 s and give the viewer a beat to see where they are before the inciting moment, which should happen around 3 to 4 s, not 0.6 s.

## Reel folder layout
`reel.html` (for #08 v3 it is assembled by `build.py` from `parts/`), `timeline.json`, `audio.py` (makes `audio.wav`), `render.py`, `sheet.sh`, `build_renderer.py`, `package.json` (three@0.160.0, @fontsource/tinos) and `README.md` (files, how to re-render, forwardable lines, deviations from the video rules, facts with sources).
