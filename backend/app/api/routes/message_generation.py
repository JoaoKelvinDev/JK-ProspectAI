"""Geração de rascunho, sem endpoint de aprovação ou de envio."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.ai.base import AnalysisProviderError
from app.ai.message_provider import MessageContextError, MessageProviderError
from app.api.dependencies import get_message_generation_service
from app.schemas.message_generation import MessageDraft, MessageGenerationRequest
from app.services.message_generation_service import MessageGenerationService

router = APIRouter(prefix="/api/v1/messages", tags=["Message Generator"])


@router.post(
    "/generate",
    response_model=MessageDraft,
    summary="Gerar rascunho simulado para revisão, sem envio",
    responses={
        409: {"description": "Solução sem suporte em evidências atuais"},
        502: {"description": "Falha de análise ou geração"},
        504: {"description": "Prazo de geração excedido"},
    },
)
async def generate_message(
    query: MessageGenerationRequest,
    service: Annotated[MessageGenerationService, Depends(get_message_generation_service)],
) -> MessageDraft:
    try:
        return await service.generate(query)
    except MessageContextError as exc:
        raise HTTPException(
            409, "A solução escolhida não tem evidências atuais. Revise a análise."
        ) from exc
    except (AnalysisProviderError, MessageProviderError) as exc:
        raise HTTPException(502, "Não foi possível gerar um rascunho válido.") from exc
    except TimeoutError as exc:
        raise HTTPException(504, "O prazo para gerar o rascunho foi excedido.") from exc
