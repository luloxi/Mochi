import type { Metadata } from "next";
import { SiteMochiConfigPanel } from "@/components/site-mochi-config-panel";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Settings | Mochi",
  description: "Configure website mochi settings.",
  path: "/settings",
});

export default function SettingsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <SiteMochiConfigPanel inline />
      </div>
    </main>
  );
}
