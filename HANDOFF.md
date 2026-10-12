# Handoff

Running log for the next session (or the next Claude). Newest state at the top. Updated after every step.

## Current task
**#11 — "What if your city hit 60 °C?"**, a still reel (one locked camera) on Times Square, built on the #03 Times Square set.
- Status: **renderer published, waiting for Varshith's GPU render.** "#11 Renderer": https://claude.ai/artifact/1tYkrWYX4nY22tESqGJpu4 (v1, capabilities db + downloads). Read its db `boots` (page opens: ok + GPU, or stage + error) and `renders` (progress, ms/frame, errors, saved) to follow along.
- Rebuild after any change: `python audio.py` (TRIM=5.5 → -14.3 LUFS) then `python build_renderer.py . <scratchpad>/pub/11-renderer.html "#11 - What if your city hit 60 °C?"` and republish the SAME file path (or pass the URL from a new session; read it first).
- Not cloud-tested by rule (the playbook forbids a cloud test of the renderer page); the bundle passed `node --check`. If his first open fails, `boots` will say where.
- Bank doc `idea-city-60c` (Post bank https://claude.ai/artifact/QeY7MhYDMEmCPF8axpgxUo): now num "11", status Building, caption/keywords/hashtags/fact/notes filled (version 3).
- After he saves: check frame 0, the loop, the sound and frames across the reel; add `#11 - cover.jpg` (frame 0) and `#11 - source.zip` to `my reels/`; set the bank doc to Rendered with the file name; give him the caption.

## Approved script (Varshith, 2026-10-12)
Temperature climbs from a normal 22 °C to 60 °C on one fixed camera (red TKTS steps looking down the bowtie). Every step shows an effect. He asked for: people passing out at the right temperatures, and an on-screen line saying how long an average person can survive at that temperature.

Counters: TEMPERATURE (°C big, °F small); survival counter "AVERAGE ADULT · IN SHADE · NO WATER — ≈ X" (est.).
Timeline bar: 22° · 35° · 41° · 50° · 60°.

| t (s) | Temp | Caption | Survival | Picture |
|---|---|---|---|---|
| 0–3 | 22 | (title) | | busy normal afternoon, counter ticking |
| 3.5–8 | 24 | About 280,000 people walk through here on a normal day. | ≈10 days | full crowd |
| 8–13 | 28 | — | ≈9 days | sunglasses, ice-cream line, people drift to shade |
| 13–18 | 32 | The city opens cooling centres. | ≈7 days | water sellers; people sit on red steps fanning |
| 18–24 | 35 | Apple builds iPhones for up to 35 °C. After that, they start to slow down. | ≈6 days | phone dims; tourist sways |
| 24–30 | 38 | Down in the subway it's worse. One platform hit 40 °C on a 30 °C day. | ≈5 days | haze from subway entrance; FIRST FAINT (older man), people help |
| 30–35 | 41 | New York's hottest day ever: 41 °C, in 1936. Broken. | ≈4 days | Elmo pulls off head, slumps; two more down |
| 35–41 | 43 | Under the street, power cables overheat. | ≈3 days | manhole plume; ambulance |
| 41–47 | 46 | The asphalt goes soft. | ≈18 hours | crosswalk warps; paramedics; people lying in shade |
| 47–52 | 48 | Too hot for some jets. Phoenix grounded regional planes at 48 °C. | ≈10 hours | plane turns away; hot-dog vendor collapses, witness kneels |
| 52–58 | 50 | Every air conditioner in Manhattan is running at once. | ≈6 hours | screens go dark block by block; stretchers |
| 58–63 | 52 | In 2018, 42 °C killed 23,000 bats in two days in Australia. | ≈5 hours | pigeons drop; handful left |
| 63–68 | 54.4 | Hotter than the hottest temperature ever reliably measured on Earth. | ≈4 hours | abandoned cab, shimmer; last person helped into subway |
| 68–73 | 57 | The world record, 56.7 °C from 1913, is gone. | ≈3 hours | banners sag, cart umbrella smokes |
| 73–79 | 60 | 60 °C. Nobody is left. | ≈2 hours | empty, silent |
| 79–84 | — | Then the heat breaks. The first raindrops hit the road and boil. | climbs back | storm, steam erupts across the square |
| 84–90.6 | 22 | — | ≈10 days | crowd returns → frame 0 (loop) |

End card: THIS IS FICTIONAL · NEW YORK'S RECORD IS 41 °C (106 °F), SET IN 1936. IT HAS NEVER BEEN BROKEN. Hook: DID YOU SPOT THE DUCK? (rubber duck on the hot-dog cart that melts as it heats.)
Collapses are shown tastefully: slump/sit/fall, then someone helps; nobody left lying at the end; no faces in distress.

## Facts / sources (keep for the README)
- NYC record 106 °F / 41 °C, 9 Jul 1936, Central Park — NWS https://www.weather.gov/media/okx/Climate/CentralPark/extremes.pdf
- Apple iPhone ambient operating range 0–35 °C — https://support.apple.com/en-in/HT201678
- Subway platform 104 °F on an 86 °F day (RPA 2018) — https://rpa.org/news/lab/hotter-than-a-new-york-city-platform
- Times Square avg 283,090 pedestrians/day in 2023 — Times Square Alliance 2024 report
- Con Ed equipment fails in heat waves / manhole fires — CBS, Queens Chronicle
- Phoenix 2017: American Eagle CRJs (max 118 °F ≈ 48 °C) grounded at 119 °F — The Points Guy, NPR
- 23,000+ spectacled flying foxes died, Cairns, 26–27 Nov 2018, >42 °C — The New Daily
- Death Valley 56.7 °C (1913) official but disputed; 54.4 °C highest reliable — Skeptical Science
- Survival counter (ESTIMATES, label "est." on screen):
  - 22–43 °C in days: US Army FM 21-76 desert table (resting in shade, no water; from Adolph 1947). **Quoted from memory — archive.org is blocked from the cloud container; verify the table before render.** Values used: 21 °C→10 d, 27→9, 32→7, 38→5, 43→3, 49→2.
  - 46–60 °C in hours: own heat-balance estimate. Body can't shed heat above ~44 °C at NYC summer humidity (dew point ~20 °C; Penn State critical wet-bulb 25–28 °C hot-dry), then time for core to reach 43 °C (Vanos et al. 2023 survivability threshold). Could be off by half either way.
- Still to verify: Blagden 1775 wording isn't used any more; "raindrops boil" on very hot asphalt (plausible, check).

## Where things are
- Repo: `varshithsai17-boop/insta-reels`, branch `claude/kind-babbage-8ocgp5`.
- `my reels/#02/#03/#04 - source.zip` were added by Varshith (pre-GPU-renderer era: no build_renderer.py). `oceans-reel-source.zip` = duplicate of #02.
- #05–#09 source zips are NOT in the repo. The #08 v3 code (person builder `makePerson`, instanced crowd `CR`/`updateCrowd`, two-pass render, text layer, WebCodecs+mp4-muxer renderer with AAC copy) was recovered by reading the published "#08 Renderer" artifact (https://claude.ai/artifact/XBCzQNz4TvwBA2aJ2ZxeXP) and re-printing its bundled module with esbuild. Use it as the base for build_renderer.py later.
- New reel folder: `reels/11-city-60c/` (reel.html, timeline.json, render.py, sheet.sh, README.md). node_modules are not committed; install with `npm i three@0.160.0 @fontsource/tinos@5.3.0` in that folder (or symlink).
- Cloud preview: `pip install playwright numpy scipy`; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (pass as executablePath; don't `playwright install`).

## Log
- 2026-10-12: Read CLAUDE.md, AGENTS.md, playbook, video rules, `_claude_analysis/`. Read the Post bank (38 docs: #01–#09 Posted, #10 Kardashev Building, 28 Ideas).
- Varshith pushed #02–#04 source zips; merged main into the branch and pushed.
- Ideated Niagara Falls stopped + city 60 °C; he chose city 60 °C, moved it to Times Square, added collapses + survival-time counter. Approved; asked for PNG test frames first.
- Extracted #03 Times Square scene and #08 code; starting `reels/11-city-60c/`.
- Built `reels/11-city-60c/`: `timeline.json` (temp/survival/crowd/traffic/screens curves, named `beats`, captions, counters), `src/util.js`, `src/people.js` (#08 person builder + waist/body rig + pose blending: stand/fan/sway/buckle/lieSide/lieBack/kneel/sitStep…; instanced crowd with walking legs and lying), `src/main.js` (scene, cast, heat effects, 2D text layer), `reel.html` (importmap to node_modules), `render.py` (preview only), `sheet.sh`.
- Render path matches #08: straight to the WebGL canvas (no render target, no bloom); heat shimmer = wobbling horizontal slices + warm `ctx.filter` grade + haze veil in 2D.
- Camera: on the TKTS steps, `CAM.p (1.0, 5.2, 7.6)` looking at `(-1.2, 2.1, -40)`, fov 56. Road x -18..-4 (left), plaza x -4..26 (right). Captions at y 1010.
- First test frames OK. Iterated layout: camera moved down the steps; hot-dog cart (with the duck) at (3.0,-5.0) in frame; vendor collapses beside the cart (lieSide) and a passer-by kneels; Elmo slumps in place with his costume head beside him; plane flies in the sky window right of One Times Square; manhole smoke is grey; haze toned down (fog far ≥1000 m); shimmer is smooth waves (4 px slices, low-frequency offsets ≤3 px) instead of tearing; steps have no white edge lines.
- Final fixes: clear sightline to the first faint (standers excluded from x -1.2..3.4, z -2.5..-11), helper kneels at the old man's head, medics beside him, pigeons sit on the ice-cream umbrella and drop off it at 58.4 s, return-to-22° scene matches frame 0 (no step sitters / water seller / ice-cream line).
- SENT to Varshith: 19-frame contact sheet + 11 full-quality PNGs (0, 16, 27, 33, 44.5, 50.5, 55.5, 60.5, 76, 81.5, 87 s). **Waiting for his approval / notes.** Next: send sheet, wait for his approval/notes. Then audio.py and build_renderer.py (rebuild from the #08 renderer page code, recovered at scratchpad r08/mod_pretty.js lines ~18210+; re-extract from the artifact if the scratchpad is gone).
- Varshith said "build renderer now" (treated as approval of the stills). Wrote `audio.py` (procedural city bed, horns, AC hum, heat whine/drone, thuds, manhole pop+hiss, ambulance siren in/out, plane, cart clank, screens power-down, pigeon flutter, heartbeat 63–79 s, thunder, rain, steam sizzle; fade-in 0.35 s, -14.3 LUFS at TRIM=5.5), `renderer.js` (#08 v6 renderer logic: WebCodecs H.264 14 Mbps, raw AAC copied into the MP4, OPFS disk output with in-memory fallback, db logging), `build_renderer.py` (ADTS→raw AAC frames, esbuild bundle, page with boot script), `package.json`. Published "#11 Renderer" v1 (4.1 MB page).
- v1 CRASHED on his Radeon 610M (Windows, D3D11): booted OK, ~158 ms/frame, last log at frame 300, then no error/done → tab/GPU-process crash. Cause (best guess): the heat shimmer read the WebGL canvas up to ~120×/frame (one drawImage per slice, with ctx.filter on each); on Windows/ANGLE each read can allocate a full-size GPU snapshot. Fix in v2: read the WebGL canvas ONCE per frame into a 2D scratch canvas `pic` (grade filter applied there), cut shimmer slices from `pic`. Cloud memory test 30–70 s flat (~1.2 GB). Also renderer now logs `lastFrame`, `msPerFrameSoFar`, `jsHeapMB` every 300 frames to `renders`.
- Published "#11 Renderer" v2 (same URL, build 2026-10-12 21:43). If it crashes again: read `renders` for lastFrame; next levers are SHADOW 2048, MSAA 0 (window overrides), or dropping the shimmer.
- v2 render SUCCEEDED (7:18, 154 ms/frame, 148.8 MB, with sound, saved by Varshith).
- Varshith: "kinda uneventful… make it till 100 degrees… everything from 61–100 and end it in the same fashion, I'll tell what to remove." → v3 timeline (155 s, endAt 150.6, loopAt 154.3): 0–73 s unchanged (22→60 °C), then 60→100 °C beats, then the same storm/return ending shifted +60 s.
  - 60→100 beats (beats in timeline.json): leaves 78.6 (trees in planters scorch, leaves fall; leaf death ~46–50 °C), sprinklers 85 (water from doorways down the street, puddles + gutter streams; red sprinkler bulbs 68 °C), propane 91 (cart tank vents; 375 psig relief ≈ 72 °C by Antoine eq.), signals 97 (traffic lights die; NEMA −34…+74 °C), bottles 103 (cones/bottles sag; PET Tg ~70–80 °C), batteries 109 + spread 114 (e-bike dock burns; Li-ion SEI breakdown ~80 °C; NYC ~220 Li-ion fires in 2022), fireball 117.6 (fire reaches the vented propane; cart burnt), tar 120.5 (glossy road, abandoned cab sinks), sauna line 126, 100 °C at 132–137.8 (puddle stays ~38 °C: wet-bulb at 100 °C air, dew point 20 °C).
  - Survival counter extended (minutes below 2 h): 60 °C 2.3 h … 100 °C 40 min (own heat-balance estimate).
  - Bar marks now 22° · 41° · 60° · 80° · 100°.
  - audio.py extended (water, leaf rustle, propane hiss, relay clicks, plastic creaks, battery pops + fire, fireball, tar bubbling; heartbeat 63–138 s) → −13.6 LUFS at TRIM=5.5.
  - NOTE: title still says "hit 60 °C?" though the reel now reaches 100 °C — ask Varshith.
- Published "#11 Renderer" v3 (same URL, build 2026-10-12 22:12, 2:35, 4,650 frames, 6.1 MB page). Sent Varshith the 26-frame v3 sheet. Waiting for his cut list (what to remove).
- Varshith asked what is redundant from 0–100 °C. Proposed cut list (awaiting his OK, nothing changed yet): cut "cooling centres", "asphalt goes soft" (keep the later tar beat), "cables overheat" (merge manhole into the AC/blackout beat), "jets grounded", "54.4 °C reliably measured" (move to end card), "leaves die", "traffic lights 74 °C", "plastic sags", and merge the two e-bike captions into one fire + fireball beat; sauna line optional. Target ~90 s with a faster climb; title → "What if your city hit 100 °C?"; end card → 54.4 °C Death Valley fact (NYC 41 °C is already a caption).
