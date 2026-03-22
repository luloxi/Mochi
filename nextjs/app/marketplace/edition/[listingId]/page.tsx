import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MarketplaceEditionDetailActions } from "@/components/marketplace-edition-detail-actions";
import { fetchEditionListings } from "@/lib/marketplace";
import { fetchEditionTokenById } from "@/lib/nft-read";
import { fetchTokenMetadataPreview } from "@/lib/token-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ listingId: string }>;
};

export default async function MarketplaceEditionPage({ params }: Params) {
  const requestHeaders = await headers();
  const isSpanish = requestHeaders.get("accept-language")?.toLowerCase().startsWith("es") ?? false;
  const t = (en: string, es: string) => (isSpanish ? es : en);

  const { listingId } = await params;
  const parsedListingId = Number.parseInt(listingId, 10);
  if (!Number.isInteger(parsedListingId) || parsedListingId < 0) notFound();

  const listings = await fetchEditionListings();
  const listing = listings.find((item) => item.listingId === parsedListingId) ?? null;
  if (!listing) notFound();

  const token = await fetchEditionTokenById(listing.editionId);
  if (!token) notFound();

  const metadata = await fetchTokenMetadataPreview(token.tokenUri);
  const title = metadata.name || `${t("Mochi Edition", "Edición Mochi")} #${token.editionId}`;

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <section className="px-4 pb-16 pt-28">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-white/10 p-5">
            <div className="overflow-hidden rounded-2xl border border-border bg-white/5">
              <div className="aspect-square w-full">
                {metadata.imageUrl ? (
                  <img src={metadata.imageUrl} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    {t("Image unavailable", "Imagen no disponible")}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ERC-1155</p>
              <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {metadata.description || t("Edition collectible that unlocks a character appearance.", "Coleccionable de edición que desbloquea una apariencia de personaje.")}
              </p>
            </div>
          </div>

          <MarketplaceEditionDetailActions
            listingId={listing.listingId}
            sellerWallet={listing.seller}
            price={listing.price.toString()}
            currency={listing.currency}
            remainingAmount={listing.remainingAmount}
          />
        </div>
      </section>
    </main>
  );
}
