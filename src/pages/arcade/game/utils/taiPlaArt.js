/**
 * taiPlaArt.js
 * All Tai-Pla Run pixel art at art-pixel resolution (1 art px = ART_SCALE canvas px).
 * Pure canvas code: no React, no game state.
 *
 * Conventions (shared with flappyArt.js):
 * - Characters, enemies and pickups get a 1px ink outline.
 * - Scenery gets a softer navy contour so it sits behind gameplay objects.
 * - Light comes from the upper left.
 */
import { Pix, INK, ditherGradient, hash01 } from './pixelArtKit';
import { PAL } from './flappyArt';

export const ART_SCALE = 2;
export const CHAR_FRAME = 24;
const CONTOUR = '#2B3A4A';
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Characters: 6 frames each (run 0-3, jump 4, spare 5)
// ---------------------------------------------------------------------------
const POSES = [
  { bob: 0, legs: [[6, -1, 3, 0], [10, 1, 3, 1], [12, -1, 3, 1], [16, 1, 3, 0]] },
  { bob: -1, legs: [[7, 0, 2, 0], [9, 0, 2, 1], [13, 0, 2, 1], [15, 0, 2, 0]] },
  { bob: 0, legs: [[9, 1, 3, 0], [8, 0, 3, 1], [13, 0, 3, 1], [15, -1, 3, 0]] },
  { bob: -1, legs: [[7, 0, 4, 0], [9, 0, 4, 1], [13, 0, 4, 1], [15, 0, 4, 0]] },
  { bob: 0, legs: [[6, -1, 2, 0], [8, -1, 2, 1], [13, 1, 2, 1], [16, 1, 2, 0]] },
  { bob: 0, legs: [[6, -1, 2, 0], [8, -1, 2, 1], [13, 1, 2, 1], [16, 1, 2, 0]] }
];

const CHARACTERS = {
  // Cream cat-fish creature: fin ears, indigo and terracotta patches, gem-tipped fishtail
  tai_pla: {
    rows: [
      '..........B.......B...',
      '.........BbB.....BbB..',
      '.........BbCCCCCCCbB..',
      '.........CCIICCCCIICC.',
      '.bB......CCICCCCCCICC.',
      'bBB......CCCEWCCCCEWC.',
      'BBG......CCCEECCCCEEC.',
      '.BB......CPCCCCCBCCPC.',
      '.CC....IICCCCCCCCCCC..',
      '.CCC.IIIITTCCCCCCCC...',
      '..CCCIIITTTCCCCCCCC...',
      '...CCCCCCCCCCCCCCCC...',
      '....CCCCCCCCCCCCCCC...',
      '....DCCCCCCCCCCCCD....',
      '.....DDDDDDDDDDDD.....'
    ],
    pal: {
      C: '#FBF3E4', D: '#D9CDB8', I: '#2B4C9B', B: '#3FA7D6', b: '#8AD3EE',
      T: '#E0672F', G: PAL.danger, P: PAL.pink, E: INK, W: PAL.white
    },
    leg: '#FBF3E4', legFar: '#D9CDB8', paw: '#3FA7D6'
  },
  // Orange beast with sataw-pod horns and a flame tail
  som_satow: {
    rows: [
      '.........Gg.......gG..',
      '.........GGg.....gGG..',
      '..........GOOOOOOOG...',
      '.Y.......OOLLLOOOOOOO.',
      'YRY......OLLOOOOOOOOO.',
      'RRY......OOEEOOOOOEEO.',
      'RR.......OOOEWOOOOEWO.',
      'OO.......OOCCCCCKCCCC.',
      'OO.....OOOOOCCWCCWCC..',
      'OOO.OODOODOOOOOOOOO...',
      '.OOOOOODOODOOOOOOOO...',
      '...OOOOOOOOOOCCCCCO...',
      '....OOOOOOOOCCCCCCO...',
      '....DOOOOOOOOCCCCD....',
      '.....DDDDDDDDDDDD.....'
    ],
    pal: {
      O: PAL.catO, L: PAL.catL, C: PAL.catC, D: PAL.catD, G: PAL.pod, g: PAL.podHi,
      Y: PAL.bell, R: PAL.danger, K: '#5B2E22', E: INK, W: PAL.white
    },
    leg: PAL.catO, legFar: PAL.catD, paw: PAL.catC
  },
  // Tan puppy with floppy ears, bamboo collar and brass bell
  khao_lam: {
    rows: [
      '......................',
      '...........TTTTTTT....',
      '.........BBTTttTTTTB..',
      '........BBBTttTTTTTBB.',
      '........BBBTTTTTTTTBB.',
      '.T......BBBTEWTTTTEWB.',
      'TT.......BBTEETTTTEET.',
      'TT........TCCCCCECCCCC',
      'TT.....TTTTTCCCCCCCCC.',
      '.TT.TTBTTTTTTGGGGGG...',
      '.TTTTTBBTTTTTTTTYTT...',
      '...TTTTTTTTTTCCCCCT...',
      '....TTTTTTTTCCCCCCT...',
      '....DTTTTTTTTCCCCD....',
      '.....DDDDDDDDDDDD.....'
    ],
    pal: {
      T: '#D9A066', t: '#EEC39A', B: '#8A5A3C', C: '#FBF3E4', D: '#B07A48',
      G: PAL.pod, Y: PAL.bell, E: INK, W: PAL.white
    },
    leg: '#D9A066', legFar: '#B07A48', paw: '#FBF3E4'
  },
  // Tuxedo cat in a terracotta beret and linen apron
  barista_cat: {
    rows: [
      '...........RRRRRRr....',
      '..........RRRrrRRRRR..',
      '.........KRRRRRRRRRK..',
      '.........KKkkkKKKKKKK.',
      '.W.......KkkKKKKKKKKK.',
      'KK.......KKKYEKKKKYEK.',
      'KK.......KKKYYKKKKYYK.',
      'KK.......KKWWWWWPWWWW.',
      '.KK....KKKKKWWWWWWWW..',
      '.KKK.KKKKKKKKAAAAAA...',
      '..KKKKKKKKKKKKWWAWW...',
      '...KKKKKKKAAAAWWWWK...',
      '....KKKKKKAAAAWWWWK...',
      '....dKKKKKAAAAWWWd....',
      '.....dddddddddddd.....'
    ],
    pal: {
      K: '#3A3442', k: '#5A5266', d: '#26212E', W: PAL.white, A: '#EFE3C8',
      R: PAL.collar, r: '#E0672F', Y: PAL.podHi, P: PAL.pink, E: INK
    },
    leg: '#3A3442', legFar: '#26212E', paw: PAL.white
  },
  // Young naga riding a cloud: no legs, bobs instead of running
  baby_naga: {
    legless: true,
    rows: [
      '.............Y..Y.....',
      '............YyYYyY....',
      '...........GGGGGGGG...',
      '..........GGggGGGGGG..',
      '..........GggGGGGGGGG.',
      '..........GGGEWGGGEWG.',
      '..........GGGEEGGGEEG.',
      '..........GCCCCCCCCCC.',
      '...........GCCCCCCCC..',
      '..YG........GGGCC.....',
      '.dGG.......GGGGC......',
      'dGG....GGGGGGGGC......',
      'dGg...GGggGGGGCC......',
      '.GGGGGGGgGGGCCC.......',
      '..GGGGGGGGCCCC........',
      '..WWWWWWWWWWWWWW......',
      '.WWWWWWWWWWWWWWWW.....',
      '..SSWWSSSSWWSSSS......'
    ],
    pal: {
      G: '#3DAA6D', g: '#7FD49A', d: '#2A7A52', Y: PAL.bell, y: PAL.goldDark,
      C: '#EFE9B8', W: PAL.white, S: PAL.wingShade, E: INK
    }
  }
};

