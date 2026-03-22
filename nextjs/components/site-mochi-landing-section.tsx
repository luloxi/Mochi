"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookText,
  BookOpen,
  CircleHelp,
  Download,
  Palette,
  Settings2,
  ShoppingBag,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useSiteMochi } from "@/components/site-mochi-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import { useWalletSession } from "@/components/wallet-provider";
import {
  CONFIG_WINDOW_META,
  DesktopConfigIcon,
  SiteMochiCompactConfigWindow,
  type ConfigPanelTab,
} from "@/components/site-mochi-config-panel";
import { SITE_DESKTOP_OPEN_WINDOW_EVENT, type SiteDesktopWindowKey } from "@/lib/site-desktop-window";

type DesktopConfigShortcutProps = {
  shortcutKey: DesktopWindowKey;
  label: string;
  configKey?: ConfigPanelTab;
  customIcon?: LucideIcon;
};

type DesktopWindowKey =
  | ConfigPanelTab
  | "memories"
  | "personalize"
  | "config"
  | "marketplace"
  | "creator"
  | "guide"
  | "help"
  | "download";

type StoredChatMessage = {
  role: "user" | "assistant";
  content: string;
  ctaHref?: string;
  ctaLabel?: string;
  createdAt?: string;
};

type DesktopShortcutPosition = {
  x: number;
  y: number;
};

