// Procedural 16x16 pixel-art tileset + sprite sheets, drawn once at load
// onto offscreen canvases. No image files anywhere.
import { PAL } from './config.js';

const T = 16;

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// tiny deterministic hash for texture detail (visual only, never in the sim)
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- tiles

function drawFloor(g, variant) {
  g.fillStyle = variant ? PAL.floorA : PAL.floorB;
  g.fillRect(0, 0, T, T);
  // tile grout
  g.fillStyle = PAL.floorLine;
  g.fillRect(0, 0, T, 1);
  g.fillRect(0, 0, 1, T);
  // sheen corner
  g.fillStyle = variant ? '#1b2340' : '#161e33';
  g.fillRect(2, 2, 3, 1);
  g.fillRect(2, 2, 1, 3);
}

function drawWall(g) {
  // top face (lit) over front face, museum panel style
  g.fillStyle = PAL.wallFace;
  g.fillRect(0, 0, T, T);
  g.fillStyle = PAL.wallTop;
  g.fillRect(0, 0, T, 5);
  g.fillStyle = PAL.wallEdge;
  g.fillRect(0, 0, T, 1);
  // panel seams
  g.fillStyle = PAL.wallDark;
  g.fillRect(0, 5, T, 1);
  g.fillRect(0, 11, T, 1);
  g.fillRect(4, 6, 1, 5);
  g.fillRect(11, 12, 1, 4);
  g.fillRect(0, 15, T, 1);
  // subtle brick shading
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(1, 6, 3, 1);
  g.fillRect(12, 6, 3, 1);
  g.fillRect(5, 12, 4, 1);
}

function drawGlass(g) {
  drawFloor(g, 0);
  // display case: dark base, glass box with shine, trinket inside
  g.fillStyle = '#0d1322';
  g.fillRect(1, 12, 14, 3);
  g.fillStyle = PAL.glassDim;
  g.fillRect(2, 2, 12, 11);
  g.fillStyle = 'rgba(127,216,232,0.35)';
  g.fillRect(3, 3, 10, 9);
  // trinket
  g.fillStyle = PAL.gold;
  g.fillRect(7, 7, 2, 3);
  g.fillRect(6, 9, 4, 1);
  // shine
  g.fillStyle = PAL.glass;
  g.fillRect(3, 3, 1, 6);
  g.fillRect(4, 3, 2, 1);
  g.fillStyle = '#eafcff';
  g.fillRect(3, 3, 1, 2);
}

function drawPedestal(g, variant) {
  drawFloor(g, variant);
  g.fillStyle = '#0d1322';
  g.fillRect(3, 11, 10, 3);
  g.fillStyle = PAL.steelDark;
  g.fillRect(4, 9, 8, 3);
  g.fillStyle = PAL.steel;
  g.fillRect(4, 9, 8, 1);
}

function drawPlate(g, down, variant) {
  drawFloor(g, variant);
  g.fillStyle = '#0b101e';
  g.fillRect(3, 3, 10, 10);
  g.fillStyle = down ? '#2b3856' : PAL.steelDark;
  g.fillRect(4, 4, 8, 8);
  g.fillStyle = down ? '#3e548c' : PAL.steel;
  g.fillRect(5, 5, 6, 6);
  if (!down) {
    g.fillStyle = '#c4cede';
    g.fillRect(5, 5, 6, 1);
    g.fillRect(5, 5, 1, 6);
  }
  // little arrows
  g.fillStyle = down ? '#7fd8e8' : '#141b2e';
  g.fillRect(7, 7, 2, 2);
}

function drawSwitch(g, on, variant) {
  drawFloor(g, variant);
  // wall-style pedestal with a lever
  g.fillStyle = '#0b101e';
  g.fillRect(4, 6, 8, 8);
  g.fillStyle = PAL.steelDark;
  g.fillRect(5, 7, 6, 6);
  g.fillStyle = on ? PAL.exit : PAL.laser;
  g.fillRect(on ? 9 : 5, 4, 2, 4);
  g.fillStyle = on ? '#b8ffd6' : '#ffc4cd';
  g.fillRect(on ? 9 : 5, 4, 2, 1);
  // status LED
  g.fillStyle = on ? PAL.exit : '#5a2230';
  g.fillRect(7, 9, 2, 2);
}

