/**
 * Open desk windows. Close removes them; it does not hide them behind.
 * Dock click on an open pane minimizes (keeps state + media). Desktop:
 * drag, z-order, resize. Phone miniapps go fullscreen.
 */

export type LiveWindow = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized?: boolean;
  maximized?: boolean;
  /** Geometry before maximize, so restore comes back. */
  preMax?: { x: number; y: number; w: number; h: number };
};

export const MIN_WINDOW = { w: 200, h: 140 };
export const DEFAULT_WINDOW = { w: 280, h: 320 };
export const WINDOW_Z_FLOOR = 30;
/** Stay below companion-overlay (pets) so mascots walk over panes. */
export const WINDOW_Z_CAP = 80;

export function nextZ(windows: LiveWindow[], floor = WINDOW_Z_FLOOR): number {
  const raw = windows.reduce((z, win) => Math.max(z, win.z), floor) + 1;
  return Math.min(raw, WINDOW_Z_CAP);
}

export function windowIsOpen(windows: LiveWindow[], id: string): boolean {
  return windows.some((win) => win.id === id);
}

export function windowIsMinimized(windows: LiveWindow[], id: string): boolean {
  return windows.some((win) => win.id === id && !!win.minimized);
}

export function windowIsVisible(windows: LiveWindow[], id: string): boolean {
  return windows.some((win) => win.id === id && !win.minimized);
}

export function openWindow(
  windows: LiveWindow[],
  id: string,
  seed?: Partial<Omit<LiveWindow, "id">>,
): LiveWindow[] {
  const z = nextZ(windows, seed?.z != null ? seed.z - 1 : WINDOW_Z_FLOOR);
  const found = windows.find((win) => win.id === id);
  if (found) {
    return windows.map((win) => (win.id === id ? { ...win, z, minimized: false } : win));
  }
  const i = windows.length;
  return [
    ...windows,
    {
      id,
      x: seed?.x ?? 48 + i * 24,
      y: seed?.y ?? 72 + i * 20,
      w: seed?.w ?? DEFAULT_WINDOW.w,
      h: seed?.h ?? DEFAULT_WINDOW.h,
      z,
      minimized: false,
      maximized: false,
    },
  ];
}

/** Remove the window. Not a z-index hide. */
export function closeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  return windows.filter((win) => win.id !== id);
}

/** Hide the pane. Keep it mounted so video/radio keep playing. */
export function minimizeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  return windows.map((win) => (win.id === id ? { ...win, minimized: true } : win));
}

export function restoreWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  if (!windowIsOpen(windows, id)) return windows;
  const z = nextZ(windows);
  return windows.map((win) => (win.id === id ? { ...win, minimized: false, z } : win));
}

export type DockClickAction = "open" | "minimize" | "restore";

/** Open item → minimize. Minimized item → restore. Missing → open. */
export function clickDockApp(
  windows: LiveWindow[],
  id: string,
  seed?: Partial<Omit<LiveWindow, "id">>,
): { windows: LiveWindow[]; action: DockClickAction } {
  const found = windows.find((win) => win.id === id);
  if (!found) return { windows: openWindow(windows, id, seed), action: "open" };
  if (found.minimized) return { windows: restoreWindow(windows, id), action: "restore" };
  return { windows: minimizeWindow(windows, id), action: "minimize" };
}

export function focusWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  if (!windowIsOpen(windows, id)) return windows;
  const z = nextZ(windows);
  return windows.map((win) => (win.id === id ? { ...win, z, minimized: false } : win));
}

export function moveWindow(windows: LiveWindow[], id: string, x: number, y: number): LiveWindow[] {
  return windows.map((win) =>
    win.id === id ? { ...win, x: Math.max(8, x), y: Math.max(8, y) } : win,
  );
}

export function clampSize(w: number, h: number): { w: number; h: number } {
  return {
    w: Math.max(MIN_WINDOW.w, Math.round(w)),
    h: Math.max(MIN_WINDOW.h, Math.round(h)),
  };
}

export function resizeWindow(
  windows: LiveWindow[],
  id: string,
  next: { x?: number; y?: number; w: number; h: number },
): LiveWindow[] {
  const size = clampSize(next.w, next.h);
  return windows.map((win) => {
    if (win.id !== id) return win;
    return {
      ...win,
      x: next.x != null ? Math.max(8, next.x) : win.x,
      y: next.y != null ? Math.max(8, next.y) : win.y,
      w: size.w,
      h: size.h,
    };
  });
}

export function maximizeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  if (!windowIsOpen(windows, id)) return windows;
  const z = nextZ(windows);
  return windows.map((win) => {
    if (win.id !== id) return win;
    if (win.maximized) return { ...win, z, minimized: false };
    return {
      ...win,
      z,
      minimized: false,
      maximized: true,
      preMax: { x: win.x, y: win.y, w: win.w, h: win.h },
    };
  });
}

export function unmaximizeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  return windows.map((win) => {
    if (win.id !== id || !win.maximized) return win;
    const prev = win.preMax;
    return {
      ...win,
      maximized: false,
      preMax: undefined,
      x: prev?.x ?? win.x,
      y: prev?.y ?? win.y,
      w: prev?.w ?? win.w,
      h: prev?.h ?? win.h,
      minimized: false,
    };
  });
}

export function toggleMaximizeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  const found = windows.find((win) => win.id === id);
  if (!found) return windows;
  return found.maximized ? unmaximizeWindow(windows, id) : maximizeWindow(windows, id);
}

export const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeDir = (typeof RESIZE_DIRS)[number];

export function applyResizeDir(
  win: { x: number; y: number; w: number; h: number },
  dir: ResizeDir,
  dx: number,
  dy: number,
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = win;
  if (dir.includes("e")) w += dx;
  if (dir.includes("s")) h += dy;
  if (dir.includes("w")) {
    w -= dx;
    x += dx;
  }
  if (dir.includes("n")) {
    h -= dy;
    y += dy;
  }
  const size = clampSize(w, h);
  if (dir.includes("w")) x = win.x + win.w - size.w;
  if (dir.includes("n")) y = win.y + win.h - size.h;
  return { x: Math.max(8, x), y: Math.max(8, y), w: size.w, h: size.h };
}
