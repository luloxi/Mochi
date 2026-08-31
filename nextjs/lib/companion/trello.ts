/**
 * Trello Ra board. View / add / move / done.
 * https://trello.com/b/UjFhgg3n/ra
 */

export const RA_BOARD_ID = "UjFhgg3n";
export const RA_BOARD_NAME = "Ra";
export const TRELLO_API = "https://api.trello.com/1";

export type TrelloCreds = { key: string; token: string };

export const RA_MISSING_LINE = "Ra no está.";

export type RaList = { id: string; name: string; pos: number };
export type RaCard = {
  id: string;
  name: string;
  idList: string;
  closed: boolean;
  pos: number;
  due: string | null;
  dueComplete?: boolean;
};
export type RaBoard = {
  id: string;
  name: string;
  lists: RaList[];
  cards: RaCard[];
  configured: boolean;
};

export type RaIntent =
  | { type: "list" }
  | { type: "add"; title: string; listHint?: string }
  | { type: "move"; title: string; listHint: string }
  | { type: "done"; title: string }
  | { type: "chat" };

export function trelloCredentials(env: Record<string, string | undefined> = process.env): TrelloCreds | null {
  const key = String(env.TRELLO_API_KEY || env.TRELLO_KEY || "").trim();
  const token = String(env.TRELLO_TOKEN || env.TRELLO_API_TOKEN || "").trim();
  if (!key || !token) return null;
  return { key, token };
}

export function trelloConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return trelloCredentials(env) !== null;
}

function authQuery(creds: TrelloCreds): string {
  return `key=${encodeURIComponent(creds.key)}&token=${encodeURIComponent(creds.token)}`;
}

export function emptyRaBoard(): RaBoard {
  return { id: RA_BOARD_ID, name: RA_BOARD_NAME, lists: [], cards: [], configured: false };
}

export function isDoneListName(name: string): boolean {
  return /\b(listo|done|hecho|terminad|completa|archiv)/i.test(name);
}

export function openLists(board: RaBoard): RaList[] {
  return board.lists.filter((list) => !isDoneListName(list.name));
}

export function doneList(board: RaBoard): RaList | null {
  return board.lists.find((list) => isDoneListName(list.name)) || null;
}

export function inboxList(board: RaBoard): RaList | null {
  const open = openLists(board);
  const named = open.find((list) => /\b(inbox|por hacer|to.?do|hacer|backlog|ra)\b/i.test(list.name));
  return named || open[0] || board.lists[0] || null;
}

export function cardsInList(board: RaBoard, listId: string): RaCard[] {
  return board.cards.filter((card) => card.idList === listId && !card.closed);
}

export function boardLine(board: RaBoard): string {
  if (!board.configured) return RA_MISSING_LINE;
  if (!board.lists.length) return "Ra vacío.";
  const parts = board.lists.map((list) => {
    const cards = cardsInList(board, list.id);
    const names = cards.map((c) => c.name).slice(0, 6);
    return `${list.name}: ${names.length ? names.join(" · ") : "—"}`;
  });
  return parts.join(" / ");
}

function stripLead(text: string, pattern: RegExp): string {
  return text.replace(pattern, "").trim();
}

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

export function parseRaIntent(raw: string): RaIntent {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();
  if (!text) return { type: "chat" };

  if (
    includesAny(lower, [
      "qué hay",
      "que hay",
      "mostrá ra",
      "mostra ra",
      "ver ra",
      "tareas",
      "tablero",
      "las cards",
      "las tarjetas",
    ]) &&
    !includesAny(lower, ["agreg", "nueva", "sumá", "suma", "mové", "move", "listo ", "terminé"])
  ) {
    return { type: "list" };
  }

  if (includesAny(lower, ["listo ", "marcar listo", "marcala listo", "done ", "terminé ", "termine ", "archivá ", "archiva "])) {
    const title = stripLead(
      text,
      /^(che[, ]+)?(porfa[, ]+)?(marcá|marca|marcala|dalo|dalo por|dalo como)?\s*(listo|done|terminé|termine|archivá|archiva)\s*/i,
    );
    return { type: "done", title: title || text };
  }

  if (includesAny(lower, ["mové", "move", "pasala a", "pasalo a", "a haciendo", "a listo", "a done"])) {
    const toMatch = text.match(/\ba\s+([^,]+)$/i);
    const listHint = toMatch?.[1]?.trim() || "listo";
    const title = stripLead(text, /^(che[, ]+)?(porfa[, ]+)?(mové|move|pasala|pasalo|pasa)\s*/i).replace(
      /\s+a\s+[^,]+$/i,
      "",
    );
    return { type: "move", title: title || text, listHint };
  }

  if (
    includesAny(lower, [
      "agregá",
      "agrega",
      "sumá",
      "suma",
      "anotá",
      "anota",
      "nueva tarea",
      "nueva card",
      "add ",
    ])
  ) {
    const title = stripLead(
      text,
      /^(che[, ]+)?(porfa[, ]+)?(agregá|agrega|sumá|suma|anotá|anota|add)\s+(una\s+)?(tarea|card|tarjeta)?\s*/i,
    );
    return { type: "add", title: title || text };
  }

  return { type: "chat" };
}

