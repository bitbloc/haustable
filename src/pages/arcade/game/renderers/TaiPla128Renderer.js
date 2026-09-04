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
    // 1. hop_chili (พริกขี้หนูกระโดด)
    const hopChili = createOffscreen(32 * 2, 32);
    const hctx = hopChili.ctx;
    for (let f = 0; f < 2; f++) {
      hctx.save();
      hctx.translate(f * 32, 0);
      hctx.fillStyle = '#15803d';
      hctx.fillRect(12, 3, 8, 6);
      hctx.fillRect(10, 7, 12, 4);
      hctx.fillStyle = '#181615';
      hctx.fillRect(7, 9, 18, 18);
      hctx.fillRect(10, 24, 12, 6);
      hctx.fillRect(12, 28, 8, 3);
      hctx.fillStyle = '#dc2626';
      hctx.fillRect(8, 10, 16, 16);
      hctx.fillRect(11, 24, 10, 5);
      hctx.fillStyle = '#ef4444';
      hctx.fillRect(9, 11, 5, 11);
      hctx.fillStyle = '#ffffff';
      hctx.fillRect(9, 14, 5, 5);
      hctx.fillRect(17, 14, 5, 5);
      hctx.fillStyle = '#181615';
      hctx.fillRect(11, 15, 3, 4);
      hctx.fillRect(19, 15, 3, 4);
      hctx.fillStyle = '#facc15';
      hctx.fillRect(7, 12, 18, 2);
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
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, 8, 3, 3);
    cctx.fillRect(17, 8, 3, 3);
    cctx.fillRect(12, 16, 4, 3);
    this.sprites.coconut = coconut.canvas;

    // 3. hawk (เหยี่ยวแม่น้ำโขง)
    const hawk = createOffscreen(36 * 2, 30);
    const hwctx = hawk.ctx;
    for (let f = 0; f < 2; f++) {
      hwctx.save();
      hwctx.translate(f * 36, 0);
      const wingY = f === 0 ? 3 : 13;
      hwctx.fillStyle = '#181615';
      hwctx.fillRect(9, wingY, 20, 9);
      hwctx.fillStyle = '#78350f';
      hwctx.fillRect(10, wingY + 1, 18, 7);
      hwctx.fillStyle = '#181615';
      hwctx.fillRect(7, 11, 22, 14);
      hwctx.fillStyle = '#451a03';
      hwctx.fillRect(8, 12, 20, 12);
      hwctx.fillStyle = '#ffffff';
      hwctx.fillRect(3, 10, 9, 9);
      hwctx.fillStyle = '#facc15';
      hwctx.fillRect(0, 13, 6, 5);
      hwctx.fillStyle = '#dc2626';
      hwctx.fillRect(5, 12, 4, 4);
      hwctx.fillStyle = '#ffffff';
      hwctx.fillRect(6, 13, 2, 2);
      hwctx.restore();
    }
    this.sprites.hawk = hawk.canvas;

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
  // 5. CLEAN MINIMALIST LANDMARKS (LAYER 3)
  // =========================================================================
  bakeLandmarks() {
    // 1. "ในบ้าน" (In The Haus) Riverside Heritage Cafe Landmark
    const cafe = createOffscreen(140, 110);
    const cctx = cafe.ctx;
    const cy = 100;

    cctx.fillStyle = '#181615';
    cctx.fillRect(10, cy - 85, 120, 85);
    cctx.fillStyle = '#faf7f5';
    cctx.fillRect(12, cy - 83, 116, 81);

    cctx.fillStyle = '#bd4924';
    cctx.fillRect(12, cy - 18, 116, 18);

    // Warm Lit Display Window with Barista silhouette
    cctx.fillStyle = '#181615';
    cctx.fillRect(20, cy - 50, 48, 30);
    cctx.fillStyle = '#fef08a';
    cctx.fillRect(22, cy - 48, 44, 26);
    cctx.fillStyle = '#181615';
    cctx.fillRect(38, cy - 40, 12, 16);
    cctx.fillRect(40, cy - 44, 8, 6);

    // Door
    cctx.fillStyle = '#181615';
    cctx.fillRect(78, cy - 54, 26, 52);
    cctx.fillStyle = '#43634b';
    cctx.fillRect(80, cy - 52, 22, 50);
    cctx.fillStyle = '#facc15';
    cctx.fillRect(96, cy - 28, 3, 3);

    // Striped Awning
    const awningY = cy - 56;
    cctx.fillStyle = '#181615';
    cctx.fillRect(14, awningY - 4, 112, 14);
    for (let ax = 16; ax < 124; ax += 12) {
      cctx.fillStyle = ((ax / 12) % 2 === 0) ? '#bd4924' : '#43634b';
      cctx.fillRect(ax, awningY - 3, 11, 11);
    }

    // Signboard: "HAUS CAFE"
    cctx.fillStyle = '#181615';
    cctx.fillRect(22, cy - 78, 70, 20);
    cctx.fillStyle = '#fef08a';
    cctx.fillRect(24, cy - 76, 66, 16);
    cctx.fillStyle = '#181615';
    cctx.font = 'bold 10px monospace';
    cctx.fillText('IN THE HAUS', 26, cy - 65);

    // Roof & Chimney
    cctx.fillStyle = '#181615';
    cctx.fillRect(8, cy - 94, 124, 11);
    cctx.fillRect(110, cy - 104, 12, 12);
    cctx.fillStyle = '#ea580c';
    cctx.fillRect(10, cy - 93, 120, 9);
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(112, cy - 103, 8, 10);

    // Roof Cat
    cctx.fillStyle = '#181615';
    cctx.fillRect(50, cy - 100, 16, 9);
    cctx.fillStyle = '#faf7f5';
    cctx.fillRect(51, cy - 99, 14, 7);
    cctx.fillStyle = '#bd4924';
    cctx.fillRect(52, cy - 99, 5, 4);

    this.sprites.cafe_in_the_haus = cafe.canvas;

    // 2. Vietnamese Memorial Clock Tower
    const clockTower = createOffscreen(60, 130);
    const ctctx = clockTower.ctx;
    const baseH = 120;
    ctctx.fillStyle = '#181615';
    ctctx.fillRect(12, baseH - 85, 36, 85);
    ctctx.fillRect(8, baseH - 15, 44, 15);
    ctctx.fillRect(16, baseH - 110, 28, 26);
    ctctx.fillRect(26, baseH - 124, 8, 15);
    ctctx.fillStyle = '#fed7aa';
    ctctx.fillRect(14, baseH - 83, 32, 68);
    ctctx.fillStyle = '#ea580c';
    ctctx.fillRect(10, baseH - 13, 40, 12);
    ctctx.fillRect(18, baseH - 108, 24, 23);
    ctctx.fillStyle = '#ffffff';
    ctctx.beginPath();
    ctctx.arc(30, baseH - 96, 8, 0, Math.PI * 2);
    ctctx.fill();
    ctctx.fillStyle = '#181615';
    ctctx.fillRect(29, baseH - 101, 2, 6);
    ctctx.fillRect(29, baseH - 96, 5, 2);
    this.sprites.clock_tower = clockTower.canvas;

    // 3. Phaya Si Sattanakharat
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

    // 4. Antique Street Lamp
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
  // 6. CLEAN MEKONG RIVERFRONT RENDERING (FLAT & MINIMALIST)
  // =========================================================================
  drawBackground(ctx, width, height, groundY, distanceRun, frame, spicyTier, feverTimer) {
    // 1. Clean Flat Sky (Zero Muddy Gradient Noise)
    let skyColor = '#f5f2eb';      // Tier 1: Crisp Warm Ivory
    if (feverTimer > 0) {
      skyColor = '#fef9c3';      // Golden Joy
    } else if (spicyTier === 4) {
      skyColor = '#151816';      // Tier 4: Obsidian Night
    } else if (spicyTier === 3) {
      skyColor = '#1e3326';      // Tier 3: Deep Sage Emerald
    } else if (spicyTier === 2) {
      skyColor = '#ea580c';      // Tier 2: Terracotta Sunset
    }

    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, width, height);

    // Lightning flash in Tier 4
    if (spicyTier === 4 && (frame % 150 < 3 || frame % 210 < 2)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, 0, width, groundY);
    }

    // 2. Celestial Body (Clean Flat Sun / Moon)
    const sunX = width - 65;
    const sunY = 38;
    if (spicyTier >= 3) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skyColor;
      ctx.beginPath();
      ctx.arc(sunX + 6, sunY - 4, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = spicyTier === 2 ? '#c2410c' : '#f59e0b';
      ctx.fillRect(sunX - 14, sunY - 4, 28, 8);
      ctx.fillRect(sunX - 4, sunY - 14, 8, 28);
      ctx.fillRect(sunX - 10, sunY - 10, 20, 20);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sunX - 8, sunY - 8, 16, 16);
    }

    // 3. Clean Clouds
    const cloudColor = spicyTier >= 3 ? '#2d4a37' : (spicyTier === 2 ? '#fed7aa' : '#ffffff');
    const cloud1X = ((width - ((distanceRun * 0.12) % (width + 160)) + width + 160) % (width + 160)) - 80;
    const cloud2X = ((width - (((distanceRun * 0.12) + 280) % (width + 160)) + width + 160) % (width + 160)) - 80;
    this.drawCleanCloud(ctx, cloud1X, 22, cloudColor, spicyTier);
    this.drawCleanCloud(ctx, cloud2X, 48, cloudColor, spicyTier);

    // 4. Flat Lao Mountains (Layer 1)
    const mountainColor = spicyTier >= 3 ? '#16261c' : (spicyTier === 2 ? '#9a3412' : '#cbd5e1');
    ctx.fillStyle = mountainColor;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 38);
    for (let mx = 0; mx <= width; mx += 25) {
      const peak = Math.sin((mx + distanceRun * 0.15) * 0.015) * 14;
      ctx.lineTo(mx, groundY - 42 + peak);
    }
    ctx.lineTo(width, groundY - 22);
    ctx.lineTo(0, groundY - 22);
    ctx.closePath();
    ctx.fill();

    // 5. Mekong River Waters (Layer 2)
    const riverColor = spicyTier >= 3 ? '#0e7490' : (spicyTier === 2 ? '#c2410c' : '#38bdf8');
    ctx.fillStyle = riverColor;
    ctx.fillRect(0, groundY - 28, width, 16);

    ctx.fillStyle = spicyTier >= 3 ? '#38bdf8' : '#e0f2fe';
    const waveShift = (frame * 1.8) % 32;
    for (let wx = -32; wx < width; wx += 32) {
      ctx.fillRect(wx + waveShift, groundY - 24, 14, 2);
    }

    // 6. Landmarks (Layer 3)
    const scenePeriod = 1800;
    const getPos = (baseX) => {
      const pos = (baseX - (distanceRun * 0.75)) % scenePeriod;
      return ((pos % scenePeriod) + scenePeriod) % scenePeriod - 150;
    };

    // Landmark A: "ในบ้าน" Riverside Heritage Cafe
    const cafeX = getPos(220);
    if (cafeX > -150 && cafeX < width + 80 && this.sprites.cafe_in_the_haus) {
      ctx.drawImage(this.sprites.cafe_in_the_haus, cafeX, groundY - 106);
    }

    // Landmark B: หอนาฬิกาเวียดนามอนุสรณ์
    const clockX = getPos(800);
    if (clockX > -80 && clockX < width + 80 && this.sprites.clock_tower) {
      ctx.drawImage(this.sprites.clock_tower, clockX, groundY - 118);
    }

    // Landmark C: องค์พญาศรีสัตตนาคราช
    const nagaX = getPos(1350);
    if (nagaX > -90 && nagaX < width + 90 && this.sprites.phaya_naga) {
      ctx.drawImage(this.sprites.phaya_naga, nagaX, groundY - 96);
      ctx.fillStyle = '#38bdf8';
      const waterDrop = (frame * 3) % 24;
      ctx.fillRect(nagaX - 8 - waterDrop, groundY - 80 + waterDrop * 1.5, 4, 4);
    }

    // Landmark D: Street Lamps
    for (let lx = 50; lx < scenePeriod; lx += 450) {
      const lampX = getPos(lx);
      if (lampX > -40 && lampX < width + 40 && this.sprites.street_lamp) {
        ctx.drawImage(this.sprites.street_lamp, lampX, groundY - 72);
      }
    }

    // 7. Clean Dieter Rams Promenade (Layer 4)
    // 2px Solid Ground Line
    ctx.fillStyle = '#181615';
    ctx.fillRect(0, groundY, width, 2);

    // Stone Sidewalk
    const groundBg = spicyTier >= 3 ? '#1e293b' : '#78716c';
    const tileColor = spicyTier >= 3 ? '#0f172a' : '#57534e';
    ctx.fillStyle = groundBg;
    ctx.fillRect(0, groundY + 2, width, height - (groundY + 2));

    // Clean geometric tiles
    ctx.fillStyle = tileColor;
    const tileShift = (distanceRun * 2.2) % 28;
    for (let tx = -28; tx < width; tx += 28) {
      ctx.fillRect(tx + tileShift, groundY + 2, 14, 12);
      ctx.fillRect(tx + tileShift + 14, groundY + 14, 14, 20);
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
