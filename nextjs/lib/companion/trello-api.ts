/**
 * Server-only Trello request handler. Do not import from client components:
 * it pulls the companion session (node:crypto).
 */

import type { CompanionAuthSession } from "./auth";
import { isPlausibleSeatToken, withTrelloToken } from "./auth";
import type { FeelColor } from "./boards";
import { FEEL_COLOR_IDS, parseFeelColor } from "./boards";
import {
  RA_MISSING_LINE,
  addRaCard,
  applyRaIntent,
  archiveRaCard,
  assignRaCard,
  colorRaCard,
  describeRaCard,
  doneRaCard,
  dueRaCard,
  emptyRaBoard,
  inboxList,
  linkRaCard,
  loadRaBoard,
  matchList,
  moveRaCard,
  parseRaIntent,
  publicTrelloPayload,
  trelloConfigured,
  verifySeatTrello,
  type RaSeat,
} from "./trello";

export type CompanionTrelloResult = {
  status: number;
  body: Record<string, unknown>;
  session?: CompanionAuthSession;
};

export async function handleCompanionTrelloRequest(args: {
  session: CompanionAuthSession | null;
  method: "GET" | "POST";
  body?: unknown;
  origin?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<CompanionTrelloResult> {
  if (!args.session) {
    return { status: 401, body: { error: "UNAUTHENTICATED" } };
  }
  const env = args.env ?? process.env;
  const fetchImpl = args.fetchImpl ?? fetch;
  const seat: RaSeat = { token: args.session.trelloToken ?? null, env };
  const origin = String(args.origin || "").trim();

  if (args.method === "GET") {
    const configured = trelloConfigured(seat.token, env);
    if (!configured) {
      const board = emptyRaBoard();
      return { status: 200, body: publicTrelloPayload({ board, origin, env }) };
    }
    try {
      const board = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board, origin, env }) };
    } catch {
      return {
        status: 502,
        body: publicTrelloPayload({
          board: { ...emptyRaBoard(), configured: true },
          origin,
          env,
          line: "Ra no abre.",
        }),
      };
    }
  }

  const json = args.body && typeof args.body === "object" ? (args.body as Record<string, unknown>) : {};
  const action = typeof json.action === "string" ? json.action : "";

  if (action === "connect") {
    const token = typeof json.token === "string" ? json.token.trim() : "";
    if (!isPlausibleSeatToken(token)) return { status: 400, body: { error: "BAD" } };
    const ok = await verifySeatTrello(token, env, fetchImpl);
    if (!ok) return { status: 400, body: { error: "BAD" } };
    const nextSession = withTrelloToken(args.session, token);
    const nextSeat: RaSeat = { token, env };
    let board = emptyRaBoard();
    try {
      board = await loadRaBoard(nextSeat, fetchImpl);
    } catch {
      board = { ...emptyRaBoard(), configured: true };
    }
    return {
      status: 200,
      body: publicTrelloPayload({ board, origin, env, did: "connect", line: "Listo, ya está." }),
      session: nextSession,
    };
  }

  if (!trelloConfigured(seat.token, env)) {
    if (action === "add" || action === "move" || action === "done" || action === "archive" || action === "color" || action === "desc" || action === "due" || action === "assign" || action === "link") {
      return {
        status: 200,
        body: publicTrelloPayload({
          board: emptyRaBoard(),
          origin,
          env,
          did: "need-trello",
          line: action === "add" ? `${RA_MISSING_LINE} Te lo anoté en la lista.` : RA_MISSING_LINE,
        }),
      };
    }
    const text =
      typeof json.text === "string" ? json.text : typeof json.title === "string" ? json.title : "";
    const applied = await applyRaIntent(parseRaIntent(text), seat, fetchImpl);
    return {
      status: 200,
      body: publicTrelloPayload({
        board: applied.board,
        origin,
        env,
        did: applied.did,
        line: applied.line,
      }),
    };
  }

  try {
    if (action === "add") {
      const title = typeof json.title === "string" ? json.title.trim() : "";
      if (!title) return { status: 400, body: { error: "EMPTY" } };
      const board = await loadRaBoard(seat, fetchImpl);
      const list =
        (typeof json.listId === "string" && board.lists.find((l) => l.id === json.listId)) ||
        (typeof json.listHint === "string" && matchList(board, json.listHint)) ||
        inboxList(board);
      if (!list) return { status: 400, body: { error: "NO_LIST" } };
      await addRaCard(title, list.id, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "add" }) };
    }
    if (action === "move") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const listId = typeof json.listId === "string" ? json.listId : "";
      if (!cardId || !listId) return { status: 400, body: { error: "EMPTY" } };
      await moveRaCard(cardId, listId, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "move" }) };
    }
    if (action === "done") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      if (!cardId) return { status: 400, body: { error: "EMPTY" } };
      const board = await loadRaBoard(seat, fetchImpl);
      await doneRaCard(cardId, board, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "done" }) };
    }
    if (action === "archive") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      if (!cardId) return { status: 400, body: { error: "EMPTY" } };
      await archiveRaCard(cardId, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "archive" }) };
    }
    if (action === "color") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const feel =
        parseFeelColor(typeof json.color === "string" ? json.color : "") ||
        (FEEL_COLOR_IDS.includes(json.color as FeelColor) ? (json.color as FeelColor) : null);
      if (!cardId || !feel) return { status: 400, body: { error: "EMPTY" } };
      await colorRaCard(cardId, feel, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "color" }) };
    }
    if (action === "desc") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const desc = typeof json.desc === "string" ? json.desc : "";
      if (!cardId) return { status: 400, body: { error: "EMPTY" } };
      await describeRaCard(cardId, desc, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "desc" }) };
    }
    if (action === "due") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const due = json.due === null || json.due === "" ? null : typeof json.due === "string" ? json.due : null;
      if (!cardId) return { status: 400, body: { error: "EMPTY" } };
      await dueRaCard(cardId, due, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "due" }) };
    }
    if (action === "assign") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const memberId =
        json.memberId === null || json.memberId === ""
          ? null
          : typeof json.memberId === "string"
            ? json.memberId
            : null;
      if (!cardId) return { status: 400, body: { error: "EMPTY" } };
      await assignRaCard(cardId, memberId, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "assign" }) };
    }
    if (action === "link") {
      const cardId = typeof json.cardId === "string" ? json.cardId : "";
      const url = typeof json.url === "string" ? json.url.trim() : "";
      if (!cardId || !url) return { status: 400, body: { error: "EMPTY" } };
      await linkRaCard(cardId, url, seat, fetchImpl);
      const next = await loadRaBoard(seat, fetchImpl);
      return { status: 200, body: publicTrelloPayload({ board: next, origin, env, did: "link" }) };
    }
    if (action === "intent") {
      const text = typeof json.text === "string" ? json.text : "";
      const applied = await applyRaIntent(parseRaIntent(text), seat, fetchImpl);
      return {
        status: 200,
        body: publicTrelloPayload({
          board: applied.board,
          origin,
          env,
          did: applied.did,
          line: applied.line,
        }),
      };
    }
    return { status: 400, body: { error: "UNKNOWN" } };
  } catch (error) {
    return { status: 502, body: { error: String(error) } };
  }
}
