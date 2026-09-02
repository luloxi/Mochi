/**
 * Three click-to-open windows: Mochi pink, Lulox cyan, Nimbo gold/gray.
 * Nimbo is the task pet: Ra list/add/move/done, pomodoro start/stop, add to the list.
 * Own mascot = HELP. Other person's pet = human chat. Nimbo = IA.
 */

import { parseRaIntent, type RaIntent } from "./trello";
import { parseCompanionIntent, type PersonId } from "./companion-core";
import { NIMBO_NAME } from "./llm";
import type { SpritePackId } from "./shimeji-engine";

export type ChatWindowId = "mochi" | "lulox" | "nimbo";

export type ChatWindowDef = {
  id: ChatWindowId;
  label: string;
  colorName: "pink" | "cyan" | "gold";
  hex: string;
  chrome: string;
  ink: string;
};

export const CHAT_WINDOWS: Record<ChatWindowId, ChatWindowDef> = {
  mochi: {
    id: "mochi",
    label: "Mochi",
    colorName: "pink",
    hex: "#ff8fcf",
    chrome: "#c2186a",
    ink: "#140c18",
  },
  lulox: {
    id: "lulox",
    label: "Lulox",
    colorName: "cyan",
    hex: "#7ad7ff",
    chrome: "#0a6e94",
    ink: "#140c18",
  },
  nimbo: {
    id: "nimbo",
    label: NIMBO_NAME,
    colorName: "gold",
    hex: "#d4a017",
    chrome: "#6b4f0a",
    ink: "#140c18",
  },
};

export function chatWindowList(): ChatWindowDef[] {
  return [CHAT_WINDOWS.mochi, CHAT_WINDOWS.lulox, CHAT_WINDOWS.nimbo];
}

export type NimboIntent =
  | RaIntent
  | { type: "pomodoro"; action: "start" | "stop"; minutes?: number }
  | { type: "todo"; action: "add"; text: string };

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

function parseNimboPomodoro(raw: string): NimboIntent | null {
  const lower = raw.toLowerCase();
  const isPomo = includesAny(lower, ["pomodoro", "pomo", "tomate", "timer de foco"]);
  if (!isPomo) return null;
  const isStop = includesAny(lower, [
    "pará",
    "para el pomo",
    "para el tomate",
    "stop",
    "pausá",
    "pausa",
    "pause",
    "cortá",
    "frená",
    "reiniciá",
    "reset",
    "cancelá",
    "cancela",
  ]);
  if (isStop) return { type: "pomodoro", action: "stop" };
  const minutes = Number((lower.match(/(\d+)\s*(min|minuto)/) || [])[1]);
  return {
    type: "pomodoro",
    action: "start",
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(90, minutes) : undefined,
  };
}

export function parseNimboIntent(raw: string): NimboIntent {
  const pomo = parseNimboPomodoro(raw);
  if (pomo) return pomo;
  const ra = parseRaIntent(raw);
  if (ra.type !== "chat") return ra;
  const companion = parseCompanionIntent(raw);
  if (companion.type === "todo" && companion.action === "add" && companion.text) {
    return { type: "todo", action: "add", text: companion.text };
  }
  return { type: "chat" };
}

export function isRaNimboIntent(intent: NimboIntent): intent is RaIntent {
  return (
    intent.type === "list" ||
    intent.type === "add" ||
    intent.type === "move" ||
    intent.type === "done" ||
    intent.type === "chat"
  );
}

/** @deprecated use parseNimboIntent */
export const parseCoordinatorIntent = parseNimboIntent;
export const parseAppAgentIntent = parseNimboIntent;

export function nimboCanDrive(intent: NimboIntent): boolean {
  return intent.type !== "chat";
}

export type PetClickRole = "human" | "help" | "nimbo";

/**
 * Seat lulox (gato): Mochi = human with Katho; gatito = HELP; Nimbo = IA.
 * Seat katho: gatito = human with Lulox; her Mochi = HELP; Nimbo = IA.
 * Nimbo / Ra click is chat, never the app dock.
 */
export function roleForPetClick(seat: PersonId, pack: SpritePackId): PetClickRole {
  if (pack === "nimbo") return "nimbo";
  if (seat === "lulox") return pack === "mochi" ? "human" : "help";
  return pack === "lulox" ? "human" : "help";
}

