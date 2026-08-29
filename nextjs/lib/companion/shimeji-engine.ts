/**
 * Companion wander runtime for Katho's Mochi (chrome-extension/characters/mochi).
 * Served from /sprites/mochi/. This set has no climb-wall frames — don't invent climb.
 * Available: stand-neutral, walk-step-left/right, sit-edge-*, sit-pc-edge-*,
 * spin-head-frame-1..6, sprawl-lying, icon.
 *
 * Facing is expressed by moving the star to the leading eye (see star-eye.ts),
 * never by scaleX(-1), so the red/yellow cloak stays put.
 */

export const SPRITE_SIZE = 128;
export const TICK_MS = 40;
export const SPRITE_BASE = "/sprites/mochi/";
export const LULOX_SPRITE_BASE = "/sprites/lulox/";

export type SpritePackId = "mochi" | "lulox";

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

/** Switch left/right walk clip without resetting the frame clock. */
function setWalkDirection(m: ShimejiMascot, facingRight: boolean) {
  m.facingRight = facingRight;
  m.direction = facingRight ? 1 : -1;
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
  const file = SPRITES[key] || SPRITES["stand-neutral"];
  return `${SPRITE_BASE}${file}`;
}

export function startWalking(m: ShimejiMascot, facingRight: boolean) {
  setWalkDirection(m, facingRight);
  setAnim(m, State.WALKING, walkCycleName(facingRight));
}

export function sitAtPcSpriteKeys(): string[] {
  return ["sit-pc-edge-legs-down", "sit-pc-edge-dangle-frame-1", "sit-pc-edge-dangle-frame-2"];
}

export function isSitPcSprite(key: string): boolean {
  return sitAtPcSpriteKeys().includes(key);
}

export const PREFETCH_SPRITE_KEYS = Object.keys(SPRITES);

export type ShimejiMascot = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  state: ShimejiState;
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
};

export type Bounds = { width: number; height: number };

export type Perch = { x: number; y: number };

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
  };
}

export function createWorkingMascot(): ShimejiMascot {
  const m = createMascot({ width: 200, height: 160 }, 0.7);
  setAnim(m, State.SITTING_PC, "sittingPc");
  m.forceWorking = true;
  m.x = 20;
  m.y = SPRITE_SIZE * 0.7;
  m.facingRight = false;
  return m;
}

function currentFrame(m: ShimejiMascot): AnimFrame {
  const animation = ANIMATIONS_FULL[m.currentAnimation] || ANIMATIONS_FULL.idle;
  return animation[m.animationFrame % animation.length] || animation[0];
}

function tickWorking(m: ShimejiMascot, perch: Perch | null, size: number) {
  m.velocityX = 0;
  m.velocityY = 0;
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

function updateState(m: ShimejiMascot, bounds: Bounds, scale: number, perch: Perch | null) {
  const size = SPRITE_SIZE * scale;
  const groundY = bounds.height;
  const leftBound = 0;
  const rightBound = Math.max(0, bounds.width - size);

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
      m.y = groundY;
      if (m.stateTimer > 40 && Math.random() < 0.03) {
        const roll = Math.random();
        if (roll < 0.58) {
          const facingRight = Math.random() > 0.5;
          m.direction = facingRight ? 1 : -1;
          m.facingRight = facingRight;
          setAnim(m, State.WALKING, walkCycleName(facingRight));
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
      m.x += PHYSICS.walkSpeed * m.direction;
      m.y = groundY;
      if (m.x <= leftBound) {
        m.x = leftBound;
        if (Math.random() < 0.35) {
          setAnim(m, State.SITTING_EDGE, "sittingEdge");
          m.facingRight = true;
          break;
        }
        setWalkDirection(m, true);
      } else if (m.x >= rightBound) {
        m.x = rightBound;
        if (Math.random() < 0.35) {
          setAnim(m, State.SITTING_EDGE, "sittingEdge");
          m.facingRight = false;
          break;
        }
        setWalkDirection(m, false);
      }
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
      if (m.x <= leftBound) {
        m.x = leftBound;
        m.velocityX = Math.abs(m.velocityX);
        m.facingRight = true;
      }
      if (m.x >= rightBound) {
        m.x = rightBound;
        m.velocityX = -Math.abs(m.velocityX);
        m.facingRight = false;
      }
      if (m.y >= groundY) {
        m.y = groundY;
        m.velocityY = 0;
        m.velocityX = 0;
        setAnim(m, State.SPRAWLED, "sprawled");
      }
      break;

    case State.SPRAWLED:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer > 80 && Math.random() < 0.03) setAnim(m, State.IDLE, "idle");
      break;

    case State.HEAD_SPIN:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer >= animDuration("headSpin")) setAnim(m, State.IDLE, "idle");
      break;

    case State.SITTING_EDGE:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer > 160 && Math.random() < 0.02) setAnim(m, State.IDLE, "idle");
      break;

    case State.SITTING_PC:
    case State.SITTING_PC_DANGLE:
      setAnim(m, State.IDLE, "idle");
      break;

    case State.DRAGGED:
      break;
  }

  m.x = Math.max(leftBound, Math.min(m.x, rightBound));
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

export function tickShimeji(
  m: ShimejiMascot,
  bounds: Bounds,
  scale: number,
  _cursorY: number | null,
  perch: Perch | null,
) {
  updateState(m, bounds, scale, perch);
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

export function endDrag(m: ShimejiMascot) {
  if (m.dragPending) {
    m.dragPending = false;
    return "click" as const;
  }
  if (!m.isDragging) return "none" as const;
  m.isDragging = false;
  const throwScale = 0.22;
  const maxThrow = 16;
  m.velocityX = Math.max(-maxThrow, Math.min(maxThrow, m.smoothedVelocityX * throwScale));
  m.velocityY = Math.max(-maxThrow, Math.min(maxThrow, m.smoothedVelocityY * throwScale));
  if (m.velocityX !== 0) m.facingRight = m.velocityX > 0;
  setAnim(m, State.FALLING, "falling");
  return "drop" as const;
}

export function setWorking(m: ShimejiMascot, working: boolean) {
  if (working === m.forceWorking) return;
  m.forceWorking = working;
  if (working) {
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
