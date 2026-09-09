"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, LoaderCircle, X, XCircle, type LucideIcon } from "lucide-react";
import SourceCard from "@/components/SourceCard";
import type { AgentStatus, SourceObject } from "@/lib/types";

const STATE_ICON: Record<AgentStatus["state"], LucideIcon> = {
  pending: Circle,
  running: LoaderCircle,
  done: CheckCircle2,
  error: XCircle,
};
const STATE_LABEL: Record<AgentStatus["state"], string> = {
  pending: "Waiting",
  running: "Working",
  done: "Done",
  error: "Failed",
};

export interface NodeDetail {
  label: string;
  icon: LucideIcon;
  description: string;
  state?: AgentStatus["state"];
  reason?: string;
  sources?: SourceObject[];
}

// A single centered modal, reused for every node in both the static
// homepage tree and the live run tree -- centered (not origin-anchored)
// because it belongs to whichever node was clicked across a wide diagram,
// not to one fixed trigger point.
export default function NodeDetailModal({ detail, onClose }: { detail: NodeDetail | null; onClose: () => void }) {
  const StateBadgeIcon = detail?.state ? STATE_ICON[detail.state] : null;

  return (
    <AnimatePresence>
      {detail && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ground/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
              style={{ transformOrigin: "center" }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-hairline-strong bg-surface-2 p-5 shadow-panel backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent">
                    <detail.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink-primary">{detail.label}</h3>
                    {detail.state && StateBadgeIcon && (
                      <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                        <StateBadgeIcon
                          className={`h-3 w-3 ${detail.state === "running" ? "animate-spin-linear text-accent" : ""}`}
                          strokeWidth={2.25}
                        />
                        {STATE_LABEL[detail.state]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="press-feedback rounded-md p-1 text-ink-muted transition-colors duration-150 ease-out hover:text-ink-secondary"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">{detail.description}</p>

              {detail.reason && (
                <div className="mt-4 rounded-md border border-hairline bg-ground/40 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Result</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-primary">{detail.reason}</p>
                </div>
              )}

              {detail.sources && detail.sources.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    {detail.sources.length} source{detail.sources.length === 1 ? "" : "s"}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {detail.sources.map((source, i) => (
                      <SourceCard key={i} source={source} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
