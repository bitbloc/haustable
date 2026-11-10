/**
 * flappyArt.js
 * All Flappy Cat pixel art, authored at art-pixel resolution (1 art px = ART_SCALE screen px).
 * Pure canvas code with no Phaser dependency, so the art can be previewed on its own.
 *
 * Scene: morning on the Mekong at Nakhon Phanom. Cool teal sky and karst mountains
 * keep the warm orange cat and the green sataw pods as the highest-contrast shapes.
 */
import { Pix, INK, ditherGradient, hash01 } from './pixelArtKit';

export const ART_SCALE = 2;

const TAU = Math.PI * 2;

// One shared palette. Scenery uses the cool half, gameplay objects the warm/saturated half.
export const PAL = {
  sky: ['#3B7BA8', '#4F97B8', '#6FB3C2', '#97CDC8', '#C3E0C4', '#EEDFB0', '#F7CF9A'],
  sun: '#FFF6D6',
  sunHalo: '#FBE3A4',
  cloud: '#FFFDF0',
  cloudShade: '#CFE6DC',
  mtnFar: '#9CC6C4',
  mtnFarRim: '#B9DAD2',
  mtnMid: '#6FA6A8',
  mtnMidRim: '#8CBDB9',
  hill: '#47877B',
  hillRim: '#5FA08D',
  tree: '#1F4D47',
  treeRim: '#2F6B5A',
  chedi: '#F7EED8',
  chediShade: '#CDBF9E',
  chediEdge: '#A8956B',
  gold: '#E8B93C',
  goldDark: '#B5852A',
  water: ['#62B4C0', '#3E8FA8', '#2C6F8E'],
  waterGlint: '#D8F1E4',
  waterDark: '#235A78',
  wood: '#C9793F',
  woodLight: '#E6A15C',
  woodDark: '#8A4A2B',
  woodDeep: '#5B2E22',
  catO: '#F08A2E',
  catL: '#FBB45A',
  catC: '#FFE7BF',
  catD: '#C75B1E',
  pink: '#F29AA4',
  collar: '#BD4924',
  bell: '#F5D547',
  white: '#FFFDF5',
  wingShade: '#C9DDE2',
  podDark: '#2E7D3A',
  pod: '#4FAE46',
  podLight: '#8FD15A',
  podHi: '#C8EE7E',
  steelHi: '#F6FAFB',
  steel: '#B5C0CC',
  steelDark: '#7B8798',
  handle: '#A8623A',
  handleDark: '#6E3B26',
  danger: '#E24B3B'
};

// ---------------------------------------------------------------------------
// Cat (3 flap frames, 24x24 each, faces right)
// ---------------------------------------------------------------------------
const CAT_ROWS = [
  '...........O......O...',
  '..........OPO....OPO..',
  '..........OOOOOOOOOO..',
  '.........OOLLLOOOOOOO.',
  '.........OLLOOOOOOOOO.',
  '.........OOOEWOOOOEWO.',
  '.DD......OOOEEOOOOEEO.',
  'DOO......OOCCCCCPCCCC.',
  'OO.....OOOOOCCCCCCCC..',
  'OOO.OODOODOOORRRRRR...',
  '.OOOOOOOOOOOOOOOYOO...',
  '...OOOOOOOOOOCCCCCO...',
  '....OOOOOOOOCCCCCCO...',
  '....DOOOOOOOOCCCCD....',
  '.....DDDDDDDDDDDD.....',
  '......CC.CC..CC.CC....'
];

const CAT_PALETTE = {
  O: PAL.catO,
  L: PAL.catL,
  C: PAL.catC,
  D: PAL.catD,
  P: PAL.pink,
  R: PAL.collar,
  Y: PAL.bell,
  W: PAL.white,
  E: INK
};

