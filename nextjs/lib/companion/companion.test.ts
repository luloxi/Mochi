import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  inspectMochiSprite,
  isWholeBodyFlip,
  mascotDrawTransform,
  relocateStarToLeadingEyeImage,
} from "./star-eye";
import {
  createMascot,
  isSitPcSprite,
  setWorking,
  spriteUrl,
  startWalking,
  tickShimeji,
  LULOX_SPRITE_BASE,
  SPRITE_BASE,
} from "./shimeji-engine";
import {
  PERSONAS,
  agentCanTalkToOtherAgent,
  localAgentReply,
  nextMascotAlert,
  parseCompanionIntent,
  pickLuloxMood,
  simulateIncomingDm,
  toggleAgentWorking,
} from "./companion-core";
import {
  buildGrokChatRequest,
  buildGrokConnectUrl,
  emptyGrokSession,
  grokConnectIsRealTarget,
  isGrokConnected,
  parseGrokApiKey,
} from "./grok-connect";

const here = dirname(fileURLToPath(import.meta.url));
const mochiDir = join(here, "../../public/sprites/mochi");
const luloxDir = join(here, "../../public/sprites/lulox");

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPngRgba(path: string): { width: number; height: number; data: Uint8ClampedArray } {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8).toString("binary") !== "\x89PNG\r\n\x1a\n") {
    throw new Error(`not a png: ${path}`);
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bit = 0;
  let colorType = 0;
  const idats: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const tag = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const body = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (tag === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bit = body[8];
      colorType = body[9];
    } else if (tag === "IDAT") {
      idats.push(Buffer.from(body));
    } else if (tag === "IEND") {
      break;
    }
  }
  if (bit !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported png ${path} bit=${bit} ct=${colorType}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(idats));
  const stride = width * bpp;
  const raw = new Uint8ClampedArray(width * height * 4);
  let i = 0;
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[i++];
    const row = Buffer.from(inflated.subarray(i, i + stride));
    i += stride;
    if (filter === 1) {
      for (let x = 0; x < stride; x++) row[x] = (row[x] + (x >= bpp ? row[x - bpp] : 0)) & 255;
    } else if (filter === 2) {
      for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 255;
    } else if (filter === 3) {
      for (let x = 0; x < stride; x++) {
        const left = x >= bpp ? row[x - bpp] : 0;
        row[x] = (row[x] + Math.floor((left + prev[x]) / 2)) & 255;
      }
    } else if (filter === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? row[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        row[x] = (row[x] + paeth(a, b, c)) & 255;
      }
    } else if (filter !== 0) {
      throw new Error(`bad filter ${filter} in ${path}`);
    }
    row.copy(prev);
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      const si = x * bpp;
      raw[di] = row[si];
      raw[di + 1] = row[si + 1];
      raw[di + 2] = row[si + 2];
      raw[di + 3] = bpp === 4 ? row[si + 3] : 255;
    }
  }
  return { width, height, data: raw };
}

describe("mochi walk / star / sit-pc", () => {
  it("source art has the star in the right eye and red cape on the viewer left", () => {
    const png = readPngRgba(join(mochiDir, "stand-neutral.png"));
    const info = inspectMochiSprite(png.data, png.width, png.height);
    assert.equal(info.starSide, "right");
    assert.equal(info.capeLeftHue, "red");
    assert.equal(info.capeRightHue, "yellow");
    assert.equal(info.redLeftOfYellow, true);
    assert.ok(info.eyeCount >= 2);
  });

  it("facing left relocates the star to the leading left eye without flipping the cape", () => {
    const png = readPngRgba(join(mochiDir, "walk-step-left.png"));
    const src = inspectMochiSprite(png.data, png.width, png.height);
    assert.equal(src.starSide, "right");
    assert.equal(src.redLeftOfYellow, true);
    const copy = new Uint8ClampedArray(png.data);
    const ok = relocateStarToLeadingEyeImage(copy, png.width, png.height);
    assert.equal(ok, true);
    const left = inspectMochiSprite(copy, png.width, png.height);
    assert.equal(left.starSide, "left");
    assert.ok(left.leftWhite > src.leftWhite, "star white should increase in the left eye");
    assert.ok(left.rightWhite < src.rightWhite, "star white should leave the right eye");
    assert.equal(left.capeLeftHue, "red");
    assert.equal(left.capeRightHue, "yellow");
    assert.equal(left.redLeftOfYellow, true);
    assert.equal(mascotDrawTransform(), "none");
    assert.equal(isWholeBodyFlip(mascotDrawTransform()), false);
    assert.equal(isWholeBodyFlip("scaleX(-1)"), true);
  });

  it("facing right leaves the star in the source/right eye and cape unflipped", () => {
    const png = readPngRgba(join(mochiDir, "stand-neutral.png"));
    const info = inspectMochiSprite(png.data, png.width, png.height);
    assert.equal(info.starSide, "right");
    assert.equal(info.capeLeftHue, "red");
    assert.equal(info.capeRightHue, "yellow");
  });

  it("walking left/right changes x with facingRight matching direction and no body flip", () => {
    const bounds = { width: 900, height: 400 };
    const left = createMascot(bounds, 1);
    left.x = 400;
    startWalking(left, false);
    for (let i = 0; i < 24; i++) tickShimeji(left, bounds, 1, null, null);
    assert.ok(left.x < 400, `expected x to decrease, got ${left.x}`);
    assert.equal(left.facingRight, false);
    assert.equal(left.transform, "none");
    assert.equal(isWholeBodyFlip(left.transform), false);

    const right = createMascot(bounds, 1);
    right.x = 400;
    startWalking(right, true);
    for (let i = 0; i < 24; i++) tickShimeji(right, bounds, 1, null, null);
    assert.ok(right.x > 400, `expected x to increase, got ${right.x}`);
    assert.equal(right.facingRight, true);
    assert.equal(right.transform, "none");
  });

  it("forceWorking / sit-at-PC uses the sit-pc sprites", () => {
    const bounds = { width: 400, height: 300 };
    const m = createMascot(bounds, 1);
    setWorking(m, true);
    tickShimeji(m, bounds, 1, null, { x: 40, y: 80 });
    assert.equal(isSitPcSprite(m.spriteKey), true);
    assert.match(m.spriteKey, /sit-pc/);
    assert.equal(m.transform, "none");
  });
});

