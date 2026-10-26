"""Pontuação comercial sem busca, persistência ou envio de mensagens."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_lead_scoring_service
from app.schemas.lead_scoring import LeadScore, LeadScoringRequest
from app.services.lead_scoring_service import LeadScoringService

router = APIRouter(prefix="/api/v1/lead-scoring", tags=["Lead Scoring"])


@router.post(
    "/score",
    response_model=LeadScore,
    summary="Pontuar oportunidade com evidências fornecidas",
    description=(
        "Regras versionadas e justificadas; as fontes informadas não são consultadas "
        "ou autenticadas automaticamente. A pontuação não autoriza contato comercial."
    ),
)
def score_lead(
    query: LeadScoringRequest,
    service: Annotated[LeadScoringService, Depends(get_lead_scoring_service)],
) -> LeadScore:
    return service.score(query)
