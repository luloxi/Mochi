/**
 * Google allowlist + persistable companion session.
 * I/O (Google tokeninfo, cookies) stays in the API route; tests drive these units.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PersonId } from "./companion-core";

export const KATHO_GOOGLE_EMAIL = "kathonejo@gmail.com";
export const LULOX_GOOGLE_EMAIL = "lucianoolivabianco@gmail.com";

export const COMPANION_SESSION_COOKIE = "mochi-companion-session";
/** 30 days — Android Chrome must keep this across reloads, not tab memory. */
export const COMPANION_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type AllowlistedSeat = {
  personId: PersonId;
  name: string;
  mascot: "mochi" | "lulox";
  kind: "rabbit" | "ninja-cat";
  pronoun: "ella" | "él";
};

export const GOOGLE_ALLOWLIST: Record<string, AllowlistedSeat> = {
  [KATHO_GOOGLE_EMAIL]: {
    personId: "katho",
    name: "Katho",
    mascot: "mochi",
    kind: "rabbit",
    pronoun: "ella",
  },
  [LULOX_GOOGLE_EMAIL]: {
    personId: "lulox",
    name: "Lulox",
    mascot: "lulox",
    kind: "ninja-cat",
    pronoun: "él",
  },
};

export type CompanionAuthSession = {
  email: string;
  personId: PersonId;
  name: string;
  mascot: "mochi" | "lulox";
  kind: "rabbit" | "ninja-cat";
  pronoun: "ella" | "él";
  issuedAt: number;
  /** Per-seat house token. Cookie only — never JSON to the client, never env. */
  trelloToken?: string;
};

export type CompanionPublicSession = Omit<CompanionAuthSession, "trelloToken"> & {
  trelloConnected: boolean;
};

export function normalizeGoogleEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

export function seatFromGoogleEmail(
  email: string | null | undefined,
): { ok: true; email: string } & AllowlistedSeat | { ok: false; reason: "empty" | "denied" } {
  const normalized = normalizeGoogleEmail(email);
  if (!normalized) return { ok: false, reason: "empty" };
  const seat = GOOGLE_ALLOWLIST[normalized];
  if (!seat) return { ok: false, reason: "denied" };
  return { ok: true, email: normalized, ...seat };
}

export function acceptGoogleSignIn(
  input: { email?: string | null; email_verified?: boolean | string | null },
  now = Date.now(),
):
  | { ok: true; session: CompanionAuthSession }
  | { ok: false; reason: "empty" | "denied" | "unverified" } {
  const verified = input.email_verified === true || input.email_verified === "true";
  if (input.email && !verified) return { ok: false, reason: "unverified" };
  const seat = seatFromGoogleEmail(input.email);
  if (!seat.ok) return { ok: false, reason: seat.reason };
  return {
    ok: true,
    session: createCompanionSession(seat.email, now)!,
  };
}

export function createCompanionSession(
  email: string,
  now = Date.now(),
): CompanionAuthSession | null {
  const seat = seatFromGoogleEmail(email);
  if (!seat.ok) return null;
  return {
    email: seat.email,
    personId: seat.personId,
    name: seat.name,
    mascot: seat.mascot,
    kind: seat.kind,
    pronoun: seat.pronoun,
    issuedAt: now,
  };
}

export function sessionSecret(explicit?: string): string {
  return explicit || process.env.COMPANION_SESSION_SECRET || "mochi-companion-katho-lulox-v1";
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeCompanionSession(
  session: CompanionAuthSession,
  secret = sessionSecret(),
): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function restoreCompanionSession(
  token: string | null | undefined,
  secret = sessionSecret(),
  now = Date.now(),
): CompanionAuthSession | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = signPayload(payload, secret);
  if (sig.length !== expected.length) return null;
  const sigBytes = Uint8Array.from(Buffer.from(sig));
  const expectedBytes = Uint8Array.from(Buffer.from(expected));
  if (!timingSafeEqual(sigBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CompanionAuthSession;
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.issuedAt !== "number") return null;
    if (now - parsed.issuedAt > COMPANION_SESSION_MAX_AGE_SEC * 1000) return null;
    const fresh = createCompanionSession(parsed.email, parsed.issuedAt);
    if (!fresh) return null;
    const trelloToken = typeof parsed.trelloToken === "string" ? parsed.trelloToken.trim() : "";
    if (trelloToken && isPlausibleSeatToken(trelloToken)) {
      return { ...fresh, trelloToken };
    }
    return fresh;
  } catch {
    return null;
  }
}

export function isPlausibleSeatToken(token: string): boolean {
  return /^[a-zA-Z0-9]{32,256}$/.test(String(token || "").trim());
}

export function withTrelloToken(session: CompanionAuthSession, token: string): CompanionAuthSession {
  const trelloToken = String(token || "").trim();
  if (!isPlausibleSeatToken(trelloToken)) {
    const next = { ...session };
    delete next.trelloToken;
    return next;
  }
  return { ...session, trelloToken };
}

export function publicCompanionSession(session: CompanionAuthSession): CompanionPublicSession {
  return {
    email: session.email,
    personId: session.personId,
    name: session.name,
    mascot: session.mascot,
    kind: session.kind,
    pronoun: session.pronoun,
    issuedAt: session.issuedAt,
    trelloConnected: Boolean(session.trelloToken && isPlausibleSeatToken(session.trelloToken)),
  };
}

/** Cookie jar used by tests to simulate an Android Chrome reload (not tab memory). */
export function persistSessionThroughReload(
  session: CompanionAuthSession,
  jar: Map<string, string> = new Map(),
  secret = sessionSecret(),
): { jar: Map<string, string>; restored: CompanionAuthSession | null } {
  jar.set(COMPANION_SESSION_COOKIE, encodeCompanionSession(session, secret));
  const restored = restoreCompanionSession(jar.get(COMPANION_SESSION_COOKIE) ?? null, secret);
  return { jar, restored };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COMPANION_SESSION_MAX_AGE_SEC,
  };
}

export async function readGoogleIdTokenEmail(
  idToken: string,
  expectedClientId: string,
): Promise<{ email: string; email_verified: boolean } | null> {
  const token = String(idToken || "").trim();
  if (!token || token.length < 20) return null;
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      email?: string;
      email_verified?: boolean | string;
      aud?: string;
    };
    if (expectedClientId && json.aud !== expectedClientId) return null;
    if (typeof json.email !== "string") return null;
    return {
      email: json.email,
      email_verified: json.email_verified === true || json.email_verified === "true",
    };
  } catch {
    return null;
  }
}

/** Public GIS web client (GCP mochi-507219). Origins: https://mochiagents.vercel.app and http://localhost:3000. */
export const COMPANION_GOOGLE_CLIENT_ID =
  "253648842852-crcqh36v7bogroqae76f4mchit37nl4i.apps.googleusercontent.com";

export function googleClientId(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    COMPANION_GOOGLE_CLIENT_ID
  ).trim();
}
