"use client";

import dynamic from "next/dynamic";

const DownloadSection = dynamic(() => import("@/components/download-section").then(m => m.DownloadSection), {
  ssr: false,
  loading: () => <div className="min-h-[320px]" />,
});

export default function DownloadClient({ embedded = false }: { embedded?: boolean }) {
  return (
    <main className="site-window-page site-window-skin min-h-screen overflow-x-hidden neural-shell">
      <DownloadSection embedded={embedded} />
    </main>
  );
}
