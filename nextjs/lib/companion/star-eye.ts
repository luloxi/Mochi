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

function sample(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
}

/**
 * Eyes sit in the face band, not the ear/cloak outlines. Column-profile of
 * blue in that band yields two peaks: solid left eye, star-filled right eye.
 */
function findEyes(data: Uint8ClampedArray, width: number, height: number): Eye[] {
  const x0 = Math.floor(width * 0.34);
  const x1 = Math.floor(width * 0.66);
  const y0 = Math.floor(height * 0.33);
  const y1 = Math.floor(height * 0.45);
  if (x1 - x0 < 20 || y1 - y0 < 8) return [];

  const col = new Array<number>(width).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const [r, g, b, a] = sample(data, width, x, y);
      if (isBlue(r, g, b, a)) col[x]++;
    }
  }
  const sm = new Array<number>(width).fill(0);
  for (let x = x0; x < x1; x++) {
    let s = 0;
    for (let k = -3; k <= 3; k++) {
      const xx = Math.min(x1 - 1, Math.max(x0, x + k));
      s += col[xx];
    }
    sm[x] = s;
  }

  const peaks: Array<{ x: number; s: number }> = [];
  for (let x = x0 + 4; x < x1 - 4; x++) {
    if (sm[x] >= sm[x - 1] && sm[x] >= sm[x + 1] && sm[x] > sm[x - 4] && sm[x] > sm[x + 4] && sm[x] > 16) {
      peaks.push({ x, s: sm[x] });
    }
  }
  peaks.sort((a, b) => b.s - a.s);

  let pair: [number, number] | null = null;
  let best = -1;
  const minDx = Math.max(24, Math.floor(width * 0.12));
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const dx = Math.abs(peaks[i].x - peaks[j].x);
      if (dx < minDx) continue;
      const score = peaks[i].s + peaks[j].s + dx;
      if (score > best) {
        best = score;
        pair = [peaks[i].x, peaks[j].x];
      }
    }
  }
  if (!pair) return [];

  const box = Math.max(12, Math.round(width * 0.045));
  const eyes: Eye[] = [];
  for (const px of pair) {
    let bestY = Math.floor((y0 + y1) / 2);
    let bestN = -1;
    for (let y = y0; y < y1; y++) {
      let n = 0;
      for (let x = px - box; x <= px + box; x++) {
        if (x < 0 || x >= width) continue;
        const [r, g, b, a] = sample(data, width, x, y);
        if (isBlue(r, g, b, a) || isWhite(r, g, b, a)) n++;
      }
      if (n > bestN) {
        bestN = n;
        bestY = y;
      }
    }
    const ex0 = Math.max(0, px - box);
    const ey0 = Math.max(0, bestY - box);
    const ex1 = Math.min(width - 1, px + box);
    const ey1 = Math.min(height - 1, bestY + box);
    eyes.push({
      x0: ex0,
      y0: ey0,
      x1: ex1,
      y1: ey1,
      cx: px,
      cy: bestY,
      n: bestN,
    });
  }
  return eyes.sort((a, b) => a.cx - b.cx);
}

function isCapeRed(r: number, g: number, b: number, a: number) {
  return a > 160 && r > 150 && r > g + 35 && r > b + 40 && g < 150 && b < 130;
}

function isCapeYellow(r: number, g: number, b: number, a: number) {
  return a > 160 && r > 170 && g > 140 && b <= 150 && g > b + 20 && r > b + 30;
}

function countWhiteInEye(data: Uint8ClampedArray, width: number, height: number, eye: Eye) {
  const radius = Math.max(10, Math.round((eye.x1 - eye.x0 + eye.y1 - eye.y0) / 4) + 6);
  const r2 = radius * radius;
  let n = 0;
  const x0 = Math.max(0, Math.floor(eye.cx - radius));
  const y0 = Math.max(0, Math.floor(eye.cy - radius));
  const x1 = Math.min(width - 1, Math.ceil(eye.cx + radius));
  const y1 = Math.min(height - 1, Math.ceil(eye.cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - eye.cx;
      const dy = y - eye.cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * width + x) * 4;
      if (isWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
    }
  }
  return n;
}

export type CapeHue = "red" | "yellow" | "other";

export function capeCentroids(data: Uint8ClampedArray, width: number, height: number) {
  let redSx = 0;
  let redN = 0;
  let yelSx = 0;
  let yelN = 0;
  let leftRed = 0;
  let leftYel = 0;
  let rightRed = 0;
  let rightYel = 0;
  const y0 = Math.floor(height * 0.52);
  const y1 = Math.floor(height * 0.88);
  const mid = width / 2;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isCapeRed(r, g, b, a)) {
        redSx += x;
        redN++;
        if (x < mid) leftRed++;
        else rightRed++;
      } else if (isCapeYellow(r, g, b, a)) {
        yelSx += x;
        yelN++;
        if (x < mid) leftYel++;
        else rightYel++;
      }
    }
  }
  const leftHue: CapeHue = leftRed >= leftYel && leftRed > 8 ? "red" : leftYel > 8 ? "yellow" : "other";
  const rightHue: CapeHue = rightYel >= rightRed && rightYel > 8 ? "yellow" : rightRed > 8 ? "red" : "other";
  return {
    redCx: redN ? redSx / redN : 0,
    yellowCx: yelN ? yelSx / yelN : 0,
    redN,
    yelN,
    leftHue,
    rightHue,
    redLeftOfYellow: redN > 8 && yelN > 8 ? redSx / redN < yelSx / yelN : false,
  };
}

