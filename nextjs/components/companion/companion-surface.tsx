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
import {
  COMPANION_SOUL,
  COMPANION_STORAGE,
  DESK_APPS,
  PEOPLE,
  PERSONAS,
  type AgentJob,
  type CompanionIntent,
  type CompanionMsg,
  type DeskAppId,
  type PersonId,
  type PetMood,
  type PrivateMsg,
  type TodoItem,
  formatWorkClock,
  loadAgents,
  loadOpenApps,
  loadPetChat,
  loadPrivateChat,
  loadSeat,
  loadTodos,
  loadVideoUrl,
  localAgentReply,
  localMochiReply,
  nextMascotAlert,
  otherPerson,
  parseCompanionIntent,
  pickLuloxMood,
  saveAgents,
  saveOpenApps,
  savePetChat,
  savePrivateChat,
  saveSeat,
  saveTodos,
  saveVideoUrl,
  simulateIncomingDm,
  startCompanionRuntime,
  toggleAgentWorking,
  uid,
  nowIso,
} from "@/lib/companion/companion-core";
import {
  GROK_CONSOLE_KEYS,
  buildGrokChatRequest,
  buildGrokConnectUrl,
  connectGrokWithKey,
  disconnectGrok,
  emptyGrokSession,
  grokReplyFromPayload,
  isGrokConnected,
  loadGrokSession,
  saveGrokSession,
  type GrokSession,
} from "@/lib/companion/grok-connect";
import { RADIO_STATIONS, radioStationById, type RadioStationId } from "@/lib/companion/radio";
import {
  YT_STARTERS,
  clipFromId,
  enqueueClip,
  extractYouTubeId,
  pushUniqueClip,
  takeNextClip,
  youtubeEmbedUrl,
  youtubeOembedUrl,
  type YtClip,
} from "@/lib/companion/youtube";

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

async function askGrok(args: {
  apiKey: string;
  soul: string;
  message: string;
  history: CompanionMsg[];
  characterLabel: string;
}): Promise<string> {
  const chatHistory = args.history
    .filter((row) => !row.content.startsWith("…"))
    .slice(-10)
    .map((row) => ({
      role: (row.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: row.content,
    }));
  const built = buildGrokChatRequest({
    apiKey: args.apiKey,
    messages: [
      {
        role: "system",
        content: `${args.soul}\n\nCharacter: ${args.characterLabel}. Español rioplatense. Respuestas cortas.`,
      },
      ...chatHistory,
      { role: "user", content: args.message },
    ],
  });
  const response = await fetch("/api/companion/grok", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({ messages: built.body.messages }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "GROK_FAILED");
  }
  return grokReplyFromPayload(json) || (typeof json?.reply === "string" ? json.reply : "");
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

function RadioPlayer({ stationId }: { stationId: RadioStationId }) {
  const station = radioStationById(stationId);
  useEffect(() => {
    if (station.kind === "off") return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    let stop: (() => void) | null = null;
    if (station.kind === "brown") {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(master);
      src.start();
      stop = () => src.stop();
    } else {
      const burst = () => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = station.kind === "rain" ? "sawtooth" : "sine";
        osc.frequency.value = station.kind === "rain" ? 180 + Math.random() * 900 : 90 + Math.random() * 40;
        g.gain.value = station.kind === "rain" ? 0.04 : 0.08;
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + (station.kind === "rain" ? 0.08 : 1.6));
      };
      burst();
      const id = window.setInterval(burst, station.kind === "rain" ? 70 : 1600);
      stop = () => window.clearInterval(id);
    }
    return () => {
      stop?.();
      void ctx.close();
    };
  }, [station.kind]);
  return (
    <p className="empty-note">
      {station.kind === "off" ? "Silencio." : `Sonando: ${station.label}.`}
    </p>
  );
}

