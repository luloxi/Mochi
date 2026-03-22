import type { Metadata } from "next";
import { HelpSection } from "@/components/help-section";
import { FAQSection } from "@/components/faq-section";
import { ProjectFeedbackBox } from "@/components/project-feedback-box";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Setup Guides | Mochi",
  description:
    "Configure OpenRouter, Ollama, or OpenClaw for your Mochi with step-by-step setup guides.",
  path: "/help",
});

export default async function HelpPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const embedded = params.embedded === "1";
  return (
    <main className="site-window-page site-window-skin min-h-screen overflow-x-hidden neural-shell">
      <HelpSection embedded={embedded} />
      <FAQSection />
      <div id="feedback">
        <ProjectFeedbackBox />
      </div>
    </main>
  );
}
