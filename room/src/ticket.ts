export type PersonId = "katho" | "lulox";

export type RoomTicket = {
  personId: PersonId;
  email: string;
  exp: number;
};

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const bin = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of bin) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

export async function restoreRoomTicket(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): Promise<RoomTicket | null> {
  if (!token || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = await signPayload(payload, secret);
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch) return null;
  try {
    const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/") + pad)) as RoomTicket;
    if (json?.personId !== "katho" && json?.personId !== "lulox") return null;
    if (typeof json.email !== "string" || typeof json.exp !== "number") return null;
    if (json.exp <= now) return null;
    return json;
  } catch {
    return null;
  }
}
