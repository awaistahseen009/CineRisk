import type { AuditReport, RunStatus } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function createRun(
  input: File | string,
  deepVerification = false,
  deepResearch = false,
  escalationSeverities: string[] = []
): Promise<{ run_id: string }> {
  const formData = new FormData();
  if (typeof input === "string") {
    formData.append("text", input);
  } else {
    formData.append("file", input);
  }
  formData.append("deep_verification", String(deepVerification));
  formData.append("deep_research", String(deepResearch));
  formData.append("escalation_severities", escalationSeverities.join(","));

  const res = await fetch(`${API_BASE_URL}/api/runs`, { method: "POST", body: formData });
  if (!res.ok) {
    // FastAPI's HTTPException body is {"detail": "..."} -- that detail is
    // the specific, user-facing reason (unsupported file type, empty
    // content, too-short paste) written for exactly this purpose. Fall back
    // to the status code only if the body isn't shaped as expected.
    const message = await res
      .json()
      .then((body) => (typeof body?.detail === "string" ? body.detail : null))
      .catch(() => null);
    throw new Error(message ?? `Failed to start run: ${res.status}`);
  }
  return res.json();
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch run status: ${res.status}`);
  return res.json();
}

export async function getReport(runId: string): Promise<AuditReport> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/report`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}
