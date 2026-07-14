# Quillshot 🏹

A typing roguelike. You are a stickman archer holding the left edge of a
dusk-lit field while a horde of stickmen marches in from the right, each with
a word floating over its head. **Type the word to draw and loose an arrow.**
Typo? Your archer panics and throws a paper airplane instead — it has never
hurt anyone.

## How to play

- **Type** the first letter of any visible enemy's word to lock on (the
  nearest match wins), then finish the word to fire. Every correct letter
  pulls the bowstring further back.
- A **wrong letter** flings a harmless paper airplane, resets your progress
  on that word, and breaks your combo.
- Flawless words build a **combo multiplier (x1 → x5)** — watch the flame
  grow around the archer.
- Enemies that reach you swing for **1 of your 3 hearts**. At 0 you're
  overrun. Best score is saved locally.
- **Esc** pauses. **1 / 2 / 3** picks a boon between waves. **Enter** retries.

## The horde

- **Walker** — ordinary word, ordinary menace.
- **Runner** — sprints, but only carries a 2–3 letter word.
- **Brute** — two words, two arrows.
- **Bomber** — kill it before its fuse ring runs out or it detonates on you
  from range.
- **Flyer** — bobs along a sine wave, then swoops.
- **The Stick King** (every 5th wave) — a whole sentence, word by word, while
  he hurls typeable projectiles at you.

## Boons

Multishot forks, flaming arrows with burn spread, frost focus, sharpshooter
(shorter words), extra hearts, quickdraw volleys, and Second Wind (first typo
each wave becomes a real arrow).

## Tech

- Vite + vanilla canvas 2D, zero runtime dependencies, zero assets.
- Stickman + pixel hybrid: characters are smooth round-capped stickmen with
  procedural walk cycles, IK knees, draw-bow anticipation and ragdoll deaths;
  the parallax dusk backdrop is rendered to a low-res offscreen canvas and
  scaled up with smoothing off, and every particle is a chunky square.
- All sound is WebAudio-synthesized: ticks that rise as you type, bowstring
  twangs, thunks, fuse beeps, boss roars, and one very sad airplane fwip.
- Object pools for particles/arrows/planes, hit-stop ≤ 100 ms, damped-sine
  screen shake ≤ 6 px, exponential smoothing on everything that moves.

## Run locally

```bash
npm install
npm run dev
```
