/**
 * Three click-to-open windows: Mochi pink, Lulox cyan, Nimbo gold/gray.
 * Nimbo is the Ra task agent. Click the other person's pet for human chat.
 */

import { parseRaIntent, type RaIntent } from "./trello";
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

export function parseNimboIntent(raw: string): RaIntent {
  return parseRaIntent(raw);
}

/** @deprecated use parseNimboIntent */
export const parseCoordinatorIntent = parseNimboIntent;
export const parseAppAgentIntent = parseNimboIntent;

export function nimboCanDrive(intent: RaIntent): boolean {
  return intent.type !== "chat";
}

/** @deprecated use nimboCanDrive */
export const coordinatorCanDrive = nimboCanDrive;
export const appAgentCanDrive = nimboCanDrive;
