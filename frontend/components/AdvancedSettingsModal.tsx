"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, SlidersHorizontal, X } from "lucide-react";

export type EscalationSeverity = "high" | "medium" | "low";

export const SEVERITY_OPTIONS: {
  value: EscalationSeverity;
  label: string;
  detail: string;
  dot: string;
  text: string;
}[] = [
  {
    value: "high",
    label: "High severity",
    detail:
      "The findings most expensive to get wrong: a damaging portrayal of an identifiable person, a real brand shown illegally.",
    dot: "bg-risk-high",
    text: "text-risk-high",
  },
  {
    value: "medium",
    label: "Medium severity",
    detail:
      "Real but less clear-cut concerns. These are where the fast search most often comes back ungrounded.",
    dot: "bg-risk-medium",
    text: "text-risk-medium",
  },
  {
    value: "low",
    label: "Low severity",
    detail:
      "Borderline or incidental concerns. Rarely worth the extra minutes, included only for a genuinely exhaustive pass.",
    dot: "bg-risk-low",
    text: "text-risk-low",
  },
];

// Stated as a multiplier rather than in minutes: the real wall clock depends
// on how many flags in a given script actually land in the selected
// severities, which nothing can know before the run happens.
export function timeEstimate(count: number): string {
  if (count <= 0) return "No escalation will run: every flag keeps its fast-path verdict.";
  if (count === 1) return "Expect roughly 2x the time of a simple run.";
  if (count === 2) return "Expect roughly 3x the time of a simple run.";
  return "Expect 3x or more the time of a simple run.";
}

export default function AdvancedSettingsModal({
  open,
  selected,
  onToggle,
  onClose,
  escalationActive,
}: {
  open: boolean;
  selected: EscalationSeverity[];
  onToggle: (value: EscalationSeverity) => void;
  onClose: () => void;
  escalationActive: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
              aria-label="Advanced settings"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
              style={{ transformOrigin: "center" }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline-strong bg-[#141519]/95 p-5 shadow-panel backdrop-blur-xl sm:p-6"
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
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold text-ink-primary">Advanced settings</h3>
                  <p className="text-[11px] text-ink-muted">Applies to this run only, not to future ones.</p>
                </div>
              </div>

              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-secondary">
                Choose which severities Parallel gets re-queried for when the fast search cannot ground a flag.
                Only these severities are escalated.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {SEVERITY_OPTIONS.map((opt) => {
                  const on = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggle(opt.value)}
                      aria-pressed={on}
                      className={`press-feedback flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-200 ease-out ${
                        on
                          ? "border-accent-border bg-accent-soft"
                          : "border-hairline bg-surface-1 hover:border-hairline-strong"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                          on ? "border-accent bg-accent text-white" : "border-hairline-strong"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} aria-hidden />
                          <span className={`text-[12.5px] font-semibold ${on ? opt.text : "text-ink-secondary"}`}>
                            {opt.label}
                          </span>
                        </span>
                        <span className="text-[11.5px] leading-relaxed text-ink-muted">{opt.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-severity-medium-border bg-severity-medium-soft px-3 py-2.5 text-[11.5px] font-medium leading-relaxed text-severity-medium">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {timeEstimate(selected.length)}
              </p>

              {!escalationActive && (
                <p className="mt-2.5 text-[11px] leading-relaxed text-ink-muted">
                  These severities only take effect once deep verification or deep research is switched on. With
                  both off, every flag keeps its fast Search API verdict.
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="press-feedback mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
              >
                Done
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
