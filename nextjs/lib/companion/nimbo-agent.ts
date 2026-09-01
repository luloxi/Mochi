/**
 * Nimbo turn: OpenAI/xAI with tools so it actually does Ra + miniapps.
 */

import { RA_APPS, resolveMiniappId, type RaAppId } from "./companion-core";
import { parseNimboIntent, type NimboIntent } from "./chats";
import {
  completeLlmRound,
  isOnlyCannedRaGreeting,
  localNimboReply,
  nimboSystemMessages,
  pickLlmProvider,
  type LlmChatMessage,
  type LlmProviderId,
  type LlmToolCall,
} from "./llm";
import {
  addRaCardNamed,
  boardLine,
  emptyRaBoard,
  loadRaBoard,
  parseAddCardFromChat,
  trelloConfigured,
  type RaBoard,
  type RaSeat,
} from "./trello";

export const NIMBO_TOOLS = [
  {
    type: "function",
    function: {
      name: "add_ra_card",
      description:
        "Agrega una tarjeta al tablero Ra en una lista por nombre (ej. Traer). Color Tano opcional: naranja, rojo, azul, violeta, amarillo, verde.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Texto de la tarjeta, ej. Flores" },
          list: { type: "string", description: "Nombre de la lista, ej. Traer" },
          color: {
            type: "string",
            description: "Color Tano: naranja, rojo, azul, violeta, amarillo, verde",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_ra_board",
      description: "Lista las columnas y tarjetas actuales de Ra para resolver nombres como Traer.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "open_miniapp",
      description: "Abre o enfoca una miniapp del dock: tomate, notas, video, ruido, tareas.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "tomate | notas | video | ruido | tareas" },
        },
        required: ["id"],
      },
    },
  },
];

export function nimboToolChoiceFor(text: string): "auto" | "required" {
  const t = String(text || "").toLowerCase();
  if (
    /\b(agreg|sumá|suma |anot|tarjeta|tablero|traer|tomate|notas|video|ruido|tareas|abrí|abri |mostrá|mostra |qué hay|que hay)\b/.test(
      t,
    )
  ) {
    return "required";
  }
  return "auto";
}

export type NimboTurnResult = {
  reply: string;
  board: RaBoard;
  did: string;
  intent: NimboIntent;
  provider: LlmProviderId;
  openApp: RaAppId | null;
  usedTools: string[];
};

function strArg(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v.trim() : "";
}

export async function executeNimboTool(
  call: LlmToolCall,
  seat: RaSeat,
  fetchImpl: typeof fetch,
): Promise<{ name: string; line: string; board?: RaBoard; openApp?: RaAppId | null; json: string }> {
  const name = call.name;
  if (name === "list_ra_board") {
    if (!trelloConfigured(seat.token, seat.env)) {
      const line = "Ra no está.";
      return { name, line, board: emptyRaBoard(), json: JSON.stringify({ ok: false, line }) };
    }
    const board = await loadRaBoard(seat, fetchImpl).catch(() => emptyRaBoard());
    const line = board.configured ? boardLine(board) : "Ra no está.";
    const lists = board.lists.map((list) => ({
      id: list.id,
      name: list.name,
      cards: board.cards
        .filter((c) => c.idList === list.id && !c.closed)
        .map((c) => ({ id: c.id, name: c.name, feel: c.feel })),
    }));
    return { name, line, board, json: JSON.stringify({ ok: board.configured, line, lists }) };
  }
  if (name === "add_ra_card") {
    const title = strArg(call.arguments, "title");
    const list = strArg(call.arguments, "list") || strArg(call.arguments, "listHint");
    const color = strArg(call.arguments, "color");
    if (!title) {
      const line = "¿Qué anoto?";
      return { name, line, json: JSON.stringify({ ok: false, line }) };
    }
    const added = await addRaCardNamed(
      { title, listHint: list || undefined, color: color || undefined },
      seat,
      fetchImpl,
    );
    return {
      name,
      line: added.line,
      board: added.board,
      json: JSON.stringify({ ok: added.did === "add" && added.board.configured, line: added.line, did: added.did }),
    };
  }
  if (name === "open_miniapp") {
    const id = resolveMiniappId(strArg(call.arguments, "id") || strArg(call.arguments, "app"));
    if (!id) {
      const line = "No encuentro esa app.";
      return { name, line, json: JSON.stringify({ ok: false, line, apps: RA_APPS.map((a) => a.label) }) };
    }
    const label = RA_APPS.find((a) => a.id === id)?.label || id;
    const line = `Abrí ${label}.`;
    return { name, line, openApp: id, json: JSON.stringify({ ok: true, line, id, label }) };
  }
  const line = "No sé esa herramienta.";
  return { name, line, json: JSON.stringify({ ok: false, line }) };
}

