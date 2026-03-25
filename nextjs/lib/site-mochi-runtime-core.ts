import "server-only";

import { readFile, readdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { normalizeSpriteFileName } from "@/lib/mochi-sprite-spec";

export const SITE_MOCHI_FREE_MESSAGE_LIMIT = 4;

export type RuntimeCoreCharacterCatalogEntry = {
  key: string;
  label: string;
  iconUrl: string;
  spritesBaseUri?: string | null;
  availableSpriteFiles: string[];
};

export type RuntimeCorePersonalityCatalogEntry = {
  key: string;
  label: string;
  prompt: string;
};

export type RuntimeCoreSiteMochiCatalog = {
  characters: RuntimeCoreCharacterCatalogEntry[];
  personalities: RuntimeCorePersonalityCatalogEntry[];
  freeSiteMessageLimit: number;
};

type RuntimeCorePersonalityIndexEntry = {
  key: string;
  file: string;
  label: string;
};

const VENDORED_RUNTIME_CORE_ROOT = path.resolve(process.cwd(), "runtime-core");
const REPO_RUNTIME_CORE_ROOT = path.resolve(process.cwd(), "..", "..", "runtime-core");
const RUNTIME_CORE_ROOT = fs.existsSync(VENDORED_RUNTIME_CORE_ROOT)
  ? VENDORED_RUNTIME_CORE_ROOT
  : REPO_RUNTIME_CORE_ROOT;
const RUNTIME_CORE_CHARACTERS_DIR = path.join(RUNTIME_CORE_ROOT, "characters");
const RUNTIME_CORE_PERSONALITIES_DIR = path.join(RUNTIME_CORE_ROOT, "personalities");

const SAFE_SEGMENT_RE = /^[a-z0-9_-]+$/i;
const SAFE_FILE_RE = /^[a-z0-9._-]+$/i;
const NFT_GATED_CHARACTER_KEYS = new Set(["bunny", "lobster", "egg", "mushroom"]);

const ALLOWED_SITE_SPRITE_FILES = new Set([
  "icon.png",
  "stand-neutral.png",
  "walk-step-left.png",
  "walk-step-right.png",
  "fall.png",
  "bounce-squish.png",
  "bounce-recover.png",
  "jump.png",
  "dragged-tilt-left-light.png",
  "dragged-tilt-right-light.png",
  "dragged-tilt-left-heavy.png",
  "dragged-tilt-right-heavy.png",
  "resist-frame-1.png",
  "resist-frame-2.png",
  "grab-wall.png",
  "climb-wall-frame-1.png",
  "climb-wall-frame-2.png",
  "grab-ceiling.png",
  "climb-ceiling-frame-1.png",
  "climb-ceiling-frame-2.png",
  "sit.png",
  "sit-look-up.png",
  "sprawl-lying.png",
  "crawl-crouch.png",
  "sit-edge-legs-up.png",
  "sit-edge-legs-down.png",
  "sit-edge-dangle-frame-1.png",
  "sit-edge-dangle-frame-2.png",
  "sit-pc-edge-legs-down.png",
  "sit-pc-edge-dangle-frame-1.png",
  "sit-pc-edge-dangle-frame-2.png",
  "spin-head-frame-1.png",
  "spin-head-frame-2.png",
  "spin-head-frame-3.png",
  "spin-head-frame-4.png",
  "spin-head-frame-5.png",
  "spin-head-frame-6.png",
]);

let catalogCache: Promise<RuntimeCoreSiteMochiCatalog> | null = null;

function normalizeLabelFromKey(key: string): string {
  return key
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) return normalized.trim();
  const match = normalized.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match?.[1] ?? normalized).trim();
}

