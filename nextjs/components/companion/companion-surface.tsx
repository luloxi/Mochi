"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CompanionWanderer, CompanionWorkingSprite } from "@/components/companion/companion-pet";
import { useSiteMochi } from "@/components/site-mochi-provider";
import { buildSiteMochiChatMessages } from "@/lib/site-mochi-chat";
import {
  formatSiteMochiProviderError,
  sendBitteBrowserChat,
  sendOllamaBrowserChat,
  sendOpenClawBrowserChat,
} from "@/lib/site-mochi-browser-providers";
import {
  COMPANION_SOUL,
  COMPANION_STORAGE,
  DESK_APPS,
  PEOPLE,
  type AgentJob,
  type CompanionIntent,
  type CompanionMsg,
  type DeskAppId,
  type PersonId,
  type PetMood,
  type PrivateMsg,
  type TodoItem,
  extractYouTubeId,
  formatWorkClock,
  loadAgents,
  loadOpenApps,
  loadPetChat,
  loadPrivateChat,
  loadSeat,
  loadTodos,
  loadVideoUrl,
  localMochiReply,
  otherPerson,
  parseCompanionIntent,
  saveAgents,
  saveOpenApps,
  savePetChat,
  savePrivateChat,
  saveSeat,
  saveTodos,
  saveVideoUrl,
  startCompanionRuntime,
  toggleAgentWorking,
  uid,
  nowIso,
} from "@/lib/companion/companion-core";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isMobile;
}

type MobileTab = "mochi" | "pomo" | "notas" | "video" | "dm";

function DeskWindow({
  appId,
  title,
  focused,
  onFocus,
  onClose,
  children,
}: {
  appId: DeskAppId;
  title: string;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={`desk-window desk-win-${appId}${focused ? " is-focus" : ""}`}
      onPointerDown={onFocus}
    >
      <header className="desk-window-chrome">
        <span className="traffic" aria-hidden />
        <span>{title}</span>
        <button type="button" className="desk-close" onClick={onClose} aria-label={`Cerrar ${title}`}>
          ×
        </button>
      </header>
      <div className="desk-window-body">{children}</div>
    </section>
  );
}

function parseSseBlock(block: string) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataParts: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim() || "message";
    else if (line.startsWith("data:")) dataParts.push(line.slice(5).replace(/^\s/, ""));
  }
  return { event, data: dataParts.join("\n").trim() };
}