describe("grok connect", () => {
  it("unsubscribed Connect produces a real Grok/xAI auth target", () => {
    const session = emptyGrokSession();
    assert.equal(isGrokConnected(session), false);
    const url = buildGrokConnectUrl({ returnTo: "https://example.com/companion?grok=return" });
    assert.equal(grokConnectIsRealTarget(url), true);
    assert.match(url, /accounts\.x\.ai|auth\.x\.ai|grok\.com|api\.x\.ai/);
    assert.doesNotMatch(url, /\/settings$/);
    const req = buildGrokChatRequest({
      apiKey: "xai-test-key-not-real-0001",
      messages: [{ role: "user", content: "hola" }],
    });
    assert.match(req.url, /api\.x\.ai/);
    assert.equal(req.headers.Authorization.startsWith("Bearer "), true);
    assert.equal(parseGrokApiKey("xai-abcdefghijklmnopqrstuv"), "xai-abcdefghijklmnopqrstuv");
    assert.equal(parseGrokApiKey("no"), null);
  });
});

describe("dm alert + personas + agents", () => {
  it("DM from the other person raises a mascot alert", () => {
    const incoming = simulateIncomingDm("lulox", "Katho, te dejo un recado");
    const result = nextMascotAlert({
      messages: [incoming],
      seat: "katho",
      lastSeenId: null,
    });
    assert.equal(result.kind, "alert");
    if (result.kind === "alert") {
      assert.equal(result.message.from, "lulox");
    }
    const quiet = nextMascotAlert({
      messages: [incoming],
      seat: "katho",
      lastSeenId: incoming.id,
    });
    assert.equal(quiet.kind, "none");
  });

  it("Lulox is the ninja-cat persona and agents can talk to each other", () => {
    assert.equal(PERSONAS.lulox.kind, "ninja-cat");
    assert.equal(PERSONAS.lulox.spritePack, "lulox");
    assert.equal(PERSONAS.katho.kind, "rabbit");
    assert.equal(spriteUrl("sit-pc-edge-legs-down", "lulox").startsWith(LULOX_SPRITE_BASE), true);
    assert.equal(spriteUrl("stand-neutral", "mochi").startsWith(SPRITE_BASE), true);
    assert.equal(agentCanTalkToOtherAgent("katho", "lulox"), true);
    const intent = parseCompanionIntent("preguntale al agente de lulox si puede revisar el foco");
    assert.equal(intent.type, "ask-person-agent");
    if (intent.type === "ask-person-agent") {
      assert.equal(intent.to, "lulox");
    }
    const katho = parseCompanionIntent("preguntale al agente de katho que soñemos un logo");
    assert.equal(katho.type, "ask-person-agent");
    const jobs = toggleAgentWorking(
      [
        { id: "katho", working: false, label: "", startedAt: null, ticks: 0 },
        { id: "lulox", working: false, label: "", startedAt: null, ticks: 0 },
      ],
      "lulox",
      "codear",
    );
    const lulox = jobs.find((row) => row.id === "lulox");
    assert.equal(lulox?.working, true);
    const reply = localAgentReply({ person: "lulox", userText: "esto está mal y no sirve", working: true });
    assert.match(reply.toLowerCase(), /nah|no cierra|crudo/);
    assert.equal(pickLuloxMood("jaja genial"), "happy");
    assert.equal(pickLuloxMood("está pésimo"), "negative");
  });

  it("ships Lulox ninja-cat sprites and not a .ref folder asset", () => {
    for (const name of [
      "stand-neutral.png",
      "walk-step-left.png",
      "walk-step-right.png",
      "sit-pc.png",
      "emotion-happy.png",
      "emotion-negative.png",
    ]) {
      assert.equal(existsSync(join(luloxDir, name)), true, name);
    }
    const stand = readPngRgba(join(luloxDir, "stand-neutral.png"));
    assert.equal(stand.width, 384);
    assert.equal(stand.data[3], 0);
    assert.equal(existsSync(join(here, "../../public/.ref")), false);
  });
});
