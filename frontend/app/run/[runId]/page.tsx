"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, LoaderCircle, Telescope, Timer, XCircle } from "lucide-react";
import PipelineTree from "@/components/PipelineTree";
import { getRunStatus } from "@/lib/api";
import type { AgentStatus, RunStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-ink-secondary">
      <Timer className="h-3.5 w-3.5" strokeWidth={2} />
      {mm}:{ss}
    </span>
  );
}

// The colour system is load-bearing here, so it is stated outright rather
// than left for the viewer to infer mid-run.
const LEGEND: { label: string; className: string; icon: typeof Circle }[] = [
  { label: "Waiting", className: "text-ink-muted", icon: Circle },
  { label: "Running", className: "text-severity-medium", icon: LoaderCircle },
  { label: "Done", className: "text-severity-low", icon: CheckCircle2 },
  { label: "Failed", className: "text-severity-high", icon: XCircle },
];

function phaseOf(agents: AgentStatus[]): string {
  const by = Object.fromEntries(agents.map((a) => [a.agent, a.state]));
  if (by.aggregator === "done") return "Compiling report";
  if (agents.some((a) => a.state === "error")) return "Run failed";
  if (by.aggregator === "running") return "Compiling report";
  if (agents.some((a) => a.agent.includes("_") && a.state === "running")) return "Specialists running";
  if (by.supervisor === "running") return "Routing scenes";
  if (by.intake === "running") return "Segmenting script";
  return "Starting up";
}

export default function RunStatusPage({ params }: { params: { runId: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await getRunStatus(params.runId);
        if (cancelled) return;
        setStatus(next);
        const aggregator = next.agents.find((a) => a.agent === "aggregator");
        if (aggregator?.state === "done") {
          router.push(`/report/${params.runId}`);
          return;
        }
        // ONLY an aggregator error is terminal. A specialist failing is
        // explicitly survivable: run_specialist catches its own exception,
        // writes an error status, and returns an empty flag list, and the
        // barrier join still fires the aggregator, so the run goes on to
        // finish with the other specialists' findings. Treating any error
        // as fatal here contradicted that resilience and told the user to
        // resubmit a run that was going to complete perfectly well.
        if (aggregator?.state === "error") {
          setError("This run failed while compiling the report. Try submitting again.");
          return;
        }
      } catch (err) {
        // Transient fetch failure -- keep polling rather than giving up
        // permanently on one dropped request.
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load status");
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
    // TODO: swap polling for SSE/WebSocket once the backend streams status.
  }, [params.runId, router]);

  const agents = status?.agents ?? [];
  // Stated live, so it is clear which severities Parallel is actually
  // being re-queried for while the run is still going.
  const escalationTier = status?.escalation_tier ?? "none";
  const escalationSeverities = status?.escalation_severities ?? [];
  // Derived, not stored: a specialist that errored is a degraded run, not a
  // dead one, so it is surfaced as a warning while polling continues.
  const failedSpecialists = useMemo(
    () => agents.filter((a) => a.state === "error" && a.agent !== "aggregator"),
    [agents]
  );
  const doneCount = useMemo(() => agents.filter((a) => a.state === "done").length, [agents]);
  const runningCount = useMemo(() => agents.filter((a) => a.state === "running").length, [agents]);
  const flagsSoFar = useMemo(
    () =>
      agents
        .filter((a) => a.agent !== "aggregator" && a.agent !== "intake" && a.agent !== "supervisor")
        .reduce((sum, a) => sum + (a.output_count ?? 0), 0),
    [agents]
  );
  const progressPct = agents.length > 0 ? (doneCount / agents.length) * 100 : 0;

  return (
    <main className="relative overflow-hidden">
      {/* Ambient sense that the system is working, even between the discrete
          node-state changes the tree diagram itself communicates. */}
      <div className="ambient-field" aria-hidden />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="animate-fade-up opacity-0 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                Live
              </span>
              <h1 className="font-display text-[1.9rem] font-bold leading-tight tracking-tight text-ink-primary">
                {status ? phaseOf(agents) : "Auditing your script"}
              </h1>
              <p className="font-mono text-[11px] tracking-wide text-ink-muted">{params.runId}</p>
            </div>

            <div className="flex items-center gap-5">
              <ElapsedTimer />
              <div className="flex flex-col items-end">
                <span className="font-display text-[1.35rem] font-bold tabular-nums leading-none text-ink-primary">
                  {doneCount}
                  <span className="text-ink-muted">/{agents.length || 8}</span>
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">agents done</span>
              </div>
              {flagsSoFar > 0 && (
                <div className="flex flex-col items-end">
                  <span className="font-display text-[1.35rem] font-bold tabular-nums leading-none text-risk-high">
                    {flagsSoFar}
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">flags so far</span>
                </div>
              )}
            </div>
          </div>

          {/* Overall progress -- one continuous read on how far the run is,
              independent of which individual node you happen to be looking
              at. */}
          <div className="relative h-1 overflow-hidden rounded-full bg-hairline">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-[#B85FD6] shadow-[0_0_12px_0_rgba(94,106,210,0.8)]"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.1 }}
            />
            {runningCount > 0 && (
              <motion.div
                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-4rem", "100%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
            )}
          </div>

          {escalationTier !== "none" && (
            <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-[11.5px] text-accent">
              <Telescope className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              <span className="font-semibold">
                {escalationTier === "research" ? "Deep research" : "Deep verification"}
              </span>
              <span className="text-accent/80">
                Parallel is re-queried for{" "}
                {escalationSeverities.length > 0 ? escalationSeverities.join(", ") : "default"} severity flags the
                fast search could not ground.
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGEND.map(({ label, className, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Icon className={`h-3 w-3 ${className}`} strokeWidth={2.25} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-severity-high-border bg-severity-high-soft px-4 py-3 text-[13px] text-severity-high">
            {error}
          </p>
        )}

        {!error && failedSpecialists.length > 0 && (
          <p className="rounded-lg border border-severity-medium-border bg-severity-medium-soft px-4 py-3 text-[13px] text-severity-medium">
            {failedSpecialists.map((a) => a.agent.replace(/_/g, " ")).join(", ")}{" "}
            {failedSpecialists.length === 1 ? "failed and was" : "failed and were"} skipped. The rest of the audit
            is still running, and the report will be compiled from the specialists that finished.
          </p>
        )}

        {status ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-b from-surface-1/80 to-transparent p-6 backdrop-blur-[2px] sm:p-8"
          >
            <span
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-60 blur-3xl"
              style={{ background: "radial-gradient(40% 60% at 50% 50%, rgba(94,106,210,0.22), transparent 70%)" }}
              aria-hidden
            />
            <div className="relative">
              <PipelineTree agents={agents} />
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-secondary">
            <LoaderCircle className="h-4 w-4 animate-spin-linear" strokeWidth={2.25} />
            Connecting
          </div>
        )}
      </div>
    </main>
  );
}
