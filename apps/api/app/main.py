from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import models  # noqa: F401 — register metadata
from app.db.migrations import ensure_schema
from app.db.session import Base, SessionLocal, engine
from app.routes import ops, public_v1
from app.services.portfolio import ensure_default_portfolio


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # create_all adds tables but never columns; ensure_schema does the rest.
    ensure_schema(engine)
    db = SessionLocal()
    try:
        ensure_default_portfolio(db, get_settings().initial_cash)
    finally:
        db.close()
    yield


app = FastAPI(title="Outpick API", version="0.1.0", lifespan=lifespan)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(public_v1.router)
app.include_router(ops.router)


@app.get("/health")
def health():
    return {"status": "ok"}
