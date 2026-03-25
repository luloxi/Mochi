"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./site-mochi-mascot.module.css";
import { useLanguage } from "@/components/language-provider";
import { useSiteMochi } from "@/components/site-mochi-provider";
import { buildSiteMochiChatMessages } from "@/lib/site-mochi-chat";
import {
  formatSiteMochiProviderError,
  sendOllamaBrowserChat,
  sendBitteBrowserChat,
} from "@/lib/site-mochi-browser-providers";
import {
  SITE_MOCHI_CHAT_DEFAULT_HEIGHT_PX,
  SITE_MOCHI_CHAT_FONT_SIZE_MAP,
  SITE_MOCHI_CHAT_MIN_HEIGHT_PX,
  SITE_MOCHI_CHAT_MIN_WIDTH_PX,
  SITE_MOCHI_CHAT_RESIZE_EDGE_PX,
  SITE_MOCHI_CHAT_WIDTH_MAP,
} from "@/lib/site-mochi-chat-ui";
import { PREVIEW_ANIMATION_SETS } from "@/lib/mochi-sprite-spec";

type Role = "user" | "assistant";
type Msg = {
  role: Role;
  content: string;
  ctaHref?: string;
  ctaLabel?: string;
  createdAt?: string;
  streaming?: boolean;
};
type VoiceStatusTone = "info" | "error";
type BubbleResizeCursor = "" | "w-resize" | "e-resize" | "n-resize" | "nw-resize" | "ne-resize";

type BrowserSpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isSafeHref(rawHref: string): boolean {
  const href = rawHref.trim();
  return /^https?:\/\//i.test(href);
}

function renderInlineMarkdown(content: string): ReactNode[] {
  const pattern =
    /(\*\*[^*\n](?:[\s\S]*?[^*\n])?\*\*|__(?:[^_\n]|_[^_\n])*__|\*(?:[^*\n]|\*\*?[^*\n])+\*|_(?:[^_\n]|__?[^_\n])+_|`[^`\n]+`|\[(.*?)\]\((https?:\/\/[^\s)]+)\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const token = match[0];
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("__") && token.endsWith("__")) {
      nodes.push(<strong key={`${match.index}-strong2`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      nodes.push(<em key={`${match.index}-em2`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[") && match[2] && match[3] && isSafeHref(match[3])) {
      nodes.push(
        <a
          key={`${match.index}-link`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className={styles.msgInlineLink}
        >
          {match[2]}
        </a>,
      );
    } else {
      nodes.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

function renderMessageContent(content: string): ReactNode {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim().length > 0);

  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n");
    const isList = lines.every((line) => /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(line));

    if (isList) {
      return (
        <ul key={`block-${blockIndex}`} className={styles.msgList}>
          {lines.map((line, itemIndex) => {
            const text = line.replace(/^(\s*[-*]\s+|\s*\d+\.\s+)/, "");
            return (
              <li key={`item-${blockIndex}-${itemIndex}`}>
                {renderInlineMarkdown(text)}
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <p key={`block-${blockIndex}`} className={styles.msgParagraph}>
        {lines.map((line, lineIndex) => (
          <Fragment key={`line-${blockIndex}-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}

function getSpeechRecognitionConstructor():
  | (new () => BrowserSpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const maybeCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return typeof maybeCtor === "function" ? maybeCtor : null;
}

function getSpeechLocale(language: string) {
  return language === "es" ? "es-ES" : "en-US";
}

function parseSseEventBlock(block: string) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataParts: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).replace(/^\s/, ""));
    }
  }

  return { event, data: dataParts.join("\n").trim() };
}

async function fetchWebSearchToolContext(args: { query: string; braveApiKey: string }) {
  const query = args.query.trim();
  const apiKey = args.braveApiKey.trim();
  if (!query || !apiKey) return "";

  const response = await fetch("/api/site-mochi/tools/web-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      apiKey,
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const errorCode = typeof json?.error === "string" ? json.error : "BRAVE_SEARCH_FAILED";
    throw new Error(errorCode);
  }
  return typeof json?.context === "string" ? json.context.trim() : "";
}

async function streamMochiChatReply(args: {
  body: Record<string, unknown>;
  onDelta: (delta: string) => void;
}) {
  const response = await fetch("/api/mochi-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.body),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const json = await response.json().catch(() => null);
    const reply = typeof json?.reply === "string" ? json.reply.trim() : "";
    if (!response.ok || !reply) {
      const errorCode = typeof json?.error === "string" ? json.error : "bad-response";
      const errorStatus =
        typeof json?.status === "number" || typeof json?.status === "string"
          ? String(json.status).trim()
          : "";
      const errorDetails = typeof json?.details === "string" ? json.details.trim().slice(0, 240) : "";
      if (errorCode === "OpenRouter request failed" && errorDetails) {
        throw new Error(`OPENROUTER_DETAIL:${errorDetails}`);
      }
      if (errorCode === "OpenRouter request failed" && errorStatus) {
        throw new Error(`OPENROUTER_DETAIL:HTTP ${errorStatus}`);
      }
      throw new Error(errorCode);
    }
    return reply;
  }

  if (!response.body) {
    throw new Error("STREAM_UNAVAILABLE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";

  const processBlock = (block: string) => {
    const { event, data } = parseSseEventBlock(block);
    if (!data) return false;

    if (event === "token") {
      let payload: any = null;
      try {
        payload = JSON.parse(data);
      } catch {
        return false;
      }
      const delta = typeof payload?.text === "string" ? payload.text : "";
      if (delta) {
        reply += delta;
        args.onDelta(delta);
      }
      return false;
    }

    if (event === "done") {
      let payload: any = null;
      try {
        payload = JSON.parse(data);
      } catch {
        return false;
      }
      if (typeof payload?.reply === "string" && payload.reply.trim()) {
        reply = payload.reply.trim();
      }
      return true;
    }

    if (event === "error") {
      let payload: any = null;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error("STREAM_ERROR");
      }
      const errorCode = typeof payload?.error === "string" ? payload.error : "STREAM_ERROR";
      const errorStatus =
        typeof payload?.status === "number" || typeof payload?.status === "string"
          ? String(payload.status).trim()
          : "";
      const errorDetails = typeof payload?.details === "string" ? payload.details.trim().slice(0, 240) : "";
      if (errorCode === "OpenRouter request failed" && errorDetails) {
        throw new Error(`OPENROUTER_DETAIL:${errorDetails}`);
      }
      if (errorCode === "OpenRouter request failed" && errorStatus) {
        throw new Error(`OPENROUTER_DETAIL:HTTP ${errorStatus}`);
      }
      throw new Error(errorCode);
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
      const finished = processBlock(block);
      if (finished) return reply.trim();
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    processBlock(buffer.replace(/\r\n/g, "\n"));
  }

  return reply.trim();
}

const SPRITE_SIZE = 72;
const EDGE_MARGIN = 0;
const GRAVITY = 980;
const WALK_SPEED = 40;
const CLIMB_SPEED = 76;
const FALL_START_Y = -SPRITE_SIZE;
const SPARKLE_DURATION = 380;
const MOBILE_BREAKPOINT = 768;
const CHAT_GAP = 12;
const MASCOT_HINT_TEXT = "🐱 Click me";
const WALK_PAUSE_MIN_MS = 1600;
const WALK_PAUSE_MAX_MS = 4500;
const WALK_SEGMENT_MIN_MS = 1400;
const WALK_SEGMENT_MAX_MS = 3200;
const WALK_PAUSE_REVERSE_CHANCE = 0.3;
const WALL_DIRECTION_FLIP_CHANCE = 0.15;
const CEILING_DESCEND_WALL_CHANCE = 0.72;
const CURSOR_NEAR_DIST = 70;
const CURSOR_STEER_DIST = 300;
const MOCHI_DESKTOP_WINDOW_EVENT = "mochi:desktop-window-state";
const SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY = "site-mochi-chat-history-v1";
const SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT = "site-mochi:chat-history-updated";
const MAX_STORED_CHAT_MESSAGES = 40;

type Edge = "bottom" | "right" | "top" | "left";
type MascotState = "falling" | "floor-walking" | "wall-climbing" | "ceiling-walking";
type WallSide = "left" | "right";

const NEJO_HACKATHON_KEY = "mochi";

class NejoHackathonMotionPolicy {
  readonly active: boolean;
  private readonly sprites: Set<string>;

  constructor(characterKey: string, availableSpriteFiles?: string[] | null) {
    this.active =
      String(characterKey || "").trim().toLowerCase() === NEJO_HACKATHON_KEY;
    this.sprites = new Set(
      (availableSpriteFiles || [])
        .map((file) => file.trim().toLowerCase())
        .filter((file) => Boolean(file)),
    );
  }

  // Temporary policy for the Nejo hackathon mochi until we finish the sprite set.
  resolveMovementState(state: MascotState): MascotState {
    if (!this.active) return state;
    if (state === "wall-climbing" || state === "ceiling-walking") {
      return "floor-walking";
    }
    return state;
  }

  hasSprite(fileName: string): boolean {
    if (!this.active) return true;
    const normalized = String(fileName || "").trim().toLowerCase();
    return normalized.length > 0 && this.sprites.has(normalized);
  }

  getAnimationFiles(files: readonly string[], fallback: readonly string[]): string[] {
    if (!this.active) return Array.from(files);
    const filtered = files.filter((file) => this.hasSprite(file));
    return filtered.length ? filtered : Array.from(fallback);
  }
}

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  pos: { x: number; y: number };
};

type WanderPauseState = {
  nextPauseAt: number;
  pauseUntil: number;
  lastMovementState: MascotState | null;
};

type BubbleResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
  left: boolean;
  right: boolean;
  top: boolean;
};

