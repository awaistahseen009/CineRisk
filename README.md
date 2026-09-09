# CineRisk

**Pre-Release Content Risk Audit Agent.** CineRisk reads a screenplay before it is shot or shipped and returns a scene-anchored risk report in which every published finding is backed by a real, retrieved, citable source, so studio compliance, legal, and standards teams can see documented precedent instead of a model's opinion.

---

## Quick links

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Track: Parallel](https://img.shields.io/badge/Hackathon%20Track-Parallel-6f4ff2.svg)](#)
[![Google Cloud: Vertex AI](https://img.shields.io/badge/Google%20Cloud-Vertex%20AI%20%2F%20Gemini%202.5%20Flash-4285F4.svg)](#)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20LangGraph-009688.svg)](#)
[![Frontend: Next.js](https://img.shields.io/badge/Frontend-Next.js%2014%20%2B%20Tailwind-black.svg)](#)

| | |
| --- | --- |
| **Hackathon** | Agentic Cinema: The Blockbuster Hackathon (Google Cloud + partners) |
| **Partner track** | **Parallel** |
| **Google Cloud surface** | Vertex AI, Gemini 2.5 Flash, called at runtime by every agent node |
| **Partner surface** | Parallel Search API and Parallel Task API, called at runtime for every flag |
| **Hosted demo** | https://cinerisk.vercel.app |
| **Demo video** | https://youtu.be/dvQULf6n1wQ |
| **Source repository** | https://github.com/awaistahseen009/CineRisk |
| **Live API** | https://cinerisk-backend-gxcnkkt72a-uc.a.run.app (Cloud Run) |
| **Agent Engine** | `projects/35260314620/locations/us-central1/reasoningEngines/1012621072123559936` |
| **License** | MIT, see [`LICENSE`](LICENSE) |

> Everything in this document was checked against the code as written and against the deployed infrastructure, not recalled. Where something is deployed but not yet serving production traffic, this README says so explicitly rather than rounding up.

---

## 1. The problem

Content risk in film and television is almost always discovered **after** release: a joke that resembles one that triggered a documented backlash, a character whose name, profession, and biography line up too neatly with a real identifiable person, a premise that mirrors a work with an existing litigation history, a brand shown in a context its owner will object to, or a historical claim that a fact checker will dismantle within a day of the premiere. The cost lands as lawsuits, settlements, re-shoots, pulled distribution, and public apologies.

The reason it lands late is not that studios do not care. It is that this check is manual, slow, and dependent on whichever reviewer happens to personally remember the relevant precedent. A 120-page script crossed with five different risk domains is not a review a single person can hold in their head, so in practice the check is partial and inconsistent.

The obvious fix, "ask a large language model," fails for a specific and fatal reason: a model asked whether a scene resembles a past controversy will confidently produce a case name, a plaintiff, and a year, some of which will not exist. In a compliance workflow a fabricated precedent is worse than no answer at all, because someone will act on it.

### Who this is for

| Stakeholder | What they get |
| --- | --- |
| **Studio compliance / standards reviewer** | A scene-by-scene pass over the whole script instead of a spot check, with the exact triggering excerpt quoted |
| **Legal / IP counsel** | Flags that arrive with a retrieved source, a URL, and the exact query used, so the finding can be verified in under a minute |
| **Showrunner / producer** | An early, cheap signal on which scenes will be expensive later, while rewrites are still cheap |
| **Writer** | Specific, sourced feedback on what a portrayal resembles, rather than a vague note to be careful |

---

## 2. What it does

Upload a script (`.pdf`, `.docx`, `.txt`, `.fountain`) or paste raw text. CineRisk then:

1. **Intake** segments the document into *auditable units*, using script formatting conventions (`INT.` / `EXT.` slug lines, character cues) where present and paragraph chunking where not. Each unit keeps a pointer back to its scene number and location in the source, so every finding is anchored to a place in the document.

2. **Supervisor** routes each unit to the specialists whose mandate it actually trips. A unit can go to several specialists at once, or to none. This is a routing decision, not a broadcast, so the run does not pay for five analyses of a scene that only raises one kind of concern.

3. **Five specialists run concurrently**, each with a narrow mandate:

   | Specialist | Mandate |
   | --- | --- |
   | **Cultural Sensitivity** | Identity-linked portrayals, stereotype and comedic framing, religious and cultural references |
   | **Defamation & Real-Person Resemblance** | Characters whose name, role, biography, or traits map onto an identifiable real person |
   | **IP & Plot Similarity** | Premises and distinctive plot mechanics that mirror an existing protected work |
   | **Trademark & Brand Risk** | Real brands, products, and marks shown in contexts their owners contest |
   | **Historical & Factual Misrepresentation** | Depictions of real events, institutions, and figures that are materially contradicted by the record |

4. **Every specialist grounds every suspicion through Parallel** using a two-stage identify-then-verify pipeline (described in full in [section 5](#5-the-grounding-mechanism)). This is not an optional enrichment step. A flag cannot reach the report without a real search having been executed for it, and the schema enforces that.

5. **Aggregator** assembles the per-unit findings into one report: units reviewed and clear are marked clear rather than silently omitted, flags carry severity and grounding status separately, and each flag ships with the exact query that was sent to Parallel, how many results came back, the verifier's reasoning, and the sources that were actually matched.

The report is browsable in the UI (scene on the left, retrieved sources on the right) and exportable to PDF, which is generated server side and includes the full grounding audit trail, not just the prose.

### The core differentiator: no source, no flag

CineRisk will tell you it could not confirm something. A suspicion that no retrieved source substantiates is published as an **unconfirmed suspicion**, visually and semantically distinct from a grounded finding, and it does not get to lead with a severity verdict. That behavior is the product, not a limitation of it. An audit tool that cannot say "I looked and I did not find it" is an audit tool that will eventually invent a lawsuit.

### Optional escalation tiers

Two opt-in, mutually exclusive escalations sit on top of the fast path, configurable per run in the UI (including which severities are eligible):

- **Deep verification** re-checks flags the fast Search path could not ground, using Parallel's **Task API** (`core` processor) with the Basis framework: per-field citations, explicit reasoning, and calibrated confidence.
- **Deep research** does the same against the `pro` processor tier, which is slower and searches considerably harder.

Both are off by default because they cost wall-clock time, and the UI states that cost before you enable it.

---

## 3. Architecture

```mermaid
flowchart TD
    U[Script upload or pasted text] --> EX[Document extraction<br/>pdf / docx / txt / fountain]
    EX --> I[Intake node<br/>segment into auditable units]
    I --> S[Supervisor node<br/>route each unit to relevant specialists]

    S --> C[Cultural Sensitivity]
    S --> D[Defamation and<br/>Real-Person Resemblance]
    S --> P[IP and Plot Similarity]
    S --> T[Trademark and Brand Risk]
    S --> H[Historical and<br/>Factual Misrepresentation]

    C --> A[Aggregator node<br/>dedupe, rank, compile report]
    D --> A
    P --> A
    T --> A
    H --> A

    C -.->|identify, search, verify| PAR[(Parallel<br/>Search API / Task API)]
    D -.-> PAR
    P -.-> PAR
    T -.-> PAR
    H -.-> PAR

    I -.->|structured LLM calls| VX[(Vertex AI<br/>Gemini 2.5 Flash)]
    S -.-> VX
    C -.-> VX

    A --> R[Scene-anchored report<br/>UI + PDF export]
```

### How this maps to LangGraph

The pipeline is a single compiled `StateGraph` in [`backend/app/agents/graph.py`](backend/app/agents/graph.py). Concretely:

- `START -> intake -> supervisor` are plain edges.
- The fan-out is a **conditional edge** out of `supervisor`. `_route_to_specialists` takes the union of specialists assigned across all routing decisions and returns that list of node names, so LangGraph dispatches those branches concurrently. If nothing was routed anywhere it returns `["aggregator"]`, and the graph skips straight to compilation rather than stalling.
- Each specialist node then filters state down to the units routed specifically to it, so one dispatch handles all of that specialist's work for the run.
- Every specialist has a plain edge into `aggregator`, which acts as a **barrier join**: LangGraph waits for all dispatched branches before running it.
- A specialist that fails returns `{"flags": []}` rather than raising, so one dead branch degrades the report instead of killing the run. Only an aggregator failure is terminal.

State is a `TypedDict` (`backend/app/agents/state.py`) with reducer-merged flag lists, which is what makes the concurrent fan-in safe.

---

## 4. Tech stack

Everything listed here is imported and called in the code, not merely referenced in prose.

### Google Cloud

- **Vertex AI**, via `ChatVertexAI` from **`langchain-google-vertexai`**. This is the package actually imported by the running pipeline: see `backend/app/agents/nodes/_specialist_base.py` and `supervisor.py`. Model: **`gemini-2.5-flash`**, with `thinking_budget=0` for latency, authenticated by Application Default Credentials against `GOOGLE_CLOUD_PROJECT`.
- **`GOOGLE_CLOUD_LOCATION=global`** deliberately. See [What we learned](#7-what-we-learned).
- **`google-cloud-aiplatform[agent_engines,langchain]`** is present in `requirements.txt` and is imported by `backend/app/agents/deploy.py`, which wraps the compiled graph in `vertexai.agent_engines.LanggraphAgent` (the current surface, not the older `vertexai.preview.reasoning_engines`) and deploys it to Agent Engine.

#### Deployment status

**The Agent Engine deployment is live.** `python -m app.agents.deploy` was executed against project `cinerisk-hackathon` and created:

```
projects/35260314620/locations/us-central1/reasoningEngines/1012621072123559936
display name: cinerisk-audit-agent
operations:   query, stream_query, get_state, update_state, get_state_history
```

That was confirmed by an independent `agent_engines.list()` call, not just by the deploy script's own output. It wraps the same `build_graph()` the application uses, via `LanggraphAgent(runnable_builder=...)`, packaged with `extra_packages=["app"]` and running as the `cinerisk-backend` service account with its Secret Manager grants.

**What is deliberately not claimed:** production traffic does not run through that engine. The hosted demo executes the identical compiled graph **in-process behind FastAPI on Cloud Run**, which is what the live API URL above points at. The deployed engine has been created and verified as queryable; a full audit has not been driven end to end through its `query` path. Both execute the same graph and both call Vertex AI at runtime.

Two things worth recording, because the obvious version of this deployment does not work:

* `LanggraphAgent.__init__` accepts no `graph` argument, so the intuitive call raises `TypeError` before reaching GCP. The graph has to arrive through `runnable_builder`.
* Agent Engine **reserves** `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` and rejects them with `FAILED_PRECONDITION`, injecting its own region instead. Simply dropping them is a silent regression, because the injected region pulls Gemini calls off the global endpoint and back onto the tight per-region quota described in [What we learned](#7-what-we-learned). That preference travels as `CINERISK_VERTEX_LOCATION` (see `Settings.vertex_location`).

The surrounding infrastructure is Terraform (`terraform/`), with remote state in GCS: Artifact Registry, a dedicated Cloud Run runtime service account, three Secret Manager secrets mounted as secret env vars, and the Agent Engine staging bucket.

What that does and does not change: it does **not** change the Google Cloud dependency, because every model call in every node goes to Vertex AI at runtime either way. It changes **where the graph's process lives**. If deployment is attempted, three things in `deploy.py` need fixing first, and they are known: `requirements=["-r requirements.txt"]` is not a valid requirement spec for the create call, there is no environment or secret plumbing for a remote engine (it would have no `PARALLEL_API_KEY`, `DATABASE_URL`, or Redis credentials), and `vertexai.preview.reasoning_engines` is the older surface. That work was not finished, so this README does not claim it was.

### Parallel (partner track)

- Official **`parallel-web`** Python SDK, `AsyncParallel`.
- **Search API** (`POST /v1/search`) in `backend/app/mcp/parallel_client.py`. This is the grounding path on every flag, on every run, with no toggle to skip it.
- **Task API** (`task_run.execute`, Basis framework) in `backend/app/mcp/parallel_task.py`, powering both escalation tiers. Deep Research is not a separate endpoint: it is the same Task API against the `pro` / `ultra` processor family instead of `core`.
- The search tool is additionally exposed as an **MCP tool server** (`FastMCP`) in `backend/app/mcp/parallel_server.py`, runnable standalone with `python -m app.mcp.parallel_server`, so any MCP-speaking client can call the same grounding tool the agents use.
- Results are cached per run in Redis, so overlapping specialist queries inside one run do not re-hit the API.

### Backend

- **FastAPI** + **Uvicorn**. Runs are accepted at `POST /api/runs` and executed as a background task, so the client gets a `run_id` immediately and polls.
- **SQLModel** over **Neon serverless Postgres** (`psycopg`) for runs, units, flags, and sources.
- **Upstash Redis** via the official REST SDK (`upstash-redis`) for live per-agent status, which is what the animated run view reads, and for search caching.
- **reportlab** for the server-side PDF export; **pypdf** and **python-docx** for document extraction.
- **pytest** / **pytest-asyncio**: 27 tests, currently all passing, including invariant tests asserting that a grounded flag cannot exist without sources and that escalation gating respects the per-run severity selection.

### Frontend

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS** + **Framer Motion** + **lucide-react**.
- Live run view driven by polling `GET /api/runs/{id}/status`; scroll-snapped report view with the scene on the left and its retrieved sources on the right.

### Verified versions in the working environment

`langchain-google-vertexai` 3.2.4, `google-cloud-aiplatform` 1.165.1, `parallel-web` 1.3.3, `fastapi` 0.141.1, `langgraph` 1.2.11, `sqlmodel` 0.0.42, `upstash-redis` 1.8.0, `reportlab` 5.0.1, `pypdf` 6.18.0, `python-docx` 1.2.0, `next` 14.2.35.

---

## 5. The grounding mechanism

This is the part of CineRisk that matters most, so it is worth being precise about what it actually does.

The naive design is one LLM call: "here is a scene, tell me if it is risky and cite a precedent." That design fabricates. Not occasionally, and not because the model is badly prompted: the model is being asked to produce a citation from parametric memory, and a plausible-looking citation is exactly what it is good at producing.

CineRisk splits that into **two calls with a real search in between**, and constrains the second call so that fabrication is structurally impossible rather than merely discouraged.

### Stage 1: Identification (hypothesis only)

The specialist sees one auditable unit and returns a `SuspicionList` via structured output. Each `Suspicion` carries:

- the **exact excerpt** copied verbatim from the unit,
- a plain-language **explanation of the concern**,
- a **severity**, defined as how costly this would be *if it turns out to be real*, deliberately independent of evidence strength,
- a **search query** the model believes would surface a real documented precedent.

The prompt is explicit that this stage issues **no verdict**: "you are identifying SUSPECTED risks only, you are not deciding whether they are real precedent-backed risks; that decision happens later, and only from actual search results, not from you." It is also explicit that an empty list is a valid and expected answer, so a clean scene is not pressured into producing a marginal concern.

Note what this stage never does: it never names a case, a plaintiff, or a URL. It only proposes what to go and check.

### Stage 2: Real search

The `search_query` from stage 1 is sent to **Parallel's Search API** and the real results come back: URLs, titles, publish dates, excerpts. That query string is stored on the flag, so the report can show you exactly what was searched.

### Stage 3: Grounding verification (evidence only)

A second, separate LLM call receives the suspicion and **the real retrieved results**, and returns a `GroundingVerdict`. The constraints that matter:

- **Citation is by index, not by content.** The verifier returns `matched_source_indices`, zero-based positions into the list it was shown. The system then looks up the real title, URL, and snippet by that index. The verifier's own words never become a citation. **It is therefore unable to invent a source title or URL even if it tries**, because there is no field in the contract through which an invented one could travel.
- **Having results is not being grounded.** The prompt states this directly: if none of the results substantiate this specific concern, `grounded=false` is mandatory even though results are sitting in front of the model.
- **On point means on point.** A source counts only if it describes a real case, controversy, lawsuit, complaint, or documented incident that closely matches the specific concern, not merely the same broad category.
- **Uncertainty resolves against the flag.** "If you are unsure whether a source really supports the concern, treat it as not grounded rather than guessing in favor of the suspicion, false negatives are far cheaper than false positives for this product."
- **Confidence is calibrated against facts, not topics.** The prompt makes the model work out what concretely happened in the source and what concretely happens in the scene, then compare those, with explicit anti-rationalization guards. The sharpest one: *"A precedent does not become stronger because nothing better was available."*
- `grounded=false` must arrive with `matched_source_indices=[]` and `confidence=null`.

### What reaches the report

A grounded flag carries its matched sources. An ungrounded flag is downgraded to an **unconfirmed suspicion**: it leads with that label rather than with a severity verdict, and it still shows its full audit trail, meaning the exact query, the number of results returned, and the verifier's reasoning for rejecting them.

That audit trail exists for a specific reason: it is what lets a human distinguish *"there is genuinely no precedent here"* from *"the query was too narrow and this deserves another look."* Results returned but none on point means one thing. Zero results means something quite different. The report shows which happened.

### Enforced at the schema level, not by convention

`RiskFlag.model_post_init` raises if a flag is marked `GROUNDED` with no sources, and raises if a flag has no `search_query`. Both are hard invariants with test coverage. It is not possible for a flag to reach the database claiming grounding it does not have, or claiming a search that never ran.

---

## 6. How to run it locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Google Cloud project with the **Vertex AI API** enabled, plus local ADC (`gcloud auth application-default login`)
- A **Parallel** API key
- A **Neon** Postgres database (any Postgres works)
- An **Upstash Redis** database (REST credentials)

### 1. Clone

```bash
git clone https://github.com/awaistahseen009/CineRisk.git
cd CineRisk
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill it in, see below
```

Fill in `backend/.env`:

```bash
# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global     # read "What we learned" before changing this
GEMINI_MODEL=gemini-2.5-flash
GEMINI_THINKING_BUDGET=0

# Parallel
PARALLEL_API_KEY=your-parallel-key

# Optional escalation tiers (both default off; per-run toggles live in the UI)
ENABLE_TASK_API_VERIFICATION=false
TASK_API_PROCESSOR=core
TASK_API_TIMEOUT_SECONDS=600
ENABLE_DEEP_RESEARCH=false
DEEP_RESEARCH_PROCESSOR=pro
DEEP_RESEARCH_TIMEOUT_SECONDS=1800

# Neon Postgres
DATABASE_URL=postgresql+psycopg://user:password@ep-example.neon.tech/cinerisk?sslmode=require

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# App
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000
```

Authenticate to Google Cloud and start the API:

```bash
gcloud auth application-default login
uvicorn app.main:app --reload --port 8000
```

Check it: `curl http://localhost:8000/health` returns `{"status":"ok"}`. Tables are created on startup.

Run the tests:

```bash
pytest -q      # 27 passed
```

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000, paste a scene or upload a script, and start a run.

### API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/runs` | Start a run from an uploaded file or pasted text. Returns `202` and a `run_id`. Accepts `deep_verification`, `deep_research`, `escalation_severities`. |
| `GET` | `/api/runs/{run_id}/status` | Live per-agent state for the run view |
| `GET` | `/api/runs/{run_id}/report` | Full scene-anchored report JSON |
| `GET` | `/api/runs/{run_id}/report.pdf` | Server-generated PDF including the grounding audit trail |
| `GET` | `/health` | Health check |

### Optional: run the Parallel MCP server standalone

```bash
cd backend && python -m app.mcp.parallel_server
```

---

## 7. What we learned

**Grounding works by refusing, and that is uncomfortable to watch.** The most instructive runs were the ones where a specialist raised a genuinely sensible concern, a real search executed, five real results came back, and the verifier still returned `grounded=false` because none of them were actually on point. A naive pipeline would have cited the closest result and sounded authoritative doing it. Watching the system decline to do that, repeatedly, was the moment the design justified itself. It also forced a UI decision: an unconfirmed suspicion had to stop leading with "HIGH", because a severity verdict on unproven evidence reads as a finding.

**"Unproven" and "cleared" are different, and conflating them is the failure mode nobody warns you about.** The first version of the report implied an ungrounded flag was fine. It is not fine, it is unknown. The report and its info panel now say so explicitly, and every ungrounded flag exposes the query and result count so a human can judge whether the search or the risk was the weak link.

**A quota error was a configuration error.** Specialists were dying with `429 RESOURCE_EXHAUSTED`, which looked like a hard Gemini rate limit. It was not. Two things were wrong: the project was pointed at a regional Vertex endpoint, which carries a far tighter per-region Gemini quota than the `global` endpoint, and `location` was never actually being passed into the `ChatVertexAI` constructor, so the setting was inert regardless. Switching to `global` and passing the location took a representative run from **four 429s and two dead specialists to zero of either**.

**A feature that looks broken can be a gate doing its job.** Deep research appeared to do nothing on a run. The wiring was correct. The escalation gate was scoped to high-severity flags, and that run had no ungrounded high-severity flags, so nothing was eligible. Widening research eligibility to high plus medium made it fire on four flags. The related lesson was uglier: I first reported that zero escalations had fired, and the database showed four. The real bug was that Uvicorn configures only its own loggers, so every `app.*` INFO line, including the only runtime evidence that an escalation had happened, was invisible. Explicit logging configuration went in immediately.

**Measured, the two Parallel paths are a genuine trade, not an upgrade.** On the same Scene 2 cultural sensitivity concern: the Search API path took roughly 2 to 4 seconds and grounded zero of five results. The Task API `core` processor took roughly 230 seconds and grounded the same concern with five real cited incidents from outlets including the New York Times and LA Times. Markedly better precedent, roughly a hundred times the latency. That measurement is why escalation is opt-in and per-run rather than always-on, and why the UI states the time cost before you enable it.

**Failure isolation belongs in the graph, not in the client.** An early frontend bug declared runs dead when any specialist errored. One verified run had in fact completed successfully in 145 seconds with 7 flags, 5 of them grounded, despite one specialist failing. A failing specialist now returns an empty flag list and the run degrades gracefully; only an aggregator failure is terminal.

**Where this goes next.** Escalating every ungrounded high-severity flag through the Task API automatically once the latency is amortized (parallelized escalation, or a background second pass that updates the report in place); a jurisdiction filter, since precedent is not globally portable; and cross-scene aggregation, because a portrayal that is defensible in one scene can become a pattern across eight.

---

## 8. Limitations and honest caveats

- **The deployed Agent Engine is not what serves the demo.** It is genuinely deployed and queryable (resource ID under [Deployment status](#deployment-status)), but the hosted app runs the same compiled graph in-process behind FastAPI on Cloud Run. A full audit has not been driven through the engine's `query` path end to end.
- **The fast path is shallow by design.** Search API grounding takes seconds and will miss precedent that a deeper search would find. That is the trade for a usable interactive run. Deep verification and deep research exist precisely because of it, and they cost minutes, not seconds.
- **Grounding is only as good as the query the model writes.** Stage 1 proposes the search string. A poorly framed query produces a legitimately empty result set that looks identical to a genuine absence of precedent. The tool cannot fully solve this, so it exposes it: the query and the result count are shown on every flag.
- **English only.** Segmentation heuristics assume English script conventions, and grounding searches are English-language.
- **A clear result is not legal clearance.** CineRisk narrows where a human should look. It does not replace counsel, and the report does not pretend to.
- **No authentication or multi-tenancy.** Runs are addressable by ID. This is a hackathon build, not a deployed enterprise service.
- **Segmentation is heuristic.** Well-formatted screenplays segment cleanly on slug lines; loose treatments fall back to paragraph chunking, which produces coarser units and therefore coarser anchoring.
- **Source images are best-effort.** `og:image` extraction is attempted per source and honestly returns null when the image is missing or unrepresentative, rather than substituting a stock graphic.

---

## 9. License

**MIT.** The full text is in [`LICENSE`](LICENSE) at the repository root, which is where GitHub detects it for the About panel.

MIT was chosen because it is the shortest permissive license that is unambiguously recognized by license detectors and by human reviewers, which is exactly what this needs to be. The point is that anyone can read, run, fork, and verify this code without friction.

---

## 10. Team and credits

**Awais Tahseen**, solo. Design, backend, agent architecture, grounding pipeline, and frontend.

**Track:** Parallel, for *Agentic Cinema: The Blockbuster Hackathon*.

Built on Google Cloud Vertex AI (Gemini 2.5 Flash) and Parallel's Search and Task APIs, orchestrated with LangGraph. The real-world risk cases surfaced on the landing page link out to their original reporting; CineRisk does not host or reproduce that material.
