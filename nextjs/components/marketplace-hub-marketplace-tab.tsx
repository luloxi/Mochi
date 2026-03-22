import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/marketplace-hub-fields";
import type { MarketplaceFeedItem } from "@/lib/marketplace-hub-types";
import {
  buildClientMediaProxyUrl,
  type FeedAssetFilter,
  type FeedSaleFilter,
  type FeedSort,
  type HubTranslateFn,
  type TokenPreview,
  formatMarketplaceTokenAmount,
  timeLeftLabel,
  walletShort,
} from "@/components/marketplace-hub-shared";
import { ArrowUpRight, Gavel, ImageIcon, Loader2, ShoppingCart, UserRound } from "lucide-react";

type MarketplaceHubMarketplaceTabProps = {
  t: HubTranslateFn;
  feedSearch: string;
  onFeedSearchChange: (value: string) => void;
  feedAssetFilter: FeedAssetFilter;
  onFeedAssetFilterChange: (value: FeedAssetFilter) => void;
  feedSaleFilter: FeedSaleFilter;
  onFeedSaleFilterChange: (value: FeedSaleFilter) => void;
  feedSort: FeedSort;
  onFeedSortChange: (value: FeedSort) => void;
  feedError: string;
  feedWarnings: string[];
  feedLoading: boolean;
  marketplaceGridItems: MarketplaceFeedItem[];
  liveAuctionItem: MarketplaceFeedItem | null;
  tokenPreviews: Record<string, TokenPreview>;
  auctionBidCurrency: "AVAX" | "USDC";
  onAuctionBidCurrencyChange: (value: "AVAX" | "USDC") => void;
  auctionBidAmount: string;
  onAuctionBidAmountChange: (value: string) => void;
  onAuctionBid: () => void | Promise<void>;
  txBusy: boolean;
  publicKey: string | null | undefined;
};