function paintLegs(frame, pose, def) {
  const y0 = 18 + pose.bob;
  pose.legs.forEach(([x, lean, len, far]) => {
    for (let i = 0; i < len; i++) {
      const lx = x + lean * Math.floor((i + 1) / 2);
      const isPaw = i === len - 1 && y0 + i >= 20;
      const c = isPaw ? def.paw : far ? def.legFar : def.leg;
      frame.set(lx, y0 + i, c);
      frame.set(lx + 1, y0 + i, c);
    }
  });
}

function buildCharacter(def) {
  const sheet = new Pix(CHAR_FRAME * POSES.length, CHAR_FRAME);
  const nagaBob = [0, -1, 0, 1, -1, -1];
  POSES.forEach((pose, f) => {
    const frame = new Pix(CHAR_FRAME, CHAR_FRAME);
    if (def.legless) {
      frame.map(def.rows, def.pal, 1, 2 + nagaBob[f]);
    } else {
      paintLegs(frame, pose, def);
      frame.map(def.rows, def.pal, 1, 3 + pose.bob);
    }
    frame.outline(INK);
    sheet.blit(frame, f * CHAR_FRAME, 0);
  });
  return sheet;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
const RED = { R: PAL.danger, r: '#F58A6B', d: '#A8302B', G: PAL.pod, g: PAL.podHi, W: PAL.white, E: INK, K: '#5B1F24' };

function buildHopChili() {
  const rows = [
    '......GG....',
    '.....GGg....',
    '....GGGGGG..',
    '...RRGGGGRR.',
    '..RRrRRRRRRR',
    '..RrrRRRRRRR',
    '.RREERRRREER',
    '.RRWERRRRWER',
    '.RRRRRRRRRRR',
    '.RRRWKWKWRRd',
    '..RRRRRRRRdd',
    '..RRRRRRRRdd',
    '...RRRRRRdd.',
    '....RRRRdd..',
    '.....RRdd...'
  ];
  const feet = [
    ['....KK.KK...'],
    ['...KK...KK..'],
    ['....KK.KK...'],
    ['..KK.....KK.']
  ];
  const lift = [0, -1, 0, 1];
  const sheet = new Pix(18 * 4, 19);
  for (let f = 0; f < 4; f++) {
    const frame = new Pix(18, 19);
    frame.map(rows, RED, 3, 2 + lift[f]);
    frame.map(feet[f], RED, 3, 17);
    frame.outline(INK);
    sheet.blit(frame, f * 18, 0);
  }
  return sheet;
}

function buildFlyingChili() {
  const body = [
    '..RRRRRRR....',
    '.RrrRRRRRRGG.',
    'RWERRRRRRRGGg',
    'REERRRRRRRRGG',
    'RRRRRRRRRdG..',
    '.KWKWRRRdd...',
    '..RRRRddd....'
  ];
  const wingPal = { M: '#8E2A3A', m: '#C24B55' };
  const wingUp = ['...MMM.', '..MMmM.', '.MMmMM.', '.MmMM..'];
  const wingMid = ['MMMMMM', '.mMMM.'];
  const wingDown = ['.MmMM..', '.MMmMM.', '..MMmM.', '...MMM.'];
  const wings = [
    [wingUp, 6, 2],
    [wingMid, 7, 4],
    [wingDown, 6, 12],
    [wingMid, 7, 4]
  ];
  const sheet = new Pix(19 * 4, 19);
  wings.forEach(([wing, wx, wy], f) => {
    const frame = new Pix(19, 19);
    frame.map(wing, wingPal, wx, wy);
    frame.map(body, RED, 3, 6);
    frame.outline(INK);
    sheet.blit(frame, f * 19, 0);
  });
  return sheet;
}

function buildPotGhost() {
  const pal = { T: '#C9653B', t: '#E89A6B', D: '#8E3F26', K: '#3A1A1A', W: PAL.white, w: '#E8F0F0' };
  const pot = [
    '..TTTTTTTT..',
    '.TttTTTTTTT.',
    '..TTTTTTTT..',
    '.TTtTTTTTTD.',
    'TTttTTTTTTDD',
    'TTtKKTTKKTDD',
    'TTTKWTTKWTDD',
    'TTTTTTTTTTDD',
    'TTTKKKKKKTDD',
    '.TTTKWWKTDD.',
    '.TTTTTTTTDD.',
    '..TTTTTTDD..'
  ];
  const wisps = [
    ['....ww......', '...w..w.....'],
    ['......ww....', '.....w..w...']
  ];
  const sheet = new Pix(16 * 2, 17);
  wisps.forEach((wisp, f) => {
    const frame = new Pix(16, 17);
    frame.map(pot, pal, 2, 4 - f);
    frame.outline(INK);
    frame.map(wisp, pal, 2, 1 - f + 1);
    sheet.blit(frame, f * 16, 0);
  });
  return sheet;
}

function buildHotRunner() {
  const pal = {
    Y: PAL.bell, O: PAL.catO, R: PAL.danger, S: '#F2B98A', W: PAL.white, w: PAL.wingShade,
    N: '#3A4A6B', K: '#2A2630', B: PAL.collar, E: INK
  };
  const top = [
    '.....Y..Y.....',
    '....YOYYOY....',
    '...YOORROOY...',
    '...ORRRRRRO...',
    '...SSSSSSSS...',
    '..SEESSSSEES..',
    '..SWESSSSWES..',
    '..SSSSKKSSSS..',
    '...SSSSSSSS...',
    '..WWWWWWWWWW..',
    '.WWWwWWWWwWWW.',
    '.SWWWWBWWWWWS.',
    '..WWWWBWWWWW..',
    '..WWWWWWWWWW..'
  ];
  const legs = [
    ['...NNN..NNN...', '..NN......NN..', '.KKK......KKK.'],
    ['....NNNNNN....', '.....NNNN.....', '....KKKKKK....']
  ];
  const sheet = new Pix(18 * 2, 20);
  legs.forEach((leg, f) => {
    const frame = new Pix(18, 20);
    frame.map(top, pal, 2, 1 + f);
    frame.map(leg, pal, 2, 15 + f);
    frame.outline(INK);
    sheet.blit(frame, f * 18, 0);
  });
  return sheet;
}

// Spiked coconut, 4 frames rotated in 90 degree steps
function buildCoconut() {
  const base = new Pix(14, 14);
  base.disc(6.5, 6.5, 4.6, '#7A4A2B');
  base.disc(5, 5, 2.2, '#A8623A');
  base.set(4, 4, '#C98A5A');
  base.set(8, 6, '#3A1A1A');
  base.set(6, 8, '#3A1A1A');
  base.set(9, 9, '#3A1A1A');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    base.set(6.5 + Math.cos(a) * 5.6, 6.5 + Math.sin(a) * 5.6, '#E6D2A8');
  }
  base.outline(INK);
  const sheet = new Pix(14 * 4, 14);
  let frame = base;
  for (let f = 0; f < 4; f++) {
    sheet.blit(frame, f * 14, 0);
    frame = frame.rot90();
  }
  return sheet;
}

