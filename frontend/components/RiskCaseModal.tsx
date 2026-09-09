"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { SPECIALIST_MAP } from "@/lib/specialists";
import type { RiskCase } from "@/lib/riskCases";
import { faviconUrl, hostnameOf } from "@/lib/sourceTypes";

// Detail view for one real, documented case from the carousel. Same modal
// grammar as NodeDetailModal (backdrop fade, centre-origin spring, click
// the backdrop or the cross to dismiss) so the product has one modal
// language rather than two.
export default function RiskCaseModal({
  item,
  onClose,
}: {
  item: RiskCase | null;
  onClose: () => void;
}) {
  // Rendered through a portal on the body rather than in place. The
  // carousel sets `perspective` and its ancestors are Framer-animated, and
  // any transform/perspective/filter on an ancestor makes it the containing
  // block for `position: fixed` descendants -- which would quietly break
  // both the full-screen backdrop and the centring. Portalling sidesteps
  // that whole class of bug instead of depending on ancestor styles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape to close, and lock the page behind the modal so the carousel
  // and the rest of the page can't scroll under it while it is open.
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [item, onClose]);

  const specialist = item ? SPECIALIST_MAP[item.specialist] : null;
  const Icon = specialist?.icon;

  // After all hooks, so hook order stays stable across renders.
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {item && specialist && Icon && (
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
              aria-label={item.title}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
              style={{ transformOrigin: "center" }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-hairline-strong bg-[#141519]/95 shadow-panel backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="press-feedback absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-hairline-strong bg-ground/70 text-ink-secondary backdrop-blur-md transition-colors duration-150 hover:text-ink-primary"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>

              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#171820]">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- real news-outlet images from arbitrary domains
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  // Same honest fallback used everywhere else: a considered
                  // icon, never a stock photo standing in for the event.
                  <div className="relative flex h-full w-full items-center justify-center">
                    <span
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(120% 85% at 50% 0%, ${specialist.hex}22, transparent 70%)`,
                      }}
                      aria-hidden
                    />
                    <Icon className="relative h-12 w-12 opacity-40" style={{ color: specialist.hex }} strokeWidth={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141519] via-transparent to-transparent" />
              </div>

              <div className="flex flex-col gap-3.5 p-5 sm:p-6">
                {/* Action row sits at the top: the tag identifies what kind
                    of case this is, and the primary action is reachable
                    immediately rather than after scrolling the summary. */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${specialist.textClass} ${specialist.bgSoftClass} ${specialist.borderClass}`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                    {specialist.label}
                  </span>

                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="press-feedback group flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-accent-hover"
                  >
                    Read the full story
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={2.25}
                    />
                  </a>
                </div>

                <h3 className="font-display text-[1.5rem] font-bold leading-tight tracking-tight text-ink-primary sm:text-[1.75rem]">
                  {item.title}
                </h3>

                <p className="text-[14px] leading-relaxed text-ink-secondary">{item.summary}</p>

                <div className="flex min-w-0 items-center gap-2 border-t border-hairline pt-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faviconUrl(item.sourceUrl)}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="truncate text-[12px] text-ink-muted">
                    {item.sourceName} ({hostnameOf(item.sourceUrl)})
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
