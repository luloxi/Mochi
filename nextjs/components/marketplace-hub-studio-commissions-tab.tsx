"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Check, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HubTranslateFn, TokenPreview } from "@/components/marketplace-hub-shared";
import {
  commissionAutoReleaseAt,
  commissionOrderIsOpen,
  formatTimestamp,
  formatMarketplaceTokenAmount,
  orderStatusChipClass,
  orderStatusLabel,
  walletShort,
} from "@/components/marketplace-hub-shared";
import type { MarketplaceMyStudioResponse, MyStudioCommissionOrderItem } from "@/lib/marketplace-hub-types";
import { ANIMATION_GUIDE_PATH, CHARACTER_CREATOR_PATH } from "@/lib/mochi-sprite-spec";
import { openSiteDesktopWindow } from "@/lib/site-desktop-window";

type Props = {
  t: HubTranslateFn;
  studio: MarketplaceMyStudioResponse;
  tokenPreviews: Record<string, TokenPreview>;
  txBusy: boolean;
  publicKey: string | null;
  onCreateCommissionEgg: (uri: string, price: string, currency: "Avax" | "Usdc", etaDays: string) => void | Promise<void>;
  onCancelListing: (listingId: number) => void | Promise<void>;
  onCommissionOrderAction: (
    order: MyStudioCommissionOrderItem,
    action: "deliver" | "approve" | "refund" | "claim_timeout",
    metadataUri?: string,
  ) => void | Promise<void>;
  onCommissionRevisionRequest: (
    order: MyStudioCommissionOrderItem,
    intention: string,
    reference: string,
  ) => void | Promise<void>;
};