const WING_PALETTE = { W: PAL.white, S: PAL.wingShade };
const WINGS = [
  { rows: ['.WW..', 'WWWW.', 'WWWWS', 'WWWSS', '.WSS.'], x: 5, y: 5 },
  { rows: ['WWWWWW.', 'WWWWWSS', '.SSSS..'], x: 3, y: 9 },
  { rows: ['.WWW.', 'WWWWS', 'WWWSS', '.WSS.', '..S..'], x: 5, y: 10 }
];

export const CAT_FRAME = 24;

function buildCatSheet() {
  const sheet = new Pix(CAT_FRAME * WINGS.length, CAT_FRAME);
  WINGS.forEach((wing, f) => {
    const frame = new Pix(CAT_FRAME, CAT_FRAME);
    frame.map(CAT_ROWS, CAT_PALETTE, 1, 4);
    frame.outline(INK);

    // Wing is its own outlined layer so it reads against the body
    const w = new Pix(wing.rows[0].length + 2, wing.rows.length + 2);
    w.map(wing.rows, WING_PALETTE, 1, 1);
    w.outline(INK);
    frame.blit(w, wing.x, wing.y);

    sheet.blit(frame, f * CAT_FRAME, 0);
  });
  return sheet;
}

// ---------------------------------------------------------------------------
// Sataw pod pillar (32x240). Row 0 is the gap end.
// ---------------------------------------------------------------------------
function buildPod() {
  const W = 32;
  const H = 240;
  const p = new Pix(W, H);
  const CAP_H = 11;
  const PERIOD = 24;

  // Body: flat twisted pod whose edges swell around each seed
  for (let y = CAP_H; y < H; y++) {
    const phase = (y - CAP_H) % PERIOD;
    const swell = Math.cos(((phase - PERIOD / 2) / PERIOD) * TAU);
    const half = 10 + Math.round(1.5 + 1.5 * swell);
    const left = 16 - half;
    const right = 15 + half;
    for (let x = left; x <= right; x++) {
      let c = PAL.pod;
      if (x === left) c = PAL.podHi;
      else if (x <= left + 2) c = PAL.podLight;
      else if (x >= right - 2) c = PAL.podDark;
      p.set(x, y, c);
    }
    // Crease between seeds
    if (phase === 0) {
      for (let x = left + 4; x <= right - 4; x++) p.set(x, y, PAL.podDark);
    }
  }

  // Seeds: embossed ovals, lit from the upper left
  for (let cy = CAP_H + PERIOD / 2; cy < H; cy += PERIOD) {
    p.ellipse(15.5, cy + 0.5, 6.5, 8, PAL.podDark);
    p.ellipse(15, cy, 6, 7.5, PAL.podLight);
    p.ellipse(14, cy - 2, 2.5, 3, PAL.podHi);
    p.set(12, cy - 4, PAL.white);
    p.set(13, cy - 5, PAL.white);
  }

  // Cap: thick collar that marks the opening clearly
  for (let y = 1; y < CAP_H; y++) {
    const inset = y === 1 || y === CAP_H - 1 ? 1 : 0;
    for (let x = 1 + inset; x <= 30 - inset; x++) {
      let c = PAL.pod;
      if (y <= 2) c = PAL.podHi;
      else if (y === 3) c = PAL.podLight;
      else if (y >= CAP_H - 3) c = PAL.podDark;
      if (x <= 2 + inset && y > 2) c = PAL.podLight;
      if (x >= 28 - inset) c = PAL.podDark;
      p.set(x, y, c);
    }
  }
  // Shadow the cap casts on the pod
  for (let x = 4; x <= 27; x++) {
    if (p.has(x, CAP_H)) p.set(x, CAP_H, PAL.podDark);
  }

  p.outline(INK);
  return p;
}

// ---------------------------------------------------------------------------
// Background (256x350): sky, sun, clouds, karst ranges, chedi, treeline
// ---------------------------------------------------------------------------
const BG_W = 256;
const BG_H = 350;
const HORIZON = 270;

