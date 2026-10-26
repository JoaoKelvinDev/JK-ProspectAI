"""Ponto de entrada ASGI da aplicação."""

from typing import Literal

from fastapi import FastAPI

from app.api.routes.discovery import router
from app.api.routes.lead_scoring import router as lead_scoring_router
from app.api.routes.website_inspector import router as website_inspector_router

app = FastAPI(
    title="JK Prospect AI",
    version="0.1.0",
    description="Discovery simulado, inspeção de URLs candidatas e scoring com regras explícitas.",
)
app.include_router(router)
app.include_router(website_inspector_router)
app.include_router(lead_scoring_router)


@app.get("/health", tags=["Health"])
def health() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}
