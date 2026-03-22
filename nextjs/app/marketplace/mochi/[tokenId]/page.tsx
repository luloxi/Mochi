import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MarketplaceNftDetailActions } from "@/components/marketplace-nft-detail-actions";
import { MarketplaceNftOwnerActions } from "@/components/marketplace-nft-owner-actions";
import { fetchAuctions, fetchRecentBidsForAuction } from "@/lib/auction";
import { getArtistProfilesByWallets } from "@/lib/artist-profiles-store";
import {
  buildIpfsGatewayUrls,
  buildIpfsProxyUrl,
  normalizeKnownAssetUrl,
  resolveIpfsHttpUrl,
} from "@/lib/ipfs";
import type { ArtistProfile } from "@/lib/marketplace-hub-types";
import { fetchListings } from "@/lib/marketplace";
import { fetchNftCreatorById, fetchNftTokenById } from "@/lib/nft-read";
import { fetchSwapListings } from "@/lib/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ tokenId: string }>;
};

type NftAttribute = {
  trait: string;
  value: string;
};

type NftMetadataPreview = {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  attributes: NftAttribute[];
  metadataUrl: string | null;
};

function walletShort(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolveMediaUrl(raw: string | null | undefined): string | null {
  const value = normalizeKnownAssetUrl(raw);
  if (!value) return null;

  const ipfsHttpUrl = resolveIpfsHttpUrl(value);
  if (ipfsHttpUrl) {
    return ipfsHttpUrl;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("/")
  ) {
    return value;
  }
  return value;
}

function isLikelyImageUrl(value: string | null | undefined) {
  if (!value) return false;
  return (
    value.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i.test(value)
  );
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => valueToText(entry)).join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function parseAttributes(raw: unknown): NftAttribute[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const trait =
        typeof record.trait_type === "string"
          ? record.trait_type
          : typeof record.trait === "string"
            ? record.trait
            : typeof record.name === "string"
              ? record.name
              : typeof record.key === "string"
                ? record.key
                : `Attribute ${index + 1}`;
      const rawValue =
        record.value ??
        record.trait_value ??
        record.val ??
        record.display_value ??
        null;
      const value = valueToText(rawValue);
      if (!trait && !value) return null;
      return { trait, value };
    })
    .filter((entry): entry is NftAttribute => Boolean(entry));
}

async function fetchTokenMetadataPreview(tokenUri: string): Promise<NftMetadataPreview> {
  const resolvedTokenUri = resolveMediaUrl(tokenUri);
  if (!resolvedTokenUri) {
    return { name: null, description: null, imageUrl: null, attributes: [], metadataUrl: null };
  }

  if (isLikelyImageUrl(resolvedTokenUri)) {
    return {
      name: null,
      description: null,
      imageUrl: resolvedTokenUri,
      attributes: [],
      metadataUrl: resolvedTokenUri,
    };
  }

  try {
    let data: Record<string, unknown> | null = null;
    for (const candidateUrl of buildIpfsGatewayUrls(tokenUri)) {
      const response = await fetch(candidateUrl, { cache: "force-cache" });
      if (!response.ok) continue;
      data = (await response.json()) as Record<string, unknown>;
      break;
    }
    if (!data) {
      return { name: null, description: null, imageUrl: null, attributes: [], metadataUrl: resolvedTokenUri };
    }
    const imageRaw =
      typeof data.image === "string"
        ? data.image
        : typeof data.image_url === "string"
          ? data.image_url
          : null;

    return {
      name: typeof data.name === "string" ? data.name : null,
      description: typeof data.description === "string" ? data.description : null,
      imageUrl: buildIpfsProxyUrl(imageRaw) || resolveMediaUrl(imageRaw),
      attributes: parseAttributes(data.attributes),
      metadataUrl: buildIpfsProxyUrl(tokenUri) || resolvedTokenUri,
    };
  } catch {
    return {
      name: null,
      description: null,
      imageUrl: null,
      attributes: [],
      metadataUrl: buildIpfsProxyUrl(tokenUri) || resolvedTokenUri,
    };
  }
}

function attributeChipKey(attr: NftAttribute, index: number) {
  return `${attr.trait}:${attr.value}:${index}`;
}

function toStringUnits(value: bigint | null | undefined) {
  if (value === null || value === undefined) return "0";
  return value.toString();
}

