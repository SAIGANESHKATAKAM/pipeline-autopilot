from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
from app.api import auth, repos, pipeline, webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Pipeline Autopilot",
    description="GitHub App + Dashboard — AI-powered CI/CD failure analyzer and auto-fixer",
    version="2.0.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.frontend_url.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(repos.router)
app.include_router(pipeline.router)
app.include_router(webhook.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pipeline-autopilot", "version": "2.0.0"}


@app.get("/")
async def root():
    return {
        "name": "Pipeline Autopilot",
        "description": "AI-powered GitHub App that auto-fixes CI/CD pipeline failures",
        "dashboard": settings.frontend_url,
        "docs": "/docs",
    }
