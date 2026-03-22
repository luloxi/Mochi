import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketplaceHub } from "@/components/marketplace-hub";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Marketplace | Mochi",
  description:
    "Explore listings and manage your Mochi NFTs and artist profile on Avalanche.",
  path: "/marketplace",
});

export default function MarketplacePage() {
  return (
    <main className="site-window-page site-window-skin min-h-screen overflow-x-hidden neural-shell">
      <Suspense fallback={null}>
        <MarketplaceHub mode="marketplace" />
      </Suspense>
    </main>
  );
}
