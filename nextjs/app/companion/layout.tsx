import type { ReactNode } from "react";

export default function CompanionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="companion-root" data-companion-surface>
      {children}
    </div>
  );
}
