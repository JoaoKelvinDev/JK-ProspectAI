"""Normalização e deduplicação dos candidatos retornados pelo provedor."""

import unicodedata

from app.providers.base import DiscoveryProvider
from app.schemas.business import Business
from app.schemas.discovery import DiscoveryRequest


def _text_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", " ".join(value.split()).casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _deduplication_key(business: Business) -> tuple[str, ...]:
    if business.source_id is not None:
        # Identificadores são opacos: diferenças de caixa podem ser significativas.
        return ("source_id", business.source, business.source_id)
    location = business.location
    return (
        "location",
        _text_key(business.name),
        location.country,
        location.state,
        _text_key(location.city),
        _text_key(location.address or ""),
    )


class DiscoveryService:
    def __init__(self, provider: DiscoveryProvider) -> None:
        self._provider = provider

    def search(self, query: DiscoveryRequest) -> list[Business]:
        results: list[Business] = []
        seen: set[tuple[str, ...]] = set()

        for candidate in self._provider.search(query):
            location = candidate.location.model_copy(
                update={
                    "city": " ".join(candidate.location.city.split()),
                    "address": (
                        " ".join(candidate.location.address.split())
                        if candidate.location.address is not None
                        else None
                    ),
                }
            )
            business = candidate.model_copy(
                update={
                    "name": " ".join(candidate.name.split()),
                    "location": location,
                }
            )
            key = _deduplication_key(business)
            if key in seen:
                continue
            seen.add(key)
            results.append(business)
            if len(results) == query.max_results:
                break

        return results