export default async function MarketplaceMochiPage({ params }: Params) {
  const requestHeaders = await headers();
  const isSpanish = requestHeaders.get("accept-language")?.toLowerCase().startsWith("es") ?? false;
  const t = (en: string, es: string) => (isSpanish ? es : en);

  const { tokenId } = await params;
  const parsedTokenId = Number.parseInt(tokenId, 10);
  if (!Number.isInteger(parsedTokenId) || parsedTokenId < 0) {
    notFound();
  }

  const token = await fetchNftTokenById(parsedTokenId);
  if (!token) {
    notFound();
  }

  const [allListings, allSwapListings, auctions, metadata, tokenCreator] = await Promise.all([
    fetchListings(),
    fetchSwapListings(),
    fetchAuctions({ includeEnded: false, limit: 300 }).catch(() => []),
    fetchTokenMetadataPreview(token.tokenUri),
    fetchNftCreatorById(parsedTokenId),
  ]);

  const activeListing =
    allListings.find((listing) => listing.active && listing.tokenId === parsedTokenId) ?? null;
  const openSwapListingsOfferingThis = allSwapListings
    .filter((listing) => listing.active && listing.offeredTokenId === parsedTokenId)
    .sort((a, b) => b.listingId - a.listingId);

  const itemAuction =
    auctions.find(
      (snapshot) => snapshot.auction.isItemAuction && snapshot.auction.tokenId === parsedTokenId,
    ) ?? null;
  const displayAuction = itemAuction;

  const recentAuctionBids = displayAuction
    ? await fetchRecentBidsForAuction(displayAuction.auctionId, displayAuction.auction.startTime, 8)
    : [];

  const profilesByWallet: Record<string, ArtistProfile> = await getArtistProfilesByWallets(
    [
      token.owner,
      tokenCreator || "",
      activeListing?.seller || "",
      ...openSwapListingsOfferingThis.map((listing) => listing.creator),
    ].filter(Boolean),
  ).catch(() => ({}));

  const creatorProfile = tokenCreator ? (profilesByWallet[tokenCreator] ?? null) : null;
  const ownerProfile = profilesByWallet[token.owner] ?? null;
  const listingSellerProfile = activeListing ? (profilesByWallet[activeListing.seller] ?? null) : null;

  const displayName =
    metadata.name ||
    `${token.isCommissionEgg ? t("Commission Egg", "Huevo de comisión") : t("Mochi NFT", "NFT Mochi")} #${token.tokenId}`;

  const activeListingActionData = activeListing
    ? {
        listingId: activeListing.listingId,
        sellerWallet: activeListing.seller,
        sellerDisplayName:
          listingSellerProfile?.displayName || walletShort(activeListing.seller),
        price: toStringUnits(activeListing.price),
        currency: activeListing.currency,
        commissionEtaDays: activeListing.commissionEtaDays || 0,
        isCommissionEgg: Boolean(activeListing.isCommissionEgg || token.isCommissionEgg),
        artistTerms: listingSellerProfile
          ? {
              displayName: listingSellerProfile.displayName || walletShort(activeListing.seller),
              acceptingNewClients: listingSellerProfile.acceptingNewClients,
              turnaroundDaysMin: listingSellerProfile.turnaroundDaysMin ?? null,
              turnaroundDaysMax: listingSellerProfile.turnaroundDaysMax ?? null,
              slotsOpen: listingSellerProfile.slotsOpen ?? null,
              slotsTotal: listingSellerProfile.slotsTotal ?? null,
              basePriceAvax: listingSellerProfile.basePriceAvax || "",
              basePriceUsdc: listingSellerProfile.basePriceUsdc || "",
              bio: listingSellerProfile.bio || "",
            }
          : null,
      }
    : null;

  const activeAuctionActionData = displayAuction
    ? {
        auctionId: displayAuction.auctionId,
        startTime: displayAuction.auction.startTime,
        endTime: displayAuction.auction.endTime,
        startingPrice: toStringUnits(displayAuction.auction.startingPrice),
        currency: displayAuction.auction.currency,
        highestBid: displayAuction.highestBid
          ? {
              bidder: displayAuction.highestBid.bidder,
              amount: toStringUnits(displayAuction.highestBid.amount),
              currency: displayAuction.highestBid.currency,
            }
          : null,
        recentBids: recentAuctionBids.map((bid) => ({
          bidder: bid.bidder,
          amount: toStringUnits(bid.amount),
          currency: bid.currency,
        })),
      }
    : null;

  const openSwapListingsActionData = openSwapListingsOfferingThis.map((listing) => ({
    listingId: listing.listingId,
    creatorWallet: listing.creator,
    creatorDisplayName: profilesByWallet[listing.creator]?.displayName || walletShort(listing.creator),
    offeredTokenId: listing.offeredTokenId,
    intention: listing.intention,
  }));

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <section className="rounded-3xl border border-border bg-white/10 p-5 backdrop-blur-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{displayName}</h1>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
            >
              {t("Back to marketplace", "Volver al marketplace")}
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-white/[0.04]">
                <div className="relative aspect-square w-full">
                  {metadata.imageUrl ? (
                    <img
                      src={metadata.imageUrl}
                      alt={displayName}
                      className="h-full w-full object-contain"
                      loading="eager"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent text-muted-foreground">
                      <div className="text-center text-sm">{t("No preview image", "Sin imagen de vista previa")}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white/10 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-white/5 p-3">
                    <p className="text-xs text-muted-foreground">{t("Token ID", "ID del token")}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">#{token.tokenId}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-white/5 p-3">
                    <p className="text-xs text-muted-foreground">{t("Collection", "Colección")}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {token.isCommissionEgg ? t("Commission Egg", "Huevo de comisión") : t("Mochi NFT", "NFT Mochi")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-border bg-white/5 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("Description", "Descripción")}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {metadata.description || t("No description available in metadata.", "No hay descripción disponible en la metadata.")}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">{t("Attributes", "Atributos")}</p>
                    {metadata.attributes.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {metadata.attributes.map((attr, index) => (
                          <div
                            key={attributeChipKey(attr, index)}
                            className="rounded-xl border border-border bg-white/5 px-3 py-2"
                          >
                            <p className="text-[11px] text-muted-foreground">{attr.trait}</p>
                            <p className="text-sm text-foreground">{attr.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-dashed border-border bg-white/5 p-3 text-sm text-muted-foreground">
                        {t("No attributes available in metadata.", "No hay atributos disponibles en la metadata.")}
                      </div>
                    )}
                  </div>

                  {metadata.metadataUrl ? (
                    <a
                      href={metadata.metadataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {t("Open metadata", "Abrir metadata")}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white/10 p-4">
                <h2 className="text-sm font-semibold text-foreground">{t("Creator / Owner", "Creador / Propietario")}</h2>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border bg-white/5 p-3">
                    <p className="mb-2 text-xs text-muted-foreground">{t("Creator (artist)", "Creador (artista)")}</p>
                    {tokenCreator ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-sm text-foreground">
                          {creatorProfile?.avatarUrl ? (
                            <img
                              src={creatorProfile.avatarUrl}
                              alt={creatorProfile.displayName || walletShort(tokenCreator)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span>{(creatorProfile?.displayName || walletShort(tokenCreator)).slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/profile/${tokenCreator}`}
                            className="block cursor-pointer truncate text-sm font-medium text-foreground hover:underline"
                          >
                            {creatorProfile?.displayName || walletShort(tokenCreator)}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{tokenCreator}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("Creator unavailable.", "Creador no disponible.")}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-white/5 p-3">
                    <p className="mb-2 text-xs text-muted-foreground">{t("Current owner", "Propietario actual")}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-sm text-foreground">
                        {ownerProfile?.avatarUrl ? (
                          <img
                            src={ownerProfile.avatarUrl}
                            alt={ownerProfile.displayName || walletShort(token.owner)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span>{(ownerProfile?.displayName || walletShort(token.owner)).slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${token.owner}`}
                          className="block cursor-pointer truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {ownerProfile?.displayName || walletShort(token.owner)}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{token.owner}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <MarketplaceNftOwnerActions
                tokenId={token.tokenId}
                tokenOwner={token.owner}
                isCommissionEgg={token.isCommissionEgg}
                hasActiveListing={Boolean(activeListing)}
                hasActiveAuction={Boolean(itemAuction)}
              />
            </div>
          </div>
        </section>

        <MarketplaceNftDetailActions
          tokenId={token.tokenId}
          activeListing={activeListingActionData}
          activeAuction={activeAuctionActionData}
          openSwapListingsOfferingThis={openSwapListingsActionData}
        />
      </div>
    </main>
  );
}
