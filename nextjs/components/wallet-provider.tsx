"use client";

import dynamic from "next/dynamic";
import { useWalletSession } from "@/components/wallet-session-context";

const WalletProviderClient = dynamic(
  () => import("@/components/wallet-provider-client").then((mod) => mod.WalletProviderClient),
  {
    ssr: false,
  },
);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <WalletProviderClient>{children}</WalletProviderClient>;
}

export { useWalletSession };
