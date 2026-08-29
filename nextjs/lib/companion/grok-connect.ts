/**
 * Real Grok / xAI connect + chat targets for the companion slice.
 * Unsubscribed Connect must land on accounts.x.ai / auth.x.ai / grok.com / api.x.ai
 * — never a no-op and never a dead link to unrelated settings.
 */

export const GROK_ACCOUNTS_ORIGIN = "https://accounts.x.ai";
export const GROK_AUTH_ORIGIN = "https://auth.x.ai";
export const GROK_API_ORIGIN = "https://api.x.ai";
export const GROK_APP_ORIGIN = "https://grok.com";
export const GROK_CONSOLE_KEYS = "https://console.x.ai/team/default/api-keys";
export const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
export const GROK_MODEL = "grok-4";

export const GROK_CONNECT_HOSTS = [
  "accounts.x.ai",
  "auth.x.ai",
  "grok.com",
  "api.x.ai",
  "console.x.ai",
] as const;

export const GROK_STORAGE_KEY = "mochi-companion-grok-v1";

export type GrokSession = {
  apiKey: string | null;
  connectedAt: string | null;
};

export function emptyGrokSession(): GrokSession {
  return { apiKey: null, connectedAt: null };
}

export function isGrokConnected(session: GrokSession | null | undefined): boolean {
  const key = session?.apiKey?.trim() ?? "";
  return key.length > 8;
}

/** Authorization Code-style continue URL onto the real xAI accounts host. */
export function buildGrokConnectUrl(input: { returnTo: string }): string {
  const returnTo = String(input?.returnTo || "").trim();
  const url = new URL("https://accounts.x.ai/sign-in");
  if (returnTo) url.searchParams.set("continue", returnTo);
  url.searchParams.set("intent", "connect");
  return url.toString();
}

export function grokConnectIsRealTarget(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return (GROK_CONNECT_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}

export function parseGrokApiKey(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text || /\s/.test(text)) return null;
  if (text.startsWith("xai-") && text.length > 12) return text;
  if (text.length > 20) return text;
  return null;
}

export function loadGrokSession(): GrokSession {
  if (typeof window === "undefined") return emptyGrokSession();
  try {
    const raw = window.localStorage.getItem(GROK_STORAGE_KEY);
    if (!raw) return emptyGrokSession();
    const parsed = JSON.parse(raw) as GrokSession;
    const apiKey = typeof parsed?.apiKey === "string" ? parsed.apiKey : null;
    return {
      apiKey,
      connectedAt: typeof parsed?.connectedAt === "string" ? parsed.connectedAt : null,
    };
  } catch {
    return emptyGrokSession();
  }
}

export function saveGrokSession(session: GrokSession) {
  if (typeof window === "undefined") return;
  try {
    if (!session.apiKey) {
      window.localStorage.removeItem(GROK_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(GROK_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // quota / private mode
  }
}

export function connectGrokWithKey(raw: string, now = new Date().toISOString()): GrokSession {
  const apiKey = parseGrokApiKey(raw);
  if (!apiKey) return emptyGrokSession();
  return { apiKey, connectedAt: now };
}

export function disconnectGrok(): GrokSession {
  return emptyGrokSession();
}

export type GrokChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function buildGrokChatRequest(args: {
  apiKey: string;
  messages: GrokChatMessage[];
  model?: string;
}): { url: string; method: "POST"; headers: Record<string, string>; body: Record<string, unknown> } {
  const apiKey = args.apiKey.trim();
  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: args.model || GROK_MODEL,
      messages: args.messages,
      temperature: 0.8,
      stream: false,
    },
  };
}

export function grokReplyFromPayload(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
    reply?: unknown;
  };
  const choice = data?.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice.trim();
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (typeof data?.reply === "string" && data.reply.trim()) return data.reply.trim();
  return "";
}
