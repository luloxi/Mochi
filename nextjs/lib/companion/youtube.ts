export type YtClip = {
  id: string;
  title: string;
  thumb: string;
};

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i,
];

export function extractYouTubeId(input: string): string | null {
  const text = String(input || "").trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  for (const pattern of YT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeEmbedUrl(id: string, autoplay = false): string {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  return autoplay ? `${base}?autoplay=1` : base;
}

export function youtubeOembedUrl(id: string): string {
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(id))}&format=json`;
}

export function clipFromId(id: string, title = ""): YtClip {
  return { id, title: title || id, thumb: youtubeThumb(id) };
}

export function pushUniqueClip(list: YtClip[], item: YtClip, max = 16): YtClip[] {
  const next = [item, ...list.filter((row) => row.id !== item.id)];
  return next.slice(0, max);
}

export function enqueueClip(queue: YtClip[], item: YtClip, max = 20): YtClip[] {
  if (queue.some((row) => row.id === item.id)) return queue;
  return [...queue, item].slice(0, max);
}

export function takeNextClip(queue: YtClip[]): { next: YtClip | null; rest: YtClip[] } {
  if (!queue.length) return { next: null, rest: [] };
  const [next, ...rest] = queue;
  return { next, rest };
}

export const YT_STARTERS: YtClip[] = [
  clipFromId("jfKfPfyJRdk", "lofi hip hop radio"),
  clipFromId("5qap5aO4i9A", "lofi beats to focus"),
  clipFromId("DWcJFNfaw9c", "lofi sleep"),
];
