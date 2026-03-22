"use client";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";

const WIN_RELEASE_URL =
  "https://github.com/shimeji-ai/Mochi/releases/latest/download/mochi-desktop-windows.exe";
const LINUX_RELEASE_URL =
  "https://github.com/shimeji-ai/Mochi/releases/latest/download/mochi-desktop-linux.AppImage";
const CHROME_RELEASE_URL =
  "https://github.com/shimeji-ai/Mochi/releases/latest/download/mochi-chrome-extension.zip";
const FIREFOX_RELEASE_URL =
  "https://github.com/shimeji-ai/Mochi/releases/latest/download/mochi-firefox-extension.zip";

export function DownloadSection({ embedded = false }: { embedded?: boolean }) {
  const { isSpanish } = useLanguage();
  const cardTitleClass =
    "font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground sm:text-lg";
  const cardClass = embedded
    ? "neural-card rounded-2xl px-5 pb-5 pt-3 text-center"
    : "neural-card rounded-2xl p-8 text-center";

  return (
    <section id="download" className={embedded ? "py-0" : "py-20"}>
      <div className="container mx-auto px-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${embedded ? "gap-4" : "gap-8"}`}>
          <div className={cardClass}>
            <h3 className={`${cardTitleClass} mb-3`}>
              {isSpanish ? "Extensión de Navegador" : "Browser Extension"}
            </h3>
            <div className="text-left mb-6 space-y-5">
              <div>
                <p className="mb-2 text-muted-foreground font-medium">
                  Chrome / Edge / Brave / Opera
                </p>
                <div className="text-sm text-muted-foreground">
                  {isSpanish
                    ? "Descargá, descomprimí, escribí chrome://extensions en la barra de direcciones, activá el modo desarrollador y cargá la carpeta descomprimida."
                    : "Download, unzip, type chrome://extensions in the address bar, enable Developer Mode, then load the unzipped folder."}
                </div>
                <div className="mt-3">
                  <Button asChild className="neural-button w-full">
                    <a href={CHROME_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                      {isSpanish ? "Descargar para Chrome" : "Download for Chrome"}
                    </a>
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted-foreground font-medium">Firefox</p>
                <div className="text-sm text-muted-foreground">
                  {isSpanish
                    ? "Descargá, descomprimí, abrí `about:debugging`, hacé clic en \"Este Firefox\" y cargá el manifest.json de la carpeta."
                    : "Download, unzip, open `about:debugging`, click \"This Firefox\", then load the manifest.json from the folder."}
                </div>
                <div className="mt-3">
                  <Button asChild className="neural-button w-full">
                    <a href={FIREFOX_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                      {isSpanish ? "Descargar para Firefox" : "Download for Firefox"}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className={`${cardTitleClass} mb-3`}>{isSpanish ? "Versión Desktop" : "Desktop Version"}</h3>
           
            <div className="text-left mb-6 space-y-5">
              <div>
                <p className="mb-2 text-muted-foreground font-medium">
                  {isSpanish ? "Windows Portable" : "Windows Portable"}
                </p>
                <div className="mt-3">
                  <Button asChild className="neural-button w-full">
                    <a href={WIN_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                      {isSpanish ? "Descargar Windows (.exe)" : "Download Windows (.exe)"}
                    </a>
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted-foreground font-medium">{isSpanish ? "macOS" : "macOS"}</p>
                <div className="mt-3">
                  <Button className="neural-button w-full" disabled>
                    {isSpanish ? "macOS (próximamente)" : "macOS (coming soon)"}
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted-foreground font-medium">
                  {isSpanish ? "Linux AppImage" : "Linux AppImage"}
                </p>
                <div className="text-sm text-muted-foreground">
                  {isSpanish
                    ? "Build Linux portable en formato AppImage. Después de descargar: `chmod +x mochi-desktop-linux.AppImage` y luego ejecuta el archivo."
                    : "Portable Linux build in AppImage format. After download: `chmod +x mochi-desktop-linux.AppImage` and then run it."}
                </div>
                <div className="mt-3">
                  <Button asChild className="neural-button w-full">
                    <a href={LINUX_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                      {isSpanish ? "Descargar AppImage" : "Download AppImage"}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className={`${cardTitleClass} mb-3`}>{isSpanish ? "Mobile" : "Mobile"}</h3>
            <div className="text-left mb-6 space-y-5">
              <div>
                <p className="mb-2 text-muted-foreground font-medium">Android</p>
                <div className="text-sm text-muted-foreground">
                  {isSpanish ? "Versión Android en desarrollo." : "Android version is in development."}
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted-foreground font-medium">iPhone (iOS)</p>
                <div className="text-sm text-muted-foreground">
                  {isSpanish ? "Versión iPhone (iOS) en desarrollo." : "iPhone (iOS) version is in development."}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button className="neural-button" disabled>
                {isSpanish ? "Android (próximamente)" : "Android (coming soon)"}
              </Button>
              <Button className="neural-button" disabled>
                {isSpanish ? "iPhone (próximamente)" : "iPhone (coming soon)"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
