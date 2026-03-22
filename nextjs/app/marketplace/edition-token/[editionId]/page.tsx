import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MarketplaceEditionOwnerActions } from "@/components/marketplace-edition-owner-actions";
import { fetchEditionListings } from "@/lib/marketplace";
import { fetchEditionTokenById } from "@/lib/nft-read";
import { fetchTokenMetadataPreview } from "@/lib/token-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ editionId: string }>;
};

function walletShort(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function MarketplaceEditionTokenPage({ params }: Params) {
  const requestHeaders = await headers();
  const isSpanish = requestHeaders.get("accept-language")?.toLowerCase().startsWith("es") ?? false;
  const t = (en: string, es: string) => (isSpanish ? es : en);

  const { editionId } = await params;
  const parsedEditionId = Number.parseInt(editionId, 10);
  if (!Number.isInteger(parsedEditionId) || parsedEditionId < 0) notFound();

  const [edition, allListings] = await Promise.all([
    fetchEditionTokenById(parsedEditionId),
    fetchEditionListings().catch(() => []),
  ]);
  if (!edition) notFound();

  const activeListings = allListings
    .filter((listing) => listing.active && listing.editionId === parsedEditionId)
    .sort((a, b) => a.listingId - b.listingId);
  const metadata = await fetchTokenMetadataPreview(edition.tokenUri);
  const title = metadata.name || `${t("Mochi Edition", "Edición Mochi")} #${edition.editionId}`;

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <section className="px-4 pb-16 pt-28">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
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

            <div className="rounded-2xl border border-border bg-white/10 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("Edition ID", "ID de edición")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">#{edition.editionId}</p>
                </div>
                <div className="rounded-xl border border-border bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("Total supply", "Supply total")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{edition.totalSupply}</p>
                </div>
                <div className="rounded-xl border border-border bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("Active listings", "Publicaciones activas")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{activeListings.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("Creator", "Creador")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{walletShort(edition.creator)}</p>
                </div>
              </div>
              {metadata.metadataUrl ? (
                <a
                  href={metadata.metadataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t("Open metadata", "Abrir metadata")}
                </a>
              ) : null}
            </div>

            {activeListings.length > 0 ? (
              <div className="rounded-2xl border border-border bg-white/10 p-4">
                <h2 className="text-sm font-semibold text-foreground">{t("Marketplace status", "Estado en marketplace")}</h2>
                <div className="mt-3 grid gap-2">
                  {activeListings.map((listing) => (
                    <Link
                      key={listing.listingId}
                      href={`/marketplace/edition/${listing.listingId}`}
                      className="rounded-xl border border-border bg-white/5 p-3 hover:bg-white/10"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {t("Listing", "Publicación")} #{listing.listingId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {listing.remainingAmount} {t("copies available", "copias disponibles")} · {listing.currency === "Usdc" ? "USDC" : "AVAX"}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <MarketplaceEditionOwnerActions editionId={edition.editionId} activeListings={activeListings} />
        </div>
      </section>
    </main>
  );
}