/** Same pet again closes the conversation balloon. */
export function toggleOpenChat<T>(current: T | null, next: T): T | null {
  return current === next ? null : next;
}

export type ClickLaunch = { kind: "chat"; chat: PetClickRole } | { kind: "app"; app: string };

export function launchTargetFor(source: "nimbo" | "ra-pet" | "dock", appId?: string): ClickLaunch {
  if (source === "dock") return { kind: "app", app: appId || "boards" };
  return { kind: "chat", chat: "nimbo" };
}

export const HELP_SOUL = `Sos la ayuda del escritorio Compañera.
Hablás en español rioplatense (vos, che, dale). Corto. Concreto.
Katho es ella. Lulox es él. Los dos. Nada de lenguaje inclusivo.
Explicá la app, no des discurso de producto.
Hay tres bichos: Mochi (coneja de Katho), Lulox (gato ninja) y Nimbo (IA).
Tu bicho te explica. El de la otra persona es el chat humano.
Nimbo es el chat de la IA. Las apps salen del dock de abajo al centro, no tocando a Nimbo.
Si Ra no está, la app Ra del dock muestra cómo conectar la casa. No hay tablero embebido.
Se arrastran. Tiro rápido: caen con gravedad y rebotan en las paredes. Tiro lento: se agarran a la pared o al techo y siguen.
En el celu, escritorio = los tres; foco = solo Nimbo. Un botón para cambiar de app.
Puntitos: verde presente, amarillo idle, rojo desconectado. Hover (o dejar el dedo) dice el nombre, de quién es y el estado.`;

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres|invitade|invitades)\b/i;

export function localHelpReply(userText: string, seat: PersonId): string {
  const t = userText.toLowerCase();
  const own = seat === "katho" ? "Mochi" : "Lulox";
  const other = seat === "katho" ? "Lulox" : "Mochi";
  if (INCLUSIVE.test(t)) return "Katho ella, Lulox él. Los dos.";
  if (/\b(hola|holis|buenas|ayuda|help)\b/.test(t)) {
    return `Hola. Soy ${own}. Te explico la app. ${other} es el chat humano. Nimbo es la IA de Ra.`;
  }
  if (/\b(conectar|casa)\b/.test(t)) {
    return "Ra es la casa. En el dock de abajo abrí Ra: tres pasos. Tocá conectar y dale que sí.";
  }
  if (/\b(nimbo|ia|ra|tarea|tomate|pomo)\b/.test(t)) {
    return "Nimbo es el chat de la IA. Hablale de Ra, el tomate o una tarea. Las apps están en el dock de abajo, no en Nimbo.";
  }
  if (/\b(chat|humano|katho|lulox|recado|mensaje)\b/.test(t)) {
    return `Tocá a ${other} para el chat humano. Tu bicho (${own}) es la ayuda.`;
  }
  if (/\b(arrastr|drag|pared|techo|piso|camin|tir|graved|rebot)\b/.test(t)) {
    return "Arrastralos. Si los tirás rápido caen y rebotan. Si vas lento se agarran a la pared o al techo y siguen.";
  }
  if (/\b(app|mini|ra |botón|boton|foco|celu|teléfono|telefono|dock)\b/.test(t)) {
    return "Las apps salen del dock de abajo al centro. En el celu, escritorio son los tres; foco es la app a pantalla. Cambiar es un botón.";
  }
  if (/\b(carita|presenc|verde|rojo|amarillo|desconect|puntit|hover)\b/.test(t)) {
    return "Puntitos: verde presente, amarillo idle, rojo desconectado. El hover dice el nombre, de quién es y el estado.";
  }
  return `Soy ${own}, la ayuda. ${other} es el chat con la otra persona. Nimbo es Ra. Tocá y preguntá.`;
}

export function helpSystemMessages(seat: PersonId): { role: "system"; content: string }[] {
  const who = seat === "katho" ? "Katho" : "Lulox";
  return [{ role: "system", content: `${HELP_SOUL}\nEstás hablando con ${who}.` }];
}

/** @deprecated use nimboCanDrive */
export const coordinatorCanDrive = nimboCanDrive;
export const appAgentCanDrive = nimboCanDrive;
