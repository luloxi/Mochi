/**
 * Three click-to-open chat windows: Mochi pink, Lulox cyan, App agent gold/gray.
 * App agent drives pomodoro, YouTube, and boards.
 */

import { parseCompanionIntent, type CompanionIntent } from "./companion-core";
import { parseFeelColor, type FeelColor } from "./boards";

export type ChatWindowId = "mochi" | "lulox" | "app-agent";

export type ChatWindowDef = {
  id: ChatWindowId;
  label: string;
  colorName: "pink" | "cyan" | "gold-gray";
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
    chrome: "#c45b86",
    ink: "#2a1a33",
  },
  lulox: {
    id: "lulox",
    label: "Lulox",
    colorName: "cyan",
    hex: "#7ad7ff",
    chrome: "#2a6a88",
    ink: "#102430",
  },
  "app-agent": {
    id: "app-agent",
    label: "App",
    colorName: "gold-gray",
    hex: "#c9b37a",
    chrome: "#6b675c",
    ink: "#2a281f",
  },
};

export function chatWindowList(): ChatWindowDef[] {
  return [CHAT_WINDOWS.mochi, CHAT_WINDOWS.lulox, CHAT_WINDOWS["app-agent"]];
}

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

function stripLead(text: string, pattern: RegExp): string {
  return text.replace(pattern, "").trim();
}

export function parseAppAgentIntent(raw: string): CompanionIntent {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const color: FeelColor | undefined = parseFeelColor(lower) || undefined;

  if (
    includesAny(lower, [
      "nueva columna",
      "nueva col",
      "agregá una columna",
      "agrega una columna",
      "sumá una columna",
      "suma una columna",
      "add column",
    ])
  ) {
    const title = stripLead(
      text,
      /^(che[, ]+)?(porfa[, ]+)?(agregá|agrega|sumá|suma|nueva|nuevo|add)\s+(una\s+)?(columna|col|column)\s*/i,
    );
    return { type: "board", action: "add-column", title: title || undefined };
  }

  if (
    includesAny(lower, [
      "nueva tarjeta",
      "nueva card",
      "agregá una tarjeta",
      "agrega una tarjeta",
      "sumá una tarjeta",
      "add card",
    ])
  ) {
    const title = stripLead(
      text,
      /^(che[, ]+)?(porfa[, ]+)?(agregá|agrega|sumá|suma|nueva|nuevo|add)\s+(una\s+)?(tarjeta|card)\s*/i,
    );
    return { type: "board", action: "add-card", title: title || undefined, color };
  }

  if (
    includesAny(lower, [
      "nuevo tablero",
      "nuevo board",
      "agregá un tablero",
      "agrega un tablero",
      "add board",
    ])
  ) {
    const title = stripLead(
      text,
      /^(che[, ]+)?(porfa[, ]+)?(agregá|agrega|sumá|suma|nueva|nuevo|add)\s+(un\s+)?(tablero|board)\s*/i,
    );
    return { type: "board", action: "add-board", title: title || undefined };
  }

  if (includesAny(lower, ["tablero", "tableros", "board", "boards", "kanban"])) {
    return { type: "board", action: "open" };
  }

  return parseCompanionIntent(text);
}

export function appAgentCanDrive(intent: CompanionIntent): boolean {
  return intent.type === "pomodoro" || intent.type === "video" || intent.type === "board";
}