function paintMortar(p, cx, top, { w, h, body, light, dark, speck }) {
  for (let i = 0; i < h; i++) {
    const t = i / (h - 1);
    let half = Math.round((w / 2) * (1 - 0.34 * t));
    if (i < 3) half = Math.round(w / 2);
    if (i >= h - 3) half = Math.round(w * 0.36);
    for (let dx = -half; dx < half; dx++) {
      let c = body;
      if (dx < -half + 3) c = light;
      if (dx >= half - 4) c = dark;
      if (i < 2) c = light;
      if (i === 2 || i === h - 4) c = dark;
      p.set(cx + dx, top + i, c);
    }
  }
  for (let i = 0; i < 14; i++) {
    const sx = cx - w / 2 + 3 + Math.floor(hash01(i + w) * (w - 8));
    const sy = top + 4 + Math.floor(hash01(i * 3 + 7) * (h - 9));
    if (p.has(sx, sy)) p.set(sx, sy, speck);
  }
}

function buildGiantMortar() {
  const p = new Pix(26, 26);
  // Pestle leaning out of the bowl
  for (let i = 0; i < 9; i++) {
    p.rect(15 + Math.round(i * 0.5), 1 + i, 3, 1, i < 2 ? '#D8DCE4' : '#B5BAC6');
  }
  paintMortar(p, 13, 8, { w: 24, h: 17, body: '#8A8F9C', light: '#B5BAC6', dark: '#5C6170', speck: '#6E7382' });
  p.outline(INK);
  return p;
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
function buildFish() {
  const p = new Pix(16, 16);
  p.map(
    [
      '....BBBBB.....',
      '..BBbbbBBBB..T',
      '.BWEbBBBBBBBTT',
      'BSSSSSSBBBBTT.',
      '.SSSSSSSSSBTT.',
      '..SSSSSSSS..TT',
      '....SSSS.....T'
    ],
    { B: '#3B7BA8', b: '#6FB3C2', S: '#E3EEF2', T: '#2C6F8E', W: PAL.white, E: INK },
    1,
    4
  );
  p.outline(INK);
  return p;
}

function buildSatawItem() {
  const p = new Pix(16, 16);
  p.map(
    [
      '..........GG..',
      '.........GK...',
      '..GGG...GG....',
      '.GgLGGGGG.....',
      'GgLLGGLLGG....',
      'GLLGGLLLGGG...',
      'GGGGGLLGGLGG..',
      '.KGGGGGGLLLG..',
      '...KGGGGLLGG..',
      '.....KKGGGG...'
    ],
    { G: PAL.pod, g: PAL.podHi, L: PAL.podLight, K: PAL.podDark },
    1,
    3
  );
  p.outline(INK);
  return p;
}

function buildBamboo() {
  const p = new Pix(16, 16);
  p.map(
    [
      '.....YY.....',
      '....YyYY....',
      '....YyYB....',
      '...YYyYYB...',
      '...YyYYBB...',
      '..BYyYYYBB..',
      '..BYYyYBYB..',
      '.BBYYyYBYBB.',
      '.BYYYYYYBYB.',
      '.BYYYYYYYBB.',
      '..BBBBBBBB..'
    ],
    { Y: '#F3E2A0', y: PAL.sun, B: PAL.handle },
    2,
    2
  );
  p.outline(INK);
  return p;
}

function buildGoldenMortar() {
  const p = new Pix(18, 18);
  for (let i = 0; i < 6; i++) p.rect(10 + Math.round(i * 0.5), 1 + i, 2, 1, PAL.sun);
  paintMortar(p, 9, 6, { w: 16, h: 11, body: PAL.gold, light: PAL.bell, dark: PAL.goldDark, speck: PAL.sun });
  p.outline(INK);
  p.set(3, 3, PAL.white);
  p.rect(2, 4, 3, 1, PAL.white);
  p.set(3, 5, PAL.white);
  return p;
}

// ---------------------------------------------------------------------------
// Stage elements and effects
// ---------------------------------------------------------------------------
function buildSpring() {
  const sheet = new Pix(18 * 2, 13);
  [0, 1].forEach((f) => {
    const frame = new Pix(18, 13);
    const plateY = f === 0 ? 2 : 6;
    frame.rect(1, plateY, 16, 1, PAL.podHi);
    frame.rect(1, plateY + 1, 16, 2, PAL.pod);
    frame.rect(13, plateY + 1, 4, 2, PAL.podDark);
    for (let y = plateY + 3; y < 10; y++) {
      const zig = (y - plateY) % 2 === 0;
      frame.rect(zig ? 4 : 6, y, 8, 1, zig ? PAL.steel : PAL.steelDark);
    }
    frame.rect(2, 10, 14, 2, '#3A4A5A');
    frame.rect(2, 10, 14, 1, '#5E7A8C');
    frame.outline(INK);
    sheet.blit(frame, f * 18, 0);
  });
  return sheet;
}

function buildSteamVent() {
  const p = new Pix(14, 9);
  p.rect(1, 2, 12, 6, '#3A4A5A');
  p.rect(1, 2, 12, 1, '#5E7A8C');
  p.rect(10, 3, 3, 5, '#2B3A4A');
  [3, 6, 9].forEach((x) => p.rect(x, 4, 1, 3, INK));
  p.outline(INK);
  return p;
}

function buildSteamPuff() {
  const p = new Pix(12, 12);
  p.disc(5.5, 6, 4.5, PAL.white);
  p.disc(7, 7.5, 3, PAL.wingShade);
  p.disc(4.5, 5, 2.5, PAL.white);
  return p;
}

function buildBolt() {
  // Tileable lightning segment, 12 wide by 16 tall
  const p = new Pix(12, 16);
  const xs = [5, 5, 4, 4, 3, 3, 4, 5, 6, 6, 7, 7, 6, 5, 5, 5];
  xs.forEach((x, y) => {
    p.rect(x - 1, y, 4, 1, PAL.bell);
    p.rect(x, y, 2, 1, PAL.white);
  });
  return p;
}

function buildRing(radius, color) {
  const size = radius * 2 + 4;
  const p = new Pix(size, size);
  const c = size / 2 - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (Math.abs(d - radius) < 0.7) p.set(x, y, color);
      else if (d < radius && d > radius - 3 && ((x + y) & 3) === 0) p.set(x, y, color);
    }
  }
  return p;
}

