"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Ban, ExternalLink, Gavel, Scale } from "lucide-react";
import {
  COST_CASES,
  COST_KIND_LABEL,
  TOTAL_SETTLED_MILLIONS,
  type CostCase,
  type CostKind,
} from "@/lib/costCases";
import { faviconUrl, hostnameOf } from "@/lib/sourceTypes";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const COUNT_DURATION_MS = 1150;

// Two visual registers only, and they encode a real distinction rather than
// decoration: red is money that actually left the building, amber is money
// or airtime someone is still arguing about. See the `kind` note in
// lib/costCases.ts.
const KIND_STYLES: Record<
  CostKind,
  { text: string; bg: string; border: string; bar: string; Icon: typeof Gavel }
> = {
  settlement: {
    text: "text-risk-high",
    bg: "bg-risk-high-soft",
    border: "border-risk-high-border",
    bar: "bg-risk-high",
    Icon: Gavel,
  },
  claim: {
    text: "text-risk-medium",
    bg: "bg-risk-medium-soft",
    border: "border-risk-medium-border",
    bar: "bg-risk-medium",
    Icon: Scale,
  },
  pulled: {
    text: "text-risk-medium",
    bg: "bg-risk-medium-soft",
    border: "border-risk-medium-border",
    bar: "bg-risk-medium",
    Icon: Ban,
  },
};

/** Counts up to `value` once, when scrolled into view. Driven by rAF rather
 *  than a spring so the final frame lands on the exact figure: an animated
 *  number that settles on 787.4 would undercut the whole point of the
 *  section. */
function useCountUp(value: number, decimals: number, active: boolean): string {
  // Seeded with the real figure, not 0, so the server-rendered HTML and any
  // no-JS view show the actual number instead of "$0.0M". The first rAF tick
  // drops it to zero to begin the count, which is invisible because it
  // coincides with the card's own opacity-0 entrance.
  const [shown, setShown] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    // Respect a reduced-motion preference by skipping straight to the
    // figure. The number is the content here, not the animation.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_DURATION_MS);
      // Ease-out cubic: fast arrival, gentle settle.
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setShown(value);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, active]);

  return shown.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function CostCard({ item, index, active }: { item: CostCase; index: number; active: boolean }) {
  const style = KIND_STYLES[item.kind];
  const { Icon } = style;
  const counted = useCountUp(item.value, item.decimals, active);

  return (
    <motion.a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 18 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: EASE_OUT }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 backdrop-blur-sm transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
    >
      {/* Kind stripe: the card's own claim about what class of fact this is. */}
      <span className={`absolute inset-x-0 top-0 h-[2px] ${style.bar} opacity-70`} aria-hidden />

      <span
        className={`flex w-fit items-center gap-1.5 rounded-full border ${style.border} ${style.bg} px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] ${style.text}`}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {COST_KIND_LABEL[item.kind]}
      </span>

      <p
        className={`mt-4 font-display text-[2.6rem] font-bold leading-none tracking-[-0.03em] ${style.text} sm:text-[3rem]`}
      >
        <span className="tabular-nums">
          {item.prefix}
          {counted}
        </span>
        <span className="text-[0.55em] font-semibold tracking-[-0.01em]">{item.suffix}</span>
      </p>

      <p className="mt-3 text-[13.5px] font-semibold leading-snug text-ink-primary">
        {item.party}
        <span className="ml-1.5 font-mono text-[11px] font-medium text-ink-muted">{item.year}</span>
      </p>

      <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-ink-secondary">{item.detail}</p>

      <span className="mt-4 flex items-center gap-2 border-t border-hairline pt-3 text-[11.5px] text-ink-muted transition-colors duration-200 group-hover:text-ink-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl(item.sourceUrl)}
          alt=""
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-sm opacity-80"
        />
        <span className="truncate">{item.sourceName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-medium">
          {hostnameOf(item.sourceUrl)}
          <ExternalLink className="h-3 w-3" strokeWidth={2.25} />
        </span>
      </span>
    </motion.a>
  );
}

export default function CostSection() {
  const ref = useRef<HTMLDivElement>(null);
  // once:true so the count-up is a single arrival, not a re-trigger every
  // time the section scrolls back past.
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COST_CASES.map((item, i) => (
          <CostCard key={item.party} item={item} index={i} active={inView} />
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: EASE_OUT }}
        className="mt-6 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted"
      >
        Two of those four are settlements, and between them{" "}
        <span className="font-semibold text-ink-secondary">
          ${TOTAL_SETTLED_MILLIONS.toLocaleString("en-US", { maximumFractionDigits: 1 })} million
        </span>{" "}
        actually changed hands over claims about a single company. The third is an amount sued for,
        not awarded, and it is labelled that way on purpose. In every case the precedent existed in
        public reporting before the script did.
      </motion.p>
    </div>
  );
}
