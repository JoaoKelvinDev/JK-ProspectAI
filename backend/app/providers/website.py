"""Contrato técnico da consulta HTTP, independente de FastAPI."""

from dataclasses import dataclass
from typing import Protocol

from app.schemas.website_inspection import InspectionEvidence, InspectionReason


@dataclass(frozen=True)
class WebsitePage:
    html: str
    evidence: tuple[InspectionEvidence, ...]


class WebsiteProviderError(Exception):
    def __init__(
        self,
        reason: InspectionReason,
        evidence: tuple[InspectionEvidence, ...] = (),
    ) -> None:
        super().__init__(reason.value)
        self.reason = reason
        self.evidence = evidence


class WebsiteProvider(Protocol):
    async def fetch(self, url: str) -> WebsitePage:
        """Consultar com limites e traduzir falhas conhecidas para WebsiteProviderError."""
        ...
