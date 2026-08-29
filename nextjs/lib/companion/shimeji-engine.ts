/**
 * Companion shimeji runtime for Katho's Mochi (characters/mochi).
 * Walk / sit-pc-edge / spin / sprawl using frames that exist in
 * nextjs/public/sprites/mochi/. No climb set on this character.
 *
 * Cloak is asymmetric (red | yellow): never scaleX the body.
 * Star-eye is composited in the pet view so it leads the walk.
 */

export const SPRITE_SIZE = 128;
export const TICK_MS = 40;
export const SPRITE_BASE = "/sprites/mochi/";

export const PHYSICS = {
  gravity: 2,
  walkSpeed: 2,
  fallTerminalVelocity: 20,
  jumpForce: -12,
  collisionJumpSpeed: 3.2,
} as const;

export const State = {
  IDLE: "idle",
  WALKING: "walking",
  CRAWLING: "crawling",
  FALLING: "falling",
  LANDING: "landing",
  SITTING: "sitting",
  DRAGGED: "dragged",
  JUMPING: "jumping",
  CLIMBING_WALL: "climbing_wall",
  CLIMBING_CEILING: "climbing_ceiling",
  SITTING_EDGE: "sitting_edge",
  SITTING_PC: "sitting_pc",
  SITTING_PC_DANGLE: "sitting_pc_dangle",
  HEAD_SPIN: "head_spin",
  SPRAWLED: "sprawled",
} as const;

export type ShimejiState = (typeof State)[keyof typeof State];

/** Only filenames that exist on characters/mochi (also public/sprites/mochi). */
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
};

type AnimFrame = { sprite: string; duration: number };

export const ANIMATIONS_FULL: Record<string, AnimFrame[]> = {
  idle: [{ sprite: "stand-neutral", duration: 1 }],
  walking: [
    { sprite: "stand-neutral", duration: 6 },
    { sprite: "walk-step-left", duration: 6 },
    { sprite: "stand-neutral", duration: 6 },
    { sprite: "walk-step-right", duration: 6 },
  ],
  crawling: [
    { sprite: "sprawl-lying", duration: 10 },
    { sprite: "stand-neutral", duration: 10 },
  ],
  falling: [{ sprite: "stand-neutral", duration: 1 }],
  jumping: [{ sprite: "stand-neutral", duration: 1 }],
  landing: [{ sprite: "stand-neutral", duration: 8 }],
  sitting: [{ sprite: "sit-edge-legs-down", duration: 1 }],
  sittingLookUp: [{ sprite: "sit-edge-legs-down", duration: 1 }],
  sprawled: [{ sprite: "sprawl-lying", duration: 1 }],
  climbingWall: [{ sprite: "stand-neutral", duration: 1 }],
  climbingCeiling: [{ sprite: "stand-neutral", duration: 1 }],
  sittingEdge: [
    { sprite: "sit-edge-legs-down", duration: 20 },
    { sprite: "sit-edge-dangle-frame-1", duration: 15 },
    { sprite: "sit-edge-legs-down", duration: 20 },
    { sprite: "sit-edge-dangle-frame-2", duration: 15 },
  ],
  headSpin: [
    { sprite: "spin-head-frame-1", duration: 5 },
    { sprite: "spin-head-frame-4", duration: 5 },
    { sprite: "spin-head-frame-2", duration: 5 },
    { sprite: "spin-head-frame-5", duration: 5 },
    { sprite: "spin-head-frame-3", duration: 5 },
    { sprite: "spin-head-frame-6", duration: 5 },
    { sprite: "stand-neutral", duration: 5 },
  ],
  sittingPc: [{ sprite: "sit-pc-edge-legs-down", duration: 10 }],
  sittingPcDangle: [
    { sprite: "sit-pc-edge-dangle-frame-1", duration: 15 },
    { sprite: "sit-pc-edge-dangle-frame-2", duration: 15 },
  ],
};

export function spriteUrl(key: string): string {
  const file = SPRITES[key] || SPRITES["stand-neutral"];
  return `${SPRITE_BASE}${file}`;
}

/** Native art: sparkle in viewer's right eye. Percent of the 384² sprite box. */
const EYE_RIGHT = { x: "62%", y: "34%" };
const EYE_LEFT = { x: "34%", y: "34%" };

export function starEyeLayout(facingRight: boolean) {
  if (facingRight) {
    return {
      overlay: false as const,
      cover: false as const,
      overlayPos: EYE_RIGHT,
      coverPos: EYE_RIGHT,
    };
  }
  return {
    overlay: true as const,
    cover: true as const,
    overlayPos: EYE_LEFT,
    coverPos: EYE_RIGHT,
  };
}

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
  isResisting: boolean;
  resistAnimTick: number;
  stateTimer: number;
  climbSide: number;
  climbSpeed: number;
  jumpCooldown: number;
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
    y: bounds.height,
    velocityX: 0,
    velocityY: 0,
    state: State.IDLE,
    facingRight: false,
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
    isResisting: false,
    resistAnimTick: 0,
    stateTimer: 0,
    climbSide: 0,
    climbSpeed: 1.5,
    jumpCooldown: 0,
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

function applyTransform(m: ShimejiMascot) {
  // Keep cloak red|yellow. Star-eye is a separate overlay.
  m.transform = "none";
}

