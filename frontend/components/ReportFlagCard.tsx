"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, CircleDashed, Quote, Search, Telescope, TriangleAlert } from "lucide-react";
import { SPECIALIST_MAP } from "@/lib/specialists";
import type { RiskFlag } from "@/lib/types";

// Severity and specialist are two INDEPENDENT signals, deliberately kept on
// separate visual channels so neither dilutes the other:
//   - Severity is red/amber/gray, never green (green is "done/clear"
//     elsewhere in the product and must not compete with a risk level).
//   - Specialist identity is the pervasive color: the card's left spine, its
//     own badge, and its icon all share the same hue (lib/specialists.ts).
//
// CRUCIALLY: severity is only the PRIMARY badge when the flag is actually
// grounded. An ungrounded flag leads with "UNCONFIRMED SUSPICION" instead --
// shouting "HIGH" for a finding with no corroborating source overstates
// what the system actually knows, which is the one thing this product must
// never do.
const RISK_BADGE: Record<RiskFlag["severity"], string> = {
  high: "bg-risk-high text-[#1a0605] border-transparent",
  medium: "bg-risk-medium-soft text-risk-medium border-risk-medium-border",
  low: "bg-transparent text-risk-low border-risk-low-border",
};
const RISK_BADGE_GLOW: Record<RiskFlag["severity"], string> = {
  high: "shadow-[0_0_14px_-3px_rgba(232,105,94,0.6)]",
  medium: "",
  low: "",
};
const RISK_CARD_BORDER: Record<RiskFlag["severity"], string> = {
  high: "border-risk-high-border",
  medium: "border-hairline",
  low: "border-hairline",
};

const CONFIDENCE_LABELS: Record<RiskFlag["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low_ungrounded: "Ungrounded suspicion",
};

