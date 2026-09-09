import { ScanSearch } from "lucide-react";
import Link from "next/link";

// Shared shell across all three screens -- this is what makes the product
// feel like one coherent system rather than three separately styled pages.
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-ground/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="press-feedback flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
            <ScanSearch className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="font-display text-[13px] font-semibold tracking-tight text-ink-primary">
            CineRisk
          </span>
        </Link>
        <span className="font-mono text-[11px] tracking-wide text-ink-muted">
          Pre-Release Content Risk Audit
        </span>
      </div>
    </header>
  );
}
