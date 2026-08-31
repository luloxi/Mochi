/**
 * Trello Ra board. View / add / move / done / color / archive.
 * House: https://trello.com/b/UjFhgg3n/ra
 * Per-seat token lives on the companion session. Env TRELLO_TOKEN is Luciano's
 * and must never stand in for Katho or Lulox.
 */

import type { FeelColor } from "./boards";
import type { PersonId } from "./companion-core";

export const RA_BOARD_ID = "UjFhgg3n";
export const RA_BOARD_NAME = "Ra";
export const TRELLO_API = "https://api.trello.com/1";
export const TRELLO_AUTHORIZE = "https://trello.com/1/authorize";

export type TrelloCreds = { key: string; token: string };

export type RaSeat = {
  token?: string | null;
  env?: Record<string, string | undefined>;
};

export const RA_MISSING_LINE = "Ra no está.";

export type RaLabel = { id: string; name: string; color: string | null };
export type RaList = { id: string; name: string; pos: number };
export type RaMember = {
  id: string;
  fullName: string;
  username: string;
  initials?: string;
};
export type RaLink = { id: string; name: string; url: string };
export type RaCheckItem = { id: string; name: string; complete: boolean; pos: number };
export type RaChecklist = { id: string; name: string; items: RaCheckItem[] };
export type RaCard = {
  id: string;
  name: string;
  idList: string;
  closed: boolean;
  pos: number;
  due: string | null;
  dueComplete?: boolean;
  desc: string;
  labels: RaLabel[];
  feel: FeelColor | null;
  idMembers: string[];
  members: RaMember[];
  links: RaLink[];
  checklists: RaChecklist[];
  url: string | null;
};
export type RaBoard = {
  id: string;
  name: string;
  lists: RaList[];
  cards: RaCard[];
  members: RaMember[];
  configured: boolean;
};

export type RaIntent =
  | { type: "list" }
  | { type: "add"; title: string; listHint?: string }
  | { type: "move"; title: string; listHint: string }
  | { type: "done"; title: string }
  | { type: "chat" };

export type RaWizardStep = { n: 1 | 2 | 3; title: string; body: string };

export const RA_CONNECT_JARGON =
  /\b(oauth|api|token|clave|key|secret|endpoint|bearer|client id|apikey|api key)\b/i;

const TRELLO_TO_FEEL: Record<string, FeelColor> = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  purple: "purple",
  lime: "green",
  sky: "blue",
  pink: "red",
  black: "purple",
};

const FEEL_TO_TRELLO: Record<FeelColor, string> = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  purple: "purple",
};

export function isPlausibleSeatToken(token: string): boolean {
  return /^[a-zA-Z0-9]{32,256}$/.test(String(token || "").trim());
}

export function trelloApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = String(env.TRELLO_API_KEY || env.TRELLO_KEY || "").trim();
  return key || null;
}

export function seatTrelloCreds(
  token: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): TrelloCreds | null {
  const key = trelloApiKey(env);
  const t = String(token || "").trim();
  if (!key || !t) return null;
  return { key, token: t };
}

export function resolveRaSeat(seat: RaSeat = {}): {
  token: string | null;
  env: Record<string, string | undefined>;
} {
  return {
    token: String(seat.token || "").trim() || null,
    env: seat.env ?? process.env,
  };
}

/** Seat is connected only with THAT user's token. Env TRELLO_TOKEN does not count. */
export function trelloConfigured(
  token?: string | null | Record<string, string | undefined>,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (typeof token !== "string") return false;
  return seatTrelloCreds(token, env) !== null;
}

/** @deprecated Env pair is Luciano's. Never treat it as a connected seat. */
export function trelloCredentials(
  env: Record<string, string | undefined> = process.env,
): TrelloCreds | null {
  void env;
  return null;
}

function authQuery(creds: TrelloCreds): string {
  return `key=${encodeURIComponent(creds.key)}&token=${encodeURIComponent(creds.token)}`;
}

function credsOrNull(seat: RaSeat = {}): TrelloCreds | null {
  const resolved = resolveRaSeat(seat);
  return seatTrelloCreds(resolved.token, resolved.env);
}

