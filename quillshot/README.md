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
- Enemies that reach you swing for **1 of your 3 hearts**. At 0 you're
  overrun. Best scores are saved locally, per difficulty.
- **Esc** pauses. **1 / 2 / 3** picks a boon between waves. **Enter** retries.
- On the title screen: **← / →** or **1–4** picks a difficulty.

## Weapon evolution

Flawless words build a combo multiplier — and the multiplier **is** your
weapon. Each tier transforms your arsenal with its own look and sound:

- **x1 — Bow & arrow.** The classic.
- **x2 — Twin daggers.** Two fast crossing blades, metallic ring on impact.
- **x3 — Magic bolts.** Glowing homing bolts with arcane trails.
- **x4 — Spectral blades.** A fan of translucent slashes; you start levitating.
- **x5 — SPIRIT DRAGON.** A serpentine dragon of light snakes through your
  target with a small area-of-effect bite. Deep roar included.

One typo and it all reverts to the bow. The airplane still does nothing.

## Difficulty modes

| | spawns | speed | words | special |
|---|---|---|---|---|
| **EASY** | ×1 | ×1 | normal | the original tuning |
| **MEDIUM** | ×1.4 | +15% | one tier longer (50%) | flyers/bombers arrive early |
| **HARD** | ×1.8 | +30% | one tier longer (50%) | two-word enemies, boss every 4 waves |
| **EXTREME** | ×1.8 | +30% | cipher strings | 0/O · 1/l/I · 5/S · 8/B · 2/Z, **case-sensitive**, typed exactly — sometimes whole punctuated sentences |

Score multipliers: ×1 / ×1.5 / ×2 / ×3. On EXTREME the word tags render in
the pixel font, where `0` and `O` are genuinely ambiguous. That's the game.

## Power words

Every couple of waves a **runebearer** appears — a golden stickman wreathed
in orbiting runes. Finish its gold-tagged word and time dilates while a
random super attack fires: **chain lightning** through the nearest enemies,
a two-second **fire rain** over the field, or a **wind blade** that slices
the entire ground row.

## The horde

- **Walker** — ordinary word, ordinary menace.
- **Runner** — sprints, but only carries a 2–3 letter word.
- **Brute** — two words, two arrows.
- **Bomber** — kill it before its fuse ring runs out or it detonates on you
  from range.
- **Flyer** — bobs along a sine wave, then swoops.
- **Runebearer** — golden. Kill for a super attack.
- **The Stick King** (boss waves) — a whole sentence, word by word, while he
  hurls typeable projectiles at you.

## Boons

Multishot forks, flaming arrows with burn spread, frost focus, sharpshooter
(shorter words), extra hearts, quickdraw volleys, and Second Wind (first typo
each wave becomes a real shot).

## Tech

- Vite + vanilla canvas 2D, zero runtime dependencies, zero assets.
- Stickman + pixel hybrid: characters are smooth round-capped stickmen with
  procedural walk cycles, IK knees, draw anticipation and ragdoll deaths;
  the parallax dusk backdrop is rendered to a low-res offscreen canvas and
  scaled up with smoothing off, and every particle is a chunky square.
- All sound is WebAudio-synthesized: rising typing ticks, five weapon voices,
  transform jingles, fuse beeps, boss roars, super-attack thunder, and one
  very sad airplane fwip.
- Object pools for particles/projectiles/planes, a capped effects list for
  supers, hit-stop ≤ 100 ms, damped-sine screen shake ≤ 6 px, exponential
  smoothing on everything that moves.

## Run locally

```bash
npm install
npm run dev
```