async function streamSiteReply(body: Record<string, unknown>): Promise<string> {
  const response = await fetch("/api/mochi-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const json = await response.json().catch(() => null);
    const reply = typeof json?.reply === "string" ? json.reply.trim() : "";
    if (reply) return reply;
    const errorCode = typeof json?.error === "string" ? json.error : "bad-response";
    throw new Error(errorCode);
  }
  if (!response.body) throw new Error("STREAM_UNAVAILABLE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";

  const process = (block: string) => {
    const { event, data } = parseSseBlock(block);
    if (!data) return false;
    if (event === "token") {
      try {
        const payload = JSON.parse(data);
        if (typeof payload?.text === "string") reply += payload.text;
      } catch {
        return false;
      }
      return false;
    }
    if (event === "done") {
      try {
        const payload = JSON.parse(data);
        if (typeof payload?.reply === "string" && payload.reply.trim()) {
          reply = payload.reply.trim();
        }
      } catch {
        // keep accumulated
      }
      return true;
    }
    if (event === "error") {
      let payload: { error?: string } = {};
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error("STREAM_ERROR");
      }
      throw new Error(typeof payload.error === "string" ? payload.error : "STREAM_ERROR");
    }
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (process(block)) return reply.trim();
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) process(buffer);
  return reply.trim();
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PomoRing({
  seconds,
  total,
  mode,
}: {
  seconds: number;
  total: number;
  mode: "foco" | "descanso";
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const progress = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  return (
    <div className="pomo-ring-wrap">
      <svg className="pomo-ring" viewBox="0 0 120 120" aria-hidden>
        <circle className="pomo-ring-bg" cx="60" cy="60" r={r} />
        <circle
          className="pomo-ring-fg"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <div className="pomo-face">
        <div className="pomo-label">{mode === "foco" ? "Foco" : "Descanso"}</div>
        <div className="pomo-time">{formatClock(seconds)}</div>
      </div>
    </div>
  );
}

function VideoFrame({ url }: { url: string }) {
  const yt = extractYouTubeId(url);
  if (yt) {
    return (
      <div className="video-stage">
        <iframe
          title="Video"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (url) {
    return (
      <div className="video-stage">
        <iframe title="URL" src={url} sandbox="allow-scripts allow-same-origin allow-presentation" />
      </div>
    );
  }
  return (
    <p className="empty-note">
      Pegá un YouTube o una URL. Hasta que no haya nada, este rincón queda en silencio. No hay
      playlist inventada.
    </p>
  );
}

export function CompanionSurface() {
  const { config, canUseCurrentProvider, incrementFreeSiteMessagesUsed } = useSiteMochi();
  const isMobile = useIsMobile();
  const [seat, setSeat] = useState<PersonId | null>(null);
  const [petChat, setPetChat] = useState<CompanionMsg[]>([]);
  const [privateChat, setPrivateChat] = useState<PrivateMsg[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDraft, setVideoDraft] = useState("");
  const [todoDraft, setTodoDraft] = useState("");
  const [privateDraft, setPrivateDraft] = useState("");
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [mood, setMood] = useState<PetMood>("idle");
  const [agents, setAgents] = useState<AgentJob[]>([
    { id: "katho", working: false, label: "", startedAt: null, ticks: 0 },
    { id: "lulox", working: false, label: "", startedAt: null, ticks: 0 },
  ]);
  const [perch, setPerch] = useState<{ x: number; y: number } | null>(null);
  const [agentLabelDraft, setAgentLabelDraft] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("mochi");
  const [talkOpen, setTalkOpen] = useState(false);
  const [openApps, setOpenApps] = useState<DeskAppId[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusApp, setFocusApp] = useState<DeskAppId | "talk" | null>(null);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoTotal, setPomoTotal] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoMode, setPomoMode] = useState<"foco" | "descanso">("foco");
  const hydrated = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const mobileLogRef = useRef<HTMLDivElement | null>(null);
  const mochiWorking = sending || mood === "thinking";

  useEffect(() => {
    setSeat(loadSeat());
    setPetChat(loadPetChat());
    setPrivateChat(loadPrivateChat());
    setTodos(loadTodos());
    setAgents(loadAgents());
    setOpenApps(loadOpenApps());
    const storedVideo = loadVideoUrl();
    setVideoUrl(storedVideo);
    setVideoDraft(storedVideo);
    startCompanionRuntime();
    hydrated.current = true;
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === COMPANION_STORAGE.privateChat) setPrivateChat(loadPrivateChat());
      if (event.key === COMPANION_STORAGE.todos) setTodos(loadTodos());
      if (event.key === COMPANION_STORAGE.video) {
        const next = loadVideoUrl();
        setVideoUrl(next);
        setVideoDraft(next);
      }
      if (event.key === COMPANION_STORAGE.petChat) setPetChat(loadPetChat());
      if (event.key === COMPANION_STORAGE.seat) setSeat(loadSeat());
      if (event.key === COMPANION_STORAGE.agents) setAgents(loadAgents());
      if (event.key === COMPANION_STORAGE.openApps) setOpenApps(loadOpenApps());
    };
    const onAgents = () => setAgents(loadAgents());
    window.addEventListener("storage", onStorage);
    window.addEventListener("mochi-companion-agents", onAgents);
    startCompanionRuntime();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("mochi-companion-agents", onAgents);
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveSeat(seat);
  }, [seat]);
  useEffect(() => {
    if (!hydrated.current) return;
    savePetChat(petChat);
  }, [petChat]);
  useEffect(() => {
    if (!hydrated.current) return;
    savePrivateChat(privateChat);
  }, [privateChat]);
  useEffect(() => {
    if (!hydrated.current) return;
    saveTodos(todos);
  }, [todos]);
  useEffect(() => {
    if (!hydrated.current) return;
    saveVideoUrl(videoUrl);
  }, [videoUrl]);
  useEffect(() => {
    if (!hydrated.current) return;
    saveAgents(agents);
  }, [agents]);
  useEffect(() => {
    if (!hydrated.current) return;
    saveOpenApps(openApps);
  }, [openApps]);

  useEffect(() => {
    if (!mochiWorking || isMobile || !talkOpen) {
      setPerch(null);
      return;
    }
    const el = document.querySelector(".desk-talk");
    if (!(el instanceof HTMLElement)) {
      setPerch(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const size = 128 * 0.72;
    setPerch({ x: r.left + r.width * 0.58 - size / 2, y: r.top + 28 });
  }, [mochiWorking, isMobile, talkOpen]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    mobileLogRef.current?.scrollTo({ top: mobileLogRef.current.scrollHeight, behavior: "smooth" });
  }, [petChat, sending]);

  useEffect(() => {
    if (!pomoRunning) return;
    const t = window.setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev > 1) return prev - 1;
        window.clearInterval(t);
        setPomoRunning(false);
        setPomoMode((mode) => {
          const next = mode === "foco" ? "descanso" : "foco";
          const nextTotal = next === "foco" ? 25 * 60 : 5 * 60;
          setPomoTotal(nextTotal);
          setMood(mode === "foco" ? "sleepy" : "happy");
          window.setTimeout(() => setPomoSeconds(nextTotal), 0);
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [pomoRunning]);

  useEffect(() => {
    if (pomoRunning && pomoMode === "foco") setMood("listening");
    if (pomoRunning && pomoMode === "descanso") setMood("sleepy");
  }, [pomoRunning, pomoMode]);

  const pushMochi = useCallback((content: string) => {
    setPetChat((prev) => [
      ...prev,
      { id: uid("mochi"), role: "mochi", content, createdAt: nowIso() },
    ]);
  }, []);

  const applyIntent = useCallback(
    (intent: CompanionIntent) => {
      if (intent.type === "pomodoro") {
        if (intent.action === "pause") setPomoRunning(false);
        else if (intent.action === "reset") {
          setPomoRunning(false);
          setPomoMode("foco");
          setPomoTotal(25 * 60);
          setPomoSeconds(25 * 60);
        } else if (intent.action === "skip") {
          const next = pomoMode === "foco" ? "descanso" : "foco";
          const total = next === "foco" ? 25 * 60 : 5 * 60;
          setPomoMode(next);
          setPomoTotal(total);
          setPomoSeconds(total);
          setPomoRunning(true);
        } else {
          const total = (intent.minutes || 25) * 60;
          setPomoMode("foco");
          setPomoTotal(total);
          setPomoSeconds(total);
          setPomoRunning(true);
        }
      }

      if (intent.type === "todo" && intent.action === "add" && intent.text) {
        setTodos((prev) => [
          ...prev,
          { id: uid("todo"), text: intent.text!, done: false, createdAt: nowIso() },
        ]);
      }
      if (intent.type === "todo" && intent.action === "done" && intent.text) {
        const needle = intent.text.toLowerCase();
        setTodos((prev) =>
          prev.map((item) =>
            !item.done && item.text.toLowerCase().includes(needle) ? { ...item, done: true } : item,
          ),
        );
      }
      if (intent.type === "video") {
        setVideoUrl(intent.url);
        setVideoDraft(intent.url);
      }
      if (intent.type === "message-person") {
        const fromName = seat ? PEOPLE[seat].name : "alguien";
        setPrivateChat((prev) => [
          ...prev,
          {
            id: uid("priv"),
            from: "mochi",
            content: `${PEOPLE[intent.to].name}, ${fromName} me pidió que te diga: ${intent.text}`,
            createdAt: nowIso(),
          },
        ]);
        setMood("delivering");
      }
    },
    [pomoMode, seat],
  );

  const askSiteAgent = useCallback(
    async (message: string, history: CompanionMsg[]) => {
      const chatHistory = history
        .filter((row) => !row.content.startsWith("…"))
        .slice(-10)
        .map((row) => ({
          role: row.role === "user" ? ("user" as const) : ("assistant" as const),
          content: row.content,
        }));
      const payloadMessages = buildSiteMochiChatMessages({
        message,
        history: chatHistory,
        language: "es",
        characterLabel: "Mochi",
        soulMd: COMPANION_SOUL,
      });

      if (config.provider === "ollama") {
        return sendOllamaBrowserChat({
          messages: payloadMessages,
          ollamaUrl: config.ollamaUrl,
          ollamaModel: config.ollamaModel,
        });
      }
      if (config.provider === "bitte") {
        return sendBitteBrowserChat({
          messages: payloadMessages,
          bitteApiKey: config.bitteApiKey,
          bitteAgentId: config.bitteAgentId,
        });
      }
      if (config.provider === "openclaw") {
        return sendOpenClawBrowserChat({
          messages: payloadMessages,
          gatewayUrl: config.openclawGatewayUrl,
          gatewayToken: config.openclawPairedSessionToken || config.openclawGatewayToken,
          agentName: config.openclawPairedAgentName || config.openclawAgentName,
        });
      }
      if (!canUseCurrentProvider) {
        throw new Error(config.provider === "site" ? "NO_CREDITS" : "OPENROUTER_DETAIL:Falta la API key");
      }
      const reply = await streamSiteReply({
        message,
        history: chatHistory,
        lang: "es",
        character: config.character,
        soulMd: COMPANION_SOUL,
        provider: config.provider === "openrouter" ? "openrouter" : "site",
        providerConfig: {
          openrouterApiKey: config.openrouterApiKey,
          openrouterModel: config.openrouterModel,
        },
      });
      if (config.provider === "site") incrementFreeSiteMessagesUsed();
      return reply;
    },
    [canUseCurrentProvider, config, incrementFreeSiteMessagesUsed],
  );

  const canTalkToConfiguredAgent =
    canUseCurrentProvider ||
    config.provider === "ollama" ||
    config.provider === "bitte" ||
    config.provider === "openclaw";

  async function handleTalk(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setComposer("");
    const userMsg: CompanionMsg = {
      id: uid("user"),
      role: "user",
      content: message,
      createdAt: nowIso(),
    };
    const nextHistory = [...petChat, userMsg];
    setPetChat(nextHistory);
    setSending(true);
    setMood("listening");

    const intent = parseCompanionIntent(message);
    applyIntent(intent);

    try {
      if (intent.type === "ask-agent") {
        setMood("thinking");
        try {
          const agentReply = await askSiteAgent(intent.text, nextHistory);
          pushMochi(`El agente del sitio me dijo:\n${agentReply}`);
          setMood("happy");
        } catch (error) {
          pushMochi(
            formatSiteMochiProviderError(error, true, config.provider) +
              " Mientras tanto te hablo yo, sin inventar un botón de conexión.",
          );
          setMood("idle");
        }
        return;
      }

      if (intent.type !== "chat") {
        pushMochi(localMochiReply({ intent, userText: message, seat, todos }));
        setMood(intent.type === "pomodoro" ? "listening" : "happy");
        return;
      }

      if (canTalkToConfiguredAgent) {
        setMood("thinking");
        try {
          const reply = await askSiteAgent(message, nextHistory);
          pushMochi(reply || localMochiReply({ intent, userText: message, seat, todos }));
          setMood("happy");
          return;
        } catch {
          // fall through to local voice
        }
      }

      pushMochi(localMochiReply({ intent, userText: message, seat, todos }));
      setMood("idle");
    } finally {
      setSending(false);
    }
  }

  function onComposer(event: FormEvent) {
    event.preventDefault();
    void handleTalk(composer);
  }

  function addTodo() {
    const text = todoDraft.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { id: uid("todo"), text, done: false, createdAt: nowIso() }]);
    setTodoDraft("");
  }

  function sendPrivate() {
    const text = privateDraft.trim();
    if (!text || !seat) return;
    setPrivateChat((prev) => [
      ...prev,
      { id: uid("priv"), from: seat, content: text, createdAt: nowIso() },
    ]);
    setPrivateDraft("");
  }

  function leaveWorking(id: PersonId) {
    setAgents((prev) => {
      const next = toggleAgentWorking(prev, id, agentLabelDraft);
      saveAgents(next);
      return next;
    });
    setAgentLabelDraft("");
  }

  function toggleApp(id: DeskAppId) {
    setOpenApps((prev) => {
      if (prev.includes(id)) return prev.filter((row) => row !== id);
      setFocusApp(id);
      return [...prev, id];
    });
    setPickerOpen(false);
  }

  function closeApp(id: DeskAppId) {
    setOpenApps((prev) => prev.filter((row) => row !== id));
    setFocusApp((cur) => (cur === id ? null : cur));
  }

  function openTalk() {
    setTalkOpen(true);
    setFocusApp("talk");
    if (isMobile) setMobileTab("mochi");
  }


  const pomoPanel = (
    <section className="companion-card">
      <h2>Pomodoro</h2>
      <PomoRing seconds={pomoSeconds} total={pomoTotal} mode={pomoMode} />
      <div className="pomo-actions">
        <button type="button" onClick={() => setPomoRunning((v) => !v)}>
          {pomoRunning ? "Pausar" : "Arrancar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPomoRunning(false);
            setPomoMode("foco");
            setPomoTotal(25 * 60);
            setPomoSeconds(25 * 60);
          }}
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => {
            const next = pomoMode === "foco" ? "descanso" : "foco";
            const total = next === "foco" ? 25 * 60 : 5 * 60;
            setPomoMode(next);
            setPomoTotal(total);
            setPomoSeconds(total);
            setPomoRunning(true);
          }}
        >
          Saltar
        </button>
      </div>
    </section>
  );

  const todosPanel = (
    <section className="companion-card companion-grow">
      <h2>Notas</h2>
      <div className="todo-row">
        <input
          value={todoDraft}
          onChange={(event) => setTodoDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addTodo();
          }}
          placeholder="Anotá algo…"
        />
        <button type="button" className="ghost-btn" onClick={addTodo}>
          Sumar
        </button>
      </div>
      {todos.length === 0 ? (
        <p className="empty-note">Nada pendiente. Decime “anotá que…” y lo escribo yo.</p>
      ) : (
        <ul className="todo-list">
          {todos.map((item) => (
            <li key={item.id} className={`todo-item${item.done ? " is-done" : ""}`}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  setTodos((prev) =>
                    prev.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)),
                  )
                }
              />
              <span>{item.text}</span>
              <button
                type="button"
                onClick={() => setTodos((prev) => prev.filter((row) => row.id !== item.id))}
              >
                sacar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const videoPanel = (
    <section className="companion-card">
      <h2>Video</h2>
      <VideoFrame url={videoUrl} />
      <div className="video-row">
        <input
          value={videoDraft}
          onChange={(event) => setVideoDraft(event.target.value)}
          placeholder="YouTube o URL"
        />
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setVideoUrl(videoDraft.trim());
          }}
        >
          Poner
        </button>
      </div>
    </section>
  );

  const agentsPanel = (
    <section className="companion-card">
      <h2>Agentes</h2>
      <p className="empty-note">
        Katho y Lulox son personas-agente. Si los dejás trabajando, siguen en este navegador
        aunque cambies de pestaña de esta pieza. No hay workers en la nube: si cerrás la
        pestaña del browser, se pausan.
      </p>
      <div className="agent-label-row">
        <input
          value={agentLabelDraft}
          onChange={(event) => setAgentLabelDraft(event.target.value)}
          placeholder="En qué están (opcional)"
        />
      </div>
      <div className="agent-desks">
        {agents.map((agent) => (
          <article key={agent.id} className={`agent-desk${agent.working ? " is-working" : ""}`}>
            <div className="agent-desk-chrome">
              <span className="traffic" aria-hidden />
              <span className="desk-title">{PEOPLE[agent.id].name}</span>
            </div>
            <div className="agent-desk-screen">
              {agent.working ? (
                <CompanionWorkingSprite facingRight={agent.id === "lulox"} />
              ) : (
                <p className="desk-idle">compu apagada</p>
              )}
            </div>
            <div className="agent-desk-meta">
              <strong>{agent.working ? "Trabajando" : "Idle"}</strong>
              {agent.working ? (
                <span>
                  {agent.label || "en la compu"} · {formatWorkClock(agent.ticks)}
                </span>
              ) : (
                <span>puede deambular</span>
              )}
              <button type="button" className="ghost-btn" onClick={() => leaveWorking(agent.id)}>
                {agent.working ? "Dejar idle" : "Dejar trabajando"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const privatePanel = (
    <section className="companion-card companion-grow">
      <h2>DM · Katho y Lulox</h2>
      <div className="seat-row">
        {(["katho", "lulox"] as PersonId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`seat-btn${seat === id ? " is-on" : ""}`}
            onClick={() => setSeat(id)}
          >
            Soy {PEOPLE[id].name}
          </button>
        ))}
      </div>
      {privateChat.length === 0 ? (
        <p className="empty-note">
          Un solo chat, entre Katho y Lulox. Vive en este navegador: no hay servidor ni GitHub
          OAuth todavía, para no pedirte infra nueva. Si están en la misma compu se ven. Si no,
          pedime a mí: “decile a {seat ? PEOPLE[otherPerson(seat)].name : "Katho"} que…”.
        </p>
      ) : (
        <div className="private-log">
          {privateChat.map((row) => (
            <div key={row.id} className={`private-msg from-${row.from}`}>
              <span className="who">{row.from === "mochi" ? "Mochi" : PEOPLE[row.from].name}</span>
              {row.content}
            </div>
          ))}
        </div>
      )}
      <div className="private-composer">
        <input
          value={privateDraft}
          onChange={(event) => setPrivateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendPrivate();
          }}
          placeholder={seat ? `Escribir como ${PEOPLE[seat].name}` : "Elegí quién sos"}
          disabled={!seat}
        />
        <button type="button" className="ghost-btn" onClick={sendPrivate} disabled={!seat}>
          Enviar
        </button>
      </div>
    </section>
  );

  const composerForm = (
    <form className="companion-composer" onSubmit={onComposer}>
      <textarea
        value={composer}
        onChange={(event) => setComposer(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleTalk(composer);
          }
        }}
        placeholder="Hablale a ella…"
        rows={2}
        aria-label="Mensaje para Mochi"
      />
      <button type="submit" disabled={sending || !composer.trim()}>
        {sending ? "…" : "Decile"}
      </button>
    </form>
  );

  const speech = (
    <div className="speech-stack" ref={logRef} aria-live="polite">
      {petChat.length === 0 ? (
        <div className="speech-bubble mochi">
          Hola. Soy Mochi. Hablame, che. Si querés que le deje un recado a Katho o a Lulox, lo
          llevo yo. El agente del sitio lo uso si me lo pedís — no hay botón falso de conexión.
        </div>
      ) : (
        petChat.slice(-12).map((row) => (
          <div key={row.id} className={`speech-bubble ${row.role === "mochi" ? "mochi" : "user"}`}>
            {row.content}
          </div>
        ))
      )}
    </div>
  );

  const conectar = !canTalkToConfiguredAgent ? (
    <p className="connect-note">
      Para hablar con el agente del sitio (OpenRouter, Ollama, Bitte, OpenClaw o créditos)
      conectalo en ajustes. Yo igual te escucho acá.
      <Link href="/settings" className="conectar-btn">
        Conectar
      </Link>
    </p>
  ) : null;

  const panelFor = (id: DeskAppId) => {
    if (id === "pomo") return pomoPanel;
    if (id === "notas") return todosPanel;
    if (id === "video") return videoPanel;
    if (id === "dm") return privatePanel;
    return agentsPanel;
  };

  if (isMobile === null) {
    return <div className="companion-root" data-companion-surface />;
  }

  return (
    <div className="companion-root" data-companion-surface>
      <CompanionWanderer
        working={mochiWorking}
        perch={perch}
        scale={isMobile ? 0.55 : 0.72}
        onClick={openTalk}
      />
      <Link href="/" className="companion-back">
        ← al sitio
      </Link>

      {isMobile ? null : (
        <div className="companion-desktop">
          {openApps.map((id) => {
            const meta = DESK_APPS.find((row) => row.id === id);
            if (!meta) return null;
            return (
              <DeskWindow
                key={id}
                appId={id}
                title={meta.label}
                focused={focusApp === id}
                onFocus={() => setFocusApp(id)}
                onClose={() => closeApp(id)}
              >
                {panelFor(id)}
              </DeskWindow>
            );
          })}

          {talkOpen ? (
            <section
              className={`desk-window desk-talk${focusApp === "talk" ? " is-focus" : ""}`}
              onPointerDown={() => setFocusApp("talk")}
              role="dialog"
              aria-label="Hablar con Mochi"
            >
              <header className="desk-window-chrome">
                <span className="traffic" aria-hidden />
                <span>Mochi</span>
                <button
                  type="button"
                  className="desk-close"
                  onClick={() => setTalkOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>
              <div className="desk-window-body desk-talk-body">
                {speech}
                {conectar}
                {composerForm}
              </div>
            </section>
          ) : null}

          {pickerOpen ? (
            <div className="desk-picker" role="menu" aria-label="Miniapps">
              {DESK_APPS.map((app) => {
                const open = openApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    type="button"
                    className={open ? "is-on" : ""}
                    onClick={() => toggleApp(app.id)}
                  >
                    {open ? "Quitar" : "Sumar"} {app.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <nav className="desk-dock" aria-label="Dock del escritorio">
            {openApps.map((id) => {
              const meta = DESK_APPS.find((row) => row.id === id);
              if (!meta) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={focusApp === id ? "is-on" : ""}
                  onClick={() => setFocusApp(id)}
                >
                  {meta.label}
                </button>
              );
            })}
            <button
              type="button"
              className={`desk-plus${pickerOpen ? " is-on" : ""}`}
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Agregar o quitar miniapps"
            >
              +
            </button>
          </nav>
        </div>
      )}

      {isMobile ? (
        <div className="companion-mobile">
          {mobileTab === "mochi" ? (
            <div className="mobile-mochi">
              <div className="mobile-log" ref={mobileLogRef} aria-live="polite">
                {petChat.length === 0 ? (
                  <div className="speech-bubble mochi">
                    Tocame y hablame. El resto vive en el dock de abajo, no en un escritorio
                    achicado.
                  </div>
                ) : (
                  petChat.slice(-20).map((row) => (
                    <div
                      key={row.id}
                      className={`speech-bubble ${row.role === "mochi" ? "mochi" : "user"}`}
                    >
                      {row.content}
                    </div>
                  ))
                )}
              </div>
              {conectar}
              {composerForm}
            </div>
          ) : (
            <div className="mobile-sheet">
              {mobileTab === "pomo" ? pomoPanel : null}
              {mobileTab === "notas" ? todosPanel : null}
              {mobileTab === "video" ? videoPanel : null}
              {mobileTab === "dm" ? (
                <>
                  {agentsPanel}
                  {privatePanel}
                </>
              ) : null}
            </div>
          )}
          <nav className="mobile-dock" aria-label="Pieza móvil">
            {(
              [
                ["mochi", "Mochi"],
                ["pomo", "Pomo"],
                ["notas", "Notas"],
                ["video", "Video"],
                ["dm", "Chat"],
              ] as Array<[MobileTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={mobileTab === id ? "is-on" : ""}
                onClick={() => setMobileTab(id)}
              >
                <span className="dock-label">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
