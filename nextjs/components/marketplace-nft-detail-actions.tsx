"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/components/wallet-provider";
import { useLanguage } from "@/components/language-provider";
import { useSiteMochi } from "@/components/site-mochi-provider";
import { submitContractWrite } from "@/components/marketplace-hub-shared";
import {
  buildBuyCommissionUsdcTx,
  buildBuyCommissionAvaxTx,
  buildBuyUsdcTx,
  buildBuyAvaxTx,
} from "@/lib/marketplace";
import { buildBidUsdcTx, buildBidAvaxTx } from "@/lib/auction";
import { buildPlaceSwapBidTx } from "@/lib/swap";
import type { MarketplaceMyStudioResponse, MyStudioNftItem } from "@/lib/marketplace-hub-types";

const AVAX_DECIMALS = 18;
const USDC_DECIMALS = 6;
const MIN_AUCTION_INCREMENT_BPS = BigInt(500); // 5%
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BPS_DENOMINATOR = BigInt(10_000);

type SaleListingData = {
  listingId: number;
  sellerWallet: string;
  sellerDisplayName: string;
  price: string;
  currency: "Avax" | "Usdc";
  commissionEtaDays: number;
  isCommissionEgg: boolean;
  artistTerms: {
    displayName: string;
    acceptingNewClients: boolean;
    turnaroundDaysMin: number | null;
    turnaroundDaysMax: number | null;
    slotsOpen: number | null;
    slotsTotal: number | null;
    basePriceAvax: string;
    basePriceUsdc: string;
    bio: string;
  } | null;
};

type AuctionBidData = {
  bidder: string;
  amount: string;
  currency: "Avax" | "Usdc";
};

type AuctionActionData = {
  auctionId: number;
  startTime: number;
  endTime: number;
  startingPrice: string;
  currency: "Avax" | "Usdc";
  highestBid: AuctionBidData | null;
  recentBids: AuctionBidData[];
};

type SwapListingActionData = {
  listingId: number;
  creatorWallet: string;
  creatorDisplayName: string;
  offeredTokenId: number;
  intention: string;
};

type Props = {
  tokenId: number;
  activeListing: SaleListingData | null;
  activeAuction: AuctionActionData | null;
  openSwapListingsOfferingThis: SwapListingActionData[];
};

function decimalsForCurrency(currency: "AVAX" | "USDC") {
  return currency === "USDC" ? USDC_DECIMALS : AVAX_DECIMALS;
}

function scaleForDecimals(decimals: number) {
  return BigInt(`1${"0".repeat(Math.max(0, decimals))}`);
}

