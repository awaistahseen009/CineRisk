"use client";

import { motion } from "framer-motion";
import { EASE_LAYOUT } from "@/lib/treeLayout";

export type EdgeState = "idle" | "active" | "done" | "error";

// One shared connector line component so the live tree and the homepage's
// static explainer render edges identically -- weight, gradient, and the
// marching-dash "data flowing" effect are the tree's visual signature.
//
// Reveal is opacity-only, not `pathLength`-based line-drawing. pathLength
// animation and a manually-set `strokeDasharray` (used below for the
// "active"/"error" states) both want to own stroke-dasharray/dashoffset,
// and on top of that a handful of these paths are perfectly vertical (the
// trunk edge, and any specialist whose column lands on the tree's own
// center) -- either factor is a plausible way for a path to end up stuck
// permanently undrawn. Opacity has no such failure mode: the path is
// always rendered at its full, real length, and only ever fades in.
export function TreeEdge({
  d,
  state,
  revealDelay,
  active = true,
  gradientId,
}: {
  d: string;
  state: EdgeState;
  revealDelay: number;
  active?: boolean;
  gradientId: string;
}) {
  const stroke =
    state === "idle"
      ? "rgba(255,255,255,0.09)"
      : state === "error"
        ? "rgba(232,105,94,0.4)" // severity.high, dimmed -- nothing meaningful flowed, but the branch is marked
        : `url(#${gradientId})`;

  return (
    <>
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={state === "idle" || state === "error" ? 1.75 : 2.75}
        strokeLinecap="round"
        strokeDasharray={state === "active" ? "6 10" : state === "error" ? "2 5" : undefined}
        className={state === "active" ? "animate-[dash_900ms_linear_infinite]" : undefined}
        style={state === "done" ? { filter: "drop-shadow(0 0 7px rgba(147,82,221,0.65))" } : undefined}
        markerEnd={state !== "idle" ? `url(#${gradientId}-arrow)` : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.6, delay: revealDelay, ease: EASE_LAYOUT }}
      />
      {/* Ambient "alive" flow on a completed connection -- a slow, dim
          pulse traveling toward the arrowhead, distinct from the faster
          .dash marching-ants above (that one specifically means "actively
          processing right now"; this one just means "this pipeline runs,"
          persistent and much subtler). */}
      {state === "done" && (
        <motion.path
          d={d}
          fill="none"
          stroke="#E4D3FF"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeDasharray="2 27"
          opacity={0.5}
          className="animate-[hero-pulse_2.8s_linear_infinite]"
          initial={{ opacity: 0 }}
          animate={{ opacity: active ? 0.5 : 0 }}
          transition={{ duration: 0.6, delay: revealDelay + 0.3, ease: EASE_LAYOUT }}
        />
      )}
    </>
  );
}

export function TreeEdgeDefs({ gradientId }: { gradientId: string }) {
  return (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6E78E0" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#B85FD6" stopOpacity="0.95" />
      </linearGradient>
      {/* Directional arrowhead at each edge's target end -- "how a run
          works" should read as a flow, not just a connected diagram. */}
      <marker
        id={`${gradientId}-arrow`}
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#C48AE8" />
      </marker>
    </defs>
  );
}

// Small filled connection-point marker at a node's edge, where a line
// terminates -- the detail that makes this read as a real workflow-tool
// diagram (n8n/Zapier/Alfred-style) rather than freehand curves.
export function PortDot({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <motion.circle
      cx={x}
      cy={y}
      r={4}
      fill={lit ? "#B85FD6" : "#4A4D57"}
      stroke="#08090A"
      strokeWidth={2}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={lit ? { filter: "drop-shadow(0 0 4px rgba(184,95,214,0.8))" } : undefined}
    />
  );
}
