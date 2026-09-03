import { DurableObject } from "cloudflare:workers";
import { restoreRoomTicket, type PersonId } from "./ticket";

export interface Env {
  COMPANION_ROOM: DurableObjectNamespace<CompanionRoom>;
  COMPANION_SESSION_SECRET?: string;
  COMPANION_ROOM_SECRET?: string;
}

type PresenceStatus = "present" | "logout" | "close" | "idle-away";

type Dm = { id: string; from: PersonId | "mochi"; content: string; createdAt: string };

type Attachment = { personId: PersonId };

const IDLE_MS = 25_000;
const TYPING_MS = 6_000;
const MAX_SOCKETS = 12;

function cors(origin: string | null): HeadersInit {
  const allow =
    origin &&
    (origin === "https://mochiagents.vercel.app" ||
      origin === "http://localhost:3000" ||
      origin.endsWith(".vercel.app"))
      ? origin
      : "https://mochiagents.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function secret(env: Env): string {
  return env.COMPANION_ROOM_SECRET || env.COMPANION_SESSION_SECRET || "mochi-companion-katho-lulox-v1";
}

export class CompanionRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS dms (
          id TEXT PRIMARY KEY,
          from_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (
          k TEXT PRIMARY KEY,
          v TEXT NOT NULL
        );
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    const ticket = await restoreRoomTicket(url.searchParams.get("ticket"), secret(this.env));
    if (!ticket) return new Response("no", { status: 401 });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
      return new Response("full", { status: 429 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ personId: ticket.personId } satisfies Attachment);
    this.heartbeat(ticket.personId, "present");
    server.send(JSON.stringify(this.snapshot()));
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const att = (ws.deserializeAttachment() || {}) as Attachment;
    if (att.personId !== "katho" && att.personId !== "lulox") return;
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(String(message || "")) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = typeof body.type === "string" ? body.type : "";
    if (type === "dm") {
      const content = typeof body.content === "string" ? body.content.trim().slice(0, 4000) : "";
      if (!content) return;
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO dms (id, from_id, content, created_at) VALUES (?, ?, ?, ?)",
        `priv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        att.personId,
        content,
        new Date().toISOString(),
      );
      const extra = this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) as n FROM dms")
        .one().n;
      if (extra > 200) {
        this.ctx.storage.sql.exec(
          "DELETE FROM dms WHERE created_at < (SELECT created_at FROM dms ORDER BY created_at DESC LIMIT 1 OFFSET 199)",
        );
      }
    } else if (type === "presence") {
      const ok: PresenceStatus[] = ["present", "logout", "close", "idle-away"];
      const next = ok.includes(body.status as PresenceStatus) ? (body.status as PresenceStatus) : "present";
      this.heartbeat(att.personId, next);
    } else if (type === "typing") {
      this.putMeta(`typing:${att.personId}`, String(Date.now()));
    } else {
      return;
    }
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket) {
    const att = (ws.deserializeAttachment() || {}) as Attachment;
    if (att.personId !== "katho" && att.personId !== "lulox") return;
    const still = this.ctx.getWebSockets().some((open) => {
      const other = (open.deserializeAttachment() || {}) as Attachment;
      return other.personId === att.personId;
    });
    if (!still) this.heartbeat(att.personId, "close");
    this.broadcast();
  }

  private heartbeat(person: PersonId, status: PresenceStatus) {
    this.putMeta(`presence:${person}`, JSON.stringify({ status, at: Date.now() }));
  }

  private putMeta(k: string, v: string) {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", k, v);
  }

  private meta(k: string): string | null {
    const row = this.ctx.storage.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = ?", k).toArray()[0];
    return row?.v ?? null;
  }

  private presenceOf(person: PersonId, now: number): PresenceStatus {
    const raw = this.meta(`presence:${person}`);
    if (!raw) return "close";
    try {
      const hb = JSON.parse(raw) as { status: PresenceStatus; at: number };
      if (hb.status !== "present") return hb.status;
      if (now - hb.at > IDLE_MS) return "idle-away";
      return "present";
    } catch {
      return "close";
    }
  }

  private snapshot() {
    const now = Date.now();
    const dms = this.ctx.storage.sql
      .exec<{ id: string; from_id: string; content: string; created_at: string }>(
        "SELECT id, from_id, content, created_at FROM dms ORDER BY created_at ASC",
      )
      .toArray()
      .map((row) => ({
        id: row.id,
        from: row.from_id as Dm["from"],
        content: row.content,
        createdAt: row.created_at,
      }));
    const typed = (person: PersonId) => {
      const at = Number(this.meta(`typing:${person}`) || 0);
      return at > 0 && now - at < TYPING_MS;
    };
    return {
      type: "state" as const,
      dms,
      presence: { katho: this.presenceOf("katho", now), lulox: this.presenceOf("lulox", now) },
      typing: { katho: typed("katho"), lulox: typed("lulox") },
    };
  }

  private broadcast() {
    const payload = JSON.stringify(this.snapshot());
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // dropped
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    const url = new URL(request.url);
    if (url.pathname !== "/ws") {
      return new Response("gone", { status: 410, headers: cors(origin) });
    }

    const ticket = url.searchParams.get("ticket");
    const parsed = await restoreRoomTicket(ticket, secret(env));
    if (!parsed) return new Response("no", { status: 401, headers: cors(origin) });

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426, headers: cors(origin) });
    }

    const stub = env.COMPANION_ROOM.getByName("katho-lulox");
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
