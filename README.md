# Mochi Agents

march 24
project droped by developer, please now have patience while I found a way give pets into util life!

Animated desktop pets with AI chat plus an Avalanche marketplace stack.

## Technical Overview

### Tech stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI
- **Backend:** Next.js Route Handlers on Node.js
- **Database:** PostgreSQL with Prisma ORM
- **Blockchain:** Avalanche C-Chain / Fuji, wagmi, viem, RainbowKit, SIWE
- **Smart contracts:** Solidity 0.8.28, Foundry, OpenZeppelin
- **AI:** OpenRouter, Ollama, OpenClaw, Bitte AI
- **Storage:** IPFS via Pinata for NFT metadata and asset bundles
- **Clients:** Web app, Electron desktop app, Chrome extension, Firefox extension

### Architecture decisions

- **Shared runtime core:** `runtime-core/` is the canonical source for characters, personalities, assets, and shared runtime logic. Desktop and browser clients sync from it so behavior stays consistent across every surface.
- **Off-chain AI, on-chain ownership:** AI inference runs off-chain for speed and flexibility, while Avalanche is used for verifiable ownership, minting, listings, auctions, swaps, and commission settlement.
- **Pluggable provider model:** Chat and agent features use a unified provider layer so hosted models, local models, and agent gateways can all plug into the same product flow.
- **Hybrid persistence model:** Trust-critical state lives on-chain, operational app state lives in Postgres, and heavy media/metadata assets live on IPFS.
- **Feature-specific contract design:** Separate contracts handle NFTs, marketplace sales, auctions, commissions, and escrow-style flows instead of forcing all logic into a single contract.

### Implementation approach

The project is built as a multi-surface product. The web app is the main orchestration layer for wallet connection, creator tooling, marketplace actions, AI chat, metadata packaging, and IPFS upload. The desktop app and browser extensions reuse the same runtime assets and animation logic through `runtime-core/`.

On the blockchain side, Solidity contracts on Avalanche manage NFT minting, sales, auctions, swaps, and commission flows. On the AI side, provider-specific integrations are wrapped behind a shared interface so users can switch between cloud, local, and agent-based modes without changing the rest of the system.

## Integrations

The Avalanche marketplace stack integrates with:

- **[Chainlink](https://chain.link/)** — AVAX/USD price feed support for cross-currency marketplace and auction flows.

## Structure

| Directory | Description |
|---|---|
| [nextjs](./nextjs/README.md) | Next.js marketplace dapp and web APIs |
| [foundry](./foundry/README.md) | Foundry smart contracts, tests, and deploy scripts |
| [chrome-extension](./chrome-extension/) | Browser runtime and chat UI |
| [firefox-extension](./firefox-extension/) | Firefox browser runtime and chat UI |
| [desktop](./desktop/) | Electron desktop app |
| [runtime-core](./runtime-core/) | Canonical shared runtime content (characters, personalities, shared assets) |
| [animation-reference](./animation-reference/README.md) | Sprite standards for extension/desktop |

## Quick Start (Avalanche)

For the "one script does everything" local flow, use:

```bash
./launch.sh
```

`launch.sh` is the root-level unified launcher. In `local` mode it opens the full stack:

- local chain via `pnpm chain`
- frontend via `pnpm start`
- contract deploy via `pnpm deploy:local`

The deploy step writes contract addresses into `.deploy-env/local.env`, and `pnpm start` loads that file automatically so the frontend points at the freshly deployed contracts.

If you want the non-interactive/manual equivalent, run these from the repo root:

```bash
pnpm chain
pnpm deploy:local
pnpm start
```

For public networks:

- `pnpm deploy:testnet` deploys to Fuji
- `pnpm deploy:testnet:publish` deploys to Fuji and syncs frontend contract envs to Vercel
- `pnpm deploy:mainnet` deploys to mainnet
- `pnpm deploy:mainnet:publish` deploys to mainnet and syncs frontend contract envs to Vercel

Note: wallet connection in the web app also needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set for `nextjs`.

## Quick Start (Runtimes)

### Chrome extension

1. Open `chrome://extensions`, enable Developer mode.
2. Load unpacked `chrome-extension/`.

### Desktop app

```bash
cd desktop && npm install && npm start
```

## Build & packaging

1. Sync shared runtime core before bundling any runtime: `npm run sync-runtime-core` (legacy alias: `npm run sync-personalities`). `./build.sh …` also runs this internally.
2. From the repo root you can now call `./build.sh chrome`, `./build.sh firefox`, `./build.sh windows`, `./build.sh macos`, `./build.sh linux`, or `./build.sh all` to build Chrome/Firefox packages and the desktop builds.
3. When publishing release assets, run `./scripts/publish_release_assets.sh` (it also syncs runtime-core before zipping). After building locally you can re-use the same release script to upload the generated zips and desktop builds so the published assets match what `build.sh` produced.