function paintCloud(p, cx, cy, lobes) {
  const cells = new Set();
  lobes.forEach(([dx, r]) => {
    for (let y = -r; y <= 0; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) cells.add(`${cx + dx + x},${cy + y}`);
      }
    }
  });
  const minX = Math.min(...lobes.map(([dx, r]) => dx - r));
  const maxX = Math.max(...lobes.map(([dx, r]) => dx + r));
  for (let x = minX + 1; x < maxX; x++) cells.add(`${cx + x},${cy + 1}`);

  cells.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    const nearBottom = !cells.has(`${x},${y + 1}`) || !cells.has(`${x},${y + 2}`);
    p.set(x, y, nearBottom ? PAL.cloudShade : PAL.cloud);
  });
}

function paintRidge(p, { base, amp, seed, color, rim, towers }) {
  for (let x = 0; x < BG_W; x++) {
    const a = (x / BG_W) * TAU;
    let h = 0.55 + 0.25 * Math.sin(a * 2 + seed) + 0.2 * Math.sin(a * 5 + seed * 2.3);
    if (towers) h += 0.5 * Math.pow(Math.max(0, Math.sin(a * towers + seed * 1.7)), 0.45);
    const top = base - Math.round(h * amp);
    for (let y = top; y < HORIZON; y++) p.set(x, y, y === top ? rim : color);
  }
}

function paintChedi(p, cx, baseY) {
  // Widths per row, top to bottom: gold finial, tapering body, three stepped tiers
  const rows = [];
  for (let i = 0; i < 8; i++) rows.push({ w: 1, c: PAL.gold });
  rows.push({ w: 3, c: PAL.gold }, { w: 5, c: PAL.goldDark }, { w: 1, c: PAL.gold }, { w: 1, c: PAL.gold }, { w: 3, c: PAL.gold });
  for (let i = 0; i < 34; i++) {
    const w = 3 + Math.round(9 * Math.pow(i / 33, 1.3));
    rows.push({ w: w % 2 ? w : w + 1, c: i % 9 === 4 ? PAL.gold : PAL.chedi, band: i % 9 === 4 });
  }
  [[15, 5], [19, 8], [23, 6], [27, 4]].forEach(([w, n]) => {
    for (let i = 0; i < n; i++) rows.push({ w, c: i === 0 ? PAL.gold : PAL.chedi, band: i === 0 });
  });

  const top = baseY - rows.length;
  rows.forEach((row, i) => {
    const y = top + i;
    const half = (row.w - 1) / 2;
    for (let dx = -half; dx <= half; dx++) {
      let c = row.c;
      if (c === PAL.chedi) {
        if (dx > half * 0.35) c = PAL.chediShade;
        if (row.w > 5 && (dx === -half || dx === half)) c = PAL.chediEdge;
      } else if (row.band && dx > half * 0.35) {
        c = PAL.goldDark;
      }
      p.set(cx + dx, y, c);
    }
  });
}

const PALM_CROWN = [
  '...XX...XX...',
  '.XXXXX.XXXXX.',
  'XX..XXXXX..XX',
  'X..XXXXXXX..X',
  '..XX.XXX.XX..',
  '.XX..XXX..XX.',
  '.X...XXX...X.'
];

function paintPalm(p, x, baseY, height, lean) {
  for (let i = 0; i < height; i++) {
    const tx = x + Math.round((i / height) * lean);
    p.set(tx, baseY - i, PAL.tree);
    p.set(tx + 1, baseY - i, PAL.tree);
  }
  p.map(PALM_CROWN, { X: PAL.tree }, x + lean - 6, baseY - height - 5);
  p.set(x + lean - 4, baseY - height - 4, PAL.treeRim);
  p.set(x + lean - 3, baseY - height - 4, PAL.treeRim);
}