function sanitizeStoredMessages(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];

  const out: Msg[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const role = (item as any).role;
    const content = typeof (item as any).content === "string" ? (item as any).content.slice(0, 4000) : "";
    const ctaHref = typeof (item as any).ctaHref === "string" ? (item as any).ctaHref.slice(0, 512) : undefined;
    const ctaLabel =
      typeof (item as any).ctaLabel === "string" ? (item as any).ctaLabel.slice(0, 120) : undefined;
    const createdAtRaw = typeof (item as any).createdAt === "string" ? (item as any).createdAt : "";
    const createdAt = createdAtRaw && Number.isFinite(Date.parse(createdAtRaw)) ? new Date(createdAtRaw).toISOString() : undefined;

    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content, ctaHref, ctaLabel, createdAt });
    }
  }

  return out.slice(-MAX_STORED_CHAT_MESSAGES);
}

function getBoundsFromWindow(spriteScale = 1) {
  // Use visualViewport for mobile to account for address bar
  const vw = (window as any).visualViewport;
  const winWidth = Math.floor(vw?.width || window.innerWidth);
  const winHeight = Math.floor(vw?.height || window.innerHeight);
  const scaledSpriteSize = SPRITE_SIZE * spriteScale;
  // Actor is visually scaled from its center, so bounds need to include the overhang.
  const scaleOffset = (scaledSpriteSize - SPRITE_SIZE) / 2;
  const minX = EDGE_MARGIN + scaleOffset;
  const minY = EDGE_MARGIN + scaleOffset;
  const maxX = Math.max(minX, winWidth - SPRITE_SIZE - EDGE_MARGIN - scaleOffset);
  const maxY = Math.max(minY, winHeight - SPRITE_SIZE - EDGE_MARGIN - scaleOffset);
  return { minX, maxX, minY, maxY };
}

function clampToMotionBounds(
  x: number,
  y: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  return { x: clamp(x, bounds.minX, bounds.maxX), y: clamp(y, FALL_START_Y, bounds.maxY) };
}

function getViewportSize() {
  const vv = (window as any).visualViewport;
  return {
    width: vv?.width || window.innerWidth,
    height: vv?.height || window.innerHeight,
  };
}

function getNearestEdge(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  x: number,
  y: number,
): Edge {
  const distances: Array<{ edge: Edge; value: number }> = [
    { edge: "bottom", value: Math.abs(y - bounds.maxY) },
    { edge: "right", value: Math.abs(x - bounds.maxX) },
    { edge: "top", value: Math.abs(y - bounds.minY) },
    { edge: "left", value: Math.abs(x - bounds.minX) },
  ];
  distances.sort((a, b) => a.value - b.value);
  return distances[0].edge;
}

function buildSpriteSrc(characterKey: string, fileName: string, spritesBaseUri?: string | null) {
  const remoteBase = String(spritesBaseUri || "").trim();
  if (remoteBase) {
    return `${remoteBase.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`;
  }
  return `/sprites/${encodeURIComponent(characterKey)}/${encodeURIComponent(fileName)}`;
}

