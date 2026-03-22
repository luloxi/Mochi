"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MarketplaceHubMarketplaceTab } from "@/components/marketplace-hub-marketplace-tab";
import { MarketplaceHubStudioSellTab } from "@/components/marketplace-hub-studio-sell-tab";
import { MarketplaceHubStudioCommissionsTab } from "@/components/marketplace-hub-studio-commissions-tab";
import {
  type FeedAssetFilter,
  type FeedSaleFilter,
  type FeedSort,
  type ProfileDraft,
  type TokenPreview,
  buildClientMediaProxyUrl,
  buildProfileDraft,
  formatMarketplaceTokenAmount,
  isLikelyImageUrl,
  parseMarketplaceAmountToUnits,
  resolveMediaUrl,
  submitContractWrite,
} from "@/components/marketplace-hub-shared";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/components/wallet-provider";
import { useLanguage } from "@/components/language-provider";
import {
  buildApproveCommissionDeliveryTx,
  buildCancelListingTx,
  buildClaimCommissionTimeoutTx,
  buildListCommissionEggTx,
  buildListForSaleTx,
  buildMarkCommissionDeliveredTx,
  buildRequestCommissionRevisionTx,
  buildRefundCommissionOrderTx,
} from "@/lib/marketplace";
import { buildBidUsdcTx, buildBidAvaxTx, buildCreateItemAuctionTx } from "@/lib/auction";
import { buildCreateCommissionEggTx, buildCreateFinishedNftTx, buildUpdateTokenUriAsCreatorTx } from "@/lib/nft";
import {
  buildAcceptSwapBidTx,
  buildCancelSwapBidTx,
  buildCancelSwapListingTx,
  buildCreateSwapListingTx,
} from "@/lib/swap";
import type {
  MarketplaceFeedResponse,
  MarketplaceMyStudioResponse,
  MyStudioCommissionOrderItem,
} from "@/lib/marketplace-hub-types";
import {
  ArrowLeftRight,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Tag,
} from "lucide-react";

type MarketplaceHubMode = "all" | "marketplace" | "settings" | "creator";

type MarketplaceHubProps = {
  mode?: MarketplaceHubMode;
  variant?: "page" | "window";
};

