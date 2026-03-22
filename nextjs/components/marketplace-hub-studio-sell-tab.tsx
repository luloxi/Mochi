"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, Gavel, ImageIcon, Loader2, Pause, Play, Tag, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HubTranslateFn, TokenPreview } from "@/components/marketplace-hub-shared";
import { formatMarketplaceTokenAmount, walletShort } from "@/components/marketplace-hub-shared";
import type { MarketplaceMyStudioResponse } from "@/lib/marketplace-hub-types";
import {
  ANIMATION_GUIDE_PATH,
  PREVIEW_ANIMATION_SETS,
  type PreviewAnimationKey,
  REQUIRED_MOCHI_SPRITES,
  findMissingRequiredSprites,
  normalizeSpriteFileName,
} from "@/lib/mochi-sprite-spec";

type ListAction = "fixed_price" | "auction" | "swap";
type MintMode = "unique" | "edition";
type MintListMode = "none" | "fixed_price" | "auction";

type CreateMintPackageRequest = {
  tokenUri: string;
  mode: MintMode;
  copies: number;
  listMode: MintListMode;
  listPrice?: string;
  listCurrency?: "Avax" | "Usdc";
  auctionPrice?: string;
  auctionCurrency?: "Avax" | "Usdc";
  auctionDurationHours?: string;
};

type Props = {
  t: HubTranslateFn;
  studio: MarketplaceMyStudioResponse;
  tokenPreviews: Record<string, TokenPreview>;
  txBusy: boolean;
  publicKey: string | null;
  showCreatePanel?: boolean;
  showTradePanel?: boolean;
  creatorStage?: "build" | "publish";
  onOpenPublishStage?: () => void;
  onBackToCreatorStage?: () => void;
  onCreateListing: (tokenId: number, price: string, currency: "Avax" | "Usdc") => void | Promise<void>;
  onCreateAuction: (tokenId: number, price: string, currency: "Avax" | "Usdc", durationHours: string) => void | Promise<void>;
  onCreateNftPackage: (request: CreateMintPackageRequest) => void | Promise<void>;
  onCancelListing: (listingId: number) => void | Promise<void>;
  onCreateSwapOffer: (tokenId: number, intention: string) => void | Promise<void>;
  onAcceptSwapBid: (listingId: number, bidId: number) => void | Promise<void>;
  onCancelSwapListing: (listingId: number) => void | Promise<void>;
  onCancelSwapBid: (bidId: number) => void | Promise<void>;
};

type RelativeFile = File & { webkitRelativePath?: string };

function parseAttributesText(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 64)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) return null;
      const trait_type = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!trait_type || !value) return null;
      return { trait_type, value };
    })
    .filter((entry): entry is { trait_type: string; value: string } => Boolean(entry));
}

function spriteRelativePath(file: File) {
  return ((file as RelativeFile).webkitRelativePath || file.name || "sprite.png").trim();
}

function buildNamedSpritePreviewMap(filesByName: Record<string, File>) {
  const previewMap: Record<string, string> = {};
  for (const [fileName, file] of Object.entries(filesByName)) {
    if (!fileName || previewMap[fileName]) continue;
    previewMap[fileName] = URL.createObjectURL(file);
  }
  return previewMap;
}

function buildNamedSpriteFileMap(folderFiles: File[], assignedFiles: Record<string, File>) {
  const namedFiles: Record<string, File> = {};
  for (const file of folderFiles) {
    const fileName = normalizeSpriteFileName(spriteRelativePath(file) || file.name);
    if (!fileName || namedFiles[fileName]) continue;
    namedFiles[fileName] = file;
  }
  return { ...namedFiles, ...assignedFiles };
}

function mergeSpriteFiles(existing: File[], incoming: File[]) {
  const byName = new Map<string, File>();
  for (const file of existing) {
    const fileName = normalizeSpriteFileName(spriteRelativePath(file) || file.name);
    if (!fileName) continue;
    byName.set(fileName, file);
  }
  for (const file of incoming) {
    const fileName = normalizeSpriteFileName(spriteRelativePath(file) || file.name);
    if (!fileName) continue;
    byName.set(fileName, file);
  }
  return Array.from(byName.values()).sort((a, b) => {
    const aName = normalizeSpriteFileName(spriteRelativePath(a) || a.name);
    const bName = normalizeSpriteFileName(spriteRelativePath(b) || b.name);
    return aName.localeCompare(bName);
  });
}