type DesktopShortcutDragState = {
  pointerId: number;
  shortcutKey: DesktopWindowKey;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

type DesktopWindowPosition = {
  x: number;
  y: number;
};

type DesktopWindowDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type DesktopWindowSize = {
  width: number;
  height: number;
};

type DesktopWindowResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DesktopWindowResizeState = {
  pointerId: number;
  handle: DesktopWindowResizeHandle;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

const DESKTOP_SHORTCUT_KEYS: DesktopWindowKey[] = [
  "personalize",
  "marketplace",
  "creator",
  "guide",
  "help",
  "download",
  "soul",
  "config",
  "memories",
];

const DESKTOP_SHORTCUT_WIDTH = 62;
const DESKTOP_SHORTCUT_HEIGHT = 74;
const DESKTOP_SHORTCUT_START_X = 20;
const DESKTOP_SHORTCUT_START_Y = 20;
const DESKTOP_SHORTCUT_COLUMN_WIDTH = 74;
const DESKTOP_SHORTCUT_ROW_HEIGHT = 72;
const DESKTOP_WINDOW_MARGIN = 16;
const DESKTOP_WINDOW_TOP_OFFSET = 0;
const DESKTOP_WINDOW_MIN_WIDTH = 420;
const DESKTOP_WINDOW_MIN_HEIGHT = 320;
const DESKTOP_WINDOW_MARKETPLACE_MIN_WIDTH = 760;
const DESKTOP_WINDOW_MARKETPLACE_MIN_HEIGHT = 520;
const SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY = "site-mochi-chat-history-v1";
const SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT = "site-mochi:chat-history-updated";
const DESKTOP_DEFAULT_SHORTCUT_ROWS: DesktopWindowKey[][] = [
  ["personalize", "marketplace", "creator", "guide"],
  ["help", "download", "soul", "config", "memories"],
];
const MOBILE_SHORTCUT_ROWS: DesktopWindowKey[][] = [
  ["personalize", "marketplace", "creator", "guide"],
  ["help", "download", "soul", "config", "memories"],
];

function clampDesktopWindowPosition(
  position: DesktopWindowPosition,
  containerWidth: number,
  containerHeight: number,
  windowWidth: number,
  windowHeight: number,
): DesktopWindowPosition {
  const minTop = DESKTOP_WINDOW_TOP_OFFSET;
  return {
    x: Math.max(
      DESKTOP_WINDOW_MARGIN,
      Math.min(position.x, Math.max(DESKTOP_WINDOW_MARGIN, containerWidth - windowWidth - DESKTOP_WINDOW_MARGIN)),
    ),
    y: Math.max(
      minTop,
      Math.min(
        position.y,
        Math.max(minTop, containerHeight - windowHeight - DESKTOP_WINDOW_MARGIN),
      ),
    ),
  };
}

function getDesktopWindowMinSize(isMarketplaceWindow: boolean): DesktopWindowSize {
  return {
    width: isMarketplaceWindow ? DESKTOP_WINDOW_MARKETPLACE_MIN_WIDTH : DESKTOP_WINDOW_MIN_WIDTH,
    height: isMarketplaceWindow ? DESKTOP_WINDOW_MARKETPLACE_MIN_HEIGHT : DESKTOP_WINDOW_MIN_HEIGHT,
  };
}

function getDesktopWindowDefaultSize(
  isMarketplaceWindow: boolean,
  containerWidth: number,
  containerHeight: number,
): DesktopWindowSize {
  const minSize = getDesktopWindowMinSize(isMarketplaceWindow);
  const preferredWidth = isMarketplaceWindow ? 1200 : 760;
  const preferredHeight = isMarketplaceWindow ? 860 : 720;

  return {
    width: Math.max(minSize.width, Math.min(preferredWidth, containerWidth - DESKTOP_WINDOW_MARGIN * 2)),
    height: Math.max(minSize.height, Math.min(preferredHeight, containerHeight - DESKTOP_WINDOW_MARGIN * 2)),
  };
}

function getDesktopGridBounds(containerWidth: number, containerHeight: number) {
  return {
    maxColumn: Math.max(
      0,
      Math.floor(
        (containerWidth -
          DESKTOP_SHORTCUT_START_X -
          DESKTOP_WINDOW_MARGIN -
          DESKTOP_SHORTCUT_WIDTH) /
          DESKTOP_SHORTCUT_COLUMN_WIDTH,
      ),
    ),
    maxRow: Math.max(
      0,
      Math.floor(
        (containerHeight -
          DESKTOP_SHORTCUT_START_Y -
          DESKTOP_WINDOW_MARGIN -
          DESKTOP_SHORTCUT_HEIGHT) /
          DESKTOP_SHORTCUT_ROW_HEIGHT,
      ),
    ),
  };
}

function snapShortcutPosition(
  position: DesktopShortcutPosition,
  containerWidth: number,
  containerHeight: number,
): DesktopShortcutPosition {
  const { maxColumn, maxRow } = getDesktopGridBounds(containerWidth, containerHeight);
  const column = Math.max(
    0,
    Math.min(
      maxColumn,
      Math.round((position.x - DESKTOP_SHORTCUT_START_X) / DESKTOP_SHORTCUT_COLUMN_WIDTH),
    ),
  );
  const row = Math.max(
    0,
    Math.min(
      maxRow,
      Math.round((position.y - DESKTOP_SHORTCUT_START_Y) / DESKTOP_SHORTCUT_ROW_HEIGHT),
    ),
  );

  return {
    x: DESKTOP_SHORTCUT_START_X + column * DESKTOP_SHORTCUT_COLUMN_WIDTH,
    y: DESKTOP_SHORTCUT_START_Y + row * DESKTOP_SHORTCUT_ROW_HEIGHT,
  };
}

function buildDefaultShortcutPositions(
  containerWidth: number,
  containerHeight: number,
): Record<DesktopWindowKey, DesktopShortcutPosition> {
  const positions = {} as Record<DesktopWindowKey, DesktopShortcutPosition>;
  const topRowY = DESKTOP_SHORTCUT_START_Y;
  const middleRowY = Math.max(
    DESKTOP_SHORTCUT_START_Y,
    Math.round((containerHeight - DESKTOP_SHORTCUT_HEIGHT) / 2 / DESKTOP_SHORTCUT_ROW_HEIGHT) *
      DESKTOP_SHORTCUT_ROW_HEIGHT,
  );
  const bottomRowY = Math.max(
    DESKTOP_SHORTCUT_START_Y,
    containerHeight - DESKTOP_WINDOW_MARGIN - DESKTOP_SHORTCUT_HEIGHT - DESKTOP_SHORTCUT_ROW_HEIGHT,
  );
  const rowAnchors = [topRowY, middleRowY, bottomRowY];

  DESKTOP_DEFAULT_SHORTCUT_ROWS.forEach((row, rowIndex) => {
    const rowY =
      DESKTOP_DEFAULT_SHORTCUT_ROWS.length === 1 ? bottomRowY : rowAnchors[rowIndex] ?? bottomRowY;
    const rowWidth = row.length * DESKTOP_SHORTCUT_WIDTH + Math.max(0, row.length - 1) * (DESKTOP_SHORTCUT_COLUMN_WIDTH - DESKTOP_SHORTCUT_WIDTH);
    const startX = Math.round((containerWidth - rowWidth) / 2);
    row.forEach((shortcutKey, index) => {
      positions[shortcutKey] = snapShortcutPosition(
        {
          x: startX + index * DESKTOP_SHORTCUT_COLUMN_WIDTH,
          y: rowY,
        },
        containerWidth,
        containerHeight,
      );
    });
  });

  for (const shortcutKey of DESKTOP_SHORTCUT_KEYS) {
    if (!positions[shortcutKey]) {
      positions[shortcutKey] = snapShortcutPosition(
        {
          x: containerWidth - DESKTOP_WINDOW_MARGIN - DESKTOP_SHORTCUT_WIDTH,
          y: topRowY,
        },
        containerWidth,
        containerHeight,
      );
    }
  }

  return positions;
}

function DesktopConfigShortcut({
  shortcutKey,
  label,
  configKey,
  customIcon: CustomIcon,
  iconTheme,
  theme,
  characterKey,
  onOpen,
  className,
  style,
  onPointerDown,
  onDragStart,
}: DesktopConfigShortcutProps & {
  iconTheme: ReturnType<typeof useSiteMochi>["config"]["iconTheme"];
  theme: Theme;
  characterKey: string;
  onOpen: (tab: DesktopWindowKey) => void;
  className?: string;
  style?: CSSProperties;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>, tab: DesktopWindowKey) => void;
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
}) {
  const isBlackPink = theme === "black-pink";
  const shortcutToneClass = isBlackPink ? "text-[#ff78c8]" : "text-foreground";
  const shortcutLabelClass = isBlackPink ? "text-[#ff78c8]" : "text-foreground/85";
  const shortcutGlowClass = isBlackPink ? "drop-shadow-[0_0_10px_rgba(255,120,200,0.35)]" : "drop-shadow-[3px_3px_0_rgba(24,18,37,0.18)]";

  return (
    <button
      type="button"
      onClick={() => onOpen(shortcutKey)}
      onPointerDown={onPointerDown ? (event) => onPointerDown(event, shortcutKey) : undefined}
      onDragStart={onDragStart}
      draggable={false}
      className={`group flex w-[76px] flex-col items-center gap-1.5 rounded-none p-1 text-center transition-transform duration-150 hover:-translate-y-1 lg:w-[62px] lg:gap-1 ${className ?? ""}`}
      style={style}
    >
      <span
        className="relative flex h-12 w-12 items-center justify-center transition-all duration-150 group-hover:translate-x-[2px] group-hover:translate-y-[2px] lg:h-10 lg:w-10"
        draggable={false}
      >
        <div className={shortcutGlowClass}>
          {configKey ? (
            <DesktopConfigIcon
              tab={configKey}
              iconTheme={iconTheme}
              characterKey={characterKey}
              className={`h-12 w-12 object-contain lg:h-10 lg:w-10 ${shortcutToneClass}`}
            />
          ) : CustomIcon ? (
            <CustomIcon className={`h-11 w-11 lg:h-9 lg:w-9 ${shortcutToneClass}`} strokeWidth={1.8} />
          ) : null}
        </div>
      </span>
      <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.18em] lg:text-[8px] ${shortcutLabelClass}`}>
        {label}
      </span>
    </button>
  );
}

function getEmbeddedWindowPath(windowKey: DesktopWindowKey) {
  if (windowKey === "marketplace") return "/marketplace?embedded=1";
  if (windowKey === "creator") return "/character-creator?embedded=1";
  if (windowKey === "guide") return "/animation-guide?embedded=1";
  if (windowKey === "help") return "/help?embedded=1";
  if (windowKey === "download") return "/download?embedded=1";
  return null;
}

function sanitizeStoredChatMessages(input: unknown): StoredChatMessage[] {
  if (!Array.isArray(input)) return [];

  const out: StoredChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const role = (item as any).role;
    const content = typeof (item as any).content === "string" ? (item as any).content.slice(0, 4000) : "";
    const ctaHref = typeof (item as any).ctaHref === "string" ? (item as any).ctaHref.slice(0, 512) : undefined;
    const ctaLabel =
      typeof (item as any).ctaLabel === "string" ? (item as any).ctaLabel.slice(0, 120) : undefined;
    const createdAtRaw = typeof (item as any).createdAt === "string" ? (item as any).createdAt : "";
    const createdAt =
      createdAtRaw && Number.isFinite(Date.parse(createdAtRaw)) ? new Date(createdAtRaw).toISOString() : undefined;

    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content, ctaHref, ctaLabel, createdAt });
    }
  }

  return out;
}

function formatMemoryDayLabel(dateKey: string, isSpanish: boolean) {
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(isSpanish ? "es-AR" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function formatMemoryTimeLabel(value: string | undefined, isSpanish: boolean) {
  if (!value) return isSpanish ? "Sin hora" : "No time";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return isSpanish ? "Sin hora" : "No time";
  return new Intl.DateTimeFormat(isSpanish ? "es-AR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function groupMemoriesByDay(messages: StoredChatMessage[]) {
  const groups = new Map<string, StoredChatMessage[]>();

  messages.forEach((message, index) => {
    const dateKey =
      message.createdAt && Number.isFinite(Date.parse(message.createdAt))
        ? new Date(message.createdAt).toISOString().slice(0, 10)
        : `legacy-${index}`;
    const group = groups.get(dateKey) ?? [];
    group.push(message);
    groups.set(dateKey, group);
  });

  return Array.from(groups.entries())
    .map(([dateKey, entries]) => ({
      dateKey,
      entries,
    }))
    .sort((a, b) => {
      if (a.dateKey.startsWith("legacy-") && b.dateKey.startsWith("legacy-")) return 0;
      if (a.dateKey.startsWith("legacy-")) return 1;
      if (b.dateKey.startsWith("legacy-")) return -1;
      return b.dateKey.localeCompare(a.dateKey);
    });
}

function DesktopMemoriesWindow({
  isSpanish,
  messages,
  onClear,
}: {
  isSpanish: boolean;
  messages: StoredChatMessage[];
  onClear: () => void;
}) {
  const groupedMessages = useMemo(() => groupMemoriesByDay(messages), [messages]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (!groupedMessages.length) {
      setSelectedDateKey(null);
      return;
    }

    if (!selectedDateKey || !groupedMessages.some((group) => group.dateKey === selectedDateKey)) {
      setSelectedDateKey(groupedMessages[0].dateKey);
    }
  }, [groupedMessages, selectedDateKey]);

  const activeGroup =
    groupedMessages.find((group) => group.dateKey === selectedDateKey) ?? groupedMessages[0] ?? null;
  const handleClearClick = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        isSpanish
          ? "¿Seguro que querés borrar todas las memorias guardadas?"
          : "Are you sure you want to delete all saved memories?",
      )
    ) {
      return;
    }

    onClear();
  };

  return (
    <section className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/72 text-foreground shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        {messages.length ? (
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="mochi-themed-scrollbar min-h-0 overflow-y-auto rounded-[1.75rem] border border-border bg-background/55 p-2">
              <div className="mb-2 flex flex-col items-start gap-2 px-2 pt-1 lg:flex-row lg:items-center lg:justify-between">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {isSpanish ? "Dias" : "Days"}
                </div>
                <button
                  type="button"
                  onClick={handleClearClick}
                  className="rounded-none border border-border bg-background/60 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-background/80"
                >
                  {isSpanish ? "Borrar" : "Clear"}
                </button>
              </div>
              <div className="grid gap-2">
                {groupedMessages.map((group) => {
                  const isActive = group.dateKey === activeGroup?.dateKey;
                  const label = group.dateKey.startsWith("legacy-")
                    ? isSpanish
                      ? "Conversaciones anteriores"
                      : "Earlier conversations"
                    : formatMemoryDayLabel(group.dateKey, isSpanish);
                  return (
                    <button
                      key={group.dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(group.dateKey)}
                      className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                        isActive
                          ? "border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/12 shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
                          : "border-border bg-background/55 hover:bg-background/75"
                      }`}
                    >
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {group.entries.length} {group.entries.length === 1 ? (isSpanish ? "mensaje" : "message") : (isSpanish ? "mensajes" : "messages")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-background/45">
              {activeGroup ? (
                <>
                  <div className="mochi-themed-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable]">
                    <div className="grid gap-2">
                      {activeGroup.entries.map((message, index) => (
                        <article
                          key={`${activeGroup.dateKey}-${message.role}-${index}`}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "border-border bg-background/75"
                              : "border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <span>{message.role === "user" ? (isSpanish ? "Vos" : "You") : "Mochi"}</span>
                            <span>{formatMemoryTimeLabel(message.createdAt, isSpanish)}</span>
                          </div>
                          <div className="whitespace-pre-wrap break-words text-[13px] leading-5 text-foreground">
                            {message.content}
                          </div>
                          {message.ctaHref ? (
                            <a className="mt-2 inline-block text-xs underline underline-offset-2" href={message.ctaHref}>
                              {message.ctaLabel ?? message.ctaHref}
                            </a>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/35 px-4 text-center text-sm text-muted-foreground">
            {isSpanish
              ? "Todavia no hay recuerdos guardados de la charla con Mochi."
              : "There are no saved memories from your Mochi chat yet."}
          </div>
        )}
      </div>
    </section>
  );
}

function DesktopPersonalizeWindow({
  isSpanish,
}: {
  isSpanish: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"mascot" | "appearance" | "site">("mascot");
  const tabs: Array<{ key: "mascot" | "appearance" | "site"; label: string }> = [
    { key: "mascot", label: isSpanish ? "Mascota" : "Mascot" },
    { key: "appearance", label: "Chat" },
    { key: "site", label: isSpanish ? "Tema" : "Theme" },
  ];

  return (
    <section className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/72 text-foreground shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="grid grid-cols-3 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-w-0 border-r border-border px-2 py-3 text-center text-xs font-semibold transition last:border-r-0 ${
                isActive
                  ? "bg-[var(--brand-accent)]/15 text-foreground"
                  : "bg-background/35 text-foreground/80 hover:bg-background/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SiteMochiCompactConfigWindow activeTab={activeTab} fillHeight />
      </div>
    </section>
  );
}

function DesktopConfigWindow({
  isSpanish,
}: {
  isSpanish: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "tools" | "onchain" | "sound">("chat");
  const tabs: Array<{ key: "chat" | "tools" | "onchain" | "sound"; label: string }> = [
    { key: "chat", label: isSpanish ? "Proveedor" : "Provider" },
    { key: "tools", label: isSpanish ? "Internet" : "Internet" },
    { key: "onchain", label: "Onchain" },
    { key: "sound", label: isSpanish ? "Sonido" : "Sound" },
  ];

  return (
    <section className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/72 text-foreground shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="grid grid-cols-4 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-w-0 border-r border-border px-2 py-3 text-center text-xs font-semibold transition last:border-r-0 ${
                isActive
                  ? "bg-[var(--brand-accent)]/15 text-foreground"
                  : "bg-background/35 text-foreground/80 hover:bg-background/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SiteMochiCompactConfigWindow activeTab={activeTab} fillHeight />
      </div>
    </section>
  );
}

export function SiteMochiLandingSection() {
  const { isSpanish, language, setLanguage } = useLanguage();
  const { config } = useSiteMochi();
  const { theme } = useTheme();
  const { isAvailable, isConnected, isConnecting, publicKey, connect, disconnect } = useWalletSession();
  const [activeDesktopWindow, setActiveDesktopWindow] = useState<DesktopWindowKey | null>(null);
  const [entryGateOpen, setEntryGateOpen] = useState(false);
  const [shortcutPositions, setShortcutPositions] = useState<Record<DesktopWindowKey, DesktopShortcutPosition>>(
    {} as Record<DesktopWindowKey, DesktopShortcutPosition>,
  );
  const [desktopWindowPosition, setDesktopWindowPosition] = useState<DesktopWindowPosition | null>(null);
  const [desktopWindowSize, setDesktopWindowSize] = useState<DesktopWindowSize | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [memoryMessages, setMemoryMessages] = useState<StoredChatMessage[]>([]);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const desktopWindowLayerRef = useRef<HTMLDivElement | null>(null);
  const desktopWindowRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DesktopShortcutDragState | null>(null);
  const desktopWindowDragStateRef = useRef<DesktopWindowDragState | null>(null);
  const desktopWindowResizeStateRef = useRef<DesktopWindowResizeState | null>(null);
  const desktopWindowDragCaptureRef = useRef<HTMLElement | null>(null);
  const desktopWindowResizeCaptureRef = useRef<HTMLElement | null>(null);

  const t = (en: string, es: string) => (isSpanish ? es : en);
  const hasBlackPinkBackdrop = theme === "black-pink";
  const embeddedWindowPath = activeDesktopWindow ? getEmbeddedWindowPath(activeDesktopWindow) : null;
  const walletLabel = isConnected && publicKey
    ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
    : isConnecting
      ? t("Connecting...", "Conectando...")
      : t("Connect wallet", "Conectar wallet");
  const isWideWindow =
    activeDesktopWindow === "marketplace" ||
    activeDesktopWindow === "creator" ||
    activeDesktopWindow === "guide" ||
    activeDesktopWindow === "help" ||
    activeDesktopWindow === "download";
  const activeWindowMeta = activeDesktopWindow
    ? CONFIG_WINDOW_META.find((item) => item.key === activeDesktopWindow) ?? null
    : null;

  const handleWalletButtonClick = () => {
    if (isConnected) {
      disconnect();
      return;
    }
    if (!isAvailable || isConnecting) {
      return;
    }
    void connect();
  };

  const desktopShortcuts: DesktopConfigShortcutProps[] = [
    { shortcutKey: "personalize", label: t("Appearance", "Apariencia"), customIcon: Palette },
    { shortcutKey: "marketplace", label: t("Marketplace", "Marketplace"), customIcon: ShoppingBag },
    { shortcutKey: "creator", label: t("Create", "Crear"), customIcon: Wand2 },
    { shortcutKey: "guide", label: t("Guide", "Guía"), customIcon: BookOpen },
    { shortcutKey: "help", label: t("Help", "Ayuda"), customIcon: CircleHelp },
    { shortcutKey: "download", label: t("Download", "Descarga"), customIcon: Download },
    { shortcutKey: "soul", configKey: "soul", label: "Soul" },
    { shortcutKey: "config", label: t("Config", "Config"), customIcon: Settings2 },
    { shortcutKey: "memories", label: t("Memories", "Memorias"), customIcon: BookText },
  ];
  const mobileShortcuts: DesktopConfigShortcutProps[] = [
    { shortcutKey: "personalize", label: t("Appearance", "Apariencia"), customIcon: Palette },
    { shortcutKey: "marketplace", label: t("Marketplace", "Marketplace"), customIcon: ShoppingBag },
    { shortcutKey: "creator", label: t("Create", "Crear"), customIcon: Wand2 },
    { shortcutKey: "guide", label: t("Guide", "Guía"), customIcon: BookOpen },
    { shortcutKey: "help", label: t("Help", "Ayuda"), customIcon: CircleHelp },
    { shortcutKey: "download", label: t("Download", "Descarga"), customIcon: Download },
    { shortcutKey: "soul", configKey: "soul", label: "Soul" },
    { shortcutKey: "config", label: t("Config", "Config"), customIcon: Settings2 },
    { shortcutKey: "memories", label: t("Memories", "Memorias"), customIcon: BookText },
  ];
  const mobileShortcutRows = MOBILE_SHORTCUT_ROWS;
  const shortcutByKey = Object.fromEntries(
    mobileShortcuts.map((shortcut) => [shortcut.shortcutKey, shortcut]),
  ) as Record<DesktopWindowKey, DesktopConfigShortcutProps>;

  useLayoutEffect(() => {
    const desktop = desktopRef.current;
    if (!desktop) return;

    const syncPositions = () => {
      const nextDefaults = buildDefaultShortcutPositions(desktop.clientWidth, desktop.clientHeight);
      setShortcutPositions((current) => {
        if (Object.keys(current).length === 0) {
          return nextDefaults;
        }

        const nextPositions = { ...nextDefaults, ...current };
        for (const configKey of DESKTOP_SHORTCUT_KEYS) {
          nextPositions[configKey] = snapShortcutPosition(
            nextPositions[configKey] ?? nextDefaults[configKey],
            desktop.clientWidth,
            desktop.clientHeight,
          );
        }
        return nextPositions;
      });
    };

    syncPositions();

    const resizeObserver = new ResizeObserver(() => {
      syncPositions();
    });
    resizeObserver.observe(desktop);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeDesktopWindow]);

  useEffect(() => {
    const stopDesktopWindowResize = (pointerId?: number) => {
      const resizeState = desktopWindowResizeStateRef.current;
      desktopWindowResizeStateRef.current = null;
      const captureEl = desktopWindowResizeCaptureRef.current;
      desktopWindowResizeCaptureRef.current = null;
      if (!resizeState || !captureEl || pointerId === undefined) return;
      try {
        captureEl.releasePointerCapture(pointerId);
      } catch {
        // no-op
      }
    };

    const stopDesktopWindowDrag = (pointerId?: number) => {
      const dragState = desktopWindowDragStateRef.current;
      desktopWindowDragStateRef.current = null;
      const captureEl = desktopWindowDragCaptureRef.current;
      desktopWindowDragCaptureRef.current = null;
      if (!dragState || !captureEl || pointerId === undefined) return;
      try {
        captureEl.releasePointerCapture(pointerId);
      } catch {
        // no-op
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = desktopWindowResizeStateRef.current;
      const desktopWindowLayer = desktopWindowLayerRef.current;
      if (resizeState && desktopWindowLayer && event.pointerId === resizeState.pointerId) {
        if (event.pointerType === "mouse" && event.buttons === 0) {
          stopDesktopWindowResize(resizeState.pointerId);
          return;
        }
        const minSize = getDesktopWindowMinSize(
          activeDesktopWindow === "marketplace" ||
          activeDesktopWindow === "creator" ||
          activeDesktopWindow === "guide" ||
          activeDesktopWindow === "help" ||
          activeDesktopWindow === "download",
        );
        const right = resizeState.startLeft + resizeState.startWidth;
        const bottom = resizeState.startTop + resizeState.startHeight;
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        let nextLeft = resizeState.startLeft;
        let nextTop = resizeState.startTop;
        let nextWidth = resizeState.startWidth;
        let nextHeight = resizeState.startHeight;

        if (resizeState.handle.includes("e")) {
          nextWidth = Math.max(
            minSize.width,
            Math.min(
              resizeState.startWidth + dx,
              desktopWindowLayer.clientWidth - resizeState.startLeft - DESKTOP_WINDOW_MARGIN,
            ),
          );
        }

        if (resizeState.handle.includes("s")) {
          nextHeight = Math.max(
            minSize.height,
            Math.min(
              resizeState.startHeight + dy,
              desktopWindowLayer.clientHeight - resizeState.startTop - DESKTOP_WINDOW_MARGIN,
            ),
          );
        }

        if (resizeState.handle.includes("w")) {
          nextLeft = Math.max(
            DESKTOP_WINDOW_MARGIN,
            Math.min(resizeState.startLeft + dx, right - minSize.width),
          );
          nextWidth = right - nextLeft;
        }

        if (resizeState.handle.includes("n")) {
          nextTop = Math.max(
            DESKTOP_WINDOW_TOP_OFFSET,
            Math.min(resizeState.startTop + dy, bottom - minSize.height),
          );
          nextHeight = bottom - nextTop;
        }

        setDesktopWindowPosition(
          clampDesktopWindowPosition(
            { x: nextLeft, y: nextTop },
            desktopWindowLayer.clientWidth,
            desktopWindowLayer.clientHeight,
            nextWidth,
            nextHeight,
          ),
        );
        setDesktopWindowSize({
          width: Math.min(nextWidth, desktopWindowLayer.clientWidth - nextLeft - DESKTOP_WINDOW_MARGIN),
          height: Math.min(nextHeight, desktopWindowLayer.clientHeight - nextTop - DESKTOP_WINDOW_MARGIN),
        });
        return;
      }

      const windowDragState = desktopWindowDragStateRef.current;
      const desktopWindow = desktopWindowRef.current;
      if (windowDragState && desktopWindowLayer && desktopWindow && event.pointerId === windowDragState.pointerId) {
        if (event.pointerType === "mouse" && event.buttons === 0) {
          stopDesktopWindowDrag(windowDragState.pointerId);
          return;
        }
        const layerBounds = desktopWindowLayer.getBoundingClientRect();
        setDesktopWindowPosition(
          clampDesktopWindowPosition(
            {
              x: event.clientX - layerBounds.left - windowDragState.offsetX,
              y: event.clientY - layerBounds.top - windowDragState.offsetY,
            },
            desktopWindowLayer.clientWidth,
            desktopWindowLayer.clientHeight,
            desktopWindow.offsetWidth,
            desktopWindow.offsetHeight,
          ),
        );
        return;
      }

      const dragState = dragStateRef.current;
      const desktop = desktopRef.current;
      if (!dragState || !desktop || event.pointerId !== dragState.pointerId) return;

      const nextPosition = snapShortcutPosition(
        {
          x: event.clientX - desktop.getBoundingClientRect().left - dragState.offsetX,
          y: event.clientY - desktop.getBoundingClientRect().top - dragState.offsetY,
        },
        desktop.clientWidth,
        desktop.clientHeight,
      );

      if (
        !dragState.moved &&
        (Math.abs(nextPosition.x - dragState.originX) > 4 || Math.abs(nextPosition.y - dragState.originY) > 4)
      ) {
        dragStateRef.current = { ...dragState, moved: true };
      }

      setShortcutPositions((current) => ({
        ...current,
        [dragState.shortcutKey]: nextPosition,
      }));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const resizeState = desktopWindowResizeStateRef.current;
      if (resizeState && event.pointerId === resizeState.pointerId) {
        stopDesktopWindowResize(resizeState.pointerId);
        return;
      }

      const windowDragState = desktopWindowDragStateRef.current;
      if (windowDragState && event.pointerId === windowDragState.pointerId) {
        stopDesktopWindowDrag(windowDragState.pointerId);
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      window.setTimeout(() => {
        dragStateRef.current = null;
      }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, []);

  const handleShortcutOpen = (tab: DesktopWindowKey) => {
    if (dragStateRef.current?.shortcutKey === tab && dragStateRef.current.moved) {
      return;
    }

    setDesktopWindowPosition(null);
    setDesktopWindowSize(null);
    setActiveDesktopWindow(tab);
  };

  const handleShortcutPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    tab: DesktopWindowKey,
  ) => {
    if (event.pointerType !== "mouse" || window.innerWidth < 1024) return;
    event.preventDefault();

    const desktop = desktopRef.current;
    if (!desktop) return;

    const currentPosition = shortcutPositions[tab];
    if (!currentPosition) return;

    const desktopBounds = desktop.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      shortcutKey: tab,
      originX: currentPosition.x,
      originY: currentPosition.y,
      offsetX: event.clientX - desktopBounds.left - currentPosition.x,
      offsetY: event.clientY - desktopBounds.top - currentPosition.y,
      moved: false,
    };
  };

  const handleShortcutDragStart = (event: ReactDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const handleOpenWindow = (event: Event) => {
      const customEvent = event as CustomEvent<{ windowKey?: SiteDesktopWindowKey }>;
      const windowKey = customEvent.detail?.windowKey;
      if (!windowKey) return;
      customEvent.preventDefault();
      setDesktopWindowPosition(null);
      setDesktopWindowSize(null);
      setActiveDesktopWindow(windowKey);
    };

    window.addEventListener(SITE_DESKTOP_OPEN_WINDOW_EVENT, handleOpenWindow as EventListener);
    return () => window.removeEventListener(SITE_DESKTOP_OPEN_WINDOW_EVENT, handleOpenWindow as EventListener);
  }, []);

  useEffect(() => {
    const loadMemoryMessages = () => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY);
        setMemoryMessages(raw ? sanitizeStoredChatMessages(JSON.parse(raw)) : []);
      } catch {
        setMemoryMessages([]);
      }
    };

    loadMemoryMessages();
    window.addEventListener("storage", loadMemoryMessages);
    window.addEventListener(SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT, loadMemoryMessages);
    return () => {
      window.removeEventListener("storage", loadMemoryMessages);
      window.removeEventListener(SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT, loadMemoryMessages);
    };
  }, []);

  const handleClearMemories = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SITE_MOCHI_CHAT_HISTORY_STORAGE_KEY);
    setMemoryMessages([]);
    window.dispatchEvent(new Event(SITE_MOCHI_CHAT_HISTORY_UPDATED_EVENT));
  };

  useLayoutEffect(() => {
    if (!activeDesktopWindow) return;

    const centerDesktopWindow = () => {
      const layer = desktopWindowLayerRef.current;
      const windowEl = desktopWindowRef.current;
      if (!layer || !windowEl) return;
      const defaultSize = getDesktopWindowDefaultSize(
        activeDesktopWindow === "marketplace" ||
          activeDesktopWindow === "creator" ||
          activeDesktopWindow === "guide" ||
          activeDesktopWindow === "help" ||
          activeDesktopWindow === "download",
        layer.clientWidth,
        layer.clientHeight,
      );
      const nextSize = desktopWindowSize ?? defaultSize;

      if (!desktopWindowSize) {
        setDesktopWindowSize(defaultSize);
      }

      setDesktopWindowPosition((current) => {
        if (current) {
          return clampDesktopWindowPosition(
            current,
            layer.clientWidth,
            layer.clientHeight,
            nextSize.width,
            nextSize.height,
          );
        }

        return clampDesktopWindowPosition(
          {
            x: Math.round((layer.clientWidth - nextSize.width) / 2),
            y: Math.max(
              DESKTOP_WINDOW_MARGIN,
              Math.round((layer.clientHeight - nextSize.height) / 2),
            ),
          },
          layer.clientWidth,
          layer.clientHeight,
          nextSize.width,
          nextSize.height,
        );
      });
    };

    centerDesktopWindow();

    const resizeObserver = new ResizeObserver(() => {
      centerDesktopWindow();
    });

    if (desktopWindowLayerRef.current) resizeObserver.observe(desktopWindowLayerRef.current);
    if (desktopWindowRef.current) resizeObserver.observe(desktopWindowRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeDesktopWindow, desktopWindowSize]);

  const handleDesktopWindowPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;

    const layer = desktopWindowLayerRef.current;
    const windowEl = desktopWindowRef.current;
    if (!layer || !windowEl || !desktopWindowPosition) return;

    desktopWindowResizeStateRef.current = null;
    desktopWindowResizeCaptureRef.current = null;
    const layerBounds = layer.getBoundingClientRect();
    desktopWindowDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - layerBounds.left - desktopWindowPosition.x,
      offsetY: event.clientY - layerBounds.top - desktopWindowPosition.y,
    };
    desktopWindowDragCaptureRef.current = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    event.preventDefault();
  };

  const handleDesktopWindowResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    handle: DesktopWindowResizeHandle,
  ) => {
    if (event.pointerType !== "mouse") return;
    event.stopPropagation();
    event.preventDefault();

    const layer = desktopWindowLayerRef.current;
    const windowEl = desktopWindowRef.current;
    if (!layer || !windowEl || !desktopWindowPosition) return;

    desktopWindowDragStateRef.current = null;
    desktopWindowDragCaptureRef.current = null;
    desktopWindowResizeStateRef.current = {
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: desktopWindowPosition.x,
      startTop: desktopWindowPosition.y,
      startWidth: windowEl.offsetWidth,
      startHeight: windowEl.offsetHeight,
    };
    desktopWindowResizeCaptureRef.current = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
  };

  return (
    <section className="relative h-full max-h-full overflow-hidden lg:min-h-0">
      {!hasBlackPinkBackdrop ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(112,164,222,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(61,43,82,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(61,43,82,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.4),transparent_55%)]" />
        </>
      ) : null}

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="fixed inset-x-0 top-0 z-30 border-b-2 border-white/25 bg-background/70 px-2 py-1.5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-6 items-center overflow-visible">
                <Image src="/logo.png" alt="Mochi" width={34} height={34} className="h-[34px] w-[34px] object-contain" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLanguage(language === "es" ? "en" : "es")}
                aria-label={t("Switch language", "Cambiar idioma")}
                title={t("Switch language", "Cambiar idioma")}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-none border border-foreground/10 bg-card/45 px-2 text-sm transition-all duration-150 hover:border-foreground/20 hover:bg-card/75"
              >
                <span aria-hidden="true">{language === "es" ? "🇦🇷" : "🇺🇸"}</span>
              </button>
              <button
                type="button"
                onClick={handleWalletButtonClick}
                disabled={(!isConnected && !isAvailable) || isConnecting}
                className="inline-flex h-8 items-center justify-center rounded-none border border-foreground/10 bg-card/55 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {walletLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 overflow-hidden pt-10">
          {!hasBlackPinkBackdrop ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(61,43,82,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(61,43,82,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />
            </>
          ) : null}

          <div ref={desktopRef} className="relative z-10 min-h-0 flex-1 overflow-hidden p-5">
            <div className="flex h-full min-h-0 items-end pb-3 pt-2 lg:hidden">
              {mobileShortcutRows.map((row, rowIndex) => (
                <div
                  key={`mobile-row-${rowIndex}`}
                  className={`grid w-full items-end justify-items-center ${row.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}
                >
                  {row.map((shortcutKey) => {
                    const shortcut = shortcutByKey[shortcutKey];
                    return (
                      <DesktopConfigShortcut
                        key={shortcut.shortcutKey}
                        {...shortcut}
                        iconTheme={config.iconTheme}
                        theme={theme}
                        characterKey={config.character}
                        onOpen={handleShortcutOpen}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="relative hidden h-full w-full lg:block">
              {desktopShortcuts.map((shortcut) => {
                const position = shortcutPositions[shortcut.shortcutKey];

                return (
                  <DesktopConfigShortcut
                    key={shortcut.shortcutKey}
                    {...shortcut}
                    iconTheme={config.iconTheme}
                    theme={theme}
                    characterKey={config.character}
                    onOpen={handleShortcutOpen}
                    onPointerDown={handleShortcutPointerDown}
                    onDragStart={handleShortcutDragStart}
                    className="absolute touch-none"
                    style={{
                      left: position?.x ?? DESKTOP_SHORTCUT_START_X,
                      top: position?.y ?? DESKTOP_SHORTCUT_START_Y,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {activeDesktopWindow ? (
            <div
              ref={desktopWindowLayerRef}
              className="pointer-events-none absolute inset-x-0 bottom-0 top-10 z-20 flex items-stretch justify-center p-0 lg:block"
            >
              <div
                ref={desktopWindowRef}
                className={`pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-none border-2 border-border bg-background/92 text-foreground shadow-[8px_8px_0_rgba(24,18,37,0.18)] backdrop-blur-xl lg:absolute lg:min-w-[320px] ${
                  isWideWindow
                    ? "lg:max-w-[min(1200px,calc(100%-2rem))]"
                    : "lg:max-w-[min(760px,calc(100%-2rem))]"
                }`}
                style={
                  isDesktopViewport
                    ? {
                        left: desktopWindowPosition?.x ?? DESKTOP_WINDOW_MARGIN,
                        top: desktopWindowPosition?.y ?? DESKTOP_WINDOW_MARGIN,
                        width: desktopWindowSize?.width ?? (isWideWindow ? "min(1200px, calc(100% - 2rem))" : "min(760px, calc(100% - 2rem))"),
                        height: desktopWindowSize?.height ?? (
                          isWideWindow
                            ? "min(860px, calc(100dvh - 7rem), calc(100% - 2rem))"
                            : "min(720px, calc(100dvh - 7rem), calc(100% - 2rem))"
                        ),
                        maxHeight: "min(calc(100dvh - 7rem), calc(100% - 2rem))",
                      }
                    : {}
                }
              >
                <div
                  onPointerDown={handleDesktopWindowPointerDown}
                  className="flex cursor-grab touch-none items-center justify-between border-b border-border bg-card/55 px-4 py-2.5 active:cursor-grabbing"
                >
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {activeDesktopWindow === "personalize"
                      ? t("Appearance", "Apariencia")
                      : activeDesktopWindow === "marketplace"
                      ? t("Marketplace", "Marketplace")
                      : activeDesktopWindow === "creator"
                      ? t("Creator", "Creador")
                      : activeDesktopWindow === "guide"
                      ? t("Animation Guide", "Guía de animación")
                      : activeDesktopWindow === "help"
                      ? t("Help", "Ayuda")
                      : activeDesktopWindow === "download"
                      ? t("Download", "Descargas")
                      : activeDesktopWindow === "config"
                      ? t("Config", "Config")
                      : activeDesktopWindow === "memories"
                      ? t("Memories", "Memorias")
                      : activeWindowMeta
                      ? isSpanish
                        ? activeWindowMeta.labelEs
                        : activeWindowMeta.labelEn
                      : t("Configuration", "Configuracion")}
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      setDesktopWindowPosition(null);
                      setDesktopWindowSize(null);
                      setActiveDesktopWindow(null);
                    }}
                    className="rounded-none border border-border bg-background/60 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground hover:bg-background/80"
                  >
                    {t("Close", "Cerrar")}
                  </button>
                </div>
                {isDesktopViewport ? (
                  <>
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "n")}
                      className="absolute inset-x-3 top-0 z-10 h-[10px] cursor-n-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "s")}
                      className="absolute inset-x-3 bottom-0 z-10 h-[10px] cursor-s-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "e")}
                      className="absolute inset-y-3 right-0 z-10 w-[10px] cursor-e-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "w")}
                      className="absolute inset-y-3 left-0 z-10 w-[10px] cursor-w-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "ne")}
                      className="absolute right-0 top-0 z-10 h-[14px] w-[14px] cursor-ne-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "nw")}
                      className="absolute left-0 top-0 z-10 h-[14px] w-[14px] cursor-nw-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "se")}
                      className="absolute bottom-0 right-0 z-10 h-[14px] w-[14px] cursor-se-resize"
                    />
                    <div
                      onPointerDown={(event) => handleDesktopWindowResizePointerDown(event, "sw")}
                      className="absolute bottom-0 left-0 z-10 h-[14px] w-[14px] cursor-sw-resize"
                    />
                  </>
                ) : null}
                <div
                  key={`${activeDesktopWindow ?? "none"}-${language}`}
                  className="flex-1 min-h-0 overflow-hidden lg:h-[calc(100%-42px)] lg:max-h-[calc(100%-42px)]"
                  style={isDesktopViewport ? {
                    maxHeight: "min(calc(100dvh - 7rem - 42px), calc(100% - 42px))",
                  } : undefined}
                >
                  {activeDesktopWindow === "personalize" ? (
                    <DesktopPersonalizeWindow isSpanish={isSpanish} />
                  ) : embeddedWindowPath ? (
                    <iframe
                      key={`${embeddedWindowPath}-${language}`}
                      src={embeddedWindowPath}
                      title={activeDesktopWindow || "window"}
                      className="h-full w-full border-0 bg-background"
                    />
                  ) : activeDesktopWindow === "config" ? (
                    <DesktopConfigWindow isSpanish={isSpanish} />
                  ) : activeDesktopWindow === "memories" ? (
                    <DesktopMemoriesWindow
                      isSpanish={isSpanish}
                      messages={memoryMessages}
                      onClear={handleClearMemories}
                    />
                  ) : activeDesktopWindow ? (
                    <SiteMochiCompactConfigWindow activeTab={activeDesktopWindow} fillHeight />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {entryGateOpen ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/72 p-4 backdrop-blur-md">
              <div className="w-full max-w-xl rounded-none border-2 border-border bg-background/94 p-5 text-foreground shadow-[8px_8px_0_rgba(24,18,37,0.18)]">
                <div className="flex items-center gap-3">
                  <Image src="/logo.png" alt="Mochi" width={40} height={40} className="h-10 w-10 object-contain" />
                  <div>
                    <div className="font-mono text-sm font-semibold uppercase tracking-[0.18em]">
                      Mochi
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("Choose how to enter", "Elegi como entrar")}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-between rounded-none border border-border bg-card/55 px-4 py-3 text-left opacity-70"
                  >
                    <span>
                      <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em]">
                        Google
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("Cloud login", "Login cloud")}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("Coming soon", "Coming soon")}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-between rounded-none border border-border bg-card/55 px-4 py-3 text-left opacity-70"
                  >
                    <span>
                      <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em]">
                        X
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("Social login", "Login social")}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("Coming soon", "Coming soon")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryGateOpen(false)}
                    className="flex items-center justify-between rounded-none border-2 border-[var(--brand-accent)] bg-[var(--brand-accent)]/12 px-4 py-3 text-left transition-colors hover:bg-[var(--brand-accent)]/18"
                  >
                    <span>
                      <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                        {t("Local private agent", "Agente local privado")}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("Allowed on this device", "Permitido en este dispositivo")}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">
                      {t("Enter", "Entrar")}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
