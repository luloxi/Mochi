"use client";

import { useEffect, useState } from "react";
import { Download, Play } from "lucide-react";
import {
  PREVIEW_ANIMATION_SETS,
  REQUIRED_SPRITES_ZIP_PATH,
  animationReferenceSpriteUrl,
} from "@/lib/mochi-sprite-spec";
import { useLanguage } from "@/components/language-provider";

type GuideSection = {
  key: string;
  title: string;
  description: string;
  explanation: string;
  frames: readonly string[];
};

const sections: GuideSection[] = [
  {
    key: "walk",
    title: "Caminar",
    description: "stand-neutral -> walk-step-left -> stand-neutral -> walk-step-right",
    explanation:
      "Este loop base marca el ritmo del personaje en escritorio y web. Si el baseline cambia entre frames, el personaje vibra o salta visualmente.",
    frames: PREVIEW_ANIMATION_SETS.walk,
  },
  {
    key: "jump",
    title: "Salto y aterrizaje",
    description: "jump -> fall -> bounce-squish -> bounce-recover -> stand-neutral",
    explanation:
      "La secuencia pasa por impulso, caída y recuperación. El rebote le da peso; sin esos frames el personaje se siente rígido.",
    frames: PREVIEW_ANIMATION_SETS.jump,
  },
  {
    key: "drag",
    title: "Arrastre y resistencia",
    description: "tilt-left / tilt-right + resist-frame-1 / resist-frame-2",
    explanation:
      "Cuando arrastrás al mochi, primero cambia a inclinaciones suaves o fuertes según la dirección y la tensión del drag. Si se estira o resiste, alterna entre resist-frame-1 y resist-frame-2.",
    frames: PREVIEW_ANIMATION_SETS.drag,
  },
  {
    key: "wall-ceiling",
    title: "Pared y techo",
    description: "grab-wall / climb-wall y grab-ceiling / climb-ceiling",
    explanation:
      "Los frames de agarre fijan la pose y los de climb alternan el movimiento. Esa combinación evita que escalar se vea como un simple teletransporte.",
    frames: [...PREVIEW_ANIMATION_SETS.wall, ...PREVIEW_ANIMATION_SETS.ceiling],
  },
  {
    key: "idle",
    title: "Idle expresivo",
    description: "sit -> sit-look-up -> spin-head loop -> sit",
    explanation:
      "Este bloque hace que el personaje siga vivo cuando no está caminando. El spin-head necesita una progresión consistente para que el loop cierre limpio.",
    frames: PREVIEW_ANIMATION_SETS.idle,
  },
  {
    key: "using-computer",
    title: "Usando computadora",
    description: "sit-pc-edge-legs-down -> dangle-1 -> dangle-2 -> dangle-1",
    explanation:
      "Este es el loop que usa el mochi web cuando la burbuja de chat está abierta y el personaje queda apoyado en el borde de la interfaz como si estuviera usando la compu.",
    frames: PREVIEW_ANIMATION_SETS.usingComputer,
  },
];

function FrameLoop({ frames, title }: { frames: readonly string[]; title: string }) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 450);
    return () => window.clearInterval(timer);
  }, [frames]);

  const activeFrame = frames[frameIndex] || frames[0];

  return (
    <div className="animation-guide-card neural-card rounded-[1.5rem] border border-cyan-300/15 p-5">
      <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.03]">
        <div className="animation-guide-preview-badge absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1">
          <Play className="animation-guide-preview-icon h-2.5 w-2.5 fill-cyan-300 text-cyan-300" />
          <span className="animation-guide-preview-label text-[10px] font-medium text-cyan-200/80">preview</span>
        </div>
        <img
          src={animationReferenceSpriteUrl(activeFrame)}
          alt={`${title} - ${activeFrame}`}
          className="h-40 w-40 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.35)]"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {frames.map((frame, index) => (
          <span
            key={`${title}-${frame}-${index}`}
            className={`animation-guide-frame-chip rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
              index === frameIndex
                ? "border-cyan-300/30 bg-cyan-400/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-foreground/60"
            }`}
          >
            {frame}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnimationGuideView() {
  const { isSpanish } = useLanguage();
  const t = (en: string, es: string) => (isSpanish ? es : en);

  return (
    <div className="animation-guide-view mx-auto max-w-6xl space-y-8">
      <div className="animation-guide-hero neural-card rounded-3xl border border-cyan-300/15 p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm leading-7 text-foreground/80 sm:text-base">
              {t(
                "This guide shows the real sprites, explains what each sequence is for, and plays a simple loop so you can understand how each animation works. The character creator lets you preview animations with the frames you create.",
                "Esta guía muestra los sprites reales, explica para qué sirve cada secuencia y reproduce un loop simple para que entiendas cómo funciona cada animación. El creador de personajes te permite previsualizar animaciones con los frames que vayas creando.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={REQUIRED_SPRITES_ZIP_PATH}
              download
              className="animation-guide-cta animation-guide-cta-secondary inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all"
            >
              <Download className="h-4 w-4" />
              {t("Download sprite ZIP", "Descargar ZIP de sprites")}
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {sections.map((section) => (
          <div key={section.key} className="animation-guide-section neural-card rounded-3xl border border-white/10 p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
                <p className="animation-guide-sequence mt-2 font-mono text-xs text-cyan-300/80">{section.description}</p>
                <p className="mt-4 text-sm leading-7 text-foreground/80">{section.explanation}</p>
              </div>
              <FrameLoop frames={section.frames} title={section.title} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {section.frames.map((frame, index) => (
                <div key={`${section.key}-${frame}-${index}`} className="animation-guide-thumb group rounded-2xl border border-white/10 bg-white/[0.04] p-0 transition-colors hover:border-white/20">
                  <div className="animation-guide-thumb-frame flex aspect-square items-center justify-center rounded-[calc(1rem-1px)] border border-white/10 bg-white/5">
                    <img
                      src={animationReferenceSpriteUrl(frame)}
                      alt={frame}
                      className="h-24 w-24 object-contain transition-transform group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                  <p className="animation-guide-thumb-label mt-2 break-all text-[11px] text-foreground/70">{frame}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