function updateDragAnimation(m: ShimejiMascot) {
  m.dragTick++;
  const dragDelta = m.x - m.prevDragX;
  const dragDeltaY = m.y - m.prevDragY;
  m.prevDragX = m.x;
  m.prevDragY = m.y;
  const alpha = 0.2;
  m.smoothedVelocityX = m.smoothedVelocityX * (1 - alpha) + dragDelta * alpha * 5;
  m.smoothedVelocityY = m.smoothedVelocityY * (1 - alpha) + dragDeltaY * alpha * 5;
  if (Math.abs(m.smoothedVelocityX) > 0.4) {
    m.facingRight = m.smoothedVelocityX > 0;
  }
  m.spriteKey = "stand-neutral";
  m.transform = "none";
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

function turnAtWall(m: ShimejiMascot, goRight: boolean) {
  m.direction = goRight ? 1 : -1;
  m.facingRight = goRight;
}

function updateState(
  m: ShimejiMascot,
  bounds: Bounds,
  scale: number,
  cursorY: number | null,
  perch: Perch | null,
) {
  const size = SPRITE_SIZE * scale;
  const groundY = bounds.height;
  const leftBound = 0;
  const rightBound = Math.max(0, bounds.width - size);

  if (m.jumpCooldown > 0) m.jumpCooldown--;

  if (m.isDragging) {
    updateDragAnimation(m);
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
      if (m.stateTimer > 50 && Math.random() < 0.02) {
        const roll = Math.random();
        if (roll < 0.55) {
          setAnim(m, State.WALKING, "walking");
          m.direction = Math.random() > 0.5 ? 1 : -1;
          m.facingRight = m.direction > 0;
        } else if (roll < 0.72) {
          setAnim(m, State.SITTING, "sitting");
        } else if (roll < 0.82) {
          setAnim(m, State.CRAWLING, "crawling");
          m.direction = Math.random() > 0.5 ? 1 : -1;
          m.facingRight = m.direction > 0;
        } else if (roll < 0.9) {
          setAnim(m, State.JUMPING, "jumping");
          m.velocityY = -14;
          m.velocityX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2);
          m.facingRight = m.velocityX > 0;
        } else if (roll < 0.96) {
          setAnim(m, State.HEAD_SPIN, "headSpin");
        } else {
          setAnim(m, State.SPRAWLED, "sprawled");
        }
      }
      break;

    case State.CRAWLING:
      m.stateTimer++;
      m.x += PHYSICS.walkSpeed * 0.6 * m.direction;
      m.y = groundY;
      if (m.x <= leftBound) {
        m.x = leftBound;
        turnAtWall(m, true);
      }
      if (m.x >= rightBound) {
        m.x = rightBound;
        turnAtWall(m, false);
      }
      if (m.stateTimer > 60 && Math.random() < 0.02) setAnim(m, State.IDLE, "idle");
      break;

    case State.WALKING:
      m.stateTimer++;
      m.x += PHYSICS.walkSpeed * m.direction;
      if (m.x <= leftBound) {
        m.x = leftBound;
        turnAtWall(m, true);
      } else if (m.x >= rightBound) {
        m.x = rightBound;
        turnAtWall(m, false);
      }
      if (m.stateTimer > 50 && Math.random() < 0.01) {
        setAnim(m, State.IDLE, "idle");
        m.direction = 0;
      }
      m.y = groundY;
      break;

    case State.JUMPING:
      m.velocityY += PHYSICS.gravity;
      m.velocityY = Math.min(m.velocityY, PHYSICS.fallTerminalVelocity);
      m.y += m.velocityY;
      m.x += m.velocityX;
      if (m.velocityX !== 0) m.facingRight = m.velocityX > 0;
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
        setAnim(m, State.LANDING, "landing");
      }
      break;

    case State.FALLING:
      m.velocityY += PHYSICS.gravity;
      m.velocityY = Math.min(m.velocityY, PHYSICS.fallTerminalVelocity);
      m.y += m.velocityY;
      if (m.y >= groundY) {
        m.y = groundY;
        m.velocityY = 0;
        setAnim(m, State.LANDING, "landing");
      }
      break;

    case State.LANDING:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer >= animDuration("landing")) setAnim(m, State.IDLE, "idle");
      break;

    case State.SITTING:
      m.stateTimer++;
      m.y = groundY;
      m.currentAnimation = "sitting";
      if (m.stateTimer > 100 && Math.random() < 0.01) {
        setAnim(m, State.HEAD_SPIN, "headSpin");
        break;
      }
      if (m.stateTimer > 100 && Math.random() < 0.02) setAnim(m, State.IDLE, "idle");
      break;

    case State.SPRAWLED:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer > 150 && Math.random() < 0.02) setAnim(m, State.IDLE, "idle");
      break;

    case State.HEAD_SPIN:
      m.stateTimer++;
      m.y = groundY;
      if (m.stateTimer >= animDuration("headSpin")) setAnim(m, State.SITTING, "sitting");
      break;

    case State.CLIMBING_WALL:
    case State.CLIMBING_CEILING:
    case State.SITTING_EDGE:
      setAnim(m, State.FALLING, "falling");
      m.velocityY = 0;
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
  if (m.isDragging) return;
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
  applyTransform(m);
}

export function tickShimeji(
  m: ShimejiMascot,
  bounds: Bounds,
  scale: number,
  cursorY: number | null,
  perch: Perch | null,
) {
  updateState(m, bounds, scale, cursorY, perch);
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
  m.isResisting = false;
  m.resistAnimTick = 0;
  m.forceWorking = false;
}

export function moveDrag(m: ShimejiMascot, clientX: number, clientY: number, bounds: Bounds, scale: number) {
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
