# Video rules (recommended defaults)

Read this file at the start of every reel build, together with the style spec (`what-if-reels-style-spec.md` in the claude.ai "insta reels" project).

These are **recommendations, not hard constraints.** Don't enforce them in code: no asserts, no config flags, no automatic checks that fail a render. Apply them with judgment for each video. If a reel deliberately breaks a rule, say why in one line in that reel's `README.md`. Where a rule clashes with the style spec, the style spec wins.

Every rule below has the same three parts: **Why**, **Recommended** and **Check before render**. Add new rules in the same format.

---

## 1. Win the first second

**Why.** On both Instagram and YouTube Shorts, the strongest signal is whether people swipe away right away. If they do, the reel stops getting shown to new viewers. About half of Instagram videos are watched without sound, so the hook has to work muted.

**Recommended**
- Show the full title from frame 0, big, in the top third, with no fade-in. This also makes it the auto thumbnail.
- Frame 0 should already show something striking, and something should visibly change within about the first second. Don't open on black, on a fade-in, or on a still establishing shot that sits there for 2 seconds.
- Start as close to the action as the story allows, for example with the water already starting to pull back instead of a calm beach first.
- The premise should be clear from on-screen text alone. Sound is a bonus, not the hook.
- Get the first caption or counter on screen early (around the 2–3 s mark) so the eye has a reason to keep reading after the title.

**Check before render.** Preview t = 0, 0.5 and 1.0 (`python render.py preview prev 0 0.5 1`). Muted, from those three frames only: would a stranger know the question, and can they see something happening?

---

## 2. Make it worth sending

**Why.** DM sends are now Instagram's biggest Reels signal, and shares count heavily on Shorts. People share a fact they want to use on someone else, not a vibe.

**Recommended**
- Give each reel at least one forwardable line: a surprising, specific, fact-checked claim someone would send with "wait, did you know this?". Keep it on screen as its own caption, held long enough to screenshot (about 3–4 s), not buried in the middle of a sentence.
- Make the twist land (from the style spec, e.g. "One upside: no more hurricanes."). A turn the viewer didn't expect is the most shareable beat.
- Compare numbers to things people already know ("Everest would fit, with 2 km to spare") instead of giving the bare figure.
- Use the most surprising real fact you have in the end card's "THIS IS FICTIONAL · [real fact]" slot. That slot is a share trigger, not a disclaimer.
- Keep requests like "send this to…" off the screen. If you want a call to action, put a soft one in the post caption.

**Check before render.** List the reel's 1–3 forwardable lines in its `README.md`. If you can't name one, the script isn't finished.

---

## 3. Make it loop

**Why.** On Shorts, every replay counts as a view. On both platforms, rewatches tell the algorithm people are watching all the way through. A reel that runs back into its own start gets replays for free.

**Recommended**
- Design the last second to flow into frame 0. Ideally the final shot comes back to the opening composition, colour or scene, or the last line sets up the title question again.
- Keep the end card short (about 3–5 s). A long, static black card is where people swipe away. (#02's end card runs about 6 s.)
- Avoid anything that says "it's over": no "THE END", outro or subscribe screen.
- Plant a rewatch hook: a detail viewers only catch the second time, set in `endCard.hook` (e.g. the duck riding the water all the way to the bottom of the trench).
- Make the sound loop too. The last half-second of `audio.py` should match the level and feel of the opening ambience so the join isn't jarring.

**Check before render.** Preview the last frame and frame 0 side by side, then play the last 3 s straight into the first 3 s. Does it feel like one continuous moment rather than a stop and a restart?

---

## 4. Show the big moments (set pieces)

**Why.** A caption tells; a set piece shows. A *set piece* is a moment where a consequence physically happens in frame, big enough to read on a phone: the elevated track crumbling, a subway entrance flooding in the distance, a dead satellite coming down over the skyline. These are the frames people stay for, pause on and rewatch, and they make a reel feel like a film instead of captions over a scene. But spectacle added for its own sake feels forced and cheapens the premise. This rule is about spotting the big moments the story already has and making sure they're seen, not about adding explosions.

**Recommended**
- While scripting, go through the consequences and ask of each one: *would this really happen in this scenario, and could you see it from this camera?* If both are yes and it would look striking, show it happening, timed to land while its caption is up. If either is no, leave it as a caption or a quiet change. Don't stage it.
- A few strong ones beat many weak ones, usually around 3–5 in a reel, spaced out and getting bigger (the track crumbles before the first tower falls). Show one at a time, where the eye already is, and keep it out from under the captions and counters.
- Quiet stretches are fine when they do a job (the city going dark, Hachikō alone in the snow); the contrast is what makes the set pieces land. What to avoid is a long stretch where nothing changes and nothing is meant to be felt.
- Use depth and the frame edges. Something big in the far distance still reads if it's large and lit. Something entering or crossing the frame (a fireball streaking across, a train sliding past) puts the camera inside the world.
- **Witness** (POV reels): when the situation would naturally include someone else (a crewmate on Mars, a stranger filming the tornado), put them in frame and let them react. They show from the outside what is happening to "you" (scale, danger, a reaction you can't see on yourself), while the camera, the captions and the "you" voice stay yours. Don't invent a companion where you'd realistically be alone.

**Examples of what was missed.** #06 Tokyo: the elevated track sagging and falling before the towers; the subway entrance visibly flooding in the middle distance; one big satellite coming down as a fireball across the sky instead of only far-off streaks. #05 Mars: a crewmate at the airlock, whose reaction and view of you add the third-person angle while the camera stays your eyes.

**Check before render.** List the set pieces with their times in the reel's `README.md`, plus any big consequence you chose not to stage and why. Preview the middle frame of each set piece at phone size: can you tell what is happening without the caption?

---

## Quick pre-render checklist
- [ ] Title readable on frame 0, and something moves within ~1 s
- [ ] Premise is clear with the sound off
- [ ] At least one forwardable line, held long enough to screenshot, listed in the README
- [ ] Strongest real fact is in the end card
- [ ] End card ~3–5 s, and the last second flows back into frame 0 (picture and sound)
- [ ] The big moments the story already has are shown happening in frame (and only where they make sense); set pieces listed in the README
- [ ] Any deliberate deviation from these rules noted in the README