export function MarketplaceHubStudioSellTab({
  t,
  studio,
  tokenPreviews,
  txBusy,
  publicKey,
  showCreatePanel = true,
  showTradePanel = true,
  creatorStage = "build",
  onOpenPublishStage,
  onBackToCreatorStage,
  onCreateListing,
  onCreateAuction,
  onCreateNftPackage,
  onCancelListing,
  onCreateSwapOffer,
  onAcceptSwapBid,
  onCancelSwapListing,
  onCancelSwapBid,
}: Props) {
  const selectClassName =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";
  const selectStyle = { backgroundColor: "var(--card)", color: "var(--foreground)" } as const;
  const selectOptionClassName = "bg-popover text-popover-foreground";
  const selectOptionStyle = { backgroundColor: "var(--popover)", color: "var(--popover-foreground)" } as const;

  const [listAction, setListAction] = useState<ListAction>("fixed_price");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [swapOfferedTokenId, setSwapOfferedTokenId] = useState("");
  const [swapIntention, setSwapIntention] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingCurrency, setListingCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [auctionPrice, setAuctionPrice] = useState("");
  const [auctionCurrency, setAuctionCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [auctionDurationHours, setAuctionDurationHours] = useState("24");
  const [swapActionBusyId, setSwapActionBusyId] = useState<string | null>(null);

  const [mintTitle, setMintTitle] = useState("");
  const [mintDescription, setMintDescription] = useState("");
  const [mintAttributesText, setMintAttributesText] = useState("");
  const [mintMode, setMintMode] = useState<MintMode>("unique");
  const [mintCopies, setMintCopies] = useState("5");
  const [mintListMode, setMintListMode] = useState<MintListMode>("fixed_price");
  const [mintListPrice, setMintListPrice] = useState("");
  const [mintListCurrency, setMintListCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [mintAuctionPrice, setMintAuctionPrice] = useState("");
  const [mintAuctionCurrency, setMintAuctionCurrency] = useState<"Avax" | "Usdc">("Usdc");
  const [mintAuctionDurationHours, setMintAuctionDurationHours] = useState("24");
  const [mintCoverImage, setMintCoverImage] = useState<File | null>(null);
  const [mintCoverPreviewUrl, setMintCoverPreviewUrl] = useState<string | null>(null);
  const [mintSpriteFiles, setMintSpriteFiles] = useState<File[]>([]);
  const [mintAssignedSpriteFiles, setMintAssignedSpriteFiles] = useState<Record<string, File>>({});
  const [mintSpritePreviewMap, setMintSpritePreviewMap] = useState<Record<string, string>>({});
  const [previewAnimation, setPreviewAnimation] = useState<PreviewAnimationKey>("walk");
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [dragTargetSpriteName, setDragTargetSpriteName] = useState<string | null>(null);
  const [mintUploadBusy, setMintUploadBusy] = useState(false);
  const [mintFormError, setMintFormError] = useState("");
  const spriteFolderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = spriteFolderInputRef.current as (HTMLInputElement & { webkitdirectory?: boolean; directory?: boolean }) | null;
    if (!input) return;
    input.webkitdirectory = true;
    input.directory = true;
  }, []);

  useEffect(() => {
    if (!mintCoverImage) {
      setMintCoverPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(mintCoverImage);
    setMintCoverPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mintCoverImage]);

  useEffect(() => {
    const nextPreviewMap = buildNamedSpritePreviewMap(buildNamedSpriteFileMap(mintSpriteFiles, mintAssignedSpriteFiles));
    setMintSpritePreviewMap(nextPreviewMap);
    return () => {
      Object.values(nextPreviewMap).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mintAssignedSpriteFiles, mintSpriteFiles]);

  useEffect(() => {
    setPreviewFrameIndex(0);
  }, [previewAnimation, mintSpriteFiles.length, Object.keys(mintAssignedSpriteFiles).length]);

  useEffect(() => {
    if (previewPaused) return;
    const frames = PREVIEW_ANIMATION_SETS[previewAnimation];
    if (frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setPreviewFrameIndex((current) => (current + 1) % frames.length);
    }, 420);
    return () => window.clearInterval(timer);
  }, [previewAnimation, previewPaused]);

  const regularNfts = studio.ownedNfts.filter((n) => !n.isCommissionEgg);
  const allNfts = studio.ownedNfts;
  const activeListings = studio.myListings.filter((l) => l.active && !l.isCommissionEgg);
  const mySwapListings = studio.mySwapListings.filter((l) => l.active);
  const incomingBids = studio.incomingSwapBidsForMyListings.filter((b) => b.active);
  const outgoingBids = studio.myOutgoingSwapBids.filter((b) => b.active);

  const nftsForAction = listAction === "swap" ? allNfts : regularNfts;
  const currentSelectedId = listAction === "swap" ? swapOfferedTokenId : selectedTokenId;
  const namedMintSpriteFiles = buildNamedSpriteFileMap(mintSpriteFiles, mintAssignedSpriteFiles);
  const spritePaths = Object.keys(namedMintSpriteFiles);
  const missingRequiredSprites = findMissingRequiredSprites(spritePaths);
  const hasRequiredSpriteSet = missingRequiredSprites.length === 0;
  const uploadedSpritesCount = spritePaths.length;
  const loadedRequiredSpritesCount = REQUIRED_MOCHI_SPRITES.length - missingRequiredSprites.length;
  const previewFrames = PREVIEW_ANIMATION_SETS[previewAnimation];
  const activePreviewFrameSequenceIndex = previewFrameIndex % previewFrames.length;
  const activePreviewSpriteName = previewFrames[activePreviewFrameSequenceIndex];
  const activePreviewSpriteUrl = mintSpritePreviewMap[activePreviewSpriteName] || null;
  const creatorReadyForUpload =
    Boolean(mintTitle.trim()) &&
    Boolean(mintDescription.trim()) &&
    Boolean(mintCoverImage) &&
    hasRequiredSpriteSet;
  const isCreatorBuildStage = creatorStage === "build";
  const isCreatorPublishStage = creatorStage === "publish";

  function handleNftClick(tokenId: string) {
    if (listAction === "swap") {
      setSwapOfferedTokenId(tokenId);
    } else {
      setSelectedTokenId(tokenId);
    }
  }

  function assignSpriteFile(targetFileName: string, selected: File | null | undefined) {
    if (!selected) return;
    setMintAssignedSpriteFiles((current) => ({
      ...current,
      [targetFileName]: selected,
    }));
  }

  function handleSpriteTileDrop(fileName: string, event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragTargetSpriteName((current) => (current === fileName ? null : current));
    const droppedFile = Array.from(event.dataTransfer.files || []).find((file) => file.type.startsWith("image/"));
    assignSpriteFile(fileName, droppedFile);
  }

  function handleSubmit() {
    if (listAction === "fixed_price") {
      const tokenId = Number.parseInt(selectedTokenId, 10);
      if (!Number.isFinite(tokenId)) return;
      void onCreateListing(tokenId, listingPrice, listingCurrency);
    } else if (listAction === "auction") {
      const tokenId = Number.parseInt(selectedTokenId, 10);
      if (!Number.isFinite(tokenId)) return;
      void onCreateAuction(tokenId, auctionPrice, auctionCurrency, auctionDurationHours);
    } else {
      const tokenId = Number.parseInt(swapOfferedTokenId, 10);
      if (!Number.isFinite(tokenId)) return;
      void onCreateSwapOffer(tokenId, swapIntention.trim());
    }
  }

  async function handleCreateMintPackage() {
    setMintFormError("");
    if (!publicKey) {
      setMintFormError(t("Connect your wallet first.", "Conectá tu wallet primero."));
      return;
    }
    if (!mintCoverImage) {
      setMintFormError(t("Select a cover image.", "Seleccioná una imagen de portada."));
      return;
    }
    if (!mintTitle.trim()) {
      setMintFormError(t("Title is required.", "El título es obligatorio."));
      return;
    }
    if (!mintDescription.trim()) {
      setMintFormError(t("Description is required.", "La descripción es obligatoria."));
      return;
    }
    if (spritePaths.length === 0) {
      setMintFormError(
        t(
          "Sprite files are required for animated Mochi NFTs.",
          "Los archivos de sprites son obligatorios para NFTs Mochi animados.",
        ),
      );
      return;
    }
    if (!hasRequiredSpriteSet) {
      setMintFormError(
        t(
          `Missing required sprites: ${missingRequiredSprites.join(", ")}`,
          `Faltan sprites requeridos: ${missingRequiredSprites.join(", ")}`,
        ),
      );
      return;
    }

    const mode: MintMode = mintMode;
    const parsedCopies = Math.max(1, Number.parseInt(mintCopies || "1", 10) || 1);
    const copies = mode === "unique" ? 1 : Math.min(parsedCopies, 50);

    if (mintListMode === "fixed_price" && !mintListPrice.trim()) {
      setMintFormError(t("Set a fixed listing price.", "Definí un precio fijo para publicar."));
      return;
    }
    if (mintListMode === "auction" && !mintAuctionPrice.trim()) {
      setMintFormError(t("Set auction start price.", "Definí precio inicial de subasta."));
      return;
    }
    if (mintListMode === "auction" && !studio.auctionCapability.itemAuctionsAvailable) {
      setMintFormError(studio.auctionCapability.reason);
      return;
    }

    setMintUploadBusy(true);
    try {
      const attributes = parseAttributesText(mintAttributesText);
      const formData = new FormData();
      formData.append("title", mintTitle.trim());
      formData.append("description", mintDescription.trim());
      formData.append("mode", mode);
      formData.append("copies", String(copies));
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("coverImage", mintCoverImage);

      for (const [targetFileName, file] of Object.entries(namedMintSpriteFiles)) {
        formData.append("spriteFiles", file, targetFileName);
        formData.append("spritePaths", targetFileName);
      }

      const response = await fetch("/api/marketplace/mint-package", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; tokenUri?: string };
      if (!response.ok || !payload.tokenUri) {
        throw new Error(payload.error || "Failed to upload NFT package.");
      }

      await onCreateNftPackage({
        tokenUri: payload.tokenUri,
        mode,
        copies,
        listMode: mintListMode,
        listPrice: mintListPrice,
        listCurrency: mintListCurrency,
        auctionPrice: mintAuctionPrice,
        auctionCurrency: mintAuctionCurrency,
        auctionDurationHours: mintAuctionDurationHours,
      });

      setMintTitle("");
      setMintDescription("");
      setMintAttributesText("");
      setMintMode("unique");
      setMintCopies("5");
      setMintListMode("fixed_price");
      setMintListPrice("");
      setMintListCurrency("Usdc");
      setMintAuctionPrice("");
      setMintAuctionCurrency("Usdc");
      setMintAuctionDurationHours("24");
      setMintCoverImage(null);
      setMintSpriteFiles([]);
      setMintAssignedSpriteFiles({});
    } catch (error) {
      setMintFormError(error instanceof Error ? error.message : "Failed to create NFT package.");
    } finally {
      setMintUploadBusy(false);
    }
  }

  async function handleAcceptSwapBid(listingId: number, bidId: number) {
    setSwapActionBusyId(`accept-bid:${bidId}`);
    try {
      await onAcceptSwapBid(listingId, bidId);
    } finally {
      setSwapActionBusyId(null);
    }
  }

  async function handleCancelSwapListingLocal(listingId: number) {
    setSwapActionBusyId(`cancel-listing:${listingId}`);
    try {
      await onCancelSwapListing(listingId);
    } finally {
      setSwapActionBusyId(null);
    }
  }

  async function handleCancelSwapBidLocal(bidId: number) {
    setSwapActionBusyId(`cancel-bid:${bidId}`);
    try {
      await onCancelSwapBid(bidId);
    } finally {
      setSwapActionBusyId(null);
    }
  }

  return (
    <div className="site-window-skin config-contrast-panel space-y-1">
      {showCreatePanel ? (
        <div id="create-character-app" className="scroll-mt-28 space-y-1">
          {isCreatorBuildStage ? (
          <div className="space-y-1">
            <div className="neural-card rounded-2xl border border-cyan-300/15 p-1">
              <div className="grid items-center gap-1 lg:grid-cols-[120px_minmax(0,1fr)_220px]">
                <div className="flex h-full flex-col justify-start gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPaused((p) => !p)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                      title={previewPaused ? t("Play", "Reproducir") : t("Pause", "Pausar")}
                    >
                      {previewPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </button>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-700 bg-emerald-600 px-2.5 py-1 shadow-sm">
                      {previewPaused ? (
                        <>
                          <Pause className="h-2.5 w-2.5 text-white" />
                          <span className="text-[10px] font-semibold text-white">{t("paused", "pausado")}</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white">live</span>
                        </>
                      )}
                    </div>
                  </div>
                  <select
                    value={previewAnimation}
                    onChange={(e) => setPreviewAnimation(e.target.value as PreviewAnimationKey)}
                    className={selectClassName}
                    style={selectStyle}
                  >
                    <option className={selectOptionClassName} style={selectOptionStyle} value="walk">{t("Walk", "Caminar")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="jump">{t("Jump", "Saltar")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="drag">{t("Drag", "Arrastrar")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="wall">{t("Wall", "Pared")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="ceiling">{t("Ceiling", "Techo")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="idle">{t("Idle", "Idle")}</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="usingComputer">{t("Using computer", "Usando la PC")}</option>
                  </select>
                </div>
                <div className="relative flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <img
                    src={activePreviewSpriteUrl ?? `/mochi-original/${activePreviewSpriteName}`}
                    alt={activePreviewSpriteName}
                    className="h-40 w-40 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.3)]"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.src.endsWith("/mochi-original/stand-neutral.png")) {
                        img.src = "/mochi-original/stand-neutral.png";
                      }
                    }}
                  />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {activePreviewSpriteName.replace(".png", "").replace(/-/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="flex max-h-[320px] flex-col gap-2 overflow-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="creator-frame-section-title mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("Upload frames for this animation", "Subir frames de esta animación")}
                  </p>
                  {Array.from(new Set(previewFrames)).map((fileName) => {
                    const loaded = Boolean(mintSpritePreviewMap[fileName]);
                    const previewUrl = mintSpritePreviewMap[fileName];
                    const label = fileName.replace(".png", "").replace(/-/g, " ");
                    const isDragTarget = dragTargetSpriteName === fileName;
                    const isActiveFrame = fileName === activePreviewSpriteName;
                    return (
                      <label
                        key={`anim-upload-${fileName}`}
                        className={`creator-frame-upload-item flex cursor-pointer items-center gap-2 rounded-xl border-2 p-2 text-left transition-all ${
                          isDragTarget
                            ? "creator-frame-upload-item-active scale-[1.02]"
                            : ""
                        } ${
                          isActiveFrame
                            ? "border-cyan-300/45 bg-cyan-400/[0.16] shadow-[0_0_0_1px_rgba(103,232,249,0.16)]"
                            : loaded
                              ? "border-emerald-300/35 bg-emerald-400/[0.08] hover:bg-emerald-400/12"
                              : "border-amber-300/35 bg-amber-400/[0.06] hover:bg-amber-400/12"
                        }`}
                        onDragEnter={() => setDragTargetSpriteName(fileName)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (dragTargetSpriteName !== fileName) setDragTargetSpriteName(fileName);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setDragTargetSpriteName((current) => (current === fileName ? null : current));
                          }
                        }}
                        onDrop={(event) => handleSpriteTileDrop(fileName, event)}
                      >
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                          {previewUrl ? (
                            <img src={previewUrl} alt={fileName} className="h-full w-full object-contain" />
                          ) : (
                            <ImageIcon className="h-5 w-5 opacity-20" />
                          )}
                          {loaded && (
                            <div className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
                              <Check className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`creator-frame-upload-label line-clamp-2 block text-[10px] capitalize leading-tight ${
                            isActiveFrame
                              ? "text-cyan-100"
                              : loaded
                                ? "text-foreground/70"
                                : "text-amber-200/60"
                          }`}>
                            {label}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            assignSpriteFile(fileName, event.target.files?.[0]);
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="neural-card rounded-2xl border border-cyan-300/15 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("Sprites", "Sprites")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-foreground">
                      {t(`Required ${loadedRequiredSpritesCount}/${REQUIRED_MOCHI_SPRITES.length}`, `Requeridos ${loadedRequiredSpritesCount}/${REQUIRED_MOCHI_SPRITES.length}`)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className={`inline-flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      mintSpriteFiles.length > 0
                        ? "border-cyan-300/30 bg-cyan-400/10 text-foreground hover:bg-cyan-400/15"
                        : "border-border bg-white/5 text-muted-foreground hover:border-white/20 hover:bg-white/10"
                    }`}>
                      <Upload className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        {mintSpriteFiles.length > 0
                          ? t("Import more sprites", "Importar más sprites")
                          : t("Import sprite folder", "Importar carpeta de sprites")}
                      </span>
                      <input
                        ref={spriteFolderInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          setMintSpriteFiles((current) => mergeSpriteFiles(current, Array.from(event.target.files || [])));
                        }}
                      />
                    </label>
                    <div className="text-xs text-muted-foreground">
                      {t("Need the ZIP or sprite names?", "¿Necesitás el ZIP o los nombres?")}{" "}
                      <Link href={ANIMATION_GUIDE_PATH} className="text-foreground underline underline-offset-4">
                        {t("Open animation guide", "Abrir guía de animación")}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    title={
                      hasRequiredSpriteSet
                        ? ""
                        : t(
                            "All sprites must be loaded before publishing.",
                            "Deben estar todos los sprites cargados para poder publicarlo.",
                          )
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasRequiredSpriteSet) return;
                        onOpenPublishStage?.();
                      }}
                      disabled={!hasRequiredSpriteSet}
                      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        hasRequiredSpriteSet
                          ? "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                          : "cursor-not-allowed border-white/10 bg-white/[0.03] text-muted-foreground/60"
                      }`}
                    >
                      {t("Go to publish", "Ir a publicar")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${hasRequiredSpriteSet ? "bg-emerald-400" : "bg-amber-400"}`}
                  style={{ width: `${(loadedRequiredSpritesCount / REQUIRED_MOCHI_SPRITES.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          ) : null}

          {isCreatorPublishStage ? (
          <div className="mt-2 border-t border-white/10 pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("Publish character", "Publicar personaje")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Complete metadata and sale settings, or go back to keep editing sprites.", "Completá metadatos y venta, o volvé atrás para seguir editando sprites.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBackToCreatorStage?.()}
                className="rounded-none border border-border bg-background/60 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground hover:bg-background/80"
              >
                {t("Back", "Atrás")}
              </button>
            </div>
            <div className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
              <div className="space-y-4">
                <div className="neural-card rounded-2xl border border-white/10 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("Cover image", "Imagen de portada")}
                  </p>
                  <label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm transition-all ${
                    mintCoverImage
                      ? "border-emerald-300/30 bg-emerald-400/10 text-foreground hover:bg-emerald-400/15"
                      : "border-border bg-white/5 text-muted-foreground hover:border-white/20 hover:bg-white/10"
                  }`}>
                    {mintCoverImage ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <Upload className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">
                      {mintCoverImage ? mintCoverImage.name : t("Choose cover image", "Elegir imagen de portada")}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setMintCoverImage(file);
                    }} />
                  </label>
                  {mintCoverPreviewUrl ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white/5">
                      <img src={mintCoverPreviewUrl} alt="cover preview" className="max-h-48 w-full object-cover" />
                    </div>
                  ) : (
                    <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-muted-foreground/40">
                      {t("Preview will appear here", "El preview aparecerá acá")}
                    </div>
                  )}
                </div>

                <div className="neural-card rounded-2xl border border-white/10 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("Metadata", "Metadatos")}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Title", "Título")}</label>
                      <input
                        type="text"
                        value={mintTitle}
                        onChange={(e) => setMintTitle(e.target.value)}
                        placeholder={t("My New Mochi", "Mi nuevo Mochi")}
                        maxLength={120}
                        className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Mode", "Modo")}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMintMode("unique")}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            mintMode === "unique"
                              ? "border-emerald-300/35 bg-emerald-400/15 text-foreground"
                              : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                          }`}
                        >
                          {t("Unique 1/1", "Único 1/1")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMintMode("edition")}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            mintMode === "edition"
                              ? "border-blue-300/35 bg-blue-400/15 text-foreground"
                              : "border-border bg-white/5 text-muted-foreground hover:bg-white/10"
                          }`}
                        >
                          {t("Edition", "Edición")}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Description", "Descripción")}</label>
                    <textarea
                      value={mintDescription}
                      onChange={(e) => setMintDescription(e.target.value)}
                      placeholder={t("Describe this Mochi and style details.", "Describe este Mochi y detalles del estilo.")}
                      maxLength={4000}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                    />
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("Attributes (trait:value, one per line)", "Atributos (rasgo:valor, una línea por atributo)")}
                    </label>
                    <textarea
                      value={mintAttributesText}
                      onChange={(e) => setMintAttributesText(e.target.value)}
                      placeholder={t("Style:Pixel\nMood:Playful\nRig:Desktop", "Estilo:Pixel\nMood:Juguetón\nRig:Desktop")}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                    />
                  </div>
                  {mintMode === "edition" ? (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Number of copies (max 50)", "Número de copias (máx 50)")}</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={mintCopies}
                        onChange={(e) => setMintCopies(e.target.value)}
                        className="w-32 rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                  <div className="neural-card rounded-2xl border border-white/10 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {t("After minting", "Después de mintear")}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Action", "Acción")}</label>
                        <select
                          value={mintListMode}
                          onChange={(e) => setMintListMode(e.target.value as MintListMode)}
                          className={selectClassName}
                          style={selectStyle}
                        >
                          <option className={selectOptionClassName} style={selectOptionStyle} value="fixed_price">{t("Auto-list fixed price", "Publicar a precio fijo")}</option>
                          <option className={selectOptionClassName} style={selectOptionStyle} value="auction">{t("Auto-start auction", "Iniciar subasta")}</option>
                          <option className={selectOptionClassName} style={selectOptionStyle} value="none">{t("Mint only", "Solo mintear")}</option>
                        </select>
                      </div>
                      {mintListMode === "fixed_price" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Price", "Precio")}</label>
                            <input type="number" value={mintListPrice} onChange={(e) => setMintListPrice(e.target.value)} min="0" placeholder="0"
                              className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/30" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Currency", "Moneda")}</label>
                            <select value={mintListCurrency} onChange={(e) => setMintListCurrency(e.target.value as "Avax" | "Usdc")} className={selectClassName} style={selectStyle}>
                              <option className={selectOptionClassName} style={selectOptionStyle} value="Avax">AVAX</option>
                              <option className={selectOptionClassName} style={selectOptionStyle} value="Usdc">USDC</option>
                            </select>
                          </div>
                        </div>
                      ) : null}
                      {mintListMode === "auction" ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Start price", "Precio inicial")}</label>
                              <input type="number" value={mintAuctionPrice} onChange={(e) => setMintAuctionPrice(e.target.value)} min="0" placeholder="0"
                                className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/30" />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Currency", "Moneda")}</label>
                              <select value={mintAuctionCurrency} onChange={(e) => setMintAuctionCurrency(e.target.value as "Avax" | "Usdc")} className={selectClassName} style={selectStyle}>
                                <option className={selectOptionClassName} style={selectOptionStyle} value="Avax">AVAX</option>
                                <option className={selectOptionClassName} style={selectOptionStyle} value="Usdc">USDC</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("Duration (hours)", "Duración (horas)")}</label>
                            <input type="number" value={mintAuctionDurationHours} onChange={(e) => setMintAuctionDurationHours(e.target.value)} min="1" placeholder="24"
                              className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/30" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                <div className="neural-card rounded-2xl border border-white/10 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("Ready to mint?", "¿Listo para mintear?")}
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: t("Sprites complete", "Sprites completos"), ok: hasRequiredSpriteSet },
                      { label: t("Cover image", "Imagen de portada"), ok: Boolean(mintCoverImage) },
                      { label: t("Title", "Título"), ok: Boolean(mintTitle.trim()) },
                      { label: t("Description", "Descripción"), ok: Boolean(mintDescription.trim()) },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2.5 text-xs">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-emerald-400/20" : "border border-white/15 bg-white/[0.04]"}`}>
                          {ok ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : null}
                        </span>
                        <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                      </div>
                    ))}
                  </div>

                  {mintFormError ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2.5 text-xs text-foreground">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                      {mintFormError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleCreateMintPackage()}
                    disabled={txBusy || mintUploadBusy || !creatorReadyForUpload}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-emerald-400/50 hover:bg-emerald-400/25 hover:shadow-[0_0_20px_rgba(52,211,153,0.15)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {txBusy || mintUploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {txBusy || mintUploadBusy
                      ? t("Uploading & minting...", "Subiendo y minteando...")
                      : t("Upload to IPFS & Mint", "Subir a IPFS y mintear")}
                  </button>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      {showTradePanel ? (
        <>
          <div className="rounded-2xl border border-border bg-white/5 p-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setListAction("fixed_price")}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${
              listAction === "fixed_price"
                ? "border-emerald-300/30 bg-emerald-400/15 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-white/5"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            {t("Fixed Price", "Precio fijo")}
          </button>
          <button
            type="button"
            onClick={() => setListAction("auction")}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${
              listAction === "auction"
                ? "border-amber-300/30 bg-amber-400/15 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-white/5"
            }`}
          >
            <Gavel className="h-3.5 w-3.5" />
            {t("Auction", "Subasta")}
          </button>
          <button
            type="button"
            onClick={() => setListAction("swap")}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${
              listAction === "swap"
                ? "border-blue-300/30 bg-blue-400/15 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-white/5"
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {t("Swap", "Swap")}
          </button>
        </div>

        {listAction === "auction" && !studio.auctionCapability.itemAuctionsAvailable ? (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs text-foreground">
            {studio.auctionCapability.reason}
          </div>
        ) : null}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-foreground">
            {listAction === "swap"
              ? t("Select the NFT you want to offer", "Selecciona el NFT que quieres ofrecer")
              : t("Select an NFT to list", "Selecciona un NFT para publicar")}
          </p>
          {nftsForAction.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white/5 p-4 text-center text-xs text-muted-foreground">
              {t("No eligible NFTs found.", "No se encontraron NFTs elegibles.")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {nftsForAction.map((token) => {
                const preview = token.tokenUri ? tokenPreviews[token.tokenUri] : null;
                const isSelected = currentSelectedId === String(token.tokenId);
                const isListed = studio.myListings.some((l) => l.active && l.tokenId === token.tokenId);
                return (
                  <button
                    key={`sell-nft-${token.tokenId}`}
                    type="button"
                    onClick={() => handleNftClick(String(token.tokenId))}
                    className={`group relative overflow-hidden rounded-xl border transition ${
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-400/10 ring-1 ring-emerald-400/30"
                        : "border-border bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-white/[0.04]">
                      {preview?.imageUrl ? (
                        <img
                          src={preview.imageUrl}
                          alt={preview.name || `#${token.tokenId}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      {isSelected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-emerald-400/20">
                          <Check className="h-5 w-5 text-emerald-400" />
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
          )}
        </div>

        <div className="mt-4 space-y-3">
          {listAction === "fixed_price" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("Price", "Precio")}</label>
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("Currency", "Moneda")}</label>
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
          ) : listAction === "auction" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("Start price", "Precio inicial")}</label>
                  <input
                    type="number"
                    value={auctionPrice}
                    onChange={(e) => setAuctionPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("Currency", "Moneda")}</label>
                  <select
                    value={auctionCurrency}
                    onChange={(e) => setAuctionCurrency(e.target.value as "Avax" | "Usdc")}
                    className={selectClassName}
                    style={selectStyle}
                  >
                    <option className={selectOptionClassName} style={selectOptionStyle} value="Avax">AVAX</option>
                    <option className={selectOptionClassName} style={selectOptionStyle} value="Usdc">USDC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("Duration (hours)", "Duración (horas)")}</label>
                <input
                  type="number"
                  value={auctionDurationHours}
                  onChange={(e) => setAuctionDurationHours(e.target.value)}
                  placeholder="24"
                  min="1"
                  className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("What are you looking for? (swap message)", "¿Qué buscas? (mensaje del swap)")}
              </label>
              <input
                type="text"
                value={swapIntention}
                onChange={(e) => setSwapIntention(e.target.value)}
                placeholder={t("e.g. Looking for pixel art NFTs", "ej. Busco NFTs de pixel art")}
                maxLength={200}
                className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={txBusy}
            className={`w-full ${
              listAction === "fixed_price"
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : listAction === "auction"
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-blue-500 text-foreground hover:bg-blue-400"
            }`}
          >
            {txBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {listAction === "fixed_price"
              ? t("List for sale", "Publicar en venta")
              : listAction === "auction"
                ? t("Start auction", "Iniciar subasta")
                : t("Offer for swap", "Ofrecer para swap")}
          </Button>
        </div>
          </div>

          {activeListings.length > 0 ? (
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t("Active listings", "Publicaciones activas")}</h3>
              <div className="space-y-2">
                {activeListings.map((listing) => {
                  const preview = listing.tokenUri ? tokenPreviews[listing.tokenUri] : null;
                  return (
                    <div
                      key={`active-listing-${listing.listingId}`}
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

          {mySwapListings.length > 0 || incomingBids.length > 0 || outgoingBids.length > 0 ? (
            <div className="rounded-2xl border border-border bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t("Swap activity", "Actividad de swaps")}</h3>

          {mySwapListings.length > 0 ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("My swap offers", "Mis ofertas de swap")}</p>
              <div className="space-y-2">
                {mySwapListings.map((listing) => (
                  <div
                    key={`my-swap-${listing.swapListingId}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white/5 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {t("Token", "Token")} #{listing.offeredTokenId}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{listing.intention}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {listing.bidCount} {t("bids", "propuestas")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-400/30 bg-rose-500/10 text-foreground hover:bg-rose-500/20"
                      onClick={() => void handleCancelSwapListingLocal(listing.swapListingId)}
                      disabled={swapActionBusyId === `cancel-listing:${listing.swapListingId}`}
                    >
                      {swapActionBusyId === `cancel-listing:${listing.swapListingId}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {t("Cancel", "Cancelar")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {incomingBids.length > 0 ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("Incoming bids on my listings", "Propuestas recibidas")}
              </p>
              <div className="space-y-2">
                {incomingBids.map((bid) => (
                  <div
                    key={`incoming-bid-${bid.bidId}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white/5 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {walletShort(bid.bidder)} → #{bid.bidderTokenId}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{bid.listingIntention}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-emerald-500 text-black hover:bg-emerald-400"
                      onClick={() => void handleAcceptSwapBid(bid.listingId, bid.bidId)}
                      disabled={swapActionBusyId === `accept-bid:${bid.bidId}`}
                    >
                      {swapActionBusyId === `accept-bid:${bid.bidId}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {t("Accept", "Aceptar")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {outgoingBids.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("My outgoing swap bids", "Mis propuestas enviadas")}</p>
              <div className="space-y-2">
                {outgoingBids.map((bid) => (
                  <div
                    key={`outgoing-bid-${bid.bidId}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white/5 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        #{bid.bidderTokenId} → {walletShort(bid.listingCreator)} #{bid.listingOfferedTokenId}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{bid.listingIntention}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-400/30 bg-rose-500/10 text-foreground hover:bg-rose-500/20"
                      onClick={() => void handleCancelSwapBidLocal(bid.bidId)}
                      disabled={swapActionBusyId === `cancel-bid:${bid.bidId}`}
                    >
                      {swapActionBusyId === `cancel-bid:${bid.bidId}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {t("Cancel bid", "Cancelar propuesta")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