function VideoFrame({ clip }: { clip: YtClip | null }) {
  if (clip) {
    return (
      <div className="video-stage">
        <iframe
          title={clip.title || "YouTube"}
          src={youtubeEmbedUrl(clip.id)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <p className="empty-note">
      Explorá YouTube: pegá un link, un ID, o buscá. Hay recents, cola y unas radios lofi para
      arrancar. No invento una playlist tuya.
    </p>
  );
}

export function CompanionSurface() {
  const isMobile = useIsMobile();
  const [seat, setSeat] = useState<PersonId | null>(null);
  const [petChat, setPetChat] = useState<CompanionMsg[]>([]);
  const [privateChat, setPrivateChat] = useState<PrivateMsg[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDraft, setVideoDraft] = useState("");
  const [ytNow, setYtNow] = useState<YtClip | null>(null);
  const [ytRecents, setYtRecents] = useState<YtClip[]>([]);
  const [ytQueue, setYtQueue] = useState<YtClip[]>([]);
  const [ytHits, setYtHits] = useState<YtClip[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
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
  const [agentAskDraft, setAgentAskDraft] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("mochi");
  const [talkOpen, setTalkOpen] = useState(false);
  const [talkWith, setTalkWith] = useState<"mochi" | "lulox">("mochi");
  const [openApps, setOpenApps] = useState<DeskAppId[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusApp, setFocusApp] = useState<DeskAppId | "talk" | null>(null);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoTotal, setPomoTotal] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoMode, setPomoMode] = useState<"foco" | "descanso">("foco");
  const [grok, setGrok] = useState<GrokSession>(emptyGrokSession());
  const [grokKeyDraft, setGrokKeyDraft] = useState("");
  const [radioId, setRadioId] = useState<RadioStationId>("silencio");
  const [mascotAlert, setMascotAlert] = useState<string | null>(null);
  const [luloxMood, setLuloxMood] = useState<"neutral" | "happy" | "negative">("neutral");
  const hydrated = useRef(false);
  const seenDmRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const mobileLogRef = useRef<HTMLDivElement | null>(null);
  const grokOn = isGrokConnected(grok);
  const mochiWorking = sending || mood === "thinking";
  const kathoWorking = agents.some((row) => row.id === "katho" && row.working);
  const luloxWorking = agents.some((row) => row.id === "lulox" && row.working);

  useEffect(() => {
    setSeat(loadSeat());
    setPetChat(loadPetChat());
    const priv = loadPrivateChat();
    setPrivateChat(priv);
    seenDmRef.current = priv.length ? priv[priv.length - 1].id : null;
    setTodos(loadTodos());
    setAgents(loadAgents());
    setOpenApps(loadOpenApps());
    const storedVideo = loadVideoUrl();
    setVideoUrl(storedVideo);
    setVideoDraft(storedVideo);
    const ytId = extractYouTubeId(storedVideo);
    if (ytId) setYtNow(clipFromId(ytId));
    const session = loadGrokSession();
    setGrok(session);
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
    const id = extractYouTubeId(videoUrl);
    if (id) setYtNow((cur) => (cur?.id === id ? cur : clipFromId(id, cur?.title || "")));
  }, [videoUrl]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveGrokSession(grok);
  }, [grok]);

  useEffect(() => {
    if (!hydrated.current) return;
    const result = nextMascotAlert({
      messages: privateChat,
      seat,
      lastSeenId: seenDmRef.current,
    });
    if (result.kind === "alert") {
      const who = result.message.from === "mochi" ? "Mochi" : PEOPLE[result.message.from].name;
      setMascotAlert(`${who} te escribió`);
      setMood("delivering");
      window.setTimeout(() => setMascotAlert(null), 5000);
    }
    if (privateChat.length) {
      seenDmRef.current = privateChat[privateChat.length - 1].id;
    }
  }, [privateChat, seat]);
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

  async function playClip(clip: YtClip) {
    setYtNow(clip);
    setVideoUrl(`https://www.youtube.com/watch?v=${clip.id}`);
    setVideoDraft(`https://www.youtube.com/watch?v=${clip.id}`);
    setYtRecents((prev) => pushUniqueClip(prev, clip));
    if (!clip.title || clip.title === clip.id) {
      try {
        const res = await fetch(youtubeOembedUrl(clip.id));
        const json = await res.json();
        if (typeof json?.title === "string") {
          const titled = { ...clip, title: json.title };
          setYtNow(titled);
          setYtRecents((prev) => pushUniqueClip(prev, titled));
        }
      } catch {
        // oembed is optional
      }
    }
  }

  async function searchYoutube(query: string) {
    const q = query.trim();
    const asId = extractYouTubeId(q);
    if (asId) {
      await playClip(clipFromId(asId));
      return;
    }
    if (q.length < 2) return;
    setYtSearching(true);
    try {
      const res = await fetch(`/api/companion/youtube?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const clips = Array.isArray(json?.clips) ? (json.clips as YtClip[]) : [];
      setYtHits(clips);
    } catch {
      setYtHits([]);
    } finally {
      setYtSearching(false);
    }
  }

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
      if (intent.type === "ask-person-agent") {
        setMood("thinking");
        const persona = PERSONAS[intent.to];
        const working = agents.some((row) => row.id === intent.to && row.working);
        let reply = localAgentReply({ person: intent.to, userText: intent.text, working });
        if (grokOn && grok.apiKey) {
          try {
            reply = await askGrok({
              apiKey: grok.apiKey,
              soul: persona.soul,
              message: intent.text,
              history: nextHistory,
              characterLabel: persona.agentName,
            });
          } catch {
            // local voice already set
          }
        }
        if (intent.to === "lulox") setLuloxMood(pickLuloxMood(intent.text + " " + reply));
        pushMochi(`El agente de ${persona.name} me dijo:\n${reply}`);
        setMood("happy");
        return;
      }

      if (intent.type === "ask-agent") {
        setMood("thinking");
        if (grokOn && grok.apiKey) {
          try {
            const agentReply = await askGrok({
              apiKey: grok.apiKey,
              soul: COMPANION_SOUL,
              message: intent.text,
              history: nextHistory,
              characterLabel: "Mochi",
            });
            pushMochi(agentReply);
            setMood("happy");
            return;
          } catch {
            pushMochi("Grok no contestó ahora. Te hablo yo, sin inventar un botón.");
            setMood("idle");
            return;
          }
        }
        pushMochi("Para eso hace falta Conectar Grok. El botón de abajo es el flujo de verdad, en accounts.x.ai.");
        setMood("idle");
        return;
      }

      if (intent.type !== "chat") {
        pushMochi(localMochiReply({ intent, userText: message, seat, todos }));
        setMood(intent.type === "pomodoro" ? "listening" : "happy");
        return;
      }

      if (grokOn && grok.apiKey) {
        setMood("thinking");
        const persona = talkWith === "lulox" ? PERSONAS.lulox : PERSONAS.katho;
        try {
          const reply = await askGrok({
            apiKey: grok.apiKey,
            soul: talkWith === "lulox" ? persona.soul : COMPANION_SOUL,
            message,
            history: nextHistory,
            characterLabel: talkWith === "lulox" ? "Lulox" : "Mochi",
          });
          if (talkWith === "lulox") setLuloxMood(pickLuloxMood(message + " " + reply));
          pushMochi(reply || localMochiReply({ intent, userText: message, seat, todos }));
          setMood("happy");
          return;
        } catch {
          // fall through to local voice
        }
      }

      if (talkWith === "lulox") {
        const reply = localAgentReply({ person: "lulox", userText: message, working: luloxWorking });
        setLuloxMood(pickLuloxMood(message + " " + reply));
        pushMochi(reply);
      } else {
        pushMochi(localMochiReply({ intent, userText: message, seat, todos }));
      }
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

  function openTalk(who: "mochi" | "lulox" = "mochi") {
    setTalkWith(who);
    setTalkOpen(true);
    setFocusApp("talk");
    if (isMobile) setMobileTab("mochi");
  }

  function applyGrokKey() {
    const next = connectGrokWithKey(grokKeyDraft);
    if (!next.apiKey) return;
    setGrok(next);
    saveGrokSession(next);
    setGrokKeyDraft("");
  }

  function dropGrok() {
    const next = disconnectGrok();
    setGrok(next);
    saveGrokSession(next);
  }

  function askOtherAgent(from: PersonId) {
    const text = agentAskDraft.trim();
    if (!text) return;
    const to = otherPerson(from);
    const reply = localAgentReply({
      person: to,
      userText: text,
      working: agents.some((row) => row.id === to && row.working),
    });
    if (to === "lulox") setLuloxMood(pickLuloxMood(text + " " + reply));
    setPrivateChat((prev) => [
      ...prev,
      {
        id: uid("priv"),
        from: "mochi",
        content: `El agente de ${PEOPLE[from].name} le preguntó al agente de ${PEOPLE[to].name}: ${text}\n— ${reply}`,
        createdAt: nowIso(),
      },
    ]);
    setAgentAskDraft("");
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
    <section className="companion-card yt-explorer">
      <h2>YouTube</h2>
      <VideoFrame clip={ytNow} />
      {ytNow ? <p className="yt-now-title">{ytNow.title}</p> : null}
      <div className="video-row">
        <input
          value={videoDraft}
          onChange={(event) => setVideoDraft(event.target.value)}
          placeholder="Buscar, pegar URL o ID"
          onKeyDown={(event) => {
            if (event.key === "Enter") void searchYoutube(videoDraft);
          }}
        />
        <button type="button" className="ghost-btn" onClick={() => void searchYoutube(videoDraft)}>
          {ytSearching ? "…" : "Buscar"}
        </button>
      </div>
      <div className="yt-actions">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            const { next, rest } = takeNextClip(ytQueue);
            setYtQueue(rest);
            if (next) void playClip(next);
          }}
          disabled={!ytQueue.length}
        >
          Siguiente
        </button>
      </div>
      {ytHits.length ? (
        <div className="yt-row">
          <span className="yt-label">Resultados</span>
          <div className="yt-thumbs">
            {ytHits.map((clip) => (
              <button key={clip.id} type="button" className="yt-thumb" onClick={() => void playClip(clip)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clip.thumb} alt="" />
                <span>{clip.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="yt-row">
        <span className="yt-label">Para arrancar</span>
        <div className="yt-thumbs">
          {YT_STARTERS.map((clip) => (
            <button key={clip.id} type="button" className="yt-thumb" onClick={() => void playClip(clip)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clip.thumb} alt="" />
              <span>{clip.title}</span>
            </button>
          ))}
        </div>
      </div>
      {ytRecents.length ? (
        <div className="yt-row">
          <span className="yt-label">Recientes</span>
          <div className="yt-thumbs">
            {ytRecents.slice(0, 6).map((clip) => (
              <button
                key={clip.id}
                type="button"
                className="yt-thumb"
                onClick={() => {
                  setYtQueue((q) => enqueueClip(q, clip));
                  void playClip(clip);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clip.thumb} alt="" />
                <span>{clip.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );

  const radioPanel = (
    <section className="companion-card">
      <h2>Radio</h2>
      <p className="empty-note">
        Sonidos de foco para el escritorio. Nada de stream inventado: se arman acá, en el
        navegador.
      </p>
      <div className="radio-list">
        {RADIO_STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            className={`radio-btn${radioId === station.id ? " is-on" : ""}`}
            onClick={() => setRadioId(station.id)}
          >
            <strong>{station.label}</strong>
            <span>{station.hint}</span>
          </button>
        ))}
      </div>
      <RadioPlayer stationId={radioId} />
    </section>
  );

  const agentsPanel = (
    <section className="companion-card">
      <h2>Agentes</h2>
      <p className="empty-note">
        Katho (ella) y Lulox (él) son personas-agente. Los dos. Si los dejás trabajando, siguen
        en este navegador. Cada uno puede hablarle al agente del otro. No hay workers en la
        nube: si cerrás la pestaña, se pausan.
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
              <span className="desk-title">
                {PEOPLE[agent.id].name} · {PERSONAS[agent.id].kind === "ninja-cat" ? "gato ninja" : "Mochi"}
              </span>
            </div>
            <div className="agent-desk-screen">
              {agent.working ? (
                <CompanionWorkingSprite
                  pack={PERSONAS[agent.id].spritePack}
                  facingRight={agent.id === "lulox"}
                  emotion={agent.id === "lulox" ? luloxMood : "neutral"}
                />
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
              <button type="button" className="ghost-btn" onClick={() => askOtherAgent(agent.id)}>
                Preguntarle al agente de {PEOPLE[otherPerson(agent.id)].name}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="agent-label-row">
        <input
          value={agentAskDraft}
          onChange={(event) => setAgentAskDraft(event.target.value)}
          placeholder="Qué le preguntás al agente del otro…"
        />
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
      <button
        type="button"
        className="ghost-btn"
        onClick={() => {
          if (!seat) return;
          const from = otherPerson(seat);
          setPrivateChat((prev) => [
            ...prev,
            simulateIncomingDm(from, `Hola ${PEOPLE[seat].name}, te escribo yo.`),
          ]);
        }}
        disabled={!seat}
      >
        Simular que el otro escribió
      </button>
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
        placeholder={talkWith === "lulox" ? "Hablale a él…" : "Hablale a ella…"}
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
          Hola. Soy Mochi, tu compañera. Hablame, che. Si querés que le deje un recado a Katho o
          a Lulox, lo llevo yo. Si no hay Grok conectado, el botón Conectar abre accounts.x.ai
          de verdad.
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

  const grokReturnTo =
    typeof window === "undefined" ? "https://grok.com/" : `${window.location.origin}/companion?grok=return`;
  const grokConnectHref = buildGrokConnectUrl({ returnTo: grokReturnTo });

  const conectar = grokOn ? (
    <p className="connect-note">
      Grok está conectado.
      <button type="button" className="ghost-btn" onClick={dropGrok}>
        Salir
      </button>
    </p>
  ) : (
    <div className="connect-note">
      <p>
        Para hablar con Grok hace falta una cuenta de xAI. El botón abre el flujo real en
        accounts.x.ai — no es un atajo a ajustes.
      </p>
      <a className="conectar-btn" href={grokConnectHref}>
        Conectar Grok
      </a>
      <p className="empty-note">
        Cuando vuelvas, pegá la clave de{" "}
        <a href={GROK_CONSOLE_KEYS} target="_blank" rel="noreferrer">
          console.x.ai
        </a>
        .
      </p>
      <div className="todo-row">
        <input
          value={grokKeyDraft}
          onChange={(event) => setGrokKeyDraft(event.target.value)}
          placeholder="xai-…"
          autoComplete="off"
        />
        <button type="button" className="ghost-btn" onClick={applyGrokKey}>
          Guardar
        </button>
      </div>
    </div>
  );

  const panelFor = (id: DeskAppId) => {
    if (id === "pomo") return pomoPanel;
    if (id === "notas") return todosPanel;
    if (id === "video") return videoPanel;
    if (id === "radio") return radioPanel;
    if (id === "dm") return privatePanel;
    return agentsPanel;
  };

  if (isMobile === null) {
    return <div className="companion-root" data-companion-surface />;
  }

  return (
    <div className="companion-root" data-companion-surface>
      <CompanionWanderer
        working={mochiWorking || kathoWorking}
        perch={perch}
        scale={isMobile ? 0.55 : 0.72}
        pack="mochi"
        alertText={mascotAlert}
        onClick={() => openTalk("mochi")}
      />
      {isMobile ? null : (
        <CompanionWanderer
          working={luloxWorking}
          perch={null}
          scale={0.62}
          pack="lulox"
          label="Lulox, el gato ninja"
          onClick={() => openTalk("lulox")}
        />
      )}
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
              aria-label={talkWith === "lulox" ? "Hablar con Lulox" : "Hablar con Mochi"}
            >
              <header className="desk-window-chrome">
                <span className="traffic" aria-hidden />
                <span>{talkWith === "lulox" ? "Lulox" : "Mochi"}</span>
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
              {mobileTab === "video" ? (
                <>
                  {videoPanel}
                  {radioPanel}
                </>
              ) : null}
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
