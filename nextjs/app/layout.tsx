import type React from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@rainbow-me/rainbowkit/styles.css";
import {
  Space_Grotesk,
  JetBrains_Mono,
  Nunito,
  Roboto,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { SiteMochiMascot } from "@/components/site-mochi-mascot";
import { SiteMochiConfigPanel } from "@/components/site-mochi-config-panel";
import { SiteMochiProvider } from "@/components/site-mochi-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { createPageMetadata } from "@/lib/metadata";
import type { Theme } from "@/components/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});
const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});
const nunito = Nunito({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-nunito",
});
const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Mochi | AI Desktop Pets & NFT Auctions",
    description:
      "Animated desktop pets with AI chat, AVAX NFT auctions, and wallet-powered experiences for collectors.",
    path: "/",
  }),
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/logo.png",
        type: "image/png",
      },
    ],
    apple: "/logo.png",
  },
  appleWebApp: {
    title: "Mochi",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
};

const VALID_THEMES: Theme[] = ["neural", "black-pink", "kawaii", "pastel"];

function normalizeTheme(value: string | undefined): Theme {
  if (value === "pink") return "black-pink";
  return VALID_THEMES.includes(value as Theme) ? (value as Theme) : "kawaii";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = normalizeTheme(cookieStore.get("mochi-theme")?.value);
  const themeScript = `
    (function() {
      var themes = ['neural', 'black-pink', 'kawaii', 'pastel'];
      var theme = ${JSON.stringify(initialTheme)};
      var savedTheme = null;
      try { savedTheme = sessionStorage.getItem('mochi-theme-last'); } catch(e) {}
      if (savedTheme === 'pink') {
        savedTheme = 'black-pink';
      }
      if (savedTheme && themes.indexOf(savedTheme) !== -1) {
        theme = savedTheme;
      }
      try { sessionStorage.setItem('mochi-theme-last', theme); } catch(e) {}
      document.cookie = 'mochi-theme=' + theme + '; path=/; max-age=31536000; samesite=lax';
      document.documentElement.setAttribute('data-theme', theme);
      if (document.body) {
        document.body.setAttribute('data-theme', theme);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.setAttribute('data-theme', theme);
        });
      }
    })();
  `;
  return (
    <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
      <body
        data-theme={initialTheme}
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${nunito.variable} ${roboto.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <LanguageProvider>
          <WalletProvider>
            <ThemeProvider initialTheme={initialTheme}>
              <SiteMochiProvider>
                {children}
                <SiteMochiConfigPanel />
                <SiteMochiMascot />
              </SiteMochiProvider>
            </ThemeProvider>
          </WalletProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
