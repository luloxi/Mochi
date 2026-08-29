/**
 * Star-eye compositor for Katho's Mochi.
 *
 * Source art: four-point white star in the viewer's RIGHT eye.
 * Cloak is split red (viewer's left) / yellow (viewer's right).
 * A full scaleX(-1) would swap the cloak, so we never flip the sprite.
 * When walking/facing left, we move only the star (and the other eye's
 * highlight) onto the leading eye and leave the cloak unflipped.
 */

type Eye = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  n: number;
};

function isBlue(r: number, g: number, b: number, a: number) {
  return a > 80 && r < 90 && g > 30 && g < 150 && b > 150;
}

function isWhite(r: number, g: number, b: number, a: number) {
  return a > 180 && r > 220 && g > 220 && b > 220;
}

function isEyeColor(r: number, g: number, b: number, a: number) {
  return isBlue(r, g, b, a) || isWhite(r, g, b, a);
}

function findEyes(data: Uint8ClampedArray, width: number, height: number): Eye[] {
  const filled: number[] = [];
  const idx = (x: number, y: number) => (y * width + x) * 4;
  // Eyes live in the head. Cloak/foot blue outlines below ~0.48 invert the
  // star swap and make the walk look backwards — never treat them as eyes.
  const headMaxY = Math.floor(height * 0.48);
  for (let y = 2; y < Math.min(height - 2, headMaxY); y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = idx(x, y);
      if (!isBlue(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const j = idx(x + dx, y + dy);
          if (isBlue(data[j], data[j + 1], data[j + 2], data[j + 3])) n++;
        }
      }
      if (n >= 16) filled.push(y * width + x);
    }
  }

  const sset = new Set(filled);
  const vis = new Set<number>();
  const comps: number[][] = [];
  for (const p of filled) {
    if (vis.has(p)) continue;
    const stack = [p];
    vis.add(p);
    const c: number[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      c.push(cur);
      const cx = cur % width;
      const cy = (cur / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (sset.has(np) && !vis.has(np)) {
            vis.add(np);
            stack.push(np);
          }
        }
      }
    }
    comps.push(c);
  }

  const eyes: Eye[] = [];
  for (const c of comps) {
    if (c.length < 120 || c.length > 700) continue;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    let sx = 0;
    let sy = 0;
    for (const p of c) {
      const x = p % width;
      const y = (p / width) | 0;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      sx += x;
      sy += y;
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const cy = sy / c.length;
    if (cy >= height * 0.48) continue;
    if (bw < 12 || bh < 12 || bw > 50 || bh > 50) continue;
    if (bh > bw * 1.8 || bw > bh * 2.2) continue;
    eyes.push({
      x0,
      y0,
      x1,
      y1,
      cx: sx / c.length,
      cy,
      n: c.length,
    });
  }

  eyes.sort((a, b) => a.cx - b.cx);
  if (eyes.length <= 2) return eyes;

  let best: { score: number; a: Eye; b: Eye } | null = null;
  for (let i = 0; i < eyes.length; i++) {
    for (let j = i + 1; j < eyes.length; j++) {
      const dx = Math.abs(eyes[i].cx - eyes[j].cx);
      if (dx < 40) continue;
      const dy = Math.abs(eyes[i].cy - eyes[j].cy);
      const score = dy + Math.abs(eyes[i].n - eyes[j].n) * 0.05;
      if (!best || score < best.score) best = { score, a: eyes[i], b: eyes[j] };
    }
  }
  if (!best) return eyes.slice(0, 2);
  return [best.a, best.b].sort((a, b) => a.cx - b.cx);
}

function collectPatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  eye: Eye,
  pad: number,
) {
  const x0 = Math.max(0, eye.x0 - pad);
  const y0 = Math.max(0, eye.y0 - pad);
  const x1 = Math.min(width - 1, eye.x1 + pad);
  const y1 = Math.min(height - 1, eye.y1 + pad);
  const pix: Array<{ x: number; y: number; r: number; g: number; b: number; a: number }> = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isEyeColor(r, g, b, a)) pix.push({ x, y, r, g, b, a });
    }
  }
  return pix;
}

/** Mutates the canvas: star goes to viewer's left eye; cloak stays put. */
export function relocateStarToLeadingEye(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const src = image.data;
  const eyes = findEyes(src, width, height);
  if (eyes.length < 2) return false;
  const left = eyes[0].cx <= eyes[1].cx ? eyes[0] : eyes[1];
  const right = left === eyes[0] ? eyes[1] : eyes[0];
  const leftPix = collectPatch(src, width, height, left, 6);
  const rightPix = collectPatch(src, width, height, right, 6);
  const dx = Math.round(left.cx - right.cx);
  const dy = Math.round(left.cy - right.cy);
  const out = new Uint8ClampedArray(src);
  const stamp = (
    pix: Array<{ x: number; y: number; r: number; g: number; b: number; a: number }>,
    ox: number,
    oy: number,
  ) => {
    for (const p of pix) {
      const nx = p.x + ox;
      const ny = p.y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const i = (ny * width + nx) * 4;
      out[i] = p.r;
      out[i + 1] = p.g;
      out[i + 2] = p.b;
      out[i + 3] = p.a;
    }
  };
  stamp(rightPix, dx, dy);
  stamp(leftPix, -dx, -dy);
  image.data.set(out);
  ctx.putImageData(image, 0, 0);
  return true;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const canvasCache = new Map<string, HTMLCanvasElement>();

function loadImage(src: string) {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite load failed: ${src}`));
    img.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

function compose(img: HTMLImageElement, facingRight: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  // Source art already has the star in the viewer's right / leading-right eye.
  if (!facingRight) relocateStarToLeadingEye(ctx);
  return canvas;
}

/** facingRight: star stays in viewer's right eye. facing left: star moves to the left eye. Cloak never flips. */
export async function getFacingSprite(src: string, facingRight: boolean) {
  const key = `${src}|${facingRight ? "r" : "l"}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const img = await loadImage(src);
  const canvas = compose(img, facingRight);
  canvasCache.set(key, canvas);
  return canvas;
}

export async function drawFacingSprite(
  dest: HTMLCanvasElement,
  src: string,
  facingRight: boolean,
) {
  const sprite = await getFacingSprite(src, facingRight);
  if (dest.width !== sprite.width) dest.width = sprite.width;
  if (dest.height !== sprite.height) dest.height = sprite.height;
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, dest.width, dest.height);
  ctx.drawImage(sprite, 0, 0);
}

export function prefetchFacingSprites(urls: string[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    void getFacingSprite(url, true);
    void getFacingSprite(url, false);
  }
}
