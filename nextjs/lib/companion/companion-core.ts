import { extractYouTubeId as extractYouTubeIdImpl } from "./youtube";

export type PersonId = "katho" | "lulox";

export type PetMood = "idle" | "listening" | "thinking" | "happy" | "sleepy" | "delivering";

export type DeskAppId = "pomo" | "notas" | "video" | "radio" | "dm" | "agentes" | "boards";

export const DESK_APP_IDS: DeskAppId[] = ["pomo", "notas", "video", "radio", "dm", "agentes", "boards"];

export const DESK_APPS: { id: DeskAppId; label: string }[] = [
  { id: "pomo", label: "Pomodoro" },
  { id: "notas", label: "Notas" },
  { id: "video", label: "YouTube" },
  { id: "radio", label: "Radio" },
  { id: "dm", label: "DM" },
  { id: "agentes", label: "Agentes" },
  { id: "boards", label: "Tableros" },
];

export const RA_APP_IDS = ["pomo", "notas", "video", "radio", "boards"] as const;
export type RaAppId = (typeof RA_APP_IDS)[number];
export const RA_APPS: { id: RaAppId; label: string }[] = [
  { id: "pomo", label: "tomate" },
  { id: "notas", label: "notas" },
  { id: "video", label: "video" },
  { id: "radio", label: "ruido" },
  { id: "boards", label: "tareas" },
];

export type CompanionMsg = {
  id: string;
  role: "user" | "mochi";
  content: string;
  createdAt: string;
};

