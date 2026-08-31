import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import {
  addRaCard,
  applyRaIntent,
  doneRaCard,
  inboxList,
  loadRaBoard,
  matchList,
  moveRaCard,
  trelloConfigured,
  type RaIntent,
} from "@/lib/companion/trello";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

export async function GET(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const configured = trelloConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, board: { lists: [], cards: [] } });
  }
  try {
    const board = await loadRaBoard();
    return NextResponse.json({ configured: true, board });
  } catch (error) {
    return NextResponse.json({ configured: true, error: String(error), board: { lists: [], cards: [] } }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const json = await request.json().catch(() => null);
  const action = typeof json?.action === "string" ? json.action : "";

  if (!trelloConfigured()) {
    return NextResponse.json({ configured: false, error: "TRELLO_UNCONFIGURED" }, { status: 503 });
  }

  try {
    if (action === "add") {
      const title = typeof json?.title === "string" ? json.title.trim() : "";
      if (!title) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
      const board = await loadRaBoard();
      const list =
        (typeof json?.listId === "string" && board.lists.find((l) => l.id === json.listId)) ||
        (typeof json?.listHint === "string" && matchList(board, json.listHint)) ||
        inboxList(board);
      if (!list) return NextResponse.json({ error: "NO_LIST" }, { status: 400 });
      await addRaCard(title, list.id);
      const next = await loadRaBoard();
      return NextResponse.json({ configured: true, board: next, did: "add" });
    }
    if (action === "move") {
      const cardId = typeof json?.cardId === "string" ? json.cardId : "";
      const listId = typeof json?.listId === "string" ? json.listId : "";
      if (!cardId || !listId) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
      await moveRaCard(cardId, listId);
      const next = await loadRaBoard();
      return NextResponse.json({ configured: true, board: next, did: "move" });
    }
    if (action === "done") {
      const cardId = typeof json?.cardId === "string" ? json.cardId : "";
      if (!cardId) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
      const board = await loadRaBoard();
      await doneRaCard(cardId, board);
      const next = await loadRaBoard();
      return NextResponse.json({ configured: true, board: next, did: "done" });
    }
    if (action === "intent") {
      const text = typeof json?.text === "string" ? json.text : "";
      const intent: RaIntent = { type: "chat" };
      const applied = await applyRaIntent(text ? { type: "add", title: text } : intent);
      return NextResponse.json({ configured: true, board: applied.board, did: applied.did, line: applied.line });
    }
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
