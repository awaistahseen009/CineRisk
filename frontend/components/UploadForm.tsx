"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardType,
  Clock,
  LoaderCircle,
  Microscope,
  SlidersHorizontal,
  Telescope,
  Upload,
} from "lucide-react";
import { createRun } from "@/lib/api";
import AdvancedSettingsModal, {
  timeEstimate,
  type EscalationSeverity,
} from "@/components/AdvancedSettingsModal";

type Mode = "file" | "text";

// Mirrors app/api/routes/document_extract.py -- keep in sync. Real
// extraction (and the true "is there any usable content" check) only ever
// happens server-side, but validating the obvious cases here means a bad
// file or an empty paste is caught before a network round trip, not after.
const SUPPORTED_EXTENSIONS = [".txt", ".fountain", ".pdf", ".docx"];
const MIN_CONTENT_CHARS = 20;

function fileTypeError(file: File): string | null {
  const lowered = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((ext) => lowered.endsWith(ext))) {
    return `Unsupported file type. Please upload one of: ${SUPPORTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty. Please choose a file with actual content.`;
  }
  return null;
}

// A single reusable escalation toggle row, since deep verification and deep
// research share the same shape: switch, icon, title, description, and a
// relative time cost stated up front rather than discovered while waiting.
function EscalationToggle({
  active,
  onToggle,
  icon: Icon,
  title,
  description,
  costLabel,
}: {
  active: boolean;
  onToggle: () => void;
  icon: typeof Telescope;
  title: string;
  description: string;
  costLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={`press-feedback flex items-start gap-3 overflow-hidden rounded-md border px-3.5 py-3 text-left transition-colors duration-200 ease-out ${
        active ? "border-accent-border bg-accent-soft" : "border-hairline bg-surface-1 hover:border-hairline-strong"
      }`}
    >
      <span
        className={`mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-out ${
          active ? "bg-accent" : "bg-surface-3"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", duration: 0.3, bounce: 0.25 }}
          className="h-[14px] w-[14px] rounded-full bg-white shadow-raised"
          style={{ marginLeft: active ? "14px" : 0 }}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${active ? "text-accent" : "text-ink-muted"}`} strokeWidth={2.25} />
          <span className={`text-[12.5px] font-semibold ${active ? "text-accent" : "text-ink-secondary"}`}>
            {title}
          </span>
        </span>
        <span className="text-[11.5px] leading-relaxed text-ink-muted">{description}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-severity-medium">
          <Clock className="h-3 w-3" strokeWidth={2.25} />
          {costLabel}
        </span>
      </span>
    </button>
  );
}

