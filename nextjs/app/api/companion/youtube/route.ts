import { NextRequest, NextResponse } from "next/server";
import { clipFromId, type YtClip } from "@/lib/companion/youtube";

export const runtime = "nodejs";

type InvItem = {
  type?: string;
  videoId?: string;
  title?: string;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) {
    return NextResponse.json({ clips: [] as YtClip[] });
  }
  const url = `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(q)}&type=video`;
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ clips: [] as YtClip[], error: "SEARCH_UNAVAILABLE" });
    }
    const payload = (await upstream.json()) as InvItem[];
    const clips: YtClip[] = [];
    if (Array.isArray(payload)) {
      for (const row of payload) {
        if (!row || row.type === "channel") continue;
        const id = typeof row.videoId === "string" ? row.videoId : "";
        if (id.length < 6) continue;
        clips.push(clipFromId(id, typeof row.title === "string" ? row.title : id));
        if (clips.length >= 8) break;
      }
    }
    return NextResponse.json({ clips });
  } catch {
    return NextResponse.json({ clips: [] as YtClip[], error: "SEARCH_UNAVAILABLE" });
  }
}
