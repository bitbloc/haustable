/* Hallmark · component: ArcadePreview · genre: modern-minimal · theme: Atelier (pixel attract loop)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import React, { useEffect, useRef } from 'react';
import { taiPlaRenderer } from './game/renderers/TaiPla128Renderer';
import { buildFlappyArt, ART_SCALE } from './game/utils/flappyArt';
import { hash01 } from './game/utils/pixelArtKit';

const W = 480;
const H = 270;
const GROUND_Y = 222;
const ROSTER = ['tai_pla', 'som_satow', 'khao_lam', 'barista_cat', 'baby_naga'];

let flappyCache = null;
function flappySprites() {
  if (!flappyCache) {
    flappyCache = {};
    Object.entries(buildFlappyArt()).forEach(([key, pix]) => {
      flappyCache[key] = pix.toCanvas(ART_SCALE);
    });
  }
  return flappyCache;
}

const even = (v) => Math.round(v / 2) * 2;

// The five runners jog along the promenade, hopping in turn
function drawRunner(ctx, t) {
  const distance = t * 2.2;
  taiPlaRenderer.drawBackground(ctx, W, H, GROUND_Y, distance, t, 1, 0);

  [['satow', 0, 78], ['fish', 190, 54], ['bamboo', 360, 86]].forEach(([type, lead, lift], i) => {
    const x = W + 20 - ((distance + lead) % (W + 80));
    taiPlaRenderer.drawItem(ctx, { x, y: GROUND_Y - lift, type, bobOffset: i * 2 }, t);
  });

  ROSTER.forEach((id, i) => {
    const phase = (t + i * 46) % 230;
    const hop = phase < 32 ? Math.sin((phase / 32) * Math.PI) * 44 : 0;
    taiPlaRenderer.drawCharacter(ctx, id, 28 + i * 86, GROUND_Y - hop, t + i * 3, hop === 0, 0, 0, 1, 1, GROUND_Y);
  });
}

// The cat threads sataw pods on its own
function drawFlappy(ctx, t, state) {
  const s = flappySprites();
  const skyShift = even(t * 0.3) % s.bg_wall.width;
  for (let x = -skyShift; x < W; x += s.bg_wall.width) {
    ctx.drawImage(s.bg_wall, 0, 330, s.bg_wall.width, 210, x, 0, s.bg_wall.width, 210);
  }
  const riverShift = even(t) % s.bg_river.width;
  for (let x = -riverShift; x < W; x += s.bg_river.width) {
    ctx.drawImage(s.bg_river, 0, 0, s.bg_river.width, 60, x, 210, s.bg_river.width, 60);
  }

  const PERIOD = 240;
  const GAP = 100;
  const travel = t * 2;
  const first = Math.floor(travel / PERIOD);
  const catX = 132;
  let target = null;

  for (let k = 0; k < 4; k++) {
    const index = first + k;
    const x = even(k * PERIOD - (travel % PERIOD) + 60);
    const gapCentre = even(74 + hash01(index) * 96);
    if (target === null && x + 64 > catX - 20) target = gapCentre;

    ctx.save();
    ctx.translate(x, gapCentre - GAP / 2);
    ctx.scale(1, -1);
    ctx.drawImage(s.satow_pod, 0, 0);
    ctx.restore();
    ctx.drawImage(s.satow_pod, x, gapCentre + GAP / 2);
  }

  if (state.catY === undefined) state.catY = target ?? 110;
  state.catY += ((target ?? 110) - state.catY) * 0.07;
  const frame = [0, 1, 2, 1][Math.floor(t / 5) % 4];
  const bob = Math.sin(t * 0.25) * 4;
  ctx.drawImage(s.cat_sheet, frame * 48, 0, 48, 48, catX - 24, even(state.catY + bob) - 24, 48, 48);
}

// Night on the Mekong for the listening lounge
function drawLounge(ctx, t) {
  taiPlaRenderer.drawBackground(ctx, W, H, GROUND_Y, t * 0.6 + 900, t, 4, 0);
}

const SCENES = { tai_pla: drawRunner, flappy: drawFlappy, lofi: drawLounge };

export default function ArcadePreview({ game, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const draw = SCENES[game] || drawRunner;
    const state = {};
    let tick = 40;
    let raf = null;
    let last = 0;
    let visible = true;

    const paint = () => {
      ctx.clearRect(0, 0, W, H);
      draw(ctx, tick, state);
    };

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    paint();
    if (reduceMotion) return undefined;

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 33) return;
      last = now;
      tick += 1;
      paint();
    };
    raf = requestAnimationFrame(loop);

    let observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      observer.observe(canvas);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
    };
  }, [game]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-hidden="true"
      className={`block w-full h-auto ${className}`}
      style={{ imageRendering: 'pixelated', aspectRatio: `${W} / ${H}` }}
    />
  );
}
