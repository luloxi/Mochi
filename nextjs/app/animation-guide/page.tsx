import type { Metadata } from "next";
import { AnimationGuideView } from "@/components/animation-guide-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Animation Guide | Mochi",
  description:
    "Required Mochi sprite files, visual animation references, and the local-first NFT creator flow.",
  path: "/animation-guide",
});

export default async function AnimationGuidePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const embedded = params.embedded === "1";
  return (
    <main className="site-window-page site-window-skin min-h-screen overflow-x-hidden neural-shell">
      <section className={embedded ? "px-4 pb-8 pt-0 sm:px-6 lg:px-8" : "px-4 pb-20 pt-32 sm:px-6 lg:px-8"}>
        <AnimationGuideView />
      </section>
    </main>
  );
}
