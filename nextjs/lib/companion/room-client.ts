import type { PrivateMsg } from "./companion-core";
import type { PresenceStatus } from "./presence";

export type RoomState = {
  dms: PrivateMsg[];
  presence: { katho: PresenceStatus; lulox: PresenceStatus };
  typing: { katho: boolean; lulox: boolean };
};

export type RoomConn = {
  send: (msg: Record<string, unknown>) => void;
  close: () => void;
};

export function openCompanionRoom(opts: {
  url: string;
  ticket: string;
  onState: (state: RoomState) => void;
}): RoomConn {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 800;
  const queue: string[] = [];

  const flush = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (queue.length) ws.send(queue.shift() as string);
  };

  const connect = () => {
    if (stopped) return;
    const http = opts.url.replace(/\/$/, "");
    const wsBase = http.replace(/^http/i, "ws");
    const socket = new WebSocket(`${wsBase}/ws?ticket=${encodeURIComponent(opts.ticket)}`);
    ws = socket;
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data || ""));
        if (data?.type === "state") opts.onState(data as RoomState);
      } catch {
        // ignore junk
      }
    };
    socket.onopen = () => {
      retry = 800;
      flush();
    };
    socket.onclose = () => {
      ws = null;
      if (stopped) return;
      window.setTimeout(connect, retry);
      retry = Math.min(retry * 2, 8_000);
    };
  };

  connect();
  return {
    send(msg) {
      const raw = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(raw);
      else queue.push(raw);
    },
    close() {
      stopped = true;
      ws?.close();
      ws = null;
    },
  };
}
