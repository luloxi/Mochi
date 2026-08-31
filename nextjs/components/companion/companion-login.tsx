"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { CompanionAuthSession } from "@/lib/companion/auth";

type Gsi = {
  accounts: {
    id: {
      initialize: (opts: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

export function CompanionLogin({
  onSession,
}: {
  onSession: (session: CompanionAuthSession) => void;
}) {
  const btnRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "642702167525-avdsu91g38fhspaapmn9heiie72tpkh4.apps.googleusercontent.com";

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const boot = () => {
      const google = (window as unknown as { google?: Gsi }).google;
      if (!google?.accounts?.id || !btnRef.current) return false;
      google.accounts.id.initialize({
        client_id: clientId,
        auto_select: true,
        ux_mode: "popup",
        callback: async (resp: { credential: string }) => {
          const res = await fetch("/api/companion/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken: resp.credential }),
          });
          const json = await res.json().catch(() => null);
          if (cancelled) return;
          if (json?.session) {
            onSession(json.session);
            return;
          }
          if (json?.error === "denied") {
            setError("Este mail no entra.");
            return;
          }
          setError("Probá de nuevo.");
        },
      });
      btnRef.current.innerHTML = "";
      google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 240,
      });
      return true;
    };
    if (boot()) {
      return () => {
        cancelled = true;
      };
    }
    const id = window.setInterval(() => {
      if (boot()) window.clearInterval(id);
    }, 250);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [clientId, onSession]);

  return (
    <div className="companion-login-card" data-companion-login>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <p className="companion-login-hi">Hola.</p>
      <p className="companion-login-line">Katho ella. Lulox él. Los dos.</p>
      {clientId ? <div ref={btnRef} className="companion-google-btn" /> : null}
      {error ? <p className="companion-login-error">{error}</p> : null}
    </div>
  );
}
