/**
 * Together / apart state machine for Mochi + Lulox on the desk.
 * Occasional together acts when both people are present; leave → separate.
 */

export type LeaveKind = "logout" | "close" | "idle-away";
export type PresenceStatus = "present" | LeaveKind;
export type PairKind = "both-present" | "one-away" | "both-away";
export const TOGETHER_ACTIONS = ["kiss", "hop", "walk-together", "idle-chat"] as const;
export type TogetherAction = (typeof TOGETHER_ACTIONS)[number];

export const DEFAULT_TOGETHER_COOLDOWN_MS = 12_000;
export const DEFAULT_TOGETHER_CHANCE = 0.2;
export const DEFAULT_IDLE_AWAY_MS = 25_000;

export type PresenceHeartbeat = {
  status: PresenceStatus;
  at: number;
};

export type DeskZone = {
  xMin: number;
  xMax: number;
  gatherX: number;
  facingRight: boolean;
};

export type PresenceView =
  | {
      pair: "both-present";
      mode: "together";
      action: TogetherAction | "idle";
      lastTogetherAt: number | null;
    }
  | {
      pair: "one-away" | "both-away";
      mode: "separate";
      action: "separate";
      lastTogetherAt: null;
      left: "katho" | "lulox" | "both";
    };

export function classifyPair(katho: PresenceStatus, lulox: PresenceStatus): PairKind {
  const k = katho === "present";
  const l = lulox === "present";
  if (k && l) return "both-present";
  if (!k && !l) return "both-away";
  return "one-away";
}

export function whoLeft(katho: PresenceStatus, lulox: PresenceStatus): "katho" | "lulox" | "both" | null {
  const k = katho === "present";
  const l = lulox === "present";
  if (k && l) return null;
  if (!k && !l) return "both";
  return k ? "lulox" : "katho";
}

export function statusFromHeartbeat(
  hb: PresenceHeartbeat | null | undefined,
  now: number,
  idleMs = DEFAULT_IDLE_AWAY_MS,
): PresenceStatus {
  if (!hb) return "close";
  if (hb.status !== "present") return hb.status;
  if (now - hb.at > idleMs) return "idle-away";
  return "present";
}

export function nextTogetherTick(input: {
  katho: PresenceStatus;
  lulox: PresenceStatus;
  now: number;
  lastTogetherAt: number | null;
  rng: () => number;
  cooldownMs?: number;
  chance?: number;
}): PresenceView {
  const pair = classifyPair(input.katho, input.lulox);
  if (pair !== "both-present") {
    return {
      pair,
      mode: "separate",
      action: "separate",
      lastTogetherAt: null,
      left: whoLeft(input.katho, input.lulox) || "both",
    };
  }
  const cooldown = input.cooldownMs ?? DEFAULT_TOGETHER_COOLDOWN_MS;
  const chance = input.chance ?? DEFAULT_TOGETHER_CHANCE;
  const cooled =
    input.lastTogetherAt == null || input.now - input.lastTogetherAt >= cooldown;
  if (!cooled) {
    return {
      pair,
      mode: "together",
      action: "idle",
      lastTogetherAt: input.lastTogetherAt,
    };
  }
  if (input.rng() >= chance) {
    return {
      pair,
      mode: "together",
      action: "idle",
      lastTogetherAt: input.lastTogetherAt,
    };
  }
  const pick = input.rng();
  const index = Math.min(
    TOGETHER_ACTIONS.length - 1,
    Math.max(0, Math.floor(pick * TOGETHER_ACTIONS.length)),
  );
  return {
    pair,
    mode: "together",
    action: TOGETHER_ACTIONS[index],
    lastTogetherAt: input.now,
  };
}

/** Spatial split so Katho can see someone left without a lecture. */
export function deskZones(
  mode: "together" | "separate",
  action: TogetherAction | "idle" | "separate",
  width: number,
): { mochi: DeskZone; lulox: DeskZone; nimbo: DeskZone } {
  const w = Math.max(320, width);
  const mid = w * 0.5;
  const nimbo: DeskZone =
    mode === "separate"
      ? { xMin: w * 0.38, xMax: w * 0.62, gatherX: mid, facingRight: true }
      : { xMin: w * 0.04, xMax: w * 0.22, gatherX: w * 0.12, facingRight: true };
  if (mode === "separate") {
    return {
      mochi: {
        xMin: 0,
        xMax: w * 0.32,
        gatherX: w * 0.12,
        facingRight: true,
      },
      lulox: {
        xMin: w * 0.68,
        xMax: w,
        gatherX: w * 0.84,
        facingRight: false,
      },
      nimbo,
    };
  }
  if (action === "kiss") {
    return {
      mochi: { xMin: mid - 140, xMax: mid - 8, gatherX: mid - 36, facingRight: true },
      lulox: { xMin: mid + 8, xMax: mid + 140, gatherX: mid + 36, facingRight: false },
      nimbo,
    };
  }
  if (action === "idle-chat") {
    return {
      mochi: { xMin: mid - 180, xMax: mid - 10, gatherX: mid - 70, facingRight: true },
      lulox: { xMin: mid + 10, xMax: mid + 180, gatherX: mid + 70, facingRight: false },
      nimbo,
    };
  }
  if (action === "walk-together") {
    return {
      mochi: { xMin: w * 0.18, xMax: w * 0.72, gatherX: mid - 50, facingRight: true },
      lulox: { xMin: w * 0.26, xMax: w * 0.8, gatherX: mid + 50, facingRight: true },
      nimbo,
    };
  }
  return {
    mochi: { xMin: mid - 200, xMax: mid - 16, gatherX: mid - 80, facingRight: true },
    lulox: { xMin: mid + 16, xMax: mid + 200, gatherX: mid + 80, facingRight: false },
    nimbo,
  };
}

export function zonesAreApart(zones: { mochi: DeskZone; lulox: DeskZone }): boolean {
  return zones.mochi.xMax <= zones.lulox.xMin;
}

export function leaveSignalText(view: PresenceView): string | null {
  if (view.mode !== "separate" || view.pair !== "one-away") return null;
  if (view.left === "lulox") return "Lulox se fue";
  if (view.left === "katho") return "Katho se fue";
  return null;
}

export const IDLE_CHAT_LINES = {
  mochi: ["che", "acá estoy", "dale"],
  lulox: ["miau", "dale", "sigo"],
  nimbo: ["dale"],
} as const;