export function emptyRaBoard(): RaBoard {
  return { id: RA_BOARD_ID, name: RA_BOARD_NAME, lists: [], cards: [], members: [], configured: false };
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

export function sortedOpenCards(board: RaBoard, listId: string, hideId?: string): RaCard[] {
  return cardsInList(board, listId)
    .filter((card) => card.id !== hideId)
    .slice()
    .sort((a, b) => a.pos - b.pos || a.id.localeCompare(b.id));
}

/** Trello-style pos for inserting at `index` among existing positions. */
export function insertPos(positions: number[], index: number): number {
  const i = Math.max(0, Math.min(Math.round(index), positions.length));
  const prev = i > 0 ? positions[i - 1] : null;
  const next = i < positions.length ? positions[i] : null;
  if (prev == null && next == null) return 65535;
  if (prev == null) return next / 2;
  if (next == null) return prev + 65535;
  if (prev === next) return prev;
  return (prev + next) / 2;
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

export function feelFromLabels(labels: RaLabel[] | undefined): FeelColor | null {
  const mapped: FeelColor[] = [];
  for (const label of labels || []) {
    const c = String(label.color || "").toLowerCase();
    const feel = TRELLO_TO_FEEL[c];
    if (feel && !mapped.includes(feel)) mapped.push(feel);
  }
  for (const feel of ["blue", "purple", "red", "orange", "yellow", "green"] as FeelColor[]) {
    if (mapped.includes(feel)) return feel;
  }
  return mapped[0] || null;
}

function mapMember(raw: {
  id?: string;
  fullName?: string;
  username?: string;
  initials?: string;
}): RaMember | null {
  const id = String(raw?.id || "").trim();
  if (!id) return null;
  return {
    id,
    fullName: String(raw.fullName || raw.username || ""),
    username: String(raw.username || ""),
    initials: raw.initials ? String(raw.initials) : undefined,
  };
}

export function mapRaCard(raw: {
  id: string;
  name: string;
  idList: string;
  closed?: boolean;
  pos?: number;
  due?: string | null;
  dueComplete?: boolean;
  desc?: string | null;
  url?: string | null;
  shortUrl?: string | null;
  idMembers?: string[];
  labels?: Array<{ id: string; name: string; color: string | null }>;
  members?: Array<{ id?: string; fullName?: string; username?: string; initials?: string }>;
  attachments?: Array<{ id?: string; name?: string; url?: string }>;
  checklists?: Array<{
    id?: string;
    name?: string;
    checkItems?: Array<{ id?: string; name?: string; state?: string; pos?: number }>;
  }>;
}): RaCard {
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? null }))
    : [];
  const members = (raw.members || []).map(mapMember).filter((row): row is RaMember => !!row);
  const idMembers = Array.isArray(raw.idMembers)
    ? raw.idMembers.map((id) => String(id)).filter(Boolean)
    : members.map((row) => row.id);
  const links: RaLink[] = [];
  for (const row of raw.attachments || []) {
    const url = String(row.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    links.push({
      id: String(row.id || url),
      name: String(row.name || url),
      url,
    });
  }
  const checklists: RaChecklist[] = [];
  for (const row of raw.checklists || []) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    const items: RaCheckItem[] = [];
    for (const item of row.checkItems || []) {
      const itemId = String(item.id || "").trim();
      if (!itemId) continue;
      items.push({
        id: itemId,
        name: String(item.name || ""),
        complete: String(item.state || "").toLowerCase() === "complete",
        pos: Number(item.pos) || 0,
      });
    }
    items.sort((a, b) => a.pos - b.pos);
    checklists.push({ id, name: String(row.name || "lista"), items });
  }
  return {
    id: raw.id,
    name: raw.name,
    idList: raw.idList,
    closed: !!raw.closed,
    pos: raw.pos ?? 0,
    due: raw.due || null,
    dueComplete: !!raw.dueComplete,
    desc: String(raw.desc || ""),
    labels,
    feel: feelFromLabels(labels),
    idMembers,
    members,
    links,
    checklists,
    url: raw.shortUrl || raw.url || null,
  };
}

export function moveCardOnBoard(board: RaBoard, cardId: string, listId: string, pos?: number): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) =>
      card.id === cardId ? { ...card, idList: listId, pos: pos ?? card.pos } : card,
    ),
  };
}

