"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type MarketplaceCommissionsManualPageClientProps = {
  initialIsSpanish: boolean;
};

type BilingualText = {
  en: string;
  es: string;
};

const STEPS: BilingualText[] = [
  {
    en: "Artist lists a commission egg with a price and estimated delivery days.",
    es: "El artista publica un huevo de comisión con un precio y días estimados de entrega.",
  },
  {
    en: "Buyer purchases it and submits an intention plus optional reference image URL.",
    es: "El comprador lo compra y envía una intención más una URL de imagen de referencia opcional.",
  },
  {
    en: "At purchase time, 50% is released to the artist and the other 50% is kept as money in custody.",
    es: "Al comprar, el 50% se libera al artista y el otro 50% queda como dinero en custodia.",
  },
  {
    en: "Artist updates the NFT metadata with the delivered art and marks the order as delivered.",
    es: "El artista actualiza la metadata del NFT con el arte entregado y marca la orden como entregada.",
  },
  {
    en: "Buyer can approve, request changes (up to 3), or recover the remaining money in custody.",
    es: "El comprador puede aprobar, pedir cambios (hasta 3) o recuperar el dinero en custodia restante.",
  },
  {
    en: "If the buyer does not respond for 7 days after delivery, the artist can claim the remaining money in custody.",
    es: "Si el comprador no responde por 7 días tras la entrega, el artista puede reclamar el dinero en custodia restante.",
  },
];

export function MarketplaceCommissionsManualPageClient({
  initialIsSpanish,
}: MarketplaceCommissionsManualPageClientProps) {
  const { isSpanish } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveIsSpanish = mounted ? isSpanish : initialIsSpanish;
  const t = (en: string, es: string) => (effectiveIsSpanish ? es : en);

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <section className="rounded-3xl border border-border bg-white/10 p-5 backdrop-blur-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                {t("Commission Manual", "Manual de comisiones")}
              </h1>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
            >
              {t("Back to marketplace", "Volver al marketplace")}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white/10 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-foreground">
            {t("How it works", "Cómo funciona")}
          </h2>
          <div className="mt-3 space-y-2">
            {STEPS.map((step, index) => (
              <div
                key={`commission-manual-step-${index}`}
                className="rounded-xl border border-border bg-white/5 p-3 text-sm text-muted-foreground"
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white/5 text-xs text-foreground">
                  {index + 1}
                </span>
                {effectiveIsSpanish ? step.es : step.en}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white/10 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-foreground">
            {t("Important notes", "Notas importantes")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              {t(
                "Change requests are saved on-chain as text (intention) plus an optional reference image URL.",
                "Los pedidos de cambio se guardan on-chain como texto (intención) más una URL opcional de imagen de referencia.",
              )}
            </li>
            <li>
              {t(
                "The refund action returns the remaining money in custody. The first 50% is sent to the artist at purchase time.",
                "La acción de reembolso devuelve el dinero en custodia restante. El primer 50% se envía al artista al momento de la compra.",
              )}
            </li>
            <li>
              {t(
                "Technical note: commission custody can be routed through an external escrow endpoint when configured, otherwise it stays in the internal escrow flow.",
                "Aclaración técnica: la custodia de una comisión puede enviarse a un endpoint de escrow externo cuando está configurado; si no, queda dentro del flujo de escrow interno.",
              )}
            </li>
            <li>
              {t(
                "Artists should update the NFT metadata with the final artwork before marking delivery.",
                "Los artistas deben actualizar la metadata del NFT con el arte final antes de marcar la entrega.",
              )}
            </li>
            <li>
              {t(
                "Artists should take the time they need to make the Mochi well. The estimated delivery days should be a realistic timeline, not a rush deadline.",
                "El artista debe tomarse el tiempo necesario para hacer bien el Mochi. Los días estimados de entrega deben ser un tiempo realista, no una fecha para apurarse.",
              )}
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