export function SiteMochiMascot() {
  const pathname = usePathname();
  const { isSpanish, language } = useLanguage();
  const {
    config,
    catalog,
    freeSiteMessagesRemaining,
    incrementFreeSiteMessagesUsed,
    canUseCurrentProvider,
    updateConfig,
  } = useSiteMochi();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const isSpanishRef = useRef(isSpanish);
  useEffect(() => {
    isSpanishRef.current = isSpanish;
  }, [isSpanish]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const messagesRef = useRef<Msg[]>([]);
  const loadedStoredMessagesRef = useRef(false);
  const messagesListRef = useRef<HTMLDivElement | null>(null);
  const scrollMessagesToBottom = () => {
    requestAnimationFrame(() => {
      const el = messagesListRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  };
  useEffect(() => {
    if (typeof window === "undefined" || loadedStoredMessagesRef.current) return;
    loadedStoredMessagesRef.current = true;

    try {
      const raw = window.localStorage.getItem(SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const storedMessages = sanitizeStoredMessages(JSON.parse(raw));
      if (storedMessages.length) {
        setMessages(storedMessages);
      }
    } catch {
      window.localStorage.removeItem(SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    messagesRef.current = messages;
    scrollMessagesToBottom();
  }, [messages]);
  useEffect(() => {
    if (typeof window === "undefined" || !loadedStoredMessagesRef.current) return;

    try {
      const persistedMessages = messages.filter((message) => !message.streaming);
      if (!persistedMessages.length) {
        window.localStorage.removeItem(SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY,
          JSON.stringify(persistedMessages.slice(-MAX_STORED_CHAT_MESSAGES)),
        );
      }
      window.dispatchEvent(new Event(SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT));
    } catch {
      // Ignore storage failures.
    }
  }, [messages]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [hasMascotBeenClicked, setHasMascotBeenClicked] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceStatusTone, setVoiceStatusTone] = useState<VoiceStatusTone>("info");
  const [voiceAutoSendCountdown, setVoiceAutoSendCountdown] = useState<number | null>(null);
  const [speechInputSupported, setSpeechInputSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const ttsRequestSeqRef = useRef(0);
  const voiceAutoSendTimeoutRef = useRef<number | null>(null);
  const voiceAutoSendIntervalRef = useRef<number | null>(null);
  const fluteAudioCtxRef = useRef<AudioContext | null>(null);
  const fluteSoundBuffersRef = useRef<{ success: AudioBuffer | null; error: AudioBuffer | null }>({ success: null, error: null });
  const fluteSoundBuffersLoadedRef = useRef(false);

  const currentPosRef = useRef({ x: 0, y: 0 });
  const movementStateRef = useRef<MascotState>("falling");
  const wallSideRef = useRef<WallSide>("right");
  const wallDirRef = useRef<1 | -1>(-1);
  const floorDirRef = useRef<1 | -1>(Math.random() < 0.5 ? -1 : 1);
  const floorDirYRef = useRef<1 | -1>(-1);
  const ceilingDirRef = useRef<1 | -1>(1);
  const fallVelocityRef = useRef(0);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isNejoModeRef = useRef(false);
  const hasDesktopWindowRef = useRef(false);
  const wanderPauseRef = useRef<WanderPauseState>({
    nextPauseAt: 0,
    pauseUntil: 0,
    lastMovementState: null,
  });
  const phaseRef = useRef<"auto" | "held">("auto");
  const dragStateRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const blockClickRef = useRef(false);
  const jumpTimeoutRef = useRef<number | undefined>(undefined);
  const jumpBurstUntilRef = useRef<number>(0);
  const dragFrameIndexRef = useRef(0);
  const isInitializedRef = useRef(false);
  const bubbleRectRef = useRef({ left: 8, top: 8 });
  const bubbleResizeStateRef = useRef<BubbleResizeState | null>(null);
  const bubbleIsResizingRef = useRef(false);
  const bubbleRestoreRectRef = useRef<{ left: number; top: number } | null>(null);
  const bubbleRestoreSizeRef = useRef<{ width: number; height: number } | null>(null);
  const spriteScaleRef = useRef(config.sizePercent / 100);
  const [bubbleCursor, setBubbleCursor] = useState<BubbleResizeCursor>("");
  const [isBubbleFullscreen, setIsBubbleFullscreen] = useState(false);
  useEffect(() => {
    spriteScaleRef.current = clamp(config.sizePercent / 100, 0.6, 1.8);
  }, [config.sizePercent]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const handle = (e: Event) => {
      hasDesktopWindowRef.current = Boolean((e as CustomEvent).detail?.isOpen);
    };
    window.addEventListener(MOCHI_DESKTOP_WINDOW_EVENT, handle);
    return () => window.removeEventListener(MOCHI_DESKTOP_WINDOW_EVENT, handle);
  }, []);

  useEffect(() => {
    setSpeechInputSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      scrollMessagesToBottom();
    }
  }, [open]);

  // External trigger: dispatch window event 'mochi:open-chat' to open and greet
  useEffect(() => {
    function handleOpenChat() {
      if (!config.enabled) return;
      setOpen(true);
      setHasMascotBeenClicked(true);
      setMessages((prev) => {
        if (prev.length) return prev;
        const hello = isSpanishRef.current
          ? "¡Hola! Soy tu Mochi. Estoy listo para chatear, ¿en qué puedo ayudarte?"
          : "Hi! I'm your Mochi assistant. Ready to chat — what can I help you with?";
        return [{ role: "assistant", content: hello, createdAt: new Date().toISOString() }];
      });
    }
    window.addEventListener("mochi:open-chat", handleOpenChat);
    return () => window.removeEventListener("mochi:open-chat", handleOpenChat);
  }, [config.enabled]);

  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) {
        window.clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, []);

  const selectedCharacter = catalog?.characters.find((entry) => entry.key === config.character);
  const nejoPolicy = useMemo(
    () =>
      new NejoHackathonMotionPolicy(config.character, selectedCharacter?.availableSpriteFiles),
    [config.character, selectedCharacter?.availableSpriteFiles],
  );

  useEffect(() => {
    isNejoModeRef.current = nejoPolicy.active;
  }, [nejoPolicy]);

  const setMovementState = useCallback(
    (state: MascotState) => {
      movementStateRef.current = nejoPolicy.resolveMovementState(state);
    },
    [nejoPolicy],
  );

  const spriteBaseUri = selectedCharacter?.spritesBaseUri ?? null;

  const frames = useMemo(() => {
    const mapUrls = (files: readonly string[], fallback: readonly string[]) =>
      nejoPolicy
        .getAnimationFiles(files, fallback)
        .map((fileName) => buildSpriteSrc(config.character, fileName, spriteBaseUri));

    const sitFrames = mapUrls(PREVIEW_ANIMATION_SETS.sit, ["sit-edge-legs-down.png"]);
    const jumpFrames = mapUrls(PREVIEW_ANIMATION_SETS.jump, ["stand-neutral.png"]);
    const dragFrames = mapUrls(PREVIEW_ANIMATION_SETS.drag, ["stand-neutral.png"]);
    const walkFrames = mapUrls(
      ["walk-step-left.png", "stand-neutral.png", "walk-step-right.png", "stand-neutral.png"],
      ["stand-neutral.png"],
    );
    const wallClimbFrames = mapUrls(
      ["grab-wall.png", "climb-wall-frame-1.png", "grab-wall.png", "climb-wall-frame-2.png"],
      ["stand-neutral.png"],
    );
    const ceilingWalkFrames = mapUrls(
      ["grab-ceiling.png", "climb-ceiling-frame-1.png", "grab-ceiling.png", "climb-ceiling-frame-2.png"],
      ["stand-neutral.png"],
    );
    const usingComputerFrames = mapUrls(PREVIEW_ANIMATION_SETS.usingComputer, ["sit-pc-edge-legs-down.png"]);

    return {
      stand: buildSpriteSrc(config.character, "stand-neutral.png", spriteBaseUri),
      sit: sitFrames[0] ?? "",
      jump: jumpFrames,
      drag: dragFrames,
      walk: walkFrames,
      wallClimb: wallClimbFrames,
      ceilingWalk: ceilingWalkFrames,
      usingComputer: usingComputerFrames,
    };
  }, [config.character, nejoPolicy, spriteBaseUri]);

  const focusChatInput = () => {
    requestAnimationFrame(() => {
      if (!openRef.current) return;
      inputRef.current?.focus();
    });
  };

  const triggerJumpBurst = () => {
    setIsJumping(true);
    if (jumpTimeoutRef.current) {
      window.clearTimeout(jumpTimeoutRef.current);
    }
    jumpTimeoutRef.current = window.setTimeout(() => {
      setIsJumping(false);
    }, SPARKLE_DURATION);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    actorRef.current?.setPointerCapture(event.pointerId);
    isDraggingRef.current = false;
    blockClickRef.current = false;
    dragFrameIndexRef.current = 0;
    jumpBurstUntilRef.current = 0;
    const { x: currX, y: currY } = currentPosRef.current;
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - currX,
      offsetY: event.clientY - currY,
      pos: { x: currX, y: currY },
    };
    wanderPauseRef.current.nextPauseAt = 0;
    wanderPauseRef.current.pauseUntil = 0;
    wanderPauseRef.current.lastMovementState = null;
    phaseRef.current = "held";
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const bounds = getBoundsFromWindow(spriteScaleRef.current);
      const next = clampToMotionBounds(event.clientX - drag.offsetX, event.clientY - drag.offsetY, bounds);
      drag.pos = next;
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        blockClickRef.current = true;
      }
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      blockClickRef.current = wasDragging;
      dragStateRef.current = null;
      actorRef.current?.releasePointerCapture(drag.pointerId);
      const bounds = getBoundsFromWindow(spriteScaleRef.current);
      const clamped = clampToMotionBounds(drag.pos.x, drag.pos.y, bounds);
      currentPosRef.current = clamped;
      fallVelocityRef.current = 0;
      if (clamped.y >= bounds.maxY - 1) {
        currentPosRef.current = { x: clamped.x, y: bounds.maxY };
        setMovementState("floor-walking");
      } else if (clamped.y <= bounds.minY + 1) {
        currentPosRef.current = { x: clamped.x, y: bounds.minY };
        setMovementState("ceiling-walking");
      } else if (clamped.x <= bounds.minX + 1) {
        currentPosRef.current = { x: bounds.minX, y: clamped.y };
        setMovementState("wall-climbing");
        wallSideRef.current = "left";
        wallDirRef.current = -1;
      } else if (clamped.x >= bounds.maxX - 1) {
        currentPosRef.current = { x: bounds.maxX, y: clamped.y };
        setMovementState("wall-climbing");
        wallSideRef.current = "right";
        wallDirRef.current = -1;
      } else {
        setMovementState("falling");
      }
      phaseRef.current = "auto";
      wanderPauseRef.current.nextPauseAt = 0;
      wanderPauseRef.current.pauseUntil = 0;
      wanderPauseRef.current.lastMovementState = null;
      if (wasDragging) {
        jumpBurstUntilRef.current = performance.now() + SPARKLE_DURATION;
        triggerJumpBurst();
      }
      event.preventDefault();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  // Initialize position on mount
  useEffect(() => {
    const initPosition = () => {
      if (typeof window === "undefined") return;
      const bounds = getBoundsFromWindow(spriteScaleRef.current);
      const span = Math.max(0, bounds.maxX - bounds.minX);
      const startX = bounds.minX + Math.random() * span;
      const startY = FALL_START_Y;
      currentPosRef.current = { x: startX, y: startY };
      setMovementState("falling");
      fallVelocityRef.current = 0;
      floorDirRef.current = Math.random() < 0.5 ? -1 : 1;
      ceilingDirRef.current = floorDirRef.current;
      wanderPauseRef.current.nextPauseAt = 0;
      wanderPauseRef.current.pauseUntil = 0;
      wanderPauseRef.current.lastMovementState = null;
      isInitializedRef.current = true;
      
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${Math.round(startX)}px, ${Math.round(startY)}px, 0)`;
      }
    };
    
    // Initialize immediately and after a short delay to handle hydration
    initPosition();
    const timer = setTimeout(initPosition, 50);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastT = 0;
    let lastFrameT = 0;
    let frameIdx = 0;
    let lastAnimState: string | null = null;

    const tick = (time: number) => {
      if (!wrapRef.current || !isInitializedRef.current) {
        raf = requestAnimationFrame(tick);
        lastT = time;
        return;
      }
      if (!lastT) {
        lastT = time;
      }
      const dt = Math.min(0.05, (time - lastT) / 1000);
      lastT = time;

      const bounds = getBoundsFromWindow(spriteScaleRef.current);
      const phase = phaseRef.current;
      let targetPos = currentPosRef.current;

      const updateBubblePosition = (mascotPos: { x: number; y: number }) => {
        if (!openRef.current || !bubbleRef.current || bubbleIsResizingRef.current) return;
        const { width: viewportWidth, height: viewportHeight } = getViewportSize();
        const margin = 8;
        const gap = CHAT_GAP;
        const bubbleEl = bubbleRef.current;
        const bubbleWidth = Math.min(bubbleEl.offsetWidth || 340, viewportWidth - margin * 2);
        const bubbleHeight = bubbleEl.offsetHeight || 320;
        const isMobile = viewportWidth < MOBILE_BREAKPOINT;
        const nearestEdge = getNearestEdge(bounds, mascotPos.x, mascotPos.y);
        const centerX = mascotPos.x + SPRITE_SIZE / 2;
        const centerY = mascotPos.y + SPRITE_SIZE / 2;

        let left = centerX - bubbleWidth / 2;
        let top = mascotPos.y - bubbleHeight - gap;

        if (isMobile) {
          left = (viewportWidth - bubbleWidth) / 2;
          top = viewportHeight - bubbleHeight - margin;
        } else if (nearestEdge === "top") {
          top = mascotPos.y + SPRITE_SIZE + gap;
        } else if (nearestEdge === "left") {
          left = mascotPos.x + SPRITE_SIZE + gap;
          top = centerY - bubbleHeight / 2;
        } else if (nearestEdge === "right") {
          left = mascotPos.x - bubbleWidth - gap;
          top = centerY - bubbleHeight / 2;
        }

        left = clamp(left, margin, viewportWidth - bubbleWidth - margin);
        top = clamp(top, margin, viewportHeight - bubbleHeight - margin);

        const prev = bubbleRectRef.current;
        if (Math.abs(prev.left - left) > 0.5 || Math.abs(prev.top - top) > 0.5) {
          bubbleRectRef.current = { left, top };
          bubbleEl.style.left = `${Math.round(left)}px`;
          bubbleEl.style.top = `${Math.round(top)}px`;
        }
      };

      if (phase === "held" && dragStateRef.current) {
        const next = clampToMotionBounds(dragStateRef.current.pos.x, dragStateRef.current.pos.y, bounds);
        targetPos = next;
        if (isDraggingRef.current) {
          const animState = "drag";
          const activeFrames = frames.drag;
          if (lastAnimState !== animState) {
            dragFrameIndexRef.current = 0;
            lastFrameT = time;
            imgRef.current?.setAttribute("src", activeFrames[dragFrameIndexRef.current]);
          } else if (time - lastFrameT > 100) {
            lastFrameT = time;
            dragFrameIndexRef.current = (dragFrameIndexRef.current + 1) % activeFrames.length;
            imgRef.current?.setAttribute("src", activeFrames[dragFrameIndexRef.current]);
          }
          lastAnimState = animState;
        } else {
          imgRef.current?.setAttribute("src", frames.sit);
          lastAnimState = "held-sit";
        }
      } else if (jumpBurstUntilRef.current > time) {
        const animState = "jump";
        const activeFrames = frames.jump;
        if (lastAnimState !== animState) {
          frameIdx = 0;
          lastFrameT = time;
          imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
        } else if (time - lastFrameT > 110) {
          lastFrameT = time;
          frameIdx = (frameIdx + 1) % activeFrames.length;
          imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
        }
        lastAnimState = animState;
      } else if (openRef.current) {
        const openPos = { ...currentPosRef.current };
        const { width: viewportWidth, height: viewportHeight } = getViewportSize();
        if (viewportWidth < MOBILE_BREAKPOINT) {
          const bubbleHeight = bubbleRef.current?.offsetHeight || 320;
          const bubbleTop = viewportHeight - bubbleHeight - 8;
          openPos.x = clamp(viewportWidth / 2 - SPRITE_SIZE / 2, bounds.minX, bounds.maxX);
          openPos.y = clamp(bubbleTop - SPRITE_SIZE - CHAT_GAP, bounds.minY, bounds.maxY);
        }
        targetPos = openPos;
        if (movementStateRef.current === "floor-walking") {
          const animState = "chat-using-computer";
          const activeFrames = frames.usingComputer;
          if (lastAnimState !== animState) {
            frameIdx = 0;
            lastFrameT = time;
            imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
          } else if (time - lastFrameT > 220) {
            lastFrameT = time;
            frameIdx = (frameIdx + 1) % activeFrames.length;
            imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
          }
          lastAnimState = animState;
        } else {
          imgRef.current?.setAttribute("src", frames.sit);
          lastAnimState = "chat-sit";
        }
      } else {
        const state = movementStateRef.current;
        const next = { ...targetPos };
        const pauseState = wanderPauseRef.current;
        const canPauseWhileWalking =
          state === "floor-walking" || state === "ceiling-walking" || state === "wall-climbing";
        if (pauseState.lastMovementState !== state) {
          pauseState.lastMovementState = state;
          pauseState.pauseUntil = 0;
          pauseState.nextPauseAt = canPauseWhileWalking
            ? time + WALK_SEGMENT_MIN_MS + Math.random() * (WALK_SEGMENT_MAX_MS - WALK_SEGMENT_MIN_MS)
            : 0;
        }
        if (
          canPauseWhileWalking &&
          pauseState.pauseUntil <= time &&
          pauseState.nextPauseAt > 0 &&
          time >= pauseState.nextPauseAt
        ) {
          pauseState.pauseUntil = time + WALK_PAUSE_MIN_MS + Math.random() * (WALK_PAUSE_MAX_MS - WALK_PAUSE_MIN_MS);
          pauseState.nextPauseAt =
            pauseState.pauseUntil + WALK_SEGMENT_MIN_MS + Math.random() * (WALK_SEGMENT_MAX_MS - WALK_SEGMENT_MIN_MS);
          if (Math.random() < WALK_PAUSE_REVERSE_CHANCE) {
            if (state === "floor-walking") {
              if (Math.random() < 0.6) floorDirRef.current = floorDirRef.current === 1 ? -1 : 1;
              if (!hasDesktopWindowRef.current && Math.random() < 0.4) {
                floorDirYRef.current = floorDirYRef.current === 1 ? -1 : 1;
              }
            }
          }
        }
        // Cursor proximity check
        const mouse = mousePosRef.current;
        const charCenterX = next.x + SPRITE_SIZE / 2;
        const charCenterY = next.y + SPRITE_SIZE / 2;
        const cursorDist = mouse
          ? Math.sqrt((mouse.x - charCenterX) ** 2 + (mouse.y - charCenterY) ** 2)
          : Infinity;
        const isCursorNear = cursorDist < CURSOR_NEAR_DIST;

        const isWalkPaused = (canPauseWhileWalking && pauseState.pauseUntil > time) || isCursorNear;
        const windowOpen = hasDesktopWindowRef.current;

        if (state === "falling") {
          fallVelocityRef.current += GRAVITY * dt;
          next.y += fallVelocityRef.current * dt;
          next.x = clamp(next.x, bounds.minX, bounds.maxX);
          if (next.y >= bounds.maxY) {
            next.y = bounds.maxY;
            fallVelocityRef.current = 0;
            setMovementState("floor-walking");
            floorDirRef.current = Math.random() < 0.5 ? -1 : 1;
            floorDirYRef.current = windowOpen ? 1 : -1;
          }
        } else if (state === "floor-walking") {
          if (windowOpen) {
            // Drift to floor and walk horizontally when a window is open
            const atFloor = next.y >= bounds.maxY - 4;
            if (!atFloor) {
              // Sink toward floor
              next.y += WALK_SPEED * 1.5 * dt;
              next.x += floorDirRef.current * WALK_SPEED * dt;
            } else {
              next.y = bounds.maxY;
              if (!isWalkPaused) {
                next.x += floorDirRef.current * WALK_SPEED * dt;
              }
            }
            if (next.x <= bounds.minX) { next.x = bounds.minX; floorDirRef.current = 1; }
            else if (next.x >= bounds.maxX) { next.x = bounds.maxX; floorDirRef.current = -1; }
          } else {
            // Free 2D wander: steer toward cursor, bounce off all edges
            if (!isCursorNear && mouse && cursorDist < CURSOR_STEER_DIST) {
              const dx = mouse.x - charCenterX;
              const dy = mouse.y - charCenterY;
              if (Math.abs(dx) > 12) floorDirRef.current = dx > 0 ? 1 : -1;
              if (Math.abs(dy) > 12) floorDirYRef.current = dy > 0 ? 1 : -1;
            }
            if (!isWalkPaused) {
              next.x += floorDirRef.current * WALK_SPEED * dt;
              next.y += floorDirYRef.current * WALK_SPEED * 0.7 * dt;
            }
            if (next.x <= bounds.minX) { next.x = bounds.minX; floorDirRef.current = 1; }
            else if (next.x >= bounds.maxX) { next.x = bounds.maxX; floorDirRef.current = -1; }
            if (next.y <= bounds.minY) { next.y = bounds.minY; floorDirYRef.current = 1; }
            else if (next.y >= bounds.maxY) { next.y = bounds.maxY; floorDirYRef.current = -1; }
          }
        } else if (state === "wall-climbing") {
          // Wall/ceiling states can still occur for non-mochi characters that entered them before
          // Redirect to floor-walking safely
          setMovementState("floor-walking");
          floorDirRef.current = wallSideRef.current === "left" ? 1 : -1;
          floorDirYRef.current = -1;
        } else {
          // ceiling-walking: redirect to floor-walking
          setMovementState("floor-walking");
          floorDirYRef.current = 1;
        }

        targetPos = clampToMotionBounds(next.x, next.y, bounds);

        const animState = movementStateRef.current;
        if (animState === "falling") {
          frameIdx = 0;
          imgRef.current?.setAttribute("src", frames.stand);
        } else {
          const isPausedLocomotion =
            (animState === "floor-walking" ||
              animState === "ceiling-walking" ||
              animState === "wall-climbing") &&
            wanderPauseRef.current.pauseUntil > time;
          const activeFrames =
            animState === "floor-walking"
              ? frames.walk
              : animState === "wall-climbing"
                ? frames.wallClimb
                : frames.ceilingWalk;
          if (isPausedLocomotion) {
            frameIdx = 0;
            lastFrameT = time;
            imgRef.current?.setAttribute(
              "src",
              animState === "floor-walking"
                ? frames.stand
                : animState === "wall-climbing"
                  ? frames.wallClimb[0]
                  : frames.ceilingWalk[0],
            );
          } else if (lastAnimState !== animState) {
            frameIdx = 0;
            lastFrameT = time;
            imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
          } else if (time - lastFrameT > 170) {
            lastFrameT = time;
            frameIdx = (frameIdx + 1) % activeFrames.length;
            imgRef.current?.setAttribute("src", activeFrames[frameIdx]);
          }
        }
        lastAnimState = animState;
      }

      const renderX = clamp(Math.round(targetPos.x), Math.ceil(bounds.minX), Math.floor(bounds.maxX));
      const renderY = clamp(Math.round(targetPos.y), Math.ceil(FALL_START_Y), Math.floor(bounds.maxY));
      wrapRef.current.style.transform = `translate3d(${renderX}px, ${renderY}px, 0)`;
      currentPosRef.current = targetPos;
      updateBubblePosition(targetPos);

      const state = movementStateRef.current;
      const scaleX =
        state === "floor-walking"
          ? floorDirRef.current === 1
            ? -1
            : 1
          : state === "ceiling-walking"
            ? ceilingDirRef.current === 1
              ? -1
              : 1
            : state === "wall-climbing"
              ? wallSideRef.current === "left"
                ? 1
                : -1
              : wallSideRef.current === "left"
              ? 1
              : -1;
      imgRef.current?.style.setProperty("transform", `scaleX(${scaleX})`);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [frames.ceilingWalk, frames.drag, frames.jump, frames.sit, frames.stand, frames.usingComputer, frames.walk, frames.wallClimb, setMovementState]);

  useEffect(() => {
    if (!config.enabled) {
      setOpen(false);
    }
  }, [config.enabled]);

  const effectiveProvider =
    config.provider === "site" && config.openrouterApiKey.trim() ? "openrouter" : config.provider;
  const canUseEffectiveProvider =
    effectiveProvider === "site"
      ? (freeSiteMessagesRemaining ?? 0) > 0
      : effectiveProvider === "openrouter"
        ? Boolean(config.openrouterApiKey.trim())
        : canUseCurrentProvider;
  const siteCreditsExhausted = effectiveProvider === "site" && (freeSiteMessagesRemaining ?? 0) <= 0;
  const canAutoFallbackToSiteCredits =
    effectiveProvider === "openrouter" &&
    !config.openrouterApiKey.trim() &&
    (freeSiteMessagesRemaining ?? 0) > 0;
  const bubbleStyleClass =
    config.chatBubbleStyle === "dark"
      ? styles.chatStyleDark
      : config.chatBubbleStyle === "solid"
        ? styles.chatStyleSolid
        : styles.chatStyleGlass;
  const bubbleWidthPx = config.chatWidthPx ?? SITE_MOCHI_CHAT_WIDTH_MAP[config.chatWidth];
  const bubbleHeightPx = config.chatHeightPx ?? SITE_MOCHI_CHAT_DEFAULT_HEIGHT_PX;
  const bubbleViewportMarginPx = 12;
  const bubbleFontSizePx = SITE_MOCHI_CHAT_FONT_SIZE_MAP[config.chatFontSize];
  const bubbleInlineStyle = {
    left: isBubbleFullscreen ? bubbleViewportMarginPx : bubbleRectRef.current.left,
    top: isBubbleFullscreen ? bubbleViewportMarginPx : bubbleRectRef.current.top,
    width: isBubbleFullscreen ? `calc(100vw - ${bubbleViewportMarginPx * 2}px)` : undefined,
    height: isBubbleFullscreen ? `calc(100dvh - ${bubbleViewportMarginPx * 2}px)` : undefined,
    maxWidth: isBubbleFullscreen ? `calc(100vw - ${bubbleViewportMarginPx * 2}px)` : undefined,
    maxHeight: isBubbleFullscreen ? `calc(100dvh - ${bubbleViewportMarginPx * 2}px)` : undefined,
    cursor: isBubbleFullscreen ? undefined : bubbleCursor || undefined,
    ["--chat-theme" as const]: config.chatThemeColor,
    ["--chat-bg" as const]: config.chatBgColor,
    ["--chat-width" as const]: `${bubbleWidthPx}px`,
    ["--chat-height" as const]: `${bubbleHeightPx}px`,
    ["--chat-font-size" as const]: `${bubbleFontSizePx}px`,
  } as CSSProperties;
  function setVoiceInfoStatus(message: string) {
    setVoiceStatusTone("info");
    setVoiceStatus(message);
  }

  function clearVoiceAutoSendCountdown() {
    if (voiceAutoSendTimeoutRef.current !== null) {
      window.clearTimeout(voiceAutoSendTimeoutRef.current);
      voiceAutoSendTimeoutRef.current = null;
    }
    if (voiceAutoSendIntervalRef.current !== null) {
      window.clearInterval(voiceAutoSendIntervalRef.current);
      voiceAutoSendIntervalRef.current = null;
    }
    setVoiceAutoSendCountdown(null);
  }

  function scheduleVoiceAutoSend(transcript: string) {
    clearVoiceAutoSendCountdown();
    setVoiceAutoSendCountdown(3);
    setVoiceInfoStatus(
      isSpanish
        ? "Transcripción lista. Enviando en 3 segundos..."
        : "Transcript ready. Sending in 3 seconds...",
    );

    let remaining = 3;
    voiceAutoSendIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setVoiceAutoSendCountdown(remaining);
        setVoiceInfoStatus(
          isSpanish
            ? `Transcripción lista. Enviando en ${remaining} segundos...`
            : `Transcript ready. Sending in ${remaining} seconds...`,
        );
      }
    }, 1000);

    voiceAutoSendTimeoutRef.current = window.setTimeout(() => {
      clearVoiceAutoSendCountdown();
      setVoiceInfoStatus(
        isSpanish ? "Transcripción lista. Enviando..." : "Transcript ready. Sending...",
      );
      void send(transcript);
    }, 3000);
  }

  function cancelVoiceAutoSend() {
    clearVoiceAutoSendCountdown();
    setVoiceInfoStatus(
      isSpanish
        ? "Envío automático cancelado. Podés editar o enviar manualmente."
        : "Auto-send cancelled. You can edit or send manually.",
    );
  }

  function toggleBubbleFullscreen() {
    if (isBubbleFullscreen) {
      if (bubbleRestoreRectRef.current) {
        bubbleRectRef.current = bubbleRestoreRectRef.current;
      }
      if (bubbleRestoreSizeRef.current) {
        updateConfig({
          chatWidthPx: bubbleRestoreSizeRef.current.width,
          chatHeightPx: bubbleRestoreSizeRef.current.height,
        });
      }
      setIsBubbleFullscreen(false);
      return;
    }

    const rect = bubbleRef.current?.getBoundingClientRect();
    bubbleRestoreRectRef.current = { ...bubbleRectRef.current };
    bubbleRestoreSizeRef.current = rect
      ? { width: Math.round(rect.width), height: Math.round(rect.height) }
      : { width: bubbleWidthPx, height: bubbleHeightPx };
    setIsBubbleFullscreen(true);
  }

  function setVoiceErrorStatus(message: string) {
    clearVoiceAutoSendCountdown();
    setVoiceStatusTone("error");
    setVoiceStatus(message);
  }

  function revokeAudioObjectUrl() {
    if (!audioObjectUrlRef.current) return;
    URL.revokeObjectURL(audioObjectUrlRef.current);
    audioObjectUrlRef.current = null;
  }

  function stopVoiceOutput() {
    ttsRequestSeqRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // no-op
      }
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // no-op
      }
      audioRef.current.src = "";
      audioRef.current = null;
    }
    revokeAudioObjectUrl();
    setIsSpeaking(false);
  }

  function stopVoiceInput() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort?.();
        } catch {
          // no-op
        }
      }
    }
    setIsListening(false);
  }

  function getFluteAudioCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!fluteAudioCtxRef.current) {
        fluteAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return fluteAudioCtxRef.current;
    } catch {
      return null;
    }
  }

  async function loadFluteSoundBuffers() {
    if (fluteSoundBuffersLoadedRef.current) return;
    const ctx = getFluteAudioCtx();
    if (!ctx) return;
    fluteSoundBuffersLoadedRef.current = true;
    try {
      const [successResp, errorResp] = await Promise.all([
        fetch("/mochi-success.wav"),
        fetch("/mochi-error.wav"),
      ]);
      const [successArrayBuf, errorArrayBuf] = await Promise.all([
        successResp.arrayBuffer(),
        errorResp.arrayBuffer(),
      ]);
      const [successBuf, errorBuf] = await Promise.all([
        ctx.decodeAudioData(successArrayBuf),
        ctx.decodeAudioData(errorArrayBuf),
      ]);
      fluteSoundBuffersRef.current = { success: successBuf, error: errorBuf };
    } catch {
      // silent fallback - sounds just won't play
    }
  }

  function unlockFluteAudioCtx() {
    const ctx = getFluteAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    void loadFluteSoundBuffers();
  }

  function playFluteSound(kind: "success" | "error") {
    const ctx = getFluteAudioCtx();
    if (!ctx || ctx.state !== "running") return;
    const buffer = fluteSoundBuffersRef.current[kind];
    if (!buffer) return;
    try {
      const volume = clamp((config.soundOutputVolumePercent ?? 70) / 100, 0, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      // no-op
    }
  }

  async function speakReply(replyText: string) {
    const text = replyText.trim().slice(0, 1200);
    if (!text) return;
    if (!config.soundOutputAutoSpeak || config.soundOutputProvider === "off") return;

    stopVoiceOutput();
    const requestSeq = ttsRequestSeqRef.current;
    const volume = clamp(config.soundOutputVolumePercent / 100, 0, 1);

    if (config.soundOutputProvider === "browser") {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        typeof (window as any).SpeechSynthesisUtterance !== "function"
      ) {
        setVoiceErrorStatus(
          isSpanish
            ? "Tu navegador no soporta síntesis de voz."
            : "Your browser does not support speech synthesis.",
        );
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getSpeechLocale(language);
      utterance.volume = volume;

      const voices = window.speechSynthesis.getVoices();
      const langPrefix = language === "es" ? "es" : "en";
      const selectedBrowserVoice = config.soundOutputBrowserVoiceName
        ? voices.find((voice) => String(voice.name || "") === config.soundOutputBrowserVoiceName)
        : null;
      const preferredVoice = selectedBrowserVoice ?? voices.find((voice) =>
        String(voice.lang || "")
          .toLowerCase()
          .startsWith(langPrefix),
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        if (requestSeq !== ttsRequestSeqRef.current) return;
        setIsSpeaking(true);
        setVoiceInfoStatus(isSpanish ? "Reproduciendo respuesta..." : "Playing response...");
      };
      utterance.onend = () => {
        if (requestSeq !== ttsRequestSeqRef.current) return;
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        if (requestSeq !== ttsRequestSeqRef.current) return;
        setIsSpeaking(false);
        setVoiceErrorStatus(
          isSpanish ? "No se pudo reproducir la voz del navegador." : "Could not play browser voice.",
        );
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
        setVoiceErrorStatus(
          isSpanish ? "No se pudo iniciar la voz del navegador." : "Could not start browser voice.",
        );
      }
      return;
    }

    if (!config.elevenlabsApiKey.trim()) {
      setVoiceErrorStatus(
        isSpanish
          ? "Falta la API key de ElevenLabs en la pestaña de Sonido."
          : "Missing ElevenLabs API key in the Sound tab.",
      );
      return;
    }

    setIsSpeaking(true);
    setVoiceInfoStatus(isSpanish ? "Generando audio con ElevenLabs..." : "Generating ElevenLabs audio...");

    try {
      const response = await fetch("/api/site-mochi/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "elevenlabs",
          text,
          elevenlabsApiKey: config.elevenlabsApiKey,
          voiceId: config.elevenlabsVoiceId,
          modelId: config.elevenlabsModelId,
        }),
      });

      if (requestSeq !== ttsRequestSeqRef.current) return;

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const detail =
          typeof errorPayload?.error === "string"
            ? errorPayload.error
            : typeof errorPayload?.details === "string"
              ? errorPayload.details
              : `HTTP ${response.status}`;
        throw new Error(detail);
      }

      const audioBlob = await response.blob();
      if (requestSeq !== ttsRequestSeqRef.current) return;
      if (!audioBlob.size) {
        throw new Error("EMPTY_AUDIO");
      }

      revokeAudioObjectUrl();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioObjectUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.volume = volume;
      audio.onended = () => {
        if (requestSeq !== ttsRequestSeqRef.current) return;
        setIsSpeaking(false);
        revokeAudioObjectUrl();
      };
      audio.onerror = () => {
        if (requestSeq !== ttsRequestSeqRef.current) return;
        setIsSpeaking(false);
        setVoiceErrorStatus(
          isSpanish ? "No se pudo reproducir el audio de ElevenLabs." : "Could not play ElevenLabs audio.",
        );
      };

      await audio.play();
      if (requestSeq !== ttsRequestSeqRef.current) return;
      setVoiceInfoStatus(isSpanish ? "Reproduciendo respuesta..." : "Playing response...");
    } catch {
      if (requestSeq !== ttsRequestSeqRef.current) return;
      setIsSpeaking(false);
      setVoiceErrorStatus(
        isSpanish
          ? "Error al generar voz con ElevenLabs. Revisá la key, Voice ID o el modelo."
          : "Failed to generate ElevenLabs voice. Check the key, Voice ID, or model.",
      );
    }
  }

  useEffect(() => {
    if (!open) {
      stopVoiceInput();
      stopVoiceOutput();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopVoiceInput();
      stopVoiceOutput();
    };
  }, []);

  function getBubbleResizeHit(clientX: number, clientY: number) {
    const bubbleEl = bubbleRef.current;
    if (!bubbleEl) {
      return { canResize: false, cursor: "" as BubbleResizeCursor, left: false, right: false, top: false };
    }
    const { width: viewportWidth } = getViewportSize();
    if (viewportWidth < MOBILE_BREAKPOINT) {
      return { canResize: false, cursor: "" as BubbleResizeCursor, left: false, right: false, top: false };
    }
    const rect = bubbleEl.getBoundingClientRect();
    const nearLeft = clientX - rect.left <= SITE_MOCHI_CHAT_RESIZE_EDGE_PX;
    const nearRight = rect.right - clientX <= SITE_MOCHI_CHAT_RESIZE_EDGE_PX;
    const nearTop = clientY - rect.top <= SITE_MOCHI_CHAT_RESIZE_EDGE_PX;

    let cursor: BubbleResizeCursor = "";
    if (nearLeft && nearTop) {
      cursor = "nw-resize";
    } else if (nearRight && nearTop) {
      cursor = "ne-resize";
    } else if (nearLeft) {
      cursor = "w-resize";
    } else if (nearRight) {
      cursor = "e-resize";
    } else if (nearTop) {
      cursor = "n-resize";
    }

    return {
      canResize: Boolean(nearLeft || nearRight || nearTop),
      cursor,
      left: nearLeft,
      right: nearRight,
      top: nearTop,
    };
  }

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = bubbleResizeStateRef.current;
      const bubbleEl = bubbleRef.current;
      if (!resizeState || !bubbleEl) return;

      const dx = event.clientX - resizeState.startX;
      const dy = event.clientY - resizeState.startY;
      const { width: viewportWidth, height: viewportHeight } = getViewportSize();

      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;
      let nextLeft = resizeState.startLeft;
      let nextTop = resizeState.startTop;

      if (resizeState.right) {
        nextWidth = resizeState.startWidth + dx;
      }
      if (resizeState.left) {
        nextWidth = resizeState.startWidth - dx;
        nextLeft = resizeState.startLeft + dx;
      }
      if (resizeState.top) {
        nextHeight = resizeState.startHeight - dy;
        nextTop = resizeState.startTop + dy;
      }

      nextWidth = Math.max(SITE_MOCHI_CHAT_MIN_WIDTH_PX, nextWidth);
      nextHeight = Math.max(SITE_MOCHI_CHAT_MIN_HEIGHT_PX, nextHeight);

      nextLeft = clamp(nextLeft, 0, Math.max(0, viewportWidth - nextWidth));
      nextTop = clamp(nextTop, 0, Math.max(0, viewportHeight - nextHeight));

      bubbleEl.style.setProperty("--chat-width", `${Math.round(nextWidth)}px`);
      bubbleEl.style.setProperty("--chat-height", `${Math.round(nextHeight)}px`);
      bubbleEl.style.left = `${Math.round(nextLeft)}px`;
      bubbleEl.style.top = `${Math.round(nextTop)}px`;
      bubbleRectRef.current = { left: nextLeft, top: nextTop };

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const stopResize = (event?: PointerEvent) => {
      const resizeState = bubbleResizeStateRef.current;
      if (!resizeState) return;
      bubbleResizeStateRef.current = null;
      bubbleIsResizingRef.current = false;
      setBubbleCursor("");
      try {
        bubbleRef.current?.releasePointerCapture?.(resizeState.pointerId);
      } catch {
        // no-op
      }
      const rect = bubbleRef.current?.getBoundingClientRect();
      if (rect) {
        updateConfig({
          chatWidthPx: Math.round(rect.width),
          chatHeightPx: Math.round(rect.height),
        });
      }
      if (event?.cancelable) {
        event.preventDefault();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [updateConfig]);

  function ensureGreeting() {
    setMessages(prev => {
      if (prev.length) return prev;
      const hello = isSpanish
        ? "¡Hola! Soy tu Mochi. Estoy listo para chatear, ¿sobre qué quieres hablar?"
        : "Hi! I'm your Mochi. I'm ready to chat, what do you want to talk about?";
      return [{ role: "assistant", content: hello, createdAt: new Date().toISOString() }];
    });
  }

  async function send(inputOverride?: string) {
    clearVoiceAutoSendCountdown();
    const text = (typeof inputOverride === "string" ? inputOverride : input).trim();
    const providerForRequest = canAutoFallbackToSiteCredits ? ("site" as const) : effectiveProvider;
    if (!text || sending) return;

    if (!config.enabled) {
      return;
    }

    if (siteCreditsExhausted) {
      const lockMessage = isSpanish
        ? "Se terminaron los 4 mensajes gratis del sitio. Abrí la configuración del mochi (engranaje) y configurá tus claves en Chat > Proveedor para seguir chateando."
        : "The 4 free website messages are used up. Open the mochi settings (gear) and configure your own keys in Chat > Provider to keep chatting.";
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: lockMessage,
          ctaHref: "/help",
          ctaLabel: isSpanish ? "Ver ayuda" : "Open help",
          createdAt: new Date().toISOString(),
        },
      ]);
      void speakReply(lockMessage);
      return;
    }

    if (!canUseEffectiveProvider && !canAutoFallbackToSiteCredits) {
      const configMessage = isSpanish
        ? "Falta configuración para ese proveedor. Abrí la configuración del mochi (engranaje) y completá los datos en Chat > Proveedor."
        : "That provider is not fully configured yet. Open the mochi settings (gear) and complete the setup in Chat > Provider.";
      setMessages(prev => [...prev, { role: "assistant", content: configMessage, createdAt: new Date().toISOString() }]);
      void speakReply(configMessage);
      return;
    }

    setInput("");
    setSending(true);

    setMessages(prev => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);

    let streamingAssistantIndex: number | null = null;
    try {
      const history = messagesRef.current
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      let webSearchToolContext = "";
      if (
        (providerForRequest === "openrouter" || providerForRequest === "ollama") &&
        config.braveApiKey.trim()
      ) {
        try {
          webSearchToolContext = await fetchWebSearchToolContext({
            query: text,
            braveApiKey: config.braveApiKey,
          });
        } catch (error) {
          // Web search is optional; keep chat working even if Brave fails.
          console.warn("site-mochi brave search failed", error);
        }
      }
      let reply = "";

      if (providerForRequest === "bitte" && config.bitteApiKey.trim() && config.bitteAgentId.trim()) {
        // Usar API key propia del usuario
        const providerMessages = buildSiteMochiChatMessages({
          message: text,
          history,
          language,
          characterLabel: selectedCharacter?.label,
          soulMd: config.soulMd,
        });
        reply = await sendBitteBrowserChat({
          messages: providerMessages,
          bitteApiKey: config.bitteApiKey,
          bitteAgentId: config.bitteAgentId,
        });
      } else if (providerForRequest === "bitte") {
        const assistantCreatedAt = new Date().toISOString();
        const assistantIndex = messagesRef.current.length + 1;
        streamingAssistantIndex = assistantIndex;
        const appendStreamingAssistantDelta = (delta: string) => {
          if (!delta) return;
          setMessages((prev) =>
            prev.map((message, index) =>
              index === assistantIndex
                ? {
                    ...message,
                    content: `${message.content}${delta}`,
                    streaming: true,
                  }
                : message,
            ),
          );
        };
        const finalizeStreamingAssistant = (content: string) => {
          setMessages((prev) =>
            prev.map((message, index) =>
              index === assistantIndex
                ? {
                    ...message,
                    content,
                    streaming: false,
                  }
                : message,
            ),
          );
        };

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", createdAt: assistantCreatedAt, streaming: true },
        ]);

        reply = await streamMochiChatReply({
          body: {
            message: text,
            history,
            lang: language,
            provider: "site",
            character: config.character,
            soulMd: config.soulMd,
          },
          onDelta: appendStreamingAssistantDelta,
        });
        finalizeStreamingAssistant(reply);
        incrementFreeSiteMessagesUsed();
      } else if (providerForRequest === "ollama" || providerForRequest === "openclaw") {
        const shouldApplyPersonality = providerForRequest !== "openclaw";
        const providerMessages = buildSiteMochiChatMessages({
          message: text,
          history,
          language,
          characterLabel: selectedCharacter?.label,
          soulMd: shouldApplyPersonality ? config.soulMd : undefined,
          toolContext: webSearchToolContext,
        });
        reply =
          providerForRequest === "ollama"
            ? await sendOllamaBrowserChat({
                messages: providerMessages,
                ollamaUrl: config.ollamaUrl,
                ollamaModel: config.ollamaModel,
              })
            : await (async () => {
                const relayResponse = await fetch("/api/site-mochi/openclaw/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionToken: config.openclawPairedSessionToken,
                    messages: providerMessages,
                  }),
                });
                const relayRaw = await relayResponse.text();
                const relayJson = ((): {
                  reply?: string;
                  error?: string;
                  errorDetail?: string;
                  sessionExpiresAt?: string;
                } | null => {
                  if (!relayRaw) return null;
                  try {
                    return JSON.parse(relayRaw) as {
                      reply?: string;
                      error?: string;
                      errorDetail?: string;
                      sessionExpiresAt?: string;
                    };
                  } catch {
                    return null;
                  }
                })();
                const relayErrorCode =
                  typeof relayJson?.error === "string" && relayJson.error.trim()
                    ? typeof relayJson?.errorDetail === "string" && relayJson.errorDetail.trim()
                      ? relayJson.errorDetail.trim().startsWith("OPENCLAW_")
                        ? relayJson.errorDetail.trim()
                        : `OPENCLAW_RELAY_DETAIL:${relayJson.error.trim()}:${relayJson.errorDetail
                            .trim()
                            .slice(0, 120)}`
                      : relayJson.error.trim()
                    : !relayResponse.ok && relayRaw.trim()
                      ? `OPENCLAW_RELAY_DETAIL:HTTP ${relayResponse.status} ${relayRaw
                          .replace(/\s+/g, " ")
                          .trim()
                          .slice(0, 120)}`
                    : !relayResponse.ok
                      ? `OPENCLAW_RELAY_HTTP_${relayResponse.status}`
                      : "OPENCLAW_RELAY_FAILED";
                const parsedRelayJson = relayJson as
                  | {
                      reply?: string;
                      error?: string;
                      errorDetail?: string;
                      sessionExpiresAt?: string;
                    }
                  | null;
                if (
                  !relayResponse.ok ||
                  typeof parsedRelayJson?.reply !== "string" ||
                  !parsedRelayJson.reply.trim()
                ) {
                  throw new Error(relayErrorCode);
                }
                if (
                  typeof parsedRelayJson.sessionExpiresAt === "string" &&
                  parsedRelayJson.sessionExpiresAt
                ) {
                  updateConfig({ openclawPairedSessionExpiresAt: parsedRelayJson.sessionExpiresAt });
                }
                return parsedRelayJson.reply.trim();
              })();
      } else {
        const assistantCreatedAt = new Date().toISOString();
        const assistantIndex = messagesRef.current.length + 1;
        streamingAssistantIndex = assistantIndex;
        const appendStreamingAssistantDelta = (delta: string) => {
          if (!delta) return;
          setMessages((prev) =>
            prev.map((message, index) =>
              index === assistantIndex
                ? {
                    ...message,
                    content: `${message.content}${delta}`,
                    streaming: true,
                  }
                : message,
            ),
          );
        };
        const finalizeStreamingAssistant = (content: string) => {
          setMessages((prev) =>
            prev.map((message, index) =>
              index === assistantIndex
                ? {
                    ...message,
                    content,
                    streaming: false,
                  }
                : message,
            ),
          );
        };

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", createdAt: assistantCreatedAt, streaming: true },
        ]);

        reply = await streamMochiChatReply({
          body: {
            message: text,
            history,
            lang: language,
            provider: providerForRequest,
            providerConfig:
              providerForRequest === "openrouter"
                ? {
                    openrouterApiKey: config.openrouterApiKey,
                    openrouterModel: config.openrouterModel,
                    braveApiKey: config.braveApiKey,
                  }
                : undefined,
            character: config.character,
            soulMd: config.soulMd,
            toolContext: webSearchToolContext,
          },
          onDelta: appendStreamingAssistantDelta,
        });
        finalizeStreamingAssistant(reply);
      }

      if (!reply.trim()) {
        throw new Error("EMPTY_RESPONSE");
      }
      const finalReply = reply.trim();
      if (streamingAssistantIndex !== null) {
        setMessages((prev) =>
          prev.map((message, index) =>
            index === streamingAssistantIndex
              ? {
                  ...message,
                  content: finalReply,
                  streaming: false,
                }
              : message,
          ),
        );
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: finalReply, createdAt: new Date().toISOString() },
        ]);
      }
      void speakReply(finalReply);
      playFluteSound("success");
      if (providerForRequest === "site") {
        incrementFreeSiteMessagesUsed();
      }
    } catch (error) {
      const rawErrorMessage = String((error as Error)?.message || "");
      if (
        providerForRequest === "openclaw" &&
        (rawErrorMessage.startsWith("OPENCLAW_PAIRING_EXPIRED") ||
          rawErrorMessage.startsWith("OPENCLAW_PAIRING_INVALID"))
      ) {
        updateConfig({
          openclawPairedSessionToken: "",
          openclawPairedSessionExpiresAt: "",
        });
      }
      const fallback = formatSiteMochiProviderError(
        error,
        isSpanish,
        providerForRequest,
      );
      const messageForUser =
        providerForRequest === "openclaw" && rawErrorMessage
          ? rawErrorMessage
          : fallback;
      if (streamingAssistantIndex !== null) {
        setMessages((prev) =>
          prev.map((message, index) =>
            index === streamingAssistantIndex
              ? {
                  ...message,
                  content: messageForUser,
                  createdAt: new Date().toISOString(),
                  streaming: false,
                }
              : message,
          ),
        );
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: messageForUser, createdAt: new Date().toISOString() },
        ]);
      }
      void speakReply(messageForUser);
      playFluteSound("error");
    } finally {
      setSending(false);
      focusChatInput();
    }
  }

  function toggleVoiceListening() {
    if (config.soundInputProvider === "off") return;
    clearVoiceAutoSendCountdown();

    if (isListening) {
      stopVoiceInput();
      setVoiceInfoStatus(isSpanish ? "Micrófono detenido." : "Microphone stopped.");
      return;
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setVoiceErrorStatus(
        isSpanish
          ? "Tu navegador no soporta reconocimiento de voz (probá Chrome o Edge)."
          : "Your browser does not support speech recognition (try Chrome or Edge).",
      );
      return;
    }

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = getSpeechLocale(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex ?? 0; i < (event.results?.length ?? 0); i += 1) {
        const result = event.results[i];
        const transcript = String(result?.[0]?.transcript || "").trim();
        if (!transcript) continue;
        if (result?.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      if (interimTranscript) {
        setVoiceInfoStatus(
          isSpanish
            ? `Escuchando: ${interimTranscript}`
            : `Listening: ${interimTranscript}`,
        );
      }

      if (!finalTranscript) return;

      setInput(finalTranscript);
      scheduleVoiceAutoSend(finalTranscript);
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error || "unknown");
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? isSpanish
            ? "Permiso de micrófono denegado."
            : "Microphone permission denied."
          : code === "no-speech"
            ? isSpanish
              ? "No se detectó voz."
              : "No speech detected."
            : isSpanish
              ? "Error de reconocimiento de voz."
              : "Speech recognition error.";
      setVoiceErrorStatus(message);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setIsListening(false);
      if (!finalTranscript && !voiceStatus) {
        setVoiceInfoStatus(isSpanish ? "Micrófono detenido." : "Microphone stopped.");
      }
    };

    try {
      recognition.start();
      setIsListening(true);
      setVoiceInfoStatus(isSpanish ? "Escuchando..." : "Listening...");
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceErrorStatus(
        isSpanish ? "No se pudo iniciar el micrófono." : "Could not start the microphone.",
      );
    }
  }

function handleBubblePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (isBubbleFullscreen) return;
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (bubbleIsResizingRef.current) return;
    const hit = getBubbleResizeHit(event.clientX, event.clientY);
    setBubbleCursor(hit.cursor);
  }

function handleBubblePointerLeave() {
    if (isBubbleFullscreen) return;
    if (bubbleIsResizingRef.current) return;
    setBubbleCursor("");
  }

function handleBubblePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isBubbleFullscreen) return;
    if (event.pointerType && event.pointerType !== "mouse") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, button, textarea, select, a")) return;

    const hit = getBubbleResizeHit(event.clientX, event.clientY);
    if (!hit.canResize || !bubbleRef.current) return;

    const rect = bubbleRef.current.getBoundingClientRect();
    bubbleResizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
      left: hit.left,
      right: hit.right,
      top: hit.top,
    };
    bubbleIsResizingRef.current = true;
    setBubbleCursor(hit.cursor);
    try {
      bubbleRef.current.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    event.stopPropagation();
    event.preventDefault();
  }

  const showPressMeHint = config.enabled && !hasMascotBeenClicked && !open;
  const inputLocked = sending || !config.enabled || siteCreditsExhausted;
  const placeholderText = !config.enabled
    ? isSpanish
      ? "El Mochi web está desactivado en la configuración."
      : "Website mochi is disabled in settings."
    : siteCreditsExhausted
      ? isSpanish
        ? "Sin créditos del sitio. Usá el engranaje y configurá tus claves en Chat > Proveedor."
        : "Site credits are exhausted. Use the gear and configure your keys in Chat > Provider."
      : isSpanish
        ? "Preguntame sobre Mochi..."
        : "Ask about Mochi...";
  const showMicButton = config.soundInputProvider !== "off";
  const canUseMicButton = !inputLocked && config.soundInputProvider !== "off";

  useEffect(() => {
    return () => {
      clearVoiceAutoSendCountdown();
    };
  }, []);

  if (!config.enabled || pathname !== "/") {
    return null;
  }

  return (
    <>
      <div className={styles.wrap} ref={wrapRef} aria-hidden={false}>
        <div
          ref={actorRef}
          className={styles.actor}
          style={{
            transform: `scale(${config.sizePercent / 100})`,
            transformOrigin: "center center",
          }}
          onClick={() => {
            if (blockClickRef.current) {
              blockClickRef.current = false;
              return;
            }
            setHasMascotBeenClicked(true);
            setOpen(v => {
              const next = !v;
              if (next) ensureGreeting();
              return next;
            });
          }}
          onPointerDown={handlePointerDown}
          role="button"
          tabIndex={0}
          title={isSpanish ? "Hablá con Mochi" : "Talk to Mochi"}
        >
          {showPressMeHint && (
            <div className={styles.pressHint}>
              {isSpanish ? "🐱 Clickeame" : MASCOT_HINT_TEXT}
            </div>
          )}
          <img className={styles.sprite} src={frames.stand} alt="" ref={imgRef} draggable={false} onError={(e) => { (e.target as HTMLImageElement).src = frames.stand; }} />
          {isJumping && (
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute top-1/4 left-0 text-xl animate-ping">✦</span>
              <span className="absolute top-1/3 right-0 text-lg animate-ping animation-delay-100">✦</span>
              <span className="absolute bottom-1/3 left-1/4 text-sm animate-ping animation-delay-200">✦</span>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div
          ref={bubbleRef}
          className={`${styles.bubble} ${styles.bubbleFixed} ${bubbleStyleClass}`}
          style={bubbleInlineStyle}
          onClick={e => e.stopPropagation()}
          onPointerMove={handleBubblePointerMove}
          onPointerLeave={handleBubblePointerLeave}
          onPointerDown={handleBubblePointerDown}
        >
          <div className={styles.bubbleHeader}>
            <div className={styles.titleWrap}>
              <div className={styles.title}>{selectedCharacter?.label || "Mochi"}</div>
              <div className={styles.metaText}>
                {isSpanish ? "Chat del escritorio" : "Desktop chat"}
              </div>
            </div>
            <div className={styles.headerBtns}>
              <button
                type="button"
                className={styles.headerIconBtn}
                onClick={toggleBubbleFullscreen}
                aria-label={
                  isBubbleFullscreen
                    ? isSpanish
                      ? "Salir de pantalla completa"
                      : "Exit fullscreen"
                    : isSpanish
                      ? "Pantalla completa"
                      : "Fullscreen"
                }
                title={
                  isBubbleFullscreen
                    ? isSpanish
                      ? "Salir de pantalla completa"
                      : "Exit fullscreen"
                    : isSpanish
                      ? "Pantalla completa"
                      : "Fullscreen"
                }
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.headerIconSvg}>
                  {isBubbleFullscreen ? (
                    <>
                      <path d="M9 4H4v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 4l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 20h5v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 20l-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 9V4h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 10l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 15v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 14l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M9 4H4v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 4h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 15v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 15v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                </svg>
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  setIsBubbleFullscreen(false);
                  setOpen(false);
                }}
                aria-label={isSpanish ? "Cerrar chat" : "Close chat"}
                title={isSpanish ? "Cerrar chat" : "Close chat"}
              >
                ×
              </button>
            </div>
          </div>
          <div className={styles.bubbleBody}>
          <div className={styles.messages} ref={messagesListRef}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgAssistant}`}
                >
                  {renderMessageContent(m.content)}
                  {m.streaming ? <span className={styles.streamingCursor} aria-hidden="true">▍</span> : null}
                  {m.ctaHref && (
                    <>
                      <br />
                      <a className={styles.msgLink} href={m.ctaHref}>
                        {m.ctaLabel ?? m.ctaHref}
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.inputRow}>
              {showMicButton && (
                <button
                  className={`${styles.iconBtn} ${isListening ? styles.iconBtnActive : ""}`}
                  type="button"
                  onClick={toggleVoiceListening}
                  disabled={!canUseMicButton}
                  aria-label={
                    isListening
                      ? isSpanish
                        ? "Detener micrófono"
                        : "Stop microphone"
                      : isSpanish
                        ? "Hablar por micrófono"
                        : "Speak with microphone"
                  }
                  title={
                    !speechInputSupported
                      ? isSpanish
                        ? "Tu navegador no soporta reconocimiento de voz"
                        : "Your browser does not support speech recognition"
                      : isListening
                        ? isSpanish
                          ? "Detener"
                          : "Stop"
                        : isSpanish
                          ? "Hablar"
                          : "Talk"
                  }
                >
                  {isListening ? "■" : "🎤"}
                </button>
              )}
              <input
                ref={inputRef}
                className={styles.input}
                value={input}
                onChange={e => {
                  if (voiceAutoSendCountdown !== null) {
                    cancelVoiceAutoSend();
                  }
                  setInput(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") { unlockFluteAudioCtx(); void send(); }
                }}
                placeholder={placeholderText}
                disabled={inputLocked}
              />
              {isSpeaking && (
                <button
                  className={styles.iconBtn}
                  type="button"
                  onClick={stopVoiceOutput}
                  aria-label={isSpanish ? "Detener audio" : "Stop audio"}
                  title={isSpanish ? "Detener audio" : "Stop audio"}
                >
                  ⏹
                </button>
              )}
              <button
                className={styles.sendBtn}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  unlockFluteAudioCtx();
                  void send();
                }}
                disabled={inputLocked || !input.trim()}
                aria-label={isSpanish ? "Enviar mensaje" : "Send message"}
                title={isSpanish ? "Enviar mensaje" : "Send message"}
              >
                {sending ? (
                  "..."
                ) : (
                  <svg
                    className={styles.sendIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M21.5 3.5L10 15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21.5 3.5L14.5 21L10 15L3 10.5L21.5 3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
            {voiceStatus && (
              <div
                className={`${styles.voiceStatus} ${
                  voiceStatusTone === "error" ? styles.voiceStatusError : ""
                }`}
              >
                <span>{voiceStatus}</span>
                {voiceAutoSendCountdown !== null ? (
                  <button
                    type="button"
                    onClick={cancelVoiceAutoSend}
                    className={styles.voiceStatusAction}
                  >
                    {isSpanish ? "Cancelar" : "Cancel"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
          <div className={styles.resizeGripLeft} aria-hidden="true" />
          <div className={styles.resizeGripRight} aria-hidden="true" />
          <div className={styles.resizeGripTop} aria-hidden="true" />
          <div className={styles.resizeCorner} aria-hidden="true" />
        </div>
      )}
    </>
  );
}
