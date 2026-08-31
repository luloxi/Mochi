/**
 * Postgres-backed companion DM/presence so two phones share one room on Vercel.
 * Falls back to the file store when DATABASE_URL is missing.
 */

import { prisma } from "@/lib/prisma";
import { emptySyncState, type CompanionSyncState, type CompanionSyncStore } from "./sync";

const ROW_ID = "room";

export function postgresAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return /^postgres(ql)?:\/\//i.test(String(env.DATABASE_URL || "").trim());
}

function sqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function ensureCompanionSyncTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS companion_sync (
      id text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function loadPgSnapshot(): Promise<CompanionSyncState | null> {
  try {
    await ensureCompanionSyncTable();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT payload FROM companion_sync WHERE id = '${sqlString(ROW_ID)}'`,
    )) as Array<{ payload: CompanionSyncState }>;
    const payload = rows[0]?.payload;
    if (!payload || !Array.isArray(payload.dms)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function savePgSnapshot(state: CompanionSyncState) {
  await ensureCompanionSyncTable();
  const json = sqlString(JSON.stringify(state));
  await prisma.$executeRawUnsafe(
    `INSERT INTO companion_sync (id, payload, updated_at)
     VALUES ('${sqlString(ROW_ID)}', '${json}'::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
  );
}

export function wrapStoreWithPostgres(base: CompanionSyncStore): CompanionSyncStore {
  const persist = () => {
    void savePgSnapshot(base.snapshot()).catch(() => {});
  };
  return {
    snapshot: () => base.snapshot(),
    replace(next) {
      base.replace(next);
      persist();
    },
    appendDm(msg) {
      const rows = base.appendDm(msg);
      persist();
      return rows;
    },
    loadDms: () => base.loadDms(),
    heartbeat(person, status, now) {
      base.heartbeat(person, status, now);
      persist();
    },
    loadPresence: (now, idleMs) => base.loadPresence(now, idleMs),
    markTyping(person, now) {
      base.markTyping(person, now);
    },
    loadTyping: (now, freshMs) => base.loadTyping(now, freshMs),
    loadBoards: () => base.loadBoards(),
    saveBoards(boards) {
      base.saveBoards(boards);
      persist();
    },
  };
}

export async function hydrateStoreFromPostgres(store: CompanionSyncStore) {
  const snap = await loadPgSnapshot();
  if (snap) store.replace(snap);
  else await savePgSnapshot(store.snapshot() || emptySyncState()).catch(() => {});
}
