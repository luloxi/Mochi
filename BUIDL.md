# Mochi — Animated AI Companions with On-Chain Ownership

## What it is

Mochi is an animated pixel-art pet that lives on your desktop, in your browser, and on the web. It follows your cursor, reacts to what you're doing, and talks to you through an AI chat interface. You can own your Mochi as an NFT, buy and sell characters in a marketplace, commission custom designs, and eventually let your agent earn and pay for itself on-chain.

It is not a chatbot with a skin. It is a platform where AI, ownership, and personality are the product.

---

## The problem

AI assistants are invisible and forgettable. You close the tab and they're gone. There's no persistent companion, no identity, no ownership, and no way for an agent to operate independently over time. At the same time, digital creators have no clean way to monetize original character designs as interactive, living assets.

Mochi solves both sides: a persistent animated companion you actually own, running on an AI backend you control, with smart contracts that handle all the economic rails underneath.

---

### Agent Wallet & Self-Paying Agents

The long-term vision — inspired by [Conway-Research/automaton](https://github.com/Conway-Research/automaton) and ERC-8004 — is for agents to accumulate on-chain earnings from services they provide, pay their own hosting and AI costs, and operate indefinitely without user top-ups.

This is currently in active development. The contracts, the wallet UI, and the Bitte AI multichain integration are the foundation it builds on.

---

## What makes it different

**Ownership over subscription.** Your character is an NFT. You can sell it, trade it, or commission a new one. The platform does not hold your companion.

**Local-first AI.** Ollama support means the model runs on your machine. Nothing leaves unless you choose a cloud provider.

**Persistent across surfaces.** The same character, same personality, same animation system whether you're on the web, in a browser tab, or on your desktop.

**Creator rails built in.** Artists can mint characters, run edition sales, manage commissions with escrow, and receive royalties — all from the same interface.

**Self-funding agents.** The economic model where an agent earns its own operational costs is novel. Most AI tools require perpetual user spend. Mochi's architecture is designed to eventually flip that.


## How it works

### Platforms

Mochi runs everywhere your user is:

- **Web app** (Next.js) — marketplace, creator studio, AI chat, wallet
- **Desktop app** (Electron) — native overlay that lives above all windows
- **Browser extensions** (Chrome & Firefox) — injects a companion onto any webpage

All three share a canonical **runtime core** — one set of character sprites, animation logic, and personality profiles synced across every surface.

### AI Providers

The chat backend is pluggable. Users can switch between:

| Provider | What it is |
|---|---|
| Site (default) | Hosted inference via OpenRouter |
| OpenRouter | Cloud models — GPT-4o, Claude, Gemini, etc. |
| Ollama | Local LLMs running on the user's machine |
| OpenClaw | Agent gateway with WebSocket relay |
| Bitte AI | Multichain agent (NEAR intents + EVM) |

Sound input (browser mic) and output (browser TTS or ElevenLabs) are optional layers on top.

### On-Chain Architecture

Smart contracts on **Avalanche C-Chain** (Solidity 0.8, Foundry):

- **MochiNFT** — ERC-721, two token kinds: Finished and CommissionEgg
- **MochiEditions** — ERC-1155 for limited-edition sales
- **MochiMarketplace** — buy/sell in AVAX or USDC with Chainlink price feed
- **MochiAuction** — time-based bidding
- **MochiCommission** — lifecycle management (Accepted → Delivered → Completed → Refunded)
- **MochiEscrowVault** — holds funds during commission flows

Metadata and media live on IPFS (Pinata). Trust-critical state lives on-chain. App state lives in PostgreSQL.

## Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Electron
- **Extensions**: Chrome MV3, Firefox WebExtension
- **Contracts**: Solidity 0.8.28, Foundry, Avalanche C-Chain
- **AI**: OpenRouter, Ollama, OpenClaw, Bitte AI (NEAR intents)
- **Storage**: IPFS (Pinata), PostgreSQL
- **Wallets**: RainbowKit, wagmi, viem, NEAR wallet

---

## Current state

The marketplace and NFT contracts (on testnet), creator studio, commission flow are functional but still don't correctly unlock new characters. The AI chat with provider switching works across all platforms but OpenClaw still only works when using a locally deployed instance on desktop and extension. The runtime sync between web, desktop, and extensions is live but web has a different runtime-core still. The agent wallet and self-paying agent mechanics are next on our internal roadmap after we complete the current development phase.