export function MarketplaceHubMarketplaceTab({
  t,
  feedSearch,
  onFeedSearchChange,
  feedAssetFilter,
  onFeedAssetFilterChange,
  feedSaleFilter,
  onFeedSaleFilterChange,
  feedSort,
  onFeedSortChange,
  feedError,
  feedWarnings,
  feedLoading,
  marketplaceGridItems,
  liveAuctionItem,
  tokenPreviews,
  auctionBidCurrency,
  onAuctionBidCurrencyChange,
  auctionBidAmount,
  onAuctionBidAmountChange,
  onAuctionBid,
  txBusy,
  publicKey,
}: MarketplaceHubMarketplaceTabProps) {
  return (
    <section className="site-window-surface config-contrast-panel rounded-3xl border border-border bg-white/10 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <ShoppingCart className="h-5 w-5 text-emerald-300" />
            {t("Marketplace", "Marketplace")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("Public listings and auctions.", "Publicaciones y subastas publicas.")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{t("Search", "Buscar")}</span>
          <input
            className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
            placeholder={t("wallet, URI, artist...", "wallet, URI, artista...")}
            value={feedSearch}
            onChange={(event) => onFeedSearchChange(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{t("Asset", "Activo")}</span>
          <select
            className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
            value={feedAssetFilter}
            onChange={(event) => onFeedAssetFilterChange(event.target.value as FeedAssetFilter)}
          >
            <option value="all">{t("All", "Todos")}</option>
            <option value="nft">NFT</option>
            <option value="commission_egg">{t("Commission Egg", "Huevo de Comision")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{t("Sale type", "Tipo de venta")}</span>
          <select
            className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
            value={feedSaleFilter}
            onChange={(event) => onFeedSaleFilterChange(event.target.value as FeedSaleFilter)}
          >
            <option value="all">{t("All", "Todos")}</option>
            <option value="fixed_price">{t("Fixed price", "Precio fijo")}</option>
            <option value="auction">{t("Auction", "Subasta")}</option>
            <option value="swap">{t("Swap", "Intercambio")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{t("Sort", "Orden")}</span>
          <select
            className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
            value={feedSort}
            onChange={(event) => onFeedSortChange(event.target.value as FeedSort)}
          >
            <option value="ending_soon">{t("Ending soon", "Termina pronto")}</option>
            <option value="price_low">{t("Price low to high", "Precio menor a mayor")}</option>
            <option value="price_high">{t("Price high to low", "Precio mayor a menor")}</option>
          </select>
        </label>
      </div>

      {feedError ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-foreground">
          {feedError}
        </div>
      ) : null}

      {feedWarnings.length ? (
        <div className="mt-4 space-y-2">
          {feedWarnings.map((warning) => (
            <div
              key={warning}
              className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-foreground"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {feedLoading && marketplaceGridItems.length > 0 ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("Updating marketplace items...", "Actualizando items del marketplace...")}
        </div>
      ) : null}

      {liveAuctionItem ? (
        <div className="hidden mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <div>
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                <div className="relative overflow-hidden rounded-2xl border border-amber-200/20 bg-white/[0.04]">
                  <div className="aspect-square w-full">
                    {(() => {
                      const preview = liveAuctionItem.tokenUri ? tokenPreviews[liveAuctionItem.tokenUri] : null;
                      const previewImageUrl = liveAuctionItem.imageUrl || preview?.imageUrl || null;
                      if (previewImageUrl) {
                        return (
                          <img
                            src={previewImageUrl}
                            alt={liveAuctionItem.tokenName || preview?.name || `Auction ${liveAuctionItem.auction?.auctionId ?? ""}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        );
                      }
                      return (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/15 to-transparent text-muted-foreground">
                          <div className="flex flex-col items-center gap-2 text-xs">
                            <ImageIcon className="h-8 w-8" />
                            <span>{t("Preview loading", "Cargando preview")}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/10 to-transparent" />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white">
                    <Gavel className="h-3 w-3" />
                    {t("Featured Auction", "Subasta destacada")}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-foreground">
                    <Gavel className="h-3.5 w-3.5" />
                    {t("Live Auction", "Subasta en vivo")}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">
                    {liveAuctionItem.tokenName ||
                      (liveAuctionItem.tokenId !== null
                        ? `${t("Mochi NFT", "Mochi NFT")} #${liveAuctionItem.tokenId}`
                        : `${t("Auction", "Subasta")} #${liveAuctionItem.auction?.auctionId ?? "?"}`)}
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="rounded-xl border border-border bg-white/5 p-3">
                      <p className="text-xs text-muted-foreground">{t("Current bid", "Oferta actual")}</p>
                      <p className="text-foreground font-semibold">
                        {liveAuctionItem.auction?.currentBidAmount
                          ? `${formatMarketplaceTokenAmount(liveAuctionItem.auction.currentBidAmount, liveAuctionItem.auction.currentBidCurrency === "Usdc" ? "USDC" : "AVAX")} ${liveAuctionItem.auction.currentBidCurrency === "Usdc" ? "USDC" : "AVAX"}`
                          : t("No bids yet", "Sin ofertas todavia")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-white/5 p-3">
                      <p className="text-xs text-muted-foreground">{t("Time left", "Tiempo restante")}</p>
                      <p className="text-foreground font-semibold">
                        {timeLeftLabel(liveAuctionItem.auction?.endTime ?? null)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <div className="rounded-full border border-border bg-white/5 px-3 py-1">
                      {t("Auction ID", "ID subasta")}: #{liveAuctionItem.auction?.auctionId ?? "?"}
                    </div>
                    <div className="rounded-full border border-border bg-white/5 px-3 py-1">
                      {t("Starting price", "Precio inicial")}:{" "}
                      {liveAuctionItem.price
                        ? `${formatMarketplaceTokenAmount(liveAuctionItem.price, liveAuctionItem.currency === "Usdc" ? "USDC" : "AVAX")} ${liveAuctionItem.currency === "Usdc" ? "USDC" : "AVAX"}`
                        : "-"}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link
                      href={
                        liveAuctionItem.tokenId !== null
                          ? `/marketplace/mochi/${liveAuctionItem.tokenId}`
                          : "/marketplace"
                      }
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
                    >
                      {t("View NFT details", "Ver detalle del NFT")}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white/5 p-4">
              <div className="grid gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>{t("Currency", "Moneda")}</span>
                  <select
                    className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                    value={auctionBidCurrency}
                    onChange={(event) => onAuctionBidCurrencyChange(event.target.value as "AVAX" | "USDC")}
                  >
                    <option value="AVAX">AVAX</option>
                    <option value="USDC">USDC</option>
                  </select>
                </label>
                <InputField
                  label={t("Bid amount", "Monto de oferta")}
                  value={auctionBidAmount}
                  onChange={onAuctionBidAmountChange}
                  placeholder={auctionBidCurrency === "AVAX" ? "500" : "50"}
                />
                <Button
                  type="button"
                  className="w-full bg-amber-400 text-black hover:bg-amber-300"
                  onClick={() => void onAuctionBid()}
                  disabled={txBusy || !publicKey}
                >
                  {txBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                  {t("Place bid", "Ofertar")}
                </Button>
                {!publicKey ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Connect your wallet using the global header to bid.",
                      "Conecta tu wallet usando el header global para ofertar.",
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {feedLoading && marketplaceGridItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("Loading marketplace items...", "Cargando items del marketplace...")}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`marketplace-loading-card-${index}`}
                className="min-w-0 w-full flex-[1_1_260px] overflow-hidden rounded-2xl border border-border bg-white/[0.04] sm:max-w-[360px]"
              >
                <div className="aspect-square w-full animate-pulse bg-white/[0.06]" />
                <div className="space-y-2 border-t border-border/60 p-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-white/[0.05]" />
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-28 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {marketplaceGridItems.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-4">
          {marketplaceGridItems.map((item) => {
            const isAuction = item.saleKind === "auction";
            const isSwap = item.saleKind === "swap";
            const isCommissionEgg = item.assetKind === "commission_egg";
            const isEdition = item.tokenStandard === "ERC1155";
            const itemDetailHref = isEdition
              ? item.id.startsWith("edition_listing:")
                ? `/marketplace/edition/${item.id.split(":")[1]}`
                : null
              : item.tokenId !== null
                ? `/marketplace/mochi/${item.tokenId}`
                : null;
            const preview = item.tokenUri ? tokenPreviews[item.tokenUri] : null;
            const commissionPlaceholderImageUrl = isCommissionEgg
              ? (
                  buildClientMediaProxyUrl(item.sellerProfile?.bannerUrl) ||
                  buildClientMediaProxyUrl(item.sellerProfile?.avatarUrl) ||
                  null
                )
              : null;
            const previewImageUrl = commissionPlaceholderImageUrl || item.imageUrl || preview?.imageUrl || null;
            const title =
              item.tokenName ||
              preview?.name ||
              (item.tokenId !== null
                ? `${isCommissionEgg ? t("Commission Egg", "Huevo de comision") : isEdition ? t("Edition", "Edición") : "Mochi NFT"} #${item.tokenId}`
                : `${t("Auction", "Subasta")} #${item.auction?.auctionId ?? "?"}`);
            const sellerDisplayName = item.sellerProfile?.displayName
              ? item.sellerProfile.displayName
              : item.sellerWallet
                ? walletShort(item.sellerWallet)
                : t("Auction listing", "Lote en subasta");
            const primaryPrice = isSwap
              ? t("Swap offer", "Oferta de intercambio")
              : item.price
                ? `${formatMarketplaceTokenAmount(item.price, item.currency === "Usdc" ? "USDC" : "AVAX")} ${item.currency === "Usdc" ? "USDC" : "AVAX"}`
                : "-";
            const saleTypeLabel = isSwap
              ? t("Swap", "Intercambio")
              : isCommissionEgg
                ? t("Commission", "Comision")
                : isAuction
                  ? t("Auction", "Subasta")
                  : t("Sale", "Venta");
            const saleTypeChipClass = isSwap
              ? "border-sky-700/70 bg-sky-300 text-sky-950"
              : isCommissionEgg
                ? "border-fuchsia-700/70 bg-fuchsia-300 text-fuchsia-950"
                : isAuction
                  ? "border-amber-700/70 bg-amber-300 text-amber-950"
                  : "border-emerald-700/70 bg-emerald-300 text-emerald-950";

            const card = (
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white/5 shadow-sm transition hover:border-white/20 hover:bg-white/[0.07]">
                <div className="relative overflow-hidden bg-white/[0.04]">
                  <div className="aspect-square w-full">
                    {previewImageUrl ? (
                      <img
                        src={previewImageUrl}
                        alt={title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 text-xs">
                          <ImageIcon className="h-8 w-8" />
                          <span>{t("Loading image", "Cargando imagen")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/10 to-transparent" />
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 p-3">
                  <div>
                    <p className="line-clamp-2 text-base font-semibold leading-tight text-foreground">{title}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="leading-none text-lg font-semibold text-foreground">{primaryPrice}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${saleTypeChipClass}`}
                    >
                      {saleTypeLabel}
                    </span>
                  </div>
                  {isEdition && typeof item.quantityAvailable === "number" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("Copies available", "Copias disponibles")}: {item.quantityAvailable}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 text-white">
                      {item.sellerProfile?.avatarUrl ? (
                        <img
                          src={item.sellerProfile.avatarUrl}
                          alt={sellerDisplayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <UserRound className="h-4 w-4 text-white/70" />
                      )}
                    </div>
                    <p className="min-w-0 truncate text-sm text-muted-foreground">{sellerDisplayName}</p>
                  </div>
                </div>
              </article>
            );

            return itemDetailHref ? (
              <Link
                key={item.id}
                href={itemDetailHref}
                className="block h-full min-w-0 w-full cursor-pointer flex-[1_1_260px] sm:max-w-[360px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${title} - ${saleTypeLabel}`}
              >
                {card}
              </Link>
            ) : (
              <div key={item.id} className="h-full min-w-0 w-full flex-[1_1_260px] sm:max-w-[360px]">
                {card}
              </div>
            );
          })}
        </div>
      ) : null}

      {!feedLoading && marketplaceGridItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
          {t(
            "No items match these filters yet. Try clearing filters or be the first to list a Mochi.",
            "No hay items para esos filtros todavia. Prueba limpiando filtros o se la primera persona en listar un Mochi.",
          )}
        </div>
      ) : null}
    </section>
  );
}
