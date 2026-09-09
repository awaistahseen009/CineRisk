"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { FileSearch2, GitBranch, LayoutList } from "lucide-react";
import { SPECIALISTS } from "@/lib/specialists";
import { ARROW_GAP, CENTER_X, EASE_LAYOUT, EDGE_INSET, NODE_H, SPEC_H, SPECIALIST_XS, TOTAL_H, TREE_Y as Y, elbowPath } from "@/lib/treeLayout";
import { TreeEdge, TreeEdgeDefs, PortDot } from "@/components/TreeEdge";
import NodeDetailModal, { type NodeDetail } from "@/components/NodeDetailModal";

const TRUNK_NODES = [
  { icon: FileSearch2, label: "Intake", description: "Segments the raw script or treatment into discrete auditable units -- scenes, character introductions, plot beats -- and preserves a mapping back to each unit's exact location in the source document.", y: Y.intake },
  { icon: GitBranch, label: "Supervisor", description: "Reads every unit for content signals -- a named real event, a recognizable character archetype, a joke referencing a nationality or religion -- and routes it to whichever specialists actually apply.", y: Y.supervisor },
];

function StaticNode({
  icon: IconComponent,
  label,
  description,
  delay,
  pulse,
  variant,
  onOpen,
}: {
  icon: typeof FileSearch2;
  label: string;
  description: string;
  delay: number;
  pulse: boolean;
  variant: "major" | "leaf";
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      animate={pulse ? { scale: [1, 1.035, 1] } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={
        pulse
          ? { duration: 0.5, ease: EASE_LAYOUT }
          : { duration: 0.45, delay, ease: EASE_LAYOUT }
      }
      whileHover={{ y: -2 }}
      className={`group relative flex w-full flex-col justify-center gap-1.5 overflow-hidden rounded-lg border border-hairline bg-gradient-to-b from-surface-2 to-surface-1 px-3 py-2.5 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-all duration-200 ease-out hover:border-accent-border hover:shadow-[0_10px_30px_-14px_rgba(94,106,210,0.7)] ${
        variant === "leaf" ? "h-[88px]" : "h-20"
      }`}
    >
      {/* a faint top edge highlight, the detail that makes a card read as
          lit glass rather than a flat rectangle */}
      <span
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden
      />
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent-border bg-accent-soft text-accent transition-shadow duration-200 group-hover:shadow-[0_0_14px_-3px_rgba(94,106,210,0.9)]">
          <IconComponent className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-semibold tracking-tight text-ink-primary">
          {label}
        </span>
      </div>
      <p className="line-clamp-2 pl-8 text-[11px] leading-snug text-ink-secondary">{description}</p>
    </motion.button>
  );
}

const AGGREGATOR_NODE = {
  icon: LayoutList,
  label: "Aggregator",
  description:
    "Collects every specialist's findings per scene, deduplicates overlapping flags raised by more than one specialist, ranks what's left by severity and confidence, and compiles the final scene-anchored report -- including scenes that came back clean.",
};

export default function PipelineVisual() {
  const gradientId = useId().replace(/:/g, "");
  const treeRef = useRef<HTMLDivElement>(null);
  // Edges reveal from ONE shared inView signal for the whole diagram --
  // per-path whileInView is unreliable on a perfectly vertical (zero-width
  // bounding box) SVG path, which is exactly what the trunk edge and any
  // specialist column that lands on the tree's center are.
  const treeInView = useInView(treeRef, { once: true, margin: "-80px" });
  const [pulse, setPulse] = useState(false);
  const [detail, setDetail] = useState<NodeDetail | null>(null);

  useEffect(() => {
    if (!treeInView) return;
    const id = setTimeout(() => setPulse(true), 700);
    return () => clearTimeout(id);
  }, [treeInView]);

  function open(node: { icon: typeof FileSearch2; label: string; description: string }) {
    setDetail({ label: node.label, icon: node.icon, description: node.description });
  }

  return (
    <>
      {/* Desktop / tablet: full branching tree, matching the live run view */}
      <div ref={treeRef} className="relative hidden w-full md:block" style={{ height: TOTAL_H }}>
        <svg viewBox={`0 0 1000 ${TOTAL_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <TreeEdgeDefs gradientId={gradientId} />
          <TreeEdge
            d={elbowPath(CENTER_X, Y.intake + NODE_H / 2 - EDGE_INSET, CENTER_X, Y.supervisor - NODE_H / 2 - ARROW_GAP)}
            state="done"
            revealDelay={0.05}
            active={treeInView}
            gradientId={gradientId}
          />
          {SPECIALIST_XS.map((x, i) => (
            <TreeEdge
              key={`sup-${i}`}
              d={elbowPath(CENTER_X, Y.supervisor + NODE_H / 2 - EDGE_INSET, x, Y.specialists - SPEC_H / 2 - ARROW_GAP)}
              state="done"
              revealDelay={0.15 + i * 0.05}
              active={treeInView}
              gradientId={gradientId}
            />
          ))}
          {SPECIALIST_XS.map((x, i) => (
            <TreeEdge
              key={`agg-${i}`}
              d={elbowPath(x, Y.specialists + SPEC_H / 2 - EDGE_INSET, CENTER_X, Y.aggregator - NODE_H / 2 - ARROW_GAP)}
              state="done"
              revealDelay={0.4 + i * 0.05}
              active={treeInView}
              gradientId={gradientId}
            />
          ))}

          {/* Connection-point markers, all lit -- this is the static
              explainer, always shown "complete." */}
          <PortDot x={CENTER_X} y={Y.intake + NODE_H / 2} lit />
          <PortDot x={CENTER_X} y={Y.supervisor - NODE_H / 2} lit />
          <PortDot x={CENTER_X} y={Y.supervisor + NODE_H / 2} lit />
          {SPECIALIST_XS.map((x, i) => (
            <PortDot key={`sp-top-${i}`} x={x} y={Y.specialists - SPEC_H / 2} lit />
          ))}
          {SPECIALIST_XS.map((x, i) => (
            <PortDot key={`sp-bot-${i}`} x={x} y={Y.specialists + SPEC_H / 2} lit />
          ))}
          <PortDot x={CENTER_X} y={Y.aggregator - NODE_H / 2} lit />
        </svg>

        {TRUNK_NODES.map((node) => (
          <div
            key={node.label}
            className="absolute"
            style={{ left: `${CENTER_X / 10}%`, top: `${(node.y / TOTAL_H) * 100}%`, width: 184, transform: "translate(-50%,-50%)" }}
          >
            <StaticNode {...node} delay={node.label === "Intake" ? 0 : 0.1} pulse={false} variant="major" onOpen={() => open(node)} />
          </div>
        ))}

        {SPECIALIST_XS.map((x, i) => (
          <div
            key={SPECIALISTS[i].type}
            className="absolute"
            style={{ left: `${x / 10}%`, top: `${(Y.specialists / TOTAL_H) * 100}%`, width: 172, transform: "translate(-50%,-50%)" }}
          >
            <StaticNode
              icon={SPECIALISTS[i].icon}
              label={SPECIALISTS[i].shortLabel}
              description={SPECIALISTS[i].description}
              delay={0.2 + i * 0.08}
              pulse={pulse}
              variant="leaf"
              onOpen={() => open({ icon: SPECIALISTS[i].icon, label: SPECIALISTS[i].label, description: SPECIALISTS[i].description })}
            />
          </div>
        ))}

        <div
          className="absolute"
          style={{ left: `${CENTER_X / 10}%`, top: `${(Y.aggregator / TOTAL_H) * 100}%`, width: 184, transform: "translate(-50%,-50%)" }}
        >
          <StaticNode {...AGGREGATOR_NODE} delay={0.55} pulse={false} variant="major" onOpen={() => open(AGGREGATOR_NODE)} />
        </div>
      </div>

      {/* Mobile: simplified vertical stack */}
      <div className="flex w-full flex-col gap-2 md:hidden">
        {TRUNK_NODES.map((node) => (
          <StaticNode key={node.label} {...node} delay={0} pulse={false} variant="major" onOpen={() => open(node)} />
        ))}
        <div className="grid grid-cols-1 gap-2 border-l-2 border-hairline-strong pl-3">
          {SPECIALISTS.map((s) => (
            <StaticNode
              key={s.type}
              icon={s.icon}
              label={s.shortLabel}
              description={s.description}
              delay={0}
              pulse={false}
              variant="leaf"
              onOpen={() => open({ icon: s.icon, label: s.label, description: s.description })}
            />
          ))}
        </div>
        <StaticNode {...AGGREGATOR_NODE} delay={0} pulse={false} variant="major" onOpen={() => open(AGGREGATOR_NODE)} />
      </div>

      <NodeDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}
