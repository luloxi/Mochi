"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  PREFETCH_SPRITE_KEYS,
  SPRITE_SIZE,
  TICK_MS,
  beginDragPending,
  createMascot,
  createWorkingMascot,
  endDrag,
  mascotDrawBox,
  moveDrag,
  setWorking,
  spriteUrl,
  tickShimeji,
  type Bounds,
  type Perch,
  type ShimejiMascot,
} from "@/lib/companion/shimeji-engine";
import { drawFacingSprite, prefetchFacingSprites } from "@/lib/companion/star-eye";

type CompanionPetProps = {
  working: boolean;
  perch: Perch | null;
  scale?: number;
  label?: string;
  onClick?: () => void;
};

function useBounds(node: HTMLElement | null): Bounds {
  const [bounds, setBounds] = useState<Bounds>({
    width: typeof window === "undefined" ? 800 : window.innerWidth,
    height: typeof window === "undefined" ? 600 : window.innerHeight,
  });
  useEffect(() => {
    const read = () => {
      if (node) {
        const r = node.getBoundingClientRect();
        setBounds({ width: Math.max(1, r.width), height: Math.max(1, r.height) });
      } else {
        setBounds({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [node]);
  return bounds;
}

function MochiCanvas({
  spriteKey,
  facingRight,
}: {
  spriteKey: string;
  facingRight: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void drawFacingSprite(canvas, spriteUrl(spriteKey), facingRight);
  }, [spriteKey, facingRight]);
  return <canvas ref={canvasRef} aria-hidden />;
}

export function CompanionWanderer({ working, perch, scale = 0.72, onClick }: CompanionPetProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<ShimejiMascot | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, setTick] = useState(0);
  const bounds = useBounds(host);

  useEffect(() => {
    prefetchFacingSprites(PREFETCH_SPRITE_KEYS.map((key) => spriteUrl(key)));
  }, []);

  useEffect(() => {
    setHost(hostRef.current);
  }, []);

  useEffect(() => {
    if (!mascotRef.current) mascotRef.current = createMascot(bounds, scale);
  }, [bounds, scale]);

  useEffect(() => {
    if (mascotRef.current) setWorking(mascotRef.current, working);
  }, [working]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const m = mascotRef.current;
      if (!m) return;
      tickShimeji(m, bounds, scale, null, perch);
      setTick((n) => (n + 1) % 1_000_000);
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [bounds, perch, scale]);

  const m = mascotRef.current;
  const box = m ? mascotDrawBox(m, scale) : { left: 0, top: 0, size: SPRITE_SIZE * scale };

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    const mascot = mascotRef.current;
    if (!mascot) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDragPending(mascot, event.clientX, event.clientY, scale);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const mascot = mascotRef.current;
    if (!mascot) return;
    moveDrag(mascot, event.clientX, event.clientY, bounds, scale);
    setTick((n) => (n + 1) % 1_000_000);
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const mascot = mascotRef.current;
    if (!mascot) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    const result = endDrag(mascot);
    if (result === "click") onClick?.();
    setTick((n) => (n + 1) % 1_000_000);
  }

  return (
    <div ref={hostRef} className="companion-overlay" aria-hidden={false}>
      {m ? (
        <button
          type="button"
          className={`companion-mascot${m.isDragging ? " is-dragging" : ""}`}
          style={{
            left: box.left,
            top: box.top,
            width: box.size,
            height: box.size,
            cursor: m.isDragging ? "grabbing" : "grab",
          }}
          aria-label="Mochi, arrastrala o mirala caminar"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        >
          <MochiCanvas spriteKey={m.spriteKey} facingRight={m.facingRight} />
        </button>
      ) : null}
    </div>
  );
}

export function CompanionWorkingSprite({
  scale = 0.62,
  facingRight = false,
}: {
  scale?: number;
  facingRight?: boolean;
}) {
  const mascotRef = useRef<ShimejiMascot | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const m = createWorkingMascot();
    m.facingRight = facingRight;
    mascotRef.current = m;
    const id = window.setInterval(() => {
      tickShimeji(m, { width: 180, height: 140 }, scale, null, { x: 16, y: SPRITE_SIZE * scale });
      m.facingRight = facingRight;
      setTick((n) => (n + 1) % 1_000_000);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [facingRight, scale]);

  const m = mascotRef.current;
  if (!m) return null;
  const size = SPRITE_SIZE * scale;
  return (
    <div
      className="companion-working-sprite"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Mochi trabajando en la compu"
    >
      <MochiCanvas spriteKey={m.spriteKey} facingRight={facingRight} />
    </div>
  );
}
