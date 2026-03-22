"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useWalletSession } from "@/components/wallet-provider";

export default function MyProfilePage() {
  const router = useRouter();
  const { isSpanish } = useLanguage();
  const { isConnected, publicKey, isAvailable } = useWalletSession();

  useEffect(() => {
    if (isConnected && publicKey) {
      router.replace(`/profile/${publicKey}`);
    }
  }, [isConnected, publicKey, router]);

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border border-white/10 text-[var(--brand-accent)]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                {isSpanish ? "Mi perfil" : "My profile"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSpanish
                  ? "Conecta tu wallet para abrir tu perfil público y ver tus NFTs."
                  : "Connect your wallet to open your public profile and view your NFTs."}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-12 mb-8 neural-card rounded-2xl">
            <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              {isAvailable ? (
                isSpanish
                  ? "Conecta tu wallet para abrir tu perfil."
                  : "Connect your wallet to open your profile."
              ) : (
                isSpanish ? (
                  <>
                    No detectamos una wallet compatible con EVM.{" "}
                    <a className="underline" href="https://rainbowkit.com/" target="_blank" rel="noreferrer">
                      Instala una wallet compatible
                    </a>{" "}
                    para continuar.
                  </>
                ) : (
                  <>
                    No compatible EVM wallet detected.{" "}
                    <a className="underline" href="https://rainbowkit.com/" target="_blank" rel="noreferrer">
                      Install a compatible wallet
                    </a>{" "}
                    to continue.
                  </>
                )
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {isSpanish
                ? "La conexión de wallet solo está disponible desde el header del landing."
                : "Wallet connection is only available from the landing header."}
            </p>
            <Link href="/marketplace" className="mt-5 text-sm underline text-muted-foreground hover:text-foreground">
              {isSpanish ? "Ir al marketplace" : "Go to marketplace"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
