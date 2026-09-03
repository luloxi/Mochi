import { NextRequest, NextResponse } from "next/server";
import {
  COMPANION_SESSION_COOKIE,
  restoreCompanionSession,
  sessionCookieOptions,
  encodeCompanionSession,
  publicCompanionSession,
} from "@/lib/companion/auth";
import { companionRoomUrl, encodeRoomTicket } from "@/lib/companion/room-ticket";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null;
  const session = restoreCompanionSession(token);
  if (!session) {
    const response = NextResponse.json({ session: null });
    response.cookies.delete(COMPANION_SESSION_COOKIE);
    return response;
  }
  const response = NextResponse.json({
    session: publicCompanionSession(session),
    room: { url: companionRoomUrl(), ticket: encodeRoomTicket(session) },
  });
  response.cookies.set(COMPANION_SESSION_COOKIE, encodeCompanionSession(session), sessionCookieOptions());
  return response;
}
