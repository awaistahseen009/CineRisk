"""Central app configuration, loaded from environment variables / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    # Google Cloud / Gemini Enterprise Agent Platform
    google_cloud_project: str = ""
    # "global" routes to Vertex's aiplatform.googleapis.com endpoint rather
    # than a single region's us-central1-aiplatform.googleapis.com. Regional
    # endpoints carry a tight per-region Gemini quota, which is what produced
    # the repeated 429 RESOURCE_EXHAUSTED failures that killed specialists
    # mid-run; the global endpoint pools capacity instead. NOTE: this value
    # is now passed explicitly to ChatVertexAI -- previously it was set here
    # but never handed to the client, so it silently did nothing.
    google_cloud_location: str = "global"
    gemini_model: str = "gemini-2.5-flash"
    # Gemini 2.5 models "think" before answering by default, which costs real
    # latency and extra output tokens on every one of the ~13 calls a run
    # makes. Both LLM steps here are tightly schema-bound (pick suspicions,
    # or pick matching source indices), not open reasoning problems, so the
    # thinking budget buys little. 0 disables it, which cuts latency AND
    # token spend, and lower token spend eases the Vertex per-minute quota
    # that has been producing 429s. Raise it if grounding quality regresses.
    gemini_thinking_budget: int = 0

    # Parallel research API
    parallel_api_key: str = ""

    # Parallel Task API (Basis framework) deep verification -- an ADDITIVE
    # escalation on top of the Search API path, never a replacement for it.
    # Measured on this project's own workload: one 'core' Task run took ~282s
    # versus ~2-4s for a Search API call plus verifier, so it is deliberately
    # off by default and scoped to the flags where the extra rigor is worth
    # the wait (see TASK_API_ESCALATION_NOTE in parallel_task.py).
    enable_task_api_verification: bool = False
    task_api_processor: str = "core"
    task_api_timeout_seconds: float = 600.0

    # Parallel "Deep Research" -- NOT a separate API, the same Task API call
    # above pointed at the pro/ultra processor family instead of core (see
    # docs.parallel.ai/task-api/task-deep-research). A second, deeper,
    # slower escalation tier: still additive, still opt-in per run, still
    # scoped to high-severity flags the fast path could not ground. `pro` is
    # the more conservative of the two tiers Parallel recommends (pro/ultra)
    # -- ultra is markedly slower again and reserved for someone who
    # explicitly wants the absolute deepest pass.
    enable_deep_research: bool = False
    deep_research_processor: str = "pro"
    deep_research_timeout_seconds: float = 1800.0

    # Neon Postgres
    database_url: str = "postgresql+psycopg://user:password@localhost/cinerisk"

    # Upstash Redis
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
