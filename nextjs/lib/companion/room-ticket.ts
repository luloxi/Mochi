/**
 * Short-lived ticket so the browser can open the Cloudflare room
 * without reading the httpOnly session cookie.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PersonId } from "./companion-core";
import { sessionSecret, type CompanionAuthSession } from "./auth";

export const ROOM_TICKET_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type RoomTicket = {
  personId: PersonId;
  email: string;
  exp: number;
};

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function roomSecret(explicit?: string): string {
  return explicit || process.env.COMPANION_ROOM_SECRET || sessionSecret();
}

export function encodeRoomTicket(
  session: Pick<CompanionAuthSession, "personId" | "email">,
  now = Date.now(),
  secret = roomSecret(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      personId: session.personId,
      email: session.email,
      exp: now + ROOM_TICKET_MAX_AGE_MS,
    } satisfies RoomTicket),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function restoreRoomTicket(
  token: string | null | undefined,
  secret = roomSecret(),
  now = Date.now(),
): RoomTicket | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = signPayload(payload, secret);
  if (sig.length !== expected.length) return null;
  try {
    const sigBytes = Uint8Array.from(Buffer.from(sig));
    const expectedBytes = Uint8Array.from(Buffer.from(expected));
    if (!timingSafeEqual(sigBytes, expectedBytes)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RoomTicket;
    if (parsed?.personId !== "katho" && parsed?.personId !== "lulox") return null;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function companionRoomUrl(): string {
  return String(process.env.COMPANION_ROOM_URL || process.env.NEXT_PUBLIC_COMPANION_ROOM_URL || "").replace(
    /\/$/,
    "",
  );
}