export function inspectMochiSprite(data: Uint8ClampedArray, width: number, height: number) {
  const eyes = findEyes(data, width, height);
  let starSide: "left" | "right" | "none" = "none";
  let leftWhite = 0;
  let rightWhite = 0;
  if (eyes.length >= 2) {
    const left = eyes[0].cx <= eyes[1].cx ? eyes[0] : eyes[1];
    const right = left === eyes[0] ? eyes[1] : eyes[0];
    leftWhite = countWhiteInEye(data, width, height, left);
    rightWhite = countWhiteInEye(data, width, height, right);
    if (leftWhite > rightWhite) starSide = "left";
    else if (rightWhite > leftWhite) starSide = "right";
  }
  const cape = capeCentroids(data, width, height);
  return {
    eyeCount: eyes.length,
    starSide,
    leftWhite,
    rightWhite,
    capeLeftHue: cape.leftHue,
    capeRightHue: cape.rightHue,
    redLeftOfYellow: cape.redLeftOfYellow,
    cape,
  };
}

/** Mutates the buffer: star goes to viewer's left eye; cloak stays put. */
export function relocateStarToLeadingEyeImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  const eyes = findEyes(data, width, height);
  if (eyes.length < 2) return false;
  const left = eyes[0].cx <= eyes[1].cx ? eyes[0] : eyes[1];
  const right = left === eyes[0] ? eyes[1] : eyes[0];
  const radius = Math.max(
    14,
    Math.round(Math.max(left.x1 - left.x0, right.x1 - right.x0, left.y1 - left.y0, right.y1 - right.y0) / 2) + 2,
  );
  const r2 = radius * radius;
  const src = new Uint8ClampedArray(data);
  const lcx = Math.round(left.cx);
  const lcy = Math.round(left.cy);
  const rcx = Math.round(right.cx);
  const rcy = Math.round(right.cy);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const lx = lcx + dx;
      const ly = lcy + dy;
      const rx = rcx + dx;
      const ry = rcy + dy;
      if (lx < 0 || ly < 0 || lx >= width || ly >= height) continue;
      if (rx < 0 || ry < 0 || rx >= width || ry >= height) continue;
      const li = (ly * width + lx) * 4;
      const ri = (ry * width + rx) * 4;
      data[li] = src[ri];
      data[li + 1] = src[ri + 1];
      data[li + 2] = src[ri + 2];
      data[li + 3] = src[ri + 3];
      data[ri] = src[li];
      data[ri + 1] = src[li + 1];
      data[ri + 2] = src[li + 2];
      data[ri + 3] = src[li + 3];
    }
  }
  return true;
}

/** Mutates the canvas: star goes to viewer's left eye; cloak stays put. */
export function relocateStarToLeadingEye(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const ok = relocateStarToLeadingEyeImage(image.data, width, height);
  if (ok) ctx.putImageData(image, 0, 0);
  return ok;
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

function compose(img: HTMLImageElement, facingRight: boolean, relocateStar: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  // Source art already has the star in the viewer's right / leading-right eye.
  // Never scaleX(-1): that would swap the red/yellow cloak.
  if (relocateStar && !facingRight) relocateStarToLeadingEye(ctx);
  return canvas;
}

/** Whole-body flip is forbidden — facing is star-composite only. */
export function mascotDrawTransform(): "none" {
  return "none";
}

export function isWholeBodyFlip(transform: string | null | undefined): boolean {
  const t = String(transform || "");
  return /scaleX\s*\(\s*-/.test(t) || /scale\s*\(\s*-1/.test(t);
}

/** facingRight: star stays in viewer's right eye. facing left: star moves to the left eye. Cloak never flips. */
export async function getFacingSprite(
  src: string,
  facingRight: boolean,
  relocateStar = true,
) {
  const key = `${src}|${facingRight ? "r" : "l"}|${relocateStar ? "star" : "plain"}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const img = await loadImage(src);
  const canvas = compose(img, facingRight, relocateStar);
  canvasCache.set(key, canvas);
  return canvas;
}

export async function drawFacingSprite(
  dest: HTMLCanvasElement,
  src: string,
  facingRight: boolean,
  relocateStar = true,
) {
  const sprite = await getFacingSprite(src, facingRight, relocateStar);
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
