/**
 * Three click-to-open windows: Mochi pink, Lulox cyan, Nimbo gold/gray.
 * Nimbo is the task pet: Ra list/add/move/done, pomodoro start/stop, add to the list.
 * Click the other person's pet for human chat.
 */

import { parseRaIntent, type RaIntent } from "./trello";
import { parseCompanionIntent } from "./companion-core";
import { NIMBO_NAME } from "./llm";

export type ChatWindowId = "mochi" | "lulox" | "nimbo";

export type ChatWindowDef = {
  id: ChatWindowId;
  label: string;
  colorName: "pink" | "cyan" | "gold";
  hex: string;
  chrome: string;
  ink: string;
};

export const CHAT_WINDOWS: Record<ChatWindowId, ChatWindowDef> = {
  mochi: {
    id: "mochi",
    label: "Mochi",
    colorName: "pink",
    hex: "#ff8fcf",
    chrome: "#c2186a",
    ink: "#140c18",
  },
  lulox: {
    id: "lulox",
    label: "Lulox",
    colorName: "cyan",
    hex: "#7ad7ff",
    chrome: "#0a6e94",
    ink: "#140c18",
  },
  nimbo: {
    id: "nimbo",
    label: NIMBO_NAME,
    colorName: "gold",
    hex: "#d4a017",
    chrome: "#6b4f0a",
    ink: "#140c18",
  },
};

export function chatWindowList(): ChatWindowDef[] {
  return [CHAT_WINDOWS.mochi, CHAT_WINDOWS.lulox, CHAT_WINDOWS.nimbo];
}

export type NimboIntent =
  | RaIntent
  | { type: "pomodoro"; action: "start" | "stop"; minutes?: number }
  | { type: "todo"; action: "add"; text: string };

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

function parseNimboPomodoro(raw: string): NimboIntent | null {
  const lower = raw.toLowerCase();
  const isPomo = includesAny(lower, ["pomodoro", "pomo", "tomate", "timer de foco"]);
  if (!isPomo) return null;
  const isStop = includesAny(lower, [
    "pará",
    "para el pomo",
    "para el tomate",
    "stop",
    "pausá",
    "pausa",
    "pause",
    "cortá",
    "frená",
    "reiniciá",
    "reset",
    "cancelá",
    "cancela",
  ]);
  if (isStop) return { type: "pomodoro", action: "stop" };
  const minutes = Number((lower.match(/(\d+)\s*(min|minuto)/) || [])[1]);
  return {
    type: "pomodoro",
    action: "start",
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(90, minutes) : undefined,
  };
}

export function parseNimboIntent(raw: string): NimboIntent {
  const pomo = parseNimboPomodoro(raw);
  if (pomo) return pomo;
  const ra = parseRaIntent(raw);
  if (ra.type !== "chat") return ra;
  const companion = parseCompanionIntent(raw);
  if (companion.type === "todo" && companion.action === "add" && companion.text) {
    return { type: "todo", action: "add", text: companion.text };
  }
  return { type: "chat" };
}

export function isRaNimboIntent(intent: NimboIntent): intent is RaIntent {
  return (
    intent.type === "list" ||
    intent.type === "add" ||
    intent.type === "move" ||
    intent.type === "done" ||
    intent.type === "chat"
  );
}

/** @deprecated use parseNimboIntent */
export const parseCoordinatorIntent = parseNimboIntent;
export const parseAppAgentIntent = parseNimboIntent;

export function nimboCanDrive(intent: NimboIntent): boolean {
  return intent.type !== "chat";
}

/** @deprecated use nimboCanDrive */
export const coordinatorCanDrive = nimboCanDrive;
export const appAgentCanDrive = nimboCanDrive;
