from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, cases, experiments, files, reports, runs
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.storage import ensure_storage_dirs

# Ensure model imports so SQLAlchemy metadata is populated.
from app import models  # noqa: F401


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        ensure_storage_dirs()
        Base.metadata.create_all(bind=engine)
        yield

    app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "app": settings.APP_NAME}

    app.include_router(auth.router, prefix=settings.API_PREFIX)
    app.include_router(cases.router, prefix=settings.API_PREFIX)
    app.include_router(runs.router, prefix=settings.API_PREFIX)
    app.include_router(experiments.router, prefix=settings.API_PREFIX)
    app.include_router(reports.router, prefix=settings.API_PREFIX)
    app.include_router(files.router, prefix=settings.API_PREFIX)
    return app


app = create_app()
