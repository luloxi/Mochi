import type { Metadata } from "next";
import { CharacterCreatorPageClient } from "@/components/character-creator-page-client";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Character Creator | Mochi",
  description:
    "Build a Mochi locally in the browser, upload sprites one by one or as a folder, and mint only when the full set is ready.",
  path: "/character-creator",
});

export default async function CharacterCreatorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const embedded = params.embedded === "1";
  return (
    <main className="site-window-page site-window-skin min-h-screen overflow-x-hidden neural-shell">
      <CharacterCreatorPageClient embedded={embedded} />
    </main>
  );
}