export async function runNimboTurn(args: {
  text: string;
  history?: LlmChatMessage[];
  seat: RaSeat;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  llmFetch?: typeof fetch;
}): Promise<NimboTurnResult> {
  const text = String(args.text || "").trim();
  const env = args.env ?? process.env;
  const trelloFetch = args.fetchImpl ?? fetch;
  const llmFetch = args.llmFetch ?? args.fetchImpl ?? fetch;
  const seat: RaSeat = { token: args.seat.token ?? null, env: args.seat.env ?? env };
  const intent = parseNimboIntent(text);
  const pick = pickLlmProvider(env);
  const usedTools: string[] = [];
  let board = emptyRaBoard();
  let line = boardLine(board);
  let did: string = intent.type === "chat" ? "chat" : intent.type;
  let openApp: RaAppId | null = null;
  let lastToolLine = "";

  if (trelloConfigured(seat.token, env)) {
    board = await loadRaBoard(seat, trelloFetch).catch(() => emptyRaBoard());
    if (board.configured) line = boardLine(board);
  } else {
    line = "Ra no está.";
  }

  let reply = localNimboReply(text, line);

  if (pick.provider !== "none") {
    const history = (args.history || [])
      .filter((row) => row && (row.role === "user" || row.role === "assistant") && typeof row.content === "string")
      .slice(-8);
    const messages: LlmChatMessage[] = [...nimboSystemMessages(line), ...history, { role: "user", content: text }];
    let round = await completeLlmRound(messages, {
      env,
      fetchImpl: llmFetch,
      tools: NIMBO_TOOLS,
      toolChoice: nimboToolChoiceFor(text),
    }).catch(() => ({
      provider: pick.provider,
      text: "",
      toolCalls: [] as LlmToolCall[],
      rawMessage: null as unknown,
    }));

    for (let i = 0; i < 2 && round.toolCalls.length; i++) {
      const rawCalls = (round.rawMessage as { tool_calls?: unknown[] } | null)?.tool_calls;
      messages.push({
        role: "assistant",
        content: round.text || null,
        tool_calls:
          rawCalls ||
          round.toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
      });
      for (const call of round.toolCalls) {
        const executed = await executeNimboTool(call, seat, trelloFetch);
        usedTools.push(executed.name);
        lastToolLine = executed.line;
        if (executed.board) {
          board = executed.board;
          line = executed.line;
        }
        if (executed.openApp) openApp = executed.openApp;
        if (executed.name === "add_ra_card") did = board.configured ? "add" : "need-trello";
        else if (executed.name === "list_ra_board") did = "list";
        else if (executed.name === "open_miniapp") did = "open-app";
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: executed.name,
          content: executed.json,
        });
      }
      round = await completeLlmRound(messages, {
        env,
        fetchImpl: llmFetch,
        tools: NIMBO_TOOLS,
        toolChoice: "auto",
      }).catch(() => ({
        provider: pick.provider,
        text: lastToolLine,
        toolCalls: [] as LlmToolCall[],
        rawMessage: null as unknown,
      }));
    }
    if (round.text) reply = round.text;
  }

  const guessed = parseAddCardFromChat(text);
  if (guessed && !usedTools.includes("add_ra_card")) {
    const added = await addRaCardNamed(guessed, seat, trelloFetch);
    usedTools.push("add_ra_card");
    lastToolLine = added.line;
    board = added.board;
    line = added.line;
    did = added.did;
    if (!reply || isOnlyCannedRaGreeting(reply)) reply = added.line;
  }

  if (usedTools.length && isOnlyCannedRaGreeting(reply)) {
    reply = lastToolLine || line || "Dale.";
  }

  return {
    reply: reply || lastToolLine || "Dale.",
    board,
    did,
    intent,
    provider: pick.provider,
    openApp,
    usedTools,
  };
}
