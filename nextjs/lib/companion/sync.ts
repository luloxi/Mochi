/**
 * Shared DM + presence + board store.
 * Two devices talk to the same store (API in prod, memory in tests).
 * Not same-tab localStorage.
 */

import { nowIso, uid, type PersonId, type PrivateMsg } from "./companion-core";
import { sampleSuenosBoard, type Board } from "./boards";
import {
  DEFAULT_IDLE_AWAY_MS,
  statusFromHeartbeat,
  type PresenceHeartbeat,
  type PresenceStatus,
} from "./presence";
import type { CompanionAuthSession } from "./auth";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type CompanionSyncState = {
  dms: PrivateMsg[];
  presence: {
    katho: PresenceHeartbeat | null;
    lulox: PresenceHeartbeat | null;
  };
  boards: Board[];
};

export function emptySyncState(): CompanionSyncState {
  return {
    dms: [],
    presence: { katho: null, lulox: null },
    boards: [sampleSuenosBoard()],
  };
}

export type CompanionSyncStore = {
  snapshot(): CompanionSyncState;
  replace(next: CompanionSyncState): void;
  appendDm(msg: PrivateMsg): PrivateMsg[];
  loadDms(): PrivateMsg[];
  heartbeat(person: PersonId, status: PresenceStatus, now: number): void;
  loadPresence(now: number, idleMs?: number): { katho: PresenceStatus; lulox: PresenceStatus };
  loadBoards(): Board[];
  saveBoards(boards: Board[]): void;
};

function clampDms(rows: PrivateMsg[]): PrivateMsg[] {
  return rows.slice(-200);
}

export function createMemorySyncStore(initial?: CompanionSyncState): CompanionSyncStore {
  let state: CompanionSyncState = initial ? structuredClone(initial) : emptySyncState();
  return {
    snapshot() {
      return structuredClone(state);
    },
    replace(next) {
      state = structuredClone(next);
    },
    appendDm(msg) {
      state = { ...state, dms: clampDms([...state.dms, msg]) };
      return state.dms.slice();
    },
    loadDms() {
      return state.dms.slice();
    },
    heartbeat(person, status, now) {
      state = {
        ...state,
        presence: {
          ...state.presence,
          [person]: { status, at: now },
        },
      };
    },
    loadPresence(now, idleMs = DEFAULT_IDLE_AWAY_MS) {
      return {
        katho: statusFromHeartbeat(state.presence.katho, now, idleMs),
        lulox: statusFromHeartbeat(state.presence.lulox, now, idleMs),
      };
    },
    loadBoards() {
      return structuredClone(state.boards);
    },
    saveBoards(boards) {
      state = { ...state, boards: structuredClone(boards) };
    },
  };
}

export function createFileSyncStore(filePath: string): CompanionSyncStore {
  const memory = createMemorySyncStore(readSyncFile(filePath));
  const persist = () => writeSyncFile(filePath, memory.snapshot());
  return {
    snapshot: () => memory.snapshot(),
    replace(next) {
      memory.replace(next);
      persist();
    },
    appendDm(msg) {
      const rows = memory.appendDm(msg);
      persist();
      return rows;
    },
    loadDms: () => memory.loadDms(),
    heartbeat(person, status, now) {
      memory.heartbeat(person, status, now);
      persist();
    },
    loadPresence: (now, idleMs) => memory.loadPresence(now, idleMs),
    loadBoards: () => memory.loadBoards(),
    saveBoards(boards) {
      memory.saveBoards(boards);
      persist();
    },
  };
}

function readSyncFile(filePath: string): CompanionSyncState | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as CompanionSyncState;
    if (!raw || !Array.isArray(raw.dms)) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

function writeSyncFile(filePath: string, state: CompanionSyncState) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state), "utf8");
  } catch {
    // quota / read-only — memory still works for this process
  }
}

const globalKey = "__mochiCompanionSyncStore" as const;

export function getServerSyncStore(): CompanionSyncStore {
  const g = globalThis as typeof globalThis & { [globalKey]?: CompanionSyncStore };
  if (!g[globalKey]) {
    const file =
      process.env.COMPANION_SYNC_FILE ||
      `${process.cwd()}/.data/companion-sync.json`;
    g[globalKey] = createFileSyncStore(file);
  }
  return g[globalKey];
}

export function companionSyncApi(store: CompanionSyncStore) {
  return {
    postDm(input: { from: PrivateMsg["from"]; content: string; id?: string; createdAt?: string }): PrivateMsg[] {
      const msg: PrivateMsg = {
        id: input.id || uid("priv"),
        from: input.from,
        content: String(input.content || "").slice(0, 4000),
        createdAt: input.createdAt || nowIso(),
      };
      return store.appendDm(msg);
    },
    loadDms() {
      return store.loadDms();
    },
    heartbeat(person: PersonId, status: PresenceStatus, now = Date.now()) {
      store.heartbeat(person, status, now);
      return store.loadPresence(now);
    },
    loadPresence(now = Date.now(), idleMs?: number) {
      return store.loadPresence(now, idleMs);
    },
    loadBoards() {
      return store.loadBoards();
    },
    saveBoards(boards: Board[]) {
      store.saveBoards(boards);
      return store.loadBoards();
    },
    snapshot(now = Date.now()) {
      return {
        dms: store.loadDms(),
        presence: store.loadPresence(now),
        boards: store.loadBoards(),
      };
    },
  };
}

export function handleCompanionSyncRequest(args: {
  store: CompanionSyncStore;
  session: CompanionAuthSession | null;
  method: "GET" | "POST";
  body?: unknown;
  now?: number;
}): { status: number; body: Record<string, unknown> } {
  if (!args.session) {
    return { status: 401, body: { error: "UNAUTHENTICATED" } };
  }
  const api = companionSyncApi(args.store);
  const now = args.now ?? Date.now();
  if (args.method === "GET") {
    return { status: 200, body: api.snapshot(now) };
  }
  const body = args.body && typeof args.body === "object" ? (args.body as Record<string, unknown>) : {};
  const type = typeof body.type === "string" ? body.type : "";
  if (type === "dm") {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return { status: 400, body: { error: "EMPTY" } };
    const dms = api.postDm({ from: args.session.personId, content });
    return { status: 200, body: { ...api.snapshot(now), dms } };
  }
  if (type === "presence") {
    const status = body.status;
    const ok: PresenceStatus[] = ["present", "logout", "close", "idle-away"];
    const next = ok.includes(status as PresenceStatus) ? (status as PresenceStatus) : "present";
    api.heartbeat(args.session.personId, next, now);
    return { status: 200, body: api.snapshot(now) };
  }
  if (type === "boards") {
    const boards = Array.isArray(body.boards) ? (body.boards as Board[]) : null;
    if (!boards) return { status: 400, body: { error: "EMPTY" } };
    api.saveBoards(boards);
    return { status: 200, body: api.snapshot(now) };
  }
  return { status: 400, body: { error: "UNKNOWN" } };
}
