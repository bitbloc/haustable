/**
 * TaiPla128Renderer.js
 * 128-Bit Neo-Arcade Pixel Art Rendering Engine for Tai-Pla Runner
 * 
 * Aesthetic: Chunky Pochi-Pochi / CozyKumaCo 1-Bit/2-Bit Inspired Styling
 * Theme: Nakhon Phanom Mekong Riverfront x "ในบ้าน" (In The Haus) Signature Identity
 * 
 * Features:
 * - Offscreen pre-baked sprite sheets for silky smooth 60fps mobile performance
 * - Handcrafted "ในบ้าน" Pixel Art Logo Engine (Title Marquee, Cafe Signboard, HUD Badge)
 * - "ในบ้าน" Riverside Heritage Cafe Landmark in Parallax Scenery (Layer 3)
 * - 3 Playable Characters (Tai Pla, Som Satow, Khao Lam) with chunky 2px outlines, sparkling catchlight eyes, and squishy bouncy run/jump frames
 * - 7 Dynamic Hazards (Hop Chili, Coconut, Hawk, Pot Ghost, Hot Runner, Naga Thunder, Giant Mortar)
 * - 3 Interactive Stage Elements (Satow Spring Pad, Steam Jet Vent, Golden Mortar Bonus)
 * - 5-Layer Mekong Parallax (Dynamic Tier Sky, Mountains, River & Longtails, Landmarks, Promenade)
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
    this.bakeLogos();
    this.bakeCharacters();
    this.bakeIngredients();
    this.bakeEnemies();
    this.bakeInteractiveElements();
    this.bakeLandmarks();
    this.isReady = true;
  }

  // =========================================================================
  // 1. "ในบ้าน" (IN THE HAUS) PIXEL ART LOGO ENGINE
  // =========================================================================
  bakeLogos() {
    // A. Large Title Marquee Logo (260x70) for Start Screen & Game Over
    const titleLogo = createOffscreen(260, 70);
    const tctx = titleLogo.ctx;

    // Background Badge Box with 2px ink border
    tctx.fillStyle = '#181615'; // Dark ink outline
    tctx.fillRect(4, 4, 252, 62);
    tctx.fillStyle = '#faf7f5'; // Warm paper cream
    tctx.fillRect(6, 6, 248, 58);

    // Terracotta accent corner tags
    tctx.fillStyle = '#bd4924';
    tctx.fillRect(6, 6, 6, 6);
    tctx.fillRect(248, 6, 6, 6);
    tctx.fillRect(6, 58, 6, 6);
    tctx.fillRect(248, 58, 6, 6);

    // Left Icon: Mini Pixel Art House & Steaming Coffee/Curry Cup
    this.drawPixelHouseIcon(tctx, 16, 15);

    // Main Thai Calligraphy "ในบ้าน"
    this.drawPixelNoiBaanText(tctx, 58, 12, 1.35, '#fef08a', '#bd4924', '#181615');

    // Subtitle: "IN THE HAUS // ARCADE"
    tctx.fillStyle = '#181615';
    tctx.font = 'bold 9px monospace';
    tctx.fillText('IN THE HAUS • นครพนม ARCADE', 60, 56);

    this.sprites.logo_in_the_haus = titleLogo.canvas;

    // B. Compact Square Pixel Badge (40x40) for HUD & slip receipts
    const badge = createOffscreen(40, 40);
    const bctx = badge.ctx;
    bctx.fillStyle = '#181615';
    bctx.fillRect(2, 2, 36, 36);
    bctx.fillStyle = '#bd4924'; // Red terracotta body
    bctx.fillRect(4, 4, 32, 32);

    // Two Haus Roman pillars "II" in deep terracotta
    bctx.fillStyle = '#993517';
    bctx.fillRect(8, 7, 8, 26);
    bctx.fillRect(24, 7, 8, 26);

    // White block letters "IN"
    bctx.fillStyle = '#ffffff';
    // "I" block with square cut
    bctx.fillRect(8, 14, 10, 12);
    bctx.fillStyle = '#bd4924';
    bctx.fillRect(11, 17, 4, 6);
    // "N" block
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(21, 14, 11, 12);
    bctx.fillStyle = '#bd4924';
    bctx.fillRect(25, 14, 3, 7);
    bctx.fillRect(24, 19, 4, 7);

    this.sprites.logo_badge = badge.canvas;
  }

  // Draw pixel art mini house / cup icon
  drawPixelHouseIcon(ctx, x, y) {
    // House roof (triangle)
    ctx.fillStyle = '#181615';
    ctx.fillRect(x + 12, y, 6, 3);
    ctx.fillRect(x + 9, y + 3, 12, 3);
    ctx.fillRect(x + 6, y + 6, 18, 3);
    ctx.fillRect(x + 3, y + 9, 24, 3);
    ctx.fillRect(x, y + 12, 30, 4);

    ctx.fillStyle = '#bd4924'; // Terracotta roof
    ctx.fillRect(x + 13, y + 1, 4, 2);
    ctx.fillRect(x + 10, y + 4, 10, 2);
    ctx.fillRect(x + 7, y + 7, 16, 2);
    ctx.fillRect(x + 4, y + 10, 22, 2);
    ctx.fillRect(x + 2, y + 13, 26, 2);

    // House walls
    ctx.fillStyle = '#181615';
    ctx.fillRect(x + 3, y + 16, 24, 18);
    ctx.fillStyle = '#fef08a'; // Warm glowing cafe wall
    ctx.fillRect(x + 5, y + 17, 20, 15);

    // Door & window
    ctx.fillStyle = '#181615';
    ctx.fillRect(x + 12, y + 21, 7, 11);
    ctx.fillStyle = '#43634b'; // Olive banana-leaf door
    ctx.fillRect(x + 13, y + 22, 5, 10);
    ctx.fillStyle = '#facc15'; // Brass doorknob
    ctx.fillRect(x + 16, y + 27, 2, 2);

    // Warm lit window
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 6, y + 21, 4, 5);
    ctx.fillRect(x + 21, y + 21, 4, 5);

    // Heart chimney steam
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(x + 21, y - 5, 4, 3);
    ctx.fillRect(x + 20, y - 3, 6, 3);
    ctx.fillRect(x + 22, y, 2, 2);
  }

  /**
   * Handcrafted Thai Calligraphy Pixel Art: "ในบ้าน"
   */
  drawPixelNoiBaanText(ctx, baseX, baseY, scale = 1, fillColor = '#fef08a', shadowColor = '#bd4924', outlineColor = '#181615') {
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    // Letter 1: ใ (Sara Ai Mai Muan)
    this.renderPixelGlyph(ctx, 0, 0, [
      "....####....",
      "...##..##...",
      "..##....##..",
      "..##....##..",
      "..##....##..",
      "...##..##...",
      "....####....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      "....####....",
      "...##..##...",
      "...##..##...",
      "....####...."
    ], fillColor, shadowColor, outlineColor);

    // Letter 2: น (Nor Nu 1)
    this.renderPixelGlyph(ctx, 16, 8, [
      "####........",
      "##.##..####.",
      "##.##..##.##",
      "####...##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.######.##",
      "####..#####."
    ], fillColor, shadowColor, outlineColor);

    // Letter 3: บ (Bor Baimai) + ไม้โท (Mai Tho)
    // Mai Tho accent on top
    this.renderPixelGlyph(ctx, 35, 1, [
      "...####.",
      "..##..##",
      "....####",
      "...##...",
      "..####.."
    ], '#ef4444', shadowColor, outlineColor);

    // Bor Baimai body
    this.renderPixelGlyph(ctx, 34, 8, [
      "####...####.",
      "##.##..##.##",
      "##.##..##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "###########.",
      "###########."
    ], fillColor, shadowColor, outlineColor);

    // Letter 4: า (Sara Aa)
    this.renderPixelGlyph(ctx, 52, 8, [
      ".#####......",
      "##...##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".....##....."
    ], fillColor, shadowColor, outlineColor);

    // Letter 5: น (Nor Nu 2)
    this.renderPixelGlyph(ctx, 64, 8, [
      "####........",
      "##.##..####.",
      "##.##..##.##",
      "####...##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.....##.##",
      "##.######.##",
      "####..#####."
    ], fillColor, shadowColor, outlineColor);

    ctx.restore();
  }

  renderPixelGlyph(ctx, gx, gy, matrix, fillC, shadowC, outlineC) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    // Pass 1: Drop Shadow
    ctx.fillStyle = shadowC;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === '#') {
          ctx.fillRect(gx + c + 1, gy + r + 2, 1, 1);
        }
      }
    }

    // Pass 2: Dark Ink Outline (Dilated)
    ctx.fillStyle = outlineC;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === '#') {
          ctx.fillRect(gx + c - 1, gy + r, 3, 1);
          ctx.fillRect(gx + c, gy + r - 1, 1, 3);
        }
      }
    }

    // Pass 3: Warm Cream / Golden Fill
    ctx.fillStyle = fillC;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === '#') {
          ctx.fillRect(gx + c, gy + r, 1, 1);
        }
      }
    }
  }

  // =========================================================================
  // 2. CHUNKY POCHI-POCHI CHARACTER SPRITES (48x48 per frame)
  // =========================================================================
  bakeCharacters() {
    // A. น้องไตปลา (Tai Pla) - Chunky Calico Kitten with Indigo Apron & "ในบ้าน" badge
    this.sprites.tai_pla = this.createPochiCharacterSheet({
      baseColor: '#faf7f5',      // Warm paper cream
      patchColor1: '#bd4924',    // Terracotta orange
      patchColor2: '#181615',    // Charcoal dark ink
      earInner: '#fca5a5',       // Soft pink
      apronColor: '#1e3a8a',     // Traditional Thai Indigo (หม้อห้อม)
      apronTrim: '#60a5fa',      // Cyan trim
      blushColor: '#fca5a5',     // Rosy cheeks
      isCat: true
    });

    // B. พี่ส้มสตอ (Som Satow) - Burly Ginger Tabby with Chef Bandana & Wooden Ladle
    this.sprites.som_satow = this.createPochiCharacterSheet({
      baseColor: '#ea580c',      // Rich ginger orange
      patchColor1: '#9a3412',    // Tiger stripes
      patchColor2: '#fff7ed',    // White muzzle & belly
      earInner: '#fca5a5',
      apronColor: '#43634b',     // Banana leaf green bandana
      apronTrim: '#86efac',
      blushColor: '#fca5a5',
      hasLadle: true,
      isCat: true
    });

    // C. เจ้าตูบข้าวหลาม (Khao Lam) - Adorable Golden Thai Countryside Dog
    this.sprites.khao_lam = this.createPochiCharacterSheet({
      baseColor: '#d97706',      // Golden Thai dog coat
      patchColor1: '#78350f',    // Dark brown floppy ears
      patchColor2: '#fef08a',    // Cream muzzle & chest
      earInner: '#fca5a5',
      apronColor: '#dc2626',     // Red braided good-luck collar
      apronTrim: '#facc15',      // Brass bell
      blushColor: '#fca5a5',
      isDog: true
    });
  }

  createPochiCharacterSheet(config) {
    // 6 frames: [0: Run1, 1: Run2, 2: Run3, 3: Run4, 4: Jump, 5: Hurt]
    const frameW = 48;
    const frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      this.drawPochiFrame(ctx, f, config);
      ctx.restore();
    }

    return canvas;
  }

  /**
   * Chunky Pochi-Pochi / Tamagotchi Styled Frame Renderer
   */
  drawPochiFrame(ctx, frameIdx, cfg) {
    const isJump = frameIdx === 4;
    const isHurt = frameIdx === 5;
    const runPhase = frameIdx % 4;

    // Squishy Bouncy Offset
    const bob = isJump ? -4 : (runPhase === 1 || runPhase === 3 ? -3 : 0);

    // 1. Ladle for Som Satow
    if (cfg.hasLadle) {
      ctx.save();
      const ladleAngle = isJump ? -0.3 : (runPhase === 1 ? 0.2 : 0);
      ctx.translate(18, 18 + bob);
      ctx.rotate(ladleAngle);
      // Dark 2px outline
      ctx.fillStyle = '#181615';
      ctx.fillRect(-15, -15, 18, 5);
      ctx.fillRect(-19, -19, 7, 9);
      // Wooden fill
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-14, -14, 16, 3);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-18, -18, 5, 7);
      ctx.restore();
    }

    // 2. Tail (Bouncing / Wagging)
    ctx.save();
    if (cfg.isDog) {
      const wag = isJump ? 4 : (runPhase === 0 || runPhase === 2 ? 3 : -2);
      ctx.fillStyle = '#181615';
      ctx.fillRect(7, 21 + bob + wag, 7, 7);
      ctx.fillRect(3, 17 + bob + wag, 7, 7);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(8, 22 + bob + wag, 5, 5);
      ctx.fillRect(4, 18 + bob + wag, 5, 5);
      ctx.fillStyle = cfg.patchColor2; // White tail tip
      ctx.fillRect(4, 18 + bob + wag, 3, 3);
    } else {
      const wag = isJump ? -5 : (runPhase === 0 ? 3 : -2);
      ctx.fillStyle = '#181615';
      ctx.fillRect(6, 23 + bob, 5, 5);
      ctx.fillRect(2, 19 + bob + wag, 5, 7);
      ctx.fillRect(1, 13 + bob + wag, 5, 9);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(7, 24 + bob, 3, 3);
      ctx.fillRect(3, 20 + bob + wag, 3, 5);
      ctx.fillRect(2, 14 + bob + wag, 3, 7);
      if (cfg.patchColor1) {
        ctx.fillStyle = cfg.patchColor1;
        ctx.fillRect(2, 16 + bob + wag, 3, 3);
      }
    }
    ctx.restore();

    // 3. Back Paws (Squishy Chunky Paws)
    ctx.fillStyle = '#181615';
    if (isJump) {
      ctx.fillRect(9, 35, 7, 9);
      ctx.fillRect(5, 40, 9, 5);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(10, 36, 5, 7);
      ctx.fillRect(6, 41, 7, 3);
    } else if (isHurt) {
      ctx.fillRect(7, 37, 9, 7);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(8, 38, 7, 5);
    } else {
      const bLegX = runPhase === 0 ? 7 : (runPhase === 1 ? 11 : (runPhase === 2 ? 16 : 9));
      const bLegH = runPhase === 1 ? 6 : 9;
      ctx.fillRect(bLegX, 35 + bob, 7, bLegH);
      ctx.fillRect(bLegX - 2, 35 + bob + bLegH - 2, 7, 4);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(bLegX + 1, 36 + bob, 5, bLegH - 2);
      ctx.fillRect(bLegX - 1, 35 + bob + bLegH - 1, 5, 2);
    }

    // 4. Chunky Round Body (Chibi Proportions)
    ctx.fillStyle = '#181615'; // 2px Dark Outline
    ctx.fillRect(11, 17 + bob, 24, 20);
    ctx.fillRect(9, 19 + bob, 28, 16);
    ctx.fillRect(13, 15 + bob, 20, 24);

    // Body Fill
    ctx.fillStyle = cfg.baseColor;
    ctx.fillRect(12, 18 + bob, 22, 18);
    ctx.fillRect(10, 20 + bob, 26, 14);

    // Patches / Stripes
    if (cfg.patchColor1) {
      ctx.fillStyle = cfg.patchColor1;
      ctx.fillRect(12, 18 + bob, 9, 9);
      ctx.fillRect(20, 24 + bob, 7, 7);
    }
    if (cfg.patchColor2) {
      ctx.fillStyle = cfg.patchColor2;
      ctx.fillRect(23, 18 + bob, 9, 7);
      ctx.fillRect(15, 28 + bob, 14, 6); // Underbelly
    }

    // 5. Chef Apron / Collar with Mini "ในบ้าน" Emblem
    ctx.fillStyle = '#181615';
    ctx.fillRect(20, 22 + bob, 14, 15);
    ctx.fillStyle = cfg.apronColor;
    ctx.fillRect(21, 23 + bob, 12, 13);
    ctx.fillStyle = cfg.apronTrim;
    ctx.fillRect(22, 24 + bob, 10, 2); // Gold/Cyan trim
    // Mini "ในบ้าน" red square pixel badge on apron
    ctx.fillStyle = '#bd4924';
    ctx.fillRect(24, 27 + bob, 5, 5);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(25, 28 + bob, 3, 3); // Gold Haus mark

    // 6. Front Paws
    ctx.fillStyle = '#181615';
    if (isJump) {
      ctx.fillRect(27, 31, 7, 11);
      ctx.fillRect(30, 40, 7, 5);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(28, 32, 5, 9);
      ctx.fillRect(31, 41, 5, 3);
    } else if (isHurt) {
      ctx.fillRect(27, 35, 9, 7);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(28, 36, 7, 5);
    } else {
      const fLegX = runPhase === 0 ? 27 : (runPhase === 1 ? 23 : (runPhase === 2 ? 19 : 26));
      const fLegH = runPhase === 3 ? 6 : 9;
      ctx.fillRect(fLegX, 35 + bob, 7, fLegH);
      ctx.fillRect(fLegX + 2, 35 + bob + fLegH - 2, 7, 4);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(fLegX + 1, 36 + bob, 5, fLegH - 2);
      ctx.fillRect(fLegX + 3, 35 + bob + fLegH - 1, 5, 2);
    }

    // 7. Large Rounded Chibi Head & Ears
    const headX = 24;
    const headY = 9 + bob;

    ctx.fillStyle = '#181615';
    ctx.fillRect(headX - 1, headY - 1, 22, 18);
    ctx.fillRect(headX - 3, headY + 2, 26, 13);
    ctx.fillRect(headX + 1, headY - 3, 18, 22);

    // Ears
    if (cfg.isDog) {
      // Floppy brown puppy ears
      ctx.fillRect(headX - 5, headY + 1, 7, 11);
      ctx.fillRect(headX + 18, headY + 1, 7, 11);
      ctx.fillStyle = cfg.patchColor1;
      ctx.fillRect(headX - 4, headY + 2, 5, 9);
      ctx.fillRect(headX + 19, headY + 2, 5, 9);
    } else {
      // Perky Cat Ears
      ctx.fillRect(headX + 1, headY - 7, 7, 9);
      ctx.fillRect(headX + 12, headY - 7, 7, 9);
      ctx.fillStyle = cfg.baseColor;
      ctx.fillRect(headX + 2, headY - 6, 5, 7);
      ctx.fillRect(headX + 13, headY - 6, 5, 7);
      ctx.fillStyle = cfg.earInner;
      ctx.fillRect(headX + 3, headY - 4, 3, 4);
      ctx.fillRect(headX + 14, headY - 4, 3, 4);
    }

    // Face Fill
    ctx.fillStyle = cfg.baseColor;
    ctx.fillRect(headX, headY, 20, 16);
    ctx.fillRect(headX - 2, headY + 3, 24, 11);

    // Calico face spot
    if (cfg.patchColor1) {
      ctx.fillStyle = cfg.patchColor1;
      ctx.fillRect(headX, headY, 8, 8);
    }

    // 8. Big Sparkly Eyes (Pochi-Pochi Iconic Look)
    if (isHurt) {
      // Comical dizzy swirl eyes
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(headX + 6, headY + 4, 4, 4);
      ctx.fillRect(headX + 13, headY + 4, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 7, headY + 5, 2, 2);
      ctx.fillRect(headX + 14, headY + 5, 2, 2);
    } else {
      // Big round anime/tamagotchi eyes with catchlights
      ctx.fillStyle = '#181615';
      ctx.fillRect(headX + 5, headY + 4, 5, 7);
      ctx.fillRect(headX + 13, headY + 4, 5, 7);
      // Large primary catchlight (2x2 white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 6, headY + 5, 2, 2);
      ctx.fillRect(headX + 14, headY + 5, 2, 2);
      // Secondary twinkle catchlight (1x1 white)
      ctx.fillRect(headX + 7, headY + 8, 2, 1);
      ctx.fillRect(headX + 15, headY + 8, 2, 1);
    }

    // Rosy Blush Cheeks (Pochi Signature Charm)
    ctx.fillStyle = cfg.blushColor || '#fca5a5';
    ctx.fillRect(headX + 2, headY + 10, 4, 2);
    ctx.fillRect(headX + 17, headY + 10, 4, 2);

    // Tiny Cute Mouth / Nose
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(headX + 10, headY + 9, 3, 2); // Nose
    ctx.fillStyle = '#181615';
    ctx.fillRect(headX + 10, headY + 12, 1, 1); // Cute :3 mouth
    ctx.fillRect(headX + 12, headY + 12, 1, 1);

    // Cat Whiskers
    if (cfg.isCat && !isHurt) {
      ctx.fillStyle = '#181615';
      ctx.fillRect(headX - 4, headY + 9, 4, 1);
      ctx.fillRect(headX - 3, headY + 12, 4, 1);
      ctx.fillRect(headX + 19, headY + 9, 4, 1);
      ctx.fillRect(headX + 18, headY + 12, 4, 1);
    }
  }

  // =========================================================================
  // 3. INGREDIENTS & REWARD ITEMS (32x32 CHUNKY CHARMS)
  // =========================================================================
  bakeIngredients() {
    // 1. ปลาทูแม่กลอง (Chubby Mackerel Charm)
    const fish = createOffscreen(32, 32);
    const fctx = fish.ctx;
    // 2px Dark ink outline
    fctx.fillStyle = '#181615';
    fctx.fillRect(5, 11, 20, 12);
    fctx.fillRect(23, 9, 7, 16);
    fctx.fillRect(2, 14, 6, 5); // Mouth
    // Blue iridescent body
    fctx.fillStyle = '#0284c7';
    fctx.fillRect(7, 12, 16, 5);
    fctx.fillStyle = '#38bdf8';
    fctx.fillRect(7, 17, 16, 4);
    fctx.fillStyle = '#f0f9ff'; // Cream belly
    fctx.fillRect(7, 21, 16, 2);
    // Yellow tail fin
    fctx.fillStyle = '#f59e0b';
    fctx.fillRect(25, 10, 4, 14);
    // Big round cute eye
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(5, 13, 4, 4);
    fctx.fillStyle = '#181615';
    fctx.fillRect(7, 14, 2, 2);
    this.sprites.fish = fish.canvas;

    // 2. เมล็ดสะตอ (Satow Bean Charm)
    const satow = createOffscreen(32, 32);
    const sctx = satow.ctx;
    sctx.fillStyle = '#181615';
    sctx.fillRect(5, 7, 22, 18);
    sctx.fillRect(7, 5, 18, 22);
    // Jade Green Body
    sctx.fillStyle = '#15803d';
    sctx.fillRect(7, 7, 18, 18);
    sctx.fillStyle = '#22c55e';
    sctx.fillRect(9, 9, 14, 13);
    sctx.fillStyle = '#86efac';
    sctx.fillRect(11, 10, 5, 4); // Glossy highlight
    sctx.fillRect(18, 15, 4, 4);
    this.sprites.satow = satow.canvas;

    // 3. หน่อไม้ต้ม (Bamboo Shoot Charm)
    const bamboo = createOffscreen(32, 32);
    const bctx = bamboo.ctx;
    bctx.fillStyle = '#181615';
    bctx.fillRect(11, 5, 10, 7);
    bctx.fillRect(8, 10, 16, 9);
    bctx.fillRect(5, 17, 22, 11);
    // Yellow tiers
    bctx.fillStyle = '#fef08a';
    bctx.fillRect(12, 6, 8, 5);
    bctx.fillStyle = '#fde047';
    bctx.fillRect(9, 11, 14, 7);
    bctx.fillStyle = '#eab308';
    bctx.fillRect(6, 18, 20, 9);
    bctx.fillStyle = '#a16207';
    bctx.fillRect(8, 22, 16, 2); // Texture ring
    this.sprites.bamboo = bamboo.canvas;

    // 4. ครกหินทองคำ (Golden Stone Mortar) - Secret Tier 4 Bonus!
    const goldMortar = createOffscreen(36, 36);
    const gmctx = goldMortar.ctx;
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(5, 11, 26, 20);
    gmctx.fillRect(8, 7, 20, 7); // Rim
    gmctx.fillRect(15, 1, 8, 14); // Pestle handle
    // Shimmering Gold
    gmctx.fillStyle = '#facc15';
    gmctx.fillRect(7, 13, 22, 16);
    gmctx.fillRect(9, 8, 18, 5);
    gmctx.fillStyle = '#fef08a';
    gmctx.fillRect(9, 10, 9, 3); // Highlight
    gmctx.fillRect(16, 2, 5, 11); // Pestle gold
    gmctx.fillStyle = '#b45309';
    gmctx.fillRect(9, 24, 18, 4); // Base shadow
    this.sprites.golden_mortar = goldMortar.canvas;
  }

  // =========================================================================
  // 4. CHUNKY ENEMY HAZARDS (7 TYPES - POCHI-POCHI STYLING)
  // =========================================================================
  bakeEnemies() {
    // 1. hop_chili (พริกขี้หนูกระโดด) - 2 frames
    const hopChili = createOffscreen(32 * 2, 32);
    const hctx = hopChili.ctx;
    for (let f = 0; f < 2; f++) {
      hctx.save();
      hctx.translate(f * 32, 0);
      // Green Leaf Stem
      hctx.fillStyle = '#15803d';
      hctx.fillRect(12, 3, 8, 6);
      hctx.fillRect(10, 7, 12, 4);
      // Red Chili Body (2px dark ink outline)
      hctx.fillStyle = '#181615';
      hctx.fillRect(7, 9, 18, 18);
      hctx.fillRect(10, 24, 12, 6);
      hctx.fillRect(12, 28, 8, 3);
      hctx.fillStyle = '#dc2626';
      hctx.fillRect(8, 10, 16, 16);
      hctx.fillRect(11, 24, 10, 5);
      hctx.fillStyle = '#ef4444';
      hctx.fillRect(9, 11, 5, 11); // Highlight shine
      // Cute Angry Eyes
      hctx.fillStyle = '#ffffff';
      hctx.fillRect(9, 14, 5, 5);
      hctx.fillRect(17, 14, 5, 5);
      hctx.fillStyle = '#181615';
      hctx.fillRect(11, 15, 3, 4);
      hctx.fillRect(19, 15, 3, 4);
      // Warrior Yellow Headband
      hctx.fillStyle = '#facc15';
      hctx.fillRect(7, 12, 18, 2);
      // Cute Paws/Sneakers
      const footSpread = f === 0 ? 0 : 3;
      hctx.fillStyle = '#181615';
      hctx.fillRect(8 - footSpread, 28, 5, 4);
      hctx.fillRect(18 + footSpread, 28, 5, 4);
      hctx.restore();
    }
    this.sprites.hop_chili = hopChili.canvas;

    // 2. coconut (ลูกมะพร้าวกลิ้ง)
    const coconut = createOffscreen(28, 28);
    const cctx = coconut.ctx;
    cctx.fillStyle = '#181615';
    cctx.beginPath();
    cctx.arc(14, 14, 13, 0, Math.PI * 2);
    cctx.fill();
    cctx.fillStyle = '#78350f';
    cctx.beginPath();
    cctx.arc(14, 14, 11, 0, Math.PI * 2);
    cctx.fill();
    // 3 Funny Face Holes (o_O expression)
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, 8, 3, 3);
    cctx.fillRect(17, 8, 3, 3);
    cctx.fillRect(12, 16, 4, 3);
    this.sprites.coconut = coconut.canvas;

    // 3. hawk (เหยี่ยวแม่น้ำโขง) - 2 frames (wing flap)
    const hawk = createOffscreen(36 * 2, 30);
    const hwctx = hawk.ctx;
    for (let f = 0; f < 2; f++) {
      hwctx.save();
      hwctx.translate(f * 36, 0);
      const wingY = f === 0 ? 3 : 13;
      // Wings
      hwctx.fillStyle = '#181615';
      hwctx.fillRect(9, wingY, 20, 9);
      hwctx.fillStyle = '#78350f';
      hwctx.fillRect(10, wingY + 1, 18, 7);
      // Body
      hwctx.fillStyle = '#181615';
      hwctx.fillRect(7, 11, 22, 14);
      hwctx.fillStyle = '#451a03';
      hwctx.fillRect(8, 12, 20, 12);
      // White Feathered Head & Hooked Golden Beak
      hwctx.fillStyle = '#ffffff';
      hwctx.fillRect(3, 10, 9, 9);
      hwctx.fillStyle = '#facc15';
      hwctx.fillRect(0, 13, 6, 5);
      // Cute Round Fierce Eye
      hwctx.fillStyle = '#dc2626';
      hwctx.fillRect(5, 12, 4, 4);
      hwctx.fillStyle = '#ffffff';
      hwctx.fillRect(6, 13, 2, 2);
      hwctx.restore();
    }
    this.sprites.hawk = hawk.canvas;

    // 4. pot_ghost (ผีหม้อดิน) - Clay pot popping lid open
    const potGhost = createOffscreen(32 * 2, 34);
    const pgctx = potGhost.ctx;
    for (let f = 0; f < 2; f++) {
      pgctx.save();
      pgctx.translate(f * 32, 0);
      const lidLift = f === 0 ? 0 : 8;
      // Pot Body
      pgctx.fillStyle = '#181615';
      pgctx.fillRect(5, 15, 22, 18);
      pgctx.fillRect(3, 18, 26, 12);
      pgctx.fillStyle = '#b45309';
      pgctx.fillRect(6, 16, 20, 16);
      pgctx.fillRect(4, 19, 24, 10);
      // Red spicy foam & Glowing ghost eyes inside pot
      pgctx.fillStyle = '#ea580c';
      pgctx.fillRect(7, 16, 18, 5);
      pgctx.fillStyle = '#facc15';
      pgctx.fillRect(9, 17, 3, 3);
      pgctx.fillRect(18, 17, 3, 3);
      // Earthen Lid
      pgctx.fillStyle = '#181615';
      pgctx.fillRect(3, 11 - lidLift, 26, 7);
      pgctx.fillRect(11, 7 - lidLift, 9, 6);
      pgctx.fillStyle = '#92400e';
      pgctx.fillRect(4, 12 - lidLift, 24, 5);
      pgctx.fillRect(12, 8 - lidLift, 7, 4);
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
      hrctx.fillRect(9, 3, 16, 9);
      hrctx.fillStyle = '#ef4444';
      hrctx.fillRect(11, 0, 12, 6);
      hrctx.fillStyle = '#fef08a';
      hrctx.fillRect(13, 5, 8, 5);
      // Head & Angry Face
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(9, 10, 16, 14);
      hrctx.fillStyle = '#fed7aa';
      hrctx.fillRect(10, 11, 14, 12);
      // Angry slanted brow & eyes
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(12, 13, 3, 3);
      hrctx.fillRect(19, 13, 3, 3);
      // Body & Red Chef Uniform
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(7, 21, 20, 14);
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(8, 22, 18, 12);
      // Wok in hand
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(24, 23, 11, 7);
      hrctx.fillRect(29, 19, 2, 7);
      hrctx.fillStyle = '#f97316';
      hrctx.fillRect(25, 24, 9, 4); // Fiery stir fry!
      // Running Legs
      const legRun = f === 0 ? 0 : 5;
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(8 + legRun, 34, 6, 6);
      hrctx.fillRect(18 - legRun, 34, 6, 6);
      hrctx.restore();
    }
    this.sprites.hot_runner = hotRunner.canvas;

    // 6. giant_mortar (ครกหินยักษ์ทุบพื้น) - Elite Tier 4 Hazard
    const giantMortar = createOffscreen(52, 52);
    const gmctx = giantMortar.ctx;
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(7, 19, 38, 32);
    gmctx.fillRect(11, 13, 30, 9); // Rim
    gmctx.fillRect(21, 1, 10, 22);  // Huge pestle
    // Textured Granite Grey
    gmctx.fillStyle = '#64748b';
    gmctx.fillRect(9, 21, 34, 28);
    gmctx.fillRect(13, 15, 26, 7);
    gmctx.fillStyle = '#475569';
    gmctx.fillRect(11, 35, 30, 12);
    gmctx.fillStyle = '#94a3b8';
    gmctx.fillRect(13, 16, 12, 3); // Rim highlight
    // Grumpy Stone Face Carving!
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(18, 25, 4, 3); // Eye L
    gmctx.fillRect(30, 25, 4, 3); // Eye R
    gmctx.fillRect(22, 31, 8, 2); // Mouth
    // Pestle wood/stone
    gmctx.fillStyle = '#78350f';
    gmctx.fillRect(23, 3, 6, 20);
    this.sprites.giant_mortar = giantMortar.canvas;
  }

  // =========================================================================
  // 5. INTERACTIVE STAGE ELEMENTS
  // =========================================================================
  bakeInteractiveElements() {
    // 1. satow_spring (กระดานสปริงฝักสะตอ)
    const springPad = createOffscreen(36 * 2, 26);
    const spctx = springPad.ctx;
    for (let f = 0; f < 2; f++) {
      spctx.save();
      spctx.translate(f * 36, 0);
      const compress = f === 1 ? 5 : 0;
      // Metal Base Plate
      spctx.fillStyle = '#181615';
      spctx.fillRect(3, 21, 30, 5);
      spctx.fillStyle = '#94a3b8';
      spctx.fillRect(5, 22, 26, 3);
      // Steel Coil Spring
      spctx.fillStyle = '#181615';
      spctx.fillRect(14, 13 + compress, 8, 9 - compress);
      spctx.fillStyle = '#cbd5e1';
      spctx.fillRect(15, 14 + compress, 6, 7 - compress);
      // Giant Curved Satow Pod Pad
      spctx.fillStyle = '#181615';
      spctx.fillRect(1, 5 + compress, 34, 9);
      spctx.fillRect(5, 3 + compress, 26, 13);
      spctx.fillStyle = '#15803d';
      spctx.fillRect(2, 6 + compress, 32, 7);
      spctx.fillRect(6, 4 + compress, 24, 11);
      spctx.fillStyle = '#86efac';
      spctx.fillRect(9, 5 + compress, 18, 3); // Yellow-green shine
      spctx.restore();
    }
    this.sprites.satow_spring = springPad.canvas;

    // 2. steam_jet (ท่อไอน้ำแกงไตปลาพวยพุ่ง)
    const steamVent = createOffscreen(28, 20);
    const svctx = steamVent.ctx;
    svctx.fillStyle = '#181615';
    svctx.fillRect(3, 9, 22, 11);
    svctx.fillRect(1, 5, 26, 6); // Grate lip
    svctx.fillStyle = '#b45309'; // Antique bronze
    svctx.fillRect(4, 10, 20, 9);
    svctx.fillStyle = '#f59e0b';
    svctx.fillRect(3, 6, 22, 4);
    this.sprites.steam_vent = steamVent.canvas;
  }

  // =========================================================================
  // 6. LANDMARKS & "ในบ้าน" RIVERSIDE CAFE (LAYER 3 PARALLAX)
  // =========================================================================
  bakeLandmarks() {
    // 1. "ในบ้าน" (In The Haus) Riverside Heritage Cafe Landmark (140x110)
    const cafe = createOffscreen(140, 110);
    const cctx = cafe.ctx;
    const cy = 100;

    // Main 2-Story Building Foundation & Walls
    cctx.fillStyle = '#181615';
    cctx.fillRect(10, cy - 85, 120, 85);
    cctx.fillStyle = '#faf7f5'; // Warm cream facade
    cctx.fillRect(12, cy - 83, 116, 81);

    // Terracotta Base Bricks
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(12, cy - 18, 116, 18);

    // Warm Lit Glass Shopfront Window
    cctx.fillStyle = '#181615';
    cctx.fillRect(20, cy - 50, 48, 30);
    cctx.fillStyle = '#fef08a'; // Warm amber interior light
    cctx.fillRect(22, cy - 48, 44, 26);
    // Silhouette of Cat Barista Inside
    cctx.fillStyle = '#181615';
    cctx.fillRect(38, cy - 40, 12, 16);
    cctx.fillRect(40, cy - 44, 8, 6); // Chef hat

    // Wooden Cafe Door with Brass Handle
    cctx.fillStyle = '#181615';
    cctx.fillRect(78, cy - 54, 26, 52);
    cctx.fillStyle = '#43634b'; // Olive banana-leaf door
    cctx.fillRect(80, cy - 52, 22, 50);
    cctx.fillStyle = '#facc15'; // Brass doorknob
    cctx.fillRect(96, cy - 28, 3, 3);

    // Striped Awning (Terracotta & Olive Green)
    const awningY = cy - 56;
    cctx.fillStyle = '#181615';
    cctx.fillRect(14, awningY - 4, 112, 14);
    for (let ax = 16; ax < 124; ax += 12) {
      cctx.fillStyle = ((ax / 12) % 2 === 0) ? '#bd4924' : '#43634b';
      cctx.fillRect(ax, awningY - 3, 11, 11);
    }

    // Handcrafted Hanging Signboard with "ในบ้าน"
    cctx.fillStyle = '#181615';
    cctx.fillRect(22, cy - 78, 70, 20);
    cctx.fillStyle = '#fef08a'; // Warm yellow board
    cctx.fillRect(24, cy - 76, 66, 16);
    // Mini Pixel Thai Text "ในบ้าน"
    this.drawPixelNoiBaanText(cctx, 28, cy - 74, 0.7, '#181615', '#bd4924', '#181615');

    // Roof Clay Shingles & Chimney
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, cy - 94, 124, 11);
    cctx.fillRect(110, cy - 104, 12, 12); // Chimney
    cctx.fillStyle = '#ea580c';
    cctx.fillRect(10, cy - 93, 120, 9);
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(112, cy - 103, 8, 10);

    // Cute Calico Cat Napping on the Cafe Roof!
    cctx.fillStyle = '#181615';
    cctx.fillRect(50, cy - 100, 16, 9);
    cctx.fillStyle = '#faf7f5';
    cctx.fillRect(51, cy - 99, 14, 7);
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(52, cy - 99, 5, 4); // Calico patch

    this.sprites.cafe_in_the_haus = cafe.canvas;

    // 2. Vietnamese Memorial Clock Tower (หอนาฬิกาเวียดนามอนุสรณ์)
    const clockTower = createOffscreen(60, 130);
    const ctctx = clockTower.ctx;
    const baseH = 120;
    ctctx.fillStyle = '#181615';
    ctctx.fillRect(12, baseH - 85, 36, 85);
    ctctx.fillRect(8, baseH - 15, 44, 15);
    ctctx.fillRect(16, baseH - 110, 28, 26);
    ctctx.fillRect(26, baseH - 124, 8, 15); // Spire
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
    ctctx.fillStyle = '#181615';
    ctctx.fillRect(29, baseH - 101, 2, 6);
    ctctx.fillRect(29, baseH - 96, 5, 2);
    this.sprites.clock_tower = clockTower.canvas;

    // 3. Phaya Si Sattanakharat (องค์พญาศรีสัตตนาคราช 7 เศียร)
    const naga = createOffscreen(72, 110);
    const nctx = naga.ctx;
    const ny = 100;
    nctx.fillStyle = '#181615';
    nctx.fillRect(8, ny - 30, 56, 30);
    nctx.fillStyle = '#334155';
    nctx.fillRect(10, ny - 28, 52, 27);
    nctx.fillStyle = '#181615';
    nctx.fillRect(16, ny - 60, 40, 32);
    nctx.fillStyle = '#ca8a04';
    nctx.fillRect(18, ny - 58, 36, 28);
    const headXOffsets = [6, 13, 20, 27, 34, 41, 48];
    headXOffsets.forEach((hx, i) => {
      const peak = i === 3 ? 14 : (i === 2 || i === 4 ? 8 : 2);
      nctx.fillStyle = '#181615';
      nctx.fillRect(hx, ny - 80 - peak, 8, 24 + peak);
      nctx.fillStyle = '#facc15';
      nctx.fillRect(hx + 1, ny - 78 - peak, 6, 22 + peak);
      nctx.fillStyle = '#ef4444';
      nctx.fillRect(hx + 2, ny - 76 - peak, 2, 2);
    });
    this.sprites.phaya_naga = naga.canvas;

    // 4. Antique Street Lamp (เสาไฟโบราณริมโขง)
    const streetLamp = createOffscreen(24, 75);
    const lctx = streetLamp.ctx;
    lctx.fillStyle = '#181615';
    lctx.fillRect(10, 18, 4, 56);
    lctx.fillRect(6, 70, 12, 5);
    lctx.fillRect(4, 6, 16, 14);
    lctx.fillStyle = '#fef08a';
    lctx.fillRect(6, 8, 12, 10);
    this.sprites.street_lamp = streetLamp.canvas;
  }

  // =========================================================================
  // 7. DRAWING METHODS (CALLED IN GAME LOOP)
  // =========================================================================

  /**
   * Draw the 5-layer Parallax Mekong Riverfront Environment
   */
  drawBackground(ctx, width, height, groundY, distanceRun, frame, spicyTier, feverTimer) {
    // 1. Sky Gradient according to Tier & Fever
    let skyTop = '#fefce8';
    let skyBottom = '#fed7aa';

    if (feverTimer > 0) {
      skyTop = '#fef9c3';
      skyBottom = '#fde047';
    } else if (spicyTier === 4) {
      skyTop = '#0f172a';
      skyBottom = '#1e1b4b';
    } else if (spicyTier === 3) {
      skyTop = '#1e1b4b';
      skyBottom = '#3730a3';
    } else if (spicyTier === 2) {
      skyTop = '#ea580c';
      skyBottom = '#fde68a';
    } else {
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

    // 2. Celestial Body
    const sunX = width - 75;
    const sunY = 40;
    if (spicyTier >= 3) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skyTop;
      ctx.beginPath();
      ctx.arc(sunX + 6, sunY - 4, 13, 0, Math.PI * 2);
      ctx.fill();
    } else {
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
    ctx.fillStyle = '#181615';
    ctx.fillRect(boatX, groundY - 28, 22, 5);
    ctx.fillRect(boatX + 18, groundY - 32, 2, 7);
    ctx.fillRect(boatX + 8, groundY - 33, 4, 6);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(boatX + 2, groundY - 29, 2, 2);

    // 6. Landmarks & Street Elements (Layer 3 parallax)
    const scenePeriod = 2000;
    const getPos = (baseX) => {
      const pos = (baseX - (distanceRun * 0.75)) % scenePeriod;
      return ((pos % scenePeriod) + scenePeriod) % scenePeriod - 150;
    };

    // Landmark A: "ในบ้าน" (In The Haus) Cafe Heritage Landmark!
    const cafeX = getPos(220);
    if (cafeX > -150 && cafeX < width + 80 && this.sprites.cafe_in_the_haus) {
      ctx.drawImage(this.sprites.cafe_in_the_haus, cafeX, groundY - 106);
    }

    // Landmark B: หอนาฬิกาเวียดนามอนุสรณ์
    const clockX = getPos(850);
    if (clockX > -80 && clockX < width + 80 && this.sprites.clock_tower) {
      ctx.drawImage(this.sprites.clock_tower, clockX, groundY - 118);
    }

    // Landmark C: องค์พญาศรีสัตตนาคราช
    const nagaX = getPos(1480);
    if (nagaX > -90 && nagaX < width + 90 && this.sprites.phaya_naga) {
      ctx.drawImage(this.sprites.phaya_naga, nagaX, groundY - 96);
      ctx.fillStyle = '#38bdf8';
      const waterDrop = (frame * 3) % 24;
      ctx.fillRect(nagaX - 8 - waterDrop, groundY - 80 + waterDrop * 1.5, 4, 4);
    }

    // Landmark D: Street Lamps (repeating along the promenade)
    for (let lx = 50; lx < scenePeriod; lx += 480) {
      const lampX = getPos(lx);
      if (lampX > -40 && lampX < width + 40 && this.sprites.street_lamp) {
        ctx.drawImage(this.sprites.street_lamp, lampX, groundY - 72);
      }
    }

    // 7. Foreground Paved Promenade with Checker Texture (Layer 4)
    ctx.fillStyle = '#181615';
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
    ctx.fillStyle = tier >= 3 ? '#1e1b4b' : '#181615';
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 24, 185 + 2, 17 * shadowScale, 4.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. God Mode / Fever Mode Auras & Afterimages
    if (feverTimer > 0) {
      const pulse = Math.sin(frame * 0.4) * 6;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.beginPath();
      ctx.arc(x + 24, y + 24, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (godModeTimer > 0) {
      const pulse = Math.sin(frame * 0.35) * 5;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.40)';
      ctx.beginPath();
      ctx.arc(x + 24, y + 24, 26 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Super Magnet Pulse Wave for Khao Lam
    if (charId === 'khao_lam') {
      const magnetWave = (frame * 1.5) % 36;
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 - (magnetWave / 36) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 24, y + 24, 20 + magnetWave, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Transform & Squash/Stretch
    ctx.translate(x + 24, y + 24);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-24, -24);

    // Frame selection: [0-3: Run Cycle, 4: Jump]
    let fIdx = 0;
    if (!isGrounded) {
      fIdx = 4;
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

    if (mon.type === 'hop_chili') {
      my = mon.y - Math.abs(Math.sin(frame * 0.12 + (mon.animPhase || 0))) * 24;
    } else if (mon.type === 'hawk') {
      my = mon.y + Math.sin(frame * 0.09 + (mon.animPhase || 0)) * 10;
    }

    if (mon.type !== 'hawk' && mon.type !== 'naga_thunder') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(mx + (mon.width / 2), groundY + 2, mon.width * 0.45, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

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
    if (mon.isTelegraph) {
      const pulse = Math.abs(Math.sin(frame * 0.3));
      ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.4})`;
      ctx.fillRect(tx - 12, 0, 24, groundY);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⚡ WARNING', tx - 32, groundY - 25);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx - 6, 0, 12, groundY);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(tx - 3, 0, 6, groundY);
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