function buildBackground() {
  const p = new Pix(BG_W, BG_H);
  p.wrapX = true;

  ditherGradient(p, 0, HORIZON, PAL.sky);

  // Sun with a dithered halo
  for (let y = 86; y <= 134; y++) {
    for (let x = 166; x <= 214; x++) {
      const d = Math.hypot(x - 190, y - 110);
      if (d <= 14) p.set(x, y, PAL.sun);
      else if (d <= 19 && ((x + y) & 1) === 0) p.set(x, y, PAL.sunHalo);
      else if (d <= 23 && (x & 1) === 0 && (y & 1) === 0) p.set(x, y, PAL.sunHalo);
    }
  }

  paintCloud(p, 34, 52, [[0, 7], [9, 10], [20, 7], [28, 5]]);
  paintCloud(p, 128, 38, [[0, 5], [7, 7], [15, 5]]);
  paintCloud(p, 226, 70, [[0, 6], [9, 9], [20, 8], [30, 5]]);
  paintCloud(p, 96, 150, [[0, 4], [6, 6], [13, 4]]);

  paintRidge(p, { base: 262, amp: 46, seed: 1.3, color: PAL.mtnFar, rim: PAL.mtnFarRim, towers: 6 });
  // Morning haze at the foot of the far range, behind everything nearer
  p.checker(0, 256, BG_W, 6, PAL.mtnFarRim);
  paintRidge(p, { base: 268, amp: 30, seed: 4.1, color: PAL.mtnMid, rim: PAL.mtnMidRim, towers: 9 });
  paintRidge(p, { base: 270, amp: 14, seed: 2.2, color: PAL.hill, rim: PAL.hillRim, towers: 0 });

  paintChedi(p, 78, HORIZON - 2);

  // Riverside treeline built from overlapping canopies
  const canopy = new Array(BG_W).fill(3);
  for (let i = 0; i < 46; i++) {
    const cx = Math.floor(hash01(i) * BG_W);
    const r = 3 + Math.floor(hash01(i + 90) * 5);
    for (let dx = -r; dx <= r; dx++) {
      const x = (((cx + dx) % BG_W) + BG_W) % BG_W;
      const h = 2 + Math.round(Math.sqrt(r * r - dx * dx));
      if (h > canopy[x]) canopy[x] = h;
    }
  }
  for (let x = 0; x < BG_W; x++) {
    const top = HORIZON - canopy[x];
    const rising = canopy[x] > canopy[(x + BG_W - 1) % BG_W];
    for (let y = top; y < HORIZON; y++) p.set(x, y, y === top && rising ? PAL.treeRim : PAL.tree);
  }

  paintPalm(p, 28, HORIZON - 3, 24, 4);
  paintPalm(p, 118, HORIZON - 3, 19, -3);
  paintPalm(p, 132, HORIZON - 3, 27, 5);
  paintPalm(p, 214, HORIZON - 3, 22, -4);

  // Below the horizon is hidden by the river and pier layers
  p.rect(0, HORIZON, BG_W, BG_H - HORIZON, PAL.water[1]);
  return p;
}

// ---------------------------------------------------------------------------
// River tile (64x48) and pier tile (32x32)
// ---------------------------------------------------------------------------
function buildRiver() {
  const W = 64;
  const H = 48;
  const p = new Pix(W, H);
  p.wrapX = true;
  ditherGradient(p, 0, H, PAL.water, 0.6);

  // Bank shadow and treeline reflection
  p.rect(0, 0, W, 1, PAL.tree);
  p.checker(0, 1, W, 2, PAL.waterDark);

  const ripples = [
    [4, 6, 9, 'g'], [30, 8, 14, 'd'], [50, 11, 8, 'g'],
    [14, 15, 12, 'd'], [40, 18, 10, 'g'], [2, 22, 7, 'd'],
    [22, 26, 15, 'g'], [52, 29, 9, 'd'], [8, 33, 11, 'g'],
    [34, 37, 13, 'd'], [58, 41, 10, 'g'], [16, 44, 9, 'd']
  ];
  ripples.forEach(([x, y, len, kind]) => {
    const color = kind === 'g' ? PAL.waterGlint : PAL.waterDark;
    for (let i = 0; i < len; i++) p.set(x + i, y, color);
    for (let i = 2; i < len - 3; i++) p.set(x + i, y + 1, kind === 'g' ? PAL.water[0] : PAL.waterDark);
  });
  return p;
}

