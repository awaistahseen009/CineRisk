// Shared geometry between the live PipelineTree and the homepage's static
// explainer version -- one source of truth so the two never drift apart.
export const NODE_H = 80;
export const SPEC_H = 88;
export const GAP_TRUNK = 48;
export const GAP_BRANCH = 56;
export const TOTAL_H = NODE_H + GAP_TRUNK + NODE_H + GAP_BRANCH + SPEC_H + GAP_BRANCH + NODE_H;

export const CENTER_X = 500;
export const SPECIALIST_XS = [100, 300, 500, 700, 900];

export const TREE_Y = {
  intake: NODE_H / 2,
  supervisor: NODE_H + GAP_TRUNK + NODE_H / 2,
  specialists: NODE_H + GAP_TRUNK + NODE_H + GAP_BRANCH + SPEC_H / 2,
  aggregator: TOTAL_H - NODE_H / 2,
};

export const EASE_LAYOUT = [0.22, 1, 0.36, 1] as const;
export const SPRING_SETTLE = { type: "spring" as const, duration: 0.5, bounce: 0.22 };

// Edges are drawn a few units SHORT of the true node-center distance and
// pulled inward past each node's actual edge -- deliberately overshooting
// a few px UNDER the node card (which paints over it, since cards come
// after the SVG layer in DOM order) rather than stopping exactly at the
// boundary. Any small mismatch between the assumed and real rendered node
// height (fonts, sub-pixel rounding) then reads as "tucked in flush"
// instead of "floating gap."
export const EDGE_INSET = 6;

// The TARGET end of an edge (where the arrowhead marker renders) needs the
// opposite treatment from EDGE_INSET: an arrow drawn exactly at a point
// tucked under the card is painted over by that card (SVG renders before
// the node divs in DOM order), which is why arrows were reading as
// "merged into the nodes." Stopping short by this amount instead leaves
// the arrowhead fully visible in open space, clearly pointing at the node
// rather than disappearing into it.
export const ARROW_GAP = 16;

export function branchPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

// Rounded-elbow connector -- vertical / horizontal / vertical with a small
// curved bend radius, the way real workflow-editor tools (n8n, Zapier,
// Alfred) draw node connections, instead of an organic S-curve. Straight
// down when x1 === x2 (no bend needed).
export const ELBOW_RADIUS = 14;

export function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 === x2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  const dir = x2 > x1 ? 1 : -1;
  const r = Math.min(ELBOW_RADIUS, Math.abs(x2 - x1) / 2, Math.abs(midY - y1), Math.abs(y2 - midY));
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - r}`,
    `Q ${x1} ${midY} ${x1 + dir * r} ${midY}`,
    `L ${x2 - dir * r} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + r}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}
