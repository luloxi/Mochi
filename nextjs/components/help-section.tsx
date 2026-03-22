"use client";

import { ScrollAnimation } from "./scroll-animation";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import DownloadButton from "./download-button";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ANIMATION_GUIDE_PATH, CHARACTER_CREATOR_PATH } from "@/lib/mochi-sprite-spec";
import { openSiteDesktopWindow } from "@/lib/site-desktop-window";

const providers = [
  {
    id: "openrouter",
    titleEn: "OpenRouter (Recommended)",
    titleEs: "OpenRouter (Recomendado)",
    descriptionEn: "Fast cloud setup with one key.",
    descriptionEs: "Setup rápido en la nube con una sola key.",
    bestForEn: "Best for: fastest setup with many model options.",
    bestForEs: "Ideal para: setup más rápido con muchas opciones de modelos.",
    
    stepsEn: [
      "Open Router settings and create an API key.",
      "Extension: in popup set AI Brain = Standard and Provider = OpenRouter. Web: open the homepage Provider tab and choose OpenRouter.",
      "Paste the API key and click your Mochi to talk (extension or web).",
    ],
    stepsEs: [
      "Abrí OpenRouter y creá una API key.",
      "Extensión: en el popup poné Cerebro AI = Standard y Proveedor = OpenRouter. Web: abrí la pestaña Proveedor en la homepage y elegí OpenRouter.",
      "Pegá la API key y hacé click en tu Mochi para hablarle (extensión o web).",
    ],
    link: { href: "https://openrouter.ai/settings/keys", labelEn: "Get OpenRouter keys", labelEs: "Conseguir keys de OpenRouter" },
  },
  {
    id: "ollama",
    titleEn: "Ollama (Local)",
    titleEs: "Ollama (Local)",
    descriptionEn: "Private local models, no API key needed.",
    descriptionEs: "Modelos locales y privados, sin API key.",
    bestForEn: "Best for: local/offline use and privacy.",
    bestForEs: "Ideal para: uso local/offline y privacidad.",
    
    stepsEn: [
      "Install Ollama and pull a model (example: llama3.1).",
      "Extension: in popup set AI Brain = Standard and Provider = Ollama. Web: open the homepage Provider tab and choose Ollama.",
      "Set Ollama URL and click your Mochi to talk (extension or web).",
    ],
    stepsEs: [
      "Instalá Ollama y bajá un modelo (ejemplo: llama3.1).",
      "Extensión: en el popup poné Cerebro AI = Standard y Proveedor = Ollama. Web: abrí la pestaña Proveedor en la homepage y elegí Ollama.",
      "Configurá URL de Ollama y hacé click en tu Mochi para hablarle (extensión o web).",
    ],
    link: { href: "https://ollama.com", labelEn: "Download Ollama", labelEs: "Descargar Ollama" },
  },
  {
    id: "openclaw",
    titleEn: "OpenClaw (Agent)",
    titleEs: "OpenClaw (Agente)",
    descriptionEn: "Agent mode connected through your OpenClaw gateway.",
    descriptionEs: "Modo agente conectado mediante tu gateway de OpenClaw.",
    bestForEn: "Best for: actions and tools beyond normal chat.",
    bestForEs: "Ideal para: acciones y herramientas más allá del chat.",

    stepsEn: [
      "Start your OpenClaw gateway.",
      "Copy the WebSocket URL and token.",
      "Extension: in popup set AI Brain = AI Agent. Web: open Provider tab, choose OpenClaw, and click \"I'm an agent\" if you need agent integration instructions.",
      "Paste the gateway URL + token (and agent name if needed).",
    ],
    stepsEs: [
      "Iniciá tu gateway de OpenClaw.",
      "Copiá la URL WebSocket y token.",
      "Extensión: en el popup poné Cerebro AI = AI Agent. Web: abrí la pestaña Proveedor, elegí OpenClaw y hacé click en \"Soy un agente\" si necesitás instrucciones de integración.",
      "Pegá la URL del gateway + token (y nombre del agente si hace falta).",
    ],
    link: { href: "https://github.com/openclaw/openclaw", labelEn: "Setup OpenClaw", labelEs: "Configurar OpenClaw" },
  },
  {
    id: "bitte",
    titleEn: "Bitte AI (Onchain)",
    titleEs: "Bitte AI (Onchain)",
    descriptionEn: "Native onchain brain that reasons about wallets, tokens, and transactions.",
    descriptionEs: "Cerebro nativo onchain que razona sobre wallets, tokens y transacciones.",
    bestForEn: "Best for: DeFi actions, Web3 queries, and signing transactions from chat.",
    bestForEs: "Ideal para: acciones DeFi, consultas Web3 y firmar transacciones desde el chat.",
    stepsEn: [
      "Web: open the homepage Provider tab and choose Bitte AI. Site credits are available for free — no key needed to start.",
      "Optional: get your own API key at bitte.ai/developers and paste it in the Bitte AI config.",
      "Click your Mochi and ask anything onchain — swaps, balances, contract calls, and more.",
    ],
    stepsEs: [
      "Web: abrí la pestaña Proveedor en la homepage y elegí Bitte AI. Hay créditos del sitio gratis — no necesitás key para empezar.",
      "Opcional: conseguí tu API key en bitte.ai/developers y pegala en la configuración de Bitte AI.",
      "Hacé click en tu Mochi y preguntá lo que quieras onchain — swaps, balances, llamadas a contratos, y más.",
    ],
    link: { href: "https://bitte.ai/developers", labelEn: "Get Bitte AI key", labelEs: "Conseguir key de Bitte AI" },
  },
];

