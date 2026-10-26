"""Contrato mínimo para substituir a fonte sem alterar o serviço."""

from typing import Protocol

from app.schemas.business import Business
from app.schemas.discovery import DiscoveryRequest


class DiscoveryProviderError(Exception):
    """Falha conhecida ao consultar uma fonte de descoberta."""


class DiscoveryProvider(Protocol):
    def search(self, query: DiscoveryRequest) -> list[Business]:
        """Retornar candidatos filtrados, sem limitar antes da deduplicação.

        Falhas conhecidas devem ser traduzidas para DiscoveryProviderError.
        """
        ...
