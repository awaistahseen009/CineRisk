"""Neon (serverless Postgres) engine/session setup via SQLModel."""
from collections.abc import Generator
from functools import lru_cache

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings


@lru_cache
def get_engine():
    settings = get_settings()
    # Neon is serverless Postgres reached over the standard Postgres wire
    # protocol; pool_pre_ping guards against idle connections being dropped.
    return create_engine(settings.database_url, pool_pre_ping=True, echo=False)


def init_db() -> None:
    """Create tables if they don't exist. For real migrations, swap this for
    Alembic once the schema stabilizes."""
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
