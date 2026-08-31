import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import {
  completeLlmChat,
  localNimboReply,
  nimboSystemMessages,
  pickLlmProvider,
  type LlmChatMessage,
} from "@/lib/companion/llm";
import { applyRaIntent, parseRaIntent } from "@/lib/companion/trello";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

export async function POST(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const text = typeof json?.text === "string" ? json.text.trim() : "";
  if (!text) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

  const intent = parseRaIntent(text);
  const applied = await applyRaIntent(intent).catch(() => null);
  const board = applied?.board ?? null;
  const line = applied?.line ?? "";
  const did = applied?.did ?? "chat";

  let reply = localNimboReply(text, line);
  const pick = pickLlmProvider();
  if (pick.provider !== "none") {
    const history = Array.isArray(json?.history)
      ? (json.history as LlmChatMessage[]).filter(
          (row) =>
            row &&
            (row.role === "user" || row.role === "assistant") &&
            typeof row.content === "string",
        ).slice(-8)
      : [];
    const llm = await completeLlmChat([
      ...nimboSystemMessages(line),
      ...history,
      { role: "user", content: text },
    ]).catch(() => ({ provider: pick.provider, text: "" as string }));
    if (llm.text) reply = llm.text;
  }

  return NextResponse.json({
    reply,
    board,
    did,
    provider: pick.provider,
  });
}
