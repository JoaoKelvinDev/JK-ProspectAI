"""Conclusões limitadas à URL candidata; não comprovam propriedade do site."""

from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, model_validator


class WebsiteStatus(StrEnum):
    FOUND = "found"
    NOT_FOUND = "not_found"
    INCONCLUSIVE = "inconclusive"
    NOT_CHECKED = "not_checked"


class InspectionReason(StrEnum):
    SIMULATED_BUSINESS = "simulated_business"
    MISSING_URL = "missing_url"
    MATCHING_PAGE = "matching_page"
    IDENTITY_MISMATCH = "identity_mismatch"
    HTTP_ERROR = "http_error"
    UNSUPPORTED_CONTENT = "unsupported_content"
    TIMEOUT = "timeout"
    DNS_ERROR = "dns_error"
    CONNECTION_ERROR = "connection_error"
    BLOCKED_DESTINATION = "blocked_destination"
    INVALID_URL = "invalid_url"
    INVALID_REDIRECT = "invalid_redirect"
    REDIRECT_LIMIT = "redirect_limit"
    REDIRECT_LOOP = "redirect_loop"
    RESPONSE_TOO_LARGE = "response_too_large"
    UNSUPPORTED_ENCODING = "unsupported_encoding"


class InspectionEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source: Literal["http"] = "http"
    url: HttpUrl
    observed_at: AwareDatetime
    status_code: int = Field(ge=100, le=599)
    content_type: str = Field(max_length=200)
    title: str | None = Field(default=None, max_length=200)
    matches: list[Literal["name", "city"]] = Field(default_factory=list)


class WebsiteInspection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: Literal["provided_url"] = "provided_url"
    status: WebsiteStatus
    reason: InspectionReason
    requested_url: HttpUrl | None
    final_url: HttpUrl | None = None
    checked_at: AwareDatetime | None = None
    confidence: Literal["low", "medium"] | None = None
    is_simulated: Annotated[bool, Field(strict=True)]
    evidence: list[InspectionEvidence] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_conclusion(self) -> Self:
        if self.status == WebsiteStatus.NOT_FOUND:
            raise ValueError("A inspeção provided_url não permite concluir not_found")
        skipped_reasons = {InspectionReason.SIMULATED_BUSINESS, InspectionReason.MISSING_URL}
        if self.status == WebsiteStatus.NOT_CHECKED:
            if (
                self.reason not in skipped_reasons
                or self.checked_at is not None
                or self.confidence is not None
                or self.evidence
                or self.final_url is not None
                or (self.reason == InspectionReason.SIMULATED_BUSINESS) != self.is_simulated
                or (self.reason == InspectionReason.MISSING_URL and self.requested_url is not None)
            ):
                raise ValueError(
                    "Uma inspeção não executada não pode conter conclusão ou evidências"
                )
            return self
        if self.is_simulated or self.requested_url is None or self.checked_at is None:
            raise ValueError("Uma inspeção executada requer URL, data e dados não simulados")
        if self.final_url != (self.evidence[-1].url if self.evidence else None):
            raise ValueError("A URL final deve corresponder à última resposta observada")
        if any(item.observed_at > self.checked_at for item in self.evidence):
            raise ValueError("As evidências não podem ser posteriores à conclusão")
        if self.status == WebsiteStatus.FOUND:
            if (
                self.reason != InspectionReason.MATCHING_PAGE
                or self.confidence != "medium"
                or not self.evidence
                or not 200 <= self.evidence[-1].status_code < 300
                or self.evidence[-1].content_type not in {"text/html", "application/xhtml+xml"}
                or set(self.evidence[-1].matches) != {"name", "city"}
            ):
                raise ValueError("found requer HTML acessível e correspondência de nome e cidade")
        elif (
            self.confidence != "low"
            or self.reason in skipped_reasons
            or self.reason == InspectionReason.MATCHING_PAGE
        ):
            raise ValueError("Uma inspeção inconclusiva requer motivo compatível e confiança baixa")
        return self
