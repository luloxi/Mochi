import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** In-app LLM lives at /api/companion/agent. Do not send people to grok.com. */
export async function POST() {
  return NextResponse.json({ error: "GONE", use: "/api/companion/agent" }, { status: 410 });
}
