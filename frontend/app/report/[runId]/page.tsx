"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock,
  FileText,
  Gauge,
  Download,
  Info,
  Search,
  Telescope,
  TriangleAlert,
} from "lucide-react";
import ReportFlagCard from "@/components/ReportFlagCard";
import SourceCard from "@/components/SourceCard";
import GroundingInfoModal from "@/components/GroundingInfoModal";
import { getReport } from "@/lib/api";
import { SPECIALIST_MAP } from "@/lib/specialists";
import type { AuditReport, Confidence, RiskFlag, Severity, SourceObject, SpecialistType, UnitReport } from "@/lib/types";

const SEVERITIES: Severity[] = ["high", "medium", "low"];
const CONFIDENCES: Confidence[] = ["high", "medium", "low_ungrounded"];

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low_ungrounded: "Ungrounded",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const IDLE_DELAY_MS = 2200;
const SUMMARY_ID = "__summary__";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

// Filters carry their own semantic color rather than one uniform accent --
// a row of five identical purple pills reads as decoration; severity in its
// own red/amber/gray and confidence in the accent/dashed vocabulary lets you
// see what you're filtering by without reading the labels.
const SEVERITY_PILL: Record<Severity, { on: string; off: string }> = {
  high: {
    on: "border-risk-high-border bg-risk-high-soft text-risk-high shadow-[0_0_14px_-4px_rgba(232,105,94,0.7)]",
    off: "border-hairline text-ink-muted hover:border-risk-high-border hover:text-risk-high",
  },
  medium: {
    on: "border-risk-medium-border bg-risk-medium-soft text-risk-medium shadow-[0_0_14px_-4px_rgba(219,161,56,0.7)]",
    off: "border-hairline text-ink-muted hover:border-risk-medium-border hover:text-risk-medium",
  },
  low: {
    on: "border-risk-low-border bg-risk-low-soft text-risk-low",
    off: "border-hairline text-ink-muted hover:border-risk-low-border hover:text-risk-low",
  },
};

const CONFIDENCE_PILL: Record<Confidence, { on: string; off: string }> = {
  high: {
    on: "border-accent-border bg-accent-soft text-accent shadow-[0_0_14px_-4px_rgba(94,106,210,0.8)]",
    off: "border-hairline text-ink-muted hover:border-accent-border hover:text-accent",
  },
  medium: {
    on: "border-accent-border/60 bg-accent-soft text-accent",
    off: "border-hairline text-ink-muted hover:border-accent-border hover:text-accent",
  },
  low_ungrounded: {
    on: "border-dashed border-hairline-strong bg-surface-1 text-ink-secondary",
    off: "border-dashed border-hairline text-ink-muted hover:text-ink-secondary",
  },
};

function FilterPill({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: { on: string; off: string };
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`press-feedback flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-all duration-200 ease-out ${
        active ? tone.on : tone.off
      }`}
    >
      {children}
    </button>
  );
}

function sceneNumber(unit: UnitReport): string {
  return unit.unit.scene_number ?? String(unit.unit.index + 1).padStart(2, "0");
}

interface FlagSource {
  source: SourceObject;
  specialists: SpecialistType[];
}

function collectFlagSources(flags: RiskFlag[]): FlagSource[] {
  const byUrl = new Map<string, { source: SourceObject; specialists: Set<SpecialistType> }>();
  for (const flag of flags) {
    for (const source of flag.sources) {
      const existing = byUrl.get(source.source_url);
      if (existing) existing.specialists.add(flag.specialist);
      else byUrl.set(source.source_url, { source, specialists: new Set([flag.specialist]) });
    }
  }
  return Array.from(byUrl.values()).map(({ source, specialists }) => ({ source, specialists: Array.from(specialists) }));
}

// True idleness, not just "hasn't scrolled": the cue is a nudge for someone
// who has stopped moving entirely, so any pointer, key, or scroll activity
// resets it.
function useIdle(delayMs: number, scrollEl: HTMLElement | null): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delayMs);
    };
    reset();

    const events = ["mousemove", "wheel", "keydown", "touchstart", "pointerdown"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    scrollEl?.addEventListener("scroll", reset, { passive: true });
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      scrollEl?.removeEventListener("scroll", reset);
    };
  }, [delayMs, scrollEl]);

  return idle;
}

