/**
 * TextureGenerator.js
 * Registers the Flappy Cat pixel art (see flappyArt.js) as Phaser textures.
 * Every texture is upscaled by the same integer ART_SCALE, so all texels on screen match.
 */
import { buildFlappyArt, ART_SCALE, CAT_FRAME } from './flappyArt';

export function generateGameTextures(scene) {
  if (scene.textures.exists('cat_sheet')) return;

  const art = buildFlappyArt();
  Object.entries(art).forEach(([key, pix]) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, pix.w * ART_SCALE, pix.h * ART_SCALE);
    pix.drawTo(texture.context, 0, 0, ART_SCALE);
    texture.refresh();

    if (key === 'cat_sheet') {
      scene.textures.addSpriteSheet('cat', texture.canvas, {
        frameWidth: CAT_FRAME * ART_SCALE,
        frameHeight: CAT_FRAME * ART_SCALE
      });
    }
  });
}
