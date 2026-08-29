export type PersonId = "katho" | "lulox";

export type PetMood = "idle" | "listening" | "thinking" | "happy" | "sleepy" | "delivering";

export type DeskAppId = "pomo" | "notas" | "video" | "dm" | "agentes";

export const DESK_APP_IDS: DeskAppId[] = ["pomo", "notas", "video", "dm", "agentes"];

export const DESK_APPS: { id: DeskAppId; label: string }[] = [
  { id: "pomo", label: "Pomodoro" },
  { id: "notas", label: "Notas" },
  { id: "video", label: "Video" },
  { id: "dm", label: "DM" },
  { id: "agentes", label: "Agentes" },
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

export type CompanionIntent =
  | { type: "chat" }
  | { type: "pomodoro"; action: "start" | "pause" | "reset" | "skip"; minutes?: number }
  | { type: "todo"; action: "add" | "list" | "done"; text?: string }
  | { type: "video"; url: string }
  | { type: "message-person"; to: PersonId; text: string }
  | { type: "ask-agent"; text: string };

export const COMPANION_STORAGE = {
  seat: "mochi-companion-seat-v1",
  petChat: "mochi-companion-pet-chat-v1",
  privateChat: "mochi-companion-private-chat-v1",
  todos: "mochi-companion-todos-v1",
  video: "mochi-companion-video-v1",
  agents: "mochi-companion-agents-v1",
  openApps: "mochi-companion-open-apps-v1",
} as const;

export const PEOPLE: Record<
  PersonId,
  { id: PersonId; name: string; handle: string; color: string }
> = {
  katho: { id: "katho", name: "Katho", handle: "kathonejo", color: "#ff8fcf" },
  lulox: { id: "lulox", name: "Lulox", handle: "luloxi", color: "#7ad7ff" },
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

let agentTicker: number | null = null;

export function startCompanionRuntime() {
  if (typeof window === "undefined") return;
  if (agentTicker != null) return;
  agentTicker = window.setInterval(() => {
    const agents = loadAgents();
    let changed = false;
    const next = agents.map((row) => {
      if (!row.working) return row;
      changed = true;
      return { ...row, ticks: row.ticks + 1 };
    });
    if (changed) {
      saveAgents(next);
      window.dispatchEvent(new Event("mochi-companion-agents"));
    }
  }, 1000);
}

export function otherPerson(seat: PersonId): PersonId {
  return seat === "katho" ? "lulox" : "katho";
}

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i,
];

export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  for (const pattern of YT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

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

  if (url && (extractYouTubeId(url) || includesAny(lower, ["video", "youtube", "poné", "pone", "reproducí", "reproduci"]))) {
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

  if (intent.type === "message-person") {
    const dest = PEOPLE[intent.to].name;
    return `Se lo dejo yo a ${dest}: “${intent.text}”. Queda en el chat de Katho y Lulox.`;
  }

  if (intent.type === "ask-agent") {
    return "Se lo pregunto al agente del sitio y te traigo lo que conteste.";
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

Sos Mochi, la compañera del medio.

- Hablás en español rioplatense: vos, che, dale, tranqui. Nunca "tú".
- Sos cálida, breve y concreta. No hagas discurso de producto.
- El centro sos vos con la persona. Katho (kathonejo) y Lulox (luloxi) son las personas de esta pieza.
- Si te piden mandar un recado, lo mandás VOS. No le pidas a la persona que apriete un botón extra.
- Si te piden preguntarle al agente del sitio, lo preguntás VOS y después contás la respuesta.
- No inventes conexiones, bots, ni botones falsos. Si algo no está, decilo con honestidad.
- No prometas servidores que no existen. El chat entre Katho y Lulox vive en este navegador.
- Katho y Lulox son personas-agente. Si los dejan trabajando, siguen en esta pestaña del navegador, no en la nube.
`;
