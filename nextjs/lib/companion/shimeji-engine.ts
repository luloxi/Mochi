/**
 * Companion wander runtime for Katho's Mochi (chrome-extension/characters/mochi).
 * Served from /sprites/mochi/. Walk sprites only — no climb-wall frames.
 * Pets walk the FULL desk perimeter (floor, walls, ceiling). At a corner they
 * continue onto the next edge. The .companion-mascot button is never rotated
 * (that would verticalize bubble text). Canvas sprite may be oriented.
 *
 * Facing on the floor is the star in the leading eye (see star-eye.ts),
 * never scaleX(-1), so the red/yellow cloak stays put.
 */

export const SPRITE_SIZE = 128;
export const TICK_MS = 40;
export const SPRITE_BASE = "/sprites/mochi/";
export const LULOX_SPRITE_BASE = "/sprites/lulox/";
export const NIMBO_SPRITE_BASE = "/sprites/nimbo/";
export const COORD_SPRITE_BASE = NIMBO_SPRITE_BASE;

export type SpritePackId = "mochi" | "lulox" | "nimbo";

/** Clockwise around the room: floor → right wall → ceiling → left wall → floor. */
export type DeskEdge = "floor" | "left" | "right" | "ceiling";

export type BubblePlacement = "above-head" | "beside-right" | "beside-left" | "below-feet";

export const PHYSICS = {
  gravity: 2,
  walkSpeed: 2,
  fallTerminalVelocity: 20,
} as const;

export const State = {
  IDLE: "idle",
  WALKING: "walking",
  FALLING: "falling",
  SITTING_EDGE: "sitting_edge",
  DRAGGED: "dragged",
  HEAD_SPIN: "head_spin",
  SPRAWLED: "sprawled",
  SITTING_PC: "sitting_pc",
  SITTING_PC_DANGLE: "sitting_pc_dangle",
} as const;

export type ShimejiState = (typeof State)[keyof typeof State];

export const SPRITES: Record<string, string> = {
  "stand-neutral": "stand-neutral.png",
  "walk-step-left": "walk-step-left.png",
  "walk-step-right": "walk-step-right.png",
  "sprawl-lying": "sprawl-lying.png",
  "sit-edge-legs-down": "sit-edge-legs-down.png",
  "sit-edge-dangle-frame-1": "sit-edge-dangle-frame-1.png",
  "sit-edge-dangle-frame-2": "sit-edge-dangle-frame-2.png",
  "spin-head-frame-1": "spin-head-frame-1.png",
  "spin-head-frame-2": "spin-head-frame-2.png",
  "spin-head-frame-3": "spin-head-frame-3.png",
  "spin-head-frame-4": "spin-head-frame-4.png",
  "spin-head-frame-5": "spin-head-frame-5.png",
  "spin-head-frame-6": "spin-head-frame-6.png",
  "sit-pc-edge-legs-down": "sit-pc-edge-legs-down.png",
  "sit-pc-edge-dangle-frame-1": "sit-pc-edge-dangle-frame-1.png",
  "sit-pc-edge-dangle-frame-2": "sit-pc-edge-dangle-frame-2.png",
  icon: "icon.png",
};

/** Lulox ninja-cat: black cat, tail bandage, fangs. Never reuse Mochi sit-pc. */
export const LULOX_SPRITES: Record<string, string> = {
  "stand-neutral": "stand-neutral.png",
  "walk-step-left": "walk-step-left.png",
  "walk-step-right": "walk-step-right.png",
  "sprawl-lying": "sit-edge.png",
  "sit-edge-legs-down": "sit-edge.png",
  "sit-edge-dangle-frame-1": "sit-edge.png",
  "sit-edge-dangle-frame-2": "sit-edge.png",
  "spin-head-frame-1": "emotion-happy.png",
  "spin-head-frame-2": "emotion-happy.png",
  "spin-head-frame-3": "stand-neutral.png",
  "spin-head-frame-4": "emotion-negative.png",
  "spin-head-frame-5": "emotion-negative.png",
  "spin-head-frame-6": "stand-neutral.png",
  "sit-pc-edge-legs-down": "sit-pc.png",
  "sit-pc-edge-dangle-frame-1": "sit-pc.png",
  "sit-pc-edge-dangle-frame-2": "sit-edge.png",
  "emotion-happy": "emotion-happy.png",
  "emotion-negative": "emotion-negative.png",
  icon: "icon.png",
};