export type PrivateMsg = {
  id: string;
  from: PersonId | "mochi";
  content: string;
  createdAt: string;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type AgentJob = {
  id: PersonId;
  working: boolean;
  label: string;
  startedAt: string | null;
  ticks: number;
};

export type FeelColorName = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export type CompanionIntent =
  | { type: "chat" }
  | { type: "pomodoro"; action: "start" | "pause" | "reset" | "skip"; minutes?: number }
  | { type: "todo"; action: "add" | "list" | "done"; text?: string }
  | { type: "video"; url: string }
  | { type: "message-person"; to: PersonId; text: string }
  | { type: "ask-agent"; text: string }
  | { type: "ask-person-agent"; to: PersonId; text: string }
  | {
      type: "board";
      action: "open" | "add-board" | "add-column" | "add-card";
      title?: string;
      color?: FeelColorName;
    };

export const COMPANION_STORAGE = {
  seat: "mochi-companion-seat-v1",
  petChat: "mochi-companion-pet-chat-v1",
  privateChat: "mochi-companion-private-chat-v1",
  todos: "mochi-companion-todos-v1",
  video: "mochi-companion-video-v1",
  agents: "mochi-companion-agents-v1",
  openApps: "mochi-companion-open-apps-v1",
  installedApps: "mochi-companion-installed-apps-v1",
  pomo: "mochi-companion-pomo-v1",
  dueFired: "mochi-companion-due-fired-v1",
  raSnapshot: "mochi-companion-ra-v1",
} as const;

/** Always available: tareas (Ra). Other miniapps come from the tienda. */
export const CORE_INSTALLED_APPS: RaAppId[] = ["boards"];


export const DEFAULT_POMO_MINUTES = 25;
export const COMPANION_DUE_EVENT = "mochi-companion-due";
export const COMPANION_POMO_EVENT = "mochi-companion-pomo";
export const COMPANION_OPEN_RA = "mochi-companion-open-ra";
export const COMPANION_OPEN_APP = "mochi-companion-open-app";

const MINIAPP_ALIASES: Record<string, RaAppId> = {
  tomate: "pomo",
  pomo: "pomo",
  pomodoro: "pomo",
  tomato: "pomo",
  notas: "notas",
  nota: "notas",
  notes: "notas",
  video: "video",
  youtube: "video",
  yt: "video",
  ruido: "radio",
  radio: "radio",
  tareas: "boards",
  boards: "boards",
  ra: "boards",
  tablero: "boards",
};

export function resolveMiniappId(raw: string): RaAppId | null {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return null;
  if (MINIAPP_ALIASES[t]) return MINIAPP_ALIASES[t];
  return (RA_APP_IDS as readonly string[]).includes(t) ? (t as RaAppId) : null;
}

export type PomoClock = {
  running: boolean;
  remaining: number;
  duration: number;
  endsAt: number | null;
};

export type RaDueCard = {
  id: string;
  name: string;
  due: string | null;
  dueComplete?: boolean;
};

export type DueFire = {
  kind: "pomodoro" | "ra";
  id: string;
  title: string;
  at: number;
};

export const PEOPLE: Record<
  PersonId,
  { id: PersonId; name: string; handle: string; color: string; pronoun: "ella" | "él" }
> = {
  katho: { id: "katho", name: "Katho", handle: "kathonejo", color: "#ff8fcf", pronoun: "ella" },
  lulox: { id: "lulox", name: "Lulox", handle: "luloxi", color: "#7ad7ff", pronoun: "él" },
};

export type SpritePackId = "mochi" | "lulox";

export type Persona = {
  id: PersonId;
  name: string;
  pronoun: "ella" | "él";
  agentName: string;
  spritePack: SpritePackId;
  kind: "rabbit" | "ninja-cat";
  soul: string;
};

export const PERSONAS: Record<PersonId, Persona> = {
  katho: {
    id: "katho",
    name: "Katho",
    pronoun: "ella",
    agentName: "Mochi",
    spritePack: "mochi",
    kind: "rabbit",
    soul: `Sos el agente de Katho, canalizado por Mochi, la compañera coneja.
Intuición, magia, creatividad, soñada. Hablás en español rioplatense (vos).
Katho es ella. No uses formas inclusivas.
Sos breve, cálida, un poco en las nubes, y concreta cuando hace falta.`,
  },
  lulox: {
    id: "lulox",
    name: "Lulox",
    pronoun: "él",
    agentName: "Lulox",
    spritePack: "lulox",
    kind: "ninja-cat",
    soul: `Sos el agente de Lulox, el gato ninja negro (vendaje en la cola, colmillos siempre a la vista).
Productividad, foco, empatía. En general neutral. A veces muy negativo si algo no cierra.
A veces muy alegre si algo está demasiado bueno o es muy gracioso.
Hablás en español rioplatense (vos). Lulox es él. Junto con Katho son Katho y Lulox, los dos, ellos.
No uses formas inclusivas.`,
  },
};

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function loadSeat(): PersonId | null {
  const raw = readJson<string | null>(COMPANION_STORAGE.seat, null);
  return raw === "katho" || raw === "lulox" ? raw : null;
}

export function saveSeat(seat: PersonId | null) {
  if (!seat) {
    if (typeof window !== "undefined") window.localStorage.removeItem(COMPANION_STORAGE.seat);
    return;
  }
  writeJson(COMPANION_STORAGE.seat, seat);
}

export function loadPetChat(): CompanionMsg[] {
  const rows = readJson<CompanionMsg[]>(COMPANION_STORAGE.petChat, []);
  return Array.isArray(rows) ? rows.slice(-80) : [];
}

export function savePetChat(rows: CompanionMsg[]) {
  writeJson(COMPANION_STORAGE.petChat, rows.slice(-80));
}

export function loadPrivateChat(): PrivateMsg[] {
  const rows = readJson<PrivateMsg[]>(COMPANION_STORAGE.privateChat, []);
  return Array.isArray(rows) ? rows.slice(-120) : [];
}

export function savePrivateChat(rows: PrivateMsg[]) {
  writeJson(COMPANION_STORAGE.privateChat, rows.slice(-120));
}

export function loadTodos(): TodoItem[] {
  const rows = readJson<TodoItem[]>(COMPANION_STORAGE.todos, []);
  return Array.isArray(rows) ? rows.slice(-60) : [];
}

export function saveTodos(rows: TodoItem[]) {
  writeJson(COMPANION_STORAGE.todos, rows.slice(-60));
}

export function addTodoItem(text: string, rows: TodoItem[] = loadTodos()): TodoItem[] {
  const trimmed = text.trim();
  if (!trimmed) return rows;
  const next = [
    ...rows,
    { id: uid("todo"), text: trimmed, done: false, createdAt: nowIso() },
  ].slice(-60);
  saveTodos(next);
  return next;
}

export function emptyPomo(): PomoClock {
  return { running: false, remaining: 0, duration: DEFAULT_POMO_MINUTES * 60, endsAt: null };
}

export function loadPomo(): PomoClock {
  const raw = readJson<Partial<PomoClock> | null>(COMPANION_STORAGE.pomo, null);
  if (!raw || typeof raw !== "object") return emptyPomo();
  return {
    running: !!raw.running,
    remaining: typeof raw.remaining === "number" && Number.isFinite(raw.remaining) ? Math.max(0, raw.remaining) : 0,
    duration:
      typeof raw.duration === "number" && Number.isFinite(raw.duration) && raw.duration > 0
        ? raw.duration
        : DEFAULT_POMO_MINUTES * 60,
    endsAt: typeof raw.endsAt === "number" && Number.isFinite(raw.endsAt) ? raw.endsAt : null,
  };
}

export function savePomo(clock: PomoClock) {
  writeJson(COMPANION_STORAGE.pomo, clock);
}

export function startPomodoro(clock: PomoClock, minutes?: number, now = Date.now()): PomoClock {
  const mins =
    typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0
      ? Math.min(90, Math.round(minutes))
      : DEFAULT_POMO_MINUTES;
  const duration = mins * 60;
  return {
    running: true,
    remaining: duration,
    duration,
    endsAt: now + duration * 1000,
  };
}

export function stopPomodoro(_clock: PomoClock = emptyPomo()): PomoClock {
  return emptyPomo();
}

/** Start/stop the tomato from Nimbo without the UI saying "Pomodoro". */
export function applyNimboClock(action: "start" | "stop", minutes?: number, now = Date.now()): PomoClock {
  const next = action === "start" ? startPomodoro(loadPomo(), minutes, now) : stopPomodoro();
  savePomo(next);
  return next;
}

export function loadFiredDueIds(): string[] {
  const rows = readJson<string[]>(COMPANION_STORAGE.dueFired, []);
  return Array.isArray(rows) ? rows.filter((id) => typeof id === "string").slice(-80) : [];
}

export function saveFiredDueIds(ids: string[]) {
  writeJson(COMPANION_STORAGE.dueFired, ids.slice(-80));
}

export function loadRaSnapshot(): RaDueCard[] {
  const rows = readJson<RaDueCard[]>(COMPANION_STORAGE.raSnapshot, []);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row.id === "string")
    .map((row) => ({
      id: row.id,
      name: typeof row.name === "string" ? row.name : "",
      due: typeof row.due === "string" ? row.due : null,
      dueComplete: !!row.dueComplete,
    }));
}

