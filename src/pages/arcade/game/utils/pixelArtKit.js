/**
 * pixelArtKit.js
 * Tiny pixel-art authoring toolkit shared by the arcade games.
 *
 * Rules this kit exists to enforce:
 * - Art is authored at "art pixel" resolution and upscaled by ONE integer factor,
 *   so every texel on screen is the same size (no mixed pixel densities).
 * - Gameplay objects get a 1px ink outline; scenery does not (depth separation).
 * - Gradients are banded and ordered-dithered, never smooth.
 */

export const INK = '#1B1420';

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

// 4x4 Bayer matrix normalised to 0..1 thresholds
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
].map((row) => row.map((v) => (v + 0.5) / 16));

export function bayer(x, y) {
  return BAYER4[y & 3][x & 3];
}

// Deterministic 0..1 hash so generated scenery is identical on every boot
export function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    this.wrapX = false; // when true, x coordinates wrap (seamless tiling)
  }

  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.wrapX) x = ((x % this.w) + this.w) % this.w;
    if (!color || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = rgb(color);
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = 255;
  }

  has(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.d[(y * this.w + x) * 4 + 3] > 0;
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    }
  }

  // 50% checker fill, used for soft edges and haze
  checker(x, y, w, h, color, phase = 0) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (((x + i + y + j + phase) & 1) === 0) this.set(x + i, y + j, color);
      }
    }
  }

  disc(cx, cy, r, color) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, color);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
  }

  // Draw a character map. Each char indexes into `palette`; unknown chars are transparent.
  map(rows, palette, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (color) this.set(ox + x, oy + y, color);
      }
    }
  }

  // Copy every opaque pixel of another buffer on top of this one
  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.d[i + 3] === 0) continue;
        const tx = ox + x;
        const ty = oy + y;
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const o = (ty * this.w + tx) * 4;
        this.d[o] = src.d[i];
        this.d[o + 1] = src.d[i + 1];
        this.d[o + 2] = src.d[i + 2];
        this.d[o + 3] = 255;
      }
    }
  }

  // 1px outline on every transparent pixel that touches an opaque one (4-neighbour)
  outline(color = INK) {
    const marks = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) {
          marks.push(x, y);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], color);
    return this;
  }

  // New buffer rotated 90 degrees clockwise
  rot90() {
    const out = new Pix(this.h, this.w);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        const o = (x * out.w + (this.h - 1 - y)) * 4;
        out.d[o] = this.d[i];
        out.d[o + 1] = this.d[i + 1];
        out.d[o + 2] = this.d[i + 2];
        out.d[o + 3] = this.d[i + 3];
      }
    }
    return out;
  }

  // Standalone canvas at an integer scale
  toCanvas(scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = this.w * scale;
    canvas.height = this.h * scale;
    this.drawTo(canvas.getContext('2d'), 0, 0, scale);
    return canvas;
  }

  // Paint this buffer into a 2D context at an integer scale with hard pixel edges
  drawTo(ctx, dx = 0, dy = 0, scale = 1) {
    const small = document.createElement('canvas');
    small.width = this.w;
    small.height = this.h;
    small.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, this.w, this.h, dx, dy, this.w * scale, this.h * scale);
  }
}

/**
 * Banded vertical gradient with ordered dithering between bands.
 * `colors` run top to bottom across rows y0..y1-1.
 */
export function ditherGradient(pix, y0, y1, colors, softness = 0.4) {
  const span = Math.max(1, y1 - y0 - 1);
  const lo = (1 - softness) / 2;
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / span) * (colors.length - 1);
    const i = Math.min(colors.length - 1, Math.floor(t));
    const f = Math.max(0, Math.min(1, (t - i - lo) / softness));
    for (let x = 0; x < pix.w; x++) {
      const next = f > bayer(x, y) ? Math.min(colors.length - 1, i + 1) : i;
      pix.set(x, y, colors[next]);
    }
  }
}
