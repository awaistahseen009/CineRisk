// Mirrors backend/app/models/schemas.py -- keep in sync.

export type SpecialistType =
  | "cultural_sensitivity"
  | "defamation_real_person"
  | "ip_plot_similarity"
  | "trademark_brand_risk"
  | "historical_misrepresentation";

export type Severity = "low" | "medium" | "high";
export type Confidence = "high" | "medium" | "low_ungrounded";
export type FlagStatus = "grounded" | "unconfirmed_suspicion";
export type UnitReviewStatus = "clear" | "flagged";
export type AgentState = "pending" | "running" | "done" | "error";

export interface SourceObject {
  source_title: string;
  source_url: string;
  source_type: "news_article" | "legal_filing" | "advocacy_statement" | "entertainment_press" | "other";
  retrieved_snippet: string;
  image_url: string | null;
}

export interface AuditableUnit {
  id: string;
  run_id: string;
  index: number;
  text: string;
  scene_number: string | null;
  page_range: string | null;
  line_range: string | null;
  unit_type: string;
}

export type GroundingMethod = "search_api" | "task_api";

export interface RiskFlag {
  id: string;
  unit_id: string;
  specialist: SpecialistType;
  excerpt: string;
  explanation: string;
  severity: Severity;
  confidence: Confidence;
  status: FlagStatus;
  sources: SourceObject[];
  // Grounding audit trail -- what was actually searched for this flag, how
  // many results came back, and why the verifier ruled the way it did. This
  // is what lets an ungrounded flag prove the pipeline really tried rather
  // than just asserting "no source found".
  search_query: string | null;
  results_seen: number;
  grounding_reasoning: string | null;
  grounding_method: GroundingMethod;
  grounding_confidence_label: string | null;
}

export interface UnitReport {
  unit: AuditableUnit;
  specialists_consulted: SpecialistType[];
  status: UnitReviewStatus;
  flags: RiskFlag[];
}

export interface AuditReport {
  run_id: string;
  source_document_name: string;
  status?: string;
  created_at?: string | null;
  completed_at?: string | null;
  // Wall-clock time for the whole audit. Null while a run is still in
  // flight -- a partial number would be worse than none.
  duration_seconds?: number | null;
  escalation_tier?: string;
  escalation_severities?: string[];
  units: UnitReport[];
}

export interface AgentStatus {
  agent: string;
  state: AgentState;
  output_count: number | null;
  sources: SourceObject[];
}

export interface RunStatus {
  run_id: string;
  // Which Parallel escalation this run asked for, so the live view can
  // state what will actually be re-queried while it is still running.
  escalation_tier?: string;
  escalation_severities?: string[];
  agents: AgentStatus[];
}