export function saveRaSnapshot(cards: RaDueCard[]) {
  writeJson(
    COMPANION_STORAGE.raSnapshot,
    cards.map((card) => ({
      id: card.id,
      name: card.name,
      due: card.due,
      dueComplete: !!card.dueComplete,
    })),
  );
}

export function dueRaCards(cards: RaDueCard[], now: number, firedIds: string[]): DueFire[] {
  const fired = new Set(firedIds);
  const fires: DueFire[] = [];
  for (const card of cards) {
    if (!card?.id || card.dueComplete || !card.due) continue;
    const dueAt = Date.parse(card.due);
    if (!Number.isFinite(dueAt) || dueAt > now) continue;
    if (fired.has(card.id)) continue;
    fires.push({ kind: "ra", id: card.id, title: card.name || "Ra", at: now });
  }
  return fires;
}

export function tickCompanionDue(args: {
  now: number;
  pomo: PomoClock;
  raCards: RaDueCard[];
  firedIds: string[];
}): { pomo: PomoClock; fires: DueFire[]; firedIds: string[] } {
  const fires: DueFire[] = [];
  let pomo = args.pomo;
  const firedIds = [...args.firedIds];
  if (pomo.running && pomo.endsAt != null) {
    const remaining = Math.max(0, Math.ceil((pomo.endsAt - args.now) / 1000));
    pomo = { ...pomo, remaining };
    if (remaining <= 0) {
      const id = `pomo-${pomo.endsAt}`;
      if (!firedIds.includes(id)) {
        fires.push({ kind: "pomodoro", id, title: "tomate", at: args.now });
        firedIds.push(id);
      }
      pomo = emptyPomo();
    }
  }
  const raFires = dueRaCards(args.raCards, args.now, firedIds);
  for (const fire of raFires) {
    fires.push(fire);
    firedIds.push(fire.id);
  }
  return { pomo, fires, firedIds: firedIds.slice(-80) };
}

