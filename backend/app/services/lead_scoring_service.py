"""Pontuação determinística sobre evidências fornecidas, sem chamadas externas."""

from collections.abc import Callable, Iterable
from datetime import UTC, datetime

from pydantic import HttpUrl

from app.core.scoring_policy import (
    ADDRESS_POINTS,
    CURRENT_EVIDENCE_POINTS,
    EVIDENCE_MAX_AGE,
    MAX_POINTS,
    POINTS_PER_DISTINCT_NEED,
    RULES_VERSION,
    SOURCE_ID_POINTS,
)
from app.schemas.lead_scoring import (
    CriterionName,
    LeadScore,
    LeadScoringRequest,
    ScoreCriterion,
    ScoringWarning,
)
from app.schemas.website_inspection import WebsiteStatus


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _criterion(
    name: CriterionName,
    points: int,
    assessed: bool,
    reason: str,
    urls: Iterable[HttpUrl] = (),
) -> ScoreCriterion:
    return ScoreCriterion(
        name=name,
        points=points,
        max_points=MAX_POINTS[name],
        assessed=assessed,
        reason=reason,
        evidence_urls=list(dict.fromkeys(urls)),
    )


class LeadScoringService:
    def __init__(self, clock: Callable[[], datetime] = _utc_now) -> None:
        self._clock = clock

    def score(self, query: LeadScoringRequest) -> LeadScore:
        now = self._clock()
        if now.utcoffset() is None:
            raise ValueError("O relógio de avaliação deve informar fuso horário")
        now = now.astimezone(UTC)
        warnings: list[ScoringWarning] = []

        def warn(value: ScoringWarning) -> None:
            if value not in warnings:
                warnings.append(value)

        def fresh(value: datetime) -> bool:
            if value > now:
                warn(ScoringWarning.FUTURE_EVIDENCE)
                return False
            if now - value > EVIDENCE_MAX_AGE:
                warn(ScoringWarning.STALE_EVIDENCE)
                return False
            return True

        if query.business.is_simulated:
            warn(ScoringWarning.SIMULATED_DATA)
        needs = [item for item in query.needs if fresh(item.evidence.observed_at)]
        activity = [item for item in query.activity_evidence if fresh(item.observed_at)]
        review = query.website_review
        if review is not None:
            dates = [review.reviewed_at, *(item.observed_at for item in review.evidence)]
            if not all([fresh(value) for value in dates]):
                review = None
        inspection = query.website_inspection
        if inspection is not None and inspection.checked_at is not None:
            dates = [inspection.checked_at, *(item.observed_at for item in inspection.evidence)]
            if not all([fresh(value) for value in dates]):
                inspection = None

        website_urls: list[HttpUrl] = []
        if review is not None:
            website_urls.extend(item.source_url for item in review.evidence)
        if inspection is not None:
            website_urls.extend(item.url for item in inspection.evidence)

        if review is not None and review.status == "not_found":
            website = _criterion(
                CriterionName.WEBSITE_OPPORTUNITY,
                MAX_POINTS[CriterionName.WEBSITE_OPPORTUNITY],
                True,
                "Site não localizado na revisão manual documentada; não prova inexistência.",
                (item.source_url for item in review.evidence),
            )
        elif (review is not None and review.status == "found") or (
            inspection is not None and inspection.status == WebsiteStatus.FOUND
        ):
            website = _criterion(
                CriterionName.WEBSITE_OPPORTUNITY,
                0,
                True,
                "Site candidato identificado; não recebe pontos por ausência de site.",
                website_urls,
            )
        else:
            warn(ScoringWarning.WEBSITE_NOT_ASSESSED)
            website = _criterion(
                CriterionName.WEBSITE_OPPORTUNITY,
                0,
                False,
                "Ausência de site não estabelecida; URL vazia ou falha HTTP não pontuam.",
                website_urls,
            )

        need_urls = [item.evidence.source_url for item in needs]
        distinct_needs = {item.need for item in needs}
        if not needs:
            warn(ScoringWarning.NEED_NOT_ASSESSED)
        if not activity:
            warn(ScoringWarning.ACTIVITY_NOT_ASSESSED)
        current_urls = [*need_urls, *(item.source_url for item in activity), *website_urls]
        quality_points = (
            (ADDRESS_POINTS if query.business.location.address else 0)
            + (SOURCE_ID_POINTS if query.business.source_id else 0)
            + (CURRENT_EVIDENCE_POINTS if current_urls else 0)
        )
        criteria = [
            website,
            _criterion(
                CriterionName.DIGITAL_NEED,
                min(
                    len(distinct_needs) * POINTS_PER_DISTINCT_NEED,
                    MAX_POINTS[CriterionName.DIGITAL_NEED],
                ),
                bool(needs),
                "15 pontos por necessidade distinta documentada, até 30 pontos."
                if needs
                else "Nenhuma necessidade com evidência atual foi informada.",
                need_urls,
            ),
            _criterion(
                CriterionName.DIGITAL_ACTIVITY,
                MAX_POINTS[CriterionName.DIGITAL_ACTIVITY] if activity else 0,
                bool(activity),
                "Atividade digital documentada nos últimos 90 dias."
                if activity
                else "Atividade desconhecida; não equivale a negócio inativo.",
                (item.source_url for item in activity),
            ),
            _criterion(
                CriterionName.SERVICE_FIT,
                MAX_POINTS[CriterionName.SERVICE_FIT] if needs else 0,
                bool(needs),
                "Necessidade documentada corresponde a serviço oferecido pela JK Dev."
                if needs
                else "Segmento isolado não comprova compatibilidade de uma solução.",
                need_urls,
            ),
            _criterion(
                CriterionName.DATA_QUALITY,
                quality_points,
                True,
                "Endereço: 3 pontos; identificador da fonte: 2; evidência atual referenciada: 5.",
                current_urls,
            ),
        ]
        return LeadScore(
            rules_version=RULES_VERSION,
            score=sum(item.points for item in criteria),
            assessed_max_score=sum(item.max_points for item in criteria if item.assessed),
            evaluated_at=now,
            is_simulated=query.business.is_simulated,
            criteria=criteria,
            warnings=warnings,
        )