function buildSparkle() {
  const p = new Pix(5, 5);
  p.rect(2, 0, 1, 5, PAL.sun);
  p.rect(0, 2, 5, 1, PAL.sun);
  p.set(2, 2, PAL.white);
  return p;
}

// ---------------------------------------------------------------------------
// Landmarks of Nakhon Phanom
// ---------------------------------------------------------------------------
function buildCafe() {
  const p = new Pix(72, 56);
  p.rect(4, 22, 64, 34, '#F4E6C8');
  p.rect(56, 22, 12, 34, '#DCCBA6');
  for (let i = 0; i < 14; i++) {
    const left = Math.round(9 - i * 0.6);
    const right = Math.round(62 + i * 0.6);
    const c = i === 0 ? '#E0672F' : i % 3 === 2 ? '#93381C' : PAL.collar;
    p.rect(left, 8 + i, right - left + 1, 1, c);
  }
  p.rect(4, 22, 64, 1, PAL.chediEdge);
  // Signboard with the red house mark
  p.rect(24, 12, 24, 8, '#2B2A33');
  p.rect(26, 14, 4, 4, PAL.danger);
  p.rect(32, 14, 6, 1, '#F4E6C8');
  p.rect(32, 16, 10, 1, '#F4E6C8');
  p.rect(40, 14, 5, 1, '#F4E6C8');
  // Shuttered upper windows
  [9, 24, 39, 54].forEach((x) => {
    p.rect(x, 26, 9, 10, '#7A4A2B');
    for (let y = 27; y < 35; y++) p.rect(x + 1, y, 7, 1, y % 2 ? '#5E7A4B' : '#4B6540');
    p.rect(x + 4, 27, 1, 8, '#7A4A2B');
  });
  p.rect(4, 37, 64, 2, '#C9B48A');
  // Striped awning with a scalloped edge
  for (let x = 3; x < 69; x++) {
    const stripe = Math.floor((x - 3) / 4) % 2 === 0;
    p.rect(x, 39, 1, 5, stripe ? PAL.collar : '#F4E6C8');
    if ((x - 3) % 4 !== 3) p.set(x, 44, stripe ? '#93381C' : '#DCCBA6');
  }
  // Shopfront glass and door
  [[8, 19], [45, 19]].forEach(([x, w]) => {
    p.rect(x, 46, w, 9, '#7A4A2B');
    p.rect(x + 1, 47, w - 2, 7, PAL.sky[2]);
    for (let i = 0; i < 5; i++) p.set(x + 3 + i, 52 - i, PAL.sky[4]);
    p.rect(x + Math.floor(w / 2), 47, 1, 7, '#7A4A2B');
  });
  p.rect(31, 45, 10, 11, PAL.woodDark);
  p.rect(33, 47, 6, 4, PAL.sky[2]);
  p.set(39, 51, PAL.bell);
  p.outline(CONTOUR);
  return p;
}

