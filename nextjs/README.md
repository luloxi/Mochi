# nextjs

Frontend Next.js para la experiencia AVAX/EVM de Mochi.

## Qué incluye

- Landing y marketplace.
- Conexión wallet con RainbowKit + wagmi + viem.
- API routes para perfiles, feedback, suscripciones y utilidades del sitio.
- Compañera en `/companion`: Mochi deambula la pieza con los sprites shimeji de Katho (no un SVG genérico). Pomodoro, video, notas, DM entre Katho y Lulox, y dos personas-agente que pueden quedar trabajando en este navegador. Slice aparte.

## Variables principales

- `NEXT_PUBLIC_NETWORK`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_BLOCK_EXPLORER_URL`
- `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_COMMISSION_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_ESCROW_VAULT_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_AVAX_USD_ORACLE_ADDRESS`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

`nextjs/.env.example` deja `local` como default y además incluye presets comentados para Fuji y Mainnet.

## Desarrollo

Desde la raíz del repo:

```bash
cp foundry/.env.example foundry/.env
cp nextjs/.env.example nextjs/.env.local
pnpm install
pnpm chain
pnpm deploy:local
pnpm start
```

`pnpm start` auto-detects a free local port, updates `NEXT_PUBLIC_BASE_URL` for that session when appropriate, and writes the chosen URL to `../.deploy-env/frontend.env`.

## Nota

La parte de Prisma queda desacoplada por ahora hasta que exista la nueva base de datos.
Ver [PRISMA-MIGRATION-TODO.md](./PRISMA-MIGRATION-TODO.md).