export function MarketplaceHubStudioCommissionsTab({
  t,
  studio,
  tokenPreviews,
  txBusy,
  publicKey,
  onCreateCommissionEgg,
  onCancelListing,
  onCommissionOrderAction,
  onCommissionRevisionRequest,
}: Props) {
  const selectClassName =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";
  const selectStyle = { backgroundColor: "var(--card)", color: "var(--foreground)" } as const;
  const selectOptionClassName = "bg-popover text-popover-foreground";
  const selectOptionStyle = { backgroundColor: "var(--popover)", color: "var(--popover-foreground)" } as const;

  // Egg creation form state
  const [eggImageUrl, setEggImageUrl] = useState("");
  const [eggImageUploading, setEggImageUploading] = useState(false);
  const [eggPrice, setEggPrice] = useState("");
  const [eggCurrency, setEggCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [eggEtaDays, setEggEtaDays] = useState("7");

  // Existing egg listing form state
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingCurrency, setListingCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [listingCommissionEtaDays, setListingCommissionEtaDays] = useState("7");

  // Commission order per-order state
  const [commissionDeliveryUri, setCommissionDeliveryUri] = useState<Record<string, string>>({});
  const [commissionRevisionIntention, setCommissionRevisionIntention] = useState<Record<string, string>>({});
  const [commissionRevisionReference, setCommissionRevisionReference] = useState<Record<string, string>>({});
  const [orderActionBusyId, setOrderActionBusyId] = useState<string | null>(null);

  const commissionEggs = studio.ownedNfts.filter((n) => n.isCommissionEgg);
  const commissionEggListings = studio.myListings.filter((l) => l.active && l.isCommissionEgg);
  const ordersAsArtist = studio.myCommissionOrdersAsArtist.filter((o) => commissionOrderIsOpen(o.status));
  const ordersAsBuyer = studio.myCommissionOrdersAsBuyer.filter((o) => commissionOrderIsOpen(o.status));

  const { canListNewCommissionEgg, reason: lockReason } = studio.commissionEggLock;

  async function handleImageUpload(file: File) {
    setEggImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed");
      setEggImageUrl(payload.url);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setEggImageUploading(false);
    }
  }

  function handleCreateEgg() {
    if (!eggImageUrl.trim()) return;
    void onCreateCommissionEgg(eggImageUrl.trim(), eggPrice, eggCurrency, eggEtaDays);
  }

  function handleListExistingEgg() {
    const tokenId = Number.parseInt(selectedTokenId, 10);
    if (!Number.isFinite(tokenId)) return;
    void onCreateCommissionEgg("existing:" + tokenId, listingPrice, listingCurrency, listingCommissionEtaDays);
  }

  async function handleOrderAction(
    order: MyStudioCommissionOrderItem,
    action: "deliver" | "approve" | "refund" | "claim_timeout",
  ) {
    const metadataUri = action === "deliver"
      ? (commissionDeliveryUri[String(order.orderId)] || "").trim()
      : undefined;
    setOrderActionBusyId(`${action}:${order.orderId}`);
    try {
      await onCommissionOrderAction(order, action, metadataUri);
      if (action === "deliver") {
        setCommissionDeliveryUri((prev) => ({ ...prev, [String(order.orderId)]: "" }));
      }
    } finally {
      setOrderActionBusyId(null);
    }
  }

  async function handleRevisionRequest(order: MyStudioCommissionOrderItem) {
    const intention = (commissionRevisionIntention[String(order.orderId)] || "").trim();
    const reference = (commissionRevisionReference[String(order.orderId)] || "").trim();
    setOrderActionBusyId(`revision:${order.orderId}`);
    try {
      await onCommissionRevisionRequest(order, intention, reference);
      setCommissionRevisionIntention((prev) => ({ ...prev, [String(order.orderId)]: "" }));
      setCommissionRevisionReference((prev) => ({ ...prev, [String(order.orderId)]: "" }));
    } finally {
      setOrderActionBusyId(null);
    }
  }

  return (
    <div className="site-window-skin config-contrast-panel space-y-4">
      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="text-sm font-semibold text-foreground">
              {t("Need the animation spec or local preview app?", "¿Necesitás la guía de animaciones o la app de preview local?")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "Review the animation guide first, then open the creator to test a new character locally before turning it into an NFT.",
                "Mira la guia de animacion y despues abrí el creador para probar un personaje en local antes de convertirlo en NFT.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={ANIMATION_GUIDE_PATH}
              onClick={(event) => {
                event.preventDefault();
                openSiteDesktopWindow("guide", ANIMATION_GUIDE_PATH);
              }}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-cyan-400/25"
            >
              {t("Animation guide", "Guía de animaciones")}
            </Link>
            <Link
              href={CHARACTER_CREATOR_PATH}
              onClick={(event) => {
                event.preventDefault();
                openSiteDesktopWindow("creator", CHARACTER_CREATOR_PATH);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/10"
            >
              {t("Open creator", "Abrir creador")}
            </Link>
          </div>
        </div>
      </div>

      {/* Lock status banner */}
      {!canListNewCommissionEgg && lockReason ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{lockReason}</p>
        </div>
      ) : null}

      {/* Create + List new commission egg */}
      {canListNewCommissionEgg ? (
        <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/5 p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {t("Create Commission Egg", "Crear Huevo de Comisión")}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {t(
              "Upload your commission art, set a price, and list it — all in one step.",
              "Subí tu arte de comisión, ponele un precio y publicalo — todo en un paso.",
            )}
          </p>

          <div className="space-y-3">
            {/* Image upload */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Commission art image", "Imagen del arte de comisión")}
              </label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10">
                  {eggImageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("Choose image", "Elegir imagen")}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload(file);
                    }}
                    disabled={eggImageUploading}
                  />
                </label>
                {eggImageUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={eggImageUrl}
                      alt="Preview"
                      className="h-10 w-10 rounded-lg border border-border object-cover"
                    />
                    <span className="max-w-[140px] truncate text-[10px] text-muted-foreground">{eggImageUrl}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Price + currency */}
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("Price", "Precio")}
                </label>
                <input
                  type="number"
                  value={eggPrice}
                  onChange={(e) => setEggPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("Currency", "Moneda")}
                </label>
                <select
                  value={eggCurrency}
                  onChange={(e) => setEggCurrency(e.target.value as "Avax" | "Usdc")}
                  className={selectClassName}
                  style={selectStyle}
                >
                  <option className={selectOptionClassName} style={selectOptionStyle} value="Avax">
                    AVAX
                  </option>
                  <option className={selectOptionClassName} style={selectOptionStyle} value="Usdc">
                    USDC
                  </option>
                </select>
              </div>
            </div>

            {/* ETA */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Estimated turnaround (days)", "Tiempo estimado de entrega (días)")}
              </label>
              <input
                type="number"
                value={eggEtaDays}
                onChange={(e) => setEggEtaDays(e.target.value)}
                placeholder="7"
                min="1"
                className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              type="button"
              onClick={handleCreateEgg}
              disabled={txBusy || !eggImageUrl.trim() || eggImageUploading}
              className="w-full bg-fuchsia-500 text-white hover:bg-fuchsia-400 disabled:opacity-50"
            >
              {txBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("Create & List Commission Egg", "Crear y Publicar Huevo de Comisión")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* List an existing commission egg */}
      {commissionEggs.length > 0 && canListNewCommissionEgg ? (
        <div className="rounded-2xl border border-border bg-white/5 p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {t("List Existing Commission Egg", "Publicar Huevo de Comisión Existente")}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {t(
              "Select one of your commission egg NFTs and list it for sale.",
              "Seleccioná uno de tus NFTs de huevo de comisión y publicalo.",
            )}
          </p>

          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {commissionEggs.map((token) => {
              const preview = token.tokenUri ? tokenPreviews[token.tokenUri] : null;
              const isSelected = selectedTokenId === String(token.tokenId);
              const isListed = studio.myListings.some((l) => l.active && l.tokenId === token.tokenId);
              return (
                <button
                  key={`commission-egg-${token.tokenId}`}
                  type="button"
                  onClick={() => setSelectedTokenId(String(token.tokenId))}
                  className={`group relative overflow-hidden rounded-xl border transition ${
                    isSelected
                      ? "border-fuchsia-400/50 bg-fuchsia-400/10 ring-1 ring-fuchsia-400/30"
                      : "border-border bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-white/[0.04]">
                    {preview?.imageUrl ? (
                      <img
                        src={preview.imageUrl}
                        alt={`#${token.tokenId}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    {isSelected ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-fuchsia-400/20">
                        <Check className="h-5 w-5 text-fuchsia-400" />
                      </div>
                    ) : null}
                    {isListed ? (
                      <div className="absolute left-1 top-1">
                        <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-1.5 py-0.5 text-[9px] text-foreground">
                          {t("Listed", "Publicado")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-1.5 text-center">
                    <p className="text-[10px] font-medium text-foreground">#{token.tokenId}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Price", "Precio")}
              </label>
              <input
                type="number"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Currency", "Moneda")}
              </label>
              <select
                value={listingCurrency}
                onChange={(e) => setListingCurrency(e.target.value as "Avax" | "Usdc")}
                className={selectClassName}
                style={selectStyle}
              >
                <option className={selectOptionClassName} style={selectOptionStyle} value="Avax">
                  AVAX
                </option>
                <option className={selectOptionClassName} style={selectOptionStyle} value="Usdc">
                  USDC
                </option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("Estimated turnaround (days)", "Tiempo estimado de entrega (días)")}
            </label>
            <input
              type="number"
              value={listingCommissionEtaDays}
              onChange={(e) => setListingCommissionEtaDays(e.target.value)}
              placeholder="7"
              min="1"
              className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <Button
            type="button"
            onClick={handleListExistingEgg}
            disabled={txBusy || !selectedTokenId}
            className="mt-4 w-full bg-fuchsia-500 text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {txBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("List Commission Egg", "Publicar Huevo de Comisión")}
          </Button>
        </div>
      ) : null}

      {/* Active commission egg listings */}
      {commissionEggListings.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("Active commission egg listings", "Publicaciones de huevos activas")}
          </h3>
          <div className="space-y-2">
            {commissionEggListings.map((listing) => {
              const preview = listing.tokenUri ? tokenPreviews[listing.tokenUri] : null;
              return (
                <div
                  key={`egg-listing-${listing.listingId}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-white/5 p-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-white/10">
                    {preview?.imageUrl ? (
                      <img
                        src={preview.imageUrl}
                        alt={`#${listing.tokenId}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">#{listing.tokenId}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatMarketplaceTokenAmount(listing.price, listing.currency === "Usdc" ? "USDC" : "AVAX")} {listing.currency === "Usdc" ? "USDC" : "AVAX"}
                      {listing.commissionEtaDays ? ` · ${listing.commissionEtaDays}d` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-rose-400/30 bg-rose-500/10 text-foreground hover:bg-rose-500/20"
                    onClick={() => void onCancelListing(listing.listingId)}
                    disabled={txBusy}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("Cancel", "Cancelar")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Commission orders as artist */}
      {ordersAsArtist.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("Commission orders (as artist)", "Órdenes de comisión (como artista)")}
          </h3>
          <div className="space-y-4">
            {ordersAsArtist.map((order) => {
              const autoReleaseAt = commissionAutoReleaseAt(order.deliveredAt);
              const isBusyDeliver = orderActionBusyId === `deliver:${order.orderId}`;
              const isBusyTimeout = orderActionBusyId === `claim_timeout:${order.orderId}`;
              return (
                <div key={`artist-order-${order.orderId}`} className="rounded-xl border border-border bg-white/5 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {t("Order", "Orden")} #{order.orderId}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${orderStatusChipClass(order.status)}`}
                      >
                        {orderStatusLabel(order.status, t)}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t("Token", "Token")} #{order.tokenId} · {walletShort(order.buyer)}
                    </span>
                  </div>

                  {order.intention ? (
                    <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{order.intention}</p>
                  ) : null}

                  {order.status === "Accepted" ? (
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          {t("Final metadata URI", "URI final de metadata")}
                        </label>
                        <input
                          type="text"
                          value={commissionDeliveryUri[String(order.orderId)] || ""}
                          onChange={(e) =>
                            setCommissionDeliveryUri((prev) => ({ ...prev, [String(order.orderId)]: e.target.value }))
                          }
                          placeholder="ipfs://... or https://..."
                          className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-500 text-black hover:bg-emerald-400"
                        onClick={() => void handleOrderAction(order, "deliver")}
                        disabled={isBusyDeliver}
                      >
                        {isBusyDeliver ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {t("Mark as delivered", "Marcar como entregado")}
                      </Button>
                    </div>
                  ) : null}

                  {order.status === "Delivered" && autoReleaseAt > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t("Auto-release:", "Liberación automática:")} {formatTimestamp(autoReleaseAt)}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-border bg-white/5 text-foreground hover:bg-white/10"
                        onClick={() => void handleOrderAction(order, "claim_timeout")}
                        disabled={isBusyTimeout}
                      >
                        {isBusyTimeout ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {t("Claim timeout", "Reclamar timeout")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Commission orders as buyer */}
      {ordersAsBuyer.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("Commission orders (as buyer)", "Órdenes de comisión (como comprador)")}
          </h3>
          <div className="space-y-4">
            {ordersAsBuyer.map((order) => {
              const autoReleaseAt = commissionAutoReleaseAt(order.deliveredAt);
              const isBusyApprove = orderActionBusyId === `approve:${order.orderId}`;
              const isBusyRefund = orderActionBusyId === `refund:${order.orderId}`;
              const isBusyRevision = orderActionBusyId === `revision:${order.orderId}`;
              const canRevise =
                order.status === "Delivered" && order.revisionRequestCount < order.maxRevisionRequests;
              return (
                <div key={`buyer-order-${order.orderId}`} className="rounded-xl border border-border bg-white/5 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {t("Order", "Orden")} #{order.orderId}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${orderStatusChipClass(order.status)}`}
                      >
                        {orderStatusLabel(order.status, t)}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t("Artist", "Artista")}: {walletShort(order.seller)}
                    </span>
                  </div>

                  {order.intention ? (
                    <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{order.intention}</p>
                  ) : null}

                  {order.status === "Delivered" ? (
                    <div className="space-y-2">
                      {order.lastDeliveredMetadataUri ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t("Delivered metadata:", "Metadata entregada:")} {order.lastDeliveredMetadataUri}
                        </p>
                      ) : null}
                      {autoReleaseAt > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t("Auto-approve:", "Aprobación automática:")} {formatTimestamp(autoReleaseAt)}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-500 text-black hover:bg-emerald-400"
                          onClick={() => void handleOrderAction(order, "approve")}
                          disabled={isBusyApprove}
                        >
                          {isBusyApprove ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {t("Approve delivery", "Aprobar entrega")}
                        </Button>
                        {canRevise ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-amber-400/30 bg-amber-500/10 text-foreground hover:bg-amber-500/20"
                            onClick={() => void handleRevisionRequest(order)}
                            disabled={isBusyRevision}
                          >
                            {isBusyRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {t("Request revision", "Pedir revisión")} ({order.revisionRequestCount}/
                            {order.maxRevisionRequests})
                          </Button>
                        ) : null}
                      </div>
                      {canRevise ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={commissionRevisionIntention[String(order.orderId)] || ""}
                            onChange={(e) =>
                              setCommissionRevisionIntention((prev) => ({ ...prev, [String(order.orderId)]: e.target.value }))
                            }
                            placeholder={t(
                              "Change request description",
                              "Descripción del cambio solicitado",
                            )}
                            className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50"
                          />
                          <input
                            type="text"
                            value={commissionRevisionReference[String(order.orderId)] || ""}
                            onChange={(e) =>
                              setCommissionRevisionReference((prev) => ({ ...prev, [String(order.orderId)]: e.target.value }))
                            }
                            placeholder={t(
                              "Reference image URL (optional)",
                              "URL de imagen de referencia (opcional)",
                            )}
                            className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : order.status === "Accepted" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-400/30 bg-rose-500/10 text-foreground hover:bg-rose-500/20"
                      onClick={() => void handleOrderAction(order, "refund")}
                      disabled={isBusyRefund}
                    >
                      {isBusyRefund ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {t("Request refund", "Solicitar reembolso")}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {ordersAsArtist.length === 0 && ordersAsBuyer.length === 0 && commissionEggListings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white/5 p-4 text-center text-xs text-muted-foreground">
          {t("No active commission orders.", "No hay órdenes de comisión activas.")}
        </div>
      ) : null}
    </div>
  );
}