function drawExit(g) {
  // dark doorway with green EXIT sign (tiny 3x5 letters)
  g.fillStyle = '#050a12';
  g.fillRect(0, 0, T, T);
  g.fillStyle = PAL.exitDark;
  g.fillRect(0, 0, T, 2);
  g.fillRect(0, 0, 2, T);
  g.fillRect(14, 0, 2, T);
  g.fillStyle = '#0a2c1c';
  g.fillRect(2, 2, 12, 12);
  g.fillStyle = '#03140b';
  g.fillRect(3, 3, 10, 11);
  // EXIT letters, 3px tall, drawn as chunky pixels
  g.fillStyle = PAL.exit;
  // E
  g.fillRect(3, 6, 2, 1); g.fillRect(3, 7, 1, 1); g.fillRect(3, 8, 2, 1);
  // X
  g.fillRect(6, 6, 1, 1); g.fillRect(8, 6, 1, 1); g.fillRect(7, 7, 1, 1);
  g.fillRect(6, 8, 1, 1); g.fillRect(8, 8, 1, 1);
  // I
  g.fillRect(10, 6, 1, 3);
  // T
  g.fillRect(12, 6, 3, 1); g.fillRect(13, 7, 1, 2);
  // floor arrows
  g.fillStyle = '#0f5c36';
  g.fillRect(6, 11, 4, 1);
  g.fillRect(7, 12, 2, 1);
}

// ---------------------------------------------------------------- sprites

// The burglar: striped shirt, beanie, eye mask. 4 directions x 3 frames.
// dir: 0 down, 1 up, 2 left, 3 right. frame: 0 idle, 1/2 walk.
function drawBurglar(g, ox, oy, dir, frame) {
  const px = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(ox + x, oy + y, w, h);
  };
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // shadow
  px(4, 14, 8, 2, 'rgba(0,0,0,0.35)');

  // legs (rows 12-14)
  const legC = '#1a2030';
  if (dir === 2 || dir === 3) {
    px(6 + step, 12, 2, 3, legC);
    px(8 - step, 12, 2, 3, legC);
  } else {
    px(5, 12, 2, 3 + (step === 1 ? -1 : 0), legC);
    px(9, 12, 2, 3 + (step === -1 ? -1 : 0), legC);
  }
  // shoes
  px(5, 14, 2, 1, '#0c0f18');
  px(9, 14, 2, 1, '#0c0f18');

  // body: striped shirt rows 8-11
  for (let r = 0; r < 4; r++) {
    px(4, 8 + r, 8, 1, r % 2 ? PAL.stripeB : PAL.stripeA);
  }
  // arms swing
  const armC = PAL.stripeB;
  if (dir === 2) px(3, 9 + step, 2, 3, armC);
  else if (dir === 3) px(11, 9 - step, 2, 3, armC);
  else {
    px(3, 9 + step, 1, 3, armC);
    px(12, 9 - step, 1, 3, armC);
  }
  // loot sack hint on back when walking up
  if (dir === 1) px(6, 8, 4, 3, '#54432c');

  // head rows 2-7
  px(5, 4, 6, 4, PAL.skin); // face block
  // beanie
  px(4, 2, 8, 2, PAL.beanie);
  px(4, 4, 8, 1, '#6d222b');
  px(6, 1, 4, 1, PAL.beanie);
  // eye mask + eyes
  if (dir === 0) {
    px(4, 5, 8, 2, '#11141f');
    px(6, 5, 1, 1, '#ffffff');
    px(9, 5, 1, 1, '#ffffff');
  } else if (dir === 2) {
    px(4, 5, 6, 2, '#11141f');
    px(5, 5, 1, 1, '#ffffff');
  } else if (dir === 3) {
    px(6, 5, 6, 2, '#11141f');
    px(10, 5, 1, 1, '#ffffff');
  } else {
    px(4, 5, 8, 2, '#11141f'); // strap on the back of the head
  }
  // chin
  px(6, 7, 4, 1, PAL.skin);
}

