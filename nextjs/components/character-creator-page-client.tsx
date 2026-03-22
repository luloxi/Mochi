"use client";

import { useEffect, useState } from "react";
import { MarketplaceHubStudioSellTab } from "@/components/marketplace-hub-studio-sell-tab";
import { useLanguage } from "@/components/language-provider";
import { useWalletSession } from "@/components/wallet-provider";
import { parseMarketplaceAmountToUnits, submitContractWrite } from "@/components/marketplace-hub-shared";
import { buildCreateFinishedNftTx } from "@/lib/nft";
import { buildListForSaleTx } from "@/lib/marketplace";
import { buildCreateItemAuctionTx } from "@/lib/auction";
import type { MarketplaceMyStudioResponse } from "@/lib/marketplace-hub-types";

const EMPTY_STUDIO: MarketplaceMyStudioResponse = {
  wallet: "",
  profile: null,
  ownedNfts: [],
  myListings: [],
  myCommissionOrdersAsArtist: [],
  myCommissionOrdersAsBuyer: [],
  mySwapListings: [],
  incomingSwapBidsForMyListings: [],
  myOutgoingSwapBids: [],
  commissionEggLock: {
    canListNewCommissionEgg: false,
    reason: "Connect a wallet to create commission egg listings.",
    activeCommissionEggListingId: null,
    blockingOrderId: null,
  },
  auctionCapability: {
    itemAuctionsAvailable: true,
    reason: "",
  },
  generatedAt: 0,
};

type CreateMintPackageRequest = Parameters<typeof MarketplaceHubStudioSellTab>[0]["onCreateNftPackage"] extends (
  request: infer T,
) => unknown
  ? T
  : never;

export function CharacterCreatorPageClient({ embedded = false }: { embedded?: boolean }) {
  const { isSpanish } = useLanguage();
  const { publicKey, signTransaction } = useWalletSession();
  const t = (en: string, es: string) => (isSpanish ? es : en);

  const [studio, setStudio] = useState<MarketplaceMyStudioResponse>(EMPTY_STUDIO);
  const [txBusy, setTxBusy] = useState(false);
  const [txMessage, setTxMessage] = useState("");
  const [creatorStage, setCreatorStage] = useState<"build" | "publish">("build");

  async function loadStudio(wallet: string) {
    try {
      const response = await fetch(`/api/marketplace/my-studio?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MarketplaceMyStudioResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load studio");
      }
      setStudio(payload);
      return payload;
    } catch (error) {
      return null;
    }
  }

  useEffect(() => {
    if (!publicKey) {
      setStudio({ ...EMPTY_STUDIO, generatedAt: Date.now() });
      return;
    }
    void loadStudio(publicKey);
  }, [publicKey]);

  async function handleCreateNftPackage(request: CreateMintPackageRequest) {
    if (!publicKey) {
      setTxMessage(t("Connect your wallet to mint.", "Conectá tu wallet para mintear."));
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const mintCopies =
        request.mode === "unique" ? 1 : Math.max(1, Math.min(Number.parseInt(String(request.copies), 10) || 1, 50));
      const previousOwnedTokenIds = new Set((studio.ownedNfts || []).map((item) => item.tokenId));

      for (let index = 0; index < mintCopies; index += 1) {
        const mintTx = await buildCreateFinishedNftTx(publicKey, request.tokenUri);
        await submitContractWrite(mintTx, signTransaction, publicKey);
        setTxMessage(
          t(
            `Minting in progress (${index + 1}/${mintCopies})...`,
            `Minteo en progreso (${index + 1}/${mintCopies})...`,
          ),
        );
      }

      const refreshedStudio = await loadStudio(publicKey);
      if (!refreshedStudio) {
        throw new Error(t("Mint completed but studio refresh failed.", "El mint salió pero falló la actualización del estudio."));
      }

      const mintedTokens = refreshedStudio.ownedNfts
        .filter((item) => item.tokenUri === request.tokenUri && !previousOwnedTokenIds.has(item.tokenId))
        .sort((a, b) => a.tokenId - b.tokenId);

      if (mintedTokens.length === 0) {
        throw new Error(
          t(
            "Mint submitted, but the new NFT tokens were not found yet. Refresh and try listing again.",
            "El mint fue enviado, pero los nuevos tokens todavía no aparecen. Actualizá e intentá publicar otra vez.",
          ),
        );
      }

      if (request.listMode === "fixed_price") {
        const currency = request.listCurrency === "Avax" ? "Avax" : "Usdc";
        const price = parseMarketplaceAmountToUnits(request.listPrice || "", currency);
        for (const token of mintedTokens) {
          const listTx = await buildListForSaleTx(publicKey, token.tokenId, price, currency);
          await submitContractWrite(listTx, signTransaction, publicKey);
        }
      } else if (request.listMode === "auction") {
        const currency = request.auctionCurrency === "Avax" ? "Avax" : "Usdc";
        const price = parseMarketplaceAmountToUnits(request.auctionPrice || "", currency);
        const durationHours = Math.max(1, Number.parseInt(request.auctionDurationHours || "24", 10) || 24);
        for (const token of mintedTokens) {
          const auctionTx = await buildCreateItemAuctionTx(publicKey, token.tokenId, price, currency, durationHours * 3600);
          await submitContractWrite(auctionTx, signTransaction, publicKey);
        }
      }

      setTxMessage(
        request.listMode === "fixed_price"
          ? t("NFT minted and listed successfully.", "NFT minteado y publicado correctamente.")
          : request.listMode === "auction"
            ? t("NFT minted and sent to auction successfully.", "NFT minteado y enviado a subasta correctamente.")
            : t("NFT minted successfully.", "NFT minteado correctamente."),
      );
      setCreatorStage("build");
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to mint NFT.");
    } finally {
      setTxBusy(false);
    }
  }

  return (
    <>
      <section className={`mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 ${embedded ? "pt-0" : "pt-6 md:pt-8"} md:px-6 lg:px-8`}>
        <MarketplaceHubStudioSellTab
          t={t}
          studio={studio}
          tokenPreviews={{}}
          txBusy={txBusy}
          publicKey={publicKey}
          showCreatePanel
          showTradePanel={false}
          creatorStage={creatorStage}
          onOpenPublishStage={() => setCreatorStage("publish")}
          onBackToCreatorStage={() => setCreatorStage("build")}
          onCreateListing={async () => {}}
          onCreateAuction={async () => {}}
          onCreateNftPackage={(request) => void handleCreateNftPackage(request)}
          onCancelListing={async () => {}}
          onCreateSwapOffer={async () => {}}
          onAcceptSwapBid={async () => {}}
          onCancelSwapListing={async () => {}}
          onCancelSwapBid={async () => {}}
        />
      </section>

      {txMessage ? (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,720px)] -translate-x-1/2 rounded-xl border border-border bg-black/80 p-3 text-sm text-foreground shadow-2xl backdrop-blur">
          {txMessage}
        </div>
      ) : null}
    </>
  );
}
