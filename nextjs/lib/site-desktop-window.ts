"use client";

export type SiteDesktopWindowKey =
  | "personalize"
  | "marketplace"
  | "creator"
  | "guide"
  | "help"
  | "download";

export const SITE_DESKTOP_OPEN_WINDOW_EVENT = "mochi:desktop-open-window";

export function openSiteDesktopWindow(windowKey: SiteDesktopWindowKey, fallbackHref?: string) {
  if (typeof window === "undefined") return;

  const event = new CustomEvent(SITE_DESKTOP_OPEN_WINDOW_EVENT, {
    cancelable: true,
    detail: { windowKey },
  });

  const handled = !window.dispatchEvent(event);
  if (!handled && fallbackHref) {
    window.location.assign(fallbackHref);
  }
}