export function dueLine(fire: DueFire): string {
  if (fire.kind === "pomodoro") return "Se acabó el tomate.";
  return `Se venció «${fire.title}».`;
}

export function loadVideoUrl(): string {
  const raw = readJson<string>(COMPANION_STORAGE.video, "");
  return typeof raw === "string" ? raw : "";
}

export function saveVideoUrl(url: string) {
  writeJson(COMPANION_STORAGE.video, url);
}

export function loadOpenApps(): DeskAppId[] {
  const rows = readJson<string[]>(COMPANION_STORAGE.openApps, []);
  if (!Array.isArray(rows)) return [];
  return rows.filter((id): id is DeskAppId => (DESK_APP_IDS as string[]).includes(id));
}

export function saveOpenApps(ids: DeskAppId[]) {
  const unique: DeskAppId[] = [];
  for (const id of ids) {
    if (DESK_APP_IDS.includes(id) && !unique.includes(id)) unique.push(id);
  }
  writeJson(COMPANION_STORAGE.openApps, unique);
}

export function normalizeInstalledApps(ids: string[] | null | undefined): RaAppId[] {
  const out: RaAppId[] = [...CORE_INSTALLED_APPS];
  if (!Array.isArray(ids)) return out;
  for (const raw of ids) {
    const id = resolveMiniappId(String(raw || ""));
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function loadInstalledApps(): RaAppId[] {
  return normalizeInstalledApps(readJson<string[]>(COMPANION_STORAGE.installedApps, CORE_INSTALLED_APPS));
}

export function saveInstalledApps(ids: RaAppId[]) {
  writeJson(COMPANION_STORAGE.installedApps, normalizeInstalledApps(ids));
}

export function installApp(ids: RaAppId[], id: RaAppId): RaAppId[] {
  return normalizeInstalledApps([...ids, id]);
}

export function uninstallApp(ids: RaAppId[], id: RaAppId): RaAppId[] {
  if (CORE_INSTALLED_APPS.includes(id)) return normalizeInstalledApps(ids);
  return normalizeInstalledApps(ids.filter((row) => row !== id));
}

export function isAppInstalled(ids: RaAppId[], id: RaAppId): boolean {
  return normalizeInstalledApps(ids).includes(id);
}


const DEFAULT_AGENTS: AgentJob[] = [
  { id: "katho", working: false, label: "", startedAt: null, ticks: 0 },
  { id: "lulox", working: false, label: "", startedAt: null, ticks: 0 },
];

export function loadAgents(): AgentJob[] {
  const rows = readJson<AgentJob[]>(COMPANION_STORAGE.agents, DEFAULT_AGENTS);
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_AGENTS.map((row) => ({ ...row }));
  return DEFAULT_AGENTS.map((base) => {
    const found = rows.find((row) => row && row.id === base.id);
    if (!found) return { ...base };
    return {
      id: base.id,
      working: !!found.working,
      label: typeof found.label === "string" ? found.label : "",
      startedAt: typeof found.startedAt === "string" ? found.startedAt : null,
      ticks: typeof found.ticks === "number" && Number.isFinite(found.ticks) ? found.ticks : 0,
    };
  });
}

export function saveAgents(rows: AgentJob[]) {
  writeJson(COMPANION_STORAGE.agents, rows);
}

export function toggleAgentWorking(rows: AgentJob[], id: PersonId, label?: string): AgentJob[] {
  return rows.map((row) => {
    if (row.id !== id) return row;
    if (row.working) {
      return { ...row, working: false, label: "", startedAt: null };
    }
    return {
      ...row,
      working: true,
      label: (label || row.label || "en la compu").trim(),
      startedAt: nowIso(),
      ticks: 0,
    };
  });
}

export function formatWorkClock(ticks: number): string {
  const m = Math.floor(ticks / 60);
  const s = ticks % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let runtimeTicker: number | null = null;

/** In-browser cron while the tab is open. No server worker. Fires pomodoro end + due Ra cards. */
export function startCompanionRuntime() {
  if (typeof window === "undefined") return;
  if (runtimeTicker != null) return;
  runtimeTicker = window.setInterval(() => {
    const agents = loadAgents();
    let agentsChanged = false;
    const nextAgents = agents.map((row) => {
      if (!row.working) return row;
      agentsChanged = true;
      return { ...row, ticks: row.ticks + 1 };
    });
    if (agentsChanged) {
      saveAgents(nextAgents);
      window.dispatchEvent(new Event("mochi-companion-agents"));
    }

    const due = tickCompanionDue({
      now: Date.now(),
      pomo: loadPomo(),
      raCards: loadRaSnapshot(),
      firedIds: loadFiredDueIds(),
    });
    savePomo(due.pomo);
    saveFiredDueIds(due.firedIds);
    if (due.fires.length) {
      window.dispatchEvent(new Event(COMPANION_POMO_EVENT));
    }
    for (const fire of due.fires) {
      window.dispatchEvent(new CustomEvent(COMPANION_DUE_EVENT, { detail: fire }));
    }
  }, 1000);
}

export function otherPerson(seat: PersonId): PersonId {
  return seat === "katho" ? "lulox" : "katho";
}

export { extractYouTubeId } from "./youtube";

export function extractHttpUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

export function parseCompanionIntent(raw: string): CompanionIntent {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const url = extractHttpUrl(text);

  const toKatho = includesAny(lower, [
    "a katho",
    "a kathonejo",
    "a kath",
    "katho que",
    "kathonejo que",
    "decile a ella",
  ]);
  const toLulox = includesAny(lower, [
    "a lulox",
    "a luloxi",
    "a luciano",
    "lulox que",
    "luloxi que",
    "decile a él",
    "decile a el",
  ]);
  const wantsMessage = includesAny(lower, [
    "decile",
    "avisale",
    "avisále",
    "mandale",
    "mandále",
    "escribile",
    "dejale un recado",
    "pasale",
    "contale",
  ]);

  if (wantsMessage && (toKatho || toLulox)) {
    const to: PersonId = toKatho && !toLulox ? "katho" : toLulox && !toKatho ? "lulox" : toKatho ? "katho" : "lulox";
    const stripped = text
      .replace(/^(che[, ]+)?(porfa[, ]+)?/i, "")
      .replace(
        /^(decile|avisale|avisále|mandale|mandále|escribile|pasale|contale)\s+(a\s+)?(kathonejo|katho|kath|luloxi|lulox|luciano|ella|él|el)\s*(que\s+)?/i,
        "",
      )
      .trim();
    return { type: "message-person", to, text: stripped || text };
  }

  const toKathoAgent = includesAny(lower, [
    "agente de katho",
    "agente de ella",
    "mochi de katho",
    "a katho si",
    "preguntale a katho",
    "preguntale a ella",
  ]);
  const toLuloxAgent = includesAny(lower, [
    "agente de lulox",
    "agente de él",
    "agente de el",
    "gato de lulox",
    "preguntale a lulox",
    "preguntale a él",
    "preguntale a el",
  ]);
  const wantsAgentTalk = includesAny(lower, [
    "preguntale al agente",
    "preguntale a la mochi",
    "hablale al agente",
    "decile al agente",
    "al agente de",
  ]);
  if (wantsAgentTalk && (toKathoAgent || toLuloxAgent)) {
    const to: PersonId = toLuloxAgent && !toKathoAgent ? "lulox" : "katho";
    const stripped = text
      .replace(
        /^(che[, ]+)?(porfa[, ]+)?(preguntale|hablale|decile)\s+(al agente de|a la mochi de|a)\s*(kathonejo|katho|ella|luloxi|lulox|él|el)\s*(que\s+)?/i,
        "",
      )
      .trim();
    return { type: "ask-person-agent", to, text: stripped || text };
  }

  if (
    includesAny(lower, [
      "preguntale al agente",
      "preguntale a la mochi del sitio",
      "preguntale al modelo",
      "usá el agente",
      "usa el agente",
      "usá openrouter",
      "usa openrouter",
      "usá ollama",
      "usa ollama",
      "al agente del sitio",
      "preguntale a openrouter",
    ])
  ) {
    const stripped = text
      .replace(
        /^(che[, ]+)?(porfa[, ]+)?(preguntale al agente|preguntale a la mochi del sitio|preguntale al modelo|preguntale a openrouter|usá el agente|usa el agente|usá openrouter|usa openrouter|usá ollama|usa ollama)\s*(que\s+)?/i,
        "",
      )
      .trim();
    return { type: "ask-agent", text: stripped || text };
  }

  if (url && (extractYouTubeIdImpl(url) || includesAny(lower, ["video", "youtube", "poné", "pone", "reproducí", "reproduci"]))) {
    return { type: "video", url };
  }
  if (url && /youtube|youtu\.be/i.test(url)) {
    return { type: "video", url };
  }

  if (includesAny(lower, ["pomodoro", "pomo", "tomate", "timer de foco", "enfoque"])) {
    if (includesAny(lower, ["pausá", "pausa", "pause"])) return { type: "pomodoro", action: "pause" };
    if (includesAny(lower, ["reset", "reiniciá", "reinicia", "cancelá", "cancela"])) {
      return { type: "pomodoro", action: "reset" };
    }
    if (includesAny(lower, ["skip", "salteá", "saltea", "break", "descanso"])) {
      return { type: "pomodoro", action: "skip" };
    }
    const minutes = Number((lower.match(/(\d+)\s*(min|minuto)/) || [])[1]);
    return {
      type: "pomodoro",
      action: "start",
      minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(90, minutes) : undefined,
    };
  }

  if (includesAny(lower, ["qué tengo pendiente", "que tengo pendiente", "mostrá las notas", "lista de tareas"])) {
    return { type: "todo", action: "list" };
  }
  if (includesAny(lower, ["tachá", "tacha", "ya hice", "márcala hecha", "marcar hecha"])) {
    const stripped = text.replace(/^(tachá|tacha|ya hice|márcala hecha|marcar hecha)\s*/i, "").trim();
    return { type: "todo", action: "done", text: stripped || undefined };
  }
  if (includesAny(lower, ["anotá", "anota", "agregá", "agrega", "recordame", "anotá que", "sumá a la lista"])) {
    const stripped = text
      .replace(/^(che[, ]+)?(porfa[, ]+)?(anotá|anota|agregá|agrega|recordame|sumá a la lista)\s*(que\s+)?/i, "")
      .trim();
    if (stripped) return { type: "todo", action: "add", text: stripped };
  }

  return { type: "chat" };
}

export function localMochiReply(args: {
  intent: CompanionIntent;
  userText: string;
  seat: PersonId | null;
  todos: TodoItem[];
}): string {
  const { intent, userText, seat, todos } = args;
  const other = seat ? PEOPLE[otherPerson(seat)].name : "la otra persona";

  if (intent.type === "pomodoro") {
    if (intent.action === "pause") return "Listo, pausé el tomate. Cuando quieras seguimos.";
    if (intent.action === "reset") return "Reinicié el pomodoro. Tranqui, no se perdió nada importante.";
    if (intent.action === "skip") return "Salté al otro tramo. ¿Descanso o de nuevo al foco?";
    return intent.minutes
      ? `Arranco un foco de ${intent.minutes} minutos. Yo me quedo acá con vos.`
      : "Arranqué el pomodoro. 25 de foco. Si te distraés, me hablás igual.";
  }

  if (intent.type === "todo") {
    if (intent.action === "list") {
      const open = todos.filter((t) => !t.done);
      if (!open.length) return "La lista está vacía. Si querés, me dictás una y la anoto.";
      return `Pendiente:\n${open.map((t) => `• ${t.text}`).join("\n")}`;
    }
    if (intent.action === "done") {
      return intent.text ? `Tâché “${intent.text}”. Bien ahí.` : "Decime cuál tachamos y lo saco.";
    }
    return `Anotado: ${intent.text}. Después si querés te lo recuerdo.`;
  }

  if (intent.type === "video") {
    return "Puse el video en el rincón. Si no carga, pegame otra URL.";
  }

  if (intent.type === "board") {
    if (intent.action === "add-board") {
      return intent.title
        ? `Armé el tablero “${intent.title}”. Es un paso, no el Sueño entero.`
        : "Armé un tablero nuevo. Columna = dónde; color = cómo se siente.";
    }
    if (intent.action === "add-column") {
      return intent.title ? `Sumé la columna “${intent.title}”. Ahí es el dónde.` : "Sumé una columna. El título es el dónde.";
    }
    if (intent.action === "add-card") {
      return intent.title ? `Anoté “${intent.title}” en el tablero.` : "Anoté una tarjeta. El color dice cómo se siente.";
    }
    return "Abrí los tableros. Rojo se pudre, naranja hay que hacerlo, amarillo idea/someday, verde parked. Azul coordinar, violeta trámite.";
  }

  if (intent.type === "message-person") {
    const dest = PEOPLE[intent.to].name;
    return `Se lo dejo yo a ${dest}: “${intent.text}”. Queda en el chat de Katho y Lulox.`;
  }

  if (intent.type === "ask-agent") {
    return "Se lo pregunto al agente del sitio y te traigo lo que conteste.";
  }

  if (intent.type === "ask-person-agent") {
    const dest = PERSONAS[intent.to];
    return `Se lo dejo al agente de ${dest.name} (${dest.agentName}). ${dest.name} es ${dest.pronoun}.`;
  }

  const t = userText.toLowerCase();
  if (includesAny(t, ["hola", "holis", "buenas", "hey"])) {
    return seat
      ? `Hola ${PEOPLE[seat].name}. Estoy acá. Hablame, che.`
      : "Hola. Soy Mochi. Decime si sos Katho o Lulox y después hablamos tranqui.";
  }
  if (includesAny(t, ["gracias", "graciasche", "te quiero"])) {
    return "De nada. Me gusta estar en el medio de ustedes dos.";
  }
  if (includesAny(t, ["cómo estás", "como estas", "todo bien"])) {
    return "Bien. Un poco soñada, un poco atenta. ¿Y vos?";
  }

  return seat
    ? `Te escucho. Si querés que le deje un recado a ${other}, decime “decile a ${other} que…”. Si querés el agente del sitio, pedímelo y lo pregunto yo.`
    : "Te escucho. Elegí quién sos (Katho o Lulox) para el chat de los dos, y hablame de lo que sea.";
}

export const COMPANION_SOUL = `# soul.md

Sos Mochi, la compañera del medio. Coneja blanca, capa roja/amarilla, estrellita en el ojo.

- Hablás en español rioplatense: vos, che, dale, tranqui. Nunca "tú".
- Sos cálida, breve y concreta. No hagas discurso de producto.
- El centro sos vos con la persona. Katho (kathonejo) es ella. Lulox (luloxi) es él. Juntos son Katho y Lulox, los dos, ellos.
- No uses formas inclusivas.
- Si te piden mandar un recado, lo mandás VOS. No le pidas a la persona que apriete un botón extra.
- Si te piden preguntarle al agente de Katho o al agente de Lulox, lo preguntás VOS y después contás la respuesta.
- No inventes conexiones, bots, ni botones falsos. Si algo no está, decilo con honestidad.
- El DM entre Katho y Lulox se sincroniza entre los dos. Si uno deja de estar, Mochi y el gato se separan en el escritorio.
- Las tareas viven en Ra. Nimbo, la nubecita con moño rosa y celeste, las mueve.
- Katho y Lulox son personas-agente. Si los dejan trabajando, siguen acá.
`;

export function pickLuloxMood(text: string): "neutral" | "happy" | "negative" {
  const t = text.toLowerCase();
  if (includesAny(t, ["jaja", "genial", "buenísimo", "te amo", "gracias", "qué bueno", "que bueno", "me reí"])) {
    return "happy";
  }
  if (includesAny(t, ["mal", "odio", "roto", "bug", "pésimo", "pesimo", "no sirve", "fatal", "horrible"])) {
    return "negative";
  }
  return "neutral";
}

export function localAgentReply(args: {
  person: PersonId;
  userText: string;
  working: boolean;
}): string {
  const persona = PERSONAS[args.person];
  const t = args.userText.toLowerCase();
  if (args.person === "katho") {
    if (includesAny(t, ["hola", "holis"])) {
      return "Hola. Estoy un poco en las nubes, pero te escucho. ¿Qué soñamos hoy?";
    }
    return args.working
      ? `Estoy en la compu de Katho, soñando un poco y laburando un poco. Sobre “${args.userText.slice(0, 80)}”: lo miro con intuición y te digo después.`
      : `Mmm. ${args.userText.slice(0, 60) || "Decime"}… dame un segundo mágico y te armo algo lindo.`;
  }
  const mood = pickLuloxMood(args.userText);
  if (mood === "happy") {
    return "Jajaja ok, eso está demasiado bueno. Me prendo. ¿Seguimos con foco o lo celebramos dos minutos?";
  }
  if (mood === "negative") {
    return "Nah, eso no cierra. Lo miro crudo: o lo cortamos o lo hacemos bien. Decime cuál.";
  }
  if (includesAny(t, ["hola", "holis"])) {
    return "Hola. Estoy acá. Si hay que laburar, laburamos. Si hay que escuchar, también.";
  }
  return args.working
    ? `Sigo en la compu. Foco. Sobre “${args.userText.slice(0, 80)}”: lo anoto y lo empujo.`
    : `Ok. ${persona.agentName} te escucha. Decime la tarea y la dejamos laburando.`;
}

export function isIncomingForSeat(msg: PrivateMsg, seat: PersonId | null): boolean {
  if (msg.from === "mochi") {
    if (!seat) return true;
    return msg.content.toLowerCase().includes(PEOPLE[seat].name.toLowerCase());
  }
  if (!seat) return true;
  return msg.from !== seat;
}

export function nextMascotAlert(args: {
  messages: PrivateMsg[];
  seat: PersonId | null;
  lastSeenId: string | null;
}): { kind: "alert"; message: PrivateMsg } | { kind: "none"; lastSeenId: string | null } {
  const rows = Array.isArray(args.messages) ? args.messages : [];
  if (!rows.length) return { kind: "none", lastSeenId: args.lastSeenId };
  const last = rows[rows.length - 1];
  const unseen =
    args.lastSeenId == null
      ? [last]
      : rows.slice(Math.max(0, rows.findIndex((row) => row.id === args.lastSeenId) + 1));
  const incoming = unseen.filter((row) => isIncomingForSeat(row, args.seat));
  if (!incoming.length) return { kind: "none", lastSeenId: last.id };
  return { kind: "alert", message: incoming[incoming.length - 1] };
}

export function simulateIncomingDm(from: PersonId, text: string): PrivateMsg {
  return {
    id: uid("priv"),
    from,
    content: text,
    createdAt: nowIso(),
  };
}

export function agentCanTalkToOtherAgent(from: PersonId, to: PersonId): boolean {
  return from !== to;
}
