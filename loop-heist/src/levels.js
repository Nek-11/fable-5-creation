// Hand-crafted levels. Every map is exactly 20 x 12 tiles (one screen).
//
// Map legend
//   #  wall            .  floor           x  glass display case (solid,
//   P  player start    E  exit zone          blocks walking, NOT guard vision)
//   g  gem             a b c d e  pressure plates
//   s t  toggle switches
//   k  pushable crate (sokoban: one tile per shove; holds plates down,
//      blocks laser beams and guard vision; resets home every loop)
//   A B V ...  door tiles, controlled via `links` below
//   l  blinking laser gate   L  always-on laser gate
//
// SPACE throws the top carried gem ~3 tiles in the facing direction: it
// sails OVER lasers, cases and crates, stops at walls/closed doors, and any
// heister (including a parked ghost) standing where it lands catches it.
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
//
// WIN RULE — TEAM DELIVERY: gems reset to their pedestals at the start of
// every loop; ghosts re-collect them along their replayed paths (first
// actor to touch a gem that tick carries it). The heist completes the
// moment the player stands in the EXIT zone and every gem is carried by
// somebody who is ALSO in the exit zone — so the core technique is to end
// a recording standing in the exit while holding loot ("parking a loaded
// ghost"), then bring the rest yourself. Hold F/Shift to fast-forward the
// waiting parts.
//
// `accent` colours the level's rugs / mosaic inlays / paintings / banners
// so each wing of the museum reads differently. Purely cosmetic.

