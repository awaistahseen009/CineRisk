"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, CircleAlert, FileSearch2, GitBranch, LayoutList, LoaderCircle, XCircle } from "lucide-react";
import { SPECIALISTS } from "@/lib/specialists";
import { agentReason } from "@/lib/agentReason";
import { ARROW_GAP, CENTER_X, EDGE_INSET, SPEC_H, SPECIALIST_XS, SPRING_SETTLE, NODE_H, TOTAL_H, TREE_Y as Y, elbowPath } from "@/lib/treeLayout";
import type { AgentStatus } from "@/lib/types";
import { TreeEdge as Edge, TreeEdgeDefs, PortDot, type EdgeState } from "@/components/TreeEdge";
import NodeDetailModal, { type NodeDetail } from "@/components/NodeDetailModal";

function StateIcon({ state }: { state: AgentStatus["state"] }) {
  if (state === "running") return <LoaderCircle className="h-3.5 w-3.5 animate-spin-linear text-severity-medium" strokeWidth={2.25} />;
  if (state === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-severity-low" strokeWidth={2.25} />;
  if (state === "error") return <XCircle className="h-3.5 w-3.5 text-severity-high" strokeWidth={2.25} />;
  return <Circle className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />;
}

function statusText(status: AgentStatus): string {
  if (status.state === "running") return "Working";
  if (status.state === "error") return "Failed";
  if (status.state !== "done") return "Waiting";

  // output_count means a different thing at each stage: intake reports the
  // units it segmented, the supervisor the units it routed, and only the
  // specialists and the aggregator actually report FLAGS. Labelling all of
  // them "flags" made Intake read as though it had found 15 risks in a
  // document it had merely split into 15 scenes.
  const n = status.output_count ?? 0;
  const plural = n === 1 ? "" : "s";
  if (status.agent === "intake") return `${n} scene${plural}`;
  if (status.agent === "supervisor") return `${n} routed`;
  return `${n} flag${plural}`;
}

// Four unmistakably distinct states -- idle (neutral), running (amber,
// animated), done (green, settles rather than snaps), error (red, with the
// leading icon itself swapped to an alert glyph so failure reads at a
// glance, not just "a different border color").
const CARD_STATE_STYLES: Record<AgentStatus["state"], string> = {
  pending: "border-hairline bg-gradient-to-b from-surface-2 to-surface-1",
  running: "border-severity-medium bg-gradient-to-b from-severity-medium-soft to-surface-1",
  done: "border-severity-low bg-gradient-to-b from-severity-low-soft to-surface-1",
  error: "border-severity-high bg-gradient-to-b from-severity-high-soft to-surface-1",
};

// Each live state also gets its own outer glow, so the tree reads at a
// glance from across a room during a demo -- amber breathing = working,
// green = landed, red = failed -- not just a 1px border difference.
const CARD_STATE_GLOW: Record<AgentStatus["state"], string> = {
  pending: "",
  running: "shadow-[0_0_28px_-8px_rgba(219,161,56,0.75)]",
  done: "shadow-[0_0_26px_-10px_rgba(95,190,138,0.7)]",
  error: "shadow-[0_0_28px_-8px_rgba(232,105,94,0.8)]",
};

const ICON_TILE_STYLES: Record<AgentStatus["state"], string> = {
  pending: "bg-surface-3 text-ink-secondary",
  running: "bg-severity-medium/20 text-severity-medium",
  done: "bg-severity-low/20 text-severity-low",
  error: "bg-severity-high/20 text-severity-high",
};

function NodeCard({
  label,
  icon: IconComponent,
  status,
  variant,
  onOpen,
}: {
  label: string;
  icon: typeof FileSearch2;
  status: AgentStatus;
  variant: "major" | "leaf";
  onOpen: () => void;
}) {
  const isActive = status.state === "running";
  const isDone = status.state === "done";
  const isError = status.state === "error";

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      animate={isDone ? { scale: [1.05, 1] } : { scale: 1 }}
      transition={isDone ? SPRING_SETTLE : { duration: 0.2 }}
      whileHover={{ y: -2 }}
      className={`group relative flex w-full flex-col justify-center gap-1.5 overflow-hidden rounded-lg border px-3 py-2 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-all duration-300 ease-out ${CARD_STATE_STYLES[status.state]} ${CARD_STATE_GLOW[status.state]} ${
        variant === "leaf" ? "h-[88px]" : "h-20"
      }`}
    >
      <span
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden
      />

      {/* Pulsing amber ring while actively processing -- state indication,
          not decoration: the only visual signal a node is genuinely
          working right now, distinct from its resting "running" border. */}
      {isActive && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-severity-medium"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* A light sweep across a working node -- the difference between
          "this is styled as running" and "this is visibly moving." Only
          while running, so a finished tree goes quiet. */}
      {isActive && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
          animate={{ x: ["0%", "400%"] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
          aria-hidden
        />
      )}

      <div className="relative flex items-center gap-2">
        <span
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${ICON_TILE_STYLES[status.state]}`}
        >
          {isError ? (
            <CircleAlert className="relative h-3.5 w-3.5" strokeWidth={2.25} />
          ) : (
            <IconComponent className="relative h-3.5 w-3.5" strokeWidth={2} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-semibold tracking-tight text-ink-primary">
          {label}
        </span>
        <StateIcon state={status.state} />
      </div>
      <span key={statusText(status)} className="animate-fade-in relative truncate pl-8 font-mono text-[10.5px] uppercase tracking-wide text-ink-secondary">
        {statusText(status)}
      </span>
    </motion.button>
  );
}

const EMPTY: AgentStatus = { agent: "", state: "pending", output_count: null, sources: [] };

export default function PipelineTree({ agents }: { agents: AgentStatus[] }) {
  const gradientId = useId().replace(/:/g, "");
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const byName = useMemo(() => Object.fromEntries(agents.map((a) => [a.agent, a])), [agents]);
  const lookup = (name: string): AgentStatus => byName[name] ?? { ...EMPTY, agent: name };

  const intake = lookup("intake");
  const supervisor = lookup("supervisor");
  const specialists = SPECIALISTS.map((s) => lookup(s.type));
  const aggregator = lookup("aggregator");

  const trunkEdge: EdgeState = intake.state === "done" ? "done" : intake.state === "running" ? "active" : "idle";

  function openDetail(agentKey: string, label: string, icon: typeof FileSearch2, description: string, status: AgentStatus) {
    setDetail({
      label,
      icon,
      description,
      state: status.state,
      reason: agentReason(agentKey, status),
      sources: status.sources,
    });
  }

  const nodes = [
    { key: "intake", label: "Intake", icon: FileSearch2, description: "Segments the script into auditable units.", status: intake },
    { key: "supervisor", label: "Supervisor", icon: GitBranch, description: "Routes each unit to relevant specialists.", status: supervisor },
    ...SPECIALISTS.map((s, i) => ({ key: s.type, label: s.shortLabel, icon: s.icon, description: s.description, status: specialists[i] })),
    { key: "aggregator", label: "Aggregator", icon: LayoutList, description: "Dedupes, ranks, and compiles the scene-anchored report.", status: aggregator },
  ];
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));

  return (
    <>
      {/* Desktop / tablet: full branching tree */}
      <div className="relative hidden w-full md:block" style={{ height: TOTAL_H }}>
        <svg
          viewBox={`0 0 1000 ${TOTAL_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <TreeEdgeDefs gradientId={gradientId} />

          <Edge
            d={elbowPath(CENTER_X, Y.intake + NODE_H / 2 - EDGE_INSET, CENTER_X, Y.supervisor - NODE_H / 2 - ARROW_GAP)}
            state={trunkEdge}
            revealDelay={0}
            gradientId={gradientId}
          />

          {SPECIALIST_XS.map((x, i) => {
            // Supervisor->specialist reflects DISPATCH, not success: once a
            // specialist has started (running, done, or even error), the
            // unit demonstrably reached it -- the failure (if any) happened
            // during its own processing, not in transit.
            const supervisorEdge: EdgeState =
              specialists[i].state === "running" || specialists[i].state === "done" || specialists[i].state === "error"
                ? "done"
                : supervisor.state === "running"
                  ? "active"
                  : "idle";
            return (
              <Edge
                key={`sup-${i}`}
                d={elbowPath(CENTER_X, Y.supervisor + NODE_H / 2 - EDGE_INSET, x, Y.specialists - SPEC_H / 2 - ARROW_GAP)}
                state={supervisorEdge}
                revealDelay={0.1 + i * 0.05}
                gradientId={gradientId}
              />
            );
          })}

          {SPECIALIST_XS.map((x, i) => {
            // Specialist->aggregator reflects real output: only a
            // successfully-done specialist "lights up" its edge. A failed
            // specialist's edge shows as a dim red dashed line -- something
            // was supposed to flow here and didn't -- rather than looking
            // identical to a branch that simply hasn't started yet.
            const specialistState = specialists[i].state;
            const aggEdge: EdgeState =
              specialistState === "done"
                ? aggregator.state === "pending"
                  ? "active"
                  : "done"
                : specialistState === "error"
                  ? "error"
                  : "idle";
            return (
              <Edge
                key={`agg-${i}`}
                d={elbowPath(x, Y.specialists + SPEC_H / 2 - EDGE_INSET, CENTER_X, Y.aggregator - NODE_H / 2 - ARROW_GAP)}
                state={aggEdge}
                revealDelay={0.3 + i * 0.05}
                gradientId={gradientId}
              />
            );
          })}

          {/* Connection-point markers -- lit (bright) once real data has
              actually reached/left that point, dim otherwise. */}
          <PortDot x={CENTER_X} y={Y.intake + NODE_H / 2} lit={trunkEdge !== "idle"} />
          <PortDot x={CENTER_X} y={Y.supervisor - NODE_H / 2} lit={trunkEdge !== "idle"} />
          <PortDot x={CENTER_X} y={Y.supervisor + NODE_H / 2} lit={supervisor.state === "done"} />
          {SPECIALIST_XS.map((x, i) => (
            <PortDot key={`sp-top-${i}`} x={x} y={Y.specialists - SPEC_H / 2} lit={specialists[i].state !== "pending"} />
          ))}
          {SPECIALIST_XS.map((x, i) => (
            <PortDot key={`sp-bot-${i}`} x={x} y={Y.specialists + SPEC_H / 2} lit={specialists[i].state === "done"} />
          ))}
          <PortDot x={CENTER_X} y={Y.aggregator - NODE_H / 2} lit={aggregator.state !== "pending"} />
        </svg>

        <div className="absolute" style={{ left: `${CENTER_X / 10}%`, top: `${(Y.intake / TOTAL_H) * 100}%`, width: 176, transform: "translate(-50%,-50%)" }}>
          <NodeCard label="Intake" icon={FileSearch2} status={intake} variant="major" onOpen={() => openDetail("intake", byKey.intake.label, byKey.intake.icon, byKey.intake.description, intake)} />
        </div>
        <div className="absolute" style={{ left: `${CENTER_X / 10}%`, top: `${(Y.supervisor / TOTAL_H) * 100}%`, width: 176, transform: "translate(-50%,-50%)" }}>
          <NodeCard label="Supervisor" icon={GitBranch} status={supervisor} variant="major" onOpen={() => openDetail("supervisor", byKey.supervisor.label, byKey.supervisor.icon, byKey.supervisor.description, supervisor)} />
        </div>
        {SPECIALIST_XS.map((x, i) => (
          <div
            key={SPECIALISTS[i].type}
            className="absolute"
            style={{ left: `${x / 10}%`, top: `${(Y.specialists / TOTAL_H) * 100}%`, width: 168, transform: "translate(-50%,-50%)" }}
          >
            <NodeCard
              label={SPECIALISTS[i].shortLabel}
              icon={SPECIALISTS[i].icon}
              status={specialists[i]}
              variant="leaf"
              onOpen={() => openDetail(SPECIALISTS[i].type, SPECIALISTS[i].label, SPECIALISTS[i].icon, SPECIALISTS[i].description, specialists[i])}
            />
          </div>
        ))}
        <div className="absolute" style={{ left: `${CENTER_X / 10}%`, top: `${(Y.aggregator / TOTAL_H) * 100}%`, width: 176, transform: "translate(-50%,-50%)" }}>
          <NodeCard label="Aggregator" icon={LayoutList} status={aggregator} variant="major" onOpen={() => openDetail("aggregator", byKey.aggregator.label, byKey.aggregator.icon, byKey.aggregator.description, aggregator)} />
        </div>
      </div>

      {/* Mobile: simplified vertical stack, same node content, no SVG tree
          -- five cards side-by-side can't fit a narrow viewport without
          either cramming or hiding real information, so this trades the
          branching visual for legibility rather than distorting it. */}
      <div className="flex w-full flex-col gap-2 md:hidden">
        <NodeCard label="Intake" icon={FileSearch2} status={intake} variant="major" onOpen={() => openDetail("intake", byKey.intake.label, byKey.intake.icon, byKey.intake.description, intake)} />
        <NodeCard label="Supervisor" icon={GitBranch} status={supervisor} variant="major" onOpen={() => openDetail("supervisor", byKey.supervisor.label, byKey.supervisor.icon, byKey.supervisor.description, supervisor)} />
        <div className="grid grid-cols-1 gap-2 border-l-2 border-hairline-strong pl-3">
          {SPECIALISTS.map((s, i) => (
            <NodeCard
              key={s.type}
              label={s.shortLabel}
              icon={s.icon}
              status={specialists[i]}
              variant="leaf"
              onOpen={() => openDetail(s.type, s.label, s.icon, s.description, specialists[i])}
            />
          ))}
        </div>
        <NodeCard label="Aggregator" icon={LayoutList} status={aggregator} variant="major" onOpen={() => openDetail("aggregator", byKey.aggregator.label, byKey.aggregator.icon, byKey.aggregator.description, aggregator)} />
      </div>

      <NodeDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}