function buildGround() {
  const W = 32;
  const H = 32;
  const p = new Pix(W, H);
  p.wrapX = true;

  p.rect(0, 0, W, 1, INK);
  p.rect(0, 1, W, 2, PAL.woodLight);
  p.rect(0, 3, W, 1, PAL.wood);
  p.rect(0, 4, W, 1, PAL.woodDeep);

  // Vertical boards, each 8 wide, darkening toward the waterline
  for (let x = 0; x < W; x++) {
    const col = x % 8;
    const board = Math.floor(x / 8);
    for (let y = 5; y < H; y++) {
      let c = PAL.wood;
      if (col === 0) c = PAL.woodLight;
      if (col === 7) c = PAL.woodDeep;
      if (col !== 7 && y > 25 && ((x + y) & 1) === 0) c = PAL.woodDark;
      if (col !== 7 && y > 29) c = PAL.woodDark;
      p.set(x, y, c);
    }
    // Wood grain and a nail per board
    if (col === 3) {
      const g = 9 + Math.floor(hash01(board + 5) * 8);
      p.rect(x, g, 1, 4, PAL.woodDark);
    }
    if (col === 5) {
      const g = 13 + Math.floor(hash01(board + 40) * 6);
      p.rect(x, g, 1, 3, PAL.woodDark);
    }
    if (col === 3) {
      p.set(x, 6, PAL.woodDeep);
      p.set(x + 1, 6, PAL.woodLight);
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// Small sprites
// ---------------------------------------------------------------------------
function buildKnife() {
  const p = new Pix(16, 16);
  p.map(
    [
      '..SSSSSSSS......',
      '.WWWWWWWWS......',
      '.WSSSSS.SSHHHHH.',
      '.SSSSSSSSSHHhhh.',
      '.SSSSSSSSD......',
      '.SDDDDDDDD......',
      '.WWWWWWWW.......'
    ],
    { W: PAL.steelHi, S: PAL.steel, D: PAL.steelDark, H: PAL.handle, h: PAL.handleDark },
    0,
    4
  );
  p.outline(INK);
  return p;
}

export function buildWarning() {
  const p = new Pix(20, 20);
  for (let y = 2; y <= 16; y++) {
    const half = Math.floor((y - 2) / 2) + 1;
    for (let x = 10 - half; x < 10 + half; x++) p.set(x, y, y >= 15 ? PAL.goldDark : PAL.bell);
  }
  p.outline(INK);
  p.rect(9, 6, 2, 6, INK);
  p.rect(9, 13, 2, 2, INK);
  return p;
}

function buildBean() {
  const p = new Pix(12, 12);
  p.map(
    [
      '..LLLLLL..',
      '.LHHLLLLL.',
      'LHHLLLLLLG',
      'LHLLLLLLGG',
      'LLLLLLLGGG',
      'LLLGGGGGGD',
      '.LGG..GGD.',
      '..G....D..'
    ],
    { L: PAL.podHi, H: PAL.white, G: PAL.podLight, D: PAL.pod },
    1,
    2
  );
  p.outline(INK);
  return p;
}

/**
 * Build every Flappy Cat texture as an art-resolution pixel buffer.
 * Keys match the Phaser texture keys used by the scenes.
 */
export function buildFlappyArt() {
  return {
    cat_sheet: buildCatSheet(),
    satow_pod: buildPod(),
    bg_wall: buildBackground(),
    bg_river: buildRiver(),
    bg_ground: buildGround(),
    kitchen_knife: buildKnife(),
    warning_icon: buildWarning(),
    satow_bean: buildBean()
  };
}