export function MarketplaceHub({ mode = "all", variant = "page" }: MarketplaceHubProps) {
  const { isSpanish } = useLanguage();
  const { publicKey, isConnected, signTransaction } = useWalletSession();
  const t = (en: string, es: string) => (isSpanish ? es : en);
  const [marketplaceSellTab, setMarketplaceSellTab] = useState<"explore" | "selling" | "creators">("explore");
  const [creatorsStudioTab, setCreatorsStudioTab] = useState<"create" | "commissions">("create");

  const [feedAssetFilter, setFeedAssetFilter] = useState<FeedAssetFilter>("all");
  const [feedSaleFilter, setFeedSaleFilter] = useState<FeedSaleFilter>("all");
  const [feedSort, setFeedSort] = useState<FeedSort>("ending_soon");
  const [feedSearch, setFeedSearch] = useState("");
  const [feed, setFeed] = useState<MarketplaceFeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [tokenPreviews, setTokenPreviews] = useState<Record<string, TokenPreview>>({});
  const tokenPreviewInflightRef = useRef<Set<string>>(new Set());

  const [studio, setStudio] = useState<MarketplaceMyStudioResponse | null>(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState("");

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(buildProfileDraft(null));

  const [auctionBidCurrency, setAuctionBidCurrency] = useState<"AVAX" | "USDC">("USDC");
  const [auctionBidAmount, setAuctionBidAmount] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [txMessage, setTxMessage] = useState("");
  const localCreatorStudio: MarketplaceMyStudioResponse = {
    wallet: publicKey || "",
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
      reason: t("Connect a wallet to create commission egg listings.", "Conecta una wallet para crear publicaciones de huevos de comisión."),
      activeCommissionEggListingId: null,
      blockingOrderId: null,
    },
    auctionCapability: {
      itemAuctionsAvailable: true,
      reason: "",
    },
    generatedAt: Date.now(),
  };

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError("");
    try {
      const params = new URLSearchParams();
      params.set("assetKind", feedAssetFilter);
      params.set("saleKind", feedSaleFilter);
      params.set("sort", feedSort);
      if (feedSearch.trim()) params.set("search", feedSearch.trim());
      const response = await fetch(`/api/marketplace/feed?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MarketplaceFeedResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load feed");
      }
      setFeed(payload);
      setTokenPreviews((prev) => {
        const next = { ...prev };
        for (const item of payload.items || []) {
          if (!item.tokenUri) continue;
          const imageUrl = item.imageUrl ?? null;
          const name = item.tokenName ?? null;
          if (!imageUrl && !name) continue;
          next[item.tokenUri] = {
            imageUrl,
            name,
          };
        }
        return next;
      });
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Failed to load marketplace feed.");
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadStudio(wallet: string): Promise<MarketplaceMyStudioResponse | null> {
    setStudioLoading(true);
    setStudioError("");
    try {
      const response = await fetch(`/api/marketplace/my-studio?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MarketplaceMyStudioResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load studio");
      }
      setStudio(payload);
      setProfileDraft(buildProfileDraft(payload.profile));
      return payload;
    } catch (error) {
      setStudio(null);
      setStudioError(error instanceof Error ? error.message : "Failed to load studio data.");
      return null;
    } finally {
      setStudioLoading(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, [feedAssetFilter, feedSaleFilter, feedSort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFeed();
    }, 300);
    return () => clearTimeout(timer);
  }, [feedSearch]);

  useEffect(() => {
    if (!publicKey) {
      setStudio(null);
      setStudioError("");
      setProfileDraft(buildProfileDraft(null));
      return;
    }

    void loadStudio(publicKey);
  }, [publicKey]);

  const liveAuctionItem =
    feed?.items.find((item) => item.saleKind === "auction" && item.status === "active") ||
    feed?.items.find((item) => item.saleKind === "auction") ||
    null;
  const marketplaceGridItems = feed?.items || [];
  const isMarketplaceOnlyMode = mode === "marketplace";
  const isSettingsOnlyMode = mode === "settings";
  const isCreatorOnlyMode = mode === "creator";
  const isWindowVariant = variant === "window";
  const topPaddingClass = isWindowVariant ? "pt-1" : "pt-0";

  useEffect(() => {
    const tokenUris = Array.from(
      new Set<string>(
        [
          ...(feed?.items || []).map((item) => item.tokenUri),
          ...(studio?.ownedNfts || []).map((item) => item.tokenUri),
          ...(studio?.myListings || []).map((item) => item.tokenUri),
        ].filter((uri): uri is string => typeof uri === "string" && uri.length > 0),
      ),
    );
    if (tokenUris.length === 0) return;

    let cancelled = false;
    for (const tokenUri of tokenUris) {
      const existingPreview = tokenPreviews[tokenUri];
      if ((existingPreview?.imageUrl || existingPreview?.name) || tokenPreviewInflightRef.current.has(tokenUri)) {
        continue;
      }
      tokenPreviewInflightRef.current.add(tokenUri);
      void (async () => {
        let nextPreview: TokenPreview = { imageUrl: null, name: null };
        try {
          const resolvedTokenUri = resolveMediaUrl(tokenUri);
          if (resolvedTokenUri && isLikelyImageUrl(resolvedTokenUri)) {
            nextPreview = { imageUrl: buildClientMediaProxyUrl(tokenUri), name: null };
          } else if (resolvedTokenUri) {
            const fetchUrl = tokenUri.startsWith("ipfs://")
              ? `/api/ipfs?uri=${encodeURIComponent(tokenUri)}`
              : resolvedTokenUri;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            let response: Response | null = null;
            try {
              response = await fetch(fetchUrl, { cache: "force-cache", signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            if (response?.ok) {
              const data = (await response.json()) as { image?: unknown; image_url?: unknown; name?: unknown };
              const imageRaw =
                typeof data.image === "string"
                  ? data.image
                  : typeof data.image_url === "string"
                    ? data.image_url
                    : null;
              nextPreview = {
                imageUrl: buildClientMediaProxyUrl(imageRaw),
                name: typeof data.name === "string" ? data.name : null,
              };
            }
          }
        } catch {
          nextPreview = { imageUrl: null, name: null };
        } finally {
          tokenPreviewInflightRef.current.delete(tokenUri);
          if (!cancelled && (nextPreview.imageUrl || nextPreview.name)) {
            setTokenPreviews((prev) =>
              prev[tokenUri] ? prev : { ...prev, [tokenUri]: nextPreview },
            );
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [feed, studio, tokenPreviews]);

  useEffect(() => {
    if (!liveAuctionItem) return;
    const suggested =
      auctionBidCurrency === "AVAX"
        ? formatMarketplaceTokenAmount(liveAuctionItem.price, "AVAX")
        : formatMarketplaceTokenAmount(liveAuctionItem.price, "USDC");
    if (!auctionBidAmount) {
      setAuctionBidAmount(suggested === "-" ? "" : suggested);
    }
  }, [auctionBidAmount, auctionBidCurrency, liveAuctionItem]);

  async function handleCreateListing(tokenId: number, priceRaw: string, currency: "Avax" | "Usdc") {
    if (!publicKey) {
      setTxMessage(t("Connect a wallet to list items.", "Conecta una wallet para publicar."));
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const price = parseMarketplaceAmountToUnits(priceRaw, currency);
      if (price <= BigInt(0)) {
        throw new Error(t("Enter a valid price.", "Ingresá un precio válido."));
      }

      const selectedToken = studio?.ownedNfts.find((item) => item.tokenId === tokenId);
      if (!selectedToken) {
        throw new Error(t("Select one of your NFTs first.", "Selecciona uno de tus NFTs primero."));
      }

      if (selectedToken.isCommissionEgg) {
        if (!(studio?.profile?.artistEnabled && studio.profile.commissionEnabled)) {
          throw new Error(
            t(
              "Enable artist profile + commissions before listing commission eggs.",
              "Activa perfil de artista + comisiones antes de publicar huevos de comision.",
            ),
          );
        }
        if (studio && !studio.commissionEggLock.canListNewCommissionEgg) {
          throw new Error(
            studio.commissionEggLock.reason ||
              t(
                "You must complete or refund your current commission order before listing another commission egg.",
                "Debes completar o reembolsar tu orden de comision actual antes de listar otro huevo de comision.",
              ),
          );
        }
      }

      const txXdr = selectedToken.isCommissionEgg
        ? await buildListCommissionEggTx(publicKey, tokenId, price, currency, 7)
        : await buildListForSaleTx(publicKey, tokenId, price, currency);

      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(
        t("Listing submitted. Refreshing marketplace...", "Publicacion enviada. Actualizando marketplace..."),
      );
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to create listing.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleCreateItemAuction(tokenId: number, priceRaw: string, currency: "Avax" | "Usdc", durationHoursRaw: string) {
    if (!publicKey) {
      setTxMessage(
        t(
          "Connect a wallet to create an auction.",
          "Conecta una wallet para crear una subasta.",
        ),
      );
      return;
    }

    const selectedToken = studio?.ownedNfts.find((item) => item.tokenId === tokenId);
    if (!selectedToken) {
      setTxMessage(t("Select one of your NFTs first.", "Selecciona uno de tus NFTs primero."));
      return;
    }
    if (selectedToken.isCommissionEgg) {
      setTxMessage(
        t(
          "Commission eggs should use fixed-price + escrow for now.",
          "Por ahora los huevos de comision deben usar precio fijo + escrow.",
        ),
      );
      return;
    }
    if ((studio?.myListings || []).some((listing) => listing.active && listing.tokenId === tokenId)) {
      setTxMessage(
        t(
          "Cancel the active fixed-price listing for this NFT before creating an item auction.",
          "Cancela la publicacion a precio fijo activa de este NFT antes de crear una subasta.",
        ),
      );
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const price = parseMarketplaceAmountToUnits(priceRaw, currency);
      if (price <= BigInt(0)) {
        throw new Error(t("Set a valid starting price.", "Define un precio inicial válido."));
      }
      const durationHours = Math.max(1, Number.parseInt(durationHoursRaw || "24", 10) || 24);
      const txXdr = await buildCreateItemAuctionTx(
        publicKey,
        tokenId,
        price,
        currency,
        durationHours * 3600,
      );

      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Item auction created.", "Subasta por item creada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to create item auction.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleCreateNftPackage(request: {
    tokenUri: string;
    mode: "unique" | "edition";
    copies: number;
    listMode: "none" | "fixed_price" | "auction";
    listPrice?: string;
    listCurrency?: "Avax" | "Usdc";
    auctionPrice?: string;
    auctionCurrency?: "Avax" | "Usdc";
    auctionDurationHours?: string;
  }) {
    if (!publicKey) {
      setTxMessage(
        t(
          "Connect a wallet to mint NFTs.",
          "Conecta una wallet para mintear NFTs.",
        ),
      );
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const mintCopies = request.mode === "unique"
        ? 1
        : Math.max(1, Math.min(Number.parseInt(String(request.copies), 10) || 1, 50));

      const previousOwnedTokenIds = new Set((studio?.ownedNfts || []).map((item) => item.tokenId));

      for (let index = 0; index < mintCopies; index += 1) {
        const mintTxXdr = await buildCreateFinishedNftTx(publicKey, request.tokenUri);
        await submitContractWrite(mintTxXdr, signTransaction, publicKey);
        setTxMessage(
          t(
            `Minting in progress (${index + 1}/${mintCopies})...`,
            `Minteo en progreso (${index + 1}/${mintCopies})...`,
          ),
        );
      }

      const refreshedStudio = await loadStudio(publicKey);
      if (!refreshedStudio) {
        throw new Error(t("Minted NFTs, but failed to refresh studio data.", "Se mintearon NFTs, pero falló la actualización del estudio."));
      }

      const mintedTokens = refreshedStudio.ownedNfts
        .filter((item) => item.tokenUri === request.tokenUri && !previousOwnedTokenIds.has(item.tokenId))
        .sort((a, b) => a.tokenId - b.tokenId);

      if (mintedTokens.length === 0) {
        throw new Error(
          t(
            "Mint submitted, but the new NFT tokens were not found yet. Refresh and try listing again.",
            "Minteo enviado, pero los nuevos tokens aún no aparecen. Actualiza e intenta listar otra vez.",
          ),
        );
      }

      if (request.listMode === "fixed_price") {
        const currency = request.listCurrency === "Avax" ? "Avax" : "Usdc";
        const price = parseMarketplaceAmountToUnits(request.listPrice || "", currency);
        if (price <= BigInt(0)) {
          throw new Error(t("Enter a valid fixed listing price.", "Ingresá un precio fijo válido."));
        }
        for (const token of mintedTokens) {
          const listTxXdr = await buildListForSaleTx(publicKey, token.tokenId, price, currency);
          await submitContractWrite(listTxXdr, signTransaction, publicKey);
        }
      } else if (request.listMode === "auction") {
        if (!refreshedStudio.auctionCapability.itemAuctionsAvailable) {
          throw new Error(
            refreshedStudio.auctionCapability.reason ||
              t("Auctions are not currently available.", "Subastas no disponibles por ahora."),
          );
        }
        const currency = request.auctionCurrency === "Avax" ? "Avax" : "Usdc";
        const price = parseMarketplaceAmountToUnits(request.auctionPrice || "", currency);
        if (price <= BigInt(0)) {
          throw new Error(t("Set a valid starting price.", "Define un precio inicial válido."));
        }
        const durationHours = Math.max(1, Number.parseInt(request.auctionDurationHours || "24", 10) || 24);

        for (const token of mintedTokens) {
          const auctionTxXdr = await buildCreateItemAuctionTx(
            publicKey,
            token.tokenId,
            price,
            currency,
            durationHours * 3600,
          );
          await submitContractWrite(auctionTxXdr, signTransaction, publicKey);
        }
      }

      await Promise.all([loadFeed(), loadStudio(publicKey)]);
      setTxMessage(
        request.listMode === "fixed_price"
          ? t(
              `NFT created. Minted ${mintedTokens.length} token(s) and listed them for sale.`,
              `NFT creado. Se mintearon ${mintedTokens.length} token(s) y se publicaron en venta.`,
            )
          : request.listMode === "auction"
            ? t(
                `NFT created. Minted ${mintedTokens.length} token(s) and started auction(s).`,
                `NFT creado. Se mintearon ${mintedTokens.length} token(s) y se iniciaron subastas.`,
              )
            : t(
                `NFT created successfully. Minted ${mintedTokens.length} token(s).`,
                `NFT creado correctamente. Se mintearon ${mintedTokens.length} token(s).`,
              ),
      );
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to create NFT package.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleCancelListing(listingId: number) {
    if (!publicKey) return;
    setTxBusy(true);
    setTxMessage("");
    try {
      const txXdr = await buildCancelListingTx(publicKey, listingId);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Listing cancelled.", "Publicacion cancelada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to cancel listing.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleAuctionBid() {
    if (!publicKey) {
      setTxMessage(t("Connect your wallet first.", "Conecta tu wallet primero."));
      return;
    }
    if (liveAuctionItem?.auction?.auctionId === null || liveAuctionItem?.auction?.auctionId === undefined) {
      setTxMessage(t("No live auction available right now.", "No hay subasta activa disponible ahora."));
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const amount = parseMarketplaceAmountToUnits(auctionBidAmount, auctionBidCurrency);
      if (amount <= BigInt(0)) {
        throw new Error(t("Enter a valid bid amount.", "Ingresa una oferta valida."));
      }
      const txXdr =
        auctionBidCurrency === "AVAX"
          ? await buildBidAvaxTx(publicKey, liveAuctionItem.auction.auctionId, amount)
          : await buildBidUsdcTx(publicKey, liveAuctionItem.auction.auctionId, amount);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Bid submitted.", "Oferta enviada."));
      await loadFeed();
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to place bid.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleCreateSwapOffer(tokenId: number, intention: string) {
    if (!publicKey) {
      setTxMessage(t("Connect your wallet first.", "Conecta tu wallet primero."));
      return;
    }
    setTxBusy(true);
    setTxMessage("");
    try {
      if (!intention.trim()) {
        throw new Error(t("Add a short swap message.", "Agrega un mensaje corto para el intercambio."));
      }
      const txXdr = await buildCreateSwapListingTx(publicKey, tokenId, intention.trim());
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Swap listing published.", "Oferta de intercambio publicada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to create swap listing.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleAcceptSwapBid(listingId: number, bidId: number) {
    if (!publicKey) return;
    setTxMessage("");
    try {
      const txXdr = await buildAcceptSwapBidTx(publicKey, listingId, bidId);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Swap bid accepted.", "Propuesta de intercambio aceptada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to accept swap bid.");
    }
  }

  async function handleCancelSwapListing(listingId: number) {
    if (!publicKey) return;
    setTxMessage("");
    try {
      const txXdr = await buildCancelSwapListingTx(publicKey, listingId);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Swap listing cancelled.", "Oferta de intercambio cancelada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to cancel swap listing.");
    }
  }

  async function handleCancelSwapBid(bidId: number) {
    if (!publicKey) return;
    setTxMessage("");
    try {
      const txXdr = await buildCancelSwapBidTx(publicKey, bidId);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Swap bid cancelled.", "Propuesta de intercambio cancelada."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to cancel swap bid.");
    }
  }

  async function handleCommissionOrderAction(
    order: MyStudioCommissionOrderItem,
    action: "deliver" | "approve" | "refund" | "claim_timeout",
    metadataUri?: string,
  ) {
    if (!publicKey) return;
    if (action === "deliver" && !metadataUri?.trim()) {
      setTxMessage(
        t(
          "Add the final metadata URI before marking delivery.",
          "Agregá la URI final de metadata antes de marcar la entrega.",
        ),
      );
      return;
    }
    setTxMessage("");
    try {
      let txXdr: string;
      if (action === "deliver" && metadataUri) {
        const updateMetadataTx = await buildUpdateTokenUriAsCreatorTx(publicKey, order.tokenId, metadataUri.trim());
        await submitContractWrite(updateMetadataTx, signTransaction, publicKey);
        txXdr = await buildMarkCommissionDeliveredTx(publicKey, order.orderId);
      } else if (action === "approve") {
        txXdr = await buildApproveCommissionDeliveryTx(publicKey, order.orderId);
      } else if (action === "claim_timeout") {
        txXdr = await buildClaimCommissionTimeoutTx(publicKey, order.orderId);
      } else {
        txXdr = await buildRefundCommissionOrderTx(publicKey, order.orderId);
      }
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(
        action === "deliver"
          ? t("Metadata updated and commission marked as delivered.", "Metadata actualizada y comisión marcada como entregada.")
          : action === "approve"
            ? t("Delivery approved and remaining escrow released.", "Entrega aprobada y escrow restante liberado.")
            : action === "claim_timeout"
              ? t("7-day timeout claimed. Remaining escrow released.", "Timeout de 7 días reclamado. Escrow restante liberado.")
              : t("Commission refunded (remaining escrow returned).", "Comisión reembolsada (se devolvió el escrow restante)."),
      );
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to update commission order.");
    }
  }

  async function handleCommissionRevisionRequest(
    order: MyStudioCommissionOrderItem,
    intention: string,
    reference: string,
  ) {
    if (!publicKey) return;
    if (!intention.trim()) {
      setTxMessage(t("Add a change request first.", "Agregá una solicitud de cambio primero."));
      return;
    }
    setTxMessage("");
    try {
      const txXdr = await buildRequestCommissionRevisionTx(publicKey, order.orderId, intention, reference);
      await submitContractWrite(txXdr, signTransaction, publicKey);
      setTxMessage(t("Change request sent to the artist.", "Solicitud de cambio enviada al artista."));
      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to request commission changes.");
    }
  }

  async function handleCreateCommissionEgg(uri: string, priceRaw: string, currency: "Avax" | "Usdc", etaDaysRaw: string) {
    if (!publicKey) {
      setTxMessage(t("Connect a wallet first.", "Conecta una wallet primero."));
      return;
    }

    setTxBusy(true);
    setTxMessage("");
    try {
      const price = parseMarketplaceAmountToUnits(priceRaw, currency);
      if (price <= BigInt(0)) {
        throw new Error(t("Enter a valid price.", "Ingresá un precio válido."));
      }
      const etaDays = Math.max(1, Number.parseInt(etaDaysRaw || "7", 10) || 7);

      if (uri.startsWith("existing:")) {
        // List an existing egg by token ID
        const tokenId = Number.parseInt(uri.replace("existing:", ""), 10);
        if (!Number.isFinite(tokenId)) {
          throw new Error(t("Select a commission egg first.", "Seleccioná un huevo de comisión primero."));
        }
        if (!(studio?.profile?.artistEnabled && studio.profile.commissionEnabled)) {
          throw new Error(
            t(
              "Enable artist profile + commissions before listing commission eggs.",
              "Activa perfil de artista + comisiones antes de publicar huevos de comision.",
            ),
          );
        }
        const txXdr = await buildListCommissionEggTx(publicKey, tokenId, price, currency, etaDays);
        await submitContractWrite(txXdr, signTransaction, publicKey);
        setTxMessage(t("Commission egg listed.", "Huevo de comisión publicado."));
      } else {
        // Mint new egg then list it
        const mintXdr = await buildCreateCommissionEggTx(publicKey, uri);
        await submitContractWrite(mintXdr, signTransaction, publicKey);
        setTxMessage(t("Egg minted, loading studio...", "Huevo minteado, cargando estudio..."));

        const updatedStudio = await loadStudio(publicKey);
        const newToken = updatedStudio?.ownedNfts
          .filter((tok) => tok.isCommissionEgg)
          .sort((a, b) => b.tokenId - a.tokenId)[0];
        if (!newToken) {
          throw new Error(t("Commission egg not found after minting.", "Huevo de comisión no encontrado luego del minteo."));
        }

        const listXdr = await buildListCommissionEggTx(publicKey, newToken.tokenId, price, currency, etaDays);
        await submitContractWrite(listXdr, signTransaction, publicKey);
        setTxMessage(t("Commission egg created and listed.", "Huevo de comisión creado y publicado."));
      }

      await Promise.all([loadFeed(), loadStudio(publicKey)]);
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to create commission egg.");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleReport(targetType: "artist_profile" | "listing", targetId: string) {
    const reason = window.prompt(
      t("Report reason (short):", "Motivo del reporte (corto):"),
      "",
    );
    if (!reason) return;
    const details =
      window.prompt(
        t("More details (optional):", "Mas detalles (opcional):"),
        "",
      ) || "";

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reporterWallet: publicKey || undefined,
          reason,
          details,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to create report.");
      setTxMessage(t("Report submitted.", "Reporte enviado."));
      if (publicKey) {
        await Promise.all([loadFeed(), loadStudio(publicKey)]);
      } else {
        await loadFeed();
      }
    } catch (error) {
      setTxMessage(error instanceof Error ? error.message : "Failed to submit report.");
    }
  }

  return (
    <div
      className={`site-window-skin mx-auto flex w-full ${isWindowVariant ? "max-w-none" : "max-w-7xl"} flex-col gap-4 px-4 pb-6 ${
        isSettingsOnlyMode || isCreatorOnlyMode ? "pt-4" : topPaddingClass
      } md:px-6 lg:px-8`}
    >
      {!isSettingsOnlyMode ? (
        <>
          {/* Tab strip — only in marketplace mode */}
          {isMarketplaceOnlyMode ? (
            <div
              className={`site-window-toolbar top-0 z-20 backdrop-blur-xl ${
                isWindowVariant ? "sticky -mx-4 -mt-1 mb-2 px-4 py-2 md:-mx-6 md:px-6 lg:px-8" : "sticky left-0 right-0 mb-3 px-4 py-2 md:px-6 lg:px-8"
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMarketplaceSellTab("explore")}
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      marketplaceSellTab === "explore"
                        ? "border-emerald-300/55 bg-emerald-400/18 text-foreground shadow-[4px_4px_0_rgba(52,211,153,0.12)]"
                        : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {t("Explore / Shop", "Explorar / Comprar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketplaceSellTab("selling")}
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      marketplaceSellTab === "selling"
                        ? "border-blue-300/55 bg-blue-400/18 text-foreground shadow-[4px_4px_0_rgba(96,165,250,0.12)]"
                        : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {t("Selling", "Vender")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketplaceSellTab("creators")}
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      marketplaceSellTab === "creators"
                        ? "border-fuchsia-300/55 bg-fuchsia-400/18 text-foreground shadow-[4px_4px_0_rgba(217,70,239,0.12)]"
                        : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {t("Creators", "Creadores")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Browse tab */}
          {(!isMarketplaceOnlyMode && !isCreatorOnlyMode) || marketplaceSellTab === "explore" ? (
            <MarketplaceHubMarketplaceTab
              t={t}
              feedSearch={feedSearch}
              onFeedSearchChange={setFeedSearch}
              feedAssetFilter={feedAssetFilter}
              onFeedAssetFilterChange={setFeedAssetFilter}
              feedSaleFilter={feedSaleFilter}
              onFeedSaleFilterChange={setFeedSaleFilter}
              feedSort={feedSort}
              onFeedSortChange={setFeedSort}
              feedError={feedError}
              feedWarnings={feed?.warnings || []}
              feedLoading={feedLoading}
              marketplaceGridItems={marketplaceGridItems}
              liveAuctionItem={liveAuctionItem}
              tokenPreviews={tokenPreviews}
              auctionBidCurrency={auctionBidCurrency}
              onAuctionBidCurrencyChange={setAuctionBidCurrency}
              auctionBidAmount={auctionBidAmount}
              onAuctionBidAmountChange={setAuctionBidAmount}
              onAuctionBid={handleAuctionBid}
              txBusy={txBusy}
              publicKey={publicKey}
            />
          ) : null}

          {/* Sell / Swap tab */}
          {isMarketplaceOnlyMode && marketplaceSellTab === "selling" ? (
            <section className="site-window-surface config-contrast-panel rounded-3xl border border-border bg-white/10 p-4 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                  <Tag className="h-5 w-5 text-blue-300" />
                  {t("Sell / Auction / Swap", "Vender / Subastar / Swap")}
                </h2>
                {publicKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-white/5 text-foreground hover:bg-white/10"
                    onClick={() => void loadStudio(publicKey)}
                    disabled={studioLoading}
                  >
                    {studioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {t("Refresh", "Actualizar")}
                  </Button>
                ) : null}
              </div>
              {!isConnected || !publicKey ? (
                <div className="rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <p>{t("Connect an EVM wallet to list your NFTs.", "Conecta una wallet EVM para publicar tus NFTs.")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Connect from the landing header to publish.", "Conecta desde el header del landing para publicar.")}
                    </p>
                  </div>
                </div>
              ) : studioLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : studio ? (
                <MarketplaceHubStudioSellTab
                  t={t}
                  studio={studio}
                  tokenPreviews={tokenPreviews}
                  txBusy={txBusy}
                  publicKey={publicKey}
                  showCreatePanel={false}
                  showTradePanel
                  onCreateListing={(tokenId, price, currency) => void handleCreateListing(tokenId, price, currency)}
                  onCreateAuction={(tokenId, price, currency, durationHours) =>
                    void handleCreateItemAuction(tokenId, price, currency, durationHours)
                  }
                  onCreateNftPackage={(request) => void handleCreateNftPackage(request)}
                  onCancelListing={(listingId) => void handleCancelListing(listingId)}
                  onCreateSwapOffer={(tokenId, intention) => void handleCreateSwapOffer(tokenId, intention)}
                  onAcceptSwapBid={(listingId, bidId) => handleAcceptSwapBid(listingId, bidId)}
                  onCancelSwapListing={(listingId) => handleCancelSwapListing(listingId)}
                  onCancelSwapBid={(bidId) => handleCancelSwapBid(bidId)}
                />
              ) : studioError ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-foreground">
                  {studioError}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Creators tab */}
          {(isMarketplaceOnlyMode && marketplaceSellTab === "creators") || isCreatorOnlyMode ? (
            <section className="site-window-surface config-contrast-panel rounded-3xl border border-border bg-white/10 p-4 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                  <ArrowLeftRight className="h-5 w-5 text-fuchsia-300" />
                  {isCreatorOnlyMode ? t("Character Creator Studio", "Estudio creador de personajes") : t("Creators Studio", "Estudio de Creadores")}
                </h2>
                {publicKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-white/5 text-foreground hover:bg-white/10"
                    onClick={() => void loadStudio(publicKey)}
                    disabled={studioLoading}
                  >
                    {studioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {t("Refresh", "Actualizar")}
                  </Button>
                ) : null}
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setCreatorsStudioTab("create")}
                  className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    creatorsStudioTab === "create"
                      ? "border-blue-300/55 bg-blue-400/18 text-foreground shadow-[4px_4px_0_rgba(96,165,250,0.12)]"
                      : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {t("Create", "Crear")}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatorsStudioTab("commissions")}
                  className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    creatorsStudioTab === "commissions"
                      ? "border-fuchsia-300/55 bg-fuchsia-400/18 text-foreground shadow-[4px_4px_0_rgba(217,70,239,0.12)]"
                      : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  {t("Commissions", "Comisiones")}
                </button>
              </div>
              {!isConnected || !publicKey ? (
                creatorsStudioTab === "create" ? (
                  <MarketplaceHubStudioSellTab
                    t={t}
                    studio={localCreatorStudio}
                    tokenPreviews={tokenPreviews}
                    txBusy={txBusy}
                    publicKey={publicKey}
                    showCreatePanel
                    showTradePanel={false}
                    onCreateListing={(tokenId, price, currency) => void handleCreateListing(tokenId, price, currency)}
                    onCreateAuction={(tokenId, priceAvax, priceUsdc, durationHours) =>
                      void handleCreateItemAuction(tokenId, priceAvax, priceUsdc, durationHours)
                    }
                    onCreateNftPackage={(request) => void handleCreateNftPackage(request)}
                    onCancelListing={(listingId) => void handleCancelListing(listingId)}
                    onCreateSwapOffer={(tokenId, intention) => void handleCreateSwapOffer(tokenId, intention)}
                    onAcceptSwapBid={(listingId, bidId) => handleAcceptSwapBid(listingId, bidId)}
                    onCancelSwapListing={(listingId) => handleCancelSwapListing(listingId)}
                    onCancelSwapBid={(bidId) => handleCancelSwapBid(bidId)}
                  />
                ) : (
                <div className="rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <p>
                      {t(
                        "Connect an EVM wallet to create NFTs and manage commissions.",
                        "Conecta una wallet EVM para crear NFTs y gestionar comisiones.",
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "Connect from the landing header to create NFTs and manage commissions.",
                        "Conecta desde el header del landing para crear NFTs y gestionar comisiones.",
                      )}
                    </p>
                  </div>
                </div>
                )
              ) : studioLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : studio ? (
                creatorsStudioTab === "create" ? (
                  <MarketplaceHubStudioSellTab
                    t={t}
                    studio={studio}
                    tokenPreviews={tokenPreviews}
                    txBusy={txBusy}
                    publicKey={publicKey}
                    showCreatePanel
                    showTradePanel={false}
                    onCreateListing={(tokenId, price, currency) => void handleCreateListing(tokenId, price, currency)}
                    onCreateAuction={(tokenId, priceAvax, priceUsdc, durationHours) =>
                      void handleCreateItemAuction(tokenId, priceAvax, priceUsdc, durationHours)
                    }
                    onCreateNftPackage={(request) => void handleCreateNftPackage(request)}
                    onCancelListing={(listingId) => void handleCancelListing(listingId)}
                    onCreateSwapOffer={(tokenId, intention) => void handleCreateSwapOffer(tokenId, intention)}
                    onAcceptSwapBid={(listingId, bidId) => handleAcceptSwapBid(listingId, bidId)}
                    onCancelSwapListing={(listingId) => handleCancelSwapListing(listingId)}
                    onCancelSwapBid={(bidId) => handleCancelSwapBid(bidId)}
                  />
                ) : (
                  <MarketplaceHubStudioCommissionsTab
                    t={t}
                    studio={studio}
                    tokenPreviews={tokenPreviews}
                    txBusy={txBusy}
                    publicKey={publicKey}
                    onCreateCommissionEgg={(uri, price, currency, etaDays) =>
                      void handleCreateCommissionEgg(uri, price, currency, etaDays)
                    }
                    onCancelListing={(listingId) => void handleCancelListing(listingId)}
                    onCommissionOrderAction={(order, action, metadataUri) =>
                      handleCommissionOrderAction(order, action, metadataUri)
                    }
                    onCommissionRevisionRequest={(order, intention, reference) =>
                      handleCommissionRevisionRequest(order, intention, reference)
                    }
                  />
                )
              ) : studioError ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-foreground">
                  {studioError}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {txMessage ? (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,720px)] -translate-x-1/2 rounded-xl border border-border bg-black/80 p-3 text-sm text-foreground shadow-2xl backdrop-blur">
          {txMessage}
        </div>
      ) : null}
    </div>
  );
}
