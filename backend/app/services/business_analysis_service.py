"""Seleciona fatos rastreáveis e valida as sugestões do provedor."""

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime

from pydantic import ValidationError

from app.ai.base import AnalysisProviderError, BusinessAnalysisProvider
from app.ai.prompts import BUSINESS_ANALYSIS_V1, PROMPT_VERSION
from app.ai.solutions import SOLUTION_LABELS
from app.core.scoring_policy import EVIDENCE_MAX_AGE
from app.schemas.business_analysis import (
    AnalysisDraft,
    AnalysisFact,
    BusinessAnalysis,
    BusinessAnalysisRequest,
)
from app.schemas.lead_scoring import DigitalNeed, ScoringEvidence
from app.schemas.website_inspection import WebsiteStatus


def _utc_now() -> datetime:
    return datetime.now(UTC)


class BusinessAnalysisService:
    def __init__(
        self, provider: BusinessAnalysisProvider, clock: Callable[[], datetime] = _utc_now
    ) -> None:
        self._provider = provider
        self._clock = clock

    async def analyze(self, query: BusinessAnalysisRequest) -> BusinessAnalysis:
        now = self._clock()
        if now.utcoffset() is None:
            raise ValueError("O relógio de análise deve informar fuso horário")
        now = now.astimezone(UTC)
        limitations = [
            "Análise simulada por regras e modelos de texto; nenhum LLM foi utilizado.",
            "Fatos descrevem o contexto fornecido. Fontes e observações do operador não "
            "foram autenticadas ou verificadas automaticamente; revise antes de decidir.",
        ]
        if query.business.is_simulated:
            limitations.append("O estabelecimento é fictício; o resultado serve para demonstração.")

        def fresh(value: datetime) -> bool:
            warning = None
            if value > now:
                warning = "Evidências com data futura foram desconsideradas."
            elif now - value > EVIDENCE_MAX_AGE:
                warning = "Evidências com mais de 90 dias foram desconsideradas."
            if warning and warning not in limitations:
                limitations.append(warning)
            return warning is None

        business = query.business
        facts = [
            AnalysisFact(
                id="business_profile",
                kind="business_profile",
                statement=(
                    f"Cadastro informado: {business.name}; segmento {business.category}; "
                    f"{business.location.city}/{business.location.state}."
                ),
            )
        ]
        for index, item in enumerate(query.needs):
            if fresh(item.evidence.observed_at):
                facts.append(
                    AnalysisFact(
                        id=f"need_{index}",
                        kind="documented_need",
                        statement=(
                            f"Necessidade registrada pelo operador: {SOLUTION_LABELS[item.need]}."
                        ),
                        need=item.need,
                        evidence=[item.evidence],
                    )
                )
        for index, item in enumerate(query.activity_evidence):
            if fresh(item.observed_at):
                facts.append(
                    AnalysisFact(
                        id=f"activity_{index}",
                        kind="digital_activity",
                        statement="O operador forneceu uma observação de atividade digital.",
                        evidence=[item],
                    )
                )
        review = query.website_review
        if review is not None and all(
            [
                fresh(value)
                for value in [review.reviewed_at, *(e.observed_at for e in review.evidence)]
            ]
        ):
            statements = {
                "not_found": "A revisão manual informa site não localizado nas buscas "
                "documentadas; isso não comprova inexistência de site.",
                "found": "A revisão manual informa um site candidato; o vínculo oficial "
                "ainda precisa de confirmação.",
                "inconclusive": "A revisão manual foi inconclusiva sobre a presença de site.",
            }
            facts.append(
                AnalysisFact(
                    id="website_review",
                    kind="website_review",
                    statement=statements[review.status],
                    need=DigitalNeed.WEBSITE if review.status == "not_found" else None,
                    evidence=review.evidence,
                )
            )
        inspection = query.website_inspection
        if (
            inspection is not None
            and inspection.checked_at is not None
            and all(
                [
                    fresh(value)
                    for value in [
                        inspection.checked_at,
                        *(e.observed_at for e in inspection.evidence),
                    ]
                ]
            )
        ):
            facts.append(
                AnalysisFact(
                    id="website_inspection",
                    kind="website_inspection",
                    statement=(
                        "A inspeção identificou um site candidato por correspondência textual; "
                        "isso não confirma propriedade oficial."
                        if inspection.status == WebsiteStatus.FOUND
                        else "A inspeção da URL foi inconclusiva; não estabelece ausência de site."
                    ),
                    evidence=[
                        ScoringEvidence(
                            source="http",
                            source_url=e.url,
                            observed_at=e.observed_at,
                            description=f"Resposta HTTP {e.status_code}; tipo {e.content_type}.",
                        )
                        for e in inspection.evidence
                    ],
                )
            )
        if not any(item.need is not None for item in facts):
            limitations.append(
                "Sem necessidade documentada atual, nenhuma solução é sugerida. "
                "Segmento e URL vazia não comprovam uma oportunidade."
            )
        # O provedor recebe uma cópia: não pode alterar os fatos da resposta.
        context = tuple(item.model_copy(deep=True) for item in facts)
        try:
            async with asyncio.timeout(10):
                draft = await self._provider.analyze(context, instructions=BUSINESS_ANALYSIS_V1)
            validated = AnalysisDraft.model_validate(draft.model_dump())
            return BusinessAnalysis(
                prompt_version=PROMPT_VERSION,
                analyzed_at=now,
                business_is_simulated=business.is_simulated,
                status="ready_for_review" if validated.suggestions else "insufficient_evidence",
                facts=facts,
                limitations=limitations,
                suggestions=validated.suggestions,
            )
        except (ValidationError, AttributeError) as exc:
            raise AnalysisProviderError("Resposta de análise inválida") from exc
