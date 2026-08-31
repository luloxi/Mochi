/**
 * First-paint contract for the companion desk.
 * Three characters, bubbles above heads, no settings dump.
 */

import type { PrivateMsg } from "./companion-core";
import { NIMBO_NAME } from "./llm";

export const BUBBLE_PLACEMENT = "above-head" as const;

export const DESK_CHARACTERS = [
  {
    id: "mochi" as const,
    name: "Mochi",
    who: "Katho",
    pronoun: "ella" as const,
    colorName: "pink" as const,
    hex: "#ff8fcf",
    pack: "mochi" as const,
  },
  {
    id: "lulox" as const,
    name: "Lulox",
    who: "Lulox",
    pronoun: "él" as const,
    colorName: "cyan" as const,
    hex: "#7ad7ff",
    pack: "lulox" as const,
  },
  {
    id: "nimbo" as const,
    name: NIMBO_NAME,
    who: NIMBO_NAME,
    pronoun: "él" as const,
    colorName: "gold" as const,
    hex: "#d4a017",
    pack: "nimbo" as const,
  },
] as const;

export type DeskCharacterId = (typeof DESK_CHARACTERS)[number]["id"];

/** Strings that must not appear on first-paint markup (surface, css, login). */
export const FIRST_PAINT_FORBIDDEN = [
  "console.x.ai",
  "grok.com",
  "Chano",
  "Pegá la clave",
  "pega la clave",
  "placeholder=\"xai",
  "placeholder='xai",
  "Pomodoro",
  "YouTube",
  "Miniapps",
  "api-keys",
] as const;

export function firstPaintViolations(source: string): string[] {
  return FIRST_PAINT_FORBIDDEN.filter((needle) => source.includes(needle));
}

export function shortBubble(text: string, max = 72): string {
  const t = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function bubbleAboveHead(args: {
  character: DeskCharacterId;
  dms: PrivateMsg[];
  nimboLines?: string[];
}): string {
  if (args.character === "mochi") {
    const last = [...args.dms].reverse().find((m) => m.from === "katho" || m.from === "mochi");
    return shortBubble(last?.content || "hola");
  }
  if (args.character === "lulox") {
    const last = [...args.dms].reverse().find((m) => m.from === "lulox");
    return shortBubble(last?.content || "miau");
  }
  const lines = args.nimboLines || [];
  return shortBubble(lines.at(-1) || "dale");
}