export const LEVELS = [
  // ------------------------------------------------------------------
  // LEVEL 1 — "First Job"
  // Teaches: movement, grabbing loot, the exit, the 20 s loop bar.
  //
  // SOLUTION (1 loop): from P head down the left gallery, east along the
  // middle gap at row 7, north up the little corridor (13,9)->(13,6) into
  // the display room, grab the gem at (13,4), back out south, then east to
  // the exit at (18,10). ~40 tiles of walking ≈ 8 s — generous. One gem,
  // one carrier: you standing in the exit with it = everything delivered.
  // ------------------------------------------------------------------
  {
    name: 'First Job',
    hint: 'WASD to move. Grab the gem and stand in the EXIT before the loop ends.',
    maxGhosts: 1,
    accent: { rug: '#33202c', trim: '#7a3b52', deco: '#a04458' },
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
  //   Loop 2: run east through the row-8 gap, wait at (13,7) while your
  //           ghost reaches the plate (hold F to fast-forward the wait),
  //           walk through door A, grab the gem at (13,4), and stand on
  //           the exit at (13,9) carrying it. ~10 s.
  // ------------------------------------------------------------------
  {
    name: 'Two Hands',
    hint: 'The vault opens only while the plate is held. Hold it, press R, let your ghost take over. F fast-forwards.',
    maxGhosts: 2,
    accent: { rug: '#1c3334', trim: '#3e7a74', deco: '#3e8a80' },
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
  //           blink — and stand on the exit at (17,10) with it. ~10 s.
  //           (One gem, carried by you, in the exit: delivered.)
  // ------------------------------------------------------------------
  {
    name: 'Timing Lock',
    hint: 'Timed pads open doors for 2 seconds. Send a ghost to press them while YOU stand at the door.',
    maxGhosts: 3,
    accent: { rug: '#3a2c14', trim: '#8a6a24', deco: '#b8913a' },
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
  // SOLUTION (2 loops, or a calmer 3-loop team plan):
  //   Loop 1: don't touch the plate yet! Idle near it (left strip, gap at
  //           (3,4)) until ~7-8 s on the bar (hold F to skip the wait),
  //           THEN stand on plate a. Press R (or let the loop run out) —
  //           the ghost now opens door A at ~8 s every loop.
  //   Loop 2 (carry both yourself): run down the left strip and along the
  //           bottom to the lower gem (17,8) — safe, the guard is still
  //           boxed in the top half. Loop back via row 10 -> col 1 -> row 1.
  //           At ~8 s the door opens and the guard marches DOWN the strip;
  //           follow in behind him (his cone faces the way he walks), grab
  //           the top gem (17,3), retreat out the top before he turns, then
  //           row 1 -> col 1 -> row 10 -> up the gap (11,9)/(11,8) into the
  //           exit room and stand on E (11,5) with both gems. ~15 s.
  //   OR team delivery: loop 2 = grab the lower gem early, walk into the
  //   exit room and press R STANDING ON E — that ghost re-parks there with
  //   the gem every loop. Loop 3 = take the top gem after the ~8 s door
  //   opening and join your parked ghost on E. Win the moment you arrive.
  // ------------------------------------------------------------------
  {
    name: 'Night Watch',
    hint: 'He cannot see ghosts. Park a loot-carrying ghost ON the exit (press R there) and bring the rest yourself.',
    maxGhosts: 3,
    accent: { rug: '#1e2440', trim: '#40518c', deco: '#5a6ab0' },
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
  // corridor, a held plate, and 3 gems — one of which is too far away to
  // fetch on your final run, so a PARKED GHOST must deliver it: a past-you
  // hauls the far gem back and stands in the getaway zone holding it.
  //
  // SOLUTION (4 loops):
  //   Loop 1: flip switch s (1,6) at ~1 s, then walk down and stand on
  //           plate b (4,10) from ~3 s. Press R around 6 s — the ghost ends
  //           standing on b, holding door B open forever after ~3 s.
  //   Loop 2 (the courier): go up col 2 (do NOT walk over s again!), enter
  //           the laser corridor at (1,3), dash the three blink-gates east,
  //           grab the far gem g (18,1) — approach along row 2 so you don't
  //           bump switch t — return through the lasers, down col 2, and
  //           press R while STANDING ON THE EXIT E (1,10) at ~12 s. Every
  //           loop from now on this ghost re-fetches that gem and parks on
  //           the exit with it from ~12 s to the end of the loop.
  //   Loop 3: run the corridor again, flip switch t (16,1) at ~4-5 s,
  //           press R. (s @ ~1 s + t @ ~5 s -> vault door V opens at ~5 s.)
  //   Loop 4: grab g (9,9) behind door B (open from ~3 s, ghost 1), east
  //           into the vault V (open ~5 s, ghosts 1+3), grab g (15,6),
  //           back west and stand on E from ~9 s carrying two gems. Hold F
  //           to fast-forward until ghost 2 arrives on the exit at ~12 s —
  //           three gems in the getaway zone at once: heist complete.
  // ------------------------------------------------------------------
  {
    name: 'The Vault',
    hint: 'Ghosts re-flip switches at the same moment every loop. Park loot-carrying ghosts ON the exit to deliver for you.',
    maxGhosts: 4,
    accent: { rug: '#2c1e3e', trim: '#5c3f86', deco: '#8a5ab8' },
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

  // ------------------------------------------------------------------
  // LEVEL 6 — "Special Delivery"
  // Teaches: THROWING. A static laser wall splits the museum; the only way
  // across on foot is the blinking gate up top. Door A (exit pocket) needs
  // plate a held — and with a ONE-ghost cap, your single past self has to
  // do two jobs: hurl the gem over the laser wall, then go hold the plate.
  //
  // SOLUTION (2 loops):
  //   Loop 1: down the left wing, grab the gem (3,6), walk east to (9,6),
  //           keep facing the laser wall and press SPACE — the gem sails
  //           over the L column and lands at (12,6). Then back west and
  //           south onto plate a (3,8); press R standing on it (~7 s).
  //   Loop 2: east along row 1, wait out the blinking gate (10,1-2), down
  //           col 12 to the landing spot — your ghost re-throws it to you
  //           every loop (~3 s) — grab it, continue east through door A
  //           (held from ~7 s) and stand on E (17,6) with the gem. ~9 s.
  // ------------------------------------------------------------------
  {
    name: 'Special Delivery',
    hint: 'Loot flies OVER lasers: face them, press SPACE. One ghost, two jobs — throw the gem across, then hold the plate.',
    maxGhosts: 1,
    accent: { rug: '#3a2a14', trim: '#8a5f24', deco: '#c07830' },
    map: [
      '####################',
      '#P........l........#',
      '#.........l........#',
      '#..xx.....#........#',
      '#..xx.....L....#####',
      '#.........L....#...#',
      '#..g......L....A.E.#',
      '#.........L....#...#',
      '#..a......L....#####',
      '#.........L........#',
      '#.........L........#',
      '####################',
    ],
    links: {
      A: { type: 'hold', srcs: ['a'] },
    },
    lasers: { period: 170, on: 95, stagger: 0 },
    guards: [],
  },

  // ------------------------------------------------------------------
  // LEVEL 7 — "Heavy Lifting"
  // Teaches: CRATES. The vault door A wants plate a held, but there is a
  // crate: shove it six tiles down the lane and it holds the plate FOREVER
  // (well — until the rewind, when your ghost re-shoves it). The watchman
  // patrols straight across the push lane; conveniently, the crate you are
  // pushing blocks his view of you.
  //
  // SOLUTION (1 careful loop; ghosts optional):
  //   Grab the west gem (2,4), then push the crate (3,6) east along row 6
  //   — pause behind it whenever the guard (col 11) sweeps past, the crate
  //   hides you — until it sits on plate a (9,6). Door A opens for good.
  //   Slip across his column behind his back, through A (14,4), grab the
  //   vault gem (16,2), and stand on E (16,7) with both. ~14 s.
  //   Prefer the crew? Loop 1: push the crate + R. Loop 2: just loot.
  // ------------------------------------------------------------------
  {
    name: 'Heavy Lifting',
    hint: 'Crates shove one tile per push. Park one on the plate and no ghost ever has to hold it — it hides you, too.',
    maxGhosts: 2,
    accent: { rug: '#33270f', trim: '#6d5838', deco: '#8a734b' },
    map: [
      '####################',
      '#P...#........#....#',
      '#....#........#.g..#',
      '#....#...##...#....#',
      '#.g..#...##...A....#',
      '#....#........#....#',
      '#..k.....a....#....#',
      '#....#........#.E..#',
      '#....#...##...#....#',
      '#....#...##...#....#',
      '#....#........#....#',
      '####################',
    ],
    links: {
      A: { type: 'hold', srcs: ['a'] },
    },
    guards: [
      // sweeps the middle yard, straight across the crate lane
      { path: [ [11, 2], [11, 9] ], speed: 31 },
    ],
  },

  // ------------------------------------------------------------------
  // LEVEL 8 — "The Long Toss"
  // The bucket brigade. Two static laser fences split the museum into
  // west | mid | east. The bottom corridor's timed doors C and D only have
  // pads on their EAST side — you can always go west, never come back.
  // The far gem can only travel east the way loot should: thrown, zone to
  // zone, ghost to ghost.
  //
  // SOLUTION (3 loops):
  //   Loop 1 (west thrower): west along the corridor — pad d (11,10) opens
  //           D, pad c (6,10) opens C — up the west wing, grab gem A (1,1),
  //           stand at (4,3) facing east, SPACE: it sails over the first
  //           fence and lands at (7,3). Press R (~7 s); this ghost stays
  //           walled off in the west, forever tossing.
  //   Loop 2 (mid catcher): pad d, through D, up the mid lane to (7,3);
  //           the gem lands on you (~7 s) — you catch it — step east to
  //           (9,3), face east, SPACE: over the second fence to (12,3).
  //           Press R (~8.5 s).
  //   Loop 3 (you): no doors needed. North up col 17, grab gem B (15,2)
  //           from below, wait at (12,3); the brigade delivers gem A at
  //           ~9 s; take it, then south around the booth — (12,7), west to
  //           (15,6) — and onto E (14,6) with both gems. ~12 s. (Hold F.)
  // ------------------------------------------------------------------
  {
    name: 'The Long Toss',
    hint: 'Doors here only open from the east — loot can only come BACK by air. Build a throwing chain of past-yous.',
    maxGhosts: 4,
    accent: { rug: '#16321e', trim: '#2f7a4a', deco: '#3e9a5e' },
    map: [
      '####################',
      '#g...L....L...xxx..#',
      '#....L....L...xgx..#',
      '#....L....L........#',
      '#....L....L........#',
      '#....L....L..###...#',
      '#....L....L..#E....#',
      '#....L....L..#.....#',
      '#....L....L..###...#',
      '#....#....#........#',
      '#....Cc...Dd.....P.#',
      '####################',
    ],
    links: {
      C: { type: 'timed', srcs: ['c'], duration: 120 },
      D: { type: 'timed', srcs: ['d'], duration: 120 },
    },
    guards: [],
  },

  // ------------------------------------------------------------------
  // LEVEL 9 — "Silent Alarm"
  // Two watchmen, one gem in a sealed display island, and a crate that is
  // both key and cover. The island only opens at door A (plate a held);
  // the gem's east side is walled with cases — it LEAVES by air only.
  //
  // SOLUTION (3 loops, exactly 2 ghosts — no slack):
  //   Loop 1: slip south past guard 1's row-3 sweep while he walks away,
  //           then push the crate (2,6) down col 2 onto plate a (2,9)
  //           (3 shoves). Door A open for good. Press R (~7 s).
  //   Loop 2: wait out guard 1, enter the island inlet (10,5)-(11,5) once
  //           A opens (~7 s), grab the gem (12,5), face east, SPACE — it
  //           clears both cases and lands at (15,5), right beside guard
  //           2's beat. Press R (~9.5 s).
  //   Loop 3: run the east route: row 1 east, then DOWN COL 18 (outside
  //           his cone), snag the landed gem at (15,5) the moment guard 2
  //           faces away (~10.5 s), then to E (17,9). He walks right past
  //           the exit — ghosts he can't see, and you he mustn't. ~13 s.
  // ------------------------------------------------------------------
  {
    name: 'Silent Alarm',
    hint: 'The island loot leaves by AIR only. A crate is both key and cover — and the exit sits on his patrol route.',
    maxGhosts: 2,
    accent: { rug: '#242833', trim: '#4a5568', deco: '#aa3d4d' },
    map: [
      '####################',
      '#P.................#',
      '#..................#',
      '#......#...........#',
      '#......#.#xxxxx....#',
      '#........A..gxx....#',
      '#.k....#.#xxxxx....#',
      '#......#...........#',
      '#..................#',
      '#.a..............E.#',
      '#..................#',
      '####################',
    ],
    links: {
      A: { type: 'hold', srcs: ['a'] },
    },
    guards: [
      // the inlet watcher, sweeping row 3 west of the pillar
      { path: [ [1, 3], [6, 3] ], speed: 31 },
      // the east-wing watcher — his beat runs right past the exit
      { path: [ [16, 2], [16, 9] ], speed: 31 },
    ],
  },

  // ------------------------------------------------------------------
  // LEVEL 10 — "The Impossible Job"
  // Everything at once: a two-switch vault, a crate for the plate, a
  // three-gate laser weave, two guards, three gems, and a getaway van
  // (three E tiles) behind a laser window you can THROW through. Five
  // loops of yourself, conducted.
  //
  // SOLUTION (5 loops):
  //   Loop 1: cross guard 1's row-7 lane early (he starts far east at
  //           (12,7)), flip switch s (3,4) ~1.5 s, then shove the crate
  //           (7,6) three tiles south onto plate b (7,9) — door B open for
  //           good, and s is ON every loop. R ~7 s.
  //   Loop 2 (the catcher): quick job — around to (1,6) via (3,7)/(2,6),
  //           and press R standing on the MIDDLE getaway tile (1,8). This
  //           empty-handed ghost is your receiver.
  //   Loop 3: north wing: cross the lane, up col 4, east along row 2 past
  //           guard 2's short beat (slip by when he turns), dash the three
  //           blinking gates (cols 11/13/15 are staggered), flip switch t
  //           (17,2) at ~5.5 s. R. Vault V now opens at ~5.5 s each loop.
  //   Loop 4 (the courier): same weave run, but grab gem 3 (18,1), come
  //           back through the gates, down to the van, park on (1,7) at
  //           ~10 s holding it. R.
  //   Loop 5 (the maestro): wait out guard 2 at (7,5), through door B
  //           (~5.5 s), grab gem 2 (11,5), back west to (4,8), face west,
  //           SPACE — the gem sails through the laser window onto your
  //           catcher at (1,8). CAUGHT. Then the safe row-10 highway east,
  //           V (13,9), gem 1 (17,9) ~10 s, highway back west, wait for
  //           guard 1 to turn east (~12.5 s), slip in via (3,7)-(1,6) and
  //           stand on (1,9). Three heisters, three gems, one van. ~14 s.
  // ------------------------------------------------------------------
  {
    name: 'The Impossible Job',
    hint: 'Conduct the orchestra: a catcher in the van, a courier through the weave, a crate on the plate — and you, everywhere at once.',
    maxGhosts: 5,
    accent: { rug: '#2e2410', trim: '#8a6a24', deco: '#c9a13d' },
    map: [
      '####################',
      '#..........l.l.l..g#',
      '#..........l.l.l.t.#',
      '#..........l.l.l...#',
      '#..s......xxx#######',
      '#.........Bgx......#',
      '#......k..xxx......#',
      '#EL................#',
      '#EL..........#######',
      '#EL....b.....V...g.#',
      '#.L.P........#######',
      '####################',
    ],
    links: {
      B: { type: 'hold', srcs: ['b'] },
      V: { type: 'switch', srcs: ['s', 't'], mode: 'all' },
    },
    lasers: { period: 200, on: 120, stagger: 66 },
    guards: [
      // the hall sweeper: starts far east so early crossings are safe
      { path: [ [12, 7], [4, 7] ], speed: 31 },
      // short nervous beat guarding the weave approach
      { path: [ [9, 2], [9, 4] ], speed: 31 },
    ],
  },
];