const configReference: Array<{
  emoji: string;
  titleEn: string;
  titleEs: string;
  contentEn: string;
  contentEs: string;
  highlight?: boolean;
}> = [
  {
    emoji: "🎭",
    titleEn: "Character",
    titleEs: "Personaje",
    contentEn: "Choose which mochi appears on screen. Each character has its own animations.",
    contentEs: "Elegí qué mochi aparece en pantalla. Cada personaje tiene sus propias animaciones.",
  },
  {
    emoji: "📏",
    titleEn: "Size",
    titleEs: "Tamaño",
    contentEn: "Controls how big the mochi looks on your screen.",
    contentEs: "Controla qué tan grande se ve el mochi en tu pantalla.",
  },
  {
    emoji: "✅",
    titleEn: "Active",
    titleEs: "Activo",
    contentEn: "Turns this mochi on or off everywhere.",
    contentEs: "Prende o apaga este mochi en todas las páginas.",
  },
  {
    emoji: "💬",
    titleEn: "Personality",
    titleEs: "Personalidad",
    contentEn: "Sets the tone of voice and behavior for chats.",
    contentEs: "Define el tono y el comportamiento al chatear.",
  },
  {
    emoji: "🧠",
    titleEn: "AI Brain",
    titleEs: "Cerebro AI",
    contentEn: "Standard uses OpenRouter, Ollama, or Bitte AI. Agent uses OpenClaw tools.",
    contentEs: "Standard usa OpenRouter, Ollama o Bitte AI. Agent usa herramientas de OpenClaw.",
  },
  {
    emoji: "🧩",
    titleEn: "Provider",
    titleEs: "Proveedor",
    contentEn: "Choose OpenRouter (cloud), Ollama (local), or Bitte AI (onchain) for Standard mode.",
    contentEs: "Elegí OpenRouter (nube), Ollama (local) o Bitte AI (onchain) en modo Standard.",
  },
  {
    emoji: "🔑",
    titleEn: "API Key",
    titleEs: "API Key",
    contentEn: "Paste your OpenRouter key here so the mochi can speak.",
    contentEs: "Pegá tu key de OpenRouter para que el mochi pueda hablar.",
  },
  {
    emoji: "🧪",
    titleEn: "Model",
    titleEs: "Modelo",
    contentEn: "Pick the model for chat. OpenRouter lists many; Ollama needs the exact name.",
    contentEs: "Elegí el modelo de chat. OpenRouter lista muchos; Ollama necesita el nombre exacto.",
  },
  {
    emoji: "🔔",
    titleEn: "Notifications & Volume",
    titleEs: "Notificaciones y Volumen",
    contentEn: "Notification sounds and their volume.",
    contentEs: "Notificaciones y su volumen.",
  },
  {
    emoji: "🗣️",
    titleEn: "Read Aloud",
    titleEs: "Leer en voz alta",
    contentEn: "Turns on text-to-speech so replies are spoken.",
    contentEs: "Activa la lectura en voz alta de las respuestas.",
  },
  {
    emoji: "🎙️",
    titleEn: "Open Mic",
    titleEs: "Micrófono abierto",
    contentEn: "Hands-free mode: listens and replies when you speak.",
    contentEs: "Modo manos libres: escucha y responde cuando hablás.",
  },
  {
    emoji: "🔁",
    titleEn: "Relay",
    titleEs: "Relay",
    contentEn: "Lets mochis pass messages between each other.",
    contentEs: "Permite que los mochis se pasen mensajes entre sí.",
  },
  {
    emoji: "🎨",
    titleEn: "Chat Style",
    titleEs: "Estilo de chat",
    contentEn: "Theme color, background style, font size, and width of the bubble.",
    contentEs: "Color del tema, estilo de fondo, tamaño de fuente y ancho de burbuja.",
  },
  {
    emoji: "🔒",
    titleEn: "Security",
    titleEs: "Seguridad",
    contentEn: "Use a Master Key to encrypt your keys and lock the popup.",
    contentEs: "Usá una Master Key para encriptar tus keys y bloquear el popup.",
  },
  {
    emoji: "🧿",
    titleEn: "Theme",
    titleEs: "Tema",
    contentEn: "Changes only the popup look (not the on-page mochi).",
    contentEs: "Cambia solo el look del popup (no del mochi en la página).",
  },
];

