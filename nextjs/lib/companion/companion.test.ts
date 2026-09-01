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
  collideMascots,
  endDrag,
  isSitPcSprite,
  nearestEdge,
  promoteDrag,
  setWorking,
  snapToNearestEdge,
  spriteOrientTransform,
  spriteUrl,
  startWalking,
  startWalkingOnEdge,
  tickShimeji,
  LULOX_SPRITE_BASE,
  SPRITE_BASE,
  State,
  bubblePlacementForEdge,
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
import { buildLlmRequest, pickLlmProvider } from "./llm";

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

describe("in-app llm", () => {
  it("uses OpenAI or xAI API in-app, never grok.com as the chat", () => {
    const none = pickLlmProvider({});
    assert.equal(none.provider, "none");
    const openai = pickLlmProvider({ OPENAI_API_KEY: "sk-test" });
    const req = buildLlmRequest({
      pick: openai,
      messages: [{ role: "user", content: "hola" }],
    });
    assert.ok(req);
    assert.match(req!.url, /api\.openai\.com/);
    assert.doesNotMatch(req!.url, /grok\.com/);
    const xai = buildLlmRequest({
      pick: pickLlmProvider({ XAI_API_KEY: "xai-test" }),
      messages: [{ role: "user", content: "hola" }],
    });
    assert.ok(xai);
    assert.match(xai!.url, /api\.x\.ai/);
    assert.doesNotMatch(xai!.url, /grok\.com/);
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

describe("shimeji perimeter + collision + snap", () => {
  const bounds = { width: 400, height: 300 };
  const scale = 1;
  const size = 128;
  const right = bounds.width - size;
  const ceiling = size;
  const floor = bounds.height;

  it("continues from floor onto the right wall then the ceiling", () => {
    const m = createMascot(bounds, scale);
    m.x = right - 2;
    m.y = floor;
    m.edge = "floor";
    startWalkingOnEdge(m, "floor", true);
    for (let i = 0; i < 8; i++) tickShimeji(m, bounds, scale, null, null);
    assert.equal(m.edge, "right");
    assert.equal(m.x, right);
    assert.ok(m.y < floor, `expected climb the wall, y=${m.y}`);
    assert.equal(m.transform, "none");
    assert.equal(spriteOrientTransform("right"), "rotate(-90deg)");
    assert.equal(isWholeBodyFlip(m.transform), false);

    m.y = ceiling + 2;
    m.edge = "right";
    startWalkingOnEdge(m, "right", true);
    for (let i = 0; i < 8; i++) tickShimeji(m, bounds, scale, null, null);
    assert.equal(m.edge, "ceiling");
    assert.equal(m.y, ceiling);
    assert.ok(m.x < right, `expected walk the ceiling, x=${m.x}`);
    assert.equal(bubblePlacementForEdge("ceiling"), "below-feet");
    assert.equal(bubblePlacementForEdge("left"), "beside-right");
    assert.equal(bubblePlacementForEdge("right"), "beside-left");
    assert.equal(bubblePlacementForEdge("floor"), "above-head");
    assert.equal(bubblePlacementForEdge("floor", 10), "below-feet");
    assert.equal(bubblePlacementForEdge("floor", 80), "above-head");
    assert.equal(spriteOrientTransform("ceiling"), "rotate(180deg)");
    assert.equal(spriteOrientTransform("left"), "rotate(90deg)");
    assert.equal(spriteOrientTransform("floor"), "none");
  });

  it("continues from floor onto the left wall then the ceiling", () => {
    const m = createMascot(bounds, scale);
    m.x = 2;
    m.y = floor;
    startWalkingOnEdge(m, "floor", false);
    for (let i = 0; i < 8; i++) tickShimeji(m, bounds, scale, null, null);
    assert.equal(m.edge, "left");
    assert.equal(m.x, 0);
    assert.ok(m.y < floor);
    m.y = ceiling + 2;
    startWalkingOnEdge(m, "left", false);
    for (let i = 0; i < 8; i++) tickShimeji(m, bounds, scale, null, null);
    assert.equal(m.edge, "ceiling");
    assert.equal(m.y, ceiling);
  });

  it("pets collide on the same edge and reverse instead of overlapping", () => {
    const a = createMascot(bounds, scale);
    const b = createMascot(bounds, scale);
    a.edge = "floor";
    b.edge = "floor";
    a.y = floor;
    b.y = floor;
    a.x = 80;
    b.x = 90;
    startWalkingOnEdge(a, "floor", true);
    startWalkingOnEdge(b, "floor", false);
    const hit = collideMascots(a, scale, b, scale);
    assert.equal(hit, true);
    assert.ok(Math.abs(a.x - b.x) > Math.abs(80 - 90));
    assert.notEqual(a.direction, b.direction);
  });

  it("slow endDrag grabs the nearest wall or ceiling; a click still clicks", () => {
    const m = createMascot(bounds, scale);
    m.x = 200;
    m.y = 150;
    promoteDrag(m);
    assert.equal(m.state, State.DRAGGED);
    m.smoothedVelocityX = 1;
    m.smoothedVelocityY = 0;
    const result = endDrag(m, bounds, scale);
    assert.equal(m.isDragging, false);
    const edge = nearestEdge(200, 150, bounds, scale);
    if (edge === "floor") {
      assert.equal(result, "drop");
      assert.equal(m.state, State.FALLING);
    } else {
      assert.equal(result, "grab");
      assert.equal(m.state, State.WALKING);
      assert.equal(m.edge, edge);
    }
    snapToNearestEdge(m, bounds, scale);
    if (m.edge === "ceiling") assert.equal(m.y, ceiling);
    if (m.edge === "floor") assert.equal(m.y, floor);
    if (m.edge === "left") assert.equal(m.x, 0);
    if (m.edge === "right") assert.equal(m.x, right);
  });
});
