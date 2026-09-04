/**
 * TaiPla128Renderer.js
 * 128-Bit Neo-Arcade Pixel Art Rendering Engine for Tai-Pla Runner
 * 
 * Features:
 * - Offscreen pre-baked sprite sheets for ultra-smooth 60fps mobile performance
 * - 3 Playable Characters (Tai Pla, Som Satow, Khao Lam) with multi-frame run, jump, flip & hurt animations
 * - 7 Dynamic Hazards (Hop Chili, Rolling Coconut, River Hawk, Pot Ghost, Hot Runner, Naga Thunder, Giant Mortar)
 * - 3 Interactive Stage Elements (Satow Spring Pad, Steam Jet Vent, Golden Mortar Bonus)
 * - 5-Layer Mekong Parallax (Dynamic Tier Sky, Lao Mountains, Mekong Water & Longtails, Nakhon Phanom Landmarks, Promenade)
 * 
 * Adheres strictly to Dieter Rams + Thai Modern OKLCH Palette and Hallmark Anti-AI-Slop standards.
 */

// Helper to create an offscreen canvas
function createOffscreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export class TaiPla128Renderer {
  constructor() {
    this.sprites = {};
    this.isReady = false;
    this.init();
  }

  init() {
    this.bakeCharacters();
    this.bakeIngredients();
    this.bakeEnemies();
    this.bakeInteractiveElements();
    this.bakeLandmarks();
    this.isReady = true;
  }

  // =========================================================================
  // 1. CHARACTER SPRITES (48x48 per frame)
  // =========================================================================
  bakeCharacters() {
    // A. น้องไตปลา (Tai Pla) - Calico cat with Thai indigo chef apron
    this.sprites.tai_pla = this.createCharacterSheet({
      baseColor: '#fffbeb',      // Warm cream
      patchColor1: '#ea580c',    // Thai terracotta ginger
      patchColor2: '#262626',    // Charcoal black
      earInner: '#fca5a5',       // Soft pink
      apronColor: '#1e3a8a',     // Traditional Thai Indigo (หม้อห้อม)
      apronTrim: '#60a5fa',      // Indigo highlight
      eyesOpen: '#1c1917',
      eyesFever: '#f43f5e',
      collarColor: '#059669',    // Green herb pouch
      isCat: true
    });

    // B. พี่ส้มสตอ (Som Satow) - Heavy-set ginger tiger tabby with chef bandana & ladle
    this.sprites.som_satow = this.createCharacterSheet({
      baseColor: '#ea580c',      // Rich ginger orange
      patchColor1: '#9a3412',    // Deep tiger stripes
      patchColor2: '#fff7ed',    // White muzzle & belly
      earInner: '#fca5a5',
      apronColor: '#15803d',     // Banana leaf green bandana & sash
      apronTrim: '#86efac',
      eyesOpen: '#1c1917',
      eyesFever: '#f43f5e',
      hasLadle: true,
      isCat: true
    });

    // C. เจ้าตูบข้าวหลาม (Khao Lam) - Adorable Thai countryside golden dog
    this.sprites.khao_lam = this.createCharacterSheet({
      baseColor: '#d97706',      // Golden Thai dog coat
      patchColor1: '#78350f',    // Dark brown floppy ears
      patchColor2: '#fef08a',    // Cream muzzle & chest
      earInner: '#fca5a5',
      apronColor: '#dc2626',     // Red braided Thai good-luck collar
      apronTrim: '#facc15',      // Brass bell
      eyesOpen: '#1c1917',
      eyesFever: '#f43f5e',
      isDog: true
    });
  }

  createCharacterSheet(config) {
    // 6 frames: [0: Run1, 1: Run2, 2: Run3, 3: Run4, 4: Jump, 5: Hurt]
    const frameW = 48;
    const frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      this.drawCharacterFrame(ctx, f, config);
      ctx.restore();
    }

    return canvas;
  }

  drawCharacterFrame(ctx, frameIdx, cfg) {
    const isJump = frameIdx === 4;
    const isHurt = frameIdx === 5;
    const runPhase = frameIdx % 4;

    // Bobbing offset for run cycle
    const bodyBob = isJump ? -4 : (runPhase === 1 || runPhase === 3 ? -2 : 0);

    // 1. Tail (Wagging / Tucked)
    ctx.save();
    if (cfg.isDog) {
      // Dog tail: perky curve with tail wag
      const wag = isJump ? 4 : (runPhase === 0 || runPhase === 2 ? 3 : -2);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(8, 22 + bodyBob + wag, 6, 6);
      ctx.fillRect(4, 18 + bodyBob + wag, 6, 6);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(9, 23 + bodyBob + wag, 4, 4);
      ctx.fillRect(5, 19 + bodyBob + wag, 4, 4);
      ctx.fillStyle = cfg.patchColor2; // White tip
      ctx.fillRect(5, 19 + bodyBob + wag, 3, 3);
    } else {
      // Cat tail: elegant S-curve
      const wag = isJump ? -6 : (runPhase === 0 ? 3 : -2);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(8, 24 + bodyBob, 4, 4);
      ctx.fillRect(4, 20 + bodyBob + wag, 4, 6);
      ctx.fillRect(2, 14 + bodyBob + wag, 4, 8);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(9, 25 + bodyBob, 2, 2);
      ctx.fillRect(5, 21 + bodyBob + wag, 2, 4);
      ctx.fillRect(3, 15 + bodyBob + wag, 2, 6);
      if (cfg.patchColor1) {
        ctx.fillStyle = cfg.patchColor1;
        ctx.fillRect(3, 16 + bodyBob + wag, 2, 2);
      }
    }
    ctx.restore();

    // 2. Ladle for Som Satow
    if (cfg.hasLadle) {
      ctx.save();
      const ladleAngle = isJump ? -0.4 : (runPhase === 1 ? 0.2 : 0);
      ctx.translate(20, 20 + bodyBob);
      ctx.rotate(ladleAngle);
      // Wooden handle
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-14, -14, 16, 4);
      ctx.fillRect(-18, -18, 6, 8);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-13, -13, 14, 2);
      // Scoop cup
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-17, -17, 4, 6);
      ctx.restore();
    }

    // 3. Back Legs
    ctx.fillStyle = '#1c1917';
    if (isJump) {
      ctx.fillRect(10, 36, 6, 8);
      ctx.fillRect(6, 40, 8, 4);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(11, 37, 4, 6);
      ctx.fillRect(7, 41, 6, 2);
    } else if (isHurt) {
      ctx.fillRect(8, 38, 8, 6);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(9, 39, 6, 4);
    } else {
      // Running legs
      const bLegX = runPhase === 0 ? 8 : (runPhase === 1 ? 12 : (runPhase === 2 ? 16 : 10));
      const bLegH = runPhase === 1 ? 6 : 8;
      ctx.fillRect(bLegX, 36 + bodyBob, 6, bLegH);
      ctx.fillRect(bLegX - 2, 36 + bodyBob + bLegH - 2, 6, 3);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(bLegX + 1, 37 + bodyBob, 4, bLegH - 2);
      ctx.fillRect(bLegX - 1, 36 + bodyBob + bLegH - 1, 4, 2);
    }

    // 4. Main Body Torso
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(12, 18 + bodyBob, 22, 18);
    ctx.fillRect(10, 20 + bodyBob, 26, 14);

    // Body Fill
    ctx.fillStyle = cfg.baseColor;
    ctx.fillRect(13, 19 + bodyBob, 20, 16);
    ctx.fillRect(11, 21 + bodyBob, 24, 12);

    // Calico / Tiger Patches
    if (cfg.patchColor1) {
      ctx.fillStyle = cfg.patchColor1;
      ctx.fillRect(14, 19 + bodyBob, 8, 8);
      ctx.fillRect(20, 24 + bodyBob, 6, 6);
    }
    if (cfg.patchColor2) {
      ctx.fillStyle = cfg.patchColor2;
      ctx.fillRect(24, 19 + bodyBob, 8, 6);
      ctx.fillRect(16, 28 + bodyBob, 12, 5); // Underbelly
    }

    // 5. Thai Chef Indigo Apron / Collar
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(22, 22 + bodyBob, 12, 14);
    ctx.fillStyle = cfg.apronColor;
    ctx.fillRect(23, 23 + bodyBob, 10, 12);
    ctx.fillStyle = cfg.apronTrim;
    ctx.fillRect(24, 24 + bodyBob, 8, 2); // Gold/Light trim
    if (cfg.collarColor) {
      ctx.fillStyle = cfg.collarColor;
      ctx.fillRect(26, 27 + bodyBob, 4, 4); // Scallion herb pouch
    }

    // 6. Front Legs
    ctx.fillStyle = '#1c1917';
    if (isJump) {
      ctx.fillRect(28, 32, 6, 10);
      ctx.fillRect(30, 40, 6, 4);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(29, 33, 4, 8);
      ctx.fillRect(31, 41, 4, 2);
    } else if (isHurt) {
      ctx.fillRect(28, 36, 8, 6);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(29, 37, 6, 4);
    } else {
      const fLegX = runPhase === 0 ? 28 : (runPhase === 1 ? 24 : (runPhase === 2 ? 20 : 26));
      const fLegH = runPhase === 3 ? 6 : 8;
      ctx.fillRect(fLegX, 36 + bodyBob, 6, fLegH);
      ctx.fillRect(fLegX + 2, 36 + bodyBob + fLegH - 2, 6, 3);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(fLegX + 1, 37 + bodyBob, 4, fLegH - 2);
      ctx.fillRect(fLegX + 3, 36 + bodyBob + fLegH - 1, 4, 2);
    }

    // 7. Head & Ears
    const headX = 26;
    const headY = 10 + bodyBob;

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(headX, headY, 18, 16);
    ctx.fillRect(headX - 2, headY + 3, 22, 11);

    // Ears
    if (cfg.isDog) {
      // Floppy ears on the sides
      ctx.fillRect(headX - 4, headY + 2, 6, 10);
      ctx.fillRect(headX + 16, headY + 2, 6, 10);
      ctx.fillStyle = cfg.patchColor1; // Brown floppy ears
      ctx.fillRect(headX - 3, headY + 3, 4, 8);
      ctx.fillRect(headX + 17, headY + 3, 4, 8);
    } else {
      // Upright Cat Ears
      ctx.fillRect(headX + 1, headY - 6, 6, 8);
      ctx.fillRect(headX + 11, headY - 6, 6, 8);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(headX + 2, headY - 5, 4, 6);
      ctx.fillRect(headX + 12, headY - 5, 4, 6);
      ctx.fillStyle = cfg.earInner;
      ctx.fillRect(headX + 3, headY - 3, 2, 4);
      ctx.fillRect(headX + 13, headY - 3, 2, 4);
    }

    // Head Face Fill
    ctx.fillStyle = cfg.baseColor;
    ctx.fillRect(headX + 1, headY + 1, 16, 14);
    ctx.fillRect(headX - 1, headY + 4, 20, 9);

    // Calico face patch
    if (cfg.patchColor1) {
      ctx.fillStyle = cfg.patchColor1;
      ctx.fillRect(headX + 1, headY + 1, 7, 7);
    }

    // 8. Eyes & Expressions
    if (isHurt) {
      // Dizzy X eyes
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(headX + 7, headY + 4, 4, 4);
      ctx.fillRect(headX + 14, headY + 4, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 8, headY + 5, 2, 2);
      ctx.fillRect(headX + 15, headY + 5, 2, 2);
    } else {
      // Sparkly Big Pixel Eyes
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(headX + 6, headY + 4, 4, 6);
      ctx.fillRect(headX + 13, headY + 4, 4, 6);
      // Highlights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 7, headY + 5, 2, 2);
      ctx.fillRect(headX + 14, headY + 5, 2, 2);
      ctx.fillRect(headX + 8, headY + 8, 1, 1);
      ctx.fillRect(headX + 15, headY + 8, 1, 1);
    }

    // Nose & Cheeks
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(headX + 10, headY + 9, 3, 2); // Tiny cute nose
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(headX + 3, headY + 9, 3, 2);  // Blush cheek L
    ctx.fillRect(headX + 17, headY + 9, 3, 2); // Blush cheek R

    // Whiskers (for Cats)
    if (cfg.isCat && !isHurt) {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(headX - 4, headY + 8, 4, 1);
      ctx.fillRect(headX - 3, headY + 11, 4, 1);
      ctx.fillRect(headX + 18, headY + 8, 4, 1);
      ctx.fillRect(headX + 17, headY + 11, 4, 1);
    }
  }

  // =========================================================================
  // 2. INGREDIENTS & REWARD ITEMS (32x32)
  // =========================================================================
  bakeIngredients() {
    // 1. ปลาทูแม่กลอง (Chubby Mackerel)
    const fish = createOffscreen(32, 32);
    const fctx = fish.ctx;
    // Outline
    fctx.fillStyle = '#1c1917';
    fctx.fillRect(6, 12, 18, 10);
    fctx.fillRect(22, 10, 6, 14);
    fctx.fillRect(2, 15, 6, 4); // Mouth
    // Body blue/silver
    fctx.fillStyle = '#0284c7';
    fctx.fillRect(8, 13, 14, 4);
    fctx.fillStyle = '#38bdf8';
    fctx.fillRect(8, 17, 14, 3);
    fctx.fillStyle = '#e0f2fe';
    fctx.fillRect(8, 20, 14, 2); // Belly
    // Tail fin
    fctx.fillStyle = '#f59e0b';
    fctx.fillRect(24, 11, 3, 12);
    // Eye
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(6, 14, 3, 3);
    fctx.fillStyle = '#1c1917';
    fctx.fillRect(7, 15, 2, 2);
    this.sprites.fish = fish.canvas;

    // 2. เมล็ดสะตอ (Satow Bean)
    const satow = createOffscreen(32, 32);
    const sctx = satow.ctx;
    sctx.fillStyle = '#1c1917';
    sctx.fillRect(6, 8, 20, 16);
    sctx.fillRect(8, 6, 16, 20);
    // Jade Green Body
    sctx.fillStyle = '#15803d';
    sctx.fillRect(8, 8, 16, 16);
    sctx.fillStyle = '#22c55e';
    sctx.fillRect(10, 10, 12, 10);
    sctx.fillStyle = '#86efac';
    sctx.fillRect(12, 11, 4, 3); // Glossy highlight
    sctx.fillRect(17, 15, 3, 3);
    this.sprites.satow = satow.canvas;

    // 3. หน่อไม้ต้ม (Bamboo Shoot)
    const bamboo = createOffscreen(32, 32);
    const bctx = bamboo.ctx;
    bctx.fillStyle = '#1c1917';
    bctx.fillRect(12, 6, 8, 6);
    bctx.fillRect(9, 11, 14, 8);
    bctx.fillRect(6, 18, 20, 9);
    // Yellow tiers
    bctx.fillStyle = '#fef08a';
    bctx.fillRect(13, 7, 6, 4);
    bctx.fillStyle = '#fde047';
    bctx.fillRect(10, 12, 12, 6);
    bctx.fillStyle = '#eab308';
    bctx.fillRect(7, 19, 18, 7);
    bctx.fillStyle = '#a16207';
    bctx.fillRect(9, 23, 14, 2); // Texture ring
    this.sprites.bamboo = bamboo.canvas;

    // 4. ครกหินทองคำ (Golden Stone Mortar) - Secret Tier 4 Bonus!
    const goldMortar = createOffscreen(36, 36);
    const gmctx = goldMortar.ctx;
    gmctx.fillStyle = '#1c1917';
    gmctx.fillRect(6, 12, 24, 18);
    gmctx.fillRect(9, 8, 18, 6); // Rim
    gmctx.fillRect(16, 2, 6, 12); // Pestle handle
    // Shimmering Gold
    gmctx.fillStyle = '#facc15';
    gmctx.fillRect(8, 14, 20, 14);
    gmctx.fillRect(10, 9, 16, 4);
    gmctx.fillStyle = '#fef08a';
    gmctx.fillRect(10, 11, 8, 2); // Highlight
    gmctx.fillRect(17, 3, 4, 10); // Pestle gold
    gmctx.fillStyle = '#b45309';
    gmctx.fillRect(10, 24, 16, 3); // Base shadow
    this.sprites.golden_mortar = goldMortar.canvas;
  }

  // =========================================================================
  // 3. ENEMY HAZARDS (7 TYPES)
  // =========================================================================
  bakeEnemies() {
    // 1. hop_chili (พริกขี้หนูกระโดด) - 2 frames
    const hopChili = createOffscreen(32 * 2, 32);
    const hctx = hopChili.ctx;
    for (let f = 0; f < 2; f++) {
      hctx.save();
      hctx.translate(f * 32, 0);
      // Green Stem & Calyx
      hctx.fillStyle = '#15803d';
      hctx.fillRect(13, 4, 6, 5);
      hctx.fillRect(11, 8, 10, 3);
      // Red Chili Body
      hctx.fillStyle = '#1c1917';
      hctx.fillRect(8, 10, 16, 16);
      hctx.fillRect(11, 25, 10, 5);
      hctx.fillRect(13, 29, 6, 2);
      hctx.fillStyle = '#dc2626';
      hctx.fillRect(9, 11, 14, 14);
      hctx.fillRect(12, 25, 8, 4);
      hctx.fillStyle = '#ef4444';
      hctx.fillRect(10, 12, 4, 10); // Highlight shine
      // Eyes
      hctx.fillStyle = '#ffffff';
      hctx.fillRect(10, 15, 4, 4);
      hctx.fillRect(17, 15, 4, 4);
      hctx.fillStyle = '#1c1917';
      hctx.fillRect(12, 16, 2, 3);
      hctx.fillRect(19, 16, 2, 3);
      // Headband
      hctx.fillStyle = '#facc15';
      hctx.fillRect(8, 13, 16, 2);
      // Feet
      const footSpread = f === 0 ? 0 : 2;
      hctx.fillStyle = '#1c1917';
      hctx.fillRect(9 - footSpread, 28, 4, 3);
      hctx.fillRect(18 + footSpread, 28, 4, 3);
      hctx.restore();
    }
    this.sprites.hop_chili = hopChili.canvas;

    // 2. coconut (ลูกมะพร้าวกลิ้ง)
    const coconut = createOffscreen(28, 28);
    const cctx = coconut.ctx;
    cctx.fillStyle = '#1c1917';
    cctx.beginPath();
    cctx.arc(14, 14, 12, 0, Math.PI * 2);
    cctx.fill();
    cctx.fillStyle = '#78350f';
    cctx.beginPath();
    cctx.arc(14, 14, 10, 0, Math.PI * 2);
    cctx.fill();
    // Texture fibers
    cctx.fillStyle = '#451a03';
    cctx.fillRect(9, 8, 3, 3);
    cctx.fillRect(16, 8, 3, 3);
    cctx.fillRect(12, 16, 4, 3);
    this.sprites.coconut = coconut.canvas;

    // 3. hawk (เหยี่ยวแม่น้ำโขง) - 2 frames (wing flap)
    const hawk = createOffscreen(36 * 2, 30);
    const hwctx = hawk.ctx;
    for (let f = 0; f < 2; f++) {
      hwctx.save();
      hwctx.translate(f * 36, 0);
      const wingY = f === 0 ? 4 : 14;
      // Wings
      hwctx.fillStyle = '#1c1917';
      hwctx.fillRect(10, wingY, 18, 8);
      hwctx.fillStyle = '#78350f';
      hwctx.fillRect(11, wingY + 1, 16, 6);
      // Body
      hwctx.fillStyle = '#1c1917';
      hwctx.fillRect(8, 12, 20, 12);
      hwctx.fillStyle = '#451a03';
      hwctx.fillRect(9, 13, 18, 10);
      // Head & Golden Beak
      hwctx.fillStyle = '#ffffff';
      hwctx.fillRect(4, 11, 8, 8); // White feathered head
      hwctx.fillStyle = '#facc15';
      hwctx.fillRect(1, 14, 5, 4); // Hooked yellow beak
      // Fierce Eye
      hwctx.fillStyle = '#dc2626';
      hwctx.fillRect(6, 13, 3, 3);
      hwctx.fillStyle = '#1c1917';
      hwctx.fillRect(7, 14, 1, 1);
      hwctx.restore();
    }
    this.sprites.hawk = hawk.canvas;

    // 4. pot_ghost (ผีหม้อดิน) - Clay pot popping lid open
    const potGhost = createOffscreen(32 * 2, 34);
    const pgctx = potGhost.ctx;
    for (let f = 0; f < 2; f++) {
      pgctx.save();
      pgctx.translate(f * 32, 0);
      const lidLift = f === 0 ? 0 : 7;
      // Pot Body
      pgctx.fillStyle = '#1c1917';
      pgctx.fillRect(6, 16, 20, 16);
      pgctx.fillRect(4, 19, 24, 10);
      pgctx.fillStyle = '#b45309';
      pgctx.fillRect(7, 17, 18, 14);
      pgctx.fillRect(5, 20, 22, 8);
      // Red spicy foam & Glowing ghost eyes inside pot
      pgctx.fillStyle = '#ea580c';
      pgctx.fillRect(8, 17, 16, 4);
      pgctx.fillStyle = '#facc15';
      pgctx.fillRect(10, 18, 3, 2);
      pgctx.fillRect(18, 18, 3, 2);
      // Earthen Lid
      pgctx.fillStyle = '#1c1917';
      pgctx.fillRect(4, 12 - lidLift, 24, 6);
      pgctx.fillRect(12, 8 - lidLift, 8, 5); // Lid handle
      pgctx.fillStyle = '#92400e';
      pgctx.fillRect(5, 13 - lidLift, 22, 4);
      pgctx.fillRect(13, 9 - lidLift, 6, 3);
      pgctx.restore();
    }
    this.sprites.pot_ghost = potGhost.canvas;

    // 5. hot_runner (กุ๊กกระทะร้อน / คนหัวร้อน)
    const hotRunner = createOffscreen(36 * 2, 40);
    const hrctx = hotRunner.ctx;
    for (let f = 0; f < 2; f++) {
      hrctx.save();
      hrctx.translate(f * 36, 0);
      // Flaming hair
      hrctx.fillStyle = '#f97316';
      hrctx.fillRect(10, 4, 14, 8);
      hrctx.fillStyle = '#ef4444';
      hrctx.fillRect(12, 1, 10, 5);
      hrctx.fillStyle = '#fef08a';
      hrctx.fillRect(14, 6, 6, 4);
      // Head & Angry Face
      hrctx.fillStyle = '#1c1917';
      hrctx.fillRect(10, 11, 14, 12);
      hrctx.fillStyle = '#fed7aa';
      hrctx.fillRect(11, 12, 12, 10);
      // Angry slanted brow & eyes
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(13, 14, 3, 2);
      hrctx.fillRect(19, 14, 3, 2);
      // Body & Red Chef Uniform
      hrctx.fillStyle = '#1c1917';
      hrctx.fillRect(8, 22, 18, 12);
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(9, 23, 16, 10);
      // Wok in hand
      hrctx.fillStyle = '#1c1917';
      hrctx.fillRect(24, 24, 10, 6);
      hrctx.fillRect(28, 20, 2, 6);
      hrctx.fillStyle = '#f97316';
      hrctx.fillRect(25, 25, 8, 3); // Fiery stir fry!
      // Legs
      const legRun = f === 0 ? 0 : 4;
      hrctx.fillStyle = '#1c1917';
      hrctx.fillRect(9 + legRun, 34, 5, 5);
      hrctx.fillRect(18 - legRun, 34, 5, 5);
      hrctx.restore();
    }
    this.sprites.hot_runner = hotRunner.canvas;

    // 6. giant_mortar (ครกหินยักษ์ทุบพื้น) - Elite Tier 4 Hazard
    const giantMortar = createOffscreen(52, 52);
    const gmctx = giantMortar.ctx;
    gmctx.fillStyle = '#1c1917';
    gmctx.fillRect(8, 20, 36, 30);
    gmctx.fillRect(12, 14, 28, 8); // Rim
    gmctx.fillRect(22, 2, 8, 20);  // Huge pestle
    // Textured Granite Grey
    gmctx.fillStyle = '#64748b';
    gmctx.fillRect(10, 22, 32, 26);
    gmctx.fillRect(14, 16, 24, 6);
    gmctx.fillStyle = '#475569';
    gmctx.fillRect(12, 36, 28, 10);
    gmctx.fillStyle = '#94a3b8';
    gmctx.fillRect(14, 17, 10, 2); // Rim highlight
    // Pestle wood/stone
    gmctx.fillStyle = '#78350f';
    gmctx.fillRect(24, 4, 4, 18);
    this.sprites.giant_mortar = giantMortar.canvas;
  }

  // =========================================================================
  // 4. INTERACTIVE STAGE ELEMENTS
  // =========================================================================
  bakeInteractiveElements() {
    // 1. satow_spring (กระดานสปริงฝักสะตอ) - 2 states (Idle vs Compressed)
    const springPad = createOffscreen(36 * 2, 26);
    const spctx = springPad.ctx;
    for (let f = 0; f < 2; f++) {
      spctx.save();
      spctx.translate(f * 36, 0);
      const compress = f === 1 ? 5 : 0;
      // Metal Base Plate
      spctx.fillStyle = '#1c1917';
      spctx.fillRect(4, 22, 28, 4);
      spctx.fillStyle = '#94a3b8';
      spctx.fillRect(6, 23, 24, 2);
      // Steel Coil Spring
      spctx.fillStyle = '#1c1917';
      spctx.fillRect(15, 14 + compress, 6, 8 - compress);
      spctx.fillStyle = '#cbd5e1';
      spctx.fillRect(16, 15 + compress, 4, 6 - compress);
      // Giant Curved Satow Pod Pad
      spctx.fillStyle = '#1c1917';
      spctx.fillRect(2, 6 + compress, 32, 8);
      spctx.fillRect(6, 4 + compress, 24, 12);
      spctx.fillStyle = '#15803d';
      spctx.fillRect(3, 7 + compress, 30, 6);
      spctx.fillRect(7, 5 + compress, 22, 10);
      spctx.fillStyle = '#86efac';
      spctx.fillRect(10, 6 + compress, 16, 2); // Yellow-green shine
      spctx.restore();
    }
    this.sprites.satow_spring = springPad.canvas;

    // 2. steam_jet (ท่อไอน้ำแกงไตปลาพวยพุ่ง)
    const steamVent = createOffscreen(28, 20);
    const svctx = steamVent.ctx;
    svctx.fillStyle = '#1c1917';
    svctx.fillRect(4, 10, 20, 10);
    svctx.fillRect(2, 6, 24, 5); // Grate lip
    svctx.fillStyle = '#b45309'; // Antique bronze
    svctx.fillRect(5, 11, 18, 8);
    svctx.fillStyle = '#f59e0b';
    svctx.fillRect(4, 7, 20, 3);
    this.sprites.steam_vent = steamVent.canvas;
  }

  // =========================================================================
  // 5. LANDMARKS & SCENIC RIVERFRONT
  // =========================================================================
  bakeLandmarks() {
    // 1. Vietnamese Memorial Clock Tower (หอนาฬิกาเวียดนามอนุสรณ์)
    const clockTower = createOffscreen(60, 130);
    const ctctx = clockTower.ctx;
    const baseH = 120;
    // Outline
    ctctx.fillStyle = '#1c1917';
    ctctx.fillRect(12, baseH - 85, 36, 85);
    ctctx.fillRect(8, baseH - 15, 44, 15);
    ctctx.fillRect(16, baseH - 110, 28, 26);
    ctctx.fillRect(26, baseH - 124, 8, 15); // Spire
    // Warm Vintage Terracotta & Cream Bricks
    ctctx.fillStyle = '#fed7aa'; // Cream wall
    ctctx.fillRect(14, baseH - 83, 32, 68);
    ctctx.fillStyle = '#ea580c'; // Terracotta accent trim
    ctctx.fillRect(10, baseH - 13, 40, 12);
    ctctx.fillRect(18, baseH - 108, 24, 23);
    // Clock Face
    ctctx.fillStyle = '#ffffff';
    ctctx.beginPath();
    ctctx.arc(30, baseH - 96, 8, 0, Math.PI * 2);
    ctctx.fill();
    ctctx.fillStyle = '#1c1917';
    ctctx.fillRect(29, baseH - 101, 2, 6); // Clock hands
    ctctx.fillRect(29, baseH - 96, 5, 2);
    this.sprites.clock_tower = clockTower.canvas;

    // 2. Phaya Si Sattanakharat (องค์พญาศรีสัตตนาคราช 7 เศียร)
    const naga = createOffscreen(72, 110);
    const nctx = naga.ctx;
    const ny = 100;
    // Stone Base
    nctx.fillStyle = '#1c1917';
    nctx.fillRect(8, ny - 30, 56, 30);
    nctx.fillStyle = '#334155';
    nctx.fillRect(10, ny - 28, 52, 27);
    // Coiled Naga Body
    nctx.fillStyle = '#1c1917';
    nctx.fillRect(16, ny - 60, 40, 32);
    nctx.fillStyle = '#ca8a04';
    nctx.fillRect(18, ny - 58, 36, 28);
    // 7 Heads Spires
    const headXOffsets = [6, 13, 20, 27, 34, 41, 48];
    headXOffsets.forEach((hx, i) => {
      const peak = i === 3 ? 14 : (i === 2 || i === 4 ? 8 : 2);
      nctx.fillStyle = '#1c1917';
      nctx.fillRect(hx, ny - 80 - peak, 8, 24 + peak);
      nctx.fillStyle = '#facc15';
      nctx.fillRect(hx + 1, ny - 78 - peak, 6, 22 + peak);
      nctx.fillStyle = '#ef4444';
      nctx.fillRect(hx + 2, ny - 76 - peak, 2, 2); // Ruby eyes
    });
    this.sprites.phaya_naga = naga.canvas;

    // 3. Antique Street Lamp (เสาไฟโบราณริมโขง)
    const streetLamp = createOffscreen(24, 75);
    const lctx = streetLamp.ctx;
    // Cast iron pole
    lctx.fillStyle = '#1c1917';
    lctx.fillRect(10, 18, 4, 56);
    lctx.fillRect(6, 70, 12, 5); // Base
    // Lantern enclosure
    lctx.fillRect(4, 6, 16, 14);
    lctx.fillStyle = '#fef08a'; // Warm amber glow
    lctx.fillRect(6, 8, 12, 10);
    this.sprites.street_lamp = streetLamp.canvas;
  }

  // =========================================================================
  // 6. DRAWING METHODS (CALLED IN GAME LOOP)
  // =========================================================================

  /**
   * Draw the 5-layer Parallax Mekong Riverfront Environment
   */
  drawBackground(ctx, width, height, groundY, distanceRun, frame, spicyTier, feverTimer) {
    // 1. Sky Gradient according to Tier & Fever
    let skyTop = '#fefce8';
    let skyBottom = '#fed7aa';

    if (feverTimer > 0) {
      // Golden Fever Joy
      skyTop = '#fef9c3';
      skyBottom = '#fde047';
    } else if (spicyTier === 4) {
      // Tier 4: Midnight Thunderstorm
      skyTop = '#0f172a';
      skyBottom = '#1e1b4b';
    } else if (spicyTier === 3) {
      // Tier 3: Twilight Indigo
      skyTop = '#1e1b4b';
      skyBottom = '#3730a3';
    } else if (spicyTier === 2) {
      // Tier 2: Golden Amber Sunset
      skyTop = '#ea580c';
      skyBottom = '#fde68a';
    } else {
      // Tier 1: Fresh Mekong Morning
      skyTop = '#e0f2fe';
      skyBottom = '#fef3c7';
    }

    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Occasional lightning flash in Tier 4
    if (spicyTier === 4 && (frame % 180 < 4 || (frame % 230 < 2))) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(0, 0, width, groundY);
    }

    // 2. Celestial Body (Sun / Golden Sunset / Twilight Moon)
    const sunX = width - 75;
    const sunY = 40;
    if (spicyTier >= 3) {
      // Crescent Moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skyTop;
      ctx.beginPath();
      ctx.arc(sunX + 6, sunY - 4, 13, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Neo-Arcade Pixel Sun
      ctx.fillStyle = spicyTier === 2 ? '#ea580c' : '#f59e0b';
      ctx.fillRect(sunX - 16, sunY - 4, 32, 8);
      ctx.fillRect(sunX - 4, sunY - 16, 8, 32);
      ctx.fillRect(sunX - 12, sunY - 12, 24, 24);
      ctx.fillStyle = spicyTier === 2 ? '#fbbf24' : '#fde047';
      ctx.fillRect(sunX - 10, sunY - 10, 20, 20);
    }

    // 3. Clouds (Layer 0 parallax)
    const cloudTint = spicyTier >= 3 ? '#4338ca' : (spicyTier === 2 ? '#fed7aa' : '#ffffff');
    const cloud1X = ((width - ((distanceRun * 0.12) % (width + 160)) + width + 160) % (width + 160)) - 80;
    const cloud2X = ((width - (((distanceRun * 0.12) + 300) % (width + 160)) + width + 160) % (width + 160)) - 80;
    this.drawPixelCloud(ctx, cloud1X, 22, cloudTint, spicyTier);
    this.drawPixelCloud(ctx, cloud2X, 48, cloudTint, spicyTier);

    // 4. Lao Mountain Range (Layer 1 parallax)
    const mountainColor = spicyTier >= 3 ? '#312e81' : (spicyTier === 2 ? '#9a3412' : '#cbd5e1');
    ctx.fillStyle = mountainColor;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 42);
    for (let mx = 0; mx <= width; mx += 25) {
      const peak = Math.sin((mx + distanceRun * 0.15) * 0.015) * 16 + Math.cos((mx + distanceRun * 0.08) * 0.03) * 6;
      ctx.lineTo(mx, groundY - 48 + peak);
    }
    ctx.lineTo(width, groundY - 24);
    ctx.lineTo(0, groundY - 24);
    ctx.closePath();
    ctx.fill();

    // 5. Mekong River & Shimmering Waters (Layer 2 parallax)
    const riverColor = spicyTier >= 3 ? '#0284c7' : (spicyTier === 2 ? '#ea580c' : '#38bdf8');
    ctx.fillStyle = riverColor;
    ctx.fillRect(0, groundY - 32, width, 18);

    // Water wave reflections
    ctx.fillStyle = spicyTier >= 3 ? '#38bdf8' : (spicyTier === 2 ? '#fed7aa' : '#bae6fd');
    const waveShift = (frame * 1.8) % 32;
    for (let wx = -32; wx < width; wx += 32) {
      ctx.fillRect(wx + waveShift, groundY - 28, 16, 2);
      ctx.fillRect(wx - waveShift + 14, groundY - 22, 12, 2);
    }

    // Traditional Long-tail Boat Silhouette
    const boatX = ((width - ((distanceRun * 0.4 + 200) % (width + 200)) + width + 200) % (width + 200)) - 60;
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(boatX, groundY - 28, 22, 5);
    ctx.fillRect(boatX + 18, groundY - 32, 2, 7); // Motor shaft
    ctx.fillRect(boatX + 8, groundY - 33, 4, 6);  // Boat driver
    ctx.fillStyle = '#facc15';
    ctx.fillRect(boatX + 2, groundY - 29, 2, 2); // Lantern glint

    // 6. Landmarks & Street Elements (Layer 3 parallax)
    const scenePeriod = 1600;
    const getPos = (baseX) => {
      const pos = (baseX - (distanceRun * 0.75)) % scenePeriod;
      return ((pos % scenePeriod) + scenePeriod) % scenePeriod - 120;
    };

    // Landmark A: หอนาฬิกาเวียดนามอนุสรณ์
    const clockX = getPos(240);
    if (clockX > -80 && clockX < width + 80 && this.sprites.clock_tower) {
      ctx.drawImage(this.sprites.clock_tower, clockX, groundY - 118);
    }

    // Landmark B: องค์พญาศรีสัตตนาคราช
    const nagaX = getPos(1050);
    if (nagaX > -90 && nagaX < width + 90 && this.sprites.phaya_naga) {
      ctx.drawImage(this.sprites.phaya_naga, nagaX, groundY - 96);
      // Animated Water Fountain Spurt from Naga
      ctx.fillStyle = '#38bdf8';
      const waterDrop = (frame * 3) % 24;
      ctx.fillRect(nagaX - 8 - waterDrop, groundY - 80 + waterDrop * 1.5, 4, 4);
    }

    // Landmark C: Street Lamps (repeating along the promenade)
    for (let lx = 100; lx < scenePeriod; lx += 450) {
      const lampX = getPos(lx);
      if (lampX > -40 && lampX < width + 40 && this.sprites.street_lamp) {
        ctx.drawImage(this.sprites.street_lamp, lampX, groundY - 72);
      }
    }

    // 7. Foreground Paved Promenade with Checker Texture (Layer 4)
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, groundY, width, 3);

    // Stone Paving Colors
    const stoneBg = spicyTier >= 3 ? '#1e293b' : '#78716c';
    const stoneAccent = spicyTier >= 3 ? '#0f172a' : '#57534e';
    ctx.fillStyle = stoneBg;
    ctx.fillRect(0, groundY + 3, width, height - (groundY + 3));

    // Interlocking street tiles
    ctx.fillStyle = stoneAccent;
    const tileShift = (distanceRun * 2.2) % 28;
    for (let tx = -28; tx < width; tx += 28) {
      ctx.fillRect(tx + tileShift, groundY + 3, 14, 12);
      ctx.fillRect(tx + tileShift + 14, groundY + 15, 14, 20);
    }
  }

  drawPixelCloud(ctx, cx, cy, tint, tier) {
    ctx.fillStyle = tier >= 3 ? '#1e1b4b' : '#1c1917';
    ctx.fillRect(cx, cy + 6, 46, 16);
    ctx.fillRect(cx + 8, cy, 30, 24);
    ctx.fillRect(cx + 14, cy - 4, 18, 30);

    ctx.fillStyle = tint;
    ctx.fillRect(cx + 2, cy + 8, 42, 12);
    ctx.fillRect(cx + 10, cy + 2, 26, 20);
    ctx.fillRect(cx + 16, cy - 2, 14, 24);
  }

  /**
   * Draw the Character Sprite with State Matrix
   */
  drawCharacter(ctx, charId, x, y, frame, isGrounded, godModeTimer, feverTimer, scaleX, scaleY) {
    const sheet = this.sprites[charId] || this.sprites.tai_pla;
    if (!sheet) return;

    ctx.save();

    // 1. Ground Contact Shadow
    const shadowScale = Math.max(0.4, 1.0 - (185 - y) / 100);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.beginPath();
    ctx.ellipse(x + 22, 185 + 2, 16 * shadowScale, 4.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. God Mode / Fever Mode Auras & Afterimages
    if (feverTimer > 0) {
      const pulse = Math.sin(frame * 0.4) * 6;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.beginPath();
      ctx.arc(x + 22, y + 22, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (godModeTimer > 0) {
      const pulse = Math.sin(frame * 0.35) * 5;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.40)';
      ctx.beginPath();
      ctx.arc(x + 22, y + 22, 26 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Transform & Squash/Stretch
    ctx.translate(x + 24, y + 24);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-24, -24);

    // Frame selection:
    // [0-3: Run Cycle, 4: Jump]
    let fIdx = 0;
    if (!isGrounded) {
      fIdx = 4; // Air jump frame
    } else {
      fIdx = Math.floor((frame / 4) % 4);
    }

    // Draw frame from pre-baked sheet
    ctx.drawImage(sheet, fIdx * 48, 0, 48, 48, 0, 0, 48, 48);

    ctx.restore();
  }

  /**
   * Draw an Enemy Sprite
   */
  drawEnemy(ctx, mon, frame, groundY) {
    const mx = mon.x;
    let my = mon.y;

    // Type-specific position interpolation
    if (mon.type === 'hop_chili') {
      my = mon.y - Math.abs(Math.sin(frame * 0.12 + (mon.animPhase || 0))) * 24;
    } else if (mon.type === 'hawk') {
      my = mon.y + Math.sin(frame * 0.09 + (mon.animPhase || 0)) * 10;
    }

    // Ground Shadow for grounded enemies
    if (mon.type !== 'hawk' && mon.type !== 'naga_thunder') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(mx + (mon.width / 2), groundY + 2, mon.width * 0.45, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw sprite
    if (mon.type === 'hop_chili' && this.sprites.hop_chili) {
      const f = Math.floor((frame / 6) % 2);
      ctx.drawImage(this.sprites.hop_chili, f * 32, 0, 32, 32, mx, my - 28, 32, 32);
    } else if (mon.type === 'coconut' && this.sprites.coconut) {
      const rot = frame * 0.25;
      ctx.save();
      ctx.translate(mx + 12, my - 12);
      ctx.rotate(rot);
      ctx.drawImage(this.sprites.coconut, -14, -14, 28, 28);
      ctx.restore();
    } else if (mon.type === 'hawk' && this.sprites.hawk) {
      const f = Math.floor((frame / 5) % 2);
      ctx.drawImage(this.sprites.hawk, f * 36, 0, 36, 30, mx, my - 22, 36, 30);
    } else if (mon.type === 'pot_ghost' && this.sprites.pot_ghost) {
      const f = Math.floor((frame / 8) % 2);
      ctx.drawImage(this.sprites.pot_ghost, f * 32, 0, 32, 34, mx, my - 30, 32, 34);
    } else if (mon.type === 'hot_runner' && this.sprites.hot_runner) {
      const f = Math.floor((frame / 4) % 2);
      ctx.drawImage(this.sprites.hot_runner, f * 36, 0, 36, 40, mx, my - 36, 36, 40);
    } else if (mon.type === 'giant_mortar' && this.sprites.giant_mortar) {
      ctx.drawImage(this.sprites.giant_mortar, mx, my - 48, 52, 52);
    } else if (mon.type === 'naga_thunder') {
      this.drawNagaThunder(ctx, mon, frame, groundY);
    }
  }

  drawNagaThunder(ctx, mon, frame, groundY) {
    const tx = mon.x;
    // Telegraph state (flashing column)
    if (mon.isTelegraph) {
      const pulse = Math.abs(Math.sin(frame * 0.3));
      ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.4})`;
      ctx.fillRect(tx - 12, 0, 24, groundY);
      // Warning icon on ground
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⚡ WARNING', tx - 32, groundY - 25);
    } else {
      // Strike active! Sudden vertical bolt
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx - 6, 0, 12, groundY);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(tx - 3, 0, 6, groundY);
      // Ground shock ring
      ctx.fillStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.beginPath();
      ctx.arc(tx, groundY, 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw an Ingredient Item
   */
  drawItem(ctx, item, frame) {
    const bob = Math.sin(frame * 0.1 + (item.bobOffset || 0)) * 4;
    const ix = item.x;
    const iy = item.y + bob;

    // Glowing aura for Satow and Golden Mortar
    if (item.type === 'satow') {
      const aura = Math.sin(frame * 0.25) * 3;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.beginPath();
      ctx.arc(ix + 16, iy + 16, 16 + aura, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'golden_mortar') {
      const aura = Math.sin(frame * 0.3) * 4;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.beginPath();
      ctx.arc(ix + 18, iy + 18, 20 + aura, 0, Math.PI * 2);
      ctx.fill();
    }

    const sprite = this.sprites[item.type] || this.sprites.fish;
    if (sprite) {
      ctx.drawImage(sprite, ix, iy);
    }
  }

  /**
   * Draw Interactive Stage Element (Satow Spring, Steam Vent)
   */
  drawElement(ctx, elem, frame, groundY) {
    if (elem.type === 'satow_spring' && this.sprites.satow_spring) {
      const f = elem.isCompressed ? 1 : 0;
      ctx.drawImage(this.sprites.satow_spring, f * 36, 0, 36, 26, elem.x, groundY - 24, 36, 26);
    } else if (elem.type === 'steam_jet' && this.sprites.steam_vent) {
      ctx.drawImage(this.sprites.steam_vent, elem.x, groundY - 18);
      // Steam Jet Burst
      if (elem.isBursting) {
        const steamH = 75;
        const pulse = Math.sin(frame * 0.5) * 4;
        ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
        ctx.fillRect(elem.x + 8, groundY - 18 - steamH, 12, steamH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(elem.x + 10, groundY - 18 - steamH + 10, 8, steamH - 10 + pulse);
      }
    }
  }
}

export const taiPlaRenderer = new TaiPla128Renderer();
