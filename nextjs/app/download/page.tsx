import type { Metadata } from "next";
import DownloadClient from "./DownloadClient";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Download | Mochi",
  description:
    "Download Mochi for browser and desktop, then connect your AI companion in minutes.",
  path: "/download",
});

export default async function DownloadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const embedded = params.embedded === "1";
  return <DownloadClient embedded={embedded} />;
}