export default function UploadForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deepVerification, setDeepVerification] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  // Per-run only: never persisted, never applied to anyone else's run.
  const [severities, setSeverities] = useState<EscalationSeverity[]>(["high"]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const escalationActive = deepVerification || deepResearch;
  const pastedLength = pastedText.trim().length;
  const canSubmit = mode === "file" ? !!file : pastedLength >= MIN_CONTENT_CHARS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await createRun(
        mode === "file" ? (file as File) : pastedText,
        deepVerification,
        deepResearch,
        severities
      );
      router.push(`/run/${run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
      setSubmitting(false);
    }
  }

  // Shared by both the file-input onChange and drag-drop: reject an
  // unsupported or empty file immediately, with the same message the
  // backend would otherwise give back after a round trip.
  function selectFile(picked: File) {
    const problem = fileTypeError(picked);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setError(null);
    setFile(picked);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative flex overflow-hidden rounded-md border border-hairline bg-surface-1 p-1 backdrop-blur-md">
        {(["file", "text"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className="press-feedback relative flex-1 rounded-sm py-1.5 text-[12px] font-medium transition-colors duration-150 ease-out"
          >
            {mode === m && (
              <motion.span
                layoutId="upload-tab-highlight"
                className="absolute inset-0 rounded-sm bg-accent-soft"
                transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
              />
            )}
            <span className={`relative flex items-center justify-center gap-1.5 ${mode === m ? "text-accent" : "text-ink-muted"}`}>
              {m === "file" ? <Upload className="h-3.5 w-3.5" strokeWidth={2} /> : <ClipboardType className="h-3.5 w-3.5" strokeWidth={2} />}
              {m === "file" ? "Upload file" : "Paste text"}
            </span>
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <motion.label
          htmlFor="script-upload"
          animate={dragOver ? { scale: 1.015 } : { scale: 1 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.25 }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`group flex cursor-pointer items-center gap-3 overflow-hidden rounded-md border px-4 py-3 backdrop-blur-md transition-colors duration-150 ease-out ${
            dragOver ? "border-accent bg-accent-soft" : "border-hairline bg-surface-1 hover:border-hairline-strong"
          }`}
        >
          <motion.span animate={dragOver ? { y: -2 } : { y: 0 }} transition={{ type: "spring", duration: 0.3, bounce: 0.4 }}>
            <Upload
              className={`h-4 w-4 shrink-0 transition-colors ${dragOver ? "text-accent" : "text-ink-muted group-hover:text-ink-secondary"}`}
              strokeWidth={2}
            />
          </motion.span>
          <span className={`flex-1 truncate text-left text-[13px] ${dragOver ? "text-accent" : "text-ink-secondary"}`}>
            {file ? file.name : dragOver ? "Drop to select" : "Choose a script, scene, or treatment (.txt, .pdf, .docx, .fountain)"}
          </span>
          <input
            id="script-upload"
            type="file"
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) selectFile(picked);
              // Reset so choosing the same rejected file again still fires
              // onChange, instead of the browser treating it as unchanged.
              e.target.value = "";
            }}
            className="sr-only"
          />
        </motion.label>
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste your script, scene description, or treatment here..."
            rows={5}
            className="w-full resize-none rounded-md border border-hairline bg-surface-1 px-4 py-3 text-[13px] text-ink-primary placeholder:text-ink-muted backdrop-blur-md transition-colors duration-150 ease-out focus:border-hairline-strong focus:outline-none"
          />
          {pastedLength > 0 && pastedLength < MIN_CONTENT_CHARS && (
            <p className="px-1 text-[11px] text-ink-muted">
              Add at least {MIN_CONTENT_CHARS - pastedLength} more character{MIN_CONTENT_CHARS - pastedLength === 1 ? "" : "s"} to audit.
            </p>
          )}
        </div>
      )}

      {/* Two DISTINCT escalation tiers for high-severity flags the fast
          Search API path couldn't ground -- not "the same thing, one just
          slower." Deep verification is a single, targeted re-check on
          Parallel's core tier. Deep research is a materially different
          process: Parallel's pro/ultra tier runs a multi-pass web
          investigation (repeated searching and cross-referencing), aimed at
          precedents a single-pass check would miss entirely, not just
          confirming the same finding with more confidence.

          Exactly one can be active, never both: picking one clears the
          other, matching the backend (deep research takes priority if both
          were somehow requested, so showing both "on" would misrepresent
          what actually runs). The default, with neither selected, is the
          fast Search API path alone for every flag. */}
      <EscalationToggle
        active={deepVerification}
        onToggle={() =>
          setDeepVerification((v) => {
            const next = !v;
            if (next) setDeepResearch(false);
            return next;
          })
        }
        icon={Telescope}
        title="Deep verification (Task API, core)"
        description="One targeted re-check per ungrounded high-severity flag. Real citations and a calibrated confidence score from Parallel's Basis framework, not a second guess from the same model that already looked."
        costLabel="Roughly 2x or more per escalated flag."
      />

      <EscalationToggle
        active={deepResearch}
        onToggle={() =>
          setDeepResearch((v) => {
            const next = !v;
            if (next) setDeepVerification(false);
            return next;
          })
        }
        icon={Microscope}
        title="Deep research (Task API, pro/ultra)"
        description="A broader multi-pass investigation, not a single check: Parallel searches and cross-references repeatedly to surface precedents a one-pass verification would miss, using its highest research tier."
        costLabel="Several times longer again than deep verification, per escalated flag."
      />

      <button
        type="button"
        onClick={() => setAdvancedOpen(true)}
        className="press-feedback flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface-1 px-3.5 py-2.5 text-left transition-colors duration-200 ease-out hover:border-hairline-strong"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2.25} />
          <span className="text-[12.5px] font-semibold text-ink-secondary">Advanced settings</span>
        </span>
        <span className="truncate text-[11px] text-ink-muted">
          {escalationActive
            ? `Escalating ${severities.length > 0 ? severities.join(", ") : "nothing"}`
            : "Severity scope"}
        </span>
      </button>

      {escalationActive && (
        <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-severity-medium">
          <Clock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.25} />
          {timeEstimate(severities.length)}
        </p>
      )}

      <p className="px-1 text-[10.5px] leading-relaxed text-ink-muted">
        Only one of these can be active per run. By default neither is on, and every flag is grounded
        through the fast Search API path alone.
      </p>

      <AdvancedSettingsModal
        open={advancedOpen}
        selected={severities}
        escalationActive={escalationActive}
        onToggle={(value) =>
          setSeverities((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
          )
        }
        onClose={() => setAdvancedOpen(false)}
      />

      <motion.button
        type="submit"
        disabled={!canSubmit || submitting}
        whileTap={canSubmit ? { scale: 0.97 } : undefined}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        className={`group flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[13px] font-semibold transition-colors duration-200 ease-out ${
          canSubmit
            ? "bg-accent text-white hover:bg-accent-hover"
            : "cursor-not-allowed border border-hairline bg-surface-1 text-ink-muted"
        }`}
      >
        {submitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin-linear" strokeWidth={2.25} />
            Starting audit
          </>
        ) : (
          <>
            Audit this script
            <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" strokeWidth={2.25} />
          </>
        )}
      </motion.button>

      {error && <p className="text-[13px] text-severity-high">{error}</p>}
    </form>
  );
}
