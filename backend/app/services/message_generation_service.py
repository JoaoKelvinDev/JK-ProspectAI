"""Reavalia o contexto antes de gerar um rascunho fundamentado e não enviado."""

import asyncio

from pydantic import ValidationError

from app.ai.message_prompts import MESSAGE_GENERATION_V1, MESSAGE_PROMPT_VERSION
from app.ai.message_provider import (
    MessageContext,
    MessageContextError,
    MessageProvider,
    MessageProviderError,
)
from app.schemas.business_analysis import BusinessAnalysisRequest
from app.schemas.message_generation import MessageContent, MessageDraft, MessageGenerationRequest
from app.services.business_analysis_service import BusinessAnalysisService


class MessageGenerationService:
    def __init__(self, analyzer: BusinessAnalysisService, provider: MessageProvider) -> None:
        self._analyzer = analyzer
        self._provider = provider

    async def generate(self, query: MessageGenerationRequest) -> MessageDraft:
        async with asyncio.timeout(10):
            return await self._generate(query)

    async def _generate(self, query: MessageGenerationRequest) -> MessageDraft:
        # Não aceita a análise devolvida pelo cliente: revalida os dados de origem atuais.
        context_request = BusinessAnalysisRequest.model_validate(
            query.model_dump(exclude={"selected_need", "channel"})
        )
        analysis = await self._analyzer.analyze(context_request)
        suggestion = next(
            (item for item in analysis.suggestions if item.need == query.selected_need), None
        )
        if suggestion is None:
            raise MessageContextError("A solução escolhida requer evidências atuais na análise.")
        facts = [item for item in analysis.facts if item.id in suggestion.fact_ids]
        context = MessageContext(
            business_name=query.business.name,
            city=query.business.location.city,
            segment=query.business.category,
            need=query.selected_need,
            channel=query.channel,
        )
        try:
            content = await self._provider.generate(context, instructions=MESSAGE_GENERATION_V1)
            validated = MessageContent.model_validate(content.model_dump())
            return MessageDraft(
                prompt_version=MESSAGE_PROMPT_VERSION,
                generated_at=analysis.analyzed_at,
                business_is_simulated=query.business.is_simulated,
                selected_need=query.selected_need,
                channel=query.channel,
                content=validated,
                context_facts=facts,
                limitations=[
                    "Rascunho simulado por modelos de texto, sem LLM; revise conteúdo e contexto.",
                    "Gerar não aprova a mensagem nem autoriza contato. Nenhum envio foi realizado.",
                    *analysis.limitations[1:],
                ],
            )
        except (ValidationError, AttributeError) as exc:
            raise MessageProviderError("Conteúdo de mensagem inválido") from exc
