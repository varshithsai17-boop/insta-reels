# What-if reels: build playbook

How a reel gets made, start to finish. Read it together with the style spec (`claude/what-if-reels-style-spec.md` in the "insta reels" project) and the video rules (`claude/video-rules.md`, also `VIDEO-RULES.md` in the insta reels folder). If they clash, the order is: Varshith's own words, then the style spec, then the video rules, then this playbook.

## Where everything lives
- **Project "insta reels"**: the style spec, the video rules and this playbook.
- **Post bank** artifact: https://claude.ai/artifact/QeY7MhYDMEmCPF8axpgxUo. Its db collection `reels` has one doc per reel: title, num, status (Idea, Scripting, Building, Rendered, Scheduled, Posted), type (Still/Moving), date, setting, fact, body, keywords, hashtags, file, notes, platforms {insta, yt}. Writes need `if_version`. A reel gets its number when it leaves Idea. Varshith schedules and ticks Instagram/YouTube himself.
- **His laptop folder**: `D:\Vibe coding (claude code, Antigravity)\insta reels\` holds the reference reels, `VIDEO-RULES.md`, `CLAUDE.md` / `AGENTS.md` and this playbook. Finished reels go in `my reels\` as `#NN - <title without the ?>.mp4`, `#NN - cover.jpg` (frame 0) and `#NN - source.zip`.
- **Renderer pages** (artifacts named "#05 Renderer", "#06 Renderer", ...): one per reel, built by `build_renderer.py` (included in each source zip). Each page logs its runs to its db collection `renders`.

## How Varshith likes to work
- A bare "what if X" from him: answer in chat (the timeline, the hook, a real anchor, the twist, how it would look as a reel), then ask whether to add it to the bank. "add to bank" means an Idea doc only.
- For a build he often wants the plan first and, for moving reels, the visual plan, then says "build". He may swap the location after the pitch.
- Send a test-frame sheet before anything long. Keep narration short. Don't start long background jobs or extra test passes he hasn't asked for; he will stop them.
- He renders on his own laptop's graphics card with the renderer page and wants the single full-quality file (14 Mbps, about 140 MB). Saving a 136 MB file once froze his laptop; if that happens again, offer a lower bitrate or saving in parts, and let him choose.
- Global audience; an Indian setting now and then is fine.
- Caption (the bank's body): `What if #NN — <title>`, a short hook paragraph ending "Did you spot the duck?", then search keywords separated by " · ", then at most 5 hashtags.
- Short replies. Be honest about what is uncertain; don't promise quality you haven't checked.

## Build steps
1. Read the style spec, the video rules and this playbook. Re-read the idea's bank doc.
2. Pick the type: still (one locked camera, the scene changes) or moving. "You inside X" ideas are moving POV reels that ride the event.
3. Fact-check every number with a web search and keep the sources for the README. Label estimates as estimates.
4. Write `timeline.json`: a two-line title, fps 30, duration about 95 s, `endAt` about 4.4 s before the end, `loopAt`, captions `[t0, t1, text]`, counters (slot 0 only after the title fades at about 4.3 s), timeline-bar marks and progress, the dip, and scene-state curves. At least 40% consequences, one or more forwardable lines, an end-card fact and "DID YOU SPOT THE DUCK?". Then mark the set pieces (video rule 4): only the consequences that would really happen, would be visible from this camera and would look striking, usually 3–5, getting bigger. In a POV reel, add a witness only if the situation naturally has someone else there.
5. Build `reel.html`, starting from the most recent reel. Keep the `window.GL_W / GL_H / BLOOM / MSAA / SHADOW` overrides, `setup(tl)`, `renderFrame(t)`, `window.ready`, and the #02 text layer (counters, captions, title, bar, end card, loop fade).
6. Test frames: `python render.py preview <dir> t1 t2 ...` then `./sheet.sh <dir> <columns>`. Look, fix, repeat. Send Varshith the sheet early.
7. Sound in `audio.py`, procedural on the same timeline. Use `TRIM=` to land at -13 to -15 LUFS (check with ffmpeg `ebur128`). The last 0.7 s crossfades into the opening.
8. Renderer: `python build_renderer.py <reel dir> <out.html> "#NN - <title>"`, then publish it as an artifact with capabilities `{db: {}, downloads: true}`. Varshith opens it in the Claude app on his laptop, presses Render, then Save. Read the page's `renders` collection for progress and errors.
9. After he saves: find the file in `my reels` (or ask where it went), check frame 0, the loop, the sound and frames across the reel through the computer link, add the cover and source zip, set the bank doc to Rendered with the file name, and give him the caption.
10. Add the reel and any lessons to the style spec.

## Technical notes (traps already hit)
- Cloud previews run headless Chromium with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`), with files served through Playwright `page.route`. About 0.6 to 1.3 s a frame at 576x1024, so a full cloud render takes about an hour; use it only as a fallback.
- Instanced meshes and points that move need `frustumCulled = false`; stale bounding spheres made #04's debris vanish.
- Hide an instance by scaling all three axes to 0, never just one (NaN normals turned regions black).
- Camera paths: use a spline through the keys (`spl`), not eased per-key lerps, which stop at every key.
- Check any object a caption names across several frames of that caption, not one.
- Decide day and night from the sun's elevation; otherwise the sun lights the scene from below at dusk. Avoid accidental nights in long time-lapses.
- Keep a clear view in front of the lens when things grow or fly (trees, debris).
- Renderer page: three@0.160.0 from jsdelivr `+esm`, mp4-muxer@5.2.1 UMD, Tinos from Google Fonts. Audio is embedded as Opus in Ogg (open-source Chromium can't decode AAC) and re-encoded to AAC in the browser; his laptop encodes H.264 and AAC. WebCodecs only works on a secure origin, so local tests must use an `https://` route.
- His laptop: AMD Radeon 610M, 8 threads, 16 GB. About 37 ms a frame for simple scenes and about 100 ms a frame for #05 at full quality (about 5 minutes for 2,835 frames).
- Files sent through the chat or written to his laptop from the cloud are capped at 30 MB each. For a cloud render, make a 2-pass delivery copy under that and write it by its sent-file id.
- The shell's safety check blocks `rm` with relative globs; move files instead.
- An artifact's `<title>` tag wins over the publish `title` parameter.

## Reel folder layout
`reel.html`, `timeline.json`, `audio.py` (makes `audio.wav`), `render.py`, `sheet.sh`, `render_all.sh` (cloud fallback), `build_renderer.py`, `package.json` (three@0.160.0, @fontsource/tinos) and `README.md` (files, how to re-render, forwardable lines, deviations from the video rules, facts with sources).
