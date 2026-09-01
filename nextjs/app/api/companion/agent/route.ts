import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { helpSystemMessages, localHelpReply } from "@/lib/companion/chats";
import { completeLlmChat, pickLlmProvider, type LlmChatMessage } from "@/lib/companion/llm";
import { runNimboTurn } from "@/lib/companion/nimbo-agent";

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

  const kind = json?.kind === "help" ? "help" : "nimbo";
  if (kind === "help") {
    let reply = localHelpReply(text, session.personId);
    const pick = pickLlmProvider();
    if (pick.provider !== "none") {
      const history = Array.isArray(json?.history)
        ? (json.history as LlmChatMessage[])
            .filter(
              (row) =>
                row &&
                (row.role === "user" || row.role === "assistant") &&
                typeof row.content === "string",
            )
            .slice(-8)
        : [];
      const llm = await completeLlmChat([
        ...helpSystemMessages(session.personId),
        ...history,
        { role: "user", content: text },
      ]).catch(() => ({ provider: pick.provider, text: "" as string }));
      if (llm.text) reply = llm.text;
    }
    return NextResponse.json({
      reply,
      kind: "help",
      did: "help",
      provider: pick.provider,
    });
  }

  const result = await runNimboTurn({
    text,
    history: Array.isArray(json?.history) ? json.history : [],
    seat: { token: session.trelloToken ?? null },
  });

  return NextResponse.json({
    reply: result.reply,
    board: result.board,
    did: result.did,
    intent: result.intent,
    provider: result.provider,
    openApp: result.openApp,
    usedTools: result.usedTools,
  });
}
