import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { getServerSyncStore, handleCompanionSyncRequest } from "@/lib/companion/sync";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

export async function GET(request: NextRequest) {
  const result = handleCompanionSyncRequest({
    store: getServerSyncStore(),
    session: sessionFrom(request),
    method: "GET",
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const result = handleCompanionSyncRequest({
    store: getServerSyncStore(),
    session: sessionFrom(request),
    method: "POST",
    body: json,
  });
  return NextResponse.json(result.body, { status: result.status });
}
