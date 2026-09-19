import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { fetchUpcomingEvents } from "@/lib/companion/calendar";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

export async function POST(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const accessToken = typeof json?.accessToken === "string" ? json.accessToken.trim() : "";
  const daysAhead = typeof json?.daysAhead === "number" ? json.daysAhead : 3;
  const result = await fetchUpcomingEvents(accessToken, { daysAhead, maxResults: 10 });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason, line: result.line, events: [] },
      { status: result.reason === "missing-token" ? 400 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    events: result.events,
    line: result.line,
    email: session.email,
  });
}