export function HelpSection({ embedded = false }: { embedded?: boolean }) {
  const { isSpanish } = useLanguage();
  const [selectedProvider, setSelectedProvider] = useState(providers[0].id);
  const activeProvider = providers.find(provider => provider.id === selectedProvider) ?? providers[0];
  const variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <section id="help" className={`${embedded ? "pt-0" : "pt-32"} pb-20 px-4 sm:px-6 lg:px-8`}>
      <ScrollAnimation variants={variants}>
        <div className="w-full mx-auto mb-20">
          <div className="mb-6">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/70">
                {isSpanish ? "Creación y NFT" : "Creation and NFT"}
              </p>
            </div>
            <div className="neural-card rounded-3xl border border-cyan-300/15 p-8 sm:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {isSpanish ? "Crear nuevos skins para Mochis" : "Create new skins for Mochis"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    {isSpanish
                      ? "Primero mirá la guía de animaciones para entender cómo preparar los frames. Después usá el creador de personajes para cargarlos, probarlos y crear el skin."
                      : "Start with the animation guide to understand how to prepare the frames. Then use the character creator to upload them, test them, and create the skin."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[26rem]">
                  <Link
                    href={ANIMATION_GUIDE_PATH}
                    onClick={(event) => {
                      event.preventDefault();
                      openSiteDesktopWindow("guide", ANIMATION_GUIDE_PATH);
                    }}
                    className="help-creator-cta help-creator-cta-guide group inline-flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold transition-all"
                  >
                    <span>{isSpanish ? "Guía de animaciones" : "Animation guide"}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href={CHARACTER_CREATOR_PATH}
                    onClick={(event) => {
                      event.preventDefault();
                      openSiteDesktopWindow("creator", CHARACTER_CREATOR_PATH);
                    }}
                    className="help-creator-cta help-creator-cta-builder group inline-flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold transition-all"
                  >
                    <span>{isSpanish ? "Creador de personajes" : "Character creator"}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Install + Unlock combined */}
            <div className="neural-card rounded-3xl p-8 sm:p-10">
              <div className="text-center mb-6">
                <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mb-2">
                  {isSpanish ? "Instalá" : "Install"}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                  {isSpanish
                    ? "Usá la web, la extensión de navegador o la aplicación."
                    : "Use the website, browser extension, or the app."}
                </p>
                <div className="flex justify-center mb-6">
                  <DownloadButton
                    href="/download"
                    labelEn="DOWNLOADS"
                    labelEs="DESCARGAS"
                  />
                </div>
              </div>

              <hr className="border-t border-white/6 my-4" />

              <div className="text-center mt-6">
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-2">
                  {isSpanish
                    ? "Desbloqueá apariencias únicas"
                    : "Unlock unique looks"}
                </h3>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                  {isSpanish
                    ? "Adquirí un NFT en el marketplace para acceder a skins exclusivos."
                    : "Acquire an NFT in the marketplace to access exclusive skins."}
                </p>
                <div className="flex justify-center">
                  <DownloadButton
                    href="/marketplace"
                    labelEn="SEE MARKETPLACE"
                    labelEs="VER MERCADO"
                  />
                </div>
              </div>
            </div>

            {/* Right: Choose your AI Brain */}
            <div className="neural-card rounded-3xl p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                  {isSpanish ? "Elegí tu Cerebro AI" : "Choose your AI Brain"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 mb-6 items-center justify-center">
                {providers.map((provider) => {
                  const isActive = provider.id === activeProvider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={[
                        "px-4 py-2 rounded-full text-sm font-mono transition-all duration-300 border",
                        isActive
                          ? "bg-[var(--brand-accent)]/20 border-[var(--brand-accent)] text-foreground shadow-[0_0_24px_rgba(123,92,255,0.25)]"
                          : "border-white/10 text-muted-foreground hover:border-[var(--brand-accent)]/40 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={isActive}
                    >
                      {provider.id}
                    </button>
                  );
                })}
              </div>

              <div
                key={activeProvider.id}
                className="rounded-2xl transition-all duration-300 animate-in fade-in"
              >
              

                <p className="text-muted-foreground mb-2">
                  {isSpanish ? activeProvider.descriptionEs : activeProvider.descriptionEn}
                </p>
                <p className="text-sm text-foreground/80 mb-5">
                  {isSpanish ? activeProvider.bestForEs : activeProvider.bestForEn}
                </p>

               

                <div className="flex flex-col gap-3 text-sm text-foreground/80">
                  {(isSpanish ? activeProvider.stepsEs : activeProvider.stepsEn).map((item) => (
                    <span key={item} className="flex gap-3">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>

                <div className="mt-6 text-sm">
                  <Link
                    href={activeProvider.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--brand-accent)] hover:text-white transition-colors"
                  >
                    {isSpanish ? activeProvider.link.labelEs : activeProvider.link.labelEn}
                  </Link>
                </div>

                {activeProvider.id === "openclaw" && (
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-fit items-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed opacity-60"
                    >
                      {isSpanish ? "Hosting gestionado (próximamente)" : "Managed hosting (coming soon)"}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {isSpanish
                        ? "Pronto ofreceremos hosting gestionado de OpenClaw para que no tengas que correrlo vos mismo."
                        : "We will soon offer managed OpenClaw hosting so you don't have to run it yourself."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollAnimation>

      <ScrollAnimation variants={variants}>
        <div className="w-full mx-auto">
          <div className="text-center mb-12">
            
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
              {isSpanish ? "Qué hace cada ajuste" : "What each setting does"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configReference.map((item, index) => (
              <div
                key={index}
                className={[
                  "neural-card rounded-2xl p-6",
                  item.highlight
                    ? "ring-1 ring-[var(--brand-accent)]/60 shadow-[0_0_28px_rgba(123,92,255,0.3)]"
                    : ""
                ].join(" ").trim()}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl" aria-hidden="true">
                    {item.emoji}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {isSpanish ? item.titleEs : item.titleEn}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {isSpanish ? item.contentEs : item.contentEn}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollAnimation>
    </section>
  );
}
