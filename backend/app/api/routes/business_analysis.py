"""Endpoint de análise simulada; não consulta fontes nem gera mensagens."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.ai.base import AnalysisProviderError
from app.api.dependencies import get_business_analysis_service
from app.schemas.business_analysis import BusinessAnalysis, BusinessAnalysisRequest
from app.services.business_analysis_service import BusinessAnalysisService

router = APIRouter(prefix="/api/v1/business-analysis", tags=["Business Analysis"])


@router.post(
    "/analyze",
    response_model=BusinessAnalysis,
    summary="Analisar contexto com provedor simulado, sem LLM",
    responses={
        502: {"description": "Análise indisponível ou inválida"},
        504: {"description": "Prazo de análise excedido"},
    },
)
async def analyze_business(
    query: BusinessAnalysisRequest,
    service: Annotated[BusinessAnalysisService, Depends(get_business_analysis_service)],
) -> BusinessAnalysis:
    try:
        return await service.analyze(query)
    except AnalysisProviderError as exc:
        raise HTTPException(502, "Não foi possível produzir uma análise válida.") from exc
    except TimeoutError as exc:
        raise HTTPException(504, "O prazo para produzir a análise foi excedido.") from exc
