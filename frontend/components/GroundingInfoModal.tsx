"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleDashed, Link2, Search, TriangleAlert, X } from "lucide-react";

// Explains the single most important distinction in the report: whether a
// flag is backed by a real retrieved source or is only a suspicion. Written
// carefully to avoid the tempting-but-wrong shorthand that grounded means
// "bad" and unconfirmed means "safe" -- unconfirmed means UNPROVEN, which is
// not the same as cleared, and saying otherwise would let a real risk be
// dismissed on the strength of a search that simply missed.
export default function GroundingInfoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ground/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="How to read this report"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
              style={{ transformOrigin: "center" }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-hairline-strong bg-[#141519]/95 p-5 shadow-panel backdrop-blur-xl sm:p-6"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="press-feedback absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-hairline-strong bg-ground/70 text-ink-secondary transition-colors duration-150 hover:text-ink-primary"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>

              <div className="flex items-center gap-2.5 pr-10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-border bg-accent-soft text-accent">
                  <Link2 className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold text-ink-primary">How to read this report</h3>
                  <p className="text-[11px] text-ink-muted">Grounded vs unconfirmed, and what to do with each.</p>
                </div>
              </div>

              {/* GROUNDED */}
              <div className="mt-5 flex flex-col gap-2 rounded-lg border border-accent-border bg-accent-soft p-4">
                <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-border bg-ground/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  <Search className="h-3 w-3" strokeWidth={2.5} />
                  Grounded via Parallel
                </span>
                <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                  A real search ran, and at least one retrieved source genuinely documents a precedent for this
                  specific concern. The report shows that source: title, domain, and the exact excerpt it was
                  matched on, all taken from what Parallel actually returned.
                </p>
                <p className="text-[12px] font-medium leading-relaxed text-accent">
                  Treat as evidence. This is the kind of finding you can put in front of legal or a showrunner,
                  because the citation comes with it.
                </p>
              </div>

              {/* UNCONFIRMED */}
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-hairline-strong bg-surface-1 p-4">
                <span className="flex w-fit items-center gap-1.5 rounded-full border border-dashed border-hairline-strong bg-ground/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                  <CircleDashed className="h-3 w-3" strokeWidth={2} />
                  Unconfirmed suspicion
                </span>
                <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                  A specialist saw something worth checking and a real search ran, but nothing that came back
                  actually substantiated it. Often the results were the same broad topic in a materially different
                  situation, which does not count as precedent here.
                </p>
                <p className="text-[12px] font-medium leading-relaxed text-ink-primary">
                  Unproven is not the same as cleared. This is a lead for a human to judge, not a finding, and not
                  a clean bill of health.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
                <div>
                  <p className="text-[12px] font-semibold text-ink-primary">Why the distinction exists</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    No source, no flag. Without this rule a model will happily assert that similar films have been
                    sued before, from memory, and sound confident doing it. Here the verifier can only cite sources
                    by their position in the real result list, so it cannot invent a case even if it wanted to.
                  </p>
                </div>

                <div>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-primary">
                    <TriangleAlert className="h-3.5 w-3.5 text-risk-high" strokeWidth={2.25} />
                    Severity is a separate question
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    Severity says how costly this would be if it is real. Grounding says how confirmed it is. A high
                    severity flag can be unconfirmed, and a grounded flag can be minor. Read the two together.
                  </p>
                </div>

                <div>
                  <p className="text-[12px] font-semibold text-ink-primary">Telling a real gap from a missed search</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    Every flag records the exact query sent to Parallel, how many results came back, and why the
                    verifier ruled the way it did. Open a flag to see them. Results returned but none on point
                    suggests there may genuinely be no precedent; zero results suggests the query was too narrow and
                    is worth another look.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="press-feedback mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
              >
                Got it
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
