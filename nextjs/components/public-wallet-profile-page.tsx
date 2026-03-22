import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon, UserRound } from "lucide-react";
import {
  formatMarketplaceTokenAmount,
  type TokenPreview,
} from "@/components/marketplace-hub-shared";
import { PublicProfileHeaderEditor } from "@/components/public-profile-header-editor";
import { fetchAuctions } from "@/lib/auction";
import { getArtistProfile, isValidWalletAddress } from "@/lib/artist-profiles-store";
import { fetchEditionListings, fetchListings } from "@/lib/marketplace";
import { fetchOwnedEditionsByWallet, fetchOwnedNftsByWallet } from "@/lib/nft-read";
import { fetchSwapBids, fetchSwapListings } from "@/lib/swap";
import { fetchTokenMetadataPreview } from "@/lib/token-metadata";

type PublicWalletProfilePageProps = {
  wallet: string;
};

type OwnedCollectionAsset =
  | {
      kind: "nft";
      assetId: number;
      tokenUri: string;
      isCommissionEgg: boolean;
      quantity: 1;
      href: string;
    }
  | {
      kind: "edition";
      assetId: number;
      tokenUri: string;
      isCommissionEgg: false;
      quantity: number;
      href: string;
    };

function walletShort(value: string) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function fetchTokenPreviewMap(tokenUris: string[]): Promise<Record<string, TokenPreview>> {
  const uniqueUris = Array.from(new Set(tokenUris.filter((uri) => typeof uri === "string" && uri.trim().length > 0)));
  const entries = await Promise.all(
    uniqueUris.map(async (uri) => {
      const preview = await fetchTokenMetadataPreview(uri);
      return [uri, { imageUrl: preview.imageUrl, name: preview.name }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function PublicWalletProfilePage({ wallet }: PublicWalletProfilePageProps) {
  const normalizedWallet = wallet.trim();

  if (!isValidWalletAddress(normalizedWallet)) {
    notFound();
  }

  const [profile, ownedNfts, ownedEditions, listings, editionListings, auctions, swapListings, swapBids] = await Promise.all([
    getArtistProfile(normalizedWallet),
    fetchOwnedNftsByWallet(normalizedWallet, { totalCap: 1000 }).catch(() => []),
    fetchOwnedEditionsByWallet(normalizedWallet, { totalCap: 250 }).catch(() => []),
    fetchListings().catch(() => []),
    fetchEditionListings().catch(() => []),
    fetchAuctions({ includeEnded: false, limit: 500 }).catch(() => []),
    fetchSwapListings().catch(() => []),
    fetchSwapBids().catch(() => []),
  ]);

  const activeListingsByToken = new Map(
    listings
      .filter((listing) => listing.active && listing.seller === normalizedWallet)
      .map((listing) => [listing.tokenId, listing]),
  );

  const activeItemAuctionsByToken = new Map(
    auctions
      .filter(
        (snapshot) =>
          snapshot.auction.isItemAuction &&
          snapshot.auction.seller === normalizedWallet &&
          snapshot.auction.tokenId !== null,
      )
      .map((snapshot) => [snapshot.auction.tokenId as number, snapshot]),
  );

  const activeEditionListingsByEdition = new Map<number, typeof editionListings>();
  for (const listing of editionListings.filter((listing) => listing.active && listing.seller === normalizedWallet)) {
    const bucket = activeEditionListingsByEdition.get(listing.editionId) ?? [];
    bucket.push(listing);
    activeEditionListingsByEdition.set(listing.editionId, bucket);
  }

  const myActiveSwapListings = swapListings.filter(
    (listing) => listing.active && listing.creator === normalizedWallet,
  );
  const outgoingSwapsByOfferedToken = new Map<number, number>();
  for (const listing of myActiveSwapListings) {
    outgoingSwapsByOfferedToken.set(
      listing.offeredTokenId,
      (outgoingSwapsByOfferedToken.get(listing.offeredTokenId) || 0) + 1,
    );
  }

  const mySwapListingById = new Map(myActiveSwapListings.map((listing) => [listing.listingId, listing]));
  const incomingSwapBidsByOfferedToken = new Map<number, number>();
  for (const bid of swapBids.filter((bid) => bid.active)) {
    const listing = mySwapListingById.get(bid.listingId);
    if (!listing) continue;
    incomingSwapBidsByOfferedToken.set(
      listing.offeredTokenId,
      (incomingSwapBidsByOfferedToken.get(listing.offeredTokenId) || 0) + 1,
    );
  }

  const displayName = profile?.displayName?.trim() || walletShort(normalizedWallet);
  const ownedCollectionAssets: OwnedCollectionAsset[] = [
    ...ownedNfts.map((token) => ({
      kind: "nft" as const,
      assetId: token.tokenId,
      tokenUri: token.tokenUri,
      isCommissionEgg: token.isCommissionEgg,
      quantity: 1 as const,
      href: `/marketplace/mochi/${token.tokenId}`,
    })),
    ...ownedEditions
      .filter((edition) => edition.balance > 0)
      .map((edition) => ({
        kind: "edition" as const,
        assetId: edition.editionId,
        tokenUri: edition.tokenUri,
        isCommissionEgg: false as const,
        quantity: edition.balance,
        href: `/marketplace/edition-token/${edition.editionId}`,
      })),
  ].sort((a, b) => b.assetId - a.assetId || (a.kind === "nft" ? -1 : 1));
  const tokenPreviews = await fetchTokenPreviewMap(ownedCollectionAssets.map((asset) => asset.tokenUri));

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <PublicProfileHeaderEditor
          wallet={normalizedWallet}
          initialProfile={profile}
          fallbackName={displayName}
        />

        <section className="rounded-3xl border border-border bg-white/10 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div role="tablist" aria-label="NFT tabs" className="inline-flex rounded-xl border border-border bg-white/5 p-1">
              <button
                type="button"
                role="tab"
                aria-selected={true}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-foreground"
              >
                NFTs + Editions
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{ownedCollectionAssets.length}</div>
          </div>

          {ownedCollectionAssets.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ownedCollectionAssets.map((asset) => {
                const isEdition = asset.kind === "edition";
                const listing = !isEdition ? (activeListingsByToken.get(asset.assetId) ?? null) : null;
                const editionListingsForAsset = isEdition ? (activeEditionListingsByEdition.get(asset.assetId) ?? []) : [];
                const activeEditionCopiesListed = editionListingsForAsset.reduce(
                  (sum, item) => sum + item.remainingAmount,
                  0,
                );
                const auction = !isEdition ? (activeItemAuctionsByToken.get(asset.assetId) ?? null) : null;
                const swapOut = !isEdition ? (outgoingSwapsByOfferedToken.get(asset.assetId) || 0) : 0;
                const swapIn = !isEdition ? (incomingSwapBidsByOfferedToken.get(asset.assetId) || 0) : 0;
                const isCommission = Boolean(asset.isCommissionEgg || listing?.isCommissionEgg);
                const preview = asset.tokenUri ? tokenPreviews[asset.tokenUri] : null;
                const previewImageUrl = preview?.imageUrl || null;
                const previewName = preview?.name || (isEdition ? `Mochi Edition #${asset.assetId}` : `Mochi #${asset.assetId}`);
                const hasSwap = swapOut > 0 || swapIn > 0;
                const primaryLabel = isEdition
                  ? activeEditionCopiesListed > 0
                    ? `${asset.quantity} copias · ${activeEditionCopiesListed} listadas`
                    : `${asset.quantity} ${asset.quantity === 1 ? "copia" : "copias"}`
                  : listing
                    ? `${formatMarketplaceTokenAmount(listing.price, listing.currency === "Usdc" ? "USDC" : "AVAX")} ${listing.currency === "Usdc" ? "USDC" : "AVAX"}`
                    : auction
                      ? `#${auction.auctionId}`
                      : hasSwap
                        ? `${swapOut > 0 ? `pub ${swapOut}` : ""}${swapOut > 0 && swapIn > 0 ? " · " : ""}${swapIn > 0 ? `ofertas ${swapIn}` : ""}` || "-"
                        : "En colección";
                const statusLabel = isEdition
                  ? activeEditionCopiesListed > 0
                    ? "venta"
                    : "edición"
                  : listing
                    ? "venta"
                    : auction
                      ? "subasta"
                      : hasSwap
                        ? "intercambio"
                        : "colección";
                const statusChipClass = isEdition
                  ? activeEditionCopiesListed > 0
                    ? "border-emerald-700/70 bg-emerald-300 text-emerald-950"
                    : "border-cyan-700/70 bg-cyan-300 text-cyan-950"
                  : listing
                    ? "border-emerald-700/70 bg-emerald-300 text-emerald-950"
                    : auction
                      ? "border-amber-700/70 bg-amber-300 text-amber-950"
                      : hasSwap
                        ? "border-sky-700/70 bg-sky-300 text-sky-950"
                        : "border-white/20 bg-white/10 text-foreground";

                const cardInner = (
                  <>
                    <div className="relative overflow-hidden bg-white/[0.04]">
                      <div className="aspect-square w-full">
                        {previewImageUrl ? (
                          <img
                            src={previewImageUrl}
                            alt={previewName}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent text-muted-foreground">
                            <div className="flex flex-col items-center gap-2 text-xs">
                              <ImageIcon className="h-8 w-8" />
                              <span>Cargando imagen</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/10 to-transparent" />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {isCommission ? (
                          <span className="rounded-full border border-fuchsia-700/70 bg-fuchsia-300 px-2 py-0.5 text-[11px] font-medium text-fuchsia-950">
                            comision
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                            {isEdition ? "EDITION" : "NFT"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex h-full flex-col gap-2 border-t border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="leading-none text-lg font-semibold text-foreground">{primaryLabel}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusChipClass}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {isEdition ? `Edición #${asset.assetId}` : `#${asset.assetId}`}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{previewName}</p>

                      {auction ? (
                        <p className="text-[11px] text-muted-foreground">
                          Cierra: {new Date(auction.auction.endTime * 1000).toLocaleString()}
                        </p>
                      ) : null}

                      <div className="mt-1 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 text-white">
                          {profile?.avatarUrl ? (
                            <img
                              src={profile.avatarUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <UserRound className="h-4 w-4 text-white/70" />
                          )}
                        </div>
                        <p className="min-w-0 truncate text-sm text-muted-foreground">{displayName}</p>
                      </div>
                    </div>
                  </>
                );

                return (
                  <Link
                    key={`profile-owned-${asset.kind}-${asset.assetId}`}
                    href={asset.href}
                    className="group block h-full overflow-hidden rounded-2xl border border-border bg-white/5 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
              Sin NFTs ni ediciones
            </div>
          )}
        </section>
      </div>

    </main>
  );
}