type AnimFrame = { sprite: string; duration: number };

const WALK_LEFT_CYCLE: AnimFrame[] = [
  { sprite: "stand-neutral", duration: 6 },
  { sprite: "walk-step-left", duration: 6 },
  { sprite: "stand-neutral", duration: 6 },
  { sprite: "walk-step-right", duration: 6 },
];

const WALK_RIGHT_CYCLE: AnimFrame[] = [
  { sprite: "stand-neutral", duration: 6 },
  { sprite: "walk-step-right", duration: 6 },
  { sprite: "stand-neutral", duration: 6 },
  { sprite: "walk-step-left", duration: 6 },
];

export const ANIMATIONS_FULL: Record<string, AnimFrame[]> = {
  idle: [{ sprite: "stand-neutral", duration: 1 }],
  walking: WALK_RIGHT_CYCLE,
  walkingLeft: WALK_LEFT_CYCLE,
  walkingRight: WALK_RIGHT_CYCLE,
  falling: [{ sprite: "stand-neutral", duration: 1 }],
  sprawled: [{ sprite: "sprawl-lying", duration: 1 }],
  sittingEdge: [
    { sprite: "sit-edge-legs-down", duration: 20 },
    { sprite: "sit-edge-dangle-frame-1", duration: 15 },
    { sprite: "sit-edge-legs-down", duration: 20 },
    { sprite: "sit-edge-dangle-frame-2", duration: 15 },
  ],
  headSpin: [
    { sprite: "spin-head-frame-1", duration: 5 },
    { sprite: "spin-head-frame-2", duration: 5 },
    { sprite: "spin-head-frame-3", duration: 5 },
    { sprite: "spin-head-frame-4", duration: 5 },
    { sprite: "spin-head-frame-5", duration: 5 },
    { sprite: "spin-head-frame-6", duration: 5 },
  ],
  sittingPc: [{ sprite: "sit-pc-edge-legs-down", duration: 10 }],
  sittingPcDangle: [
    { sprite: "sit-pc-edge-dangle-frame-1", duration: 15 },
    { sprite: "sit-pc-edge-dangle-frame-2", duration: 15 },
  ],
};

function walkCycleName(facingRight: boolean) {
  return facingRight ? "walkingRight" : "walkingLeft";
}

export type Bounds = { width: number; height: number };

export type Perch = { x: number; y: number };

export type WanderBias = {
  xMin: number;
  xMax: number;
  gatherX?: number;
  facingRight?: boolean;
  pose?: "kiss" | "hop" | "walk-together" | "idle-chat" | "separate" | "idle";
};

export type ShimejiMascot = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  state: ShimejiState;
  /** +1 clockwise around the room, -1 counterclockwise. */
  facingRight: boolean;
  direction: number;
  currentAnimation: string;
  animationFrame: number;
  animationTick: number;
  isDragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  dragPending: boolean;
  dragStartX: number;
  dragStartY: number;
  prevDragX: number;
  prevDragY: number;
  smoothedVelocityX: number;
  smoothedVelocityY: number;
  dragTick: number;
  stateTimer: number;
  spriteKey: string;
  transform: string;
  forceWorking: boolean;
  edge: DeskEdge;
  flockId: string;
};

function animDuration(name: string): number {
  const anim = ANIMATIONS_FULL[name];
  if (!anim) return 0;
  return anim.reduce((sum, f) => sum + f.duration, 0);
}

function setAnim(m: ShimejiMascot, state: ShimejiState, animation: string) {
  m.state = state;
  m.currentAnimation = animation;
  m.animationFrame = 0;
  m.animationTick = 0;
  m.stateTimer = 0;
}

export function edgeBounds(bounds: Bounds, scale: number) {
  const size = SPRITE_SIZE * scale;
  return {
    size,
    left: 0,
    right: Math.max(0, bounds.width - size),
    floor: bounds.height,
    ceiling: size,
  };
}

/** Button stays unrotated. Canvas sprite orients feet toward the current edge. */
export function spriteOrientTransform(edge: DeskEdge): string {
  if (edge === "left") return "rotate(90deg)";
  if (edge === "right") return "rotate(-90deg)";
  if (edge === "ceiling") return "rotate(180deg)";
  return "none";
}