function buildChurch() {
  const p = new Pix(56, 96);
  const wall = '#F3E3B0';
  const shade = '#D9C48C';
  const slate = '#5E7A8C';
  const slateLight = '#7FA0B0';
  [4, 36].forEach((x) => {
    p.rect(x, 30, 16, 66, wall);
    p.rect(x + 11, 30, 5, 66, shade);
    [30, 46, 62, 78].forEach((y) => p.rect(x, y, 16, 2, PAL.white));
    for (let i = 0; i < 26; i++) {
      const half = Math.max(1, Math.round(8 * (i / 25)));
      p.rect(x + 8 - half, 4 + i, half * 2, 1, slate);
      p.rect(x + 8 - half, 4 + i, Math.max(1, Math.floor(half / 2)), 1, slateLight);
    }
    p.rect(x + 7, 0, 2, 5, PAL.gold);
    p.rect(x + 6, 1, 4, 1, PAL.gold);
    [[36, 12], [56, 12], [82, 8]].forEach(([y, h]) => {
      p.rect(x + 6, y + 1, 4, h, '#3B5A78');
      p.rect(x + 7, y, 2, 1, '#3B5A78');
    });
  });
  // Nave with gable, rose window and arched door
  p.rect(20, 40, 16, 56, wall);
  for (let i = 0; i < 12; i++) {
    const half = Math.round(8 * (i / 11)) + 1;
    p.rect(28 - half, 28 + i, half * 2, 1, i === 11 ? PAL.white : slate);
  }
  p.rect(27, 22, 2, 7, PAL.gold);
  p.rect(25, 24, 6, 1, PAL.gold);
  p.disc(27.5, 52, 5.5, PAL.white);
  p.disc(27.5, 52, 4, PAL.sky[1]);
  p.rect(27, 48, 1, 9, PAL.white);
  p.rect(23, 52, 9, 1, PAL.white);
  p.rect(20, 66, 16, 2, PAL.white);
  p.disc(27.5, 80, 5, PAL.woodDark);
  p.rect(23, 80, 10, 16, PAL.woodDark);
  p.rect(27, 78, 1, 18, PAL.woodDeep);
  p.outline(CONTOUR);
  return p;
}

function buildClockTower() {
  const p = new Pix(28, 72);
  const wall = '#F2D5C0';
  const shade = '#D9B49C';
  p.rect(8, 22, 12, 50, wall);
  p.rect(16, 22, 4, 50, shade);
  p.rect(5, 62, 18, 10, wall);
  p.rect(18, 62, 5, 10, shade);
  p.rect(5, 62, 18, 1, PAL.white);
  [30, 42, 54].forEach((y) => p.rect(12, y, 3, 6, '#7A4A2B'));
  p.rect(6, 10, 16, 12, wall);
  p.rect(18, 10, 4, 12, shade);
  p.disc(13.5, 16, 4.2, PAL.white);
  p.rect(13, 13, 1, 4, INK);
  p.rect(14, 16, 2, 1, INK);
  p.rect(4, 6, 20, 4, PAL.collar);
  p.rect(4, 6, 20, 1, '#E0672F');
  p.rect(9, 3, 10, 3, PAL.collar);
  p.rect(13, 0, 2, 3, PAL.gold);
  p.outline(CONTOUR);
  return p;
}

