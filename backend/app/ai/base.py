"""Fronteira do provedor: recebe apenas o contexto selecionado pelo serviço."""

from typing import Protocol

from app.schemas.business_analysis import AnalysisDraft, AnalysisFact


class AnalysisProviderError(Exception):
    """Falha ao produzir uma análise válida; detalhes não devem chegar ao cliente."""


class BusinessAnalysisProvider(Protocol):
    async def analyze(
        self, facts: tuple[AnalysisFact, ...], *, instructions: str
    ) -> AnalysisDraft: ...
