"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { IconType } from "react-icons";
import { HiChatBubbleLeftRight, HiCpuChip, HiSpeakerWave, HiSwatch, HiWrenchScrewdriver } from "react-icons/hi2";
import { IoHeart } from "react-icons/io5";
import {
  Blocks,
  FileCode2,
  Globe,
  MonitorCog,
  MessageSquare,
  Palette,
  RefreshCw,
  Settings2,
  Sparkles,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useSiteMochi, type SiteMochiIconTheme } from "@/components/site-mochi-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import {
  SITE_MOCHI_CHAT_DEFAULT_HEIGHT_PX,
  SITE_MOCHI_CHAT_FONT_SIZE_MAP,
  SITE_MOCHI_CHAT_THEMES,
  SITE_MOCHI_CHAT_WIDTH_MAP,
  pickRandomSiteMochiChatTheme,
} from "@/lib/site-mochi-chat-ui";

export type ConfigPanelTab = "site" | "soul" | "chat" | "appearance" | "mascot" | "tools" | "onchain" | "sound";

const SITE_THEME_META: Array<{
  key: Theme;
  labelEn: string;
  labelEs: string;
  previewBackground: string;
  previewDot: string;
}> = [
  { key: "neural", labelEn: "Neural", labelEs: "Neural", previewBackground: "#05070b", previewDot: "#ffffff" },
  { key: "black-pink", labelEn: "Black-Pink", labelEs: "Black-Pink", previewBackground: "#000000", previewDot: "#ff78c8" },
  {
    key: "kawaii",
    labelEn: "Kawaii",
    labelEs: "Kawaii",
    previewBackground: "linear-gradient(135deg, #ffc6df 0%, #f7d6ff 52%, #ffd7b8 100%)",
    previewDot: "#2a1f4e",
  },
  {
    key: "pastel",
    labelEn: "Pastel",
    labelEs: "Pastel",
    previewBackground: "linear-gradient(135deg, #f5d8ff 0%, #dfe7ff 50%, #ffd8ea 100%)",
    previewDot: "#b48ccf",
  },
];

export const CONFIG_WINDOW_META: Array<{
  key: ConfigPanelTab;
  icon: LucideIcon;
  labelEn: string;
  labelEs: string;
}> = [
  { key: "site", icon: MonitorCog, labelEn: "Theme", labelEs: "Tema" },
  { key: "soul", icon: FileCode2, labelEn: "Soul", labelEs: "Soul" },
  { key: "chat", icon: MessageSquare, labelEn: "Provider", labelEs: "Proveedor" },
  { key: "appearance", icon: Palette, labelEn: "Chat", labelEs: "Chat" },
  { key: "mascot", icon: Sparkles, labelEn: "Mascot", labelEs: "Mascota" },
  { key: "tools", icon: Globe, labelEn: "Internet", labelEs: "Internet" },
  { key: "onchain", icon: Blocks, labelEn: "Onchain", labelEs: "Onchain" },
  { key: "sound", icon: Volume2, labelEn: "Sound", labelEs: "Sonido" },
];

const THEMED_SELECT_CLASS =
  "mochi-themed-select w-full rounded-xl border border-border bg-input/90 px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--brand-accent)]";

function getMascotIdleSpriteSrc(characterKey: string) {
  return `/sprites/${encodeURIComponent(characterKey)}/stand-neutral.png`;
}

const DEFAULT_ICON_COMPONENTS: Record<Exclude<ConfigPanelTab, "mascot">, IconType> = {
  site: HiSwatch,
  soul: IoHeart,
  chat: HiCpuChip,
  appearance: HiChatBubbleLeftRight,
  tools: HiWrenchScrewdriver,
  onchain: HiCpuChip,
  sound: HiSpeakerWave,
};

export function DesktopConfigIcon({
  tab,
  iconTheme: _iconTheme,
  characterKey,
  className = "h-9 w-9",
}: {
  tab: ConfigPanelTab;
  iconTheme: SiteMochiIconTheme;
  characterKey: string;
  className?: string;
}) {
  void _iconTheme;
  if (tab === "mascot") {
    return (
      <Image
        src={getMascotIdleSpriteSrc(characterKey)}
        alt=""
        width={64}
        height={64}
        className={className}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }

  const Icon = DEFAULT_ICON_COMPONENTS[tab];
  return <Icon className={className} aria-hidden="true" />;
}

function SoulFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig } = useSiteMochi();
  const [draftSoul, setDraftSoul] = useState(config.soulMd);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const isDirty = draftSoul !== config.soulMd;

  useEffect(() => {
    setDraftSoul(config.soulMd);
  }, [config.soulMd]);

  useEffect(() => {
    if (!isDirty) return;

    const timer = window.setTimeout(() => {
      updateConfig({ soulMd: draftSoul });
      setLastSavedAt(Date.now());
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draftSoul, isDirty, updateConfig]);

  const saveSoul = () => {
    if (!isDirty) return;
    updateConfig({ soulMd: draftSoul });
    setLastSavedAt(Date.now());
  };

  return (
    <div className="grid gap-3">
      {!compact ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
          {isSpanish
            ? "Esto define la voz interna del agente. Escribilo como un soul.md corto."
            : "This defines the agent's inner voice. Write it as a short soul.md."}
        </div>
      ) : null}
      <label className="block">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>soul.md</span>
          <span>{draftSoul.length}/4000</span>
        </div>
        <textarea
          value={draftSoul}
          onChange={(event) => setDraftSoul(event.target.value.slice(0, 4000))}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          enterKeyHint="done"
          className={`w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-3 font-mono text-xs text-foreground outline-none focus:border-[var(--brand-accent)] ${compact ? "h-[320px]" : "h-[420px]"}`}
          placeholder={`# soul.md\n\n- Be concise\n- Be warm\n- Help with setup`}
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {isDirty
            ? isSpanish
              ? "Cambios sin guardar. Auto-guardado en menos de un segundo."
              : "Unsaved changes. Auto-save in under a second."
            : lastSavedAt
              ? isSpanish
                ? "Guardado localmente."
                : "Saved locally."
              : isSpanish
                ? "Sin cambios pendientes."
                : "No pending changes."}
        </div>
        <button
          type="button"
          onClick={saveSoul}
          disabled={!isDirty}
          className="rounded-none border border-border bg-background/60 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground disabled:cursor-not-allowed disabled:opacity-50 hover:bg-background/80"
        >
          {isSpanish ? "Guardar" : "Save"}
        </button>
      </div>
    </div>
  );
}

function InternetFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig } = useSiteMochi();

  return (
    <div className="grid gap-3">
      {!compact ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
          {isSpanish
            ? "Web search knowledge se activa automaticamente cuando agregas una Brave API key."
            : "Web search knowledge turns on automatically when you add a Brave API key."}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Brave API Key
          </span>
          <input
            type="password"
            value={config.braveApiKey}
            onChange={(event) => updateConfig({ braveApiKey: event.target.value })}
            placeholder="BSA..."
            className="w-full rounded-xl border border-border bg-input/90 px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--brand-accent)]"
            autoComplete="off"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://api-dashboard.search.brave.com/app/keys"
            target="_blank"
            rel="noreferrer"
            className="api-key-link-button inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {isSpanish ? "Conseguir Brave API key" : "Get Brave API key"}
          </a>
        </div>
      </div>
    </div>
  );
}

function OnchainFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig, freeSiteMessagesRemaining } = useSiteMochi();
  const hasOwnKey = Boolean(config.bitteApiKey.trim() && config.bitteAgentId.trim());
  const creditsLeft = freeSiteMessagesRemaining ?? 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
        {hasOwnKey
          ? isSpanish
            ? "Bitte: key propia activa."
            : "Bitte: own key active."
          : isSpanish
            ? `Créditos del sitio: ${creditsLeft}.`
            : `Site credits: ${creditsLeft}.`}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bitte API Key
          </span>
          <input
            type="password"
            value={config.bitteApiKey}
            onChange={(event) => updateConfig({ bitteApiKey: event.target.value })}
            placeholder="bitte-..."
            className="w-full rounded-xl border border-border bg-input/90 px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--brand-accent)]"
            autoComplete="off"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <a
            href="https://bitte.ai/developers"
            target="_blank"
            rel="noreferrer"
            className="api-key-link-button inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {isSpanish ? "Conseguir API key" : "Get API key"}
          </a>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agent ID
          </span>
          <input
            type="text"
            value={config.bitteAgentId}
            onChange={(event) => updateConfig({ bitteAgentId: event.target.value })}
            placeholder={isSpanish ? "tu-agente-id" : "your-agent-id"}
            className="w-full rounded-xl border border-border bg-input/90 px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--brand-accent)]"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {isSpanish ? "Wallet para acciones onchain" : "Wallet for onchain actions"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSpanish
              ? "Bitte AI puede necesitar una wallet conectada para firmar y ejecutar acciones onchain."
              : "Bitte AI may require a connected wallet to sign and execute onchain actions."}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
          {isSpanish
            ? "La conexión de wallet se movió al header del landing. Este panel ya no expone dirección ni botón de conexión."
            : "Wallet connection moved to the landing header. This panel no longer exposes an address or connect button."}
        </div>
      </div>

      {!compact ? (
        <p className="text-xs text-muted-foreground">
          {isSpanish
            ? "Bitte AI te permite interactuar con blockchains NEAR y EVM a través de agentes de IA."
            : "Bitte AI lets you interact with NEAR and EVM blockchains through AI agents."}
        </p>
      ) : null}
    </div>
  );
}

type OpenRouterModelOption = {
  value: string;
  labelEn: string;
  labelEs: string;
  disabled?: boolean;
};

const OPENROUTER_MODEL_FALLBACK_OPTIONS: readonly OpenRouterModelOption[] = [
  { value: "random", labelEn: "Random", labelEs: "Aleatorio" },
  { value: "openai/gpt-4o-mini", labelEn: "GPT-4o mini", labelEs: "GPT-4o mini" },
  { value: "anthropic/claude-3.7-sonnet", labelEn: "Claude 3.7 Sonnet", labelEs: "Claude 3.7 Sonnet" },
  { value: "google/gemini-2.0-flash-001", labelEn: "Gemini 2.0 Flash", labelEs: "Gemini 2.0 Flash" },
];

function ChatAppearanceFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig } = useSiteMochi();

  const matchedPreset = useMemo(
    () =>
      SITE_MOCHI_CHAT_THEMES.find(
        (theme) =>
          theme.theme.toLowerCase() === config.chatThemeColor.toLowerCase() &&
          theme.bg.toLowerCase() === config.chatBgColor.toLowerCase() &&
          theme.bubble === config.chatBubbleStyle,
      ) ?? null,
    [config.chatBgColor, config.chatBubbleStyle, config.chatThemeColor],
  );

  const activeThemeChip = config.chatThemePreset === "random" ? "random" : matchedPreset?.id ?? "custom";
  const hasManualSize =
    config.chatWidthPx !== null || config.chatHeightPx !== SITE_MOCHI_CHAT_DEFAULT_HEIGHT_PX;

  function applyThemePreset(presetId: string) {
    if (presetId === "custom") {
      updateConfig({ chatThemePreset: "custom" });
      return;
    }

    if (presetId === "random") {
      const randomPreset = pickRandomSiteMochiChatTheme();
      updateConfig({
        chatThemePreset: "random",
        chatThemeColor: randomPreset.theme,
        chatBgColor: randomPreset.bg,
        chatBubbleStyle: randomPreset.bubble,
      });
      return;
    }

    const preset = SITE_MOCHI_CHAT_THEMES.find((theme) => theme.id === presetId);
    if (!preset) return;
    updateConfig({
      chatThemePreset: preset.id,
      chatThemeColor: preset.theme,
      chatBgColor: preset.bg,
      chatBubbleStyle: preset.bubble,
    });
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
          {isSpanish
            ? "La burbuja puede redimensionarse con el mouse desde los bordes (izquierdo/derecho y superior) cuando está abierta."
            : "The chat bubble can be resized with the mouse from its edges (left/right and top) while it is open."}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isSpanish ? "Tema del chat" : "Chat theme"}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyThemePreset("custom")}
            className={`inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
              activeThemeChip === "custom"
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-foreground"
                : "border-white/15 bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
            title={isSpanish ? "Tema personalizado" : "Custom theme"}
          >
            🎨
          </button>
          <button
            type="button"
            onClick={() => applyThemePreset("random")}
            className={`inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
              activeThemeChip === "random"
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-foreground"
                : "border-white/15 bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
            title={isSpanish ? "Tema aleatorio" : "Random theme"}
          >
            🎲
          </button>

          {SITE_MOCHI_CHAT_THEMES.map((theme) => {
            const isActive = activeThemeChip === theme.id;
            const title = isSpanish ? theme.labelEs : theme.labelEn;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyThemePreset(theme.id)}
                className={`relative h-9 w-9 rounded-full border p-1 transition ${
                  isActive
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15"
                    : "border-white/15 bg-white/5 hover:bg-white/10"
                }`}
                title={title}
                aria-label={title}
              >
                <span
                  className="flex h-full w-full items-center justify-center rounded-full border border-black/15"
                  style={{ background: theme.bg }}
                >
                  <span
                    className="block h-1/2 w-1/2 rounded-full border border-black/15"
                    style={{ background: theme.theme }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isSpanish ? "Color acento" : "Accent color"}
            </span>
            <input
              type="color"
              value={config.chatThemeColor}
              onChange={(event) =>
                updateConfig({
                  chatThemePreset: "custom",
                  chatThemeColor: event.target.value,
                })
              }
              className="h-10 w-full cursor-pointer rounded-xl border border-white/15 bg-black/30 p-1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isSpanish ? "Color fondo" : "Background color"}
            </span>
            <input
              type="color"
              value={config.chatBgColor}
              onChange={(event) =>
                updateConfig({
                  chatThemePreset: "custom",
                  chatBgColor: event.target.value,
                })
              }
              className="h-10 w-full cursor-pointer rounded-xl border border-white/15 bg-black/30 p-1"
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{isSpanish ? "Texto" : "Text size"}</span>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    chatWidthPx: null,
                    chatHeightPx: SITE_MOCHI_CHAT_DEFAULT_HEIGHT_PX,
                  })
                }
                disabled={!hasManualSize}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 font-semibold text-foreground hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSpanish ? "Restablecer tamaño manual" : "Reset manual size"}
              </button>
            </span>
            <select
              value={config.chatFontSize}
              onChange={(event) =>
                updateConfig({ chatFontSize: event.target.value as "small" | "medium" | "large" })
              }
              className={THEMED_SELECT_CLASS}
            >
              <option value="small">
                {isSpanish ? "Pequeño" : "Small"} ({SITE_MOCHI_CHAT_FONT_SIZE_MAP.small}px)
              </option>
              <option value="medium">
                {isSpanish ? "Medio" : "Medium"} ({SITE_MOCHI_CHAT_FONT_SIZE_MAP.medium}px)
              </option>
              <option value="large">
                {isSpanish ? "Grande" : "Large"} ({SITE_MOCHI_CHAT_FONT_SIZE_MAP.large}px)
              </option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!compact ? (
            <span className="text-muted-foreground">
              {isSpanish
                ? `Actual: ${config.chatWidthPx ?? SITE_MOCHI_CHAT_WIDTH_MAP[config.chatWidth]}×${config.chatHeightPx}px`
                : `Current: ${config.chatWidthPx ?? SITE_MOCHI_CHAT_WIDTH_MAP[config.chatWidth]}×${config.chatHeightPx}px`}
            </span>
          ) : null}
        </div>
      </div>

    </div>
  );
}

function ProviderFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig, freeSiteMessagesRemaining, freeSiteMessagesUsed } = useSiteMochi();
  const [openRouterModelOptions, setOpenRouterModelOptions] = useState<OpenRouterModelOption[]>(
    [...OPENROUTER_MODEL_FALLBACK_OPTIONS],
  );
  const openRouterModelKnown = openRouterModelOptions.some((item) => item.value === config.openrouterModel);
  const openRouterModelSelectValue = openRouterModelKnown ? config.openrouterModel : "__custom__";
  const [pairingCode, setPairingCode] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingInstructionBusy, setPairingInstructionBusy] = useState(false);
  const [pairingInstructionStatus, setPairingInstructionStatus] = useState("");
  const [pairingStatus, setPairingStatus] = useState("");
  const [openclawAgentNameEnabled, setOpenclawAgentNameEnabled] = useState(false);
  const [openclawCustomAgentName, setOpenclawCustomAgentName] = useState("main");

  const hasPairedSession = Boolean(config.openclawPairedSessionToken.trim());
  const pairedSessionExpiresAtMs = config.openclawPairedSessionExpiresAt
    ? Date.parse(config.openclawPairedSessionExpiresAt)
    : NaN;
  const pairedSessionExpired = Number.isFinite(pairedSessionExpiresAtMs) && pairedSessionExpiresAtMs <= Date.now();
  const pairingInstructionStatusLower = pairingInstructionStatus.toLowerCase();
  const pairingInstructionStatusIsError =
    pairingInstructionStatusLower.includes("error") ||
    pairingInstructionStatusLower.includes("failed") ||
    pairingInstructionStatusLower.includes("invalid") ||
    pairingInstructionStatusLower.includes("could not") ||
    pairingInstructionStatusLower.includes("no se pudo");
  const pairingStatusLower = pairingStatus.toLowerCase();
  const pairingStatusIsError =
    pairingStatusLower.includes("error") ||
    pairingStatusLower.includes("failed") ||
    pairingStatusLower.includes("invalid") ||
    pairingStatusLower.includes("venció") ||
    pairingStatusLower.includes("vencio") ||
    pairingStatusLower.includes("could not") ||
    pairingStatusLower.includes("no se pudo");
  const pairingRequestEndpoint =
    typeof window === "undefined"
      ? "https://mochi.dev/api/site-mochi/openclaw/pairings/request"
      : `${window.location.origin}/api/site-mochi/openclaw/pairings/request`;
  const relayRegisterUrl =
    typeof window === "undefined"
      ? "https://mochi.dev/api/site-mochi/openclaw/relay/register"
      : `${window.location.origin}/api/site-mochi/openclaw/relay/register`;
  const relayPollUrl =
    typeof window === "undefined"
      ? "https://mochi.dev/api/site-mochi/openclaw/relay/poll"
      : `${window.location.origin}/api/site-mochi/openclaw/relay/poll`;
  const relayRespondUrl =
    typeof window === "undefined"
      ? "https://mochi.dev/api/site-mochi/openclaw/relay/respond"
      : `${window.location.origin}/api/site-mochi/openclaw/relay/respond`;

  useEffect(() => {
    let cancelled = false;

    async function loadOpenRouterModels() {
      try {
        const response = await fetch("/api/site-mochi/openrouter/models", { cache: "no-store" });
        const json = (await response.json().catch(() => null)) as
          | { models?: Array<{ value?: string; label?: string }> }
          | null;
        if (!response.ok || !Array.isArray(json?.models) || cancelled) return;

        const nextOptions: OpenRouterModelOption[] = [
          { value: "random", labelEn: "Random", labelEs: "Aleatorio" },
          ...json.models
            .map((item) => {
              const value = typeof item.value === "string" ? item.value.trim() : "";
              const label = typeof item.label === "string" ? item.label.trim() : value;
              if (!value) return null;
              return { value, labelEn: label, labelEs: label };
            })
            .filter((item): item is OpenRouterModelOption => Boolean(item)),
        ];

        setOpenRouterModelOptions(nextOptions);
      } catch {
        // Keep fallback options when the live catalog cannot be loaded.
      }
    }

    loadOpenRouterModels().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function providerHelpLinks(kind: "openrouter" | "ollama" | "openclaw") {
    const externalIcon = (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    );
    if (kind === "openrouter") {
      return (
        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="api-key-link-button inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
        >
          {externalIcon}
          {isSpanish ? "Conseguir API key de OpenRouter" : "Get OpenRouter API key"}
        </a>
      );
    }
    if (kind === "ollama") {
      return (
        <a
          href="https://ollama.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-white/25 hover:bg-white/10"
        >
          {externalIcon}
          {isSpanish ? "Descargar / configurar Ollama" : "Download / setup Ollama"}
        </a>
      );
    }
    return (
      <a
        href="https://github.com/openclaw/openclaw"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-white/25 hover:bg-white/10"
      >
        {externalIcon}
        {isSpanish ? "Configurar OpenClaw" : "Setup OpenClaw"}
      </a>
    );
  }

  async function claimOpenClawPairing() {
    const code = pairingCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (!code) {
      setPairingStatus(
        isSpanish ? "Ingresá un código de pairing válido." : "Enter a valid pairing code.",
      );
      return;
    }

    setPairingBusy(true);
    setPairingStatus("");
    try {
      const response = await fetch("/api/site-mochi/openclaw/pairings/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await response.json().catch(() => null)) as
        | {
            error?: string;
            sessionToken?: string;
            sessionExpiresAt?: string;
            agentName?: string;
          }
        | null;

      if (!response.ok || !json?.sessionToken) {
        const err = json?.error || "OPENCLAW_PAIRING_CLAIM_FAILED";
        if (err === "OPENCLAW_PAIRING_CODE_EXPIRED") {
          throw new Error(
            isSpanish
              ? "Ese código de pairing venció. Pedí uno nuevo."
              : "That pairing code has expired. Request a new one.",
          );
        }
        if (err === "OPENCLAW_PAIRING_CODE_USED") {
          throw new Error(
            isSpanish
              ? "Ese código ya fue usado. Pedí uno nuevo."
              : "That pairing code was already used. Request a new one.",
          );
        }
        if (err === "OPENCLAW_PAIRING_INVALID_CODE") {
          throw new Error(
            isSpanish
              ? "Código inválido. Revisalo e intentá de nuevo."
              : "Invalid pairing code. Check it and try again.",
          );
        }
        if (err === "OPENCLAW_RELAY_SCOPE_REQUIRED") {
          throw new Error(
            isSpanish
              ? "El token del gateway no tiene permiso operator.write. Configurá un token con ese scope y generá un nuevo pairing code."
              : "Gateway token is missing operator.write scope. Configure a token with that scope and generate a new pairing code.",
          );
        }
        if (err === "OPENCLAW_RELAY_UNAVAILABLE") {
          throw new Error(
            isSpanish
              ? "El relay del agente no respondió durante la verificación inicial. Reintentá generar el pairing code con el agente online."
              : "The agent relay did not respond during initial verification. Retry generating the pairing code with the agent online.",
          );
        }
        throw new Error(
          isSpanish
            ? "No se pudo completar el pairing ahora."
            : "Could not complete pairing right now.",
        );
      }

      updateConfig({
        openclawMode: "paired",
        openclawPairedSessionToken: json.sessionToken,
        openclawPairedSessionExpiresAt: json.sessionExpiresAt || "",
        openclawPairedAgentName: json.agentName || "",
      });
      setPairingCode("");
      setPairingStatus(
        isSpanish
          ? "OpenClaw vinculado correctamente."
          : "OpenClaw paired successfully.",
      );
    } catch (error) {
      setPairingStatus(
        error instanceof Error
          ? error.message
          : isSpanish
            ? "Error al vincular OpenClaw."
            : "Failed to pair OpenClaw.",
      );
    } finally {
      setPairingBusy(false);
    }
  }

  function clearPairedSession() {
    updateConfig({
      openclawPairedSessionToken: "",
      openclawPairedSessionExpiresAt: "",
      openclawPairedAgentName: "",
    });
    setPairingStatus(
      isSpanish ? "Sesión de OpenClaw desconectada." : "OpenClaw session disconnected.",
    );
  }

  function relayNodeScript(): string {
    return `'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const [,, REQUEST_CODE, AGENT_NAME, REGISTER_URL, POLL_URL, RESPOND_URL] = process.argv;
if (!REQUEST_CODE || !REGISTER_URL || !POLL_URL || !RESPOND_URL) {
  process.stderr.write('Missing args\\n');
  process.exit(1);
}

let GATEWAY_TOKEN;
let GATEWAY_URL = 'ws://127.0.0.1:18789';
try {
  const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const envToken = typeof process.env.OPENCLAW_GATEWAY_TOKEN === 'string'
    ? process.env.OPENCLAW_GATEWAY_TOKEN.trim()
    : '';
  const cfgToken = cfg && cfg.gateway && cfg.gateway.auth && cfg.gateway.auth.token;
  const cfgOperatorToken = cfg && cfg.gateway && cfg.gateway.auth && cfg.gateway.auth.operatorToken;
  const cfgWriteToken = cfg && cfg.gateway && cfg.gateway.auth && cfg.gateway.auth.writeToken;
  const cfgAdminToken = cfg && cfg.gateway && cfg.gateway.auth && cfg.gateway.auth.adminToken;
  const cfgTopToken = cfg && cfg.gateway && cfg.gateway.token;
  GATEWAY_TOKEN =
    envToken ||
    cfgOperatorToken ||
    cfgWriteToken ||
    cfgAdminToken ||
    cfgToken ||
    cfgTopToken;
  const configuredUrl = cfg && cfg.gateway && cfg.gateway.url;
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    GATEWAY_URL = configuredUrl.trim();
  }
  if (!GATEWAY_TOKEN) {
    throw new Error('gateway token not found (set OPENCLAW_GATEWAY_TOKEN or gateway.auth.token)');
  }
} catch (e) {
  process.stderr.write('Cannot read gateway token: ' + e.message + '\\n');
  process.exit(1);
}

function normalizeGatewayUrl(value) {
  const input = String(value || '').trim();
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : ('ws://' + input);
  let u;
  try { u = new URL(withScheme); }
  catch (_) { throw new Error('Invalid gateway.url: ' + input); }
  if (u.protocol === 'http:') u.protocol = 'ws:';
  if (u.protocol === 'https:') u.protocol = 'wss:';
  if (u.protocol !== 'ws:' && u.protocol !== 'wss:') {
    throw new Error('Invalid gateway.url protocol: ' + input);
  }
  return u.toString();
}

try {
  GATEWAY_URL = normalizeGatewayUrl(GATEWAY_URL);
} catch (e) {
  process.stderr.write(String(e && e.message ? e.message : e) + '\\n');
  process.exit(1);
}

function post(url, body) {
  return new Promise(function(resolve, reject) {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port: parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80')),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = mod.request(opts, function(res) {
      let raw = '';
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildSessionKey(agentName) {
  const raw = String(agentName || 'main').toLowerCase();
  const safe = raw.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'main';
  return 'agent:' + safe + ':main';
}

function getLastUserMsg(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || '';
  }
  return '';
}

function extractText(p) {
  if (!p) return '';
  if (typeof p.content === 'string') return p.content;
  if (typeof p.text === 'string') return p.text;
  if (p.delta) {
    if (typeof p.delta.content === 'string') return p.delta.content;
    if (typeof p.delta.text === 'string') return p.delta.text;
  }
  if (p.data && typeof p.data.text === 'string') return p.data.text;
  return '';
}

function mergeText(cur, next) {
  if (!next) return cur;
  if (!cur) return next;
  if (next === cur || cur.startsWith(next)) return cur;
  if (next.startsWith(cur)) return next;
  const max = Math.min(cur.length, next.length);
  for (let i = max; i > 0; i--) {
    if (cur.slice(-i) === next.slice(0, i)) return cur + next.slice(i);
  }
  return cur + next;
}

function hasMissingWriteScope(msg) {
  const s = String(msg || '').toLowerCase();
  return s.includes('missing scope') && s.includes('operator.write');
}

function assertOperatorWrite(agentName) {
  return new Promise(function(resolve, reject) {
    let settled = false, authed = false, probeSent = false, reqN = 0;
    const nextId = function(p) { return p + '-' + Date.now() + '-' + (++reqN); };
    let ws;
    const timer = setTimeout(function() { fail('PRECHECK_TIMEOUT'); }, 12000);

    function cleanup() {
      clearTimeout(timer);
      try { if (ws) ws.close(1000); } catch (_) {}
    }

    function ok() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }

    function fail(msg) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(String(msg || 'PRECHECK_FAILED').slice(0, 240)));
    }

    try { ws = new WebSocket(GATEWAY_URL); } catch (_) { fail('WS_CONNECT_FAILED'); return; }
    ws.onerror = function() { fail('WS_ERROR'); };
    ws.onclose = function(ev) { if (!settled) fail('WS_CLOSED:' + (ev && ev.code ? ev.code : 'unknown')); };
    ws.onmessage = function(ev) {
      let d;
      try { d = JSON.parse(ev.data); } catch (_) { return; }

      if (d.type === 'event' && d.event === 'connect.challenge') {
        ws.send(JSON.stringify({ type: 'req', id: nextId('c'), method: 'connect', params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'gateway-client', version: '1.0.0', platform: 'server', mode: 'backend' },
          role: 'operator', scopes: ['operator.read', 'operator.write'],
          auth: { token: GATEWAY_TOKEN },
        }}));
        return;
      }

      if (d.type === 'res' && !authed && d.ok === false) {
        const reason = (d.error && (d.error.message || d.error.code)) || 'AUTH_FAILED';
        fail('AUTH_FAILED:' + reason);
        return;
      }

      if (d.type === 'res' && !authed && (d.ok === true || (d.payload && d.payload.type === 'hello-ok'))) {
        authed = true;
        const grantedScopes = Array.isArray(d.payload && d.payload.scopes) ? d.payload.scopes.map(function(x) {
          return String(x || '').toLowerCase();
        }) : [];
        if (grantedScopes.length && grantedScopes.indexOf('operator.write') === -1) {
          fail('REQUEST_FAILED:missing scope: operator.write');
          return;
        }

        probeSent = true;
        ws.send(JSON.stringify({ type: 'req', id: nextId('scope'), method: 'chat.send', params: {
          sessionKey: buildSessionKey(agentName),
          message: '[mochi relay preflight]',
          idempotencyKey: nextId('idem'),
        }}));
        return;
      }

      if (authed && probeSent && d.type === 'res' && d.ok === false) {
        const reason = (d.error && (d.error.message || d.error.code)) || 'REQUEST_FAILED';
        if (hasMissingWriteScope(reason)) {
          fail('REQUEST_FAILED:missing scope: operator.write');
          return;
        }
        fail('REQUEST_FAILED:' + reason);
        return;
      }

      if (authed && probeSent && ((d.type === 'res' && d.ok === true) || d.type === 'event')) {
        ok();
      }
    };
  });
}

function relayChat(messages, agentName) {
  return new Promise(function(resolve) {
    const sessionKey = buildSessionKey(agentName);
    const msgText = getLastUserMsg(messages);
    let settled = false, authed = false, chatSent = false, responseText = '', sawDone = false;
    let idleTimer = null, globalTimer = null, reqN = 0;
    const nextId = function(p) { return p + '-' + Date.now() + '-' + (++reqN); };
    const relayError = function(msg) {
      return '__OPENCLAW_ERROR__:' + String(msg || 'unknown').slice(0, 220);
    };

    function done(text) {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(globalTimer);
      try { ws.close(1000); } catch (_) {}
      resolve(text || '(no response)');
    }

    function arm() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function() { done(responseText || relayError('IDLE_TIMEOUT')); }, 20000);
    }

    globalTimer = setTimeout(function() { done(responseText || relayError('GLOBAL_TIMEOUT')); }, 70000);

    const ws = new WebSocket(GATEWAY_URL);
    ws.onopen = function() { arm(); };
    ws.onerror = function() { done(responseText || relayError('WS_ERROR')); };
    ws.onclose = function() { if (!settled) done(responseText || relayError('WS_CLOSED')); };
    ws.onmessage = function(ev) {
      let d;
      try { d = JSON.parse(ev.data); } catch (_) { return; }

      if (d.type === 'event' && d.event === 'connect.challenge') {
        arm();
        ws.send(JSON.stringify({ type: 'req', id: nextId('c'), method: 'connect', params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'gateway-client', version: '1.0.0', platform: 'server', mode: 'backend' },
          role: 'operator', scopes: ['operator.read', 'operator.write'],
          auth: { token: GATEWAY_TOKEN },
        }}));
        return;
      }
      if (d.type === 'res' && !authed && d.ok === false) {
        const authErr = (d.error && (d.error.message || d.error.code)) || 'AUTH_FAILED';
        done(responseText || relayError('AUTH_FAILED:' + authErr));
        return;
      }
      if (d.type === 'res' && !authed && (d.ok === true || (d.payload && d.payload.type === 'hello-ok'))) {
        arm(); authed = true;
        if (!chatSent) {
          chatSent = true;
          ws.send(JSON.stringify({ type: 'req', id: nextId('chat'), method: 'chat.send', params: {
            sessionKey: sessionKey, message: msgText, idempotencyKey: nextId('idem'),
          }}));
        }
        return;
      }
      if (d.type === 'event') {
        const p = d.payload || {};
        const t = extractText(p);
        if (t) responseText = mergeText(responseText, t);
        if (p.state !== undefined || p.status !== undefined || p.done !== undefined) arm();
        if (p.state === 'error') {
          const agentErr = p.errorMessage || p.error || 'AGENT_ERROR';
          done(responseText || relayError('AGENT_ERROR:' + agentErr));
          return;
        }
        if (p.state === 'final' || p.status === 'completed' || p.done === true) {
          sawDone = true; done(responseText || t || '(no response)');
        }
        return;
      }
      if (d.type === 'res' && authed && d.ok === true) {
        if (d.payload && d.payload.runId) { arm(); return; }
        const t = extractText(d.payload);
        if (t) responseText = mergeText(responseText, t);
        if (d.payload && (d.payload.state === 'final' || d.payload.status === 'completed' || d.payload.done)) {
          sawDone = true; done(responseText || t || '(no response)');
        }
        return;
      }
      if (d.type === 'res' && authed && d.ok === false) {
        const reqErr = (d.error && (d.error.message || d.error.code)) || 'REQUEST_FAILED';
        done(responseText || relayError('REQUEST_FAILED:' + reqErr));
      }
    };
    arm();
  });
}

function detectAgentName() {
  return new Promise(function(resolve) {
    let settled = false;
    const timer = setTimeout(function() { if (!settled) { settled = true; resolve('main'); } }, 5000);
    let ws2;
    try { ws2 = new WebSocket(GATEWAY_URL); } catch(_) { clearTimeout(timer); resolve('main'); return; }
    let authed2 = false;
    ws2.onerror = function() { if (!settled) { settled = true; clearTimeout(timer); resolve('main'); } };
    ws2.onclose = function() { if (!settled) { settled = true; clearTimeout(timer); resolve('main'); } };
    ws2.onmessage = function(ev) {
      let d2;
      try { d2 = JSON.parse(ev.data); } catch(_) { return; }
      if (d2.type === 'event' && d2.event === 'connect.challenge') {
        ws2.send(JSON.stringify({ type: 'req', id: 'dc', method: 'connect', params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'gateway-client', version: '1.0.0', platform: 'server', mode: 'backend' },
          role: 'operator', scopes: ['operator.read', 'operator.write'],
          auth: { token: GATEWAY_TOKEN },
        }}));
      } else if (!authed2 && d2.type === 'res' && d2.ok === true && d2.payload && d2.payload.type === 'hello-ok') {
        authed2 = true;
        ws2.send(JSON.stringify({ type: 'req', id: 'dal', method: 'agents.list', params: {} }));
      } else if (d2.id === 'dal') {
        const name = (d2.payload && d2.payload.defaultId) || 'main';
        if (!settled) { settled = true; clearTimeout(timer); try { ws2.close(1000); } catch(_) {} resolve(name); }
      }
    };
  });
}

async function main() {
  const agentName = AGENT_NAME || await detectAgentName();
  try {
    await assertOperatorWrite(agentName);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (hasMissingWriteScope(msg)) {
      process.stderr.write('Gateway token is missing required scope operator.write. Set OPENCLAW_GATEWAY_TOKEN (with operator.write) and rerun.\\n');
    } else {
      process.stderr.write('Gateway precheck failed: ' + msg + '\\n');
    }
    process.exit(1);
  }

  const reg = await post(REGISTER_URL, { requestCode: REQUEST_CODE, agentName: agentName });
  if (!reg.body || !reg.body.pairingCode || !reg.body.relayToken) {
    process.stderr.write('Registration failed: ' + JSON.stringify(reg.body) + '\\n');
    process.exit(1);
  }
  const pairingCode = reg.body.pairingCode;
  const relayToken = reg.body.relayToken;
  process.stdout.write(pairingCode + '\\n');

  while (true) {
    try {
      const poll = await post(POLL_URL, { relayToken: relayToken });
      if (!poll.body || !poll.body.jobId) continue;
      const jobId = poll.body.jobId;
      const messages = poll.body.messages || [];
      const jobAgentName = poll.body.agentName || agentName;
      const response = await relayChat(messages, jobAgentName);
      await post(RESPOND_URL, { relayToken: relayToken, jobId: jobId, response: response });
    } catch (e) {
      process.stderr.write('Relay error: ' + e.message + '\\n');
    }
  }
}

main().catch(function(e) {
  process.stderr.write('Fatal: ' + e.message + '\\n');
  process.exit(1);
});`;
  }

  function pairingMarkdownInstructions(args: { requestCode: string; requestExpiresAt: string; customAgentName?: string }) {
    const { requestCode, requestExpiresAt, customAgentName } = args;
    const nodeScript = relayNodeScript();
    const agentNameLine = customAgentName?.trim()
      ? `AGENT_NAME="${customAgentName.trim()}"  # override: custom agent name`
      : `AGENT_NAME="\${OPENCLAW_AGENT_NAME:-}"  # empty = auto-detect from gateway`;
    const bashScript = `set -euo pipefail
REQUEST_CODE="${requestCode}"
${agentNameLine}
RELAY_LOG="$(mktemp /tmp/openclaw-relay-XXXXXX.log)"
RELAY_SCRIPT="$(mktemp /tmp/openclaw-relay-XXXXXX.cjs)"
cat > "$RELAY_SCRIPT" << 'RELAY_EOF'
${nodeScript}
RELAY_EOF
nohup node "$RELAY_SCRIPT" "$REQUEST_CODE" "$AGENT_NAME" "${relayRegisterUrl}" "${relayPollUrl}" "${relayRespondUrl}" > "$RELAY_LOG" 2>&1 &
disown
CODE=""
for i in $(seq 1 30); do
  CODE="$(grep -m1 -E '^[A-Z0-9]{6,12}$' "$RELAY_LOG" 2>/dev/null || true)"
  [ -n "$CODE" ] && break
  sleep 1
done
[ -n "$CODE" ] || { echo "ERROR: No pairing code received. Check $RELAY_LOG" >&2; exit 1; }
echo "$CODE"`;
    return `# Task: Generate pairing code for web user (relay mode)

Run the script below in your shell. It will print a pairing code. Return ONLY that code to the user (example: \`Q7M4K9P2\`). Do not add explanations.

## How it works
Your local OpenClaw gateway connects outward to the relay server — no public URL needed. No openclaw CLI required. Config is read automatically from \`~/.openclaw/openclaw.json\`.

## Requirement
The gateway token must allow \`operator.write\` (chat/send permission).
If needed, set \`OPENCLAW_GATEWAY_TOKEN\` to a token with that scope before running.

## One-time request code
${requestCode}
Expires: ${requestExpiresAt}

## Script
\`\`\`bash
${bashScript}
\`\`\`

## Security rule
Do not print the relay token or gateway token in your final reply. Return only the pairing code.`;
  }

  async function copyToClipboard(value: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  async function copyPairingAgentInstructions() {
    setPairingInstructionBusy(true);
    setPairingInstructionStatus("");
    try {
      const response = await fetch(pairingRequestEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 15 * 60 }),
      });
      const json = (await response.json().catch(() => null)) as
        | { requestCode?: string; expiresAt?: string; error?: string }
        | null;

      if (!response.ok || !json?.requestCode || !json?.expiresAt) {
        throw new Error(
          isSpanish
            ? "No se pudo generar un código temporal para instrucciones."
            : "Could not generate a temporary instruction code.",
        );
      }

      const instructions = pairingMarkdownInstructions({
        requestCode: json.requestCode,
        requestExpiresAt: json.expiresAt,
        customAgentName: openclawAgentNameEnabled ? openclawCustomAgentName : undefined,
      });
      const copied = await copyToClipboard(instructions);
      if (!copied) {
        throw new Error(
          isSpanish
            ? "No se pudo copiar automáticamente. Copialo manualmente."
            : "Could not copy automatically. Please copy it manually.",
        );
      }

      setPairingInstructionStatus(
        isSpanish
          ? `Instrucciones copiadas. El request code vence ${new Date(json.expiresAt).toLocaleString()}.`
          : `Instructions copied. Request code expires ${new Date(json.expiresAt).toLocaleString()}.`,
      );
    } catch (error) {
      setPairingInstructionStatus(
        error instanceof Error
          ? error.message
          : isSpanish
            ? "No se pudieron preparar las instrucciones de pairing."
            : "Could not prepare pairing instructions.",
      );
    } finally {
      setPairingInstructionBusy(false);
    }
  }

  if (config.provider === "site" || config.provider === "openrouter") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-foreground/80">
          <p className="font-semibold text-foreground">
            {isSpanish ? "Créditos del sitio" : "Site credits"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSpanish
              ? `Usados: ${freeSiteMessagesUsed}. Restantes: ${freeSiteMessagesRemaining ?? 0}.`
              : `Used: ${freeSiteMessagesUsed}. Remaining: ${freeSiteMessagesRemaining ?? 0}.`}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            OpenRouter API Key
          </span>
          <input
            type="password"
            value={config.openrouterApiKey}
            onChange={(event) =>
              updateConfig({ provider: "openrouter", openrouterApiKey: event.target.value })
            }
            placeholder="sk-or-v1-..."
            className={THEMED_SELECT_CLASS}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">{providerHelpLinks("openrouter")}</div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSpanish ? "Modelo" : "Model"}
          </span>
          <select
            value={openRouterModelSelectValue}
            onChange={(event) =>
              updateConfig({
                provider: "openrouter",
                openrouterModel:
                  event.target.value === "__custom__" ? (openRouterModelKnown ? "" : config.openrouterModel) : event.target.value,
              })
            }
            className={THEMED_SELECT_CLASS}
          >
            {openRouterModelOptions.map((item) => (
              <option key={item.value} value={item.value} disabled={Boolean(item.disabled)}>
                {isSpanish ? item.labelEs : item.labelEn}
              </option>
            ))}
            <option value="__custom__">{isSpanish ? "Personalizado" : "Custom"}</option>
          </select>
        </label>
        {openRouterModelSelectValue === "__custom__" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isSpanish ? "Modelo personalizado" : "Custom model"}
            </span>
            <input
              type="text"
              value={config.openrouterModel}
              onChange={(event) =>
                updateConfig({ provider: "openrouter", openrouterModel: event.target.value })
              }
              placeholder="openai/gpt-4o-mini"
              className={THEMED_SELECT_CLASS}
            />
          </label>
        ) : null}
      </div>
    );
  }

  if (config.provider === "ollama") {
    return (
      <div className="space-y-3">
        {!compact ? <div className="flex flex-wrap gap-2">{providerHelpLinks("ollama")}</div> : null}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ollama URL
          </span>
          <input
            type="text"
            value={config.ollamaUrl}
            onChange={(event) => updateConfig({ ollamaUrl: event.target.value })}
            placeholder="http://127.0.0.1:11434"
            className={THEMED_SELECT_CLASS}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSpanish ? "Modelo" : "Model"}
          </span>
          <input
            type="text"
            value={config.ollamaModel}
            onChange={(event) => updateConfig({ ollamaModel: event.target.value })}
            placeholder="gemma3:1b"
            className={THEMED_SELECT_CLASS}
          />
        </label>
        {!compact ? (
          <p className="text-xs text-muted-foreground">
            {isSpanish
              ? "Se intenta conectar directo desde tu navegador. Si tu navegador bloquea la conexión local, usa una URL accesible por HTTPS o un túnel."
              : "The site tries to connect directly from your browser. If your browser blocks local connections, use an HTTPS-accessible URL or tunnel."}
          </p>
        ) : null}
      </div>
    );
  }

  if (config.provider === "openclaw") return (
    <div className="space-y-3">
      {!compact ? <div className="flex flex-wrap gap-2">{providerHelpLinks("openclaw")}</div> : null}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        {!compact ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              {isSpanish
                ? "¿De dónde sale el código de pairing?"
                : "Where does the pairing code come from?"}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                {isSpanish
                  ? "Copiá las instrucciones y pegáselas a tu agente OpenClaw."
                  : "Copy the instructions and paste them into your OpenClaw agent."}
              </li>
              <li>
                {isSpanish
                  ? "El agente ejecuta el script: lee tu config local e imprime un código."
                  : "The agent runs the script: it reads your local config and prints a code."}
              </li>
              <li>
                {isSpanish
                  ? "Pegá ese código acá y presioná Vincular."
                  : "Paste that code here and press Pair."}
              </li>
            </ol>
            <p className="mt-2">
              {isSpanish
                ? "Tu gateway conecta hacia afuera — no necesitás URL pública ni instalar nada extra."
                : "Your gateway connects outward — no public URL or extra install needed."}
            </p>
            <div className="mt-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={openclawAgentNameEnabled}
                  onChange={(e) => setOpenclawAgentNameEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--brand-accent)]"
                />
                <span className="text-[11px] text-muted-foreground">
                  {isSpanish ? "Nombre de agente personalizado" : "Custom agent name"}
                </span>
              </label>
              <input
                type="text"
                disabled={!openclawAgentNameEnabled}
                value={openclawAgentNameEnabled ? openclawCustomAgentName : ""}
                placeholder={openclawAgentNameEnabled
                  ? (isSpanish ? "ej: main" : "e.g. main")
                  : (isSpanish ? "Auto-detectar desde gateway" : "Auto-detect from gateway")}
                onChange={(e) =>
                  setOpenclawCustomAgentName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48))
                }
                className={`mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-[var(--brand-accent)] ${
                  !openclawAgentNameEnabled ? "cursor-not-allowed opacity-40" : ""
                }`}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyPairingAgentInstructions()}
              disabled={pairingInstructionBusy}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pairingInstructionBusy
                ? isSpanish
                  ? "Preparando..."
                  : "Preparing..."
                : isSpanish
                  ? "Copiar instrucciones para agente"
                  : "Copy agent instructions"}
            </button>
            {pairingInstructionStatus ? (
              <p
                className={`inline-flex w-fit max-w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                  pairingInstructionStatusIsError
                    ? "border-red-700 bg-red-300 text-black"
                    : "border-green-700 bg-green-300 text-black"
                }`}
              >
                {pairingInstructionStatus}
              </p>
            ) : null}
          </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSpanish ? "Código de pairing (uso único)" : "Pairing code (one-time use)"}
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
              placeholder={isSpanish ? "Ej: Q7M4K9P2" : "Ex: Q7M4K9P2"}
              className={THEMED_SELECT_CLASS}
              maxLength={12}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => void claimOpenClawPairing()}
              disabled={pairingBusy}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pairingBusy
                ? isSpanish
                  ? "Vinculando..."
                  : "Pairing..."
                : isSpanish
                  ? "Vincular"
                  : "Pair"}
            </button>
          </div>
        </label>

        {pairingStatus ? (
          <p
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              pairingStatusIsError
                ? "border-red-700 bg-red-300 text-black"
                : "border-green-700 bg-green-300 text-black"
            }`}
          >
            {pairingStatus}
          </p>
        ) : null}

        <div
          className={`rounded-xl border p-3 text-xs ${
            hasPairedSession && !pairedSessionExpired
              ? "border-green-700 bg-green-300 text-black"
              : "border-red-700 bg-red-300 text-black"
          }`}
        >
          {hasPairedSession && !pairedSessionExpired
            ? isSpanish
              ? "Sesión de OpenClaw activa en este navegador."
              : "OpenClaw session is active in this browser."
            : isSpanish
              ? "No hay una sesión activa. Vinculá un código para empezar."
              : "No active session yet. Pair a code to get started."}
          {config.openclawPairedAgentName ? (
            <div className="mt-2 text-[11px] text-black/80">
              {isSpanish ? "Agente" : "Agent"}: {config.openclawPairedAgentName}
            </div>
          ) : null}
          {config.openclawPairedSessionExpiresAt ? (
            <div className="mt-1 text-[11px] text-black/80">
              {isSpanish ? "Vence" : "Expires"}:{" "}
              {new Date(config.openclawPairedSessionExpiresAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        {hasPairedSession ? (
          <button
            type="button"
            onClick={clearPairedSession}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-white/10"
          >
            {isSpanish ? "Desconectar sesión" : "Disconnect session"}
          </button>
        ) : null}
      </div>

    </div>
  );

  if (config.provider === "bitte") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
          {isSpanish
            ? "Bitte está seleccionado como proveedor. La API key y el Agent ID se configuran en Onchain."
            : "Bitte is selected as the provider. API key and Agent ID are configured in Onchain."}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
          {isSpanish
            ? `Créditos del sitio: ${freeSiteMessagesRemaining ?? 0}.`
            : `Site credits: ${freeSiteMessagesRemaining ?? 0}.`}
        </div>
      </div>
    );
  }

  return null;
}

export function SoundFields({ compact = false }: { compact?: boolean } = {}) {
  const { isSpanish } = useLanguage();
  const { config, updateConfig } = useSiteMochi();
  const [browserVoices, setBrowserVoices] = useState<Array<{ name: string; lang: string }>>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    const syncVoices = () => {
      const voices = synth
        .getVoices()
        .map((voice) => ({
          name: String(voice.name || "").trim(),
          lang: String(voice.lang || "").trim(),
        }))
        .filter((voice) => voice.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setBrowserVoices(voices);
    };

    syncVoices();
    synth.addEventListener?.("voiceschanged", syncVoices);
    return () => synth.removeEventListener?.("voiceschanged", syncVoices);
  }, []);

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
          {isSpanish
            ? "Modo gratis: usa voz del navegador (micrófono + síntesis de voz). Suele funcionar mejor en Chrome/Edge. ElevenLabs es opcional para una voz más natural."
            : "Free mode uses browser voice features (microphone + speech synthesis). It usually works best in Chrome/Edge. ElevenLabs is optional for a more natural voice."}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isSpanish ? "Entrada de voz (hablarle)" : "Voice input (talk to it)"}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSpanish ? "Proveedor de micrófono" : "Microphone provider"}
          </span>
          <select
            value={config.soundInputProvider}
            onChange={(event) =>
              updateConfig({
                soundInputProvider: event.target.value as "off" | "browser",
              })
            }
            className={THEMED_SELECT_CLASS}
          >
            <option value="off">{isSpanish ? "Desactivado" : "Off"}</option>
            <option value="browser">{isSpanish ? "Navegador (gratis)" : "Browser (free)"}</option>
          </select>
        </label>

      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isSpanish ? "Salida de voz (que te hable)" : "Voice output (talks back)"}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSpanish ? "Proveedor de voz" : "Voice provider"}
          </span>
          <select
            value={config.soundOutputProvider}
            onChange={(event) =>
              updateConfig({
                soundOutputProvider: event.target.value as "off" | "browser" | "elevenlabs",
                soundOutputAutoSpeak: event.target.value !== "off",
              })
            }
            className={THEMED_SELECT_CLASS}
          >
            <option value="off">{isSpanish ? "Desactivado" : "Off"}</option>
            <option value="browser">{isSpanish ? "Voz del navegador (gratis)" : "Browser voice (free)"}</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{isSpanish ? "Volumen" : "Volume"}</span>
            <span>{config.soundOutputVolumePercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.soundOutputVolumePercent}
            onChange={(event) =>
              updateConfig({ soundOutputVolumePercent: Number(event.target.value) })
            }
            className="w-full accent-[var(--brand-accent)]"
            disabled={config.soundOutputProvider === "off"}
          />
        </label>

        {config.soundOutputProvider === "browser" && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isSpanish ? "Voz del navegador" : "Browser voice"}
            </span>
            <select
              value={config.soundOutputBrowserVoiceName}
              onChange={(event) => updateConfig({ soundOutputBrowserVoiceName: event.target.value })}
              className={THEMED_SELECT_CLASS}
            >
              <option value="">
                {isSpanish ? "Automática (por idioma del sitio)" : "Automatic (site language)"}
              </option>
              {browserVoices.map((voice) => (
                <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                  {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {config.soundOutputProvider === "elevenlabs" && (
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ElevenLabs API Key
              </span>
              <input
                type="password"
                value={config.elevenlabsApiKey}
                onChange={(event) => updateConfig({ elevenlabsApiKey: event.target.value })}
                placeholder="sk_..."
                className={THEMED_SELECT_CLASS}
                autoComplete="off"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noreferrer"
                className="api-key-link-button inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {isSpanish ? "Conseguir API key de ElevenLabs" : "Get ElevenLabs API key"}
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isSpanish ? "Voice ID" : "Voice ID"}
                </span>
                <input
                  type="text"
                  value={config.elevenlabsVoiceId}
                  onChange={(event) => updateConfig({ elevenlabsVoiceId: event.target.value })}
                  placeholder="EXAVITQu4vr4xnSDxMaL"
                  className={THEMED_SELECT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isSpanish ? "Modelo" : "Model"}
                </span>
                <input
                  type="text"
                  value={config.elevenlabsModelId}
                  onChange={(event) => updateConfig({ elevenlabsModelId: event.target.value })}
                  placeholder="eleven_flash_v2_5"
                  className={THEMED_SELECT_CLASS}
                />
              </label>
            </div>

            {!compact ? (
              <p className="text-xs text-muted-foreground">
                {isSpanish
                  ? "La key se guarda localmente en tu navegador y solo se envía cuando pedís generar audio."
                  : "The key is stored locally in your browser and is only sent when you request audio generation."}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function SiteMochiCompactConfigWindow({
  activeTab,
  fillHeight = true,
  onOpenMarketplace,
  onOpenWallet,
}: {
  activeTab: ConfigPanelTab;
  fillHeight?: boolean;
  onOpenMarketplace?: () => void;
  onOpenWallet?: () => void;
}) {
  const { isSpanish } = useLanguage();
  const { theme, setTheme } = useTheme();
  const {
    catalog,
    catalogLoading,
    catalogError,
    reloadCatalog,
    config,
    updateConfig,
  } = useSiteMochi();

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/72 text-foreground shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
        fillHeight ? "h-full" : "max-h-full"
      }`}
    >
      <div className="mochi-themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "site" ? (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {SITE_THEME_META.map((item) => {
                const isActive = theme === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTheme(item.key)}
                    className={`flex min-w-0 items-center gap-2 rounded-2xl border px-2 py-2 text-left transition-all ${
                      isActive
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-foreground"
                        : "border-border bg-card/65 text-foreground/85 hover:bg-card"
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10"
                      style={{ background: item.previewBackground }}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                        style={{ background: item.previewDot }}
                      />
                    </span>
                    <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {isSpanish ? item.labelEs : item.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isSpanish ? "Iconos del escritorio" : "Desktop icons"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "desktop" as const, labelEn: "Desktop", labelEs: "Desktop", preview: "/icons-desktop/marketplace.svg" },
                    { value: "dusk" as const, labelEn: "Dusk", labelEs: "Dusk", preview: "https://img.icons8.com/dusk/96/shopping-bag.png" },
                  ] as const
                ).map(({ value, labelEn, labelEs, preview }) => {
                  const isActive = config.iconTheme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateConfig({ iconTheme: value })}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition-all ${
                        isActive
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-foreground"
                          : "border-border bg-card/65 text-foreground/85 hover:bg-card"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="" className="h-6 w-6 shrink-0 object-contain" draggable={false} />
                      <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {isSpanish ? labelEs : labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "soul" ? <SoulFields compact /> : null}

        {activeTab === "chat" ? (
          <div className="grid gap-4">
            {/* Hosting & Credits inline card */}
            <div className="rounded-2xl border border-border bg-white/[0.04] p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {isSpanish ? "Proveedor de créditos" : "Credits & Hosting"}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col rounded-xl border border-border bg-white/[0.04] p-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hosting</span>
                  <span className="mt-1 text-base font-bold text-foreground">$20</span>
                  <span className="text-[10px] text-muted-foreground">{isSpanish ? "/ mes · USDC" : "/ mo · USDC"}</span>
                  <span className="mt-2 text-[9px] text-muted-foreground/60 leading-relaxed">
                    {isSpanish ? "Agente activo 24/7" : "Agent alive 24/7"}
                  </span>
                </div>
                <div className="col-span-2 flex flex-col rounded-xl border border-border bg-white/[0.04] p-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Credits</span>
                  <div className="mt-1 flex gap-1">
                    {["$2", "$5", "$10"].map((amt) => (
                      <div key={amt} className="flex-1 rounded-lg border border-border bg-white/5 py-1 text-center text-[11px] font-semibold text-foreground/40">
                        {amt}
                      </div>
                    ))}
                  </div>
                  <span className="mt-2 text-[9px] text-muted-foreground/60">
                    {isSpanish ? "Almacenamiento · Memoria del agente" : "Storage · Agent memory"}
                  </span>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[9px] font-semibold text-amber-300 w-fit">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
                    {isSpanish ? "Próximamente" : "Coming soon"}
                  </div>
                </div>
              </div>
              {onOpenWallet ? (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-[var(--brand-accent)] px-4 py-2.5 text-left text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                >
                  <span>{isSpanish ? "Wallet del agente" : "Agent wallet"}</span>
                  <span>→</span>
                </button>
              ) : null}
            </div>
            <ProviderFields compact />
          </div>
        ) : null}

        {activeTab === "appearance" ? <ChatAppearanceFields compact /> : null}

        {activeTab === "tools" ? <InternetFields compact /> : null}

        {activeTab === "onchain" ? <OnchainFields compact /> : null}

        {activeTab === "sound" ? <SoundFields compact /> : null}

        {activeTab === "mascot" ? (
          <div className="grid gap-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onOpenMarketplace) {
                    onOpenMarketplace();
                    return;
                  }
                  if (typeof window !== "undefined") {
                    window.location.href = "/marketplace";
                  }
                }}
                className="inline-flex items-center rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-background/80"
              >
                {isSpanish ? "Conseguir nuevas apariencias" : "Get new skins"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {(catalog?.characters ?? []).map((character) => (
                <button
                  key={character.key}
                  type="button"
                  onClick={() => updateConfig({ character: character.key })}
                  className={`group flex flex-col items-center rounded-2xl border p-3 text-center transition-all ${
                    config.character === character.key
                      ? "border-[var(--brand-accent)] bg-[color-mix(in_srgb,var(--brand-accent)_12%,transparent)]"
                      : "border-white/10 bg-white/5 hover:border-[var(--brand-accent)]/50 hover:bg-white/10"
                  }`}
                  disabled={catalogLoading}
                >
                  <Image
                    src={character.iconUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 object-contain transition-transform group-hover:scale-110"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="mt-2 w-full truncate text-[11px] font-semibold text-foreground/90">
                    {character.label}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{isSpanish ? "Tamaño" : "Size"}</span>
                  <span>{config.sizePercent}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={180}
                  step={5}
                  value={config.sizePercent}
                  onChange={(event) => updateConfig({ sizePercent: Number(event.target.value) })}
                  className="w-full accent-[var(--brand-accent)]"
                />
              </label>
            </div>

            {catalogError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-700 bg-red-300 px-3 py-2 text-xs text-black">
                <span className="truncate">{catalogError}</span>
                <button
                  type="button"
                  onClick={() => reloadCatalog().catch(() => undefined)}
                  className="inline-flex items-center gap-1 rounded-lg border border-black/40 px-2 py-1 text-black hover:bg-black/10"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SiteMochiConfigPanel({
  inline = false,
  onOpenMarketplace,
}: {
  inline?: boolean;
  onOpenMarketplace?: () => void;
} = {}) {
  const { isSpanish } = useLanguage();
  const [activeTab, setActiveTab] = useState<ConfigPanelTab>("soul");
  const {
    isConfigOpen,
    closeConfig,
    config,
  } = useSiteMochi();

  if (!inline && !isConfigOpen) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[90]"}>
      {!inline ? (
        <button
          type="button"
          aria-label={isSpanish ? "Cerrar panel de configuración" : "Close configuration panel"}
          className="absolute inset-0 bg-transparent"
          onClick={closeConfig}
        />
      ) : null}

      <aside
        className={
          inline
            ? "mochi-settings-panel mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-background/95 text-foreground shadow-2xl"
            : "mochi-settings-panel absolute right-0 top-0 h-full w-full max-w-xl overflow-hidden border-l border-border bg-background/95 text-foreground shadow-2xl"
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70">
                <Settings2 className="h-5 w-5 text-[var(--brand-accent)]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {isSpanish ? "Mochi del sitio" : "Website Mochi"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isSpanish
                    ? "Configuración local de este navegador"
                    : "Local settings for this browser"}
                </div>
              </div>
            </div>
            {!inline ? (
              <button
                type="button"
                onClick={closeConfig}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/70 text-foreground/80 hover:bg-card"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
            <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[112px_minmax(0,1fr)]">
              <div className="mochi-themed-scrollbar grid min-h-0 auto-rows-max grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-1">
                {CONFIG_WINDOW_META.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={`group flex min-h-[92px] flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                        isActive
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                        : "border-border bg-card/65 text-foreground/80 hover:bg-card"
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background/55">
                        <DesktopConfigIcon
                          tab={item.key}
                          iconTheme={config.iconTheme}
                          characterKey={config.character}
                          className="h-9 w-9 text-foreground"
                        />
                      </span>
                      <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {isSpanish ? item.labelEs : item.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-0 overflow-hidden">
                <SiteMochiCompactConfigWindow activeTab={activeTab} onOpenMarketplace={onOpenMarketplace} />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
