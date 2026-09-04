"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  RESIZE_DIRS,
  applyResizeDir,
  type LiveWindow,
  type ResizeDir,
} from "@/lib/companion/windows";

export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const read = () => setPhone(window.innerWidth <= 699);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return phone;
}

export function DeskWindow({
  id,
  title,
  phone,
  pos,
  variant = "app",
  className = "",
  tint,
  onClose,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  minimized = false,
  children,
}: {
  id: string;
  title: string;
  phone: boolean;
  pos: LiveWindow;
  variant?: "app" | "talk";
  className?: string;
  tint?: string;
  minimized?: boolean;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (next: { x: number; y: number; w: number; h: number }) => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  children: ReactNode;
}) {
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resize = useRef<{
    dir: ResizeDir;
    x: number;
    y: number;
    start: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const full = phone && variant === "app";
  const talkPhone = phone && variant === "talk";
  const canChrome = !full && !talkPhone;

  function headerDown(event: PointerEvent<HTMLElement>) {
    if (!canChrome) return;
    if ((event.target as HTMLElement).closest("[data-win-close], [data-win-min], [data-win-max], [data-win-resize]")) return;
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: pos.x, top: pos.y };
  }
  function headerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    onMove(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y);
  }
  function headerUp(event: PointerEvent<HTMLElement>) {
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function resizeDown(dir: ResizeDir, event: PointerEvent<HTMLElement>) {
    if (!canChrome) return;
    event.stopPropagation();
    event.preventDefault();
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = {
      dir,
      x: event.clientX,
      y: event.clientY,
      start: { x: pos.x, y: pos.y, w: pos.w, h: pos.h },
    };
  }
  function resizeMove(event: PointerEvent<HTMLElement>) {
    if (!resize.current) return;
    const dx = event.clientX - resize.current.x;
    const dy = event.clientY - resize.current.y;
    onResize(applyResizeDir(resize.current.start, resize.current.dir, dx, dy));
  }
  function resizeUp(event: PointerEvent<HTMLElement>) {
    resize.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  const maximized = !!pos.maximized && !full;
  const shell =
    full ? "miniapp-full" : variant === "talk" ? `talk-window${className ? ` ${className}` : ""}` : "miniapp-window";
  const hidden = minimized ? " is-minimized" : "";
  const maxClass = maximized ? " is-maximized" : "";

  return (
    <section
      className={`${shell}${hidden}${maxClass}`}
      data-miniapp-window={variant === "app" ? id : undefined}
      data-talk-window={variant === "talk" ? id : undefined}
      data-talk-never-hide={variant === "talk" ? "true" : undefined}
      data-phone-full={full ? "true" : "false"}
      data-minimized={minimized ? "true" : "false"}
      data-tint={tint}
      role="dialog"
      aria-hidden={minimized}
      aria-label={title}
      style={
        canChrome
          ? maximized
            ? { left: 12, top: 12, width: "calc(100vw - 24px)", height: "calc(100dvh - 88px)", zIndex: pos.z, transform: "none" }
            : { left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: pos.z, transform: "none" }
          : full
            ? undefined
            : { zIndex: pos.z }
      }
      data-maximized={maximized ? "true" : "false"}
      onPointerDown={onFocus}
    >
      <header
        className={variant === "talk" ? "talk-chrome miniapp-chrome" : "miniapp-chrome"}
        onPointerDown={headerDown}
        onPointerMove={headerMove}
        onPointerUp={headerUp}
        onPointerCancel={headerUp}
      >
        <span>{title}</span>
        <span className="win-chrome-actions">
          {canChrome && onMinimize ? (
            <button
              type="button"
              className="talk-close win-min"
              data-win-min
              aria-label="Minimizar"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onMinimize();
              }}
            >
              –
            </button>
          ) : null}
          {canChrome && onMaximize ? (
            <button
              type="button"
              className="talk-close win-max"
              data-win-max
              aria-label={maximized ? "Restaurar" : "Maximizar"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onMaximize();
              }}
            >
              {maximized ? "⧉" : "□"}
            </button>
          ) : null}
          <button
            type="button"
            className="talk-close"
            data-win-close
            aria-label="Cerrar"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            ×
          </button>
        </span>
      </header>
      {children}
      {canChrome && !maximized
        ? RESIZE_DIRS.map((dir) => (
            <span
              key={dir}
              className="win-resize"
              data-win-resize={dir}
              data-dir={dir}
              onPointerDown={(event) => resizeDown(dir, event)}
              onPointerMove={resizeMove}
              onPointerUp={resizeUp}
              onPointerCancel={resizeUp}
            />
          ))
        : null}
    </section>
  );
}
