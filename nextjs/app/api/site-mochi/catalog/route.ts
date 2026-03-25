import { NextRequest, NextResponse } from "next/server";
import {
  getRuntimeCorePathsForDiagnostics,
  getRuntimeCoreSiteMochiCatalog,
} from "@/lib/site-mochi-runtime-core";
import { buildOwnedNftCharacterCatalog } from "@/lib/nft-character-catalog";
import { isValidWalletAddress } from "@/lib/artist-profiles-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const wallet = String(request.nextUrl.searchParams.get("wallet") || "").trim();
    const hasWalletCatalog = Boolean(wallet && isValidWalletAddress(wallet));
    const catalog = await getRuntimeCoreSiteMochiCatalog();
    let characters = [...catalog.characters];

    if (hasWalletCatalog) {
      const ownedCharacters = await buildOwnedNftCharacterCatalog(wallet);
      const merged = new Map(characters.map((entry) => [entry.key, entry]));
      ownedCharacters.forEach((entry) => {
      merged.set(entry.id, {
        key: entry.id,
        label: entry.name,
        iconUrl:
          entry.imageUrl ||
          `/sprites/${encodeURIComponent(entry.id)}/icon.png`,
        spritesBaseUri: entry.spritesBaseUri ?? null,
        availableSpriteFiles: [],
      });
      });
      characters = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    return NextResponse.json(
      {
        ...catalog,
        characters,
      },
      {
        headers: {
          "Cache-Control": hasWalletCatalog ? "no-store" : "public, max-age=300, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load runtime-core catalog";
    return NextResponse.json(
      {
        error: message,
        paths: getRuntimeCorePathsForDiagnostics(),
      },
      { status: 500 },
    );
  }
}