// The "keep scrolling" nudge: a soft glass disc that fades up out of the
// section floor. Only shown on the section you're actually on, only once
// you've gone still, and never on the last section (there is nothing left
// to scroll to).
function ScrollCue({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 10, filter: "blur(8px)", transition: { duration: 0.22, ease: EASE_OUT } }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          aria-label="Scroll to next scene"
          className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5"
        >
          {/* soft light pooling behind the glass, so it reads as lit rather
              than pasted on */}
          <span
            className="pointer-events-none absolute -bottom-6 h-24 w-48 rounded-full opacity-70 blur-2xl"
            style={{ background: "radial-gradient(50% 60% at 50% 50%, rgba(94,106,210,0.28), transparent 75%)" }}
            aria-hidden
          />
          <motion.span
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] shadow-[0_10px_36px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            <ChevronDown className="h-5 w-5 text-ink-primary/80" strokeWidth={1.75} />
          </motion.span>
          <span className="relative font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-muted">Scroll</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function SceneSection({
  unit,
  visibleFlags,
  registerRef,
  showScrollCue,
  onCueClick,
}: {
  unit: UnitReport;
  visibleFlags: RiskFlag[];
  registerRef: (el: HTMLElement | null) => void;
  showScrollCue: boolean;
  onCueClick: () => void;
}) {
  const [focusedFlagId, setFocusedFlagId] = useState<string | null>(null);

  const sources = useMemo(() => collectFlagSources(visibleFlags), [visibleFlags]);
  const focusedFlag = visibleFlags.find((f) => f.id === focusedFlagId) ?? null;
  const focusedUrls = useMemo(() => new Set(focusedFlag?.sources.map((s) => s.source_url) ?? []), [focusedFlag]);
  const focusedSpecialist = focusedFlag ? SPECIALIST_MAP[focusedFlag.specialist] : null;

  const filteredSomethingOut = unit.flags.length > 0 && visibleFlags.length === 0;
  const ungroundedFlags = visibleFlags.filter((f) => f.status === "unconfirmed_suspicion");

  const consultedInfo = unit.specialists_consulted.map((type) => {
    const meta = SPECIALIST_MAP[type];
    const flagged = unit.flags.some((f) => f.specialist === type);
    const grounded = unit.flags.some((f) => f.specialist === type && f.status === "grounded");
    return { type, meta, flagged, grounded };
  });

  return (
    <section
      ref={registerRef}
      data-unit-id={unit.unit.id}
      className="relative flex h-full w-full shrink-0 snap-start snap-always flex-col px-6 py-8 lg:pl-24 lg:pr-10"
    >
      <div className="mr-auto grid h-full w-full max-w-[1680px] grid-cols-1 items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* Left: this scene's report */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.35 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-16 pr-3"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Scene</span>
            <span className="bg-gradient-to-br from-ink-primary via-ink-primary to-ink-secondary bg-clip-text font-display text-[2.5rem] font-bold leading-none tabular-nums text-transparent">
              {sceneNumber(unit)}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-hairline-strong to-transparent" aria-hidden />
            {unit.status === "clear" && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-severity-low-border bg-severity-low-soft px-2.5 py-1 text-[11px] font-semibold text-severity-low">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />
                Reviewed clear
              </span>
            )}
            {visibleFlags.length > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-risk-high-border bg-risk-high-soft px-2.5 py-1 text-[11px] font-semibold text-risk-high">
                {visibleFlags.length} flag{visibleFlags.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {/* The script itself, treated like a manuscript page: an inset
              darker ground with a hairline rule down the gutter, so it reads
              as the source document rather than another UI card. */}
          <div className="relative overflow-hidden rounded-lg border border-hairline bg-gradient-to-b from-ground/70 to-surface-1 p-4 pl-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
            <div className="absolute inset-y-3 left-2.5 w-px bg-hairline-strong" aria-hidden />
            <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-[1.75] text-ink-secondary">
              {unit.unit.text}
            </p>
          </div>

          {visibleFlags.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {visibleFlags.map((flag, fi) => (
                <ReportFlagCard
                  key={flag.id}
                  flag={flag}
                  index={fi}
                  focused={focusedFlagId === flag.id}
                  dimmed={focusedFlagId !== null && focusedFlagId !== flag.id}
                  onFocusChange={setFocusedFlagId}
                />
              ))}
            </div>
          ) : filteredSomethingOut ? (
            <p className="rounded-lg border border-dashed border-hairline-strong px-3 py-5 text-center text-[12px] text-ink-muted">
              This scene has flags, but none match the current filters.
            </p>
          ) : null}
        </motion.div>

        {/* Right: this scene's resources */}
        <motion.aside
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.35 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.08 }}
          className="hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-lg border border-hairline bg-gradient-to-b from-surface-2 to-surface-1 p-4 pb-16 shadow-panel backdrop-blur-xl transition-colors duration-300 lg:flex"
          style={focusedSpecialist ? { borderColor: `${focusedSpecialist.hex}55` } : undefined}
        >
          <div className="flex items-center gap-2.5 border-b border-hairline pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-border bg-accent-soft text-accent shadow-[0_0_18px_-6px_rgba(94,106,210,0.9)]">
              <Search className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[13.5px] font-semibold tracking-tight text-ink-primary">Grounded Resources</p>
              {focusedSpecialist ? (
                <p className={`truncate text-[10.5px] font-medium ${focusedSpecialist.textClass}`}>
                  Backing the {focusedSpecialist.shortLabel} flag
                </p>
              ) : (
                <p className="text-[10.5px] text-ink-muted">Live via the Parallel Search API</p>
              )}
            </div>
          </div>

          {consultedInfo.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {consultedInfo.map(({ type, meta, flagged, grounded }) => {
                const Icon = meta.icon;
                return (
                  <span
                    key={type}
                    title={`${meta.label}${grounded ? ": grounded via Parallel" : flagged ? ": flagged, ungrounded" : ": consulted, no flag"}`}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      flagged ? `${meta.textClass} ${meta.bgSoftClass} ${meta.borderClass}` : "border-hairline text-ink-muted"
                    }`}
                  >
                    <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {meta.shortLabel}
                    {grounded && <Search className="h-2.5 w-2.5" strokeWidth={2.5} />}
                  </span>
                );
              })}
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {sources.map((s, i) => (
                <SourceCard
                  key={s.source.source_url}
                  source={s.source}
                  index={i}
                  specialists={s.specialists}
                  highlighted={focusedFlag !== null && focusedUrls.has(s.source.source_url)}
                  dimmed={focusedFlag !== null && !focusedUrls.has(s.source.source_url)}
                  accentHex={focusedSpecialist?.hex}
                />
              ))}
            </div>
          )}

          {ungroundedFlags.map((flag) => {
            const meta = SPECIALIST_MAP[flag.specialist];
            return (
              <div key={flag.id} className="flex flex-col gap-1.5 rounded-lg border border-dashed border-hairline-strong bg-ground/30 p-3">
                <div className="flex items-center gap-1.5">
                  <CircleDashed className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2} />
                  <span className={`text-[11px] font-semibold ${meta.textClass}`}>{meta.shortLabel}</span>
                  <span className="text-[11px] font-medium text-ink-secondary">no source found</span>
                </div>
                {flag.search_query ? (
                  <>
                    <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">Searched Parallel for</p>
                    <p className="break-words font-mono text-[11px] leading-relaxed text-ink-secondary">{flag.search_query}</p>
                    <p className="text-[10.5px] text-ink-muted">
                      {flag.results_seen} result{flag.results_seen === 1 ? "" : "s"} returned, none substantiated this specific
                      concern, so it stays an unconfirmed suspicion rather than a finding.
                    </p>
                  </>
                ) : (
                  <p className="text-[10.5px] text-ink-muted">
                    Reported before query logging was added, so this flag has no recorded search trail.
                  </p>
                )}
              </div>
            );
          })}

          {sources.length === 0 && ungroundedFlags.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-hairline-strong px-4 py-8 text-center">
              <CheckCircle2 className="h-5 w-5 text-severity-low" strokeWidth={1.75} />
              <p className="text-[12px] text-ink-secondary">Clear. No risk flags raised on this scene.</p>
            </div>
          )}
        </motion.aside>
      </div>

      {/* Fade the section floor so content scrolls away under the cue
          instead of ending at a hard edge. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ground via-ground/70 to-transparent"
        aria-hidden
      />
      <ScrollCue visible={showScrollCue} onClick={onCueClick} />
    </section>
  );
}

export default function ReportPage({ params }: { params: { runId: string } }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set(SEVERITIES));
  const [confidenceFilter, setConfidenceFilter] = useState<Set<Confidence>>(new Set(CONFIDENCES));
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  // A ref, deliberately not state: these are set by inline ref callbacks
  // whose identity changes every render, so storing them in state would
  // re-render on every ref call and loop forever. Refs are populated during
  // commit, before effects run, so the observer below still sees them.
  const sectionEls = useRef<Map<string, HTMLElement>>(new Map());

  const idle = useIdle(IDLE_DELAY_MS, scrollEl);

  useEffect(() => {
    getReport(params.runId)
      .then((r) => {
        setReport(r);
        setActiveUnitId((prev) => prev ?? r.units[0]?.unit.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"));
  }, [params.runId]);

  const totalFlags = useMemo(() => report?.units.reduce((sum, u) => sum + u.flags.length, 0) ?? 0, [report]);
  const clearCount = useMemo(() => report?.units.filter((u) => u.status === "clear").length ?? 0, [report]);
  const groundedFlags = useMemo(
    () => report?.units.reduce((sum, u) => sum + u.flags.filter((f) => f.status === "grounded").length, 0) ?? 0,
    [report]
  );

  function toggle<T>(set: Set<T>, setSet: (s: Set<T>) => void, value: T) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setSet(next);
  }

  function registerSection(unitId: string, el: HTMLElement | null) {
    if (el) sectionEls.current.set(unitId, el);
    else sectionEls.current.delete(unitId);
  }

  // Rendered server-side and streamed back as a blob: the browser stays
  // responsive (no canvas/serialisation work on the UI thread) and the PDF
  // is identical no matter who exports it.
  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
      const res = await fetch(`${base}/api/runs/${params.runId}/report.pdf`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cinerisk-${params.runId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function jumpToUnit(unitId: string) {
    sectionEls.current.get(unitId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!report || !scrollEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.unitId;
          if (!id) continue;
          if (!best || entry.intersectionRatio > best.ratio) best = { id, ratio: entry.intersectionRatio };
        }
        if (best) setActiveUnitId(best.id);
      },
      { root: scrollEl, threshold: [0.5, 0.75, 0.9] }
    );
    sectionEls.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [report, scrollEl]);

  if (error) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center px-6 text-center text-[13px] text-severity-high">
        {error}
      </main>
    );
  }
  if (!report) {
    return (
      <main className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="flex flex-col items-center gap-5"
        >
          {/* Concentric rings expanding outward from the search icon, the
              same visual language as "grounded search" everywhere else in
              the product, so even the loading state reads as this system
              rather than a generic spinner. */}
          <div className="relative flex h-16 w-16 items-center justify-center">
            {[0, 0.7].map((delay) => (
              <motion.span
                key={delay}
                className="absolute inset-0 rounded-full border border-accent-border"
                initial={{ scale: 0.6, opacity: 0.7 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
              />
            ))}
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent-border bg-accent-soft text-accent shadow-[0_0_32px_-6px_rgba(94,106,210,0.9)]">
              <Search className="h-5 w-5" strokeWidth={2.25} />
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="font-display text-[15px] font-semibold text-ink-primary">Loading report</p>
            <p className="font-mono text-[11px] text-ink-muted">Fetching grounded findings</p>
          </div>
        </motion.div>
      </main>
    );
  }

  // The closing summary is now the final stop, so the cue keeps inviting you
  // onward through the last scene. Without special-casing it, findIndex
  // returns -1 there and the rail would snap back to scene 1.
  const onSummary = activeUnitId === SUMMARY_ID;
  const unitIndex = report.units.findIndex((u) => u.unit.id === activeUnitId);
  const activeIndex = onSummary ? report.units.length - 1 : Math.max(0, unitIndex);
  const progressPct = onSummary || report.units.length <= 1 ? 100 : (activeIndex / (report.units.length - 1)) * 100;
  const isLastSection = onSummary;

  const deepVerifiedCount = report.units.reduce(
    (sum, u) => sum + u.flags.filter((f) => f.grounding_method === "task_api").length,
    0
  );

  // The heading is the document's identity. A file upload has a real
  // filename to show; pasted text does not, so fall back to the script's own
  // opening line and let the reader expand for more -- a generic "Pasted
  // script" label tells them nothing about what they're looking at.
  const documentText = report.units.map((u) => u.unit.text).join("\n\n");
  const looksLikeFilename = /\.[a-z0-9]{2,5}$/i.test(report.source_document_name);
  const openingLine = documentText.trim().split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  const heading = looksLikeFilename ? report.source_document_name : openingLine || report.source_document_name;

  function nextSection() {
    if (onSummary) return;
    const next = report!.units[unitIndex + 1];
    jumpToUnit(next ? next.unit.id : SUMMARY_ID);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Scene rail -- large, legible numerals with a real progress track.
          It is the primary way to move around a long report, so it is sized
          like navigation rather than a footnote. */}
      <nav
        className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
        aria-label="Jump to scene"
      >
        {/* Odometer-style crossfade on the counter itself -- section-to-
            section movement should read as a change, not a static label
            that happens to hold different digits. */}
        <div className="relative h-4 w-11 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={onSummary ? "summary" : activeIndex}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-mono text-[10px] tabular-nums tracking-widest text-ink-muted"
            >
              {String(activeIndex + 1).padStart(2, "0")}
              <span className="text-ink-muted/50">/{String(report.units.length).padStart(2, "0")}</span>
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="relative flex max-h-[60vh] flex-col items-center gap-1 overflow-y-auto py-1">
          <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 w-[2px] -translate-x-1/2 rounded-full bg-hairline" aria-hidden />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-2 w-[2px] -translate-x-1/2 rounded-full bg-gradient-to-b from-accent to-accent-hover shadow-[0_0_10px_0_rgba(94,106,210,0.8)]"
            initial={false}
            animate={{ height: `${progressPct}%` }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
            aria-hidden
          />

          {report.units.map((unit, i) => {
            const isActive = unit.unit.id === activeUnitId;
            const hasFlags = unit.flags.length > 0;
            // A focus-lens falloff rather than a flat dim: numbers near the
            // active one stay legible, distant ones recede further, so the
            // whole rail visibly reorganizes around wherever you are instead
            // of every inactive numeral looking identically dull.
            const distance = Math.abs(i - activeIndex);
            const proximity = Math.max(0, 1 - distance * 0.16);
            return (
              <button
                key={unit.unit.id}
                type="button"
                onClick={() => jumpToUnit(unit.unit.id)}
                aria-current={isActive}
                title={`Scene ${sceneNumber(unit)}${hasFlags ? `: ${unit.flags.length} flag${unit.flags.length === 1 ? "" : "s"}` : ": clear"}`}
                className="press-feedback group relative flex h-10 w-10 items-center justify-center"
              >
                {isActive && (
                  <motion.span
                    layoutId="rail-active-pill"
                    className="absolute inset-0 rounded-xl border border-accent-border bg-accent-soft shadow-[0_0_22px_-6px_rgba(94,106,210,0.9)] backdrop-blur-md"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                  />
                )}
                <motion.span
                  animate={
                    isActive
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0.62 + proximity * 0.2, opacity: 0.22 + proximity * 0.48 }
                  }
                  transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  className={`relative font-display text-[20px] font-bold tabular-nums leading-none transition-colors duration-200 ${
                    isActive
                      ? "text-accent"
                      : distance <= 1
                        ? "text-ink-primary group-hover:text-ink-primary"
                        : "text-ink-secondary group-hover:text-ink-primary"
                  }`}
                >
                  {sceneNumber(unit)}
                </motion.span>
                {hasFlags && (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-risk-high shadow-[0_0_6px_0_rgba(232,105,94,0.9)]"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}

          {/* Final stop: the run's own summary */}
          <button
            type="button"
            onClick={() => jumpToUnit(SUMMARY_ID)}
            aria-current={onSummary}
            title="Audit summary"
            className="press-feedback group relative flex h-10 w-10 items-center justify-center"
          >
            {onSummary && (
              <motion.span
                layoutId="rail-active-pill"
                className="absolute inset-0 rounded-xl border border-accent-border bg-accent-soft shadow-[0_0_22px_-6px_rgba(94,106,210,0.9)] backdrop-blur-md"
                transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
              />
            )}
            <motion.span
              animate={{ scale: onSummary ? 1 : 0.78, opacity: onSummary ? 1 : 0.55 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              className={`relative ${onSummary ? "text-accent" : "text-ink-secondary group-hover:text-ink-primary"}`}
            >
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </motion.span>
          </button>
        </div>
      </nav>

      {/* Compact document header -- a masthead, not a title slide. */}
      <header className="shrink-0 border-b border-hairline bg-gradient-to-b from-surface-1 to-transparent px-6 pb-4 pt-6 backdrop-blur-sm lg:pl-24 lg:pr-10">
        <div className="mr-auto flex w-full max-w-[1680px] flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2} />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-muted">
                  {looksLikeFilename ? "Audited document" : report.source_document_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDocOpen((v) => !v)}
                className="press-feedback group flex min-w-0 items-center gap-2 text-left"
              >
                <h1 className="truncate font-display text-[1.6rem] font-bold leading-tight tracking-tight text-ink-primary sm:text-[1.9rem]">
                  {heading}
                </h1>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ease-drawer group-hover:text-ink-secondary ${
                    docOpen ? "rotate-90" : ""
                  }`}
                  strokeWidth={2.25}
                />
              </button>
              <p className="text-[12.5px] text-ink-secondary">
                {report.units.length} units reviewed, {clearCount} clear,{" "}
                <span className="font-medium text-risk-high">{totalFlags} flags</span>,{" "}
                <span className="font-medium text-accent">{groundedFlags} grounded</span>{" "}
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  aria-label="What does grounded mean?"
                  title="What do grounded and unconfirmed mean?"
                  className="press-feedback inline-flex h-[18px] w-[18px] translate-y-[3px] items-center justify-center rounded-full border border-hairline-strong text-ink-muted transition-colors duration-150 hover:border-accent-border hover:text-accent"
                >
                  <Info className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </p>

              {/* What Parallel was actually asked to do on THIS run, stated
                  on the finished report and not just at upload time. */}
              {report.escalation_tier && report.escalation_tier !== "none" && (
                <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-accent">
                  <Telescope className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                  <span className="font-semibold">
                    {report.escalation_tier === "research" ? "Deep research" : "Deep verification"}
                  </span>
                  <span className="text-accent/80">
                    re-queried Parallel for{" "}
                    {(report.escalation_severities ?? []).length > 0
                      ? (report.escalation_severities ?? []).join(", ")
                      : "default"}{" "}
                    severity flags
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting}
                className="press-feedback flex items-center gap-1.5 rounded-md border border-hairline-strong bg-surface-1 px-3 py-1.5 text-[11.5px] font-semibold text-ink-secondary transition-colors duration-150 hover:text-ink-primary disabled:cursor-wait disabled:text-ink-muted"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
                {exporting ? "Preparing PDF" : "Export PDF"}
              </button>
              <div className="h-4 w-px bg-hairline" aria-hidden />
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
                <div className="flex gap-1.5">
                  {SEVERITIES.map((s) => (
                    <FilterPill
                      key={s}
                      active={severityFilter.has(s)}
                      tone={SEVERITY_PILL[s]}
                      onClick={() => toggle(severityFilter, setSeverityFilter, s)}
                    >
                      {s}
                    </FilterPill>
                  ))}
                </div>
              </div>
              <div className="h-4 w-px bg-hairline" aria-hidden />
              <div className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
                <div className="flex gap-1.5">
                  {CONFIDENCES.map((c) => (
                    <FilterPill
                      key={c}
                      active={confidenceFilter.has(c)}
                      tone={CONFIDENCE_PILL[c]}
                      onClick={() => toggle(confidenceFilter, setConfidenceFilter, c)}
                    >
                      {CONFIDENCE_LABELS[c]}
                    </FilterPill>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="accordion-panel" data-open={docOpen}>
            <div className="overflow-hidden">
              <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-ground/50 p-3 font-mono text-[11.5px] leading-relaxed text-ink-secondary">
                {documentText.slice(0, 1200)}
                {documentText.length > 1200 ? "…" : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div ref={setScrollEl} className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll scroll-smooth">
        {report.units.map((unit) => (
          <SceneSection
            key={unit.unit.id}
            unit={unit}
            visibleFlags={unit.flags.filter(
              (f) => severityFilter.has(f.severity) && confidenceFilter.has(f.confidence)
            )}
            registerRef={(el) => registerSection(unit.unit.id, el)}
            showScrollCue={idle && !isLastSection && unit.unit.id === activeUnitId}
            onCueClick={nextSection}
          />
        ))}

        {/* Closing summary -- the audit's own receipt: coverage, how much of
            it is actually grounded, and what the run cost in wall clock. */}
        <section
          ref={(el) => registerSection(SUMMARY_ID, el)}
          data-unit-id={SUMMARY_ID}
          className="relative flex h-full w-full shrink-0 snap-start snap-always flex-col justify-center px-6 py-8 lg:pl-24 lg:pr-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="mr-auto flex w-full max-w-[1680px] flex-col gap-5"
          >
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Audit complete</span>
              <h2 className="font-display text-[2rem] font-bold leading-tight tracking-tight text-ink-primary">
                {report.units.length} units reviewed, {totalFlags} flag{totalFlags === 1 ? "" : "s"} raised
              </h2>
            </div>

            <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Time taken", value: report.duration_seconds != null ? formatDuration(report.duration_seconds) : "n/a", icon: Clock, tone: "text-ink-primary" },
                { label: "Grounded", value: `${groundedFlags}/${totalFlags}`, icon: Search, tone: "text-accent" },
                { label: "Unconfirmed", value: String(totalFlags - groundedFlags), icon: CircleDashed, tone: "text-ink-secondary" },
                { label: "Clear scenes", value: String(clearCount), icon: CheckCircle2, tone: "text-severity-low" },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div
                  key={label}
                  className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-gradient-to-b from-surface-2 to-surface-1 p-3.5 backdrop-blur-md"
                >
                  <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">
                    <Icon className="h-3 w-3" strokeWidth={2.25} />
                    {label}
                  </span>
                  <span className={`font-display text-[1.5rem] font-bold tabular-nums leading-none ${tone}`}>{value}</span>
                </div>
              ))}
            </div>

            <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
              Every flag above was produced by a specialist that issued a real Parallel search. The exact query
              and result count are recorded on each one.{" "}
              {deepVerifiedCount > 0 ? (
                <>
                  {deepVerifiedCount} flag{deepVerifiedCount === 1 ? " was" : "s were"} escalated to the Parallel Task
                  API for deep verification with cited sources and calibrated confidence.
                </>
              ) : (
                <>
                  This run used the fast Search API path only. Enable deep verification at upload to re-check
                  ungrounded high-severity flags with Parallel&apos;s Task API.
                </>
              )}
            </p>
          </motion.div>
        </section>
      </div>
      <GroundingInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
