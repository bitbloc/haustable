/**
 * TaiPla128Renderer.js
 * Canvas renderer for Tai-Pla Run. All art comes from utils/taiPlaArt.js and is baked
 * once at ART_SCALE, so every texel on screen is the same 2x2 canvas pixels.
 *
 * Draw positions are snapped to that grid. Hazards and pickups are told apart by shape,
 * colour and motion (ink outline + red for enemies, sparkles for pickups), not by labels.
 */
import {
  ART_SCALE,
  buildTaiPlaSprites,
  buildTaiPlaLandmarks,
  buildFireBoatSprite,
  buildTaiPlaTheme
} from '../utils/taiPlaArt';
import { buildWarning } from '../utils/flappyArt';

const S = ART_SCALE;
const snap = (v) => Math.round(v / S) * S;
const RIVER_H = 42;
const SCENE_PERIOD = 2600;
const LANDMARK_KEYS = [
  'cafe_in_the_haus',
  'st_anne_church',
  'clock_tower',
  'governor_residence',
  'phaya_naga',
  'poinciana_tree',
  'street_lamp',
  'pavement'
];

function tintCanvas(source, tint) {
  if (!tint) return source;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = tint[1];
  ctx.fillStyle = tint[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function tileX(ctx, img, offset, y, width) {
  const w = img.width;
  let x = -(((snap(offset) % w) + w) % w);
  for (; x < width; x += w) ctx.drawImage(img, x, y);
}

function pixelShadow(ctx, cx, y, halfW, alpha) {
  const half = Math.max(S * 2, snap(halfW));
  const left = snap(cx) - half;
  ctx.fillStyle = `rgba(27, 20, 32, ${alpha})`;
  ctx.fillRect(left + S, y, half * 2 - S * 2, S);
  ctx.fillRect(left, y + S, half * 2, S);
  ctx.fillRect(left + S, y + S * 2, half * 2 - S * 2, S);
}

export class TaiPla128Renderer {
  constructor() {
    this.sprites = {};
    this.themes = {};
    this.isReady = false;
    this.init();
  }

  init() {
    Object.entries(buildTaiPlaSprites()).forEach(([key, pix]) => {
      this.sprites[key] = pix.toCanvas(S);
    });
    Object.entries(buildTaiPlaLandmarks()).forEach(([key, pix]) => {
      this.sprites[key] = pix.toCanvas(S);
    });
    this.sprites.lai_ruea_fai = buildFireBoatSprite().toCanvas(S);
    this.sprites.warning = buildWarning().toCanvas(S);
    this.isReady = true;
  }

  // Scenery is baked per theme the first time that theme is shown
  getTheme(key) {
    if (!this.themes[key]) {
      const art = buildTaiPlaTheme(key);
      const theme = { tint: art.tint, land: {} };
      ['sky', 'ridgeFar', 'ridgeMid', 'river', 'cloudA', 'cloudB'].forEach((name) => {
        theme[name] = art[name].toCanvas(S);
      });
      LANDMARK_KEYS.forEach((name) => {
        theme.land[name] = tintCanvas(this.sprites[name], art.tint);
      });
      this.themes[key] = theme;
    }
    return this.themes[key];
  }

  drawBackground(ctx, width, height, groundY, distanceRun, frame, spicyTier, feverTimer) {
    const key = feverTimer > 0 ? 'fever' : Math.min(4, Math.max(1, spicyTier || 1));
    const t = this.getTheme(key);
    const isNight = key === 4;
    const riverY = groundY - RIVER_H;

    // 1. Sky with its sun or moon
    ctx.drawImage(t.sky, 0, 0);

    // 2. Clouds drifting slower than everything else
    const span = width + 240;
    [[t.cloudA, 0, 70], [t.cloudB, 320, 150], [t.cloudB, 560, 40]].forEach(([img, lead, y]) => {
      const x = width + 60 - ((distanceRun * 0.1 + lead) % span);
      ctx.drawImage(img, snap(x), y);
    });

    // 3. Karst ranges across the river, two parallax depths
    tileX(ctx, t.ridgeFar, distanceRun * 0.08, riverY - t.ridgeFar.height, width);
    tileX(ctx, t.ridgeMid, distanceRun * 0.16, riverY - t.ridgeMid.height, width);

    // 4. Mekong
    tileX(ctx, t.river, distanceRun * 0.3 + frame * 0.4, riverY, width);

    // Fire boat festival on the night tier
    if (isNight) {
      const boat = this.sprites.lai_ruea_fai;
      const boatX = width + 300 - ((distanceRun * 0.35) % (width + 600)) - 150;
      ctx.drawImage(boat, snap(boatX), riverY - boat.height + 16);
    }

    // 5. Landmarks along the promenade
    const posOf = (baseX) => {
      const pos = (baseX - distanceRun * 0.75) % SCENE_PERIOD;
      return ((pos % SCENE_PERIOD) + SCENE_PERIOD) % SCENE_PERIOD - 160;
    };
    const place = (name, baseX) => {
      const img = t.land[name];
      const x = snap(posOf(baseX));
      if (x > -img.width && x < width) ctx.drawImage(img, x, groundY - img.height);
      return x;
    };

    place('cafe_in_the_haus', 220);
    place('st_anne_church', 850);
    place('clock_tower', 1480);
    place('governor_residence', 2050);
    place('phaya_naga', 2420);
    for (let tx = 60; tx < SCENE_PERIOD; tx += 650) place('poinciana_tree', tx);
    for (let lx = 380; lx < SCENE_PERIOD; lx += 450) {
      const x = place('street_lamp', lx);
      if (key === 3 || key === 4) {
        // Lanterns stay lit after the scenery darkens
        ctx.fillStyle = '#FFE08A';
        ctx.fillRect(x + 1 * S, groundY - 28 * S, 3 * S, 4 * S);
        ctx.fillRect(x + 8 * S, groundY - 28 * S, 3 * S, 4 * S);
      }
    }

    // 6. Railing and pavement move with the ground plane
    tileX(ctx, this.sprites.railing, distanceRun, groundY - this.sprites.railing.height, width);
    tileX(ctx, t.land.pavement, distanceRun, groundY, width);
    const paveBottom = groundY + t.land.pavement.height;
    if (paveBottom < height) {
      ctx.fillStyle = isNight ? '#4A4654' : '#8E8474';
      ctx.fillRect(0, paveBottom, width, height - paveBottom);
    }

    // 7. Poinciana petals on the river breeze
    for (let p = 0; p < 8; p++) {
      const raw = (p * 73 - (frame * 1.8 + distanceRun * 0.5)) % width;
      const px = raw < 0 ? raw + width : raw;
      const py = groundY - 80 + Math.sin(frame * 0.08 + p) * 45;
      ctx.fillStyle = p % 2 ? '#E24B3B' : '#F08A2E';
      ctx.fillRect(snap(px), snap(py), S * 2, S);
    }
  }

  /**
   * Character sprite anchored at its feet (x + 24, y).
   */
  drawCharacter(ctx, charId, x, y, frame, isGrounded, godModeTimer, feverTimer, scaleX, scaleY, groundY = 550) {
    const sheet = this.sprites[charId] || this.sprites.tai_pla;
    if (!sheet) return;

    const lift = Math.max(0, groundY - y);
    const shadowScale = Math.max(0.4, 1 - lift / 140);
    pixelShadow(ctx, x + 22, groundY, 16 * shadowScale, 0.3);

    const fIdx = isGrounded ? Math.floor((frame / 4) % 4) : 4;
    const sx = snap(x);
    const sy = snap(y);

    ctx.save();

    // Afterimages while powered up
    if (feverTimer > 0 || godModeTimer > 0) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(sheet, fIdx * 48, 0, 48, 48, sx - 14, sy - 42, 48, 48);
      ctx.globalAlpha = 0.15;
      ctx.drawImage(sheet, fIdx * 48, 0, 48, 48, sx - 28, sy - 42, 48, 48);
      ctx.globalAlpha = 1;
    }

    // Power-up ring: gold for fever, green for god mode
    const ring = feverTimer > 0 ? this.sprites.ring_gold : godModeTimer > 0 ? this.sprites.ring_green : null;
    if (ring) {
      const pulse = Math.floor(frame / 6) % 2 === 0 ? 0 : S;
      ctx.drawImage(
        ring,
        sx + 22 - ring.width / 2 - pulse,
        sy - 20 - ring.height / 2 - pulse,
        ring.width + pulse * 2,
        ring.height + pulse * 2
      );
    }

    if (charId === 'khao_lam' && Math.floor(frame / 12) % 2 === 0) {
      const magnet = this.sprites.ring_blue;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(magnet, sx + 22 - magnet.width / 2, sy - 20 - magnet.height / 2);
      ctx.globalAlpha = 1;
    }

    // Squash and stretch around the feet
    ctx.translate(sx + 24, sy);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(sheet, fIdx * 48, 0, 48, 48, -24, -42, 48, 48);
    ctx.restore();
  }

  drawEnemy(ctx, mon, frame, groundY) {
    if (mon.type === 'naga_thunder') {
      this.drawNagaThunder(ctx, mon, frame, groundY);
      return;
    }

    const mx = snap(mon.x);
    let my = mon.y;
    if (mon.type === 'hop_chili') {
      my = mon.y - Math.abs(Math.sin(frame * 0.12 + (mon.animPhase || 0))) * 24;
    } else if (mon.type === 'hawk') {
      my = mon.y + Math.sin(frame * 0.09 + (mon.animPhase || 0)) * 12;
    }
    my = snap(my);

    if (mon.type !== 'hawk') {
      const lift = Math.max(0, groundY - my);
      const shadowScale = Math.max(0.35, 1 - lift / (mon.type === 'giant_mortar' ? 500 : 40));
      pixelShadow(ctx, mx + mon.width / 2, groundY, mon.width * 0.45 * shadowScale, 0.3);
    }

    const s = this.sprites;
    if (mon.type === 'hop_chili') {
      const f = Math.floor((frame / 5) % 4);
      ctx.drawImage(s.hop_chili, f * 36, 0, 36, 38, mx, my - 34, 36, 38);
    } else if (mon.type === 'coconut') {
      const f = Math.floor((frame / 5) % 4);
      ctx.drawImage(s.coconut, f * 28, 0, 28, 28, mx - 2, my - 26, 28, 28);
    } else if (mon.type === 'hawk') {
      const f = Math.floor((frame / 4) % 4);
      ctx.drawImage(s.hawk, f * 38, 0, 38, 38, mx, my - 24, 38, 38);
    } else if (mon.type === 'pot_ghost') {
      const f = Math.floor((frame / 8) % 2);
      ctx.drawImage(s.pot_ghost, f * 32, 0, 32, 34, mx, my - 30, 32, 34);
    } else if (mon.type === 'hot_runner') {
      const f = Math.floor((frame / 4) % 2);
      ctx.drawImage(s.hot_runner, f * 36, 0, 36, 40, mx, my - 36, 36, 40);
    } else if (mon.type === 'giant_mortar') {
      ctx.drawImage(s.giant_mortar, mx, my - 48);
    }
  }

  drawNagaThunder(ctx, mon, frame, groundY) {
    const tx = snap(mon.x);
    if (mon.isTelegraph) {
      // Warning column blinks before the strike lands
      const on = Math.floor(frame / 4) % 2 === 0;
      ctx.fillStyle = on ? 'rgba(226, 75, 59, 0.38)' : 'rgba(226, 75, 59, 0.18)';
      ctx.fillRect(tx - 14, 0, 28, groundY);
      ctx.fillStyle = '#E24B3B';
      ctx.fillRect(tx - 14, 0, S, groundY);
      ctx.fillRect(tx + 12, 0, S, groundY);
      const icon = this.sprites.warning;
      ctx.drawImage(icon, tx - icon.width / 2, groundY - 70 - (on ? S : 0));
    } else {
      const bolt = this.sprites.bolt;
      const jitter = Math.floor(frame / 2) % 2 === 0 ? 0 : S;
      for (let y = groundY - bolt.height; y > -bolt.height; y -= bolt.height) {
        ctx.drawImage(bolt, tx - bolt.width / 2 + jitter, y);
      }
      const spark = this.sprites.sparkle;
      [[-22, -6], [14, -10], [-8, -18], [20, -2]].forEach(([dx, dy], i) => {
        if ((Math.floor(frame / 2) + i) % 2 === 0) ctx.drawImage(spark, tx + dx, groundY + dy - spark.height);
      });
    }
  }

  /**
   * Pickups twinkle so they read as friendly without any text.
   */
  drawItem(ctx, item, frame) {
    const bob = Math.sin(frame * 0.12 + (item.bobOffset || 0)) * 5;
    const ix = snap(item.x);
    const iy = snap(item.y + bob);
    const sprite = this.sprites[item.type] || this.sprites.fish;
    const half = sprite.width / 2;

    if (item.type === 'golden_mortar' || item.type === 'satow') {
      const ring = item.type === 'satow' ? this.sprites.ring_green : this.sprites.ring_gold;
      const grow = Math.floor(frame / 8) % 2 === 0 ? 0 : S;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(
        ring,
        ix + half - ring.width / 2 - grow,
        iy + half - ring.height / 2 - grow,
        ring.width + grow * 2,
        ring.height + grow * 2
      );
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(sprite, ix, iy);

    const spark = this.sprites.sparkle;
    const spots = [[-6, -4], [sprite.width - 4, 2], [sprite.width - 10, sprite.height - 6], [-2, sprite.height - 10]];
    const phase = Math.floor(frame / 9 + (item.bobOffset || 0)) % spots.length;
    ctx.drawImage(spark, ix + spots[phase][0], iy + spots[phase][1]);
  }

  drawElement(ctx, elem, frame, groundY) {
    const ex = snap(elem.x);
    if (elem.type === 'satow_spring') {
      const f = elem.isCompressed ? 1 : 0;
      ctx.drawImage(this.sprites.satow_spring, f * 36, 0, 36, 26, ex, groundY - 24, 36, 26);

      // Bouncing chevron shows the pad launches upward
      const lift = Math.floor(frame / 10) % 2 === 0 ? 0 : S;
      const top = groundY - 40 - lift;
      ctx.fillStyle = '#1B1420';
      ctx.fillRect(ex + 16 - S, top - S, 4 + S * 2, S);
      ctx.fillRect(ex + 12 - S, top + S, 12 + S * 2, S);
      ctx.fillRect(ex + 8 - S, top + S * 3, 20 + S * 2, S * 2);
      ctx.fillStyle = '#C8EE7E';
      ctx.fillRect(ex + 16, top, 4, S);
      ctx.fillRect(ex + 12, top + S, 12, S);
      ctx.fillRect(ex + 8, top + S * 2, 20, S);
    } else if (elem.type === 'steam_jet') {
      const vent = this.sprites.steam_vent;
      if (elem.isBursting) {
        const puff = this.sprites.steam_puff;
        for (let i = 0; i < 4; i++) {
          const rise = (frame * 3 + i * 19) % 70;
          const sway = (i % 2 === 0 ? 1 : -1) * (Math.floor(rise / 14) % 2) * S;
          ctx.drawImage(puff, ex + 2 + sway, snap(groundY - 30 - rise));
        }
      }
      ctx.drawImage(vent, ex, groundY - vent.height);
      if (!elem.isBursting) {
        // Pilot light blinks while pressure builds
        ctx.fillStyle = Math.floor(frame / 6) % 2 === 0 ? '#E24B3B' : '#F5D547';
        ctx.fillRect(ex + 12, groundY - vent.height + S, S * 2, S);
      }
    }
  }
}

export const taiPlaRenderer = new TaiPla128Renderer();
