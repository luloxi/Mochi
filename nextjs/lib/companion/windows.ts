/**
 * Open desk windows. Close removes them; it does not hide them behind.
 * Desktop: drag, z-order, resize. Phone miniapps go fullscreen.
 */

export type LiveWindow = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export const MIN_WINDOW = { w: 200, h: 140 };
export const DEFAULT_WINDOW = { w: 280, h: 320 };

export function nextZ(windows: LiveWindow[], floor = 30): number {
  return windows.reduce((z, win) => Math.max(z, win.z), floor) + 1;
}

export function windowIsOpen(windows: LiveWindow[], id: string): boolean {
  return windows.some((win) => win.id === id);
}

export function openWindow(
  windows: LiveWindow[],
  id: string,
  seed?: Partial<Omit<LiveWindow, "id">>,
): LiveWindow[] {
  const z = nextZ(windows, seed?.z != null ? seed.z - 1 : 30);
  const found = windows.find((win) => win.id === id);
  if (found) {
    return windows.map((win) => (win.id === id ? { ...win, z } : win));
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
    },
  ];
}

/** Remove the window. Not a z-index hide. */
export function closeWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  return windows.filter((win) => win.id !== id);
}

export function focusWindow(windows: LiveWindow[], id: string): LiveWindow[] {
  if (!windowIsOpen(windows, id)) return windows;
  const z = nextZ(windows);
  return windows.map((win) => (win.id === id ? { ...win, z } : win));
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