function assertSafeSegment(segment: string, label: string) {
  if (!SAFE_SEGMENT_RE.test(segment)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertSafeFileName(fileName: string) {
  if (!SAFE_FILE_RE.test(fileName) || !ALLOWED_SITE_SPRITE_FILES.has(fileName)) {
    throw new Error("Invalid sprite file");
  }
}

async function loadCharacters(): Promise<RuntimeCoreCharacterCatalogEntry[]> {
  const dirEntries = await readdir(RUNTIME_CORE_CHARACTERS_DIR, { withFileTypes: true });
  const candidateKeys = dirEntries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        SAFE_SEGMENT_RE.test(entry.name) &&
        !NFT_GATED_CHARACTER_KEYS.has(entry.name),
    )
    .map((entry) => entry.name);

  const characters = await Promise.all(
    candidateKeys.map(async (key) => {
      let availableSpriteFiles: string[] = [];
      try {
        const snapshotFiles = await readdir(path.join(RUNTIME_CORE_CHARACTERS_DIR, key));
        const normalized = snapshotFiles
          .map((fileName) => normalizeSpriteFileName(fileName))
          .filter((fileName) => fileName && ALLOWED_SITE_SPRITE_FILES.has(fileName));
        availableSpriteFiles = Array.from(new Set(normalized)).sort();
      } catch (error) {
        availableSpriteFiles = [];
      }
      return {
        key,
        label: normalizeLabelFromKey(key),
        iconUrl: `/sprites/${encodeURIComponent(key)}/icon.png`,
        spritesBaseUri: null,
        availableSpriteFiles,
      };
    }),
  );

  return characters.sort((a, b) => a.label.localeCompare(b.label));
}

async function loadPersonalities(): Promise<RuntimeCorePersonalityCatalogEntry[]> {
  const indexPath = path.join(RUNTIME_CORE_PERSONALITIES_DIR, "index.json");
  const rawIndex = await readFile(indexPath, "utf8");
  const parsed = JSON.parse(rawIndex) as RuntimeCorePersonalityIndexEntry[];
  const validEntries = Array.isArray(parsed)
    ? parsed.filter(
        (entry) =>
          entry &&
          typeof entry.key === "string" &&
          typeof entry.file === "string" &&
          typeof entry.label === "string" &&
          SAFE_SEGMENT_RE.test(entry.key) &&
          SAFE_FILE_RE.test(entry.file),
      )
    : [];

  const personalities = await Promise.all(
    validEntries.map(async (entry) => {
      const filePath = path.join(RUNTIME_CORE_PERSONALITIES_DIR, entry.file);
      const markdown = await readFile(filePath, "utf8");
      return {
        key: entry.key,
        label: entry.label,
        prompt: stripFrontmatter(markdown),
      };
    }),
  );

  return personalities;
}

export async function getRuntimeCoreSiteMochiCatalog(): Promise<RuntimeCoreSiteMochiCatalog> {
  if (!catalogCache) {
    catalogCache = (async () => {
      const [characters, personalities] = await Promise.all([
        loadCharacters(),
        loadPersonalities(),
      ]);
      return {
        characters,
        personalities,
        freeSiteMessageLimit: SITE_MOCHI_FREE_MESSAGE_LIMIT,
      };
    })().catch((error) => {
      catalogCache = null;
      throw error;
    });
  }
  return catalogCache;
}

export async function getRuntimeCorePersonalityPrompt(personalityKey: string): Promise<string | null> {
  if (!SAFE_SEGMENT_RE.test(personalityKey)) return null;
  const catalog = await getRuntimeCoreSiteMochiCatalog();
  const personality = catalog.personalities.find((entry) => entry.key === personalityKey);
  return personality?.prompt ?? null;
}

export async function readRuntimeCoreSiteMochiSprite(
  character: string,
  fileName: string,
): Promise<Buffer> {
  assertSafeSegment(character, "character");
  assertSafeFileName(fileName);

  const spritePath = path.join(RUNTIME_CORE_CHARACTERS_DIR, character, fileName);
  const normalizedCharacterDir = path.join(RUNTIME_CORE_CHARACTERS_DIR, character) + path.sep;
  const normalizedSpritePath = path.normalize(spritePath);
  if (!normalizedSpritePath.startsWith(normalizedCharacterDir)) {
    throw new Error("Invalid sprite path");
  }

  return readFile(normalizedSpritePath);
}

export function getRuntimeCorePathsForDiagnostics() {
  return {
    root: RUNTIME_CORE_ROOT,
    charactersDir: RUNTIME_CORE_CHARACTERS_DIR,
    personalitiesDir: RUNTIME_CORE_PERSONALITIES_DIR,
    nftGatedCharacters: Array.from(NFT_GATED_CHARACTER_KEYS),
  };
}
