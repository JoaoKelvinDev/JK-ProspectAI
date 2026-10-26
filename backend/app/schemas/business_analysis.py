"""Análise rastreável: contexto fornecido, hipóteses e soluções separadas."""

from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.lead_scoring import (
    Description,
    DigitalNeed,
    LeadScoringRequest,
    ScoringEvidence,
)

FactId = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_-]{0,39}$")]


class BusinessAnalysisRequest(LeadScoringRequest):
    """Reutiliza limites e coerência do contexto já aceito pelo Scoring, sem receber score."""


class AnalysisFact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: FactId
    kind: Literal[
        "business_profile",
        "documented_need",
        "digital_activity",
        "website_review",
        "website_inspection",
    ]
    statement: Description
    need: DigitalNeed | None = None
    evidence: list[ScoringEvidence] = Field(default_factory=list, max_length=10)


class AnalysisSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    need: DigitalNeed
    fact_ids: list[FactId] = Field(min_length=1, max_length=21)
    hypothesis: Description
    opportunity: Description
    suggested_solution: Description
    validation_question: Description


class AnalysisDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggestions: list[AnalysisSuggestion] = Field(default_factory=list, max_length=8)


class BusinessAnalysis(AnalysisDraft):
    provider: Literal["mock"] = "mock"
    generation_mode: Literal["simulated"] = "simulated"
    prompt_version: Literal["1.0.0"] = "1.0.0"
    basis: Literal["provided_evidence"] = "provided_evidence"
    status: Literal["ready_for_review", "insufficient_evidence"]
    analyzed_at: AwareDatetime
    business_is_simulated: Annotated[bool, Field(strict=True)]
    facts: list[AnalysisFact] = Field(min_length=1, max_length=43)
    limitations: list[Description] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_references(self) -> Self:
        facts = {item.id: item for item in self.facts}
        if len(facts) != len(self.facts):
            raise ValueError("Identificadores de fatos devem ser únicos")
        needs = [item.need for item in self.suggestions]
        if len(needs) != len(set(needs)):
            raise ValueError("Soluções não podem repetir necessidades")
        for item in self.suggestions:
            if len(item.fact_ids) != len(set(item.fact_ids)) or any(
                key not in facts or facts[key].need != item.need for key in item.fact_ids
            ):
                raise ValueError("Cada sugestão requer fatos válidos da mesma necessidade")
        expected = "ready_for_review" if self.suggestions else "insufficient_evidence"
        if self.status != expected:
            raise ValueError("Estado incompatível com as sugestões")
        return self
