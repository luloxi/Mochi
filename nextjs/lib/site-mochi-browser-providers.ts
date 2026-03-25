import type { SiteMochiChatMessage } from "@/lib/site-mochi-chat";

type ChatRequestMessage = { role: "user" | "assistant" | "system"; content: string };

let _ocIdCounter = 0;
function nextOpenClawId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_ocIdCounter}`;
}

function normalizeOpenClawGatewayUrl(input: string): string {
  const s = (input || "").trim();
  const withProtocol = /^[a-z]+:\/\//i.test(s) ? s : `ws://${s}`;
  const u = new URL(withProtocol);
  if (u.protocol === "http:") u.protocol = "ws:";
  if (u.protocol === "https:") u.protocol = "wss:";
  if (u.protocol !== "ws:" && u.protocol !== "wss:") throw new Error(`OPENCLAW_INVALID_URL:${s}`);
  return u.toString();
}

function getLastUserMessageText(messages: ChatRequestMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content.trim();
  }
  return "";
}

function buildOpenClawSessionKey(agentName: string): string {
  return `site-mochi:${agentName || "main"}`;
}

function mergeOpenClawStreamText(current: string, next: string): string {
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  return current + next;
}

function extractOpenClawText(payload: Record<string, unknown>): string {
  if (!payload) return "";
  const t = payload.text ?? payload.content ?? payload.message ?? payload.output;
  return typeof t === "string" ? t : "";
}

function resolveOllamaUrl(rawUrl: string): string {
  const fallback = "http://127.0.0.1:11434";
  const input = (rawUrl || fallback).trim();
  const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`OLLAMA_INVALID_URL:${input}`);
    }
    return parsed.origin;
  } catch {
    throw new Error(`OLLAMA_INVALID_URL:${input || fallback}`);
  }
}

