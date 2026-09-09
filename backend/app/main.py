"""FastAPI app: exposes ingestion, run-status, and report endpoints in front
of the LangGraph agent."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ingestion, reports, runs, report_pdf
from app.core.config import get_settings
from app.db.session import init_db

settings = get_settings()

# Uvicorn configures only its own loggers, so nothing from `app.*` at INFO
# ever reached the console: the pipeline's TIMING lines and, more
# importantly, the "Escalating ungrounded ..." line that is the only
# runtime evidence a Task API escalation happened were all invisible. That
# made an escalation that HAD run look like one that never did. Configure
# the app's own logger explicitly so those diagnostics are actually usable.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
logging.getLogger("app").setLevel(logging.INFO)


app = FastAPI(title="CineRisk API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router)
app.include_router(runs.router)
app.include_router(reports.router)
app.include_router(report_pdf.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