export function bubblePlacementForEdge(edge: DeskEdge): BubblePlacement {
  if (edge === "left") return "beside-right";
  if (edge === "right") return "beside-left";
  if (edge === "ceiling") return "below-feet";
  return "above-head";
}

export function nearestEdge(x: number, y: number, bounds: Bounds, scale: number): DeskEdge {
  const e = edgeBounds(bounds, scale);
  const distFloor = Math.abs(y - e.floor);
  const distCeil = Math.abs(y - e.ceiling);
  const distLeft = Math.abs(x - e.left);
  const distRight = Math.abs(x - e.right);
  let edge: DeskEdge = "floor";
  let best = distFloor;
  if (distLeft < best) {
    edge = "left";
    best = distLeft;
  }
  if (distRight < best) {
    edge = "right";
    best = distRight;
  }
  if (distCeil < best) {
    edge = "ceiling";
  }
  return edge;
}

export function snapToNearestEdge(m: ShimejiMascot, bounds: Bounds, scale: number) {
  const e = edgeBounds(bounds, scale);
  const edge = nearestEdge(m.x, m.y, bounds, scale);
  m.edge = edge;
  m.x = Math.max(e.left, Math.min(m.x, e.right));
  m.y = Math.max(e.ceiling, Math.min(m.y, e.floor));
  pinToEdge(m, bounds, scale);
}

function pinToEdge(m: ShimejiMascot, bounds: Bounds, scale: number) {
  const e = edgeBounds(bounds, scale);
  if (m.edge === "floor") m.y = e.floor;
  else if (m.edge === "ceiling") m.y = e.ceiling;
  else if (m.edge === "left") m.x = e.left;
  else m.x = e.right;
  m.x = Math.max(e.left, Math.min(m.x, e.right));
  m.y = Math.max(e.ceiling, Math.min(m.y, e.floor));
}

function syncFacingFromDirection(m: ShimejiMascot) {
  if (m.edge === "floor") m.facingRight = m.direction >= 0;
  else if (m.edge === "ceiling") m.facingRight = m.direction < 0;
  else if (m.edge === "left") m.facingRight = false;
  else m.facingRight = true;
  const next = walkCycleName(m.facingRight);
  if (m.state === State.WALKING && m.currentAnimation !== next) {
    m.currentAnimation = next;
  }
}

/** Switch left/right walk clip without resetting the frame clock. */
function setWalkDirection(m: ShimejiMascot, facingRight: boolean) {
  m.facingRight = facingRight;
  if (m.edge === "ceiling") m.direction = facingRight ? -1 : 1;
  else if (m.edge === "right") m.direction = facingRight ? 1 : -1;
  else m.direction = facingRight ? 1 : -1;
  const next = walkCycleName(facingRight);
  if (m.state === State.WALKING && m.currentAnimation !== next) {
    m.currentAnimation = next;
  }
}

export function spriteUrl(key: string, pack: SpritePackId = "mochi"): string {
  if (pack === "lulox") {
    const file = LULOX_SPRITES[key] || LULOX_SPRITES["stand-neutral"];
    return `${LULOX_SPRITE_BASE}${file}`;
  }
  if (pack === "nimbo") {
    const file = SPRITES[key] || SPRITES["stand-neutral"];
    return `${NIMBO_SPRITE_BASE}${file}`;
  }
  const file = SPRITES[key] || SPRITES["stand-neutral"];
  return `${SPRITE_BASE}${file}`;
}

export function startWalking(m: ShimejiMascot, facingRight: boolean) {
  if (!m.edge) m.edge = "floor";
  setWalkDirection(m, facingRight);
  setAnim(m, State.WALKING, walkCycleName(facingRight));
}

export function startWalkingOnEdge(m: ShimejiMascot, edge: DeskEdge, clockwise: boolean) {
  m.edge = edge;
  m.direction = clockwise ? 1 : -1;
  syncFacingFromDirection(m);
  setAnim(m, State.WALKING, walkCycleName(m.facingRight));
}

export function sitAtPcSpriteKeys(): string[] {
  return ["sit-pc-edge-legs-down", "sit-pc-edge-dangle-frame-1", "sit-pc-edge-dangle-frame-2"];
}

export function isSitPcSprite(key: string): boolean {
  return sitAtPcSpriteKeys().includes(key);
}

export const PREFETCH_SPRITE_KEYS = Object.keys(SPRITES);