function buildGovernorHouse() {
  const p = new Pix(76, 50);
  const wall = '#F0C75E';
  const shade = '#D4A843';
  p.rect(4, 20, 68, 30, wall);
  p.rect(60, 20, 12, 30, shade);
  for (let i = 0; i < 14; i++) {
    const left = Math.round(14 - i * 0.92);
    const right = Math.round(61 + i * 0.92);
    p.rect(left, 6 + i, right - left + 1, 1, i === 0 ? '#C96A44' : i % 3 === 2 ? '#863C22' : '#A8502F');
  }
  p.rect(4, 20, 68, 1, '#A8843A');
  p.rect(4, 34, 68, 2, PAL.white);
  for (let x = 9; x < 68; x += 9) {
    p.rect(x, 24, 5, 9, PAL.white);
    p.rect(x + 1, 25, 3, 8, '#4B7A5E');
    p.rect(x + 1, 24, 3, 1, PAL.white);
  }
  // Ground-floor arcade
  for (let x = 6; x < 70; x += 8) {
    p.rect(x, 38, 6, 12, '#6E4A2B');
    p.rect(x + 1, 37, 4, 1, '#6E4A2B');
    p.rect(x - 2, 36, 2, 14, PAL.white);
  }
  p.rect(70, 36, 2, 14, PAL.white);
  p.rect(32, 46, 12, 4, '#C9B48A');
  p.outline(CONTOUR);
  return p;
}

function buildNagaStatue() {
  const p = new Pix(44, 60);
  const gold = PAL.gold;
  const light = PAL.bell;
  const dark = PAL.goldDark;
  // Pedestal
  p.rect(8, 46, 28, 14, '#B5BAC6');
  p.rect(28, 46, 8, 14, '#8A8F9C');
  p.rect(6, 46, 32, 2, '#D8DCE4');
  p.rect(6, 57, 32, 3, '#8A8F9C');
  // Coils
  p.ellipse(22, 42, 14, 5, dark);
  p.ellipse(22, 41, 14, 4, gold);
  p.ellipse(22, 36, 11, 4, dark);
  p.ellipse(22, 35, 11, 3.4, gold);
  // Hood fan and neck
  p.ellipse(22, 20, 17, 13, dark);
  p.rect(19, 16, 7, 20, gold);
  p.rect(21, 18, 3, 18, light);
  // Seven heads fanning out from the centre
  [[0, 9, 4.2], [-7, 12, 3.4], [7, 12, 3.4], [-12, 17, 3], [12, 17, 3], [-16, 23, 2.6], [16, 23, 2.6]].forEach(
    ([dx, y, r]) => {
      p.disc(22 + dx, y, r, gold);
      p.disc(22 + dx - 1, y - 1, r * 0.5, light);
      p.rect(22 + dx, y - Math.ceil(r) - 2, 1, 3, light);
      p.set(22 + dx - 1, y, PAL.danger);
      p.set(22 + dx + 1, y, PAL.danger);
    }
  );
  p.outline(CONTOUR);
  return p;
}

// Illuminated fire boat: a dark hull carrying a lattice of lamps
function buildFireBoat() {
  const p = new Pix(70, 34);
  for (let x = 4; x < 66; x++) p.rect(x, 27, 1, 4, '#3A2A2A');
  for (let i = 0; i < 6; i++) {
    p.rect(i, 22 + i, 3, 2, '#3A2A2A');
    p.rect(67 - i, 22 + i, 3, 2, '#3A2A2A');
  }
  p.rect(6, 31, 58, 1, '#241A1A');
  for (let x = 8; x <= 62; x += 2) {
    const centre = Math.pow(Math.max(0, 1 - Math.abs(x - 35) / 13), 1.4) * 17;
    const side = Math.pow(Math.max(0, 1 - Math.abs(Math.abs(x - 35) - 20) / 6), 1.2) * 8;
    const h = Math.round(5 + Math.max(centre, side));
    for (let i = 0; i < h; i += 2) {
      const top = i >= h - 2;
      p.set(x, 25 - i, top ? PAL.white : (x + i) % 4 === 0 ? PAL.catO : PAL.sunHalo);
    }
  }
  return p;
}

function buildPoinciana() {
  const p = new Pix(44, 52);
  p.rect(20, 26, 4, 26, PAL.woodDark);
  p.rect(20, 26, 1, 26, PAL.handle);
  for (let i = 0; i < 9; i++) {
    p.rect(20 - i, 26 - Math.round(i * 0.5), 2, 1, PAL.woodDark);
    p.rect(23 + i, 25 - Math.round(i * 0.6), 2, 1, PAL.woodDark);
  }
  p.ellipse(22, 17, 20, 10, '#2A6A40');
  p.ellipse(22, 15, 20, 9, '#3D8A4E');
  p.ellipse(11, 20, 9, 6, '#3D8A4E');
  p.ellipse(33, 19, 9, 6, '#3D8A4E');
  p.ellipse(19, 11, 13, 5, '#5FA85A');
  for (let i = 0; i < 46; i++) {
    const x = 3 + Math.floor(hash01(i + 11) * 38);
    const y = 6 + Math.floor(hash01(i + 71) * 14);
    if (!p.has(x, y)) continue;
    p.set(x, y, i % 3 === 0 ? PAL.catO : PAL.danger);
    p.set(x + 1, y, PAL.danger);
  }
  p.outline(CONTOUR);
  return p;
}

