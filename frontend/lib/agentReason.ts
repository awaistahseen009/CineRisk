// Plain-language rationale per agent, shown alongside (never instead of)
// the raw count in the node detail modal -- a number alone isn't an
// explanation of what actually happened.
import type { AgentStatus } from "./types";

export function agentReason(agentKey: string, status: AgentStatus): string | undefined {
  const n = status.output_count ?? 0;
  const plural = (count: number) => (count === 1 ? "" : "s");

  if (status.state === "running") return "Currently reviewing its assigned scenes.";
  if (status.state === "error") return "This step failed to complete for this run.";
  if (status.state !== "done") return "Waiting for the upstream step to finish before it starts.";

  switch (agentKey) {
    case "intake":
      return `Segmented the document into ${n} auditable unit${plural(n)}, preserving each one's location in the source so every downstream flag can point back to exactly where it lives.`;
    case "supervisor":
      return `Reviewed every unit for content signals and routed ${n} unit${plural(n)} to the specialists whose mandate actually applies to it.`;
    case "aggregator":
      return n > 0
        ? `Collected every specialist's findings, deduplicated overlapping flags, and ranked by severity and confidence: ${n} flag${plural(n)} in the final report.`
        : "Collected every specialist's findings and deduplicated them -- no risk flags survived across the whole document.";
    default:
      return n > 0
        ? `Found ${n} flag${plural(n)} in the scenes it reviewed, backed by ${status.sources.length} real grounding source${plural(status.sources.length)}.`
        : "Reviewed every scene routed to it and found nothing worth flagging.";
  }
}
