import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAuctions } from "@/lib/auction";
import { getArtistProfile, isValidWalletAddress } from "@/lib/artist-profiles-store";
import { fetchListings } from "@/lib/marketplace";
import { fetchOwnedNftsByWallet } from "@/lib/nft-read";
import { fetchSwapBids, fetchSwapListings } from "@/lib/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ wallet: string }>;
};

function walletShort(value: string) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function ArtistCollectionPage({ params }: Params) {
  const { wallet } = await params;
  const normalizedWallet = wallet.trim().toUpperCase();
  if (!isValidWalletAddress(normalizedWallet)) {
    notFound();
  }

  const [profile, ownedNfts, listings, auctions, swapListings, swapBids] = await Promise.all([
    getArtistProfile(normalizedWallet),
    fetchOwnedNftsByWallet(normalizedWallet, { totalCap: 1000 }).catch(() => []),
    fetchListings().catch(() => []),
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

  const outgoingSwapsByOfferedToken = new Map<number, number>();
  const myActiveSwapListings = swapListings.filter(
    (listing) => listing.active && listing.creator === normalizedWallet,
  );
  for (const listing of myActiveSwapListings) {
    outgoingSwapsByOfferedToken.set(
      listing.offeredTokenId,
      (outgoingSwapsByOfferedToken.get(listing.offeredTokenId) || 0) + 1,
    );
  }
  const myListingById = new Map(myActiveSwapListings.map((listing) => [listing.listingId, listing]));
  const incomingSwapBidsByOfferedToken = new Map<number, number>();
  for (const bid of swapBids.filter((bid) => bid.active)) {
    const listing = myListingById.get(bid.listingId);
    if (!listing) continue;
    incomingSwapBidsByOfferedToken.set(
      listing.offeredTokenId,
      (incomingSwapBidsByOfferedToken.get(listing.offeredTokenId) || 0) + 1,
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <section className="rounded-3xl border border-border bg-white/10 p-5 backdrop-blur-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                {profile?.displayName || walletShort(normalizedWallet)} · Collection
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">{normalizedWallet}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/marketplace/artist/${normalizedWallet}`}
                className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
              >
                View artist page
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
              >
                Marketplace
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white/10 p-4 md:p-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">NFTs</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{ownedNfts.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Listings</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{activeListingsByToken.size}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Item auctions</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{activeItemAuctionsByToken.size}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Swaps (outgoing)</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {Array.from(outgoingSwapsByOfferedToken.values()).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownedNfts.map((token) => {
              const listing = activeListingsByToken.get(token.tokenId) ?? null;
              const auction = activeItemAuctionsByToken.get(token.tokenId) ?? null;
              const outgoingSwapCount = outgoingSwapsByOfferedToken.get(token.tokenId) || 0;
              const incomingSwapCount = incomingSwapBidsByOfferedToken.get(token.tokenId) || 0;

              return (
                <article
                  key={`owned-${token.tokenId}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      <Link href={`/marketplace/mochi/${token.tokenId}`} className="hover:underline">
                        #{token.tokenId} · {token.isCommissionEgg ? "Commission Egg" : "Mochi NFT"}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {listing ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-foreground">
                          listed
                        </span>
                      ) : null}
                      {auction ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-foreground">
                          auction
                        </span>
                      ) : null}
                      {outgoingSwapCount > 0 ? (
                        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-foreground">
                          swap listings {outgoingSwapCount}
                        </span>
                      ) : null}
                      {incomingSwapCount > 0 ? (
                        <span className="rounded-full border border-slate-300/20 bg-slate-300/10 px-2 py-0.5 text-foreground">
                          swap bids {incomingSwapCount}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="break-all text-xs text-muted-foreground line-clamp-2">{token.tokenUri}</p>

                  {listing ? (
                    <div className="rounded-xl border border-border bg-white/5 p-3 text-xs text-muted-foreground">
                      Listing #{listing.listingId} · fixed price
                    </div>
                  ) : null}

                  {auction ? (
                    <div className="rounded-xl border border-border bg-white/5 p-3 text-xs text-muted-foreground">
                      Auction #{auction.auctionId} · ends{" "}
                      <span className="text-foreground">
                        {new Date(auction.auction.endTime * 1000).toLocaleString()}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-auto grid gap-2">
                    <Link
                      href={`/marketplace/mochi/${token.tokenId}`}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
                    >
                      Open Mochi page
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {ownedNfts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
              No NFTs found in this wallet collection.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
