import { NextRequest, NextResponse } from "next/server";
import {
  COMPANION_SESSION_COOKIE,
  encodeCompanionSession,
  restoreCompanionSession,
  sessionCookieOptions,
} from "@/lib/companion/auth";
import { handleCompanionTrelloRequest } from "@/lib/companion/trello";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  if (!host) return request.nextUrl.origin;
  return `${proto}://${host}`;
}

async function run(request: NextRequest, method: "GET" | "POST") {
  const body = method === "POST" ? await request.json().catch(() => null) : undefined;
  const result = await handleCompanionTrelloRequest({
    session: sessionFrom(request),
    method,
    body,
    origin: requestOrigin(request),
  });
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.session) {
    response.cookies.set(
      COMPANION_SESSION_COOKIE,
      encodeCompanionSession(result.session),
      sessionCookieOptions(),
    );
  }
  return response;
}

export async function GET(request: NextRequest) {
  return run(request, "GET");
}

export async function POST(request: NextRequest) {
  return run(request, "POST");
}