export function colorCardOnBoard(board: RaBoard, cardId: string, feel: FeelColor): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            feel,
            labels: [{ id: feel, name: feel, color: feel }],
          }
        : card,
    ),
  };
}

export function archiveCardOnBoard(board: RaBoard, cardId: string): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, closed: true } : card)),
  };
}

export function describeCardOnBoard(board: RaBoard, cardId: string, desc: string): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, desc } : card)),
  };
}

export function dueCardOnBoard(board: RaBoard, cardId: string, due: string | null): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, due, dueComplete: false } : card)),
  };
}

export function assignCardOnBoard(board: RaBoard, cardId: string, memberId: string | null): RaBoard {
  const member = memberId ? board.members.find((row) => row.id === memberId) : null;
  return {
    ...board,
    cards: board.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            idMembers: memberId ? [memberId] : [],
            members: member ? [member] : [],
          }
        : card,
    ),
  };
}

export function linkCardOnBoard(board: RaBoard, cardId: string, link: RaLink): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) =>
      card.id === cardId && !card.links.some((row) => row.url === link.url)
        ? { ...card, links: [...card.links, link] }
        : card,
    ),
  };
}

export function checkItemOnBoard(
  board: RaBoard,
  cardId: string,
  itemId: string,
  complete: boolean,
): RaBoard {
  return {
    ...board,
    cards: board.cards.map((card) => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        checklists: (card.checklists || []).map((list) => ({
          ...list,
          items: list.items.map((item) => (item.id === itemId ? { ...item, complete } : item)),
        })),
      };
    }),
  };
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

export function trelloReturnUrl(origin: string): string {
  const base = String(origin || "").trim().replace(/\/$/, "");
  return `${base || ""}/`;
}

export function trelloAuthorizeUrl(args: { key: string; returnUrl: string; appName?: string }): string {
  const params = new URLSearchParams({
    expiration: "never",
    name: args.appName || "Ra",
    scope: "read,write",
    response_type: "token",
    key: args.key,
    return_url: args.returnUrl,
    callback_method: "fragment",
  });
  return `${TRELLO_AUTHORIZE}?${params.toString()}`;
}

export function readTrelloTokenFromCallback(input: { hash?: string; search?: string }): string | null {
  const hash = String(input.hash || "").replace(/^#/, "").trim();
  const search = String(input.search || "").replace(/^\?/, "").trim();
  const hashQuery = hash.includes("=") ? hash : hash ? `token=${hash}` : "";
  const fromHash = new URLSearchParams(hashQuery);
  const fromSearch = new URLSearchParams(search);
  const token = String(fromHash.get("token") || fromSearch.get("token") || "").trim();
  return isPlausibleSeatToken(token) ? token : null;
}

export function raConnectWizard(personId: PersonId): {
  steps: RaWizardStep[];
  connectLabel: string;
  doneLine: string;
  missingLine: string;
} {
  const ella = personId === "katho";
  return {
    steps: [
      {
        n: 1,
        title: "Esta es tu casa",
        body: ella
          ? "Katho, esta es la casa de los dos: Ra. Acá viven las cosas de ella y de Lulox."
          : "Lulox, esta es la casa de los dos: Ra. Acá viven las cosas de él y de Katho.",
      },
      {
        n: 2,
        title: "Conectar",
        body: ella
          ? "Un botón conectar. Tocá y dale que sí. Después ella vuelve sola a la casa."
          : "Un botón conectar. Tocá y dale que sí. Después él vuelve solo a la casa.",
      },
      {
        n: 3,
        title: "Listo, ya está",
        body: ella
          ? "Cuando vuelvas, ya podés tirar tarjetas y moverlas. Nimbo habla igual."
          : "Cuando vuelvas, ya podés tirar tarjetas y moverlas. Nimbo habla igual.",
      },
    ],
    connectLabel: "conectar",
    doneLine: "Listo, ya está.",
    missingLine: RA_MISSING_LINE,
  };
}

export function wizardCopyText(personId: PersonId): string {
  const w = raConnectWizard(personId);
  return [w.connectLabel, w.doneLine, w.missingLine, ...w.steps.map((s) => `${s.title} ${s.body}`)].join("\n");
}

export async function loadRaBoard(
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<RaBoard> {
  const creds = credsOrNull(seat);
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
        desc?: string | null;
        url?: string | null;
        shortUrl?: string | null;
        idMembers?: string[];
        labels?: Array<{ id: string; name: string; color: string | null }>;
        members?: Array<{ id?: string; fullName?: string; username?: string; initials?: string }>;
        attachments?: Array<{ id?: string; name?: string; url?: string }>;
        checklists?: Array<{
          id?: string;
          name?: string;
          checkItems?: Array<{ id?: string; name?: string; state?: string; pos?: number }>;
        }>;
      }>
    >(
      `/boards/${RA_BOARD_ID}/cards?filter=open&fields=name,idList,closed,pos,due,dueComplete,labels,desc,idMembers,url,shortUrl&members=true&member_fields=fullName,username,initials&attachments=true&attachment_fields=url,name,id&checklists=all`,
      creds,
      undefined,
      fetchImpl,
    ),
  ]);
  let members: RaMember[] = [];
  try {
    const rawMembers = await trelloFetch<
      Array<{ id?: string; fullName?: string; username?: string; initials?: string }>
    >(`/boards/${RA_BOARD_ID}/members?fields=fullName,username,initials`, creds, undefined, fetchImpl);
    members = rawMembers.map(mapMember).filter((row): row is RaMember => !!row);
  } catch {
    members = [];
  }
  return {
    id: RA_BOARD_ID,
    name: RA_BOARD_NAME,
    lists: lists.map((l) => ({ id: l.id, name: l.name, pos: l.pos })),
    cards: cards.map((c) => mapRaCard(c)),
    members,
    configured: true,
  };
}