const ENTRANCE_BOUNCE: Record<RiskFlag["severity"], number> = { high: 0.28, medium: 0.16, low: 0.08 };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function ReportFlagCard({
  flag,
  index = 0,
  focused = false,
  dimmed = false,
  onFocusChange,
}: {
  flag: RiskFlag;
  index?: number;
  focused?: boolean;
  dimmed?: boolean;
  onFocusChange?: (flagId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUngrounded = flag.status === "unconfirmed_suspicion";
  const specialist = SPECIALIST_MAP[flag.specialist];
  const SpecialistIcon = specialist.icon;
  const deepVerified = flag.grounding_method === "task_api";

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    onFocusChange?.(next ? flag.id : null);
  }

  // Entrance and dim state both live on `animate` on purpose: a
  // `whileInView` opacity would take precedence over `animate` (gesture
  // props win over the base state), so the dim would silently never apply
  // while the card is on screen -- the only time it matters. The parent
  // column already handles the scroll-triggered reveal for the section.
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: dimmed ? 0.45 : 1, y: 0, scale: 1 }}
      transition={{ type: "spring", duration: 0.45, bounce: ENTRANCE_BOUNCE[flag.severity], delay: Math.min(index, 4) * 0.05 }}
      onMouseEnter={() => onFocusChange?.(flag.id)}
      onMouseLeave={() => !expanded && onFocusChange?.(null)}
      className={`relative overflow-hidden rounded-md border backdrop-blur-md transition-shadow duration-200 ease-out ${specialist.cardTintClass} ${
        focused ? `${specialist.borderClass} ${specialist.glowClass}` : RISK_CARD_BORDER[flag.severity]
      }`}
    >
      {/* Specialist spine -- softened when the finding is unconfirmed, so
          even the card's edge reflects how much is actually known. */}
      <div
        className={`absolute inset-y-0 left-0 ${specialist.barClass} ${isUngrounded ? "opacity-40" : ""}`}
        aria-hidden
      />

      <button
        type="button"
        onClick={toggle}
        className="press-feedback flex w-full items-center gap-2.5 py-3.5 pl-5 pr-4 text-left"
      >
        {isUngrounded ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-hairline-strong bg-surface-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-secondary">
            <CircleDashed className="h-3.5 w-3.5" strokeWidth={2.25} />
            Unconfirmed suspicion
          </span>
        ) : (
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${RISK_BADGE[flag.severity]} ${RISK_BADGE_GLOW[flag.severity]}`}
          >
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.5} />
            {flag.severity}
          </span>
        )}

        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${specialist.textClass} ${specialist.bgSoftClass} ${specialist.borderClass}`}
        >
          <SpecialistIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
          <span className="hidden sm:inline">{specialist.label}</span>
          <span className="sm:hidden">{specialist.shortLabel}</span>
        </span>

        {/* Severity as SECONDARY context when the flag is unconfirmed --
            present and readable, but never the loudest thing on the card. */}
        {isUngrounded && (
          <span className="shrink-0 whitespace-nowrap text-[10.5px] font-medium text-ink-muted">
            {flag.severity} severity if confirmed
          </span>
        )}

        {!expanded && (
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-muted">{flag.excerpt}</span>
        )}

        <span
          title={isUngrounded ? "No corroborating source found" : "Grounded in a real retrieved source"}
          className={`ml-auto flex shrink-0 items-center justify-center rounded-full border p-1 ${
            isUngrounded ? "border-hairline-strong text-ink-muted" : "border-accent-border bg-accent-soft text-accent"
          }`}
        >
          {isUngrounded ? <CircleDashed className="h-3 w-3" strokeWidth={2} /> : <Search className="h-3 w-3" strokeWidth={2.5} />}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ease-drawer ${expanded ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      <div className="accordion-panel" data-open={expanded}>
        <div className="overflow-hidden px-5 pb-4">
          <motion.div
            initial={false}
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT, delay: expanded ? 0.05 : 0 }}
            className="flex flex-col gap-3"
          >
            <blockquote className="relative overflow-hidden rounded-sm bg-ground/60 py-3 pl-9 pr-3">
              <Quote className="absolute -left-1 -top-1 h-9 w-9 text-ink-muted/25" strokeWidth={1.5} fill="currentColor" />
              <p className="relative font-mono text-[12.5px] leading-relaxed text-ink-secondary">{flag.excerpt}</p>
            </blockquote>

            <p className="max-w-[62ch] text-[14px] leading-7 text-ink-primary">{flag.explanation}</p>

            {/* The grounding receipt: the exact query this flag sent to
                Parallel, how many results came back, and the verifier's own
                reason. For an ungrounded flag this is the difference
                between "we searched and found nothing" and "we never
                tried" -- the reader can tell which. */}
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-ground/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isUngrounded ? "border-hairline-strong text-ink-muted" : "border-accent-border bg-accent-soft text-accent"
                  }`}
                >
                  {isUngrounded ? <CircleDashed className="h-3 w-3" strokeWidth={2} /> : <Search className="h-3 w-3" strokeWidth={2.5} />}
                  {isUngrounded ? "Not grounded" : "Grounded via Parallel"}
                </span>
                {deepVerified && (
                  <span className="flex items-center gap-1 rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    <Telescope className="h-3 w-3" strokeWidth={2.5} />
                    Task API verified
                  </span>
                )}
                <span className="text-[10.5px] text-ink-muted">{CONFIDENCE_LABELS[flag.confidence]}</span>
              </div>

              {flag.search_query && (
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">Query sent to Parallel</p>
                  <p className="break-words font-mono text-[11.5px] leading-relaxed text-ink-secondary">
                    {flag.search_query}
                  </p>
                  <p className="text-[10.5px] text-ink-muted">
                    {flag.results_seen} result{flag.results_seen === 1 ? "" : "s"} returned,{" "}
                    {flag.sources.length} cited as substantiating
                    {flag.sources.length > 0 && (
                      <span className="text-ink-muted/80">, shown in the Resources panel</span>
                    )}
                  </p>
                </div>
              )}

              {flag.grounding_reasoning && (
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">
                    {isUngrounded ? "Why it stayed unconfirmed" : "Why the cited source applies"}
                  </p>
                  <p className="text-[12px] leading-relaxed text-ink-secondary">{flag.grounding_reasoning}</p>
                </div>
              )}
            </div>

            {/* Source cards deliberately do NOT render here -- resources
                live in the right-hand panel only, so the reading column
                stays script + analysis and evidence stays in one place.
                Focusing this card highlights its sources over there. */}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
