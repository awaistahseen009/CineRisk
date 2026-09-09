"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ScanText,
  Cloud,
  Database,
  GitBranch,
  Search,
  ShieldCheck,
  Telescope,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { EASE_LAYOUT } from "@/lib/treeLayout";

// The two-stage grounding loop is the actual mechanic behind "no source, no
// flag" -- worth showing explicitly, because it is what separates this from
// a model that simply asserts risks with confident prose.
const STAGES: { n: string; title: string; body: string; icon: LucideIcon }[] = [
  {
    n: "01",
    title: "Identify",
    body: "Gemini reads one scene and proposes suspected risks as structured output, never a verdict, and an empty list is a valid answer. Each suspicion ships with a search query written to find a real precedent.",
    icon: ScanText,
  },
  {
    n: "02",
    title: "Retrieve",
    body: "That exact query hits Parallel's Search API. The query and the number of results returned are recorded on the flag itself, so an unconfirmed finding can still prove the pipeline actually looked.",
    icon: Search,
  },
  {
    n: "03",
    title: "Verify",
    body: "A second pass sees only the real retrieved results and must cite sources by index, so it is structurally unable to invent a title or URL. If nothing genuinely matches, the flag is downgraded, not published.",
    icon: ShieldCheck,
  },
];

// Laid out as three deliberate rows rather than a uniform grid: the
// grounding layer, the Google/agent-platform layer, then supporting infra.
// `span` is explicit so no row is left with an orphaned half-width card.
const STACK: {
  name: string;
  role: string;
  detail: string;
  icon: LucideIcon;
  span: 2 | 3;
  featured?: boolean;
}[] = [
  {
    name: "Parallel Search API",
    role: "Grounding retrieval",
    detail:
      "POST /v1/search, one query per suspected risk. Returns real URLs, titles, and page excerpts, the only material a flag is ever allowed to cite.",
    icon: Search,
    span: 3,
    featured: true,
  },
  {
    name: "Parallel Task API",
    role: "Deep verification with Basis",
    detail:
      "Opt-in escalation for high-severity flags the fast path can't ground. Returns per-field citations, reasoning, and calibrated confidence instead of a model grading its own work.",
    icon: Telescope,
    span: 3,
    featured: true,
  },
  {
    name: "Gemini Enterprise Agent Platform",
    role: "Google Cloud Agent Runtime",
    detail:
      "The supervisor graph is packaged as a LanggraphAgent targeting Vertex AI's managed Agent Runtime, the platform integration itself, not a backend that merely calls an LLM API. The same compiled graph also runs in-process for local iteration.",
    icon: Cloud,
    span: 3,
    featured: true,
  },
  {
    name: "Gemini 2.5 Flash",
    role: "Vertex AI structured output",
    detail:
      "Two constrained passes per unit: identification, then grounding verification, both schema-bound, never free prose.",
    icon: Zap,
    span: 3,
  },
  {
    name: "LangGraph",
    role: "Multi-agent orchestration",
    detail: "Supervisor fans out to five specialists concurrently; a barrier join holds the aggregator until every branch returns, including failures.",
    icon: Workflow,
    span: 2,
  },
  {
    name: "Neon Postgres",
    role: "Report + audit trail",
    detail: "Every flag persists with its query, result count, verifier reasoning, and grounding method. The receipts outlive the run.",
    icon: Database,
    span: 2,
  },
  {
    name: "Upstash Redis",
    role: "Live status + search cache",
    detail: "Per-agent state streamed to the run view as it happens, and overlapping specialist queries served from cache instead of re-billed.",
    icon: GitBranch,
    span: 2,
  },
];

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: EASE_LAYOUT }}
    >
      {children}
    </motion.div>
  );
}

export default function StackSection() {
  return (
    <div className="flex flex-col gap-14">
      {/* Stage 1-2-3: the grounding loop */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <motion.div
              key={stage.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE_LAYOUT }}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-hairline bg-gradient-to-b from-surface-2 to-surface-1 p-5 backdrop-blur-md transition-colors duration-300 hover:border-hairline-strong"
            >
              {/* The stage number as a large watermark, not a label. Kept
                  fully inside the card's padding box -- the card clips
                  overflow, so any negative offset here reads as a broken
                  crop rather than a deliberate bleed. */}
              <span
                className="pointer-events-none absolute right-5 top-4 select-none font-display text-[64px] font-bold leading-none text-white/[0.05]"
                aria-hidden
              >
                {stage.n}
              </span>

              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-border bg-accent-soft text-accent shadow-[0_0_20px_-8px_rgba(94,106,210,0.9)]">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>

              <div className="flex items-center gap-2">
                <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-primary">{stage.title}</h3>
                {i < STAGES.length - 1 && (
                  <ArrowRight
                    className="h-3.5 w-3.5 text-ink-muted/60 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                )}
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">{stage.body}</p>
            </motion.div>
          );
        })}
      </div>

      {/* The actual stack */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        {STACK.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: EASE_LAYOUT }}
              className={`relative flex flex-col gap-2.5 overflow-hidden rounded-xl border p-5 backdrop-blur-md transition-colors duration-300 ${
                item.span === 3 ? "sm:col-span-3" : "sm:col-span-2"
              } ${
                item.featured
                  ? "border-accent-border/50 bg-gradient-to-br from-accent/[0.07] via-surface-2 to-surface-1"
                  : "border-hairline bg-gradient-to-br from-surface-2 to-surface-1 hover:border-hairline-strong"
              }`}
            >
              {item.featured && (
                <span
                  className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-3xl"
                  style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(94,106,210,0.35), transparent 70%)" }}
                  aria-hidden
                />
              )}

              <div className="relative flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    item.featured
                      ? "border border-accent-border bg-accent-soft text-accent"
                      : "bg-surface-3 text-ink-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-[14px] font-semibold tracking-tight text-ink-primary">
                    {item.name}
                  </h3>
                  <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
                    {item.role}
                  </p>
                </div>
              </div>
              <p className="relative text-[12.5px] leading-relaxed text-ink-secondary">{item.detail}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { Reveal };
