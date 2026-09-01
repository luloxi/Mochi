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

export type LlmChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export const NIMBO_NAME = "Nimbo";

export const NIMBO_SOUL = `Sos Nimbo, el bicho oro y gris de las tareas.
Hablás en español rioplatense (vos, che, dale). Corto. Pocas palabras.
Katho es ella. Lulox es él. Juntos son Katho y Lulox, los dos.
No uses lenguaje inclusivo. Nada de esas formas raras.
Usá las herramientas. Si te piden una tarjeta en Ra, llamá add_ra_card (lista y color si los dicen).
Si preguntan qué hay en el tablero, llamá list_ra_board.
Si piden tomate, notas, video, ruido o tareas, llamá open_miniapp.
Si Ra no está, decí "Ra no está." No finjas que agregaste nada.
Nunca contestes solo un saludo si te pidieron una tarea.
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

export function buildLlmRequest(args: {
  pick: LlmPick;
  messages: LlmChatMessage[];
  tools?: unknown[];
  toolChoice?: "auto" | "required" | "none";
}): {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: Record<string, unknown>;
} | null {
  if (args.pick.provider === "none" || !args.pick.apiKey || !args.pick.url) return null;
  const body: Record<string, unknown> = {
    model: args.pick.model,
    messages: args.messages,
    temperature: 0.6,
    max_tokens: 280,
  };
  if (args.tools && args.tools.length) {
    body.tools = args.tools;
    body.tool_choice = args.toolChoice || "auto";
  }
  return {
    url: args.pick.url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.pick.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  };
}

export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function extractLlmToolCalls(payload: unknown): LlmToolCall[] {
  const data = payload as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: unknown };
        }>;
      };
    }>;
  };
  const rows = data?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(rows)) return [];
  const out: LlmToolCall[] = [];
  for (const row of rows) {
    const name = String(row?.function?.name || "").trim();
    if (!name) continue;
    out.push({
      id: String(row.id || `call_${out.length + 1}`),
      name,
      arguments: parseToolArguments(row.function?.arguments),
    });
  }
  return out;
}

export async function completeLlmRound(
  messages: LlmChatMessage[],
  args: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    tools?: unknown[];
    toolChoice?: "auto" | "required" | "none";
  } = {},
): Promise<{ provider: LlmProviderId; text: string; toolCalls: LlmToolCall[]; rawMessage: unknown }> {
  const env = args.env ?? process.env;
  const fetchImpl = args.fetchImpl ?? fetch;
  const pick = pickLlmProvider(env);
  const req = buildLlmRequest({
    pick,
    messages,
    tools: args.tools,
    toolChoice: args.toolChoice,
  });
  if (!req) return { provider: "none", text: "", toolCalls: [], rawMessage: null };
  const res = await fetchImpl(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) return { provider: pick.provider, text: "", toolCalls: [], rawMessage: null };
  const json = await res.json().catch(() => null);
  return {
    provider: pick.provider,
    text: extractLlmText(json),
    toolCalls: extractLlmToolCalls(json),
    rawMessage: (json as { choices?: Array<{ message?: unknown }> } | null)?.choices?.[0]?.message ?? json,
  };
}

export async function completeLlmChat(
  messages: LlmChatMessage[],
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ provider: LlmProviderId; text: string }> {
  const round = await completeLlmRound(messages, { env, fetchImpl });
  return { provider: round.provider, text: round.text };
}

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres|invitade|invitades)\b/i;

export function isOnlyCannedRaGreeting(reply: string): boolean {
  return /^hola\.?\s*ra está acá\.?$/i.test(String(reply || "").trim());
}

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
  if (/\b(agreg|sumá|suma|nueva|anot|recordame|tarjeta)\b/.test(t)) {
    return boardLine || "Anotado.";
  }
  if (/\b(hola|holis|buenas)\b/.test(t)) {
    return missing ? "Hola. Ra no está." : "Hola. Ra está acá.";
  }
  if (/\b(gracias|graciasche)\b/.test(t)) return "De nada.";
  if (/\b(qué hay|que hay|tareas|tablero|ra)\b/.test(t)) {
    return boardLine || "Ra. Decime y lo anoto.";
  }
  if (/\b(listo|done|terminé|termine)\b/.test(t)) return boardLine || "Listo.";
  if (/\b(mové|move|pasa)\b/.test(t)) return boardLine || "Movido.";
  return boardLine || "Dale.";
}

export function nimboSystemMessages(boardLine?: string): LlmChatMessage[] {
  const extra = boardLine
    ? `\nTablero Ra ahora:\n${boardLine}`
    : "\nRa no está. Igual contestá. Si te piden una tarjeta, llamá add_ra_card: la herramienta dice si Ra no está.";
  return [{ role: "system", content: `${NIMBO_SOUL}${extra}` }];
}
