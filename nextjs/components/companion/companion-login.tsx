"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { CompanionAuthSession } from "@/lib/companion/auth";

type GsiOauth = {
  accounts: {
    oauth2: {
      initTokenClient: (opts: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
      }) => { requestAccessToken: () => void };
    };
  };
};

export function CompanionLogin({
  onSession,
}: {
  onSession: (session: CompanionAuthSession) => void;
}) {
  const clientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "253648842852-crcqh36v7bogroqae76f4mchit37nl4i.apps.googleusercontent.com";

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const boot = () => {
      const google = (window as unknown as { google?: GsiOauth }).google;
      if (!google?.accounts?.oauth2) return false;
      clientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        prompt: "select_account",
        callback: async (resp) => {
          if (!resp?.access_token) {
            if (!cancelled) setError("Probá de nuevo.");
            return;
          }
          const res = await fetch("/api/companion/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ accessToken: resp.access_token }),
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
      if (!cancelled) setReady(true);
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
      {clientId ? (
        <button
          type="button"
          className="companion-google-fallback"
          data-companion-google-oauth
          disabled={!ready}
          onClick={() => clientRef.current?.requestAccessToken()}
        >
          Continuar con Google
        </button>
      ) : null}
      {error ? <p className="companion-login-error">{error}</p> : null}
    </div>
  );
}