export async function sendOllamaBrowserChat(args: {
  messages: ChatRequestMessage[];
  ollamaUrl: string;
  ollamaModel: string;
}): Promise<string> {
  const baseUrl = resolveOllamaUrl(args.ollamaUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: args.ollamaModel || "gemma3:1b",
      messages: args.messages,
      stream: false,
    }),
  }).catch(() => {
    throw new Error(`OLLAMA_CONNECT:${baseUrl}`);
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 403) {
      throw new Error(`OLLAMA_FORBIDDEN:${baseUrl}`);
    }
    if (
      response.status === 404 ||
      text.toLowerCase().includes("not found") ||
      text.toLowerCase().includes("does not exist")
    ) {
      throw new Error(`MODEL_NOT_FOUND:${args.ollamaModel}`);
    }
    throw new Error(`OLLAMA_HTTP:${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as
    | { message?: { content?: string } }
    | null;
  const reply = data?.message?.content?.trim();
  if (!reply) throw new Error("OLLAMA_EMPTY_RESPONSE");
  return reply;
}

export async function sendOpenClawBrowserChat(args: {
  messages: ChatRequestMessage[];
  gatewayUrl: string;
  gatewayToken: string;
  agentName: string;
}): Promise<string> {
  if (typeof WebSocket !== "function") {
    throw new Error("OPENCLAW_WEBSOCKET_UNAVAILABLE");
  }
  const normalizedUrl = normalizeOpenClawGatewayUrl(args.gatewayUrl);
  const authToken = String(args.gatewayToken || "").trim();
  if (!authToken) throw new Error("OPENCLAW_MISSING_TOKEN");
  const messageText = getLastUserMessageText(args.messages);
  if (!messageText) throw new Error("OPENCLAW_EMPTY_MESSAGE");

  const sessionKey = buildOpenClawSessionKey(args.agentName);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    let authenticated = false;
    let chatRequestSent = false;
    let sawCompletion = false;
    let responseText = "";
    let idleTimer: number | null = null;

    const timeout = window.setTimeout(() => {
      fail(new Error(`OPENCLAW_TIMEOUT:${normalizedUrl}`));
    }, 70_000);

    const armIdleTimer = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (sawCompletion && responseText) {
          finish(responseText);
          return;
        }
        fail(new Error(`OPENCLAW_IDLE_TIMEOUT:${normalizedUrl}`));
      }, 20_000);
    };

    const touchActivity = () => {
      armIdleTimer();
    };

    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (ws && ws.readyState === ws.OPEN) ws.close(1000, "done");
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (ws && ws.readyState === ws.OPEN) ws.close(1011, "error");
      reject(error);
    };

    const pushText = (nextText: string) => {
      if (!nextText) return;
      responseText = mergeOpenClawStreamText(responseText, nextText);
    };

    try {
      ws = new WebSocket(normalizedUrl);
    } catch {
      fail(new Error(`OPENCLAW_CONNECT:${normalizedUrl}`));
      return;
    }

    ws.addEventListener("open", touchActivity);

    ws.addEventListener("message", (event) => {
      touchActivity();
      let data: any;
      try {
        const raw = typeof event.data === "string" ? event.data : "";
        if (!raw) return;
        data = JSON.parse(raw);
      } catch {
        return;
      }

      if (data.type === "event" && data.event === "connect.challenge") {
        const connectReq = {
          type: "req",
          id: nextOpenClawId("connect"),
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: "gateway-client", version: "1.0.0", platform: "browser", mode: "backend" },
            role: "operator",
            scopes: ["operator.read", "operator.write"],
            auth: { token: authToken },
          },
        };
        ws?.send(JSON.stringify(connectReq));
        return;
      }

      if (data.type === "res" && !authenticated && data.ok === false) {
        const reason = data.error?.message || data.error?.code || "Authentication failed";
        fail(new Error(`OPENCLAW_AUTH_FAILED:${reason}`));
        return;
      }

      if (data.type === "res" && !authenticated && (data.payload?.type === "hello-ok" || data.ok === true)) {
        authenticated = true;
        if (!chatRequestSent) {
          chatRequestSent = true;
          ws?.send(
            JSON.stringify({
              type: "req",
              id: nextOpenClawId("chat"),
              method: "chat.send",
              params: {
                sessionKey,
                message: messageText,
                idempotencyKey: nextOpenClawId("idem"),
              },
            }),
          );
        }
        return;
      }

      if (data.type === "event") {
        const payload = data.payload || {};
        const text = extractOpenClawText(payload);
        if (text) pushText(text);
        if (
          payload.status === "completed" ||
          payload.status === "done" ||
          payload.type === "done" ||
          payload.done === true
        ) {
          sawCompletion = true;
          finish(responseText || text || "(no response)");
        }
        return;
      }

      if (data.type === "res" && authenticated && data.ok === true) {
        if (data.payload?.runId) return;
        const text = extractOpenClawText(data.payload);
        if (text) pushText(text);
        if (
          data.payload?.status === "completed" ||
          data.payload?.status === "done" ||
          data.payload?.done
        ) {
          sawCompletion = true;
          finish(responseText || text || "(no response)");
        }
        return;
      }

      if (data.type === "res" && authenticated && data.ok === false) {
        const reason = data.error?.message || data.error?.code || "Agent request failed";
        fail(new Error(`OPENCLAW_ERROR:${reason}`));
      }
    });

    ws.addEventListener("error", () => {
      fail(new Error(`OPENCLAW_CONNECT:${normalizedUrl}`));
    });

    ws.addEventListener("close", (event) => {
      if (settled) return;
      if (sawCompletion && responseText) {
        finish(responseText);
        return;
      }
      if (responseText) {
        fail(new Error(`OPENCLAW_INCOMPLETE_CLOSE:${event.code}`));
        return;
      }
      if (event.code === 1000 || event.code === 1001) {
        fail(new Error("OPENCLAW_EMPTY_RESPONSE"));
        return;
      }
      fail(new Error(`OPENCLAW_CLOSED:${event.code}`));
    });

    armIdleTimer();
  });
}

export function formatSiteMochiProviderError(
  error: unknown,
  isSpanish: boolean,
  provider: "site" | "openrouter" | "ollama" | "openclaw" | "bitte",
): string {
  const message = String((error as Error)?.message || "UNKNOWN_ERROR");

  if (message.startsWith("NO_CREDITS")) {
    return isSpanish
      ? "Se terminaron los créditos gratis del sitio. Abre el ícono de engranaje y configura tu proveedor."
      : "The website free credits are exhausted. Open the gear icon and configure your own provider.";
  }
  if (message.startsWith("OLLAMA_CONNECT:")) {
    return isSpanish
      ? "No se pudo conectar a Ollama desde tu navegador."
      : "Could not connect to Ollama from your browser.";
  }
  if (message.startsWith("OLLAMA_FORBIDDEN:")) {
    return isSpanish
      ? "Ollama rechazó la solicitud (403). Revisa CORS/URL."
      : "Ollama rejected the request (403). Check CORS/URL.";
  }
  if (message.startsWith("MODEL_NOT_FOUND:")) {
    return isSpanish
      ? "El modelo configurado no existe en el proveedor."
      : "The configured model was not found on the provider.";
  }
  if (message.startsWith("OPENCLAW_INVALID_URL")) {
    return isSpanish ? "La URL de OpenClaw no es válida." : "The OpenClaw URL is invalid.";
  }
  if (message.startsWith("OPENCLAW_MISSING_TOKEN")) {
    return isSpanish
      ? "Falta el token de OpenClaw. Configúralo en el panel."
      : "OpenClaw token is missing. Configure it in the panel.";
  }
  if (message.startsWith("OPENCLAW_WEBSOCKET_UNAVAILABLE")) {
    return isSpanish
      ? "El servidor no tiene soporte WebSocket disponible para OpenClaw en este despliegue."
      : "WebSocket support is unavailable for OpenClaw on this deployment.";
  }
  if (message.startsWith("OPENCLAW_AUTH_FAILED")) {
    return isSpanish
      ? "Falló la autenticación con OpenClaw."
      : "OpenClaw authentication failed.";
  }
  if (message.startsWith("OPENCLAW_TIMEOUT")) {
    return isSpanish
      ? "OpenClaw agotó el tiempo de espera al responder."
      : "OpenClaw timed out while responding.";
  }
  if (message.startsWith("OPENCLAW_IDLE_TIMEOUT")) {
    return isSpanish
      ? "OpenClaw abrió conexión pero no devolvió actividad suficiente."
      : "OpenClaw connected but did not return enough activity.";
  }
  if (message.startsWith("OPENCLAW_CONNECT")) {
    return isSpanish
      ? "No se pudo conectar al gateway de OpenClaw desde el servidor del sitio. Verificá que la URL/token del gateway sean correctos y públicos; si el agente es local, usá un túnel público (wss/https)."
      : "Could not connect to the OpenClaw gateway from the website server. Verify the gateway URL/token are correct and publicly reachable; if your agent is local, use a public tunnel (wss/https).";
  }
  if (
    message.startsWith("OPENCLAW_ERROR") ||
    message.startsWith("OPENCLAW_CLOSED") ||
    message.startsWith("OPENCLAW_INCOMPLETE_CLOSE") ||
    message.startsWith("OPENCLAW_EMPTY_RESPONSE")
  ) {
    return isSpanish
      ? "OpenClaw respondió con un error o cerró la conexión antes de completar la respuesta."
      : "OpenClaw returned an error or closed the connection before completing the response.";
  }
  if (message.startsWith("OPENCLAW_PAIRING_REQUIRED")) {
    return isSpanish
      ? "Primero vinculá OpenClaw con un código de pairing en la configuración."
      : "Pair OpenClaw first with a pairing code in settings.";
  }
  if (message.startsWith("OPENCLAW_PAIRING_EXPIRED")) {
    return isSpanish
      ? "Tu sesión de OpenClaw venció. Vinculá un nuevo código."
      : "Your OpenClaw session expired. Pair with a new code.";
  }
  if (message.startsWith("OPENCLAW_PAIRING_INVALID")) {
    return isSpanish
      ? "La sesión de OpenClaw no es válida. Volvé a vincular con un código."
      : "OpenClaw session is invalid. Pair again with a code.";
  }
  if (message.startsWith("OPENCLAW_RELAY_HTTP_")) {
    const status = message.slice("OPENCLAW_RELAY_HTTP_".length) || "unknown";
    return isSpanish
      ? `El relay de OpenClaw devolvió HTTP ${status}.`
      : `The OpenClaw relay returned HTTP ${status}.`;
  }
  if (message.startsWith("OPENCLAW_RELAY_DETAIL:")) {
    const detail = message.slice("OPENCLAW_RELAY_DETAIL:".length).trim() || "unknown";
    const normalized = detail.toLowerCase();
    if (normalized.includes("missing scope") && normalized.includes("operator.write")) {
      return isSpanish
        ? "El token del gateway no tiene permiso operator.write. Configurá un token con ese scope y volvé a hacer pairing."
        : "Gateway token is missing operator.write scope. Configure a token with that scope and pair again.";
    }
    return isSpanish
      ? `El relay de OpenClaw falló: ${detail}`
      : `The OpenClaw relay failed: ${detail}`;
  }
  if (message.startsWith("OPENCLAW_RELAY_FAILED")) {
    return isSpanish
      ? "No se pudo completar el chat por el relay de OpenClaw."
      : "Could not complete chat through the OpenClaw relay.";
  }
  if (message.startsWith("OPENCLAW_RELAY_TIMEOUT")) {
    return isSpanish
      ? "El relay de OpenClaw agotó el tiempo de espera."
      : "The OpenClaw relay timed out.";
  }
  if (message.startsWith("BITTE_MISSING_API_KEY")) {
    return isSpanish
      ? "Falta la API key de Bitte. Configúrala en el panel de configuración."
      : "Bitte API key is missing. Configure it in the settings panel.";
  }
  if (message.startsWith("BITTE_MISSING_AGENT_ID")) {
    return isSpanish
      ? "Falta el Agent ID de Bitte. Configúralo en el panel de configuración."
      : "Bitte Agent ID is missing. Configure it in the settings panel.";
  }
  if (message.startsWith("BITTE_EMPTY_MESSAGE")) {
    return isSpanish
      ? "El mensaje está vacío."
      : "The message is empty.";
  }
  if (message.startsWith("BITTE_CONNECT")) {
    return isSpanish
      ? "No se pudo conectar a Bitte AI. Verificá tu conexión."
      : "Could not connect to Bitte AI. Check your connection.";
  }
  if (message.startsWith("BITTE_AUTH_FAILED")) {
    return isSpanish
      ? "Falló la autenticación con Bitte. Revisá tu API key."
      : "Bitte authentication failed. Check your API key.";
  }
  if (message.startsWith("BITTE_AGENT_NOT_FOUND")) {
    return isSpanish
      ? "El agente de Bitte no fue encontrado. Revisá el Agent ID."
      : "Bitte agent not found. Check the Agent ID.";
  }
  if (message.startsWith("BITTE_HTTP:")) {
    const status = message.slice("BITTE_HTTP:".length) || "unknown";
    return isSpanish
      ? `Bitte AI devolvió error HTTP ${status}.`
      : `Bitte AI returned HTTP error ${status}.`;
  }
  if (message.startsWith("BITTE_EMPTY_RESPONSE")) {
    return isSpanish
      ? "Bitte AI no devolvió respuesta."
      : "Bitte AI returned no response.";
  }
  if (message.startsWith("BRAVE_MISSING_API_KEY")) {
    return isSpanish
      ? "Falta la Brave API key para usar web search knowledge."
      : "Brave API key is missing for web search knowledge.";
  }
  if (message.startsWith("BRAVE_INVALID_API_KEY")) {
    return isSpanish
      ? "La Brave API key no es válida."
      : "The Brave API key is invalid.";
  }
  if (message.startsWith("BRAVE_RATE_LIMITED")) {
    return isSpanish
      ? "Brave Search llegó al límite temporal. Intentá de nuevo en un rato."
      : "Brave Search hit a temporary rate limit. Try again shortly.";
  }
  if (
    message.startsWith("BRAVE_SEARCH_FAILED") ||
    message.startsWith("BRAVE_REQUEST_FAILED") ||
    message.startsWith("BRAVE_HTTP_")
  ) {
    return isSpanish
      ? "No se pudo obtener contexto web desde Brave Search."
      : "Could not fetch web context from Brave Search.";
  }
  if (message.startsWith("OPENROUTER_DETAIL:")) {
    const detail = message.slice("OPENROUTER_DETAIL:".length).trim();
    return isSpanish
      ? `OpenRouter devolvió un error: ${detail}`
      : `OpenRouter returned an error: ${detail}`;
  }
  if (provider === "bitte") {
    return isSpanish
      ? "No se pudo completar la solicitud con Bitte AI. Revisá tu API key y Agent ID."
      : "Could not complete the Bitte AI request. Check your API key and Agent ID.";
  }
  if (provider === "openclaw") {
    return isSpanish
      ? "No se pudo completar la solicitud con OpenClaw. Revisá el pairing activo y la conectividad del gateway."
      : "Could not complete the OpenClaw request. Check the active pairing and gateway connectivity.";
  }
  if (provider === "ollama") {
    return isSpanish
      ? "No se pudo completar la solicitud con Ollama. Revisá la URL del servidor y CORS/red."
      : "Could not complete the Ollama request. Check server URL and CORS/network.";
  }
  if (provider === "openrouter") {
    return isSpanish
      ? "No se pudo completar la solicitud con OpenRouter. Revisa tu key y modelo."
      : "Could not complete the OpenRouter request. Check your key and model.";
  }
  if (provider === "site") {
    return isSpanish
      ? "Ahora mismo no puedo responder con los créditos del sitio."
      : "I can't respond right now using site credits.";
  }
  return isSpanish
    ? "No pude responder con el proveedor configurado."
    : "I couldn't respond using the configured provider.";
}

export async function sendBitteBrowserChat(args: {
  messages: ChatRequestMessage[];
  bitteApiKey: string;
  bitteAgentId: string;
  walletAddress?: string;
  chainId?: number;
}): Promise<string> {
  const apiKey = args.bitteApiKey.trim();
  const agentId = args.bitteAgentId.trim();
  
  if (!apiKey) throw new Error("BITTE_MISSING_API_KEY");
  if (!agentId) throw new Error("BITTE_MISSING_AGENT_ID");

  const lastMessage = args.messages[args.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("BITTE_EMPTY_MESSAGE");
  }

  // Build conversation history for Bitte
  const conversation = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch("https://api.bitte.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: agentId,
      messages: conversation,
      wallet_address: args.walletAddress,
      chain_id: args.chainId,
    }),
  }).catch(() => {
    throw new Error("BITTE_CONNECT");
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error("BITTE_AUTH_FAILED");
    }
    if (response.status === 404) {
      throw new Error("BITTE_AGENT_NOT_FOUND");
    }
    throw new Error(`BITTE_HTTP:${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("BITTE_EMPTY_RESPONSE");
  
  return reply;
}