export function matchCard(board: RaBoard, title: string): RaCard | null {
  const q = title.trim().toLowerCase();
  if (!q) return null;
  const open = board.cards.filter((c) => !c.closed);
  const exact = open.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact;
  return open.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())) || null;
}

export function matchList(board: RaBoard, hint: string): RaList | null {
  const q = hint.trim().toLowerCase();
  if (!q) return inboxList(board);
  const exact = board.lists.find((l) => l.name.toLowerCase() === q);
  if (exact) return exact;
  return board.lists.find((l) => l.name.toLowerCase().includes(q) || q.includes(l.name.toLowerCase())) || null;
}

async function trelloFetch<T>(
  path: string,
  creds: TrelloCreds,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
): Promise<T> {
  const join = path.includes("?") ? "&" : "?";
  const url = `${TRELLO_API}${path}${join}${authQuery(creds)}`;
  const res = await fetchImpl(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`trello ${res.status} ${text.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

export async function loadRaBoard(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<RaBoard> {
  const creds = trelloCredentials(env);
  if (!creds) return emptyRaBoard();
  const [lists, cards] = await Promise.all([
    trelloFetch<Array<{ id: string; name: string; pos: number }>>(
      `/boards/${RA_BOARD_ID}/lists?filter=open`,
      creds,
      undefined,
      fetchImpl,
    ),
    trelloFetch<
      Array<{
        id: string;
        name: string;
        idList: string;
        closed: boolean;
        pos: number;
        due: string | null;
        dueComplete?: boolean;
      }>
    >(
      `/boards/${RA_BOARD_ID}/cards?filter=open&fields=name,idList,closed,pos,due,dueComplete`,
      creds,
      undefined,
      fetchImpl,
    ),
  ]);
  return {
    id: RA_BOARD_ID,
    name: RA_BOARD_NAME,
    lists: lists.map((l) => ({ id: l.id, name: l.name, pos: l.pos })),
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      idList: c.idList,
      closed: !!c.closed,
      pos: c.pos,
      due: c.due || null,
      dueComplete: !!c.dueComplete,
    })),
    configured: true,
  };
}

export async function addRaCard(
  title: string,
  listId: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<RaCard> {
  const creds = trelloCredentials(env);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const card = await trelloFetch<{
    id: string;
    name: string;
    idList: string;
    closed: boolean;
    pos: number;
    due: string | null;
    dueComplete?: boolean;
  }>(
    `/cards?idList=${encodeURIComponent(listId)}&name=${encodeURIComponent(title.slice(0, 180))}`,
    creds,
    { method: "POST" },
    fetchImpl,
  );
  return {
    id: card.id,
    name: card.name,
    idList: card.idList,
    closed: !!card.closed,
    pos: card.pos,
    due: card.due || null,
    dueComplete: !!card.dueComplete,
  };
}

export async function moveRaCard(
  cardId: string,
  listId: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = trelloCredentials(env);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  await trelloFetch(`/cards/${cardId}?idList=${encodeURIComponent(listId)}`, creds, { method: "PUT" }, fetchImpl);
}

export async function doneRaCard(
  cardId: string,
  board: RaBoard,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = trelloCredentials(env);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const target = doneList(board);
  if (target) {
    await moveRaCard(cardId, target.id, env, fetchImpl);
    return;
  }
  await trelloFetch(`/cards/${cardId}?closed=true`, creds, { method: "PUT" }, fetchImpl);
}

export async function applyRaIntent(
  intent: RaIntent,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ board: RaBoard; line: string; did: "list" | "add" | "move" | "done" | "chat" | "need-trello" }> {
  const configured = trelloConfigured(env);
  if (!configured) {
    const line =
      intent.type === "add" ? `${RA_MISSING_LINE} Te lo anoté en la lista.` : RA_MISSING_LINE;
    return { board: emptyRaBoard(), line, did: intent.type === "chat" ? "chat" : "need-trello" };
  }
  let board = await loadRaBoard(env, fetchImpl);
  if (intent.type === "list" || intent.type === "chat") {
    return { board, line: boardLine(board), did: intent.type };
  }
  if (intent.type === "add") {
    const list = intent.listHint ? matchList(board, intent.listHint) : inboxList(board);
    if (!list) return { board, line: "Ra no tiene columnas.", did: "add" };
    await addRaCard(intent.title, list.id, env, fetchImpl);
    board = await loadRaBoard(env, fetchImpl);
    return { board, line: `Anoté «${intent.title}» en ${list.name}.`, did: "add" };
  }
  if (intent.type === "move") {
    const card = matchCard(board, intent.title);
    const list = matchList(board, intent.listHint);
    if (!card || !list) return { board, line: "No lo encuentro.", did: "move" };
    await moveRaCard(card.id, list.id, env, fetchImpl);
    board = await loadRaBoard(env, fetchImpl);
    return { board, line: `«${card.name}» → ${list.name}.`, did: "move" };
  }
  const card = matchCard(board, intent.title);
  if (!card) return { board, line: "No lo encuentro.", did: "done" };
  await doneRaCard(card.id, board, env, fetchImpl);
  board = await loadRaBoard(env, fetchImpl);
  return { board, line: `Listo: ${card.name}.`, did: "done" };
}