export async function addRaCard(
  title: string,
  listId: string,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<RaCard> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const card = await trelloFetch<{
    id: string;
    name: string;
    idList: string;
    closed: boolean;
    pos: number;
    due: string | null;
    dueComplete?: boolean;
    labels?: Array<{ id: string; name: string; color: string | null }>;
  }>(
    `/cards?idList=${encodeURIComponent(listId)}&name=${encodeURIComponent(title.slice(0, 180))}`,
    creds,
    { method: "POST" },
    fetchImpl,
  );
  return mapRaCard(card);
}

export async function moveRaCard(
  cardId: string,
  listId: string,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
  pos?: number,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  let path = `/cards/${cardId}?idList=${encodeURIComponent(listId)}`;
  if (pos != null && Number.isFinite(pos)) path += `&pos=${encodeURIComponent(String(pos))}`;
  await trelloFetch(path, creds, { method: "PUT" }, fetchImpl);
}

export async function checkRaCard(
  cardId: string,
  itemId: string,
  complete: boolean,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const state = complete ? "complete" : "incomplete";
  await trelloFetch(
    `/cards/${cardId}/checkItem/${encodeURIComponent(itemId)}?state=${state}`,
    creds,
    { method: "PUT" },
    fetchImpl,
  );
}

export async function doneRaCard(
  cardId: string,
  board: RaBoard,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const target = doneList(board);
  if (target) {
    await moveRaCard(cardId, target.id, seat, fetchImpl);
    return;
  }
  await trelloFetch(`/cards/${cardId}?closed=true`, creds, { method: "PUT" }, fetchImpl);
}

export async function archiveRaCard(
  cardId: string,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  await trelloFetch(`/cards/${cardId}?closed=true`, creds, { method: "PUT" }, fetchImpl);
}

export async function colorRaCard(
  cardId: string,
  feel: FeelColor,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const color = FEEL_TO_TRELLO[feel] || "yellow";
  const labels = await trelloFetch<Array<{ id: string; name: string; color: string | null }>>(
    `/boards/${RA_BOARD_ID}/labels?limit=1000`,
    creds,
    undefined,
    fetchImpl,
  );
  let label = labels.find((row) => String(row.color || "").toLowerCase() === color);
  if (!label) {
    label = await trelloFetch<{ id: string; name: string; color: string | null }>(
      `/labels?idBoard=${encodeURIComponent(RA_BOARD_ID)}&name=${encodeURIComponent(feel)}&color=${encodeURIComponent(color)}`,
      creds,
      { method: "POST" },
      fetchImpl,
    );
  }
  await trelloFetch(`/cards/${cardId}?idLabels=${encodeURIComponent(label.id)}`, creds, { method: "PUT" }, fetchImpl);
}

