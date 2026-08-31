/**
 * Ra as a house game: one color per card (Tano order), desktop shortcuts,
 * drag-to-the-sky to archive. Not an embedded Trello.
 */

import { FEEL_COLOR_IDS, FEEL_COLORS, type FeelColor } from "./boards";
import type { PersonId } from "./companion-core";

/** Tano/Ra: azul, violeta, rojo, naranja, amarillo, verde. */
export const HOUSE_COLOR_ORDER: FeelColor[] = FEEL_COLOR_IDS;

export const HOUSE_COLOR_LABELS: string[] = HOUSE_COLOR_ORDER.map((id) => FEEL_COLORS[id].label);

export const TOP_ARCHIVE_Y = 72;

export const ARCHIVE_SHORTCUT = "e";

export type HouseLink = { id: string; name: string; url: string };

export type HouseCardPatch =
  | { action: "desc"; cardId: string; desc: string }
  | { action: "due"; cardId: string; due: string | null }
  | { action: "assign"; cardId: string; memberId: string | null }
  | { action: "link"; cardId: string; url: string }
  | { action: "check"; cardId: string; itemId: string; complete: boolean };

export type HouseShortcut =
  | { type: "archive" }
  | { type: "color"; color: FeelColor }
  | { type: "none" };

export function dragHitsArchive(clientY: number, topY = TOP_ARCHIVE_Y): boolean {
  return Number.isFinite(clientY) && clientY < topY;
}

function typingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return !!el.isContentEditable;
}

export function parseHouseShortcut(event: {
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: unknown;
}): HouseShortcut {
  if (event.metaKey || event.ctrlKey || event.altKey) return { type: "none" };
  if (typingTarget(event.target)) return { type: "none" };
  const key = String(event.key || "");
  if (key === ARCHIVE_SHORTCUT || key === ARCHIVE_SHORTCUT.toUpperCase()) return { type: "archive" };
  if (key.length === 1 && key >= "1" && key <= "6") {
    const color = HOUSE_COLOR_ORDER[Number(key) - 1];
    if (color) return { type: "color", color };
  }
  return { type: "none" };
}

export function personFromMemberName(fullName: string, username = ""): PersonId | null {
  const blob = `${fullName} ${username}`.toLowerCase();
  if (blob.includes("katho") || blob.includes("kathonejo")) return "katho";
  if (blob.includes("lulox") || blob.includes("luciano") || blob.includes("oliva")) return "lulox";
  return null;
}

export function assigneeLine(
  member: { fullName?: string; username?: string; name?: string } | null | undefined,
): string {
  if (!member) return "";
  const fullName = String(member.fullName || member.name || "");
  const username = String(member.username || "");
  const person = personFromMemberName(fullName, username);
  if (person === "katho") return "Katho";
  if (person === "lulox") return "Lulox";
  return fullName || username;
}

export function formatHouseDue(due: string | null | undefined): string {
  if (!due) return "";
  const d = new Date(due);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function extractCardLinks(
  attachments: Array<{ id?: string; name?: string; url?: string }> | undefined,
): HouseLink[] {
  const out: HouseLink[] = [];
  for (const row of attachments || []) {
    const url = String(row.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      id: String(row.id || url),
      name: String(row.name || url),
      url,
    });
  }
  return out;
}
