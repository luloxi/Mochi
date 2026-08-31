import { NextRequest, NextResponse } from "next/server";
import {
  acceptGoogleSignIn,
  COMPANION_SESSION_COOKIE,
  encodeCompanionSession,
  googleClientId,
  publicCompanionSession,
  readGoogleAccessTokenEmail,
  readGoogleIdTokenEmail,
  sessionCookieOptions,
} from "@/lib/companion/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const idToken = typeof json?.idToken === "string" ? json.idToken : "";
  const accessToken = typeof json?.accessToken === "string" ? json.accessToken : "";
  const clientId = googleClientId();
  const payload = idToken
    ? await readGoogleIdTokenEmail(idToken, clientId)
    : await readGoogleAccessTokenEmail(accessToken, clientId);
  if (!payload) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }
  const result = acceptGoogleSignIn(payload);
  if (!result.ok) {
    const status = result.reason === "denied" || result.reason === "unverified" ? 403 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  const token = encodeCompanionSession(result.session);
  const response = NextResponse.json({ session: publicCompanionSession(result.session) });
  response.cookies.set(COMPANION_SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