export async function describeRaCard(
  cardId: string,
  desc: string,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  await trelloFetch(
    `/cards/${cardId}?desc=${encodeURIComponent(desc.slice(0, 16000))}`,
    creds,
    { method: "PUT" },
    fetchImpl,
  );
}

export async function dueRaCard(
  cardId: string,
  due: string | null,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const value = due ? encodeURIComponent(due) : "";
  await trelloFetch(`/cards/${cardId}?due=${value}`, creds, { method: "PUT" }, fetchImpl);
}

export async function assignRaCard(
  cardId: string,
  memberId: string | null,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const value = memberId ? encodeURIComponent(memberId) : "";
  await trelloFetch(`/cards/${cardId}?idMembers=${value}`, creds, { method: "PUT" }, fetchImpl);
}

export async function linkRaCard(
  cardId: string,
  url: string,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const creds = credsOrNull(seat);
  if (!creds) throw new Error("TRELLO_UNCONFIGURED");
  const href = String(url || "").trim();
  if (!/^https?:\/\//i.test(href)) throw new Error("BAD_LINK");
  await trelloFetch(
    `/cards/${cardId}/attachments?url=${encodeURIComponent(href.slice(0, 1800))}`,
    creds,
    { method: "POST" },
    fetchImpl,
  );
}

export async function applyRaIntent(
  intent: RaIntent,
  seat: RaSeat = {},
  fetchImpl: typeof fetch = fetch,
): Promise<{ board: RaBoard; line: string; did: "list" | "add" | "move" | "done" | "chat" | "need-trello" }> {
  const creds = credsOrNull(seat);
  if (!creds) {
    const line =
      intent.type === "add" ? `${RA_MISSING_LINE} Te lo anoté en la lista.` : RA_MISSING_LINE;
    return { board: emptyRaBoard(), line, did: intent.type === "chat" ? "chat" : "need-trello" };
  }
  let board = await loadRaBoard(seat, fetchImpl);
  if (intent.type === "list" || intent.type === "chat") {
    return { board, line: boardLine(board), did: intent.type };
  }
  if (intent.type === "add") {
    const list = intent.listHint ? matchList(board, intent.listHint) : inboxList(board);
    if (!list) return { board, line: "Ra no tiene columnas.", did: "add" };
    await addRaCard(intent.title, list.id, seat, fetchImpl);
    board = await loadRaBoard(seat, fetchImpl);
    return { board, line: `Anoté «${intent.title}» en ${list.name}.`, did: "add" };
  }
  if (intent.type === "move") {
    const card = matchCard(board, intent.title);
    const list = matchList(board, intent.listHint);
    if (!card || !list) return { board, line: "No lo encuentro.", did: "move" };
    await moveRaCard(card.id, list.id, seat, fetchImpl);
    board = await loadRaBoard(seat, fetchImpl);
    return { board, line: `«${card.name}» → ${list.name}.`, did: "move" };
  }
  const card = matchCard(board, intent.title);
  if (!card) return { board, line: "No lo encuentro.", did: "done" };
  await doneRaCard(card.id, board, seat, fetchImpl);
  board = await loadRaBoard(seat, fetchImpl);
  return { board, line: `Listo: ${card.name}.`, did: "done" };
}

export async function verifySeatTrello(
  token: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const creds = seatTrelloCreds(token, env);
  if (!creds) return false;
  try {
    await trelloFetch("/members/me?fields=id", creds, undefined, fetchImpl);
    return true;
  } catch {
    return false;
  }
}

export function publicTrelloPayload(args: {
  board: RaBoard;
  origin?: string;
  env?: Record<string, string | undefined>;
  did?: string;
  line?: string;
}): Record<string, unknown> {
  const env = args.env ?? process.env;
  const key = trelloApiKey(env);
  const origin = String(args.origin || "").trim();
  const authorizeUrl =
    key && origin && !args.board.configured
      ? trelloAuthorizeUrl({ key, returnUrl: trelloReturnUrl(origin) })
      : null;
  return {
    configured: args.board.configured,
    board: args.board,
    line: args.line ?? boardLine(args.board),
    authorizeUrl,
    canConnect: Boolean(authorizeUrl),
    did: args.did,
  };
}