function walletShort(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTokenAmount(rawUnits: string | bigint | null | undefined, currency: "AVAX" | "USDC") {
  if (rawUnits === null || rawUnits === undefined) return "-";
  const parsed =
    typeof rawUnits === "bigint"
      ? rawUnits
      : typeof rawUnits === "string" && /^-?\d+$/.test(rawUnits)
        ? BigInt(rawUnits)
        : null;
  if (parsed === null) return "-";
  const decimals = decimalsForCurrency(currency);
  const scale = scaleForDecimals(decimals);
  const sign = parsed < BIGINT_ZERO ? "-" : "";
  const abs = parsed < BIGINT_ZERO ? -parsed : parsed;
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

function parseAmountToUnits(value: string, currency: "AVAX" | "USDC", invalidFormatMessage = "Invalid amount format"): bigint {
  const decimals = decimalsForCurrency(currency);
  const trimmed = value.trim();
  if (!trimmed) return BIGINT_ZERO;
  const re = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!re.test(trimmed)) {
    throw new Error(invalidFormatMessage);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const fracPadded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const scale = scaleForDecimals(decimals);
  return BigInt(whole) * scale + BigInt(fracPadded);
}

function parseBigIntSafe(raw: string | null | undefined): bigint {
  return typeof raw === "string" && /^-?\d+$/.test(raw) ? BigInt(raw) : BIGINT_ZERO;
}

function ceilDiv(a: bigint, b: bigint) {
  if (b <= BIGINT_ZERO) return BIGINT_ZERO;
  if (a <= BIGINT_ZERO) return BIGINT_ZERO;
  return (a + b - BIGINT_ONE) / b;
}


export function MarketplaceNftDetailActions({
  tokenId,
  activeListing,
  activeAuction,
  openSwapListingsOfferingThis,
}: Props) {
  const router = useRouter();
  const { publicKey, isConnected, connect, signTransaction } = useWalletSession();
  const { isSpanish } = useLanguage();
  const { reloadCatalog } = useSiteMochi();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [commissionIntention, setCommissionIntention] = useState("");
  const [commissionReferenceImageUrl, setCommissionReferenceImageUrl] = useState("");

  const [ownedNfts, setOwnedNfts] = useState<MyStudioNftItem[]>([]);
  const [ownedNftsLoading, setOwnedNftsLoading] = useState(false);
  const [swapBidTokenByListingId, setSwapBidTokenByListingId] = useState<Record<string, string>>({});

  const [auctionBidAmount, setAuctionBidAmount] = useState("");
  const [auctionBidCurrency, setAuctionBidCurrency] = useState<"AVAX" | "USDC">("USDC");
  const [listingBuyCurrency, setListingBuyCurrency] = useState<"AVAX" | "USDC">("AVAX");
  const [commissionBuyCurrency, setCommissionBuyCurrency] = useState<"AVAX" | "USDC">("AVAX");
  const t = (en: string, es: string) => (isSpanish ? es : en);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnedNfts() {
      if (!publicKey) {
        setOwnedNfts([]);
        return;
      }
      setOwnedNftsLoading(true);
      try {
        const response = await fetch(`/api/marketplace/my-studio?wallet=${encodeURIComponent(publicKey)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as MarketplaceMyStudioResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load wallet NFTs");
        }
        if (!cancelled) {
          setOwnedNfts(payload.ownedNfts || []);
        }
      } catch {
        if (!cancelled) {
          setOwnedNfts([]);
        }
      } finally {
        if (!cancelled) {
          setOwnedNftsLoading(false);
        }
      }
    }

    void loadOwnedNfts();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const suggestedAuctionBids = useMemo((): { avax: bigint | null; usdc: bigint | null } => {
    if (!activeAuction) return { avax: null, usdc: null };
    const startingPrice = parseBigIntSafe(activeAuction.startingPrice);
    const auctionCurrency = activeAuction.currency;

    if (activeAuction.highestBid) {
      const currentAmount = parseBigIntSafe(activeAuction.highestBid.amount);
      const minAmount = ceilDiv(
        currentAmount * (BPS_DENOMINATOR + MIN_AUCTION_INCREMENT_BPS),
        BPS_DENOMINATOR,
      );
      const bidCurrency = activeAuction.highestBid.currency;
      return {
        avax: bidCurrency === "Avax" ? minAmount : null,
        usdc: bidCurrency === "Usdc" ? minAmount : null,
      };
    }

    return {
      avax: auctionCurrency === "Avax" ? startingPrice : null,
      usdc: auctionCurrency === "Usdc" ? startingPrice : null,
    };
  }, [activeAuction]);

  useEffect(() => {
    if (!activeAuction) return;
    const next =
      auctionBidCurrency === "AVAX"
        ? formatTokenAmount(suggestedAuctionBids.avax, "AVAX")
        : formatTokenAmount(suggestedAuctionBids.usdc, "USDC");
    setAuctionBidAmount((prev) => (prev.trim() ? prev : next === "-" ? "" : next));
  }, [activeAuction, auctionBidCurrency, suggestedAuctionBids.avax, suggestedAuctionBids.usdc]);

  useEffect(() => {
    if (!activeListing) return;
    const nextCurrency = activeListing.currency === "Usdc" ? "USDC" : "AVAX";
    setListingBuyCurrency(nextCurrency);
    setCommissionBuyCurrency(nextCurrency);
  }, [activeListing?.listingId]);

  async function ensureConnectedAddress() {
    if (publicKey && isConnected) return publicKey;
    await connect();
    setMessage(
      t(
        "Wallet connected. Repeat the action to sign the transaction.",
        "Wallet conectada. Repetí la acción para firmar la transacción.",
      ),
    );
    return null;
  }

  async function submitRegularBuy(currency: "AVAX" | "USDC") {
    if (!activeListing || activeListing.isCommissionEgg) return;
    const address = await ensureConnectedAddress();
    if (!address) return;
    const isSeller = address === activeListing.sellerWallet;
    if (isSeller) {
      setMessage(t("You are the seller of this listing.", "Sos el vendedor de esta publicación."));
      return;
    }

    setBusyAction(`buy:${currency}`);
    setMessage("");
    try {
      const txXdr =
        currency === "AVAX"
          ? await buildBuyAvaxTx(address, activeListing.listingId)
          : await buildBuyUsdcTx(address, activeListing.listingId);
      await submitContractWrite(txXdr, signTransaction, address);
      await reloadCatalog().catch(() => undefined);
      setMessage(
        currency === "AVAX"
          ? t("Purchase submitted (AVAX).", "Compra enviada (AVAX).")
          : t("Purchase submitted (USDC).", "Compra enviada (USDC)."),
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Failed to buy listing.", "No se pudo comprar la publicación."));
    } finally {
      setBusyAction(null);
    }
  }

  async function submitCommissionBuy(currency: "AVAX" | "USDC") {
    if (!activeListing || !activeListing.isCommissionEgg) return;
    const address = await ensureConnectedAddress();
    if (!address) return;
    if (address === activeListing.sellerWallet) {
      setMessage(
        t(
          "You are the artist/seller for this commission listing.",
          "Sos el artista/vendedor de esta publicación de comisión.",
        ),
      );
      return;
    }
    if (!commissionIntention.trim()) {
      setMessage(t("Add your commission intention first.", "Primero agregá tu intención de comisión."));
      return;
    }

    setBusyAction(`buy-commission:${currency}`);
    setMessage("");
    try {
      const txXdr =
        currency === "AVAX"
          ? await buildBuyCommissionAvaxTx(
              address,
              activeListing.listingId,
              commissionIntention.trim(),
              commissionReferenceImageUrl.trim(),
            )
          : await buildBuyCommissionUsdcTx(
              address,
              activeListing.listingId,
              commissionIntention.trim(),
              commissionReferenceImageUrl.trim(),
            );
      await submitContractWrite(txXdr, signTransaction, address);
      setMessage(t("Commission purchase submitted.", "Compra de comisión enviada."));
      setCommissionIntention("");
      setCommissionReferenceImageUrl("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Failed to buy commission.", "No se pudo comprar la comisión."));
    } finally {
      setBusyAction(null);
    }
  }

  async function submitAuctionBid(currency: "AVAX" | "USDC", rawAmount: string) {
    if (!activeAuction) return;
    const address = await ensureConnectedAddress();
    if (!address) return;

    setBusyAction(`bid:${currency}`);
    setMessage("");
    try {
      const amount = parseAmountToUnits(rawAmount, currency, t("Invalid amount format", "Formato de monto inválido"));
      if (amount <= BIGINT_ZERO) {
        throw new Error(t("Enter a valid bid amount.", "Ingresá un monto de oferta válido."));
      }
      const txXdr =
        currency === "AVAX"
          ? await buildBidAvaxTx(address, activeAuction.auctionId, amount)
          : await buildBidUsdcTx(address, activeAuction.auctionId, amount);
      await submitContractWrite(txXdr, signTransaction, address);
      setMessage(t("Bid submitted.", "Oferta enviada."));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Failed to place bid.", "No se pudo ofertar."));
    } finally {
      setBusyAction(null);
    }
  }

  async function submitSwapBid(listingId: number) {
    const address = await ensureConnectedAddress();
    if (!address) return;
    const selectedTokenIdRaw = swapBidTokenByListingId[String(listingId)] || "";
    const bidderTokenId = Number.parseInt(selectedTokenIdRaw, 10);
    if (!Number.isFinite(bidderTokenId)) {
      setMessage(t("Choose one of your NFTs to offer.", "Elegí uno de tus NFTs para ofrecer."));
      return;
    }

    setBusyAction(`swap-bid:${listingId}`);
    setMessage("");
    try {
      const txXdr = await buildPlaceSwapBidTx(address, listingId, bidderTokenId);
      await submitContractWrite(txXdr, signTransaction, address);
      setMessage(t("Swap offer submitted.", "Oferta de intercambio enviada."));
      setSwapBidTokenByListingId((prev) => ({ ...prev, [String(listingId)]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("Failed to submit swap offer.", "No se pudo enviar la oferta de intercambio."),
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white/10 p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("Market", "Mercado")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("Active market info and actions in one place.", "Info y acciones activas del mercado en un solo lugar.")}
          </p>
        </div>
        {isConnected && publicKey ? (
          <span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            {walletShort(publicKey)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4">
        {activeListing ? (
          <article className="rounded-2xl border border-border bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {activeListing.isCommissionEgg
                  ? t("Commission egg listing", "Publicación de huevo de comisión")
                  : t("Sale listing", "Publicación de venta")}
              </h3>
              <span className="rounded-full border border-emerald-700/70 bg-emerald-300 px-2 py-0.5 text-[11px] font-medium text-emerald-950">
                {activeListing.isCommissionEgg ? t("Commission", "Comisión") : t("Sale", "Venta")}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {activeListing.currency === "Usdc" ? t("Price USDC", "Precio USDC") : t("Price AVAX", "Precio AVAX")}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatTokenAmount(activeListing.price, activeListing.currency === "Usdc" ? "USDC" : "AVAX")} {activeListing.currency === "Usdc" ? "USDC" : "AVAX"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">{t("Accepted payments", "Pagos aceptados")}</p>
                <p className="text-sm font-medium text-foreground">{t("AVAX or USDC", "AVAX o USDC")}</p>
              </div>
            </div>

            {!activeListing.isCommissionEgg ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {!isConnected || !publicKey ? (
                  <p className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                    {t("Connect from the landing header to buy.", "Conecta desde el header del landing para comprar.")}
                  </p>
                ) : (
                  <>
                    <select
                      className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                      value={listingBuyCurrency}
                      onChange={(event) => setListingBuyCurrency(event.target.value as "AVAX" | "USDC")}
                    >
                      <option value="AVAX">AVAX</option>
                      <option value="USDC">USDC</option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-500 text-black hover:bg-emerald-400"
                      onClick={() => void submitRegularBuy(listingBuyCurrency)}
                      disabled={busyAction === `buy:${listingBuyCurrency}`}
                    >
                      {busyAction === `buy:${listingBuyCurrency}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {listingBuyCurrency === "AVAX"
                        ? t("Buy with AVAX", "Comprar con AVAX")
                        : t("Buy with USDC", "Comprar con USDC")}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {activeListing.artistTerms ? (
                  <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/5 p-3">
                    <p className="text-xs font-medium text-foreground">
                      {t("Artist terms", "Términos del artista")} (
                      {activeListing.artistTerms.displayName || activeListing.sellerDisplayName})
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-border bg-white/5 p-2">
                        <p>{t("Turnaround", "Entrega")}</p>
                        <p className="text-foreground">
                          {activeListing.artistTerms.turnaroundDaysMin ?? "?"} - {activeListing.artistTerms.turnaroundDaysMax ?? "?"} {t("days", "días")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-white/5 p-2">
                        <p>{t("Slots", "Cupos")}</p>
                        <p className="text-foreground">
                          {activeListing.artistTerms.slotsOpen ?? "?"}/{activeListing.artistTerms.slotsTotal ?? "?"} {t("open", "abiertos")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-white/5 p-2">
                        <p>{t("Base AVAX", "Base AVAX")}</p>
                        <p className="text-foreground">{activeListing.artistTerms.basePriceAvax || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-white/5 p-2">
                        <p>{t("Base USDC", "Base USDC")}</p>
                        <p className="text-foreground">{activeListing.artistTerms.basePriceUsdc || "-"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("Accepting clients", "Acepta clientes")}:{" "}
                      <span className="text-foreground">
                        {activeListing.artistTerms.acceptingNewClients ? t("Yes", "Sí") : t("No", "No")}
                      </span>
                    </p>
                    {activeListing.artistTerms.bio ? (
                      <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                        {activeListing.artistTerms.bio}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-border bg-white/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{t("Commission terms", "Términos de comisión")}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-white/5 p-2">
                      <p>{t("Artist gets now", "Artista recibe ahora")}</p>
                      <p className="text-foreground">50%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-white/5 p-2">
                      <p>{t("Released after approval", "Se libera tras aprobación")}</p>
                      <p className="text-foreground">50%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-white/5 p-2">
                      <p>{t("Auto release if no response", "Liberación automática si no responde")}</p>
                      <p className="text-foreground">7 {t("days", "días")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-white/5 p-2">
                      <p>{t("Revision requests", "Solicitudes de cambio")}</p>
                      <p className="text-foreground">3 {t("max", "máx.")}</p>
                    </div>
                  </div>
                  {activeListing.commissionEtaDays > 0 ? (
                    <p className="mt-2">
                      {t("Estimated delivery", "Entrega estimada")}:{" "}
                      <span className="text-foreground">
                        {activeListing.commissionEtaDays} {t("days", "días")}
                      </span>
                    </p>
                  ) : null}
                  <Link
                    href="/marketplace/commissions"
                    className="mt-2 inline-block cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {t("Read commission manual", "Leer manual de comisiones")}
                  </Link>
                </div>

                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>{t("Commission intention", "Intención de comisión")}</span>
                  <textarea
                    className="min-h-20 rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                    value={commissionIntention}
                    onChange={(event) => setCommissionIntention(event.target.value)}
                    placeholder={t(
                      "Describe the character, style, pose, mood, colors, etc.",
                      "Describí el personaje, estilo, pose, ánimo, colores, etc.",
                    )}
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>{t("Reference image URL (optional)", "URL de imagen de referencia (opcional)")}</span>
                  <input
                    className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                    value={commissionReferenceImageUrl}
                    onChange={(event) => setCommissionReferenceImageUrl(event.target.value)}
                    placeholder="https://..."
                    inputMode="url"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {!isConnected || !publicKey ? (
                    <p className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                      {t(
                        "Connect from the landing header to buy a commission.",
                        "Conecta desde el header del landing para comprar una comisión.",
                      )}
                    </p>
                  ) : (
                    <>
                      <select
                        className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                        value={commissionBuyCurrency}
                        onChange={(event) => setCommissionBuyCurrency(event.target.value as "AVAX" | "USDC")}
                      >
                        <option value="AVAX">AVAX</option>
                        <option value="USDC">USDC</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-fuchsia-400 text-fuchsia-950 hover:bg-fuchsia-300"
                        onClick={() => void submitCommissionBuy(commissionBuyCurrency)}
                        disabled={busyAction === `buy-commission:${commissionBuyCurrency}`}
                      >
                        {busyAction === `buy-commission:${commissionBuyCurrency}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {commissionBuyCurrency === "AVAX"
                          ? t("Buy commission (AVAX)", "Comprar comisión (AVAX)")
                          : t("Buy commission (USDC)", "Comprar comisión (USDC)")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </article>
        ) : null}

        {activeAuction ? (
          <article className="rounded-2xl border border-border bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("Auction", "Subasta")}</h3>
              <span className="rounded-full border border-amber-700/70 bg-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                {t("Auction", "Subasta")}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">{t("Auction ID", "ID de subasta")}</p>
                <p className="text-sm font-medium text-foreground">#{activeAuction.auctionId}</p>
              </div>
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">{t("Current highest", "Oferta más alta")}</p>
                <p className="text-sm font-medium text-foreground">
                  {activeAuction.highestBid
                    ? `${formatTokenAmount(activeAuction.highestBid.amount, activeAuction.highestBid.currency === "Usdc" ? "USDC" : "AVAX")} ${activeAuction.highestBid.currency === "Usdc" ? "USDC" : "AVAX"}`
                    : t("No bids yet", "Todavía no hay ofertas")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">{t("Suggested min AVAX", "Mínimo sugerido AVAX")}</p>
                <p className="text-sm font-medium text-foreground">
                  {suggestedAuctionBids.avax !== null
                    ? `${formatTokenAmount(suggestedAuctionBids.avax, "AVAX")} AVAX`
                    : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">{t("Suggested min USDC", "Mínimo sugerido USDC")}</p>
                <p className="text-sm font-medium text-foreground">
                  {suggestedAuctionBids.usdc !== null
                    ? `${formatTokenAmount(suggestedAuctionBids.usdc, "USDC")} USDC`
                    : "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-white/5 p-3">
              <p className="text-xs font-medium text-foreground">{t("Place bid", "Hacer oferta")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[130px_1fr_auto]">
                <select
                  className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                  value={auctionBidCurrency}
                  onChange={(event) => {
                    const nextCurrency = event.target.value as "AVAX" | "USDC";
                    setAuctionBidCurrency(nextCurrency);
                    const next =
                      nextCurrency === "AVAX"
                        ? formatTokenAmount(suggestedAuctionBids.avax, "AVAX")
                        : formatTokenAmount(suggestedAuctionBids.usdc, "USDC");
                    setAuctionBidAmount(next === "-" ? "" : next);
                  }}
                >
                  <option value="AVAX">AVAX</option>
                  <option value="USDC">USDC</option>
                </select>
                <input
                  className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                  value={auctionBidAmount}
                  onChange={(event) => setAuctionBidAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder={
                    auctionBidCurrency === "AVAX"
                      ? formatTokenAmount(suggestedAuctionBids.avax, "AVAX")
                      : formatTokenAmount(suggestedAuctionBids.usdc, "USDC")
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-400 text-black hover:bg-amber-300"
                  onClick={() => void submitAuctionBid(auctionBidCurrency, auctionBidAmount)}
                  disabled={busyAction === `bid:${auctionBidCurrency}`}
                >
                  {busyAction === `bid:${auctionBidCurrency}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("Bid", "Ofertar")}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-border bg-white/5 text-foreground hover:bg-white/10"
                  onClick={() =>
                    void submitAuctionBid(
                      "AVAX",
                      suggestedAuctionBids.avax !== null
                        ? formatTokenAmount(suggestedAuctionBids.avax, "AVAX")
                        : "",
                    )
                  }
                  disabled={busyAction === "bid:AVAX" || suggestedAuctionBids.avax === null}
                >
                  {busyAction === "bid:AVAX" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("Bid suggested AVAX", "Ofertar mínimo sugerido AVAX")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-border bg-white/5 text-foreground hover:bg-white/10"
                  onClick={() =>
                    void submitAuctionBid(
                      "USDC",
                      suggestedAuctionBids.usdc !== null
                        ? formatTokenAmount(suggestedAuctionBids.usdc, "USDC")
                        : "",
                    )
                  }
                  disabled={busyAction === "bid:USDC" || suggestedAuctionBids.usdc === null}
                >
                  {busyAction === "bid:USDC" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("Bid suggested USDC", "Ofertar mínimo sugerido USDC")}
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-white/5 p-3">
              <p className="text-xs font-medium text-foreground">{t("Previous bids", "Ofertas anteriores")}</p>
              <div className="mt-2 space-y-2">
                {activeAuction.recentBids.length > 0 ? (
                  activeAuction.recentBids.map((bid, index) => (
                    <div
                      key={`recent-bid-${index}-${bid.bidder}-${bid.amount}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white/5 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{walletShort(bid.bidder)}</p>
                        <p className="text-muted-foreground">{bid.currency === "Usdc" ? "USDC" : "AVAX"}</p>
                      </div>
                      <p className="shrink-0 font-medium text-foreground">
                        {formatTokenAmount(bid.amount, bid.currency === "Usdc" ? "USDC" : "AVAX")} {bid.currency === "Usdc" ? "USDC" : "AVAX"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{t("No previous bids found yet.", "Todavía no hay ofertas anteriores.")}</p>
                )}
              </div>
            </div>
          </article>
        ) : null}

        {openSwapListingsOfferingThis.length > 0 ? (
          <article className="rounded-2xl border border-border bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t("Swap listings (open offers)", "Intercambios (ofertas abiertas)")}
              </h3>
              <span className="rounded-full border border-sky-700/70 bg-sky-300 px-2 py-0.5 text-[11px] font-medium text-sky-950">
                {t("Swap", "Intercambio")}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {openSwapListingsOfferingThis.map((listing) => {
                const selected = swapBidTokenByListingId[String(listing.listingId)] || "";
                const availableOwnedNfts = ownedNfts.filter((nft) => nft.tokenId !== tokenId);
                return (
                  <div key={`swap-listing-${listing.listingId}`} className="rounded-xl border border-border bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {t("Swap listing", "Intercambio")} #{listing.listingId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {listing.creatorDisplayName} ({walletShort(listing.creatorWallet)})
                      </p>
                    </div>
                    {listing.intention ? (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {listing.intention}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("They are offering NFT", "Están ofreciendo el NFT")} #{listing.offeredTokenId}.
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select
                        className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground"
                        value={selected}
                        onChange={(event) =>
                          setSwapBidTokenByListingId((prev) => ({
                            ...prev,
                            [String(listing.listingId)]: event.target.value,
                          }))
                        }
                        disabled={!publicKey || ownedNftsLoading || listing.creatorWallet === publicKey}
                      >
                        <option value="">
                          {!publicKey
                            ? t("Connect wallet to offer an NFT", "Conectá la wallet para ofrecer un NFT")
                            : ownedNftsLoading
                              ? t("Loading your NFTs...", "Cargando tus NFTs...")
                              : t("Select one of your NFTs", "Elegí uno de tus NFTs")}
                        </option>
                        {availableOwnedNfts.map((nft) => (
                          <option key={`swap-offer-${listing.listingId}-${nft.tokenId}`} value={String(nft.tokenId)}>
                            #{nft.tokenId} · {nft.isCommissionEgg ? t("Commission Egg", "Huevo de comisión") : "NFT"}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-sky-400 text-sky-950 hover:bg-sky-300"
                        onClick={() => void submitSwapBid(listing.listingId)}
                        disabled={
                          busyAction === `swap-bid:${listing.listingId}` ||
                          !selected ||
                          listing.creatorWallet === publicKey
                        }
                      >
                        {busyAction === `swap-bid:${listing.listingId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {t("Offer my NFT", "Ofrecer mi NFT")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}

        {!activeListing && !activeAuction && openSwapListingsOfferingThis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/5 p-4 text-sm text-muted-foreground">
            {t(
              "No active buy/bid/swap action is currently available for this NFT.",
              "No hay acciones activas de compra/oferta/intercambio para este NFT en este momento.",
            )}
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-border bg-white/5 p-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}
    </section>
  );
}
