// Roguelike boons offered between waves. Levels live on game.up[id].

import { CONFIG as C } from './config.js';

export const UPGRADES = [
  {
    id: 'multishot',
    name: 'MULTISHOT',
    icon: '🏹',
    max: 3,
    desc: 'Typed kills fork a bonus arrow into the nearest other enemy. Stacks.',
  },
  {
    id: 'flame',
    name: 'FLAMING ARROWS',
    icon: '🔥',
    max: 3,
    desc: 'Arrow hits ignite nearby enemies — burning foes drop after a moment. Radius stacks.',
  },
  {
    id: 'frost',
    name: 'FROST FOCUS',
    icon: '❄️',
    max: 3,
    desc: 'Your locked target trudges 35% slower while you type. Stacks colder.',
  },
  {
    id: 'sharp',
    name: 'SHARPSHOOTER',
    icon: '🎯',
    max: 2,
    desc: 'Enemy words are one tier shorter. Less ink, same arrow.',
  },
  {
    id: 'heart',
    name: '+1 HEART',
    icon: '❤️',
    max: 99,
    desc: 'One more chance to eat a club to the face. Cap of 5.',
    canOffer: (g) => g.hearts < C.MAX_HEARTS,
  },
  {
    id: 'quickdraw',
    name: 'QUICKDRAW',
    icon: '⚡',
    max: 3,
    desc: 'Finish a word within 2s of the last one to loose a bonus volley. Stacks arrows.',
  },
  {
    id: 'secondwind',
    name: 'SECOND WIND',
    icon: '🕊️',
    max: 1,
    desc: 'The first typo each wave is forgiven — the paper airplane becomes a real arrow.',
  },
];

// Pick up to 3 distinct eligible boons.
export function rollUpgrades(game) {
  const pool = UPGRADES.filter(
    (u) => (game.up[u.id] || 0) < u.max && (!u.canOffer || u.canOffer(game)),
  );
  // shuffle (Fisher–Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
