import { NextRequest, NextResponse } from "next/server";
import {
  buildGrokChatRequest,
  grokReplyFromPayload,
  type GrokChatMessage,
} from "@/lib/companion/grok-connect";

export const runtime = "nodejs";

function readMessages(input: unknown): GrokChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: GrokChatMessage[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    const content = (row as { content?: unknown }).content;
    if (
      (role === "system" || role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim()
    ) {
      out.push({ role, content: content.slice(0, 8000) });
    }
  }
  return out.slice(-16);
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const headerKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const bodyKey = typeof json?.apiKey === "string" ? json.apiKey.trim() : "";
  const apiKey = headerKey || bodyKey || process.env.XAI_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 401 });
  }
  const messages = readMessages(json?.messages);
  if (!messages.length) {
    return NextResponse.json({ error: "EMPTY" }, { status: 400 });
  }
  const built = buildGrokChatRequest({
    apiKey,
    messages,
    model: typeof json?.model === "string" ? json.model : undefined,
  });
  const upstream = await fetch(built.url, {
    method: built.method,
    headers: built.headers,
    body: JSON.stringify(built.body),
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "GROK_UPSTREAM", status: upstream.status, detail: payload },
      { status: 502 },
    );
  }
  const reply = grokReplyFromPayload(payload);
  return NextResponse.json({ reply, provider: "grok", url: built.url });
}
