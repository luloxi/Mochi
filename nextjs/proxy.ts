import { NextRequest, NextResponse } from "next/server";

// Known valid top-level path prefixes in this app.
const VALID_PREFIXES = [
  "/api/",
  "/animation-guide",
  "/auction",
  "/character-creator",
  "/collection",
  "/download",
  "/downloads",
  "/help",
  "/marketplace",
  "/my-profile",
  "/privacy",
  "/profile",
  "/settings",
  "/subscription",
  "/_next/",
  "/favicon",
  "/manifest",
  "/robots",
  "/sitemap",
  "/icon",
  "/apple-icon",
  "/sprites/",
];

// Static file extensions served from /public — allow these through so the
// Next.js static file server can handle them.
const STATIC_EXT = /\.(png|svg|jpg|jpeg|gif|webp|ico|wav|mp3|md|txt|xml|webmanifest|json)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect old sprite API path to new static path.
  if (pathname.startsWith("/api/site-mochi/sprite/")) {
    const newPath = pathname.replace("/api/site-mochi/sprite/", "/sprites/");
    return NextResponse.redirect(new URL(newPath, request.url), 301);
  }

  // Allow root and all known prefixes through.
  if (pathname === "/" || VALID_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public static files through.
  if (STATIC_EXT.test(pathname)) {
    return NextResponse.next();
  }

  // Everything else (bot probes, scanners, unknown paths) gets a static 404
  // at the edge — no serverless function invocation needed.
  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  // Run on all paths except Next.js internals.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
