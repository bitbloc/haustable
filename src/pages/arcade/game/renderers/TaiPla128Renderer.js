/**
 * TaiPla128Renderer.js
 * Clean Minimalist Neo-Arcade Pixel Art Renderer for Tai-Pla Runner
 * 
 * Design Principles:
 * - Inspired by Game Boy Light / Sage Forest palette + Dieter Rams Thai Modern OKLCH
 * - High-contrast, razor-sharp 1-bit / 2-bit outlines with zero muddy gradient noise
 * - Crisp, unmistakable hazard & character silhouettes for split-second arcade readability
 * - Pre-baked offscreen canvas textures at native integer pixels (no blurry scaling)
 */

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
  // 1. CRISP CHARACTERS (48x48) - HIGH CONTRAST, ZERO BLUR
  // =========================================================================
  // =========================================================================
  // 1. POKÉMON-STYLE ARTISTIC CREATURE SPRITES (48x48) - 128-BIT NEO-RETRO
  // =========================================================================
  bakeCharacters() {
    this.sprites.tai_pla = this.bakePokemonTaiPla();
    this.sprites.som_satow = this.bakePokemonSomSatow();
    this.sprites.khao_lam = this.bakePokemonKhaoLam();
    this.sprites.barista_cat = this.bakePokemonBaristaCat();
    this.sprites.baby_naga = this.bakePokemonBabyNaga();
  }

  /**
   * 🌊 น้องไตปลามอน (Tai-Plamon) - Water / Spice Feline Creature
   * Pokémon-style creature with aquatic ear-fins, indigo cape, and spice-gem fishtail
   */
  bakePokemonTaiPla() {
    const frameW = 48, frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      const isJump = f === 4;
      const isHurt = f === 5;
      const run = f % 4;
      const bob = isJump ? -5 : (run === 1 || run === 3 ? -2 : 0);

      // 1. Billowing Indigo Water Scarf (Flapping behind)
      ctx.save();
      const waveOffset = isJump ? -6 : (run === 0 ? 3 : (run === 2 ? -3 : 0));
      ctx.fillStyle = '#0f172a'; // 1px dark border
      ctx.fillRect(8, 20 + bob + waveOffset, 12, 6);
      ctx.fillRect(5, 23 + bob + waveOffset, 10, 8);
      ctx.fillRect(3, 27 + bob + waveOffset, 8, 6);
      ctx.fillStyle = '#1e3a8a'; // Traditional Thai Indigo
      ctx.fillRect(9, 21 + bob + waveOffset, 10, 4);
      ctx.fillRect(6, 24 + bob + waveOffset, 8, 6);
      ctx.fillRect(4, 28 + bob + waveOffset, 6, 4);
      ctx.fillStyle = '#60a5fa'; // Seafoam trim
      ctx.fillRect(10, 21 + bob + waveOffset, 8, 2);
      ctx.fillRect(7, 25 + bob + waveOffset, 6, 2);
      ctx.restore();

      // 2. Aquatic Fishtail with Glowing Spice Gem
      ctx.save();
      const tailWag = isJump ? -7 : (run === 0 || run === 2 ? 3 : -2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(7, 21 + bob + tailWag, 6, 6);
      ctx.fillRect(3, 17 + bob + tailWag, 6, 7);
      ctx.fillRect(1, 11 + bob + tailWag, 6, 9);
      // Dual tail fin lobes (like Vaporeon / Koi)
      ctx.fillRect(-2, 7 + bob + tailWag, 6, 6);
      ctx.fillRect(4, 8 + bob + tailWag, 5, 5);

      ctx.fillStyle = '#faf7f2'; // Base pearly white
      ctx.fillRect(8, 22 + bob + tailWag, 4, 4);
      ctx.fillRect(4, 18 + bob + tailWag, 4, 5);
      ctx.fillRect(2, 12 + bob + tailWag, 4, 7);

      // Indigo fin coloring
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-1, 8 + bob + tailWag, 4, 4);
      ctx.fillRect(5, 9 + bob + tailWag, 3, 3);

      // Glowing Spice Gem on tail tip
      ctx.fillStyle = '#ef4444'; // Red ruby gem
      ctx.fillRect(1, 11 + bob + tailWag, 4, 4);
      ctx.fillStyle = '#fde047'; // Golden catchlight
      ctx.fillRect(2, 12 + bob + tailWag, 2, 2);
      ctx.restore();

      // 3. Back Paws (Athletic Creature Leg)
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(9, 32, 7, 10);
        ctx.fillStyle = '#faf7f2';
        ctx.fillRect(10, 33, 5, 8);
        ctx.fillStyle = '#0284c7'; // Blue paw pad
        ctx.fillRect(11, 39, 3, 2);
      } else {
        const bX = run === 0 ? 8 : (run === 1 ? 12 : (run === 2 ? 16 : 10));
        const bH = run === 1 ? 6 : 9;
        ctx.fillRect(bX, 35 + bob, 7, bH);
        ctx.fillStyle = '#faf7f2';
        ctx.fillRect(bX + 1, 36 + bob, 5, bH - 2);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(bX + 2, 35 + bob + bH - 2, 3, 2);
      }

      // 4. Sleek Streamlined Body
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(11, 16 + bob, 25, 20);
      ctx.fillRect(9, 18 + bob, 29, 16);
      ctx.fillRect(13, 14 + bob, 21, 24);

      // Pearlescent Cream Body
      ctx.fillStyle = '#faf7f2';
      ctx.fillRect(12, 17 + bob, 23, 18);
      ctx.fillRect(10, 19 + bob, 27, 14);

      // Indigo & Terracotta Spice Pattern (Mackerel Stripe)
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(12, 17 + bob, 8, 8);
      ctx.fillRect(20, 19 + bob, 6, 6);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(13, 24 + bob, 8, 5);
      ctx.fillRect(23, 17 + bob, 6, 4);

      // 5. Front Paws
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(27, 28, 8, 12);
        ctx.fillStyle = '#faf7f2';
        ctx.fillRect(28, 29, 6, 10);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(29, 37, 4, 2);
      } else {
        const fX = run === 0 ? 27 : (run === 1 ? 23 : (run === 2 ? 19 : 26));
        const fH = run === 3 ? 6 : 9;
        ctx.fillRect(fX, 35 + bob, 7, fH);
        ctx.fillStyle = '#faf7f2';
        ctx.fillRect(fX + 1, 36 + bob, 5, fH - 2);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(fX + 2, 35 + bob + fH - 2, 3, 2);
      }

      // 6. Large Pokemon Creature Head
      const hX = 24, hY = 8 + bob;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY - 1, 25, 19);
      ctx.fillRect(hX - 4, hY + 2, 29, 14);
      ctx.fillRect(hX, hY - 4, 21, 24);

      // Aquatic Dorsal Fin on Head (Water Pokémon Crest)
      ctx.fillRect(hX + 7, hY - 9, 8, 8);
      ctx.fillRect(hX + 9, hY - 13, 5, 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(hX + 8, hY - 8, 6, 6);
      ctx.fillRect(hX + 10, hY - 12, 3, 5);

      // Aquatic Ear-Fins (like Vaporeon / Dewott)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 6, hY - 4, 8, 11);
      ctx.fillRect(hX + 20, hY - 4, 8, 11);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(hX - 5, hY - 3, 6, 9);
      ctx.fillRect(hX + 21, hY - 3, 6, 9);
      ctx.fillStyle = '#38bdf8'; // Inner fin web
      ctx.fillRect(hX - 4, hY - 2, 4, 7);
      ctx.fillRect(hX + 22, hY - 2, 4, 7);

      // Face Fill
      ctx.fillStyle = '#faf7f2';
      ctx.fillRect(hX - 1, hY, 23, 17);
      ctx.fillRect(hX - 3, hY + 3, 27, 12);

      // Indigo forehead mask
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(hX + 2, hY, 6, 6);
      ctx.fillRect(hX + 14, hY, 6, 5);

      // 7. Expressive Pokémon Anime Eyes (Cyan / Deep Sapphire)
      if (isHurt) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 6, hY + 5, 5, 5);
        ctx.fillRect(hX + 14, hY + 5, 5, 5);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(hX + 7, hY + 6, 3, 3);
        ctx.fillRect(hX + 15, hY + 6, 3, 3);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 5, hY + 4, 6, 8);
        ctx.fillRect(hX + 14, hY + 4, 6, 8);
        ctx.fillStyle = '#0284c7'; // Iris
        ctx.fillRect(hX + 6, hY + 5, 4, 6);
        ctx.fillRect(hX + 15, hY + 5, 4, 6);
        ctx.fillStyle = '#38bdf8'; // Bottom highlight
        ctx.fillRect(hX + 6, hY + 8, 4, 3);
        ctx.fillRect(hX + 15, hY + 8, 4, 3);
        // Double Anime Catchlights
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hX + 6, hY + 5, 2, 2);
        ctx.fillRect(hX + 15, hY + 5, 2, 2);
        ctx.fillRect(hX + 8, hY + 9, 1, 1);
        ctx.fillRect(hX + 17, hY + 9, 1, 1);
      }

      // Soft Peach Blush & Nose
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(hX + 2, hY + 11, 3, 2);
      ctx.fillRect(hX + 19, hY + 11, 3, 2);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(hX + 11, hY + 10, 3, 2);

      ctx.restore();
    }
    return canvas;
  }

  /**
   * 🔥 พี่ส้มสะตอกง (Satow-Kong / Som-Tork) - Fire / Flora Beast
   * Powerful Pokémon-style beast with curved Satow-bean horns and roasted carapace
   */
  bakePokemonSomSatow() {
    const frameW = 48, frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      const isJump = f === 4;
      const run = f % 4;
      const bob = isJump ? -5 : (run === 1 || run === 3 ? -2 : 0);

      // 1. Fiery Curved Tail with Leaf Flare
      ctx.save();
      const tAngle = isJump ? -6 : (run === 0 ? 3 : -2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(5, 20 + bob + tAngle, 6, 6);
      ctx.fillRect(2, 15 + bob + tAngle, 6, 7);
      ctx.fillRect(0, 8 + bob + tAngle, 7, 9);
      // Leaf flame tip
      ctx.fillRect(-2, 4 + bob + tAngle, 7, 7);
      ctx.fillStyle = '#ea580c'; // Fiery ginger
      ctx.fillRect(6, 21 + bob + tAngle, 4, 4);
      ctx.fillRect(3, 16 + bob + tAngle, 4, 5);
      ctx.fillRect(1, 9 + bob + tAngle, 5, 7);
      ctx.fillStyle = '#22c55e'; // Emerald leaf flare
      ctx.fillRect(-1, 5 + bob + tAngle, 5, 5);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 6 + bob + tAngle, 3, 3);
      ctx.restore();

      // 2. Powerful Back Legs
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(8, 33, 8, 10);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(9, 34, 6, 8);
      } else {
        const bX = run === 0 ? 8 : (run === 1 ? 12 : (run === 2 ? 16 : 10));
        const bH = run === 1 ? 6 : 9;
        ctx.fillRect(bX, 35 + bob, 8, bH);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(bX + 1, 36 + bob, 6, bH - 2);
      }

      // 3. Stout Muscular Body & Roasted Satow Carapace
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(10, 16 + bob, 26, 21);
      ctx.fillRect(8, 18 + bob, 30, 17);
      ctx.fillRect(12, 14 + bob, 22, 25);

      ctx.fillStyle = '#ea580c'; // Orange fur
      ctx.fillRect(11, 17 + bob, 24, 19);
      ctx.fillRect(9, 19 + bob, 28, 15);

      // Roasted Satow Carapace Shell on Back
      ctx.fillStyle = '#78350f';
      ctx.fillRect(11, 16 + bob, 14, 10);
      ctx.fillRect(13, 14 + bob, 10, 14);
      ctx.fillStyle = '#d97706'; // Golden shell plates
      ctx.fillRect(12, 17 + bob, 5, 4);
      ctx.fillRect(18, 17 + bob, 5, 4);

      // Chest Flame Tuft
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(24, 22 + bob, 11, 8);
      ctx.fillRect(26, 20 + bob, 7, 12);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(27, 24 + bob, 6, 4);

      // 4. Front Paws
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(28, 29, 8, 12);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(29, 30, 6, 10);
      } else {
        const fX = run === 0 ? 28 : (run === 1 ? 24 : (run === 2 ? 20 : 27));
        const fH = run === 3 ? 6 : 9;
        ctx.fillRect(fX, 35 + bob, 8, fH);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(fX + 1, 36 + bob, 6, fH - 2);
      }

      // 5. Beast Head
      const hX = 25, hY = 8 + bob;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY - 1, 26, 20);
      ctx.fillRect(hX - 4, hY + 2, 30, 15);
      ctx.fillRect(hX, hY - 4, 22, 25);

      // 6. GIANT CURVED SATOW-BEAN HORNS (Iconic Pokemon Feature)
      // Left Horn
      ctx.fillRect(hX - 8, hY - 13, 10, 14);
      ctx.fillRect(hX - 12, hY - 16, 7, 7);
      ctx.fillStyle = '#15803d'; // Dark Satow green
      ctx.fillRect(hX - 7, hY - 12, 8, 12);
      ctx.fillStyle = '#22c55e'; // Bright bean pod
      ctx.fillRect(hX - 6, hY - 11, 6, 10);
      ctx.fillRect(hX - 11, hY - 15, 5, 5);
      // Segment pod bumps
      ctx.fillStyle = '#86efac';
      ctx.fillRect(hX - 5, hY - 9, 3, 3);
      ctx.fillRect(hX - 10, hY - 14, 3, 3);

      // Right Horn
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 18, hY - 13, 10, 14);
      ctx.fillRect(hX + 23, hY - 16, 7, 7);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(hX + 19, hY - 12, 8, 12);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(hX + 20, hY - 11, 6, 10);
      ctx.fillRect(hX + 24, hY - 15, 5, 5);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(hX + 21, hY - 9, 3, 3);
      ctx.fillRect(hX + 25, hY - 14, 3, 3);

      // Face Fill
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(hX - 1, hY, 24, 18);
      ctx.fillRect(hX - 3, hY + 3, 28, 13);
      ctx.fillStyle = '#fff7ed'; // Cream muzzle
      ctx.fillRect(hX + 6, hY + 9, 12, 7);

      // 7. Fierce & Cute Crimson Creature Eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 4, hY + 4, 6, 8);
      ctx.fillRect(hX + 14, hY + 4, 6, 8);
      ctx.fillStyle = '#e11d48'; // Crimson
      ctx.fillRect(hX + 5, hY + 5, 4, 6);
      ctx.fillRect(hX + 15, hY + 5, 4, 6);
      ctx.fillStyle = '#f59e0b'; // Amber pupil
      ctx.fillRect(hX + 5, hY + 7, 4, 3);
      ctx.fillRect(hX + 15, hY + 7, 4, 3);
      ctx.fillStyle = '#ffffff'; // Catchlight
      ctx.fillRect(hX + 5, hY + 5, 2, 2);
      ctx.fillRect(hX + 15, hY + 5, 2, 2);

      // Dark snout & fierce smile
      ctx.fillStyle = '#78350f';
      ctx.fillRect(hX + 10, hY + 10, 4, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 10, hY + 13, 4, 1);

      ctx.restore();
    }
    return canvas;
  }

  /**
   * 🎋 เจ้าตูบข้าวหลาม (Khao-Lam / Bamboopup) - Grass / Earth Puppy
   * Adorable bamboo creature puppy with sticky-rice fur and magnetic bell collar
   */
  bakePokemonKhaoLam() {
    const frameW = 48, frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      const isJump = f === 4;
      const run = f % 4;
      const bob = isJump ? -5 : (run === 1 || run === 3 ? -2 : 0);

      // 1. Wagging Bamboo-Leaf Tail
      ctx.save();
      const wag = isJump ? 5 : (run === 0 || run === 2 ? 4 : -3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 21 + bob + wag, 7, 7);
      ctx.fillRect(2, 17 + bob + wag, 6, 6);
      ctx.fillStyle = '#fef3c7'; // Toasted sticky rice
      ctx.fillRect(7, 22 + bob + wag, 5, 5);
      ctx.fillStyle = '#4d7c0f'; // Bamboo green tip
      ctx.fillRect(3, 18 + bob + wag, 4, 4);
      ctx.restore();

      // 2. Chunky Paws
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(9, 33, 7, 10);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(10, 34, 5, 8);
      } else {
        const bX = run === 0 ? 8 : (run === 1 ? 12 : (run === 2 ? 16 : 10));
        const bH = run === 1 ? 6 : 9;
        ctx.fillRect(bX, 35 + bob, 7, bH);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(bX + 1, 36 + bob, 5, bH - 2);
      }

      // 3. Fluffy Body with Toasted Brown Patches
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(11, 16 + bob, 25, 20);
      ctx.fillRect(9, 18 + bob, 29, 16);
      ctx.fillRect(13, 14 + bob, 21, 24);

      ctx.fillStyle = '#fef3c7'; // Rice cream
      ctx.fillRect(12, 17 + bob, 23, 18);
      ctx.fillRect(10, 19 + bob, 27, 14);

      // Toasted coconut spots
      ctx.fillStyle = '#b45309';
      ctx.fillRect(14, 18 + bob, 9, 8);
      ctx.fillRect(21, 24 + bob, 7, 6);

      // 4. Bamboo Cane Collar with Oversized Magnetic Bell
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(22, 23 + bob, 14, 12);
      ctx.fillStyle = '#84cc16'; // Bamboo green collar
      ctx.fillRect(23, 24 + bob, 12, 4);
      // Shiny Gold Bell
      ctx.fillStyle = '#facc15';
      ctx.fillRect(25, 28 + bob, 8, 7);
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(28, 32 + bob, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(26, 29 + bob, 2, 2);

      // 5. Front Paws
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(28, 29, 8, 12);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(29, 30, 6, 10);
      } else {
        const fX = run === 0 ? 28 : (run === 1 ? 24 : (run === 2 ? 20 : 27));
        const fH = run === 3 ? 6 : 9;
        ctx.fillRect(fX, 35 + bob, 8, fH);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(fX + 1, 36 + bob, 6, fH - 2);
      }

      // 6. Chibi Puppy Head
      const hX = 25, hY = 8 + bob;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY - 1, 25, 19);
      ctx.fillRect(hX - 4, hY + 2, 29, 14);
      ctx.fillRect(hX, hY - 4, 21, 24);

      // 7. BAMBOO SPROUT ON HEAD (Fresh bamboo shoot with dual leaves)
      ctx.fillRect(hX + 9, hY - 12, 6, 10);
      ctx.fillRect(hX + 5, hY - 15, 6, 6);
      ctx.fillRect(hX + 13, hY - 15, 6, 6);
      ctx.fillStyle = '#84cc16'; // Fresh sprout
      ctx.fillRect(hX + 10, hY - 11, 4, 8);
      ctx.fillStyle = '#4d7c0f'; // Leaf blades
      ctx.fillRect(hX + 6, hY - 14, 4, 4);
      ctx.fillRect(hX + 14, hY - 14, 4, 4);

      // Drooping Toasted Brown Puppy Ears
      const earFlap = isJump ? -3 : (run === 1 ? 2 : 0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 6, hY + 1 + earFlap, 8, 13);
      ctx.fillRect(hX + 21, hY + 1 + earFlap, 8, 13);
      ctx.fillStyle = '#92400e'; // Brown ears
      ctx.fillRect(hX - 5, hY + 2 + earFlap, 6, 11);
      ctx.fillRect(hX + 22, hY + 2 + earFlap, 6, 11);

      // Face Fill
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(hX - 1, hY, 23, 17);
      ctx.fillRect(hX - 3, hY + 3, 27, 12);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(hX + 5, hY + 8, 14, 8);

      // 8. Enormous Sparkling Puppy Eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 4, hY + 4, 6, 8);
      ctx.fillRect(hX + 14, hY + 4, 6, 8);
      ctx.fillStyle = '#78350f'; // Warm chocolate iris
      ctx.fillRect(hX + 5, hY + 5, 4, 6);
      ctx.fillRect(hX + 15, hY + 5, 4, 6);
      // Double giant catchlights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hX + 5, hY + 5, 3, 3);
      ctx.fillRect(hX + 15, hY + 5, 3, 3);
      ctx.fillRect(hX + 7, hY + 9, 2, 2);
      ctx.fillRect(hX + 17, hY + 9, 2, 2);

      // Cute Brown Nose & Happy Tongue
      ctx.fillStyle = '#78350f';
      ctx.fillRect(hX + 10, hY + 10, 4, 3);
      ctx.fillStyle = '#f43f5e'; // Pink tongue
      ctx.fillRect(hX + 11, hY + 13, 3, 3);

      ctx.restore();
    }
    return canvas;
  }

  /**
   * ☕ บาริสต้าเหมียวในบ้าน (Barista Cat "Nong Haus") - Coffee / Wind Feline
   * Classic tuxedo cat with linen barista apron, flat cap, and cappuccino foam spring
   */
  bakePokemonBaristaCat() {
    const frameW = 48, frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      const isJump = f === 4;
      const isHurt = f === 5;
      const run = f % 4;
      const bob = isJump ? -5 : (run === 1 || run === 3 ? -2 : 0);

      // 1. Sleek Black Tuxedo Tail with White Tip
      ctx.save();
      const tailWag = isJump ? -6 : (run === 0 || run === 2 ? 3 : -2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(7, 20 + bob + tailWag, 6, 6);
      ctx.fillRect(4, 15 + bob + tailWag, 6, 7);
      ctx.fillRect(3, 9 + bob + tailWag, 6, 8);
      ctx.fillRect(5, 5 + bob + tailWag, 6, 6);
      // White tip
      ctx.fillStyle = '#faf7f5';
      ctx.fillRect(6, 6 + bob + tailWag, 4, 4);
      ctx.restore();

      // 2. Back Paws with White Mittens
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(9, 32, 7, 10);
        ctx.fillStyle = '#faf7f5';
        ctx.fillRect(9, 38, 7, 4); // White sock
      } else {
        const bX = run === 0 ? 8 : (run === 1 ? 12 : (run === 2 ? 16 : 10));
        const bH = run === 1 ? 6 : 9;
        ctx.fillRect(bX, 35 + bob, 7, bH);
        ctx.fillStyle = '#faf7f5';
        ctx.fillRect(bX, 35 + bob + bH - 3, 7, 3);
      }

      // 3. Tuxedo Body (Black Coat + Linen Barista Apron)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(11, 16 + bob, 25, 20);
      ctx.fillRect(9, 18 + bob, 29, 16);
      ctx.fillRect(13, 14 + bob, 21, 24);

      // White Tuxedo Chest
      ctx.fillStyle = '#faf7f5';
      ctx.fillRect(18, 16 + bob, 14, 18);
      ctx.fillRect(20, 14 + bob, 10, 20);

      // Barista Apron (Warm Terracotta / Coffee Brown)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(14, 20 + bob, 18, 14);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(16, 21 + bob, 14, 12);
      // Apron Neck Straps & Haus Badge
      ctx.fillStyle = '#451a03';
      ctx.fillRect(18, 17 + bob, 3, 4);
      ctx.fillRect(25, 17 + bob, 3, 4);
      ctx.fillStyle = '#facc15'; // Golden "HAUS" Barista Pin
      ctx.fillRect(22, 23 + bob, 3, 3);

      // 4. Steaming Espresso Cup / Foam Pack
      if (isJump) {
        // Frothy steam puffs below paws
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18, 42, 10, 4);
        ctx.fillRect(20, 40, 6, 6);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(21, 41, 4, 4);
      } else {
        // Small coffee bean pouch on hip
        ctx.fillStyle = '#451a03';
        ctx.fillRect(10, 24 + bob, 6, 7);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(11, 25 + bob, 4, 5);
      }

      // 5. Front Paws with White Mittens
      ctx.fillStyle = '#0f172a';
      if (isJump) {
        ctx.fillRect(28, 28, 8, 12);
        ctx.fillStyle = '#faf7f5';
        ctx.fillRect(28, 36, 8, 4);
      } else {
        const fX = run === 0 ? 28 : (run === 1 ? 24 : (run === 2 ? 20 : 27));
        const fH = run === 3 ? 6 : 9;
        ctx.fillRect(fX, 35 + bob, 8, fH);
        ctx.fillStyle = '#faf7f5';
        ctx.fillRect(fX, 35 + bob + fH - 3, 8, 3);
      }

      // 6. Tuxedo Cat Head & Vintage Beret Cap
      const hX = 25, hY = 8 + bob;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY - 1, 25, 19);
      ctx.fillRect(hX - 4, hY + 2, 29, 14);
      ctx.fillRect(hX, hY - 4, 21, 24);

      // Cat Ears (Pointed Black with Pink Inner)
      ctx.fillRect(hX - 2, hY - 8, 6, 8);
      ctx.fillRect(hX + 17, hY - 8, 6, 8);
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(hX - 1, hY - 6, 4, 5);
      ctx.fillRect(hX + 18, hY - 6, 4, 5);

      // Vintage Barista Flat Cap (Charcoal Grey, angled chic)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hX + 2, hY - 7, 18, 6);
      ctx.fillRect(hX + 5, hY - 10, 13, 5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(hX + 4, hY - 6, 14, 3);

      // White Muzzle (Mask of Tuxedo Cat)
      ctx.fillStyle = '#faf7f5';
      ctx.fillRect(hX + 3, hY + 6, 15, 11);
      ctx.fillRect(hX + 5, hY + 3, 11, 14);

      // Expressive Anime Cat Eyes (Amber Gold)
      if (isHurt) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 5, hY + 4, 5, 5);
        ctx.fillRect(hX + 13, hY + 4, 5, 5);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(hX + 6, hY + 5, 3, 3);
        ctx.fillRect(hX + 14, hY + 5, 3, 3);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 4, hY + 3, 6, 8);
        ctx.fillRect(hX + 13, hY + 3, 6, 8);
        ctx.fillStyle = '#f59e0b'; // Amber Gold Iris
        ctx.fillRect(hX + 5, hY + 4, 4, 6);
        ctx.fillRect(hX + 14, hY + 4, 4, 6);
        ctx.fillStyle = '#fef08a'; // Inner Glow
        ctx.fillRect(hX + 5, hY + 7, 4, 3);
        ctx.fillRect(hX + 14, hY + 7, 4, 3);
        // Catchlights
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hX + 5, hY + 4, 2, 2);
        ctx.fillRect(hX + 14, hY + 4, 2, 2);
        ctx.fillRect(hX + 7, hY + 8, 1, 1);
        ctx.fillRect(hX + 16, hY + 8, 1, 1);
      }

      // Pink Nose & Cat Whiskers
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(hX + 9, hY + 9, 3, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY + 9, 4, 1);
      ctx.fillRect(hX - 2, hY + 12, 4, 1);
      ctx.fillRect(hX + 19, hY + 9, 4, 1);
      ctx.fillRect(hX + 19, hY + 12, 4, 1);

      ctx.restore();
    }
    return canvas;
  }

  /**
   * 🐉 พญานาคาน้อย (Baby Nakkhi) - Spirit / Water Serpent
   * Cute 3-headed baby Naga with golden crown, floating cloud vortex, and ruby pearl tail
   */
  bakePokemonBabyNaga() {
    const frameW = 48, frameH = 48;
    const { canvas, ctx } = createOffscreen(frameW * 6, frameH);

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      const isJump = f === 4;
      const isHurt = f === 5;
      const run = f % 4;
      const bob = isJump ? -6 : (run === 1 || run === 3 ? -3 : 0);

      // 1. Floating Mist / Cloud Vortex underneath (replaces legs)
      ctx.save();
      const wavePhase = (run * 0.5) * Math.PI;
      const cloudShift = Math.sin(wavePhase) * 3;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.fillRect(10 + cloudShift, 36 + bob, 26, 6);
      ctx.fillRect(14 - cloudShift, 39 + bob, 18, 5);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(12 + cloudShift, 37 + bob, 22, 4);
      ctx.restore();

      // 2. Serpentine Tail holding Mekong River Pearl
      ctx.save();
      const tailOsc = isJump ? -8 : (run === 0 || run === 2 ? 4 : -3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 22 + bob + tailOsc, 8, 8);
      ctx.fillRect(2, 16 + bob + tailOsc, 7, 9);
      ctx.fillRect(1, 9 + bob + tailOsc, 8, 9);
      // Traditional Thai Kranok Flame Fin on tail
      ctx.fillRect(-2, 4 + bob + tailOsc, 8, 8);
      ctx.fillRect(5, 5 + bob + tailOsc, 6, 6);

      // Jade Green Body
      ctx.fillStyle = '#059669';
      ctx.fillRect(7, 23 + bob + tailOsc, 6, 6);
      ctx.fillRect(3, 17 + bob + tailOsc, 5, 7);
      ctx.fillRect(2, 10 + bob + tailOsc, 6, 7);
      // Emerald fin
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-1, 5 + bob + tailOsc, 6, 6);
      ctx.fillRect(6, 6 + bob + tailOsc, 4, 4);

      // Glowing Mekong Blue Pearl on Tail Tip
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(1, 9 + bob + tailOsc, 5, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 10 + bob + tailOsc, 2, 2);
      ctx.restore();

      // 3. Serpentine Torso with Golden Belly Scales
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(12, 18 + bob, 24, 18);
      ctx.fillRect(15, 14 + bob, 20, 22);

      // Shimmering Jade Green Back
      ctx.fillStyle = '#059669';
      ctx.fillRect(13, 19 + bob, 22, 16);
      ctx.fillRect(16, 15 + bob, 18, 20);

      // Golden Belly Scales
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(18, 20 + bob, 12, 15);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(20, 22 + bob, 8, 3);
      ctx.fillRect(20, 27 + bob, 8, 3);
      ctx.fillRect(20, 32 + bob, 8, 2);

      // 4. Three Baby Naga Heads (Center Head + 2 Smiling Side Heads)
      const hX = 26, hY = 8 + bob;

      // Left Mini-Head
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 9, hY + 1, 10, 11);
      ctx.fillRect(hX - 7, hY - 4, 6, 6); // Left crown
      ctx.fillStyle = '#059669';
      ctx.fillRect(hX - 8, hY + 2, 8, 9);
      ctx.fillStyle = '#facc15'; // Gold Crown
      ctx.fillRect(hX - 6, hY - 3, 4, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 6, hY + 4, 2, 3); // Happy eye

      // Right Mini-Head
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 17, hY + 1, 10, 11);
      ctx.fillRect(hX + 19, hY - 4, 6, 6); // Right crown
      ctx.fillStyle = '#059669';
      ctx.fillRect(hX + 18, hY + 2, 8, 9);
      ctx.fillStyle = '#facc15'; // Gold Crown
      ctx.fillRect(hX + 20, hY - 3, 4, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 22, hY + 4, 2, 3); // Happy eye

      // Center Main Head (Grand Crowned)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX - 2, hY - 3, 22, 19);
      ctx.fillRect(hX - 4, hY, 26, 14);

      // Golden Naga Crest (Crown of Phaya Si Satta Nakarat)
      ctx.fillRect(hX + 5, hY - 14, 8, 12);
      ctx.fillRect(hX + 7, hY - 17, 4, 5);
      ctx.fillStyle = '#facc15'; // Brilliant Gold
      ctx.fillRect(hX + 6, hY - 13, 6, 10);
      ctx.fillRect(hX + 8, hY - 16, 2, 4);
      ctx.fillStyle = '#ef4444'; // Red Ruby Crest Gem
      ctx.fillRect(hX + 7, hY - 10, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hX + 8, hY - 9, 2, 2);

      // Jade Face Fill
      ctx.fillStyle = '#059669';
      ctx.fillRect(hX - 1, hY - 2, 20, 17);
      ctx.fillRect(hX - 3, hY + 1, 24, 12);

      // Large Emerald / Sapphire Dragon Eyes
      if (isHurt) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 4, hY + 3, 5, 5);
        ctx.fillRect(hX + 12, hY + 3, 5, 5);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(hX + 5, hY + 4, 3, 3);
        ctx.fillRect(hX + 13, hY + 4, 3, 3);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hX + 3, hY + 2, 6, 8);
        ctx.fillRect(hX + 12, hY + 2, 6, 8);
        ctx.fillStyle = '#0284c7'; // Deep Blue Naga Eye
        ctx.fillRect(hX + 4, hY + 3, 4, 6);
        ctx.fillRect(hX + 13, hY + 3, 4, 6);
        ctx.fillStyle = '#38bdf8'; // Water sheen
        ctx.fillRect(hX + 4, hY + 6, 4, 3);
        ctx.fillRect(hX + 13, hY + 6, 4, 3);
        // Double Catchlights
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hX + 4, hY + 3, 2, 2);
        ctx.fillRect(hX + 13, hY + 3, 2, 2);
        ctx.fillRect(hX + 6, hY + 7, 1, 1);
        ctx.fillRect(hX + 15, hY + 7, 1, 1);
      }

      // Snout & Water droplet nose
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(hX + 7, hY + 8, 7, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hX + 8, hY + 9, 2, 2);
      ctx.fillRect(hX + 11, hY + 9, 2, 2);

      ctx.restore();
    }
    return canvas;
  }

  // =========================================================================
  // 2. CRISP FOOD INGREDIENTS (32x32)
  // =========================================================================
  bakeIngredients() {
    // 1. ปลาทูแม่กลอง (Mackerel)
    const fish = createOffscreen(32, 32);
    const fctx = fish.ctx;
    fctx.fillStyle = '#181615';
    fctx.fillRect(5, 11, 20, 12);
    fctx.fillRect(23, 9, 7, 16);
    fctx.fillRect(2, 14, 6, 5);
    fctx.fillStyle = '#0284c7';
    fctx.fillRect(7, 12, 16, 5);
    fctx.fillStyle = '#38bdf8';
    fctx.fillRect(7, 17, 16, 4);
    fctx.fillStyle = '#f0f9ff';
    fctx.fillRect(7, 21, 16, 2);
    fctx.fillStyle = '#f59e0b';
    fctx.fillRect(25, 10, 4, 14);
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(5, 13, 4, 4);
    fctx.fillStyle = '#181615';
    fctx.fillRect(7, 14, 2, 2);
    this.sprites.fish = fish.canvas;

    // 2. เมล็ดสะตอ (Satow Bean)
    const satow = createOffscreen(32, 32);
    const sctx = satow.ctx;
    sctx.fillStyle = '#181615';
    sctx.fillRect(5, 7, 22, 18);
    sctx.fillRect(7, 5, 18, 22);
    sctx.fillStyle = '#15803d';
    sctx.fillRect(7, 7, 18, 18);
    sctx.fillStyle = '#22c55e';
    sctx.fillRect(9, 9, 14, 13);
    sctx.fillStyle = '#86efac';
    sctx.fillRect(11, 10, 5, 4);
    this.sprites.satow = satow.canvas;

    // 3. หน่อไม้ต้ม (Bamboo Shoot)
    const bamboo = createOffscreen(32, 32);
    const bctx = bamboo.ctx;
    bctx.fillStyle = '#181615';
    bctx.fillRect(11, 5, 10, 7);
    bctx.fillRect(8, 10, 16, 9);
    bctx.fillRect(5, 17, 22, 11);
    bctx.fillStyle = '#fef08a';
    bctx.fillRect(12, 6, 8, 5);
    bctx.fillStyle = '#fde047';
    bctx.fillRect(9, 11, 14, 7);
    bctx.fillStyle = '#eab308';
    bctx.fillRect(6, 18, 20, 9);
    bctx.fillStyle = '#a16207';
    bctx.fillRect(8, 22, 16, 2);
    this.sprites.bamboo = bamboo.canvas;

    // 4. ครกหินทองคำ (Golden Mortar)
    const goldMortar = createOffscreen(36, 36);
    const gmctx = goldMortar.ctx;
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(5, 11, 26, 20);
    gmctx.fillRect(8, 7, 20, 7);
    gmctx.fillRect(15, 1, 8, 14);
    gmctx.fillStyle = '#facc15';
    gmctx.fillRect(7, 13, 22, 16);
    gmctx.fillRect(9, 8, 18, 5);
    gmctx.fillStyle = '#fef08a';
    gmctx.fillRect(9, 10, 9, 3);
    gmctx.fillRect(16, 2, 5, 11);
    gmctx.fillStyle = '#b45309';
    gmctx.fillRect(9, 24, 18, 4);
    this.sprites.golden_mortar = goldMortar.canvas;
  }

  // =========================================================================
  // 3. CRISP HIGH-CONTRAST HAZARDS (7 TYPES)
  // =========================================================================
  bakeEnemies() {
    // 1. hop_chili (ปีศาจพริกแดงกระโดด - Ground Chili Devil)
    this.sprites.hop_chili = this.bakeGroundChiliDevil();

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
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, 8, 3, 3);
    cctx.fillRect(17, 8, 3, 3);
    cctx.fillRect(12, 16, 4, 3);
    this.sprites.coconut = coconut.canvas;

    // 3. hawk / fly_chili (ปีศาจพริกแดงเวหา - Aerial Chili Devil)
    this.sprites.hawk = this.bakeFlyingChiliDevil();

    // 4. pot_ghost (ผีหม้อดิน)
    const potGhost = createOffscreen(32 * 2, 34);
    const pgctx = potGhost.ctx;
    for (let f = 0; f < 2; f++) {
      pgctx.save();
      pgctx.translate(f * 32, 0);
      const lidLift = f === 0 ? 0 : 8;
      pgctx.fillStyle = '#181615';
      pgctx.fillRect(5, 15, 22, 18);
      pgctx.fillRect(3, 18, 26, 12);
      pgctx.fillStyle = '#b45309';
      pgctx.fillRect(6, 16, 20, 16);
      pgctx.fillRect(4, 19, 24, 10);
      pgctx.fillStyle = '#ea580c';
      pgctx.fillRect(7, 16, 18, 5);
      pgctx.fillStyle = '#facc15';
      pgctx.fillRect(9, 17, 3, 3);
      pgctx.fillRect(18, 17, 3, 3);
      pgctx.fillStyle = '#181615';
      pgctx.fillRect(3, 11 - lidLift, 26, 7);
      pgctx.fillRect(11, 7 - lidLift, 9, 6);
      pgctx.fillStyle = '#92400e';
      pgctx.fillRect(4, 12 - lidLift, 24, 5);
      pgctx.fillRect(12, 8 - lidLift, 7, 4);
      pgctx.restore();
    }
    this.sprites.pot_ghost = potGhost.canvas;

    // 5. hot_runner (กุ๊กกระทะร้อน)
    const hotRunner = createOffscreen(36 * 2, 40);
    const hrctx = hotRunner.ctx;
    for (let f = 0; f < 2; f++) {
      hrctx.save();
      hrctx.translate(f * 36, 0);
      hrctx.fillStyle = '#f97316';
      hrctx.fillRect(9, 3, 16, 9);
      hrctx.fillStyle = '#ef4444';
      hrctx.fillRect(11, 0, 12, 6);
      hrctx.fillStyle = '#fef08a';
      hrctx.fillRect(13, 5, 8, 5);
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(9, 10, 16, 14);
      hrctx.fillStyle = '#fed7aa';
      hrctx.fillRect(10, 11, 14, 12);
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(12, 13, 3, 3);
      hrctx.fillRect(19, 13, 3, 3);
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(7, 21, 20, 14);
      hrctx.fillStyle = '#dc2626';
      hrctx.fillRect(8, 22, 18, 12);
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(24, 23, 11, 7);
      hrctx.fillRect(29, 19, 2, 7);
      hrctx.fillStyle = '#f97316';
      hrctx.fillRect(25, 24, 9, 4);
      const legRun = f === 0 ? 0 : 5;
      hrctx.fillStyle = '#181615';
      hrctx.fillRect(8 + legRun, 34, 6, 6);
      hrctx.fillRect(18 - legRun, 34, 6, 6);
      hrctx.restore();
    }
    this.sprites.hot_runner = hotRunner.canvas;

    // 6. giant_mortar (ครกหินยักษ์)
    const giantMortar = createOffscreen(52, 52);
    const gmctx = giantMortar.ctx;
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(7, 19, 38, 32);
    gmctx.fillRect(11, 13, 30, 9);
    gmctx.fillRect(21, 1, 10, 22);
    gmctx.fillStyle = '#64748b';
    gmctx.fillRect(9, 21, 34, 28);
    gmctx.fillRect(13, 15, 26, 7);
    gmctx.fillStyle = '#475569';
    gmctx.fillRect(11, 35, 30, 12);
    gmctx.fillStyle = '#94a3b8';
    gmctx.fillRect(13, 16, 12, 3);
    gmctx.fillStyle = '#181615';
    gmctx.fillRect(18, 25, 4, 3);
    gmctx.fillRect(30, 25, 4, 3);
    gmctx.fillRect(22, 31, 8, 2);
    gmctx.fillStyle = '#78350f';
    gmctx.fillRect(23, 3, 6, 20);
    this.sprites.giant_mortar = giantMortar.canvas;
  }

  /**
   * 🌶️ ปีศาจพริกแดงกระโดด (Ground Chili Devil)
   * Handcrafted 4-frame 128-bit Neo-Retro animated spritesheet with squash & stretch,
   * curved organic chili body, curled devil tail, twin green calyx horns, amber devil eyes, and ivory fangs.
   */
  bakeGroundChiliDevil() {
    const frameW = 36, frameH = 38;
    const { canvas, ctx } = createOffscreen(frameW * 4, frameH);

    for (let f = 0; f < 4; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);

      // Animation parameters:
      // f0: Neutral stride / coiled ready
      // f1: Ground compress (squash 2px down)
      // f2: Leap apex / stretch (extend 2px up, whip tail)
      // f3: Descent / settle
      const sqY = f === 1 ? 2 : (f === 2 ? -2 : 0);
      const sqH = f === 1 ? -2 : (f === 2 ? 2 : 0);
      const sqW = f === 1 ? 2 : (f === 2 ? -1 : 0);
      const tailWhip = f === 2 ? -3 : (f === 1 ? 2 : (f === 3 ? -1 : 0));

      // 1. Green Devil Horns (Chili Calyx/Stem)
      // Left horn
      ctx.fillStyle = '#181615';
      ctx.fillRect(8 - sqW, 4 + sqY, 5, 8);
      ctx.fillRect(10 - sqW, 2 + sqY, 4, 4);
      ctx.fillRect(12 - sqW, 7 + sqY, 5, 6);
      // Right horn
      ctx.fillRect(23 + sqW, 4 + sqY, 5, 8);
      ctx.fillRect(22 + sqW, 2 + sqY, 4, 4);
      ctx.fillRect(19 + sqW, 7 + sqY, 5, 6);
      // Horn connector calyx base
      ctx.fillRect(11, 9 + sqY, 14, 4);

      // Horn Green Fill & Shading
      ctx.fillStyle = '#15803d'; // Forest green shadow
      ctx.fillRect(9 - sqW, 5 + sqY, 3, 6);
      ctx.fillRect(24 + sqW, 5 + sqY, 3, 6);
      ctx.fillStyle = '#16a34a'; // Vibrant leaf green
      ctx.fillRect(10 - sqW, 3 + sqY, 3, 4);
      ctx.fillRect(23 + sqW, 3 + sqY, 3, 4);
      ctx.fillRect(12, 10 + sqY, 12, 2);
      ctx.fillStyle = '#4ade80'; // Specular tip highlights
      ctx.fillRect(11 - sqW, 3 + sqY, 1, 2);
      ctx.fillRect(23 + sqW, 3 + sqY, 1, 2);

      // 2. Chili Body Outer Dark Outline (#181615)
      // Rounded head / torso bulb
      ctx.fillStyle = '#181615';
      ctx.fillRect(10 - sqW, 11 + sqY, 16 + sqW * 2, 15 + sqH);
      ctx.fillRect(8 - sqW, 13 + sqY, 20 + sqW * 2, 11 + sqH);
      ctx.fillRect(12 - sqW, 9 + sqY, 12 + sqW * 2, 18 + sqH);

      // Curving lower body tapering towards tail
      ctx.fillRect(14, 24 + sqY, 10, 6 + sqH);
      ctx.fillRect(11, 27 + sqY, 10, 6);

      // Curled devil tail curving back and UPWARDS
      ctx.fillRect(6 + tailWhip, 29 + sqY, 8, 5);
      ctx.fillRect(3 + tailWhip, 26 + sqY, 6, 6);
      ctx.fillRect(2 + tailWhip, 21 + sqY, 4, 7);
      ctx.fillRect(4 + tailWhip, 19 + sqY, 3, 4);

      // 3. Chili Body Red Fill & Multi-tier Shading
      // Base vibrant chili red (#dc2626)
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(11 - sqW, 12 + sqY, 14 + sqW * 2, 13 + sqH);
      ctx.fillRect(9 - sqW, 14 + sqY, 18 + sqW * 2, 9 + sqH);
      ctx.fillRect(15, 25 + sqY, 8, 4 + sqH);
      ctx.fillRect(12, 28 + sqY, 8, 4);
      ctx.fillRect(7 + tailWhip, 30 + sqY, 6, 3);
      ctx.fillRect(4 + tailWhip, 27 + sqY, 4, 4);
      ctx.fillRect(3 + tailWhip, 22 + sqY, 2, 5);

      // Shadow Crimson (#991b1b) along bottom-right underbelly
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(22 + sqW, 15 + sqY, 4, 8 + sqH);
      ctx.fillRect(19, 25 + sqY, 4, 4);
      ctx.fillRect(16, 29 + sqY, 4, 2);
      ctx.fillRect(8 + tailWhip, 32 + sqY, 4, 1);

      // Highlights (#ef4444 & #f87171) on forehead & upper curved ridge
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(11 - sqW, 12 + sqY, 4, 4);
      ctx.fillRect(9 - sqW, 14 + sqY, 3, 5);
      ctx.fillStyle = '#f87171'; // Catchlight
      ctx.fillRect(10 - sqW, 13 + sqY, 2, 2);
      if (f === 2) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(4 + tailWhip, 18 + sqY, 2, 2);
      }

      // 4. Evil Menacing Face
      // Left eye socket
      ctx.fillStyle = '#181615';
      ctx.fillRect(11 - sqW, 14 + sqY, 6, 5);
      // Right eye socket
      ctx.fillRect(19 + sqW, 14 + sqY, 6, 5);

      // Glowing Amber Sclera (#fef08a)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(12 - sqW, 15 + sqY, 4, 3);
      ctx.fillRect(20 + sqW, 15 + sqY, 4, 3);

      // Piercing Pupils (#0f172a with red core)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14 - sqW, 15 + sqY, 2, 3);
      ctx.fillRect(20 + sqW, 15 + sqY, 2, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(14 - sqW, 16 + sqY, 1, 1);
      ctx.fillRect(20 + sqW, 16 + sqY, 1, 1);

      // 5. Sinister Devil Grin & Ivory Fangs
      const mouthY = 19 + sqY + (f === 1 ? 1 : 0);
      ctx.fillStyle = '#181615';
      ctx.fillRect(13 - sqW, mouthY, 11 + sqW * 2, 5);
      ctx.fillStyle = '#450a0a'; // Deep maroon mouth
      ctx.fillRect(14 - sqW, mouthY + 1, 9 + sqW * 2, 3);

      // Sharp Ivory Fangs (#ffffff)
      ctx.fillStyle = '#ffffff';
      // Upper fangs pointing DOWN
      ctx.fillRect(14 - sqW, mouthY, 2, 2);
      ctx.fillRect(18, mouthY, 2, 2);
      ctx.fillRect(21 + sqW, mouthY, 2, 2);
      // Lower fangs pointing UP
      ctx.fillRect(16 - sqW, mouthY + 3, 2, 2);
      ctx.fillRect(20 + sqW, mouthY + 3, 2, 2);

      ctx.restore();
    }
    return canvas;
  }

  /**
   * 🌶️ ปีศาจพริกแดงเวหา (Aerial / Flying Chili Devil)
   * Flying Chili Devil with fiery wings, hovering sine undulation, curved devil tail,
   * evil eyes, and trailing spicy fire sparks.
   */
  bakeFlyingChiliDevil() {
    const frameW = 38, frameH = 38;
    const { canvas, ctx } = createOffscreen(frameW * 4, frameH);

    for (let f = 0; f < 4; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);

      const hoverY = f === 0 ? 0 : (f === 1 ? 1 : (f === 2 ? -1 : 0));
      const wingPos = f === 0 ? -2 : (f === 1 ? 1 : (f === 2 ? 3 : 0));
      const tailWhip = f === 2 ? -3 : (f === 1 ? 2 : 0);

      // 1. Fiery Devil Wings (Flapping rhythmically)
      // Left Wing
      ctx.fillStyle = '#181615';
      ctx.fillRect(1, 10 + hoverY + wingPos, 10, 8);
      ctx.fillRect(4, 7 + hoverY + wingPos, 7, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(2, 11 + hoverY + wingPos, 8, 6);
      ctx.fillRect(5, 8 + hoverY + wingPos, 5, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(4, 12 + hoverY + wingPos, 5, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, 11 + hoverY + wingPos, 2, 2);

      // Right Wing
      ctx.fillStyle = '#181615';
      ctx.fillRect(27, 10 + hoverY + wingPos, 10, 8);
      ctx.fillRect(27, 7 + hoverY + wingPos, 7, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(28, 11 + hoverY + wingPos, 8, 6);
      ctx.fillRect(28, 8 + hoverY + wingPos, 5, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(29, 12 + hoverY + wingPos, 5, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(34, 11 + hoverY + wingPos, 2, 2);

      // 2. Horns (Twin Green Calyx Horns)
      ctx.fillStyle = '#181615';
      ctx.fillRect(9, 3 + hoverY, 5, 8);
      ctx.fillRect(11, 1 + hoverY, 4, 4);
      ctx.fillRect(24, 3 + hoverY, 5, 8);
      ctx.fillRect(23, 1 + hoverY, 4, 4);
      ctx.fillRect(12, 8 + hoverY, 14, 4);

      ctx.fillStyle = '#15803d';
      ctx.fillRect(10, 4 + hoverY, 3, 6);
      ctx.fillRect(25, 4 + hoverY, 3, 6);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(11, 2 + hoverY, 3, 4);
      ctx.fillRect(24, 2 + hoverY, 3, 4);
      ctx.fillRect(13, 9 + hoverY, 12, 2);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(12, 2 + hoverY, 1, 2);
      ctx.fillRect(24, 2 + hoverY, 1, 2);

      // 3. Chili Body Outer Dark Outline
      ctx.fillStyle = '#181615';
      ctx.fillRect(11, 10 + hoverY, 16, 15);
      ctx.fillRect(9, 12 + hoverY, 20, 11);
      ctx.fillRect(13, 8 + hoverY, 12, 18);
      ctx.fillRect(15, 23 + hoverY, 10, 6);
      ctx.fillRect(12, 26 + hoverY, 10, 6);

      // Curled devil tail hooking UPWARDS
      ctx.fillRect(7 + tailWhip, 28 + hoverY, 8, 5);
      ctx.fillRect(4 + tailWhip, 25 + hoverY, 6, 6);
      ctx.fillRect(3 + tailWhip, 20 + hoverY, 4, 7);
      ctx.fillRect(5 + tailWhip, 18 + hoverY, 3, 4);

      // 4. Chili Body Red Fill & Shading
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(12, 11 + hoverY, 14, 13);
      ctx.fillRect(10, 13 + hoverY, 18, 9);
      ctx.fillRect(16, 24 + hoverY, 8, 4);
      ctx.fillRect(13, 27 + hoverY, 8, 4);
      ctx.fillRect(8 + tailWhip, 29 + hoverY, 6, 3);
      ctx.fillRect(5 + tailWhip, 26 + hoverY, 4, 4);
      ctx.fillRect(4 + tailWhip, 21 + hoverY, 2, 5);

      // Shadow Crimson
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(23, 14 + hoverY, 4, 8);
      ctx.fillRect(20, 24 + hoverY, 4, 4);
      ctx.fillRect(17, 28 + hoverY, 4, 2);

      // Highlights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(12, 11 + hoverY, 4, 4);
      ctx.fillRect(10, 13 + hoverY, 3, 5);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(11, 12 + hoverY, 2, 2);

      // Trailing Fire Spark on tail tip
      ctx.fillStyle = '#facc15';
      ctx.fillRect(5 + tailWhip, 17 + hoverY, 2, 2);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(4 + tailWhip, 15 + hoverY, 2, 2);

      // 5. Menacing Eyes
      ctx.fillStyle = '#181615';
      ctx.fillRect(12, 13 + hoverY, 6, 5);
      ctx.fillRect(20, 13 + hoverY, 6, 5);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(13, 14 + hoverY, 4, 3);
      ctx.fillRect(21, 14 + hoverY, 4, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(15, 14 + hoverY, 2, 3);
      ctx.fillRect(21, 14 + hoverY, 2, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(15, 15 + hoverY, 1, 1);
      ctx.fillRect(21, 15 + hoverY, 1, 1);

      // 6. Devil Grin & Fangs
      ctx.fillStyle = '#181615';
      ctx.fillRect(14, 18 + hoverY, 11, 5);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(15, 19 + hoverY, 9, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(15, 18 + hoverY, 2, 2);
      ctx.fillRect(19, 18 + hoverY, 2, 2);
      ctx.fillRect(22, 18 + hoverY, 2, 2);
      ctx.fillRect(17, 21 + hoverY, 2, 2);
      ctx.fillRect(21, 21 + hoverY, 2, 2);

      ctx.restore();
    }
    return canvas;
  }

  // =========================================================================
  // 4. INTERACTIVE STAGE ELEMENTS
  // =========================================================================
  bakeInteractiveElements() {
    // 1. satow_spring (กระดานสปริงฝักสะตอ)
    const springPad = createOffscreen(36 * 2, 26);
    const spctx = springPad.ctx;
    for (let f = 0; f < 2; f++) {
      spctx.save();
      spctx.translate(f * 36, 0);
      const compress = f === 1 ? 5 : 0;
      spctx.fillStyle = '#181615';
      spctx.fillRect(3, 21, 30, 5);
      spctx.fillStyle = '#94a3b8';
      spctx.fillRect(5, 22, 26, 3);
      spctx.fillStyle = '#181615';
      spctx.fillRect(14, 13 + compress, 8, 9 - compress);
      spctx.fillStyle = '#cbd5e1';
      spctx.fillRect(15, 14 + compress, 6, 7 - compress);
      spctx.fillStyle = '#181615';
      spctx.fillRect(1, 5 + compress, 34, 9);
      spctx.fillRect(5, 3 + compress, 26, 13);
      spctx.fillStyle = '#15803d';
      spctx.fillRect(2, 6 + compress, 32, 7);
      spctx.fillRect(6, 4 + compress, 24, 11);
      spctx.fillStyle = '#86efac';
      spctx.fillRect(9, 5 + compress, 18, 3);
      spctx.restore();
    }
    this.sprites.satow_spring = springPad.canvas;

    // 2. steam_jet (ท่อไอน้ำแกงไตปลา)
    const steamVent = createOffscreen(28, 20);
    const svctx = steamVent.ctx;
    svctx.fillStyle = '#181615';
    svctx.fillRect(3, 9, 22, 11);
    svctx.fillRect(1, 5, 26, 6);
    svctx.fillStyle = '#b45309';
    svctx.fillRect(4, 10, 20, 9);
    svctx.fillStyle = '#f59e0b';
    svctx.fillRect(3, 6, 22, 4);
    this.sprites.steam_vent = steamVent.canvas;
  }

  // =========================================================================
  // 5. CLEAN MINIMALIST NAKHON PHANOM ARCHITECTURAL LANDMARKS (LAYER 3)
  // =========================================================================
  bakeLandmarks() {
    // 1. "ในบ้าน" (In The Haus) Riverside Heritage Cafe Landmark
    const cafe = createOffscreen(150, 125);
    const cctx = cafe.ctx;
    const cy = 115;

    cctx.fillStyle = '#181615';
    cctx.fillRect(10, cy - 95, 130, 95);
    cctx.fillStyle = '#faf7f5'; // Cream limestone facade
    cctx.fillRect(12, cy - 93, 126, 91);

    cctx.fillStyle = '#bd4924'; // Warm Terracotta base
    cctx.fillRect(12, cy - 20, 126, 20);

    // Warm Lit Display Window with Roastery & Barista silhouette
    cctx.fillStyle = '#181615';
    cctx.fillRect(18, cy - 56, 52, 34);
    cctx.fillStyle = '#fef08a';
    cctx.fillRect(20, cy - 54, 48, 30);
    cctx.fillStyle = '#181615';
    cctx.fillRect(36, cy - 44, 14, 18);
    cctx.fillRect(38, cy - 48, 10, 6);
    // Coffee roaster / espresso machine silhouette
    cctx.fillRect(52, cy - 38, 12, 12);
    cctx.fillStyle = '#ea580c';
    cctx.fillRect(54, cy - 36, 4, 4);

    // Teak Wood Door & Brass Handle
    cctx.fillStyle = '#181615';
    cctx.fillRect(82, cy - 60, 30, 58);
    cctx.fillStyle = '#43634b'; // Deep olive green
    cctx.fillRect(84, cy - 58, 26, 56);
    cctx.fillStyle = '#facc15'; // Brass handle
    cctx.fillRect(104, cy - 32, 3, 4);

    // Striped Terracotta & Olive Awning
    const awningY = cy - 62;
    cctx.fillStyle = '#181615';
    cctx.fillRect(14, awningY - 4, 122, 14);
    for (let ax = 16; ax < 134; ax += 12) {
      cctx.fillStyle = ((ax / 12) % 2 === 0) ? '#bd4924' : '#43634b';
      cctx.fillRect(ax, awningY - 3, 11, 11);
    }

    // Signboard: "IN THE HAUS // COFFEE & ROASTERY"
    cctx.fillStyle = '#181615';
    cctx.fillRect(20, cy - 86, 80, 20);
    cctx.fillStyle = '#fef08a';
    cctx.fillRect(22, cy - 84, 76, 16);
    cctx.fillStyle = '#181615';
    cctx.font = 'bold 9px monospace';
    cctx.fillText('IN THE HAUS', 26, cy - 73);

    // Roof & Chimney with gentle coffee smoke
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, cy - 104, 134, 11);
    cctx.fillRect(118, cy - 116, 14, 14);
    cctx.fillStyle = '#ea580c';
    cctx.fillRect(10, cy - 103, 130, 9);
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(120, cy - 115, 10, 12);

    // Veranda Tabby Cat
    cctx.fillStyle = '#181615';
    cctx.fillRect(52, cy - 110, 18, 10);
    cctx.fillStyle = '#faf7f5';
    cctx.fillRect(53, cy - 109, 16, 8);
    cctx.fillStyle = '#ea580c';
    cctx.fillRect(54, cy - 109, 6, 5);

    this.sprites.cafe_in_the_haus = cafe.canvas;

    // 2. โบสถ์นักบุญอันนา หนองแสง (St. Anne's Catholic Church)
    // Iconic twin-spired French-Colonial Catholic Cathedral on the Mekong riverbank
    const church = createOffscreen(110, 210);
    const chctx = church.ctx;
    const chy = 200;

    // Outer Dark Silhouette
    chctx.fillStyle = '#181615';
    chctx.fillRect(20, chy - 110, 70, 110); // Center nave
    chctx.fillRect(10, chy - 165, 26, 165); // Left Spire Tower
    chctx.fillRect(74, chy - 165, 26, 165); // Right Spire Tower
    // Crosses on spires
    chctx.fillRect(21, chy - 188, 4, 25);
    chctx.fillRect(17, chy - 182, 12, 4);
    chctx.fillRect(85, chy - 188, 4, 25);
    chctx.fillRect(81, chy - 182, 12, 4);

    // Pastel Colonial Yellow & White Facade
    chctx.fillStyle = '#fef08a'; // French Colonial Mustard/Cream
    chctx.fillRect(22, chy - 108, 66, 106);
    chctx.fillRect(12, chy - 163, 22, 161);
    chctx.fillRect(76, chy - 163, 22, 161);

    // White Trims & Spire roofs
    chctx.fillStyle = '#faf7f5';
    chctx.fillRect(14, chy - 160, 18, 20);
    chctx.fillRect(78, chy - 160, 18, 20);
    chctx.fillRect(30, chy - 105, 50, 10);

    // Golden Crosses
    chctx.fillStyle = '#facc15';
    chctx.fillRect(22, chy - 187, 2, 23);
    chctx.fillRect(18, chy - 181, 10, 2);
    chctx.fillRect(86, chy - 187, 2, 23);
    chctx.fillRect(82, chy - 181, 10, 2);

    // Arched Stained Glass Windows & Central Rose Window
    chctx.fillStyle = '#181615';
    chctx.fillRect(44, chy - 85, 22, 22); // Rose window box
    chctx.fillStyle = '#0284c7'; // Blue stained glass
    chctx.fillRect(46, chy - 83, 18, 18);
    chctx.fillStyle = '#ef4444';
    chctx.fillRect(52, chy - 77, 6, 6);

    // Church Arched Portal Door
    chctx.fillStyle = '#181615';
    chctx.fillRect(42, chy - 50, 26, 50);
    chctx.fillStyle = '#78350f'; // Teak doors
    chctx.fillRect(44, chy - 48, 22, 48);

    // Tower Belfry Arches
    chctx.fillStyle = '#181615';
    chctx.fillRect(17, chy - 130, 12, 24);
    chctx.fillRect(81, chy - 130, 12, 24);
    chctx.fillStyle = '#ca8a04'; // Brass bells inside
    chctx.fillRect(21, chy - 124, 4, 8);
    chctx.fillRect(85, chy - 124, 4, 8);

    this.sprites.st_anne_church = church.canvas;

    // 3. หอนาฬิกาเวียดนามอนุสรณ์ (Vietnamese Memorial Clock Tower)
    const clockTower = createOffscreen(64, 160);
    const ctctx = clockTower.ctx;
    const baseH = 150;

    ctctx.fillStyle = '#181615';
    ctctx.fillRect(14, baseH - 105, 36, 105);
    ctctx.fillRect(10, baseH - 18, 44, 18);
    ctctx.fillRect(16, baseH - 136, 32, 33);
    ctctx.fillRect(27, baseH - 152, 10, 18);
    // Spire needle tip
    ctctx.fillRect(31, baseH - 158, 2, 8);

    ctctx.fillStyle = '#fed7aa'; // Terracotta clay brick body
    ctctx.fillRect(16, baseH - 103, 32, 86);
    ctctx.fillStyle = '#ea580c'; // Red brick accent
    ctctx.fillRect(12, baseH - 16, 40, 14);
    ctctx.fillRect(18, baseH - 134, 28, 29);

    // Working Clock Face with Black Hands
    ctctx.fillStyle = '#ffffff';
    ctctx.beginPath();
    ctctx.arc(32, baseH - 120, 10, 0, Math.PI * 2);
    ctctx.fill();
    ctctx.fillStyle = '#181615';
    ctctx.fillRect(31, baseH - 126, 2, 7);
    ctctx.fillRect(31, baseH - 120, 6, 2);

    this.sprites.clock_tower = clockTower.canvas;

    // 4. พิพิธภัณฑ์จวนผู้ว่าราชการจังหวัดนครพนม (Old Governor's Residence Museum)
    // 1914 Stately French-Colonial yellow brick residence
    const gov = createOffscreen(140, 115);
    const gctx = gov.ctx;
    const govy = 105;

    gctx.fillStyle = '#181615';
    gctx.fillRect(8, govy - 75, 124, 75);
    gctx.fillRect(4, govy - 88, 132, 15); // Roof eaves
    gctx.fillStyle = '#fef08a'; // Rich yellow colonial stucco
    gctx.fillRect(10, govy - 73, 120, 71);
    gctx.fillStyle = '#ea580c'; // Terracotta roof
    gctx.fillRect(6, govy - 86, 128, 12);

    // Colonial Arched Windows with Olive Shutters
    const winX = [18, 44, 78, 104];
    winX.forEach(wx => {
      // 2nd floor arched windows
      gctx.fillStyle = '#181615';
      gctx.fillRect(wx, govy - 66, 18, 24);
      gctx.fillStyle = '#43634b'; // Green shutters
      gctx.fillRect(wx - 2, govy - 64, 4, 20);
      gctx.fillRect(wx + 16, govy - 64, 4, 20);
      gctx.fillStyle = '#fef9c3';
      gctx.fillRect(wx + 3, govy - 63, 12, 18);

      // 1st floor arched portico
      gctx.fillStyle = '#181615';
      gctx.fillRect(wx, govy - 36, 18, 34);
      gctx.fillStyle = '#faf7f5';
      gctx.fillRect(wx + 2, govy - 34, 14, 32);
    });

    this.sprites.governor_residence = gov.canvas;

    // 5. องค์พญาศรีสัตตนาคราช (Phaya Si Satta Nakarat)
    // Seven-headed grand brass Naga monument spitting turquoise river spray
    const naga = createOffscreen(88, 140);
    const nctx = naga.ctx;
    const ny = 130;

    // Monument Pedestal Base
    nctx.fillStyle = '#181615';
    nctx.fillRect(8, ny - 38, 72, 38);
    nctx.fillStyle = '#334155'; // Dark slate pedestal
    nctx.fillRect(10, ny - 36, 68, 34);
    nctx.fillStyle = '#cbd5e1';
    nctx.fillRect(14, ny - 32, 60, 4);

    // Coiled Serpent Body
    nctx.fillStyle = '#181615';
    nctx.fillRect(16, ny - 78, 56, 42);
    nctx.fillStyle = '#ca8a04'; // Burnished Brass / Gold
    nctx.fillRect(18, ny - 76, 52, 38);
    nctx.fillStyle = '#eab308';
    nctx.fillRect(22, ny - 72, 44, 12);

    // Seven Crowned Golden Naga Heads
    const headXOffsets = [6, 15, 24, 33, 42, 51, 60];
    headXOffsets.forEach((hx, i) => {
      // Middle head (index 3) is tallest
      const peak = i === 3 ? 20 : (i === 2 || i === 4 ? 13 : (i === 1 || i === 5 ? 7 : 0));
      nctx.fillStyle = '#181615';
      nctx.fillRect(hx, ny - 105 - peak, 10, 32 + peak);
      nctx.fillStyle = '#facc15'; // Brilliant gold
      nctx.fillRect(hx + 1, ny - 103 - peak, 8, 30 + peak);
      // Red Ruby Eyes
      nctx.fillStyle = '#ef4444';
      nctx.fillRect(hx + 3, ny - 100 - peak, 3, 3);
      // Dragon horn crest
      nctx.fillStyle = '#ca8a04';
      nctx.fillRect(hx + 4, ny - 108 - peak, 2, 6);
    });

    this.sprites.phaya_naga = naga.canvas;

    // 6. ประเพณีไหลเรือไฟนครพนม (Lai Ruea Fai - Mekong Illuminated Boat)
    // Giant bamboo boat on the Mekong with flaming oil torches and naga silhouette
    const boat = createOffscreen(144, 90);
    const bctx = boat.ctx;
    const by = 80;

    // Bamboo Hull floating on water
    bctx.fillStyle = '#181615';
    bctx.fillRect(10, by - 12, 124, 12);
    bctx.fillRect(2, by - 8, 140, 8);
    bctx.fillStyle = '#78350f'; // Dark bamboo
    bctx.fillRect(12, by - 10, 120, 8);

    // Glowing Bamboo Scaffold & Lantern Silhouette
    bctx.fillStyle = '#f59e0b';
    bctx.fillRect(24, by - 55, 96, 44);
    bctx.fillStyle = '#facc15';
    bctx.fillRect(36, by - 70, 72, 58);
    // Golden Stupa / Phra That Phanom motif on the fireboat
    bctx.fillRect(66, by - 82, 12, 14);

    // Thousands of flickering flame dots
    bctx.fillStyle = '#ef4444';
    for (let lx = 20; lx < 125; lx += 8) {
      bctx.fillRect(lx, by - 14, 4, 4);
      bctx.fillRect(lx + 4, by - 35, 4, 4);
      bctx.fillRect(lx + 2, by - 55, 4, 4);
    }
    bctx.fillStyle = '#fef08a';
    for (let lx = 22; lx < 122; lx += 8) {
      bctx.fillRect(lx, by - 13, 2, 2);
      bctx.fillRect(lx + 4, by - 34, 2, 2);
    }

    this.sprites.lai_ruea_fai = boat.canvas;

    // 7. ต้นหางนกยูงฝรั่งริมโขง (Riverside Poinciana / Flame Tree)
    const tree = createOffscreen(72, 120);
    const tctx = tree.ctx;
    const ty = 115;

    // Gnarled Wooden Trunk
    tctx.fillStyle = '#181615';
    tctx.fillRect(30, ty - 65, 12, 65);
    tctx.fillRect(24, ty - 25, 24, 25);
    tctx.fillStyle = '#451a03';
    tctx.fillRect(32, ty - 63, 8, 61);

    // Vibrant Vermilion & Emerald Leaf Canopy
    tctx.fillStyle = '#181615';
    tctx.fillRect(8, ty - 110, 56, 52);
    tctx.fillRect(18, ty - 118, 36, 12);
    tctx.fillStyle = '#15803d'; // Forest foliage
    tctx.fillRect(10, ty - 108, 52, 48);
    tctx.fillRect(20, ty - 116, 32, 10);
    // Blazing red poinciana blossoms
    tctx.fillStyle = '#ea580c';
    tctx.fillRect(14, ty - 104, 18, 18);
    tctx.fillRect(38, ty - 106, 20, 20);
    tctx.fillRect(24, ty - 92, 24, 16);
    tctx.fillStyle = '#facc15'; // Golden stamen dots
    tctx.fillRect(20, ty - 98, 4, 4);
    tctx.fillRect(44, ty - 100, 4, 4);

    this.sprites.poinciana_tree = tree.canvas;

    // 8. Antique Sunthorn Wichit Street Lamp
    const streetLamp = createOffscreen(24, 85);
    const lctx = streetLamp.ctx;
    lctx.fillStyle = '#181615';
    lctx.fillRect(10, 18, 4, 66);
    lctx.fillRect(6, 80, 12, 5);
    lctx.fillRect(4, 6, 16, 14);
    lctx.fillStyle = '#fef08a';
    lctx.fillRect(6, 8, 12, 10);
    this.sprites.street_lamp = streetLamp.canvas;
  }

  // =========================================================================
  // 6. MEKONG RIVERFRONT MULTI-PLANE RENDERING (VERTICAL 9:16 AWARE)
  // =========================================================================
  drawBackground(ctx, width, height, groundY, distanceRun, frame, spicyTier, feverTimer) {
    // 1. Dynamic 4-Period Sky Palette
    let skyColor = '#f5f2eb';        // Tier 1: Crisp Morning Ivory
    let horizonColor = '#fef3c7';    // Soft warm dawn glow
    if (feverTimer > 0) {
      skyColor = '#fef9c3';          // Happy Golden Joy
      horizonColor = '#fde047';
    } else if (spicyTier === 4) {
      skyColor = '#090d16';          // Tier 4: Midnight Lai Ruea Fai
      horizonColor = '#172554';
    } else if (spicyTier === 3) {
      skyColor = '#1c1917';          // Tier 3: Sunset Terracotta Twilight
      horizonColor = '#ea580c';
    } else if (spicyTier === 2) {
      skyColor = '#38bdf8';          // Tier 2: Midday Clear Cyan Sky
      horizonColor = '#bae6fd';
    }

    // Sky Vertical Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, skyColor);
    skyGrad.addColorStop(0.85, horizonColor);
    skyGrad.addColorStop(1, horizonColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars in Tier 4 / Midnight Mode
    if (spicyTier === 4) {
      ctx.fillStyle = '#fef08a';
      for (let s = 0; s < 30; s++) {
        const sx = ((s * 47) + (distanceRun * 0.02)) % width;
        const sy = (s * 19) % (groundY - 120);
        const blink = Math.sin(frame * 0.1 + s) > 0.3 ? 2 : 1;
        ctx.fillRect(sx, sy, blink, blink);
      }
    }

    // Lightning Flash in Extreme Tiers
    if (spicyTier === 4 && (frame % 180 < 3 || frame % 240 < 2)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(0, 0, width, groundY);
    }

    // 2. Celestial Body (Midday Sun / Sunset Sun / Night Moon)
    const sunX = width - 75;
    const sunY = 55;
    if (spicyTier === 4) {
      // Crescent Moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skyColor;
      ctx.beginPath();
      ctx.arc(sunX + 7, sunY - 5, 15, 0, Math.PI * 2);
      ctx.fill();
    } else if (spicyTier === 3) {
      // Golden Hour Sunset Sun sinking behind Lao Mountains
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.arc(sunX, sunY + 20, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sunX, sunY + 20, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Midday / Morning Sun with retro rays
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sunX - 16, sunY - 5, 32, 10);
      ctx.fillRect(sunX - 5, sunY - 16, 10, 32);
      ctx.fillRect(sunX - 12, sunY - 12, 24, 24);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sunX - 9, sunY - 9, 18, 18);
    }

    // 3. Clouds & Mekong Hawks (Layer 0)
    const cloudColor = spicyTier === 4 ? '#1e293b' : (spicyTier === 3 ? '#fed7aa' : '#ffffff');
    const cloud1X = ((width - ((distanceRun * 0.10) % (width + 200)) + width + 200) % (width + 200)) - 80;
    const cloud2X = ((width - (((distanceRun * 0.10) + 320) % (width + 200)) + width + 200) % (width + 200)) - 80;
    this.drawCleanCloud(ctx, cloud1X, 35, cloudColor, spicyTier);
    this.drawCleanCloud(ctx, cloud2X, 75, cloudColor, spicyTier);

    // 4. Far Lao Limestone Mountains - Khammouane Karst (Layer 1)
    const mountainColorFar = spicyTier === 4 ? '#0b132b' : (spicyTier === 3 ? '#431407' : '#94a3b8');
    const mountainColorNear = spicyTier === 4 ? '#1e293b' : (spicyTier === 3 ? '#7c2d12' : '#cbd5e1');

    // Ridge 1 (Distant Jagged Peaks)
    ctx.fillStyle = mountainColorFar;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 75);
    for (let mx = 0; mx <= width; mx += 20) {
      const peak = Math.sin((mx + distanceRun * 0.08) * 0.012) * 28 + Math.cos(mx * 0.04) * 8;
      ctx.lineTo(mx, groundY - 95 + peak);
    }
    ctx.lineTo(width, groundY - 45);
    ctx.lineTo(0, groundY - 45);
    ctx.closePath();
    ctx.fill();

    // Ridge 2 (Closer Karst Hills)
    ctx.fillStyle = mountainColorNear;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 55);
    for (let mx = 0; mx <= width; mx += 25) {
      const peak = Math.sin((mx + distanceRun * 0.16) * 0.018) * 16;
      ctx.lineTo(mx, groundY - 65 + peak);
    }
    ctx.lineTo(width, groundY - 35);
    ctx.lineTo(0, groundY - 35);
    ctx.closePath();
    ctx.fill();

    // 5. Mekong River Waters (Layer 2)
    const riverWaterH = Math.max(28, Math.floor(height * 0.06));
    const riverY = groundY - riverWaterH;
    const riverColor = spicyTier === 4 ? '#082f49' : (spicyTier === 3 ? '#9a3412' : '#0284c7');
    ctx.fillStyle = riverColor;
    ctx.fillRect(0, riverY, width, riverWaterH);

    // Animated Specular River Waves
    ctx.fillStyle = spicyTier === 4 ? '#38bdf8' : '#e0f2fe';
    const waveShift = (frame * 1.5) % 36;
    for (let wx = -36; wx < width; wx += 36) {
      ctx.fillRect(wx + waveShift, riverY + 8, 16, 2);
      ctx.fillRect(wx + waveShift + 18, riverY + 18, 12, 2);
    }

    // In Tier 4 (Night): Lai Ruea Fai Illuminated Boat floating on the river!
    if (spicyTier === 4 && this.sprites.lai_ruea_fai) {
      const boatPos = ((width + 300) - ((distanceRun * 0.35) % (width + 600))) - 150;
      ctx.drawImage(this.sprites.lai_ruea_fai, boatPos, riverY - 45);
      // Golden light reflection in river water
      ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.fillRect(boatPos + 10, riverY + 2, 120, 8);
    }

    // 6. Real Nakhon Phanom Heritage Landmarks on Promenade (Layer 3)
    const scenePeriod = 2600; // Expanded sequence loop
    const getPos = (baseX) => {
      const pos = (baseX - (distanceRun * 0.75)) % scenePeriod;
      return ((pos % scenePeriod) + scenePeriod) % scenePeriod - 160;
    };

    // Landmark 1: "ในบ้าน" (In The Haus Heritage Cafe & Roastery)
    const cafeX = getPos(220);
    if (cafeX > -160 && cafeX < width + 80 && this.sprites.cafe_in_the_haus) {
      ctx.drawImage(this.sprites.cafe_in_the_haus, cafeX, groundY - 118);
    }

    // Landmark 2: โบสถ์นักบุญอันนา หนองแสง (St. Anne's Catholic Church)
    const churchX = getPos(850);
    if (churchX > -120 && churchX < width + 80 && this.sprites.st_anne_church) {
      ctx.drawImage(this.sprites.st_anne_church, churchX, groundY - 198);
    }

    // Landmark 3: หอนาฬิกาเวียดนามอนุสรณ์ (Vietnamese Memorial Clock Tower)
    const clockX = getPos(1480);
    if (clockX > -90 && clockX < width + 80 && this.sprites.clock_tower) {
      ctx.drawImage(this.sprites.clock_tower, clockX, groundY - 148);
    }

    // Landmark 4: พิพิธภัณฑ์จวนผู้ว่าราชการจังหวัดนครพนม (Old Governor's Residence)
    const govX = getPos(2050);
    if (govX > -150 && govX < width + 80 && this.sprites.governor_residence) {
      ctx.drawImage(this.sprites.governor_residence, govX, groundY - 105);
    }

    // Landmark 5: องค์พญาศรีสัตตนาคราช (Phaya Si Satta Nakarat)
    const nagaX = getPos(2420);
    if (nagaX > -100 && nagaX < width + 90 && this.sprites.phaya_naga) {
      ctx.drawImage(this.sprites.phaya_naga, nagaX, groundY - 128);
      // Dynamic turquoise river mist spray from naga mouths
      ctx.fillStyle = '#38bdf8';
      const sprayCycle = (frame * 4) % 36;
      ctx.fillRect(nagaX - 10 - sprayCycle, groundY - 105 + sprayCycle * 0.8, 5, 5);
      ctx.fillRect(nagaX - 18 - sprayCycle, groundY - 100 + sprayCycle * 0.9, 4, 4);
    }

    // Landmark 6: Poinciana Trees & Street Lamps along the Promenade
    for (let tx = 60; tx < scenePeriod; tx += 650) {
      const pX = getPos(tx);
      if (pX > -80 && pX < width + 80 && this.sprites.poinciana_tree) {
        ctx.drawImage(this.sprites.poinciana_tree, pX, groundY - 110);
      }
    }

    for (let lx = 380; lx < scenePeriod; lx += 450) {
      const lampX = getPos(lx);
      if (lampX > -40 && lampX < width + 40 && this.sprites.street_lamp) {
        ctx.drawImage(this.sprites.street_lamp, lampX, groundY - 80);
      }
    }

    // 7. Decorative Riverfront Wrought-Iron Railing (Layer 4)
    ctx.fillStyle = '#181615';
    ctx.fillRect(0, groundY - 14, width, 2); // Top rail
    ctx.fillRect(0, groundY - 2, width, 2);  // Bottom rail
    for (let rx = 0; rx < width; rx += 14) {
      ctx.fillRect(rx, groundY - 14, 2, 14); // Balusters
    }

    // 2px Solid Ground Line
    ctx.fillStyle = '#181615';
    ctx.fillRect(0, groundY, width, 2);

    // Stone Sidewalk Promenade
    const groundBg = spicyTier >= 3 ? '#1e293b' : '#78716c';
    const tileColor = spicyTier >= 3 ? '#0f172a' : '#57534e';
    ctx.fillStyle = groundBg;
    ctx.fillRect(0, groundY + 2, width, height - (groundY + 2));

    // Clean geometric tiles
    ctx.fillStyle = tileColor;
    const tileShift = (distanceRun * 2.2) % 28;
    for (let tx = -28; tx < width; tx += 28) {
      ctx.fillRect(tx + tileShift, groundY + 2, 14, 14);
      ctx.fillRect(tx + tileShift + 14, groundY + 16, 14, 24);
      ctx.fillRect(tx + tileShift, groundY + 40, 14, 30);
    }

    // 8. Drifting Poinciana Blossom Petals in the River Breeze (Layer 5)
    ctx.fillStyle = '#ea580c';
    for (let p = 0; p < 8; p++) {
      const px = ((p * 73) - (frame * 1.8 + distanceRun * 0.5)) % width;
      const actualPx = px < 0 ? px + width : px;
      const py = groundY - 80 + Math.sin(frame * 0.08 + p) * 45;
      ctx.fillRect(actualPx, py, 3, 2);
    }
  }

  drawCleanCloud(ctx, cx, cy, tint, tier) {
    ctx.fillStyle = '#181615';
    ctx.fillRect(cx, cy + 6, 44, 16);
    ctx.fillRect(cx + 8, cy, 28, 24);
    ctx.fillRect(cx + 14, cy - 4, 16, 28);

    ctx.fillStyle = tint;
    ctx.fillRect(cx + 2, cy + 8, 40, 12);
    ctx.fillRect(cx + 10, cy + 2, 24, 20);
    ctx.fillRect(cx + 16, cy - 2, 12, 24);
  }

  /**
   * Draw the Character Sprite with State Matrix
   */
  drawCharacter(ctx, charId, x, y, frame, isGrounded, godModeTimer, feverTimer, scaleX, scaleY, groundY = 185) {
    const sheet = this.sprites[charId] || this.sprites.tai_pla;
    if (!sheet) return;

    ctx.save();

    // Ground Contact Shadow
    const shadowScale = Math.max(0.4, 1.0 - (groundY - y) / 100);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 24, groundY + 2, 16 * shadowScale, 4.0 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // God Mode / Fever Auras
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

    if (charId === 'khao_lam') {
      const magnetWave = (frame * 1.5) % 36;
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 - (magnetWave / 36) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 24, y + 24, 20 + magnetWave, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Transform
    ctx.translate(x + 24, y + 24);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-24, -24);

    let fIdx = 0;
    if (!isGrounded) {
      fIdx = 4;
    } else {
      fIdx = Math.floor((frame / 4) % 4);
    }

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
      my = mon.y + Math.sin(frame * 0.09 + (mon.animPhase || 0)) * 12;
    }

    if (mon.type !== 'hawk' && mon.type !== 'naga_thunder') {
      const hopH = Math.max(0, groundY - my);
      const shadowScale = Math.max(0.35, 1.0 - (hopH / 32));
      ctx.fillStyle = `rgba(0, 0, 0, ${0.20 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(mx + (mon.width / 2), groundY + 2, (mon.width * 0.42) * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mon.type === 'hop_chili' && this.sprites.hop_chili) {
      const f = Math.floor((frame / 5) % 4);
      ctx.drawImage(this.sprites.hop_chili, f * 36, 0, 36, 38, mx, my - 34, 36, 38);
    } else if (mon.type === 'coconut' && this.sprites.coconut) {
      const rot = frame * 0.25;
      ctx.save();
      ctx.translate(mx + 12, my - 12);
      ctx.rotate(rot);
      ctx.drawImage(this.sprites.coconut, -14, -14, 28, 28);
      ctx.restore();
    } else if (mon.type === 'hawk' && this.sprites.hawk) {
      const f = Math.floor((frame / 4) % 4);
      ctx.drawImage(this.sprites.hawk, f * 38, 0, 38, 38, mx, my - 24, 38, 38);
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
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[ WARNING ]', tx - 36, groundY - 25);
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