export function createMascot(bounds: Bounds, scale: number): ShimejiMascot {
  const size = SPRITE_SIZE * scale;
  const maxX = Math.max(0, bounds.width - size);
  return {
    x: Math.random() * maxX,
    y: bounds.height || size,
    velocityX: 0,
    velocityY: 0,
    state: State.IDLE,
    facingRight: Math.random() > 0.5,
    direction: 0,
    currentAnimation: "idle",
    animationFrame: 0,
    animationTick: 0,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragPending: false,
    dragStartX: 0,
    dragStartY: 0,
    prevDragX: 0,
    prevDragY: 0,
    smoothedVelocityX: 0,
    smoothedVelocityY: 0,
    dragTick: 0,
    stateTimer: 0,
    spriteKey: "stand-neutral",
    transform: "none",
    forceWorking: false,
    edge: "floor",
    flockId: `pet-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function createWorkingMascot(): ShimejiMascot {
  const m = createMascot({ width: 200, height: 160 }, 0.7);
  setAnim(m, State.SITTING_PC, "sittingPc");
  m.forceWorking = true;
  m.x = 20;
  m.y = SPRITE_SIZE * 0.7;
  m.facingRight = false;
  m.edge = "floor";
  return m;
}

function currentFrame(m: ShimejiMascot): AnimFrame {
  const animation = ANIMATIONS_FULL[m.currentAnimation] || ANIMATIONS_FULL.idle;
  return animation[m.animationFrame % animation.length] || animation[0];
}

function tickWorking(m: ShimejiMascot, perch: Perch | null, size: number) {
  m.velocityX = 0;
  m.velocityY = 0;
  m.edge = "floor";
  if (perch) {
    m.x = perch.x;
    m.y = perch.y;
  }
  if (m.state !== State.SITTING_PC && m.state !== State.SITTING_PC_DANGLE) {
    setAnim(m, State.SITTING_PC, "sittingPc");
  }
  m.stateTimer++;
  if (m.state === State.SITTING_PC && m.stateTimer > 24) {
    setAnim(m, State.SITTING_PC_DANGLE, "sittingPcDangle");
  } else if (m.state === State.SITTING_PC_DANGLE && m.stateTimer > 50) {
    setAnim(m, State.SITTING_PC, "sittingPc");
  }
  m.y = Math.max(m.y, size);
}

/** Continue onto the next edge instead of bouncing in a floor strip. */
function continueAtCorner(m: ShimejiMascot, bounds: Bounds, scale: number) {
  const e = edgeBounds(bounds, scale);
  const clockwise = m.direction >= 0;
  if (m.edge === "floor") {
    if (clockwise && m.x >= e.right) {
      m.x = e.right;
      m.edge = "right";
    } else if (!clockwise && m.x <= e.left) {
      m.x = e.left;
      m.edge = "left";
    }
  } else if (m.edge === "right") {
    if (clockwise && m.y <= e.ceiling) {
      m.y = e.ceiling;
      m.edge = "ceiling";
    } else if (!clockwise && m.y >= e.floor) {
      m.y = e.floor;
      m.edge = "floor";
    }
  } else if (m.edge === "ceiling") {
    if (clockwise && m.x <= e.left) {
      m.x = e.left;
      m.edge = "left";
    } else if (!clockwise && m.x >= e.right) {
      m.x = e.right;
      m.edge = "right";
    }
  } else if (m.edge === "left") {
    if (clockwise && m.y >= e.floor) {
      m.y = e.floor;
      m.edge = "floor";
    } else if (!clockwise && m.y <= e.ceiling) {
      m.y = e.ceiling;
      m.edge = "ceiling";
    }
  }
  pinToEdge(m, bounds, scale);
  syncFacingFromDirection(m);
}

function stepAlongEdge(m: ShimejiMascot, bounds: Bounds, scale: number) {
  const speed = PHYSICS.walkSpeed * (m.direction === 0 ? 1 : m.direction);
  if (m.edge === "floor") m.x += speed;
  else if (m.edge === "right") m.y -= speed;
  else if (m.edge === "ceiling") m.x -= speed;
  else m.y += speed;
  continueAtCorner(m, bounds, scale);
}

function updateState(m: ShimejiMascot, bounds: Bounds, scale: number, perch: Perch | null) {
  const size = SPRITE_SIZE * scale;
  const e = edgeBounds(bounds, scale);

  if (m.isDragging) {
    m.spriteKey = "stand-neutral";
    m.dragTick++;
    return;
  }

  if (m.forceWorking) {
    tickWorking(m, perch, size);
    return;
  }

  switch (m.state) {
    case State.IDLE:
      m.stateTimer++;
      pinToEdge(m, bounds, scale);
      if (m.stateTimer > 40 && Math.random() < 0.03) {
        const roll = Math.random();
        if (roll < 0.58) {
          startWalkingOnEdge(m, m.edge || "floor", Math.random() > 0.5);
        } else if (roll < 0.78) {
          setAnim(m, State.SITTING_EDGE, "sittingEdge");
        } else if (roll < 0.9) {
          setAnim(m, State.HEAD_SPIN, "headSpin");
        } else {
          setAnim(m, State.SPRAWLED, "sprawled");
        }
      }
      break;

    case State.WALKING:
      m.stateTimer++;
      if (m.direction === 0) m.direction = m.facingRight ? 1 : -1;
      stepAlongEdge(m, bounds, scale);
      if (m.stateTimer > 50 && Math.random() < 0.012) {
        setAnim(m, State.IDLE, "idle");
        m.direction = 0;
      }
      break;

    case State.FALLING:
      m.velocityY += PHYSICS.gravity;
      m.velocityY = Math.min(m.velocityY, PHYSICS.fallTerminalVelocity);
      m.y += m.velocityY;
      m.x += m.velocityX;
      if (m.x <= e.left) {
        m.x = e.left;
        m.velocityX = Math.abs(m.velocityX);
        m.facingRight = true;
      }
      if (m.x >= e.right) {
        m.x = e.right;
        m.velocityX = -Math.abs(m.velocityX);
        m.facingRight = false;
      }
      if (m.y >= e.floor) {
        m.y = e.floor;
        m.velocityY = 0;
        m.velocityX = 0;
        m.edge = "floor";
        setAnim(m, State.SPRAWLED, "sprawled");
      }
      break;

    case State.SPRAWLED:
      m.stateTimer++;
      pinToEdge(m, bounds, scale);
      if (m.stateTimer > 80 && Math.random() < 0.03) setAnim(m, State.IDLE, "idle");
      break;

    case State.HEAD_SPIN:
      m.stateTimer++;
      pinToEdge(m, bounds, scale);
      if (m.stateTimer >= animDuration("headSpin")) setAnim(m, State.IDLE, "idle");
      break;

    case State.SITTING_EDGE:
      m.stateTimer++;
      pinToEdge(m, bounds, scale);
      if (m.stateTimer > 160 && Math.random() < 0.02) setAnim(m, State.IDLE, "idle");
      break;

    case State.SITTING_PC:
    case State.SITTING_PC_DANGLE:
      setAnim(m, State.IDLE, "idle");
      break;

    case State.DRAGGED:
      break;
  }
}

function updateAnimation(m: ShimejiMascot) {
  if (m.isDragging) {
    m.spriteKey = "stand-neutral";
    return;
  }
  if (!ANIMATIONS_FULL[m.currentAnimation]) {
    m.currentAnimation = "idle";
    m.animationTick = 0;
    m.animationFrame = 0;
  }
  const animation = ANIMATIONS_FULL[m.currentAnimation];
  m.animationTick++;
  let tickCount = 0;
  for (let i = 0; i < animation.length; i++) {
    tickCount += animation[i].duration;
    if (m.animationTick <= tickCount) {
      m.animationFrame = i;
      break;
    }
  }
  const total = animation.reduce((sum, f) => sum + f.duration, 0);
  if (m.animationTick >= total) {
    m.animationTick = 0;
    m.animationFrame = 0;
  }
  m.spriteKey = currentFrame(m).sprite;
  m.transform = "none";
}

function isGatherPose(pose: WanderBias["pose"] | undefined) {
  return pose === "kiss" || pose === "hop" || pose === "walk-together" || pose === "idle-chat";
}

function applyWanderBias(m: ShimejiMascot, bounds: Bounds, scale: number, bias: WanderBias) {
  if (m.isDragging || m.forceWorking) return;
  if (!isGatherPose(bias.pose)) return;
  const e = edgeBounds(bounds, scale);
  m.edge = "floor";
  m.y = e.floor;
  const xMin = Math.max(0, bias.xMin);
  const xMax = Math.max(xMin, Math.min(e.right, bias.xMax - scale * SPRITE_SIZE));
  if (m.x < xMin) {
    m.x = xMin;
    if (m.state === State.WALKING) startWalking(m, true);
  }
  if (m.x > xMax) {
    m.x = xMax;
    if (m.state === State.WALKING) startWalking(m, false);
  }
  if (bias.gatherX != null) {
    const target = Math.max(xMin, Math.min(xMax, bias.gatherX));
    const dx = target - m.x;
    if (Math.abs(dx) > 6) {
      startWalking(m, dx > 0);
    } else if (bias.pose === "kiss" || bias.pose === "idle-chat") {
      if (m.state === State.WALKING) setAnim(m, State.IDLE, "idle");
      m.direction = 0;
      if (bias.facingRight != null) m.facingRight = bias.facingRight;
    }
  }
  if (bias.pose === "walk-together" && m.state !== State.WALKING) {
    startWalking(m, bias.facingRight ?? true);
  }
  if (bias.facingRight != null && (bias.pose === "kiss" || bias.pose === "idle-chat")) {
    m.facingRight = bias.facingRight;
  }
}

type FlockEntry = { m: ShimejiMascot; scale: number };
const flock = new Map<string, FlockEntry>();

export function registerPet(m: ShimejiMascot, scale: number) {
  if (!m.flockId) m.flockId = `pet-${Math.random().toString(36).slice(2, 8)}`;
  flock.set(m.flockId, { m, scale });
}

export function unregisterPet(m: ShimejiMascot) {
  flock.delete(m.flockId);
}

export function clearFlock() {
  flock.clear();
}

function freeAxisDelta(m: ShimejiMascot): number {
  if (m.state !== State.WALKING) return 0;
  const s = PHYSICS.walkSpeed * (m.direction === 0 ? 1 : m.direction);
  if (m.edge === "floor") return s;
  if (m.edge === "ceiling") return -s;
  if (m.edge === "left") return s;
  return -s;
}

function reverseAlong(m: ShimejiMascot) {
  m.direction = m.direction === 0 ? -1 : -m.direction;
  syncFacingFromDirection(m);
}

export function collideMascots(a: ShimejiMascot, scaleA: number, b: ShimejiMascot, scaleB: number): boolean {
  if (a.isDragging || b.isDragging) return false;
  if (a.forceWorking || b.forceWorking) return false;
  const A = mascotDrawBox(a, scaleA);
  const B = mascotDrawBox(b, scaleB);
  const overlapX = Math.min(A.left + A.size, B.left + B.size) - Math.max(A.left, B.left);
  const overlapY = Math.min(A.top + A.size, B.top + B.size) - Math.max(A.top, B.top);
  if (overlapX <= 0 || overlapY <= 0) return false;

  const same = a.edge === b.edge;
  if (same && (a.edge === "floor" || a.edge === "ceiling")) {
    const aLeft = a.x <= b.x;
    const push = Math.max(6, overlapX / 2 + 2);
    if (aLeft) {
      a.x -= push / 2;
      b.x += push / 2;
      if (freeAxisDelta(a) > 0) reverseAlong(a);
      if (freeAxisDelta(b) < 0) reverseAlong(b);
    } else {
      a.x += push / 2;
      b.x -= push / 2;
      if (freeAxisDelta(a) < 0) reverseAlong(a);
      if (freeAxisDelta(b) > 0) reverseAlong(b);
    }
  } else if (same && (a.edge === "left" || a.edge === "right")) {
    const aAbove = a.y <= b.y;
    const push = Math.max(6, overlapY / 2 + 2);
    if (aAbove) {
      a.y -= push / 2;
      b.y += push / 2;
      if (freeAxisDelta(a) > 0) reverseAlong(a);
      if (freeAxisDelta(b) < 0) reverseAlong(b);
    } else {
      a.y += push / 2;
      b.y -= push / 2;
      if (freeAxisDelta(a) < 0) reverseAlong(a);
      if (freeAxisDelta(b) > 0) reverseAlong(b);
    }
  } else if (overlapX < overlapY) {
    if (A.left < B.left) {
      a.x -= overlapX / 2 + 2;
      b.x += overlapX / 2 + 2;
    } else {
      a.x += overlapX / 2 + 2;
      b.x -= overlapX / 2 + 2;
    }
    reverseAlong(a);
    reverseAlong(b);
  } else {
    if (A.top < B.top) {
      a.y -= overlapY / 2 + 2;
      b.y += overlapY / 2 + 2;
    } else {
      a.y += overlapY / 2 + 2;
      b.y -= overlapY / 2 + 2;
    }
    reverseAlong(a);
    reverseAlong(b);
  }
  return true;
}

export function resolveFlockCollisions() {
  const pets = [...flock.values()];
  for (let i = 0; i < pets.length; i++) {
    for (let j = i + 1; j < pets.length; j++) {
      collideMascots(pets[i].m, pets[i].scale, pets[j].m, pets[j].scale);
    }
  }
}

export function tickShimeji(
  m: ShimejiMascot,
  bounds: Bounds,
  scale: number,
  _cursorY: number | null,
  perch: Perch | null,
  bias?: WanderBias | null,
) {
  updateState(m, bounds, scale, perch);
  if (bias) applyWanderBias(m, bounds, scale, bias);
  resolveFlockCollisions();
  updateAnimation(m);
}

export function beginDragPending(m: ShimejiMascot, clientX: number, clientY: number, scale: number) {
  const size = SPRITE_SIZE * scale;
  m.dragPending = true;
  m.dragStartX = clientX;
  m.dragStartY = clientY;
  m.dragOffsetX = clientX - m.x;
  m.dragOffsetY = clientY - (m.y - size);
}

export function promoteDrag(m: ShimejiMascot) {
  m.dragPending = false;
  m.isDragging = true;
  m.state = State.DRAGGED;
  m.prevDragX = m.x;
  m.prevDragY = m.y;
  m.smoothedVelocityX = 0;
  m.smoothedVelocityY = 0;
  m.dragTick = 0;
  m.forceWorking = false;
}

export function moveDrag(
  m: ShimejiMascot,
  clientX: number,
  clientY: number,
  bounds: Bounds,
  scale: number,
) {
  const size = SPRITE_SIZE * scale;
  if (m.dragPending) {
    const dx = clientX - m.dragStartX;
    const dy = clientY - m.dragStartY;
    if (Math.sqrt(dx * dx + dy * dy) > 5) promoteDrag(m);
  }
  if (!m.isDragging) return;
  m.x = clientX - m.dragOffsetX;
  m.y = clientY - m.dragOffsetY + size;
  m.x = Math.max(-size * 0.5, Math.min(m.x, bounds.width - size * 0.5));
  m.y = Math.max(size * 0.5, Math.min(m.y, bounds.height + size * 0.5));
  const dragDelta = m.x - m.prevDragX;
  const dragDeltaY = m.y - m.prevDragY;
  m.prevDragX = m.x;
  m.prevDragY = m.y;
  m.smoothedVelocityX = m.smoothedVelocityX * 0.8 + dragDelta * 0.2 * 5;
  m.smoothedVelocityY = m.smoothedVelocityY * 0.8 + dragDeltaY * 0.2 * 5;
  if (Math.abs(dragDelta) > 0.4) m.facingRight = dragDelta > 0;
}

export function endDrag(m: ShimejiMascot, bounds?: Bounds, scale = 1) {
  if (m.dragPending) {
    m.dragPending = false;
    return "click" as const;
  }
  if (!m.isDragging) return "none" as const;
  m.isDragging = false;
  m.velocityX = 0;
  m.velocityY = 0;
  m.smoothedVelocityX = 0;
  m.smoothedVelocityY = 0;
  const box = bounds ?? { width: Math.max(320, m.x + SPRITE_SIZE), height: Math.max(240, m.y) };
  snapToNearestEdge(m, box, scale);
  const clockwise = m.edge === "floor" || m.edge === "right" ? m.facingRight : !m.facingRight;
  startWalkingOnEdge(m, m.edge, clockwise);
  return "drop" as const;
}

export function setWorking(m: ShimejiMascot, working: boolean) {
  if (working === m.forceWorking) return;
  m.forceWorking = working;
  if (working) {
    m.edge = "floor";
    setAnim(m, State.SITTING_PC, "sittingPc");
  } else if (!m.isDragging) {
    setAnim(m, State.IDLE, "idle");
    m.velocityY = 0;
  }
}

export function mascotDrawBox(m: ShimejiMascot, scale: number) {
  const size = SPRITE_SIZE * scale;
  return { left: m.x, top: m.y - size, size };
}
