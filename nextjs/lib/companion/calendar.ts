/**
 * Google Calendar readonly helpers for Compañera Agenda miniapp + Nimbo.
 * Client obtains a GIS access token with calendar.readonly; API fetches events.
 */

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

export type CalendarEventRow = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  whenLabel: string;
};

export type CalendarListResult =
  | { ok: true; events: CalendarEventRow[]; line: string }
  | { ok: false; reason: "missing-token" | "forbidden" | "upstream"; line: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Short rioplatense label in local wall time. */
export function formatEventWhen(startIso: string, endIso: string, allDay: boolean, now = new Date()): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "cuando sea";
  const sameDay =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate();
  const dayBit = sameDay ? "hoy" : isTomorrow ? "mañana" : `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}`;
  if (allDay) return `${dayBit} todo el día`;
  const hm = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const end = new Date(endIso);
  if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
    const endHm = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
    return `${dayBit} ${hm}-${endHm}`;
  }
  return `${dayBit} ${hm}`;
}

export function mapGoogleEvent(raw: {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}, now = new Date()): CalendarEventRow | null {
  const id = String(raw.id || "").trim();
  if (!id) return null;
  const allDay = Boolean(raw.start?.date && !raw.start?.dateTime);
  const start = String(raw.start?.dateTime || raw.start?.date || "").trim();
  const end = String(raw.end?.dateTime || raw.end?.date || start).trim();
  if (!start) return null;
  const title = String(raw.summary || "").trim() || "(sin título)";
  return {
    id,
    title,
    start,
    end,
    allDay,
    whenLabel: formatEventWhen(start, end, allDay, now),
  };
}

export function agendaLine(events: CalendarEventRow[]): string {
  if (!events.length) return "Hoy libre. Nada en la agenda.";
  const top = events.slice(0, 4).map((e) => `${e.whenLabel}: ${e.title}`);
  if (events.length <= 4) return top.join(" · ");
  return `${top.join(" · ")} · y ${events.length - 4} más`;
}

export async function fetchUpcomingEvents(
  accessToken: string,
  args: {
    fetchImpl?: typeof fetch;
    now?: Date;
    maxResults?: number;
    daysAhead?: number;
  } = {},
): Promise<CalendarListResult> {
  const token = String(accessToken || "").trim();
  if (!token || token.length < 20) {
    return { ok: false, reason: "missing-token", line: "Conectá el calendario." };
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const now = args.now ?? new Date();
  const days = Math.min(14, Math.max(1, args.daysAhead ?? 3));
  const maxResults = Math.min(20, Math.max(1, args.maxResults ?? 8));
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
    new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults),
    }).toString();
  try {
    const res = await fetchImpl(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "forbidden", line: "Pedí permiso de calendario otra vez." };
    }
    if (!res.ok) {
      return { ok: false, reason: "upstream", line: "Agenda no respondió." };
    }
    const json = (await res.json()) as { items?: unknown[] };
    const events: CalendarEventRow[] = [];
    for (const row of json.items || []) {
      if (!row || typeof row !== "object") continue;
      const mapped = mapGoogleEvent(row as Parameters<typeof mapGoogleEvent>[0], now);
      if (mapped) events.push(mapped);
    }
    return { ok: true, events, line: agendaLine(events) };
  } catch {
    return { ok: false, reason: "upstream", line: "Agenda no respondió." };
  }
}
