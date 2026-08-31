import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { helpSystemMessages, isRaNimboIntent, localHelpReply, parseNimboIntent } from "@/lib/companion/chats";
import {
  completeLlmChat,
  localNimboReply,
  nimboSystemMessages,
  pickLlmProvider,
  type LlmChatMessage,
} from "@/lib/companion/llm";
import { applyRaIntent, boardLine, emptyRaBoard, loadRaBoard, trelloConfigured } from "@/lib/companion/trello";

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

  const intent = parseNimboIntent(text);
  let board = emptyRaBoard();
  let line = boardLine(board);
  let did: string = intent.type === "chat" ? "chat" : intent.type;
  const seat = { token: session.trelloToken ?? null };

  if (isRaNimboIntent(intent) && (intent.type !== "chat" || trelloConfigured(seat.token))) {
    const applied = await applyRaIntent(intent, seat).catch(() => null);
    if (applied) {
      board = applied.board;
      line = applied.line;
      did = applied.did;
    }
  } else if (trelloConfigured(seat.token)) {
    board = await loadRaBoard(seat).catch(() => emptyRaBoard());
    if (board.configured) line = boardLine(board);
  }

  let reply = localNimboReply(text, line);
  const pick = pickLlmProvider();
  if (intent.type === "chat" && pick.provider !== "none") {
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
    intent,
    provider: pick.provider,
  });
}
