# #11 — What if your city hit 60 °C?

Still reel: one locked camera on the TKTS red steps in Times Square, about 1:35. The temperature climbs from a normal 22 °C to 60 °C and every step shows an effect: the crowd thins, people faint and are helped, the city breaks down. Then a storm breaks the heat, the rain boils off the road, and the square comes back to frame 0 (loop).

**Status:** renderer page published ("#11 Renderer", https://claude.ai/artifact/1tYkrWYX4nY22tESqGJpu4); waiting for the GPU render.

## Re-render (GPU renderer page)
```
npm i                                   # three, mp4-muxer, esbuild, @fontsource/tinos (see package.json)
TRIM=5.5 python audio.py                # audio.wav, about -14.3 LUFS
python build_renderer.py . 11-renderer.html "#11 - What if your city hit 60 °C?"
```
Publish `11-renderer.html` as an artifact with capabilities `{db: {}, downloads: true}`, open it in the Claude app, press Render, then Save. The page logs opens to `boots` and runs to `renders`.

## Files
- `timeline.json`: the script. Temperature curve (`temp`), survival estimates (`survival`, hours by °C), crowd / traffic / screens curves, storm and steam, named `beats` (times of every on-screen event), ticker messages, captions, counters, end card.
- `src/main.js`: the scene (Times Square set from #03, rebuilt matte with shadows, no bloom), the hero cast and their pose tracks, heat effects (2D shimmer and grade), the #02/#08 text layer.
- `src/people.js`: the #08 person builder (sculpted head, eyes, hair, torso texture) with summer clothes, a waist/body rig and pose blending (fan, sway, buckle, lie, kneel, sit on steps…), and the instanced crowd (walking legs, lying).
- `src/util.js`: shared helpers.
- `reel.html`: loads three.js from `node_modules` via an import map.
- `render.py`, `sheet.sh`: cloud test frames only.
- `audio.py`: procedural sound on the same timeline (writes `audio.wav`).
- `renderer.js`, `build_renderer.py`: the GPU renderer page (WebCodecs H.264 at 14 Mbps, pre-encoded AAC copied into the MP4).

## Test frames
```
npm i three@0.160.0 @fontsource/tinos@5.3.0
pip install playwright numpy scipy
python render.py preview prev 0 1 27 49.5 81.5      # JPGs in prev/
./sheet.sh prev 5                                    # contact sheet
RINIT="window.GL_W=1080;window.GL_H=1920;window.SHADOW=4096;" python render.py preview full 27   # full quality check
```

## Forwardable lines (video rule 2)
1. "Apple builds iPhones for up to 35 °C." (Apple support: 0–35 °C ambient operating range)
2. "Down in the subway it's worse. One platform hit 40 °C on a 30 °C day." (RPA, Aug 2018: 104 °F at Union Square on an 86 °F day)
3. "In 2018, 42 °C killed 23,000 bats in two days in Australia." (Cairns, 26–27 Nov 2018)
4. End card: New York's record is 41 °C (106 °F), from 1936, never broken.

## Set pieces (video rule 4)
| t (s) | What happens in frame |
|---|---|
| 25.6 | First faint: an older man collapses mid-frame; a woman kneels by him |
| 30.6–33 | Elmo pulls his costume head off and slumps against a lamp post; two more people go down |
| 35.6 | A manhole on 7th Ave puffs a smoke column; an ambulance pushes in |
| 41–47 | Crosswalk stripes go soft and wobble; medics work on the old man; people lie in the shade |
| 47.4 | An airliner over the street banks away |
| 48.8 | The hot-dog vendor collapses behind his cart; a passer-by kneels by him |
| 52.6–57 | The screens of Times Square go dark block by block; a stretcher is carried to the ambulance |
| 58.4 | Pigeons drop off the lamp arm one by one |
| 63.4 | The last two people go down into the subway |
| 68 | Banners sag; the hot-dog umbrella smokes |
| 80–84 | The storm: rain, and steam bursting off the whole square |

Not staged: heat deaths. Collapses are slumps, sit-downs and falls, each followed by someone helping; nobody is left lying in the square at the end.

## Deviations from the video rules
- None deliberate so far. (Rule 1: the full title is on screen from frame 0 and traffic/people move from the first frame.)

## Facts and sources
- New York's record: 106 °F (41 °C), 9 July 1936, Central Park. NWS: https://www.weather.gov/media/okx/Climate/CentralPark/extremes.pdf
- iPhone ambient operating range 0–35 °C. Apple: https://support.apple.com/en-in/HT201678
- Subway platform 104 °F on an 86 °F day. RPA: https://rpa.org/news/lab/hotter-than-a-new-york-city-platform
- Times Square: 283,090 pedestrians a day on average in 2023 (caption says "about 280,000"). Times Square Alliance 2024 annual report.
- Con Edison equipment fails in heat waves; manhole fires. CBS New York; Queens Chronicle.
- Phoenix, 20 June 2017: American Eagle regional jets (Bombardier CRJ, max 118 °F ≈ 48 °C) cancelled at 119 °F. The Points Guy; NPR.
- 23,000+ spectacled flying foxes died in Cairns, 26–27 Nov 2018, above 42 °C. The New Daily.
- World record 56.7 °C (Death Valley, 10 July 1913), official but disputed; 54.4 °C the highest reliably measured. Skeptical Science / WMO.
- **Survival counter (estimates, labelled "est." on screen):**
  - 22–43 °C, in days: US Army desert survival table (FM 21-76, from Adolph's 1947 *Physiology of Man in the Desert*): a person resting in shade with no water. Values used: 21 °C 10 d, 27 °C 9 d, 32 °C 7 d, 38 °C 5 d, 43 °C 3 d, 49 °C 2 d. **Quoted from memory; verify against the manual before render.**
  - 46–60 °C, in hours: own heat-balance estimate. At New York's summer humidity (dew point ~20 °C) the body can no longer shed heat above roughly 44 °C (Penn State lab limits, critical wet-bulb 25–28 °C in hot-dry air), after which core temperature climbs; time to reach 43 °C core (the Vanos et al. 2023 survivability threshold). Could be off by half either way.