function buildLamp() {
  const p = new Pix(12, 38);
  p.rect(5, 6, 2, 30, '#3A4A5A');
  p.rect(5, 6, 1, 30, '#5E7A8C');
  p.rect(3, 34, 6, 3, '#3A4A5A');
  p.rect(1, 8, 10, 1, '#3A4A5A');
  p.rect(5, 3, 2, 3, '#3A4A5A');
  [1, 8].forEach((x) => {
    p.rect(x, 9, 3, 1, '#3A4A5A');
    p.rect(x, 10, 3, 4, PAL.sun);
    p.rect(x + 1, 14, 1, 1, '#3A4A5A');
  });
  p.outline(CONTOUR);
  return p;
}

// ---------------------------------------------------------------------------
// Themed scenery: sky, ridges, river and clouds change with the spice tier
// ---------------------------------------------------------------------------
export const THEMES = {
  1: {
    sky: PAL.sky,
    far: [PAL.mtnFar, PAL.mtnFarRim],
    mid: [PAL.mtnMid, PAL.mtnMidRim],
    water: PAL.water,
    glint: PAL.waterGlint,
    cloud: [PAL.cloud, PAL.cloudShade],
    orb: 'sun',
    tint: null
  },
  2: {
    sky: ['#2F7FC1', '#4296D0', '#5CADDB', '#83C4E4', '#ABD9EA', '#D2EBEE', '#EAF4E6'],
    far: ['#8FB8D8', '#AFCFE6'],
    mid: ['#6C9CC4', '#8AB4D4'],
    water: ['#4FA8D8', '#2F86C4', '#1F66A6'],
    glint: '#E6F6FA',
    cloud: [PAL.white, '#CFE3F2'],
    orb: 'noon',
    tint: null
  },
  3: {
    sky: ['#3A2A5C', '#5E3470', '#8E4078', '#C2506E', '#E66F5C', '#F59A55', '#FBC56B'],
    far: ['#7A3F6E', '#A0527A'],
    mid: ['#532C5C', '#6E3A6C'],
    water: ['#E0705A', '#A84A66', '#6A3466'],
    glint: '#FBC56B',
    cloud: ['#FBC9A0', '#E08A78'],
    orb: 'sunset',
    tint: ['#8E4078', 0.28]
  },
  4: {
    sky: ['#0B1026', '#111A3A', '#16244E', '#1C3060', '#243C70', '#2E4A7E', '#3A5A8A'],
    far: ['#1A2A52', '#26396A'],
    mid: ['#111D3E', '#1A2A52'],
    water: ['#1C3060', '#14234A', '#0C1734'],
    glint: '#7FB2E6',
    cloud: ['#2E4A7E', '#1C3060'],
    orb: 'moon',
    tint: ['#0B1026', 0.5]
  },
  fever: {
    sky: ['#F7B63A', '#F9C653', '#FBD56E', '#FCE08A', '#FDE9A6', '#FEF1C2', '#FFF7DC'],
    far: ['#E9A23B', '#F3BC5A'],
    mid: ['#D0832E', '#E39A3F'],
    water: ['#F3BC5A', '#E39A3F', '#C97A2B'],
    glint: '#FFF7DC',
    cloud: ['#FFF7DC', '#FBD56E'],
    orb: 'sun',
    tint: null
  }
};

export const SKY_W = 240;
export const SKY_H = 275;

function buildSky(theme) {
  const p = new Pix(SKY_W, SKY_H);
  ditherGradient(p, 0, SKY_H, theme.sky);
  const cx = 196;
  if (theme.orb === 'moon') {
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash01(i + 3) * SKY_W);
      const y = Math.floor(hash01(i + 131) * 190);
      p.set(x, y, i % 5 === 0 ? PAL.white : '#9FB6DA');
      if (i % 11 === 0) {
        p.set(x + 1, y, '#9FB6DA');
        p.set(x, y + 1, '#9FB6DA');
      }
    }
    p.disc(cx, 34, 11, PAL.sun);
    p.disc(cx + 5, 30, 10, theme.sky[1]);
  } else if (theme.orb === 'sunset') {
    for (let y = 150; y < 240; y++) {
      for (let x = cx - 40; x < cx + 40; x++) {
        const d = Math.hypot(x - cx, y - 196);
        if (d <= 24) p.set(x, y, y > 204 && y % 4 < 2 ? '#F59A55' : '#FFE2A0');
        else if (d <= 31 && ((x + y) & 1) === 0) p.set(x, y, '#FBC56B');
      }
    }
  } else {
    const cy = theme.orb === 'noon' ? 36 : 58;
    const r = theme.orb === 'noon' ? 10 : 13;
    for (let y = cy - r - 10; y <= cy + r + 10; y++) {
      for (let x = cx - r - 10; x <= cx + r + 10; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) p.set(x, y, PAL.sun);
        else if (d <= r + 5 && ((x + y) & 1) === 0) p.set(x, y, PAL.sunHalo);
        else if (d <= r + 9 && (x & 1) === 0 && (y & 1) === 0) p.set(x, y, PAL.sunHalo);
      }
    }
  }
  return p;
}

