import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { getServerSyncStore, handleCompanionSyncRequest } from "@/lib/companion/sync";
import {
  hydrateStoreFromPostgres,
  postgresAvailable,
  wrapStoreWithPostgres,
} from "@/lib/companion/pg-sync";

export const runtime = "nodejs";

const bootKey = "__mochiCompanionPgBoot" as const;

async function storeForRequest() {
  const base = getServerSyncStore();
  if (!postgresAvailable()) return base;
  const g = globalThis as typeof globalThis & { [bootKey]?: Promise<void> };
  if (!g[bootKey]) {
    g[bootKey] = hydrateStoreFromPostgres(base).catch(() => {});
  }
  await g[bootKey];
  return wrapStoreWithPostgres(base);
}

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

export async function GET(request: NextRequest) {
  const store = await storeForRequest();
  const result = handleCompanionSyncRequest({
    store,
    session: sessionFrom(request),
    method: "GET",
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const store = await storeForRequest();
  const result = handleCompanionSyncRequest({
    store,
    session: sessionFrom(request),
    method: "POST",
    body: json,
  });
  return NextResponse.json(result.body, { status: result.status });
}
