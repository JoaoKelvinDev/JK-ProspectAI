"""Entradas documentadas pelo operador e pontuação comercial explicável."""

from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    model_validator,
)

from app.schemas.business import Business, Text
from app.schemas.website_inspection import WebsiteInspection, WebsiteStatus

Description = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]


class ScoringEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Text
    source_url: HttpUrl
    observed_at: AwareDatetime
    description: Description


class DigitalNeed(StrEnum):
    WEBSITE = "website"
    ONLINE_MENU = "online_menu"
    PRODUCT_CATALOG = "product_catalog"
    ONLINE_ORDERING = "online_ordering"
    SCHEDULING = "scheduling"
    WORKFLOW_AUTOMATION = "workflow_automation"
    API_INTEGRATION = "api_integration"
    CUSTOM_SYSTEM = "custom_system"


class NeedObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    need: DigitalNeed
    evidence: ScoringEvidence


class ManualWebsiteReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: Literal["manual_search"] = "manual_search"
    status: Literal["found", "not_found", "inconclusive"]
    reviewed_at: AwareDatetime
    website: HttpUrl | None = None
    checks: list[Description] = Field(min_length=1, max_length=10)
    evidence: list[ScoringEvidence] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_review(self) -> Self:
        if any(item.observed_at > self.reviewed_at for item in self.evidence):
            raise ValueError("A evidência não pode ser posterior à revisão")
        if self.status == "found" and self.website is None:
            raise ValueError("Uma revisão found requer a URL identificada")
        if self.status == "not_found":
            if self.website is not None:
                raise ValueError("Uma revisão not_found não pode informar site identificado")
            checks = {" ".join(value.casefold().split()) for value in self.checks}
            hosts = {(item.source_url.host or "").casefold().rstrip(".") for item in self.evidence}
            if len(checks) < 2 or len(hosts) < 2:
                raise ValueError("not_found requer duas verificações e duas origens distintas")
        return self


class LeadScoringRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business: Business
    website_inspection: WebsiteInspection | None = None
    website_review: ManualWebsiteReview | None = None
    needs: list[NeedObservation] = Field(default_factory=list, max_length=20)
    activity_evidence: list[ScoringEvidence] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_context(self) -> Self:
        inspection = self.website_inspection
        if inspection is not None:
            if (
                inspection.requested_url != self.business.website
                or inspection.is_simulated != self.business.is_simulated
            ):
                raise ValueError("A inspeção deve corresponder à URL e ao modo do estabelecimento")
            if (
                inspection.status == WebsiteStatus.FOUND
                and self.website_review is not None
                and self.website_review.status == "not_found"
            ):
                raise ValueError("A revisão not_found contradiz a inspeção found informada")
        return self


class CriterionName(StrEnum):
    WEBSITE_OPPORTUNITY = "website_opportunity"
    DIGITAL_NEED = "digital_need"
    DIGITAL_ACTIVITY = "digital_activity"
    SERVICE_FIT = "service_fit"
    DATA_QUALITY = "data_quality"


class ScoringWarning(StrEnum):
    SIMULATED_DATA = "simulated_data"
    STALE_EVIDENCE = "stale_evidence"
    FUTURE_EVIDENCE = "future_evidence"
    WEBSITE_NOT_ASSESSED = "website_not_assessed"
    NEED_NOT_ASSESSED = "need_not_assessed"
    ACTIVITY_NOT_ASSESSED = "activity_not_assessed"


class ScoreCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CriterionName
    points: int = Field(strict=True, ge=0, le=100)
    max_points: int = Field(strict=True, ge=1, le=100)
    assessed: Annotated[bool, Field(strict=True)]
    reason: Description
    evidence_urls: list[HttpUrl] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_points(self) -> Self:
        if self.points > self.max_points or (not self.assessed and self.points):
            raise ValueError("Pontuação incompatível com o limite ou com critério não avaliado")
        return self


class LeadScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rules_version: str
    basis: Literal["provided_evidence"] = "provided_evidence"
    score: int = Field(strict=True, ge=0, le=100)
    max_score: Literal[100] = 100
    assessed_max_score: int = Field(strict=True, ge=0, le=100)
    evaluated_at: AwareDatetime
    is_simulated: Annotated[bool, Field(strict=True)]
    criteria: list[ScoreCriterion] = Field(min_length=5, max_length=5)
    warnings: list[ScoringWarning] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_totals(self) -> Self:
        if (
            {item.name for item in self.criteria} != set(CriterionName)
            or sum(item.max_points for item in self.criteria) != self.max_score
            or sum(item.points for item in self.criteria) != self.score
            or sum(item.max_points for item in self.criteria if item.assessed)
            != self.assessed_max_score
        ):
            raise ValueError("Os totais devem corresponder aos cinco critérios da pontuação")
        return self