// The guard: navy coat, cap, flashlight arm.
function drawGuard(g, ox, oy, dir, frame) {
  const px = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(ox + x, oy + y, w, h);
  };
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  px(4, 14, 8, 2, 'rgba(0,0,0,0.35)');

  const legC = '#1c2438';
  if (dir === 2 || dir === 3) {
    px(6 + step, 12, 2, 3, legC);
    px(8 - step, 12, 2, 3, legC);
  } else {
    px(5, 12, 2, 3 + (step === 1 ? -1 : 0), legC);
    px(9, 12, 2, 3 + (step === -1 ? -1 : 0), legC);
  }

  // coat
  px(4, 7, 8, 5, PAL.guardCoat);
  px(4, 7, 8, 1, '#3f63b4');
  // belt + badge
  px(4, 10, 8, 1, '#141a2c');
  px(5, 8, 1, 1, PAL.guardTrim);
  // arms + flashlight
  const armC = '#243d70';
  if (dir === 2) { px(3, 8 + step, 2, 3, armC); px(2, 8 + step, 1, 1, '#ffe9a3'); }
  else if (dir === 3) { px(11, 8 - step, 2, 3, armC); px(13, 8 - step, 1, 1, '#ffe9a3'); }
  else {
    px(3, 8 + step, 1, 3, armC);
    px(12, 8 - step, 1, 3, armC);
    if (dir === 0) px(12, 11 - step, 1, 1, '#ffe9a3');
  }

  // head + cap
  px(5, 3, 6, 4, PAL.skin);
  px(4, 1, 8, 2, '#1b2c55');
  px(4, 3, 8, 1, '#13203f');
  if (dir === 0) px(4, 3, 8, 1, '#0e1830'); // brim
  // eyes
  if (dir === 0) { px(6, 4, 1, 1, '#101423'); px(9, 4, 1, 1, '#101423'); }
  else if (dir === 2) px(5, 4, 1, 1, '#101423');
  else if (dir === 3) px(10, 4, 1, 1, '#101423');
  // cap badge
  px(7, 1, 2, 1, PAL.guardTrim);
}

// Gems: diamond cut, 3 palettes.
function drawGem(g, ox, oy, kind) {
  const cols = [
    [PAL.gold, PAL.goldHi, '#a3671c'],
    [PAL.cyanGem, '#e8fdff', '#1f7f96'],
    [PAL.magentaGem, '#ffe0f6', '#98337f'],
  ][kind % 3];
  const px = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(ox + x, oy + y, w, h);
  };
  px(5, 4, 6, 2, cols[0]);
  px(4, 6, 8, 2, cols[0]);
  px(5, 8, 6, 1, cols[2]);
  px(6, 9, 4, 1, cols[2]);
  px(7, 10, 2, 1, cols[2]);
  // table shine
  px(5, 4, 3, 1, cols[1]);
  px(5, 5, 1, 2, cols[1]);
  // facet line
  px(8, 6, 1, 4, cols[2]);
}

// ---------------------------------------------------------------- build

export function buildTileset() {
  const tiles = {};
  const single = (fn, ...args) => {
    const [c, g] = mk(T, T);
    fn(g, ...args);
    return c;
  };

  tiles.floor0 = single(drawFloor, 0);
  tiles.floor1 = single(drawFloor, 1);
  tiles.wall = single(drawWall);
  tiles.glass = single(drawGlass);
  tiles.pedestal0 = single(drawPedestal, 0);
  tiles.pedestal1 = single(drawPedestal, 1);
  tiles.plateUp0 = single(drawPlate, false, 0);
  tiles.plateUp1 = single(drawPlate, false, 1);
  tiles.plateDown0 = single(drawPlate, true, 0);
  tiles.plateDown1 = single(drawPlate, true, 1);
  tiles.switchOff0 = single(drawSwitch, false, 0);
  tiles.switchOff1 = single(drawSwitch, false, 1);
  tiles.switchOn0 = single(drawSwitch, true, 0);
  tiles.switchOn1 = single(drawSwitch, true, 1);
  tiles.exit = single(drawExit);

  // burglar sheet: 4 dirs (rows) x 3 frames (cols)
  const [playerSheet, pg] = mk(T * 3, T * 4);
  for (let d = 0; d < 4; d++)
    for (let f = 0; f < 3; f++) drawBurglar(pg, f * T, d * T, d, f);

  // ghost sheet: same silhouette, re-tinted cyan via pixel pass
  const [ghostSheet, gg] = mk(T * 3, T * 4);
  gg.drawImage(playerSheet, 0, 0);
  const img = gg.getImageData(0, 0, T * 3, T * 4);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = (d[i] * 0.3 + d[i + 1] * 0.6 + d[i + 2] * 0.1) / 255;
    d[i] = 40 + 120 * lum;
    d[i + 1] = 150 + 105 * lum;
    d[i + 2] = 200 + 55 * lum;
    d[i + 3] = Math.min(d[i + 3], 235);
  }
  gg.putImageData(img, 0, 0);

  // guard sheet
  const [guardSheet, gd] = mk(T * 3, T * 4);
  for (let dd = 0; dd < 4; dd++)
    for (let f = 0; f < 3; f++) drawGuard(gd, f * T, dd * T, dd, f);

  // gem sprites
  const gems = [];
  for (let k = 0; k < 3; k++) {
    const [c, g] = mk(T, T);
    drawGem(g, 0, 0, k);
    gems.push(c);
  }

  return { tiles, playerSheet, ghostSheet, guardSheet, gems, hash };
}
