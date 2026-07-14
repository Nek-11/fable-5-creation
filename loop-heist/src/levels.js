// Hand-crafted levels. Every map is exactly 20 x 12 tiles (one screen).
//
// Map legend
//   #  wall            .  floor           x  glass display case (solid,
//   P  player start    E  exit zone          blocks walking, NOT guard vision)
//   g  gem             a b c  pressure plates
//   s t  toggle switches
//   A B V ...  door tiles, controlled via `links` below
//   l  blinking laser gate   L  always-on laser gate
//
// Link types
//   hold   door is open only while a linked plate is held down
//   timed  a press opens the door for `duration` ticks, then it shuts
//   switch door is open while linked switches are ON ('all' or 'any')
//
// Guards are defined in pixel-free tile coords; they patrol their waypoint
// polyline back and forth, reversing early if a closed door blocks them.
// Guards never see ghosts, and their motion is a pure function of the tick
// and door states, so replays stay deterministic.

export const LEVELS = [
  // ------------------------------------------------------------------
  // LEVEL 1 — "First Job"
  // Teaches: movement, grabbing loot, the exit, the 20 s loop bar.
  //
  // SOLUTION (1 loop): from P head down the left gallery, east along the
  // middle gap at row 7, north up the little corridor (13,9)->(13,6) into
  // the display room, grab the gem at (13,4), back out south, then east to
  // the exit at (18,10). ~40 tiles of walking ≈ 8 s — generous.
  // ------------------------------------------------------------------
  {
    name: 'First Job',
    hint: 'WASD to move. Grab the gem, reach the EXIT before the loop ends.',
    maxGhosts: 1,
    map: [
      '####################',
      '#P.....#...........#',
      '#......#...######..#',
      '#......#...#....#..#',
      '#..xx..#...#.g..#..#',
      '#..xx..#...#....#..#',
      '#......#...##..##..#',
      '#...........#..#...#',
      '#......#....#..#...#',
      '#......#...........#',
      '#......#..........E#',
      '####################',
    ],
    links: {},
    guards: [],
  },

  // ------------------------------------------------------------------
  // LEVEL 2 — "Two Hands"
  // Teaches: recording a ghost, hold-plates, R to rewind early.
  // The vault door A only stays open while plate a is held — and the plate
  // is across the room, so one burglar can never do both.
  //
  // SOLUTION (2 loops):
  //   Loop 1: walk to the plate alcove (enter from (5,4)), stand on plate a
  //           (~2 s in), then press R. A ghost whose recording ENDS on the
  //           plate keeps standing there, holding it all loop.
  //   Loop 2: run east through the row-8 gap, wait a beat at (13,7) while
  //           your ghost reaches the plate, walk through door A, grab the
  //           gem at (13,4), exit at (13,9). ~10 s.
  // ------------------------------------------------------------------
  {
    name: 'Two Hands',
    hint: 'The vault opens only while the plate is held. Hold it, press R, and let your ghost take over.',
    maxGhosts: 2,
    map: [
      '####################',
      '#P.....#...........#',
      '#......#..#######..#',
      '#..##..#..#.....#..#',
      '#..#a..#..#..g..#..#',
      '#..##..#..#.....#..#',
      '#......#..###A###..#',
      '#......#...........#',
      '#..................#',
      '#......#.....E.....#',
      '#......#...........#',
      '####################',
    ],
    links: {
      A: { type: 'hold', srcs: ['a'] },
    },
    guards: [],
  },

  // ------------------------------------------------------------------
  // LEVEL 3 — "Timing Lock"
  // Teaches: TIMED plates (press -> door opens 2 s, then shuts) and
  // staggering two ghosts. Also introduces blinking lasers on the way out.
  // Pad a sits in the lower-left pocket: a->A is a ~14-tile walk, far more
  // than the 2 s window, so pressing it yourself is useless. Same trick
  // again inside the middle room with pad b (serpentine baffles).
  //
  // SOLUTION (3 loops):
  //   Loop 1: run down through (2,5) into the pocket, press pad a (~2 s),
  //           press R.
  //   Loop 2: stand at door A; ghost 1 presses a at ~2 s, door opens, slip
  //           through, snake down the baffles (col 8 -> row 7 -> col 11) to
  //           pad b (9,9), press it (~5 s), press R.
  //   Loop 3: through A at ~2 s (ghost 1), straight to door B and wait;
  //           ghost 2 presses b at ~5 s; through B, grab the gem (16,3)
  //           from the east side, then south — wait out the laser row 6
  //           blink — and into the exit at (17,10). ~10 s.
  // ------------------------------------------------------------------
  {
    name: 'Timing Lock',
    hint: 'Timed pads open doors for 2 seconds. Send a ghost to press them while YOU stand at the door.',
    maxGhosts: 3,
    map: [
      '####################',
      '#.P....#....#......#',
      '#......#....#..xx..#',
      '#......A....B..xg..#',
      '#......#....#..xx..#',
      '##.#####....#......#',
      '#..#...#.####llllll#',
      '#..#...#....#......#',
      '#..#.a.####.#......#',
      '#......#.b..#......#',
      '#......#....#....E.#',
      '####################',
    ],
    links: {
      A: { type: 'timed', srcs: ['a'], duration: 120 },
      B: { type: 'timed', srcs: ['b'], duration: 120 },
    },
    lasers: { period: 190, on: 100, stagger: 0 }, // ~1.7 s on, 1.5 s off
    guards: [],
  },

  // ------------------------------------------------------------------
  // LEVEL 4 — "Night Watch"
  // Teaches: the guard (ghosts are invisible to him) and TIMING your ghost.
  // The guard patrols the right-hand strip top<->bottom. Door A crosses the
  // strip at row 5: while it is closed he bounces in the top half, leaving
  // the bottom gem free; opening it releases him down the whole strip.
  // Plate a (held) controls A — so WHEN your ghost sits on the plate decides
  // when the guard gets rerouted.
  //
  // SOLUTION (2 loops):
  //   Loop 1: don't touch the plate yet! Idle near it (left strip, gap at
  //           (3,4)) until ~7-8 s on the bar, THEN stand on plate a. Press R
  //           (or let the loop run out) — the ghost now opens door A at
  //           ~8 s every loop.
  //   Loop 2: immediately run down the left strip and along the bottom to
  //           the lower gem (17,8) — safe, the guard is still boxed in the
  //           top half. Loop back around via row 10 -> col 1 -> row 1. At
  //           ~8 s the door opens and the guard starts marching DOWN the
  //           strip. Follow in behind him (his cone faces the way he walks),
  //           grab the top gem (17,3), retreat out the top before he turns.
  //           Then row 1 -> col 1 -> row 10 -> up the gap at (11,9)/(11,8)
  //           into the exit room (11,5). ~15 s.
  // ------------------------------------------------------------------
  {
    name: 'Night Watch',
    hint: 'He cannot see ghosts — or through doors. Time your ghost so the door opens when YOU need it.',
    maxGhosts: 3,
    map: [
      '####################',
      '#P.................#',
      '#..#############...#',
      '#..#...#########.g.#',
      '#....a.#########...#',
      '#..#...##..E..##AAA#',
      '#..######.....##...#',
      '#..######.....##...#',
      '#..########.####.g.#',
      '#..########.####...#',
      '#..................#',
      '####################',
    ],
    links: {
      A: { type: 'hold', srcs: ['a'] },
    },
    guards: [
      // patrols the right strip, col 17, between rows 2 and 9
      { path: [ [17, 2], [17, 9] ], speed: 31 },
    ],
  },

  // ------------------------------------------------------------------
  // LEVEL 5 — "The Vault"
  // The finale: a two-switch sequence (BOTH must be ON — and a ghost
  // re-flips its switch at the same moment every loop), a blinking laser
  // corridor, a held plate, and 3 gems — one of which wants a GHOST RELAY:
  // a past-you hauls the far gem back and drops it at the exit doorstep the
  // moment its recording ends.
  //
  // SOLUTION (4 loops):
  //   Loop 1: flip switch s (1,6) at ~1 s, then walk down and stand on
  //           plate b (4,10) from ~3 s. Press R around 6 s — the ghost ends
  //           standing on b, holding door B open forever after ~3 s.
  //   Loop 2 (the relay): go up col 2 (do NOT walk over s again!), enter
  //           the laser corridor at (1,3), dash the three blink-gates east,
  //           grab the far gem g (18,1) — approach along row 2 so you don't
  //           bump switch t — return through the lasers, back down col 2 to
  //           the exit doorstep (~(2,10)) and press R at ~12-13 s. Every
  //           loop from now on, this ghost drops that gem next to the exit
  //           the moment its recording ends.
  //   Loop 3: run the corridor again, flip switch t (16,1) at ~4-5 s,
  //           press R. (s + t both ON -> vault door V opens at ~5 s.)
  //   Loop 4: grab g (9,9) behind door B (open from ~3 s, ghost 1), then
  //           east into the vault V (open ~5 s, ghosts 1+3), grab g (15,6),
  //           back west to the exit corner, wait for ghost 2 to drop the
  //           third gem at ~12-13 s, pick it up, step on E carrying all 3.
  // ------------------------------------------------------------------
  {
    name: 'The Vault',
    hint: 'Ghosts re-flip switches at the same moment every loop — and drop carried loot where their recording ends.',
    maxGhosts: 4,
    map: [
      '####################',
      '#....l..l..l....t.g#',
      '#....l..l..l.......#',
      '#.##################',
      '#............#######',
      '#............#.....#',
      '#s...........V.g...#',
      '#.......###..#.....#',
      '#.......B.#..#######',
      '#.P.....#g#........#',
      '#E..b....#.........#',
      '####################',
    ],
    links: {
      B: { type: 'hold', srcs: ['b'] },
      V: { type: 'switch', srcs: ['s', 't'], mode: 'all' },
    },
    lasers: { period: 200, on: 120, stagger: 66 }, // travelling-wave blink
    guards: [],
  },
];
