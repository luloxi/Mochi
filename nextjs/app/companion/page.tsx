import type { Metadata } from "next";
import { CompanionSurface } from "@/components/companion/companion-surface";
import { createPageMetadata } from "@/lib/metadata";
import "./companion.css";

export const metadata: Metadata = createPageMetadata({
  title: "Compañera | Mochi",
  description: "Una pieza para hablar con Mochi. Ella está en el centro.",
  path: "/companion",
});

export default function CompanionPage() {
  return <CompanionSurface />;
}
