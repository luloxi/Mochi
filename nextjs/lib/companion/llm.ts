/**
 * In-app LLM for Nimbo. OPENAI first, then xAI. If none, local vibes still work.
 * Never send people to grok.com.
 */

export type LlmProviderId = "openai" | "xai" | "none";

export type LlmPick = {
  provider: LlmProviderId;
  apiKey: string | null;
  url: string | null;
  model: string | null;
};

export type LlmChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const NIMBO_NAME = "Nimbo";

export const NIMBO_SOUL = `Sos Nimbo, el bicho oro y gris de las tareas.
Hablás en español rioplatense (vos, che, dale). Corto. Pocas palabras.
Katho es ella. Lulox es él. Juntos son Katho y Lulox, los dos.
No uses lenguaje inclusivo. Nada de esas formas raras.
Solo hacés tres cosas: el tablero Ra (listar, agregar, mover, marcar listo),
arrancar y parar el tomate, y anotar una tarea en la lista.
Si Ra no está, igual contestá y decí "Ra no está." El juego se conecta con la app Ra del dock de abajo.
No mandes recados, no pongas videos, no mandes a nadie a otro sitio.
No digas que sos Grok ni Chano.`;

export function pickLlmProvider(env: Record<string, string | undefined> = process.env): LlmPick {
  const openai = String(env.OPENAI_API_KEY || "").trim();
  if (openai) {
    return {
      provider: "openai",
      apiKey: openai,
      url: "https://api.openai.com/v1/chat/completions",
      model: String(env.OPENAI_MODEL || "").trim() || "gpt-4o-mini",
    };
  }
  const xai = String(env.GROK_API_KEY || env.XAI_API_KEY || "").trim();
  if (xai) {
    return {
      provider: "xai",
      apiKey: xai,
      url: "https://api.x.ai/v1/chat/completions",
      model: String(env.XAI_MODEL || env.GROK_MODEL || "").trim() || "grok-4-fast-non-reasoning",
    };
  }
  return { provider: "none", apiKey: null, url: null, model: null };
}

export function llmIsConfigured(pick: LlmPick = pickLlmProvider()): boolean {
  return pick.provider !== "none" && Boolean(pick.apiKey);
}

export function extractLlmText(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
    reply?: unknown;
  };
  const choice = data?.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice.trim();
  if (Array.isArray(choice)) {
    const joined = choice
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text || "") : ""))
      .join(" ")
      .trim();
    if (joined) return joined;
  }
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (typeof data?.reply === "string" && data.reply.trim()) return data.reply.trim();
  return "";
}

export function buildLlmRequest(args: { pick: LlmPick; messages: LlmChatMessage[] }): {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: Record<string, unknown>;
} | null {
  if (args.pick.provider === "none" || !args.pick.apiKey || !args.pick.url) return null;
  return {
    url: args.pick.url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.pick.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: args.pick.model,
      messages: args.messages,
      temperature: 0.6,
      max_tokens: 280,
    },
  };
}

export async function completeLlmChat(
  messages: LlmChatMessage[],
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ provider: LlmProviderId; text: string }> {
  const pick = pickLlmProvider(env);
  const req = buildLlmRequest({ pick, messages });
  if (!req) return { provider: "none", text: "" };
  const res = await fetchImpl(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) return { provider: pick.provider, text: "" };
  const json = await res.json().catch(() => null);
  return { provider: pick.provider, text: extractLlmText(json) };
}

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres|invitade|invitades)\b/i;

export function localNimboReply(userText: string, boardLine?: string): string {
  const t = userText.toLowerCase();
  const missing = !boardLine || boardLine.startsWith("Ra no está");
  if (INCLUSIVE.test(t)) return "Katho ella, Lulox él. Los dos.";
  if (/\b(pomo|pomodoro|tomate)\b/.test(t)) {
    if (/\b(pará|para el pomo|para el tomate|stop|pausá|pausa|cortá|frená)\b/.test(t)) {
      return "Paré el tomate.";
    }
    return "Arranqué el tomate.";
  }
  if (/\b(hola|holis|buenas)\b/.test(t)) {
    return missing ? "Hola. Ra no está." : "Hola. Ra está acá.";
  }
  if (/\b(gracias|graciasche)\b/.test(t)) return "De nada.";
  if (/\b(qué hay|que hay|tareas|tablero|ra)\b/.test(t)) {
    return boardLine || "Ra. Decime y lo anoto.";
  }
  if (/\b(agreg|sumá|suma|nueva|anot|recordame)\b/.test(t)) {
    return boardLine || "Anotado.";
  }
  if (/\b(listo|done|terminé|termine)\b/.test(t)) return boardLine || "Listo.";
  if (/\b(mové|move|pasa)\b/.test(t)) return boardLine || "Movido.";
  return boardLine || "Dale.";
}

export function nimboSystemMessages(boardLine?: string): LlmChatMessage[] {
  const extra = boardLine
    ? `\nTablero Ra ahora:\n${boardLine}`
    : "\nRa no está. Igual contestá. Solo Ra, tomate y la lista.";
  return [{ role: "system", content: `${NIMBO_SOUL}${extra}` }];
}