function buildRidge(w, h, [color, rim], seed, towers, amp) {
  const p = new Pix(w, h);
  for (let x = 0; x < w; x++) {
    const a = (x / w) * TAU;
    let v = 0.5 + 0.25 * Math.sin(a * 2 + seed) + 0.2 * Math.sin(a * 5 + seed * 2.3);
    v += 0.5 * Math.pow(Math.max(0, Math.sin(a * towers + seed * 1.7)), 0.45);
    const top = Math.max(0, h - Math.round(v * amp));
    for (let y = top; y < h; y++) p.set(x, y, y === top ? rim : color);
  }
  return p;
}

function buildRiverStrip(theme) {
  const p = new Pix(64, 21);
  p.wrapX = true;
  ditherGradient(p, 0, 21, theme.water, 0.6);
  [[4, 3, 9], [34, 5, 12], [52, 9, 8], [14, 11, 11], [40, 15, 10], [2, 17, 7]].forEach(([x, y, len], i) => {
    for (let k = 0; k < len; k++) p.set(x + k, y, i % 2 === 0 ? theme.glint : theme.water[2]);
  });
  return p;
}

function buildCloud([light, shade], lobes) {
  const minX = Math.min(...lobes.map(([dx, r]) => dx - r));
  const maxX = Math.max(...lobes.map(([dx, r]) => dx + r));
  const maxR = Math.max(...lobes.map(([, r]) => r));
  const p = new Pix(maxX - minX + 1, maxR + 2);
  lobes.forEach(([dx, r]) => {
    for (let y = -r; y <= 0; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) p.set(dx - minX + x, maxR + y, light);
      }
    }
  });
  p.rect(1, maxR + 1, p.w - 2, 1, shade);
  for (let x = 0; x < p.w; x++) {
    if (p.has(x, maxR)) p.set(x, maxR, shade);
  }
  return p;
}

function buildRailing() {
  const p = new Pix(8, 8);
  p.rect(0, 0, 8, 1, '#5E7A8C');
  p.rect(0, 1, 8, 1, '#3A4A5A');
  p.rect(3, 2, 1, 5, '#3A4A5A');
  p.set(3, 4, '#5E7A8C');
  p.rect(0, 7, 8, 1, '#3A4A5A');
  return p;
}

function buildPavement() {
  const W = 32;
  const H = 75;
  const p = new Pix(W, H);
  p.rect(0, 0, W, 1, CONTOUR);
  p.rect(0, 1, W, 2, '#E2DACB');
  p.rect(0, 3, W, 1, '#A8A294');
  for (let y = 4; y < H; y++) {
    const row = Math.floor((y - 4) / 6);
    const shift = row % 2 === 0 ? 0 : 8;
    for (let x = 0; x < W; x++) {
      const bx = (x + shift) % 16;
      const brick = Math.floor((x + shift) / 16) + row * 7;
      let c = hash01(brick) > 0.7 ? '#C9BEAA' : '#B8AC98';
      if ((y - 4) % 6 === 5 || bx === 15) c = '#A39986';
      else if ((y - 4) % 6 === 0) c = '#CFC5B2';
      if (y > 52 && ((x + y) & 1) === 0) c = '#8E8474';
      if (y > 66) c = '#8E8474';
      p.set(x, y, c);
    }
  }
  return p;
}

/** Sprites that do not depend on the theme. */
export function buildTaiPlaSprites() {
  const sprites = {};
  Object.entries(CHARACTERS).forEach(([id, def]) => {
    sprites[id] = buildCharacter(def);
  });
  Object.assign(sprites, {
    hop_chili: buildHopChili(),
    hawk: buildFlyingChili(),
    pot_ghost: buildPotGhost(),
    hot_runner: buildHotRunner(),
    coconut: buildCoconut(),
    giant_mortar: buildGiantMortar(),
    fish: buildFish(),
    satow: buildSatawItem(),
    bamboo: buildBamboo(),
    golden_mortar: buildGoldenMortar(),
    satow_spring: buildSpring(),
    steam_vent: buildSteamVent(),
    steam_puff: buildSteamPuff(),
    bolt: buildBolt(),
    sparkle: buildSparkle(),
    ring_gold: buildRing(14, PAL.bell),
    ring_green: buildRing(14, PAL.podLight),
    ring_blue: buildRing(16, '#8AD3EE'),
    railing: buildRailing()
  });
  return sprites;
}

/** Scenery sprites that get tinted at dusk and night. */
export function buildTaiPlaLandmarks() {
  return {
    cafe_in_the_haus: buildCafe(),
    st_anne_church: buildChurch(),
    clock_tower: buildClockTower(),
    governor_residence: buildGovernorHouse(),
    phaya_naga: buildNagaStatue(),
    poinciana_tree: buildPoinciana(),
    street_lamp: buildLamp(),
    pavement: buildPavement()
  };
}

export function buildFireBoatSprite() {
  return buildFireBoat();
}

/** Scenery for one theme key (1-4 or 'fever'). */
export function buildTaiPlaTheme(key) {
  const theme = THEMES[key] || THEMES[1];
  return {
    sky: buildSky(theme),
    ridgeFar: buildRidge(256, 60, theme.far, 1.3, 6, 40),
    ridgeMid: buildRidge(256, 40, theme.mid, 4.1, 9, 26),
    river: buildRiverStrip(theme),
    cloudA: buildCloud(theme.cloud, [[0, 6], [9, 9], [20, 7], [28, 5]]),
    cloudB: buildCloud(theme.cloud, [[0, 5], [7, 7], [15, 5]]),
    tint: theme.tint
  };
}
