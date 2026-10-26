"""Ponto de entrada ASGI da aplicação."""

from typing import Literal

from fastapi import FastAPI

from app.api.routes.business_analysis import router as business_analysis_router
from app.api.routes.discovery import router
from app.api.routes.lead_scoring import router as lead_scoring_router
from app.api.routes.message_generation import router as message_generation_router
from app.api.routes.website_inspector import router as website_inspector_router

app = FastAPI(
    title="JK Prospect AI",
    version="0.1.0",
    description=(
        "Discovery simulado, inspeção de URLs candidatas, scoring com regras explícitas "
        "e análise e rascunhos comerciais com provedores simulados, sem LLM e sem envio."
    ),
)
app.include_router(router)
app.include_router(website_inspector_router)
app.include_router(lead_scoring_router)
app.include_router(business_analysis_router)
app.include_router(message_generation_router)


@app.get("/health", tags=["Health"])
def health() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}
