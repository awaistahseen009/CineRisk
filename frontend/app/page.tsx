"use client";

import { motion } from "framer-motion";
import { ArrowRight, Layers, Link2, ScanEye, ShieldCheck, Timer } from "lucide-react";
import PipelineVisual from "@/components/PipelineVisual";
import ProblemSection from "@/components/ProblemSection";
import CostSection from "@/components/CostSection";
import StackSection from "@/components/StackSection";
import UploadForm from "@/components/UploadForm";
import { EASE_LAYOUT } from "@/lib/treeLayout";

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

// Section headings sit one clear step below the hero and far above body
// copy, so the page reads as a real typographic hierarchy rather than a
// hero followed by a run of small grey labels. The old treatment set the
// heading itself in 11px mono, which made every section look like a
// footnote; the mono/uppercase register is now demoted to an optional
// kicker above the heading, where that register actually belongs, and the
// accent mark is a solid gradient bar with enough weight to anchor it.
function SectionLabel({
  children,
  sub,
  kicker,
}: {
  children: React.ReactNode;
  sub?: string;
  kicker?: string;
}) {
  return (
    <div className="mb-10 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-[3px] w-9 rounded-full bg-gradient-to-r from-accent to-[#B85FD6]" aria-hidden />
        {kicker && (
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
            {kicker}
          </span>
        )}
      </div>
      <h2 className="text-balance font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] text-ink-primary sm:text-[2.6rem]">
        {children}
      </h2>
      {sub && <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-ink-secondary">{sub}</p>}
    </div>
  );
}

// Facts about how the system actually behaves, stated plainly under the
// upload -- concrete numbers read as a real product; adjectives read as a
// template.
const HERO_STATS = [
  { icon: Layers, value: "5", label: "specialists in parallel" },
  { icon: ShieldCheck, value: "2-stage", label: "grounding per flag" },
  { icon: Timer, value: "2 min", label: "typical audit" },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-field" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 pb-24 pt-24 text-center sm:pt-32">
          <span className="animate-fade-up opacity-0 flex items-center gap-2 overflow-hidden rounded-full border border-hairline bg-surface-1 px-3 py-1 font-mono text-[11px] tracking-wide text-ink-secondary backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Grounded in real, cited sources, not model opinion
          </span>

          <h1
            className="animate-fade-up opacity-0 text-balance font-display text-[3rem] font-bold leading-[0.98] tracking-[-0.03em] text-ink-primary sm:text-[4.5rem] lg:text-[5.5rem]"
            style={{ animationDelay: "60ms" }}
          >
            Catch the{" "}
            <span className="bg-gradient-to-br from-accent via-[#9b7fe8] to-[#d654ad] bg-clip-text text-transparent">
              risk
            </span>
            <br />before it airs.
          </h1>

          <p
            className="animate-fade-up opacity-0 max-w-lg text-balance text-[14.5px] leading-relaxed text-ink-secondary"
            style={{ animationDelay: "120ms" }}
          >
            CineRisk audits scripts scene-by-scene for cultural, legal, brand, and factual risk.
            Five specialist agents run in parallel, every flag traceable to an actual news
            story, lawsuit, or documented controversy.
          </p>

          <div
            className="animate-fade-up opacity-0 relative w-full max-w-md"
            style={{ animationDelay: "180ms" }}
          >
            {/* light pooling under the form so it sits in the scene rather
                than on top of it */}
            <span
              className="pointer-events-none absolute -inset-8 -z-10 opacity-70 blur-3xl"
              style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(94,106,210,0.28), transparent 70%)" }}
              aria-hidden
            />
            <div className="overflow-hidden rounded-xl border border-hairline-strong bg-surface-1 p-4 shadow-panel backdrop-blur-md transition-shadow duration-300 ease-out hover:shadow-[0_0_48px_-14px_rgba(147,82,221,0.5)]">
              <UploadForm />
            </div>
          </div>

          <div
            className="animate-fade-up opacity-0 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-2"
            style={{ animationDelay: "240ms" }}
          >
            {HERO_STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                <span className="font-display text-[15px] font-bold tabular-nums text-ink-primary">{value}</span>
                <span className="text-[12px] text-ink-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative pb-28">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <SectionLabel kicker="The problem">Scripts ship. Then the lawsuits do.</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
              A joke that reads as a slur. A character close enough to be sued over. A plot lifted from
              someone else&apos;s work. These aren&apos;t hypotheticals: they&apos;re documented lawsuits,
              settlements, and backlash, usually caught only after release. CineRisk catches them before, and
              backs every finding with a real, citable source.
            </p>
          </Reveal>
        </div>
        {/* Full-bleed, edge to edge -- deliberately breaking out of the
            max-w-5xl column above it, so the carousel reads as its own wide
            gallery strip rather than another boxed-in content block. */}
        <div className="mt-10">
          <ProblemSection />
        </div>
      </section>

      {/* The price tag, immediately after the gallery of cases: the carousel
          shows WHAT went wrong, this shows what it cost. Every figure links
          out to the original reporting, and settlements are labelled
          separately from amounts merely sued for. */}
      <section className="relative mx-auto max-w-5xl px-6 pb-28">
        <Reveal>
          <SectionLabel
            kicker="What it costs"
            sub="These are not projections. They are settlements actually paid, an amount sued for, and a campaign withdrawn, each one linked to the original reporting. Two of these figures were retrieved by Parallel during a real CineRisk audit run."
          >
            The bill arrives after release.
          </SectionLabel>
        </Reveal>
        <CostSection />
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-28">
        <Reveal>
          <SectionLabel
            kicker="The pipeline"
            sub="One supervisor routes each scene to only the specialists it actually needs. The five run concurrently; the aggregator waits for every branch, including the ones that fail, before compiling anything."
          >
            How a run works
          </SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-b from-surface-1/80 to-transparent p-6 backdrop-blur-[2px] sm:p-8">
            {/* soft interior light so the diagram reads as a lit stage */}
            <span
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-60 blur-3xl"
              style={{ background: "radial-gradient(40% 60% at 50% 50%, rgba(94,106,210,0.22), transparent 70%)" }}
              aria-hidden
            />
            <div className="relative">
              <PipelineVisual />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-28">
        <Reveal>
          <SectionLabel
            kicker="Under the hood"
            sub="Every flag goes through the same three steps, and each one leaves a record. That record is what the report shows you: the query, the results, and the verifier's reasoning."
          >
            How grounding actually works
          </SectionLabel>
        </Reveal>
        <StackSection />
      </section>

      <section className="relative mx-auto max-w-3xl px-6 pb-32">
        <Reveal>
          <div className="group flex flex-col items-start gap-4 overflow-hidden rounded-xl border border-hairline bg-gradient-to-br from-surface-1 to-surface-2/70 p-7 backdrop-blur-md transition-shadow duration-300 ease-out hover:shadow-[0_0_40px_-14px_rgba(147,82,221,0.35)] sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-border bg-accent-soft text-accent">
              <Link2 className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-[16px] font-semibold text-ink-primary">No source, no flag.</h3>
              <p className="mt-1.5 max-w-[58ch] text-[13.5px] leading-relaxed text-ink-secondary">
                Every risk finding ships with a real title, URL, and excerpt. When no grounding
                source can be found, the finding is shown as an unconfirmed suspicion, never
                presented as fact.
              </p>
            </div>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:text-accent sm:block" strokeWidth={2} />
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-hairline">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-6 text-[12px] text-ink-muted">
          <ScanEye className="h-3.5 w-3.5" strokeWidth={2} />
          CineRisk: pre-release content risk audit
        </div>
      </footer>
    </main>
  );
}
