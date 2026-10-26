import pytest

from app.providers.base import DiscoveryProviderError
from app.providers.mock_provider import MockDiscoveryProvider
from app.schemas.business import Business, BusinessLocation
from app.schemas.discovery import DiscoveryRequest, Segment
from app.services.discovery_service import DiscoveryService


def make_business(
    name: str = "Bar Simulado",
    *,
    source_id: str | None = None,
    source: str = "mock",
    address: str | None = "Rua Fictícia, 1",
) -> Business:
    return Business(
        name=name,
        category=Segment.BARES,
        location=BusinessLocation(city="Teresina", state="PI", address=address),
        source_id=source_id,
        source=source,
        is_simulated=True,
    )


class StaticProvider:
    def __init__(self, businesses: list[Business]) -> None:
        self.businesses = businesses
        self.received_query: DiscoveryRequest | None = None

    def search(self, query: DiscoveryRequest) -> list[Business]:
        self.received_query = query
        return self.businesses


def test_service_accepts_a_substitute_provider_and_forwards_query() -> None:
    provider = StaticProvider([make_business()])
    query = DiscoveryRequest(city="Teresina", state="PI", segments=[Segment.BARES])

    results = DiscoveryService(provider).search(query)

    assert provider.received_query is query
    assert len(results) == 1
    assert results[0].name == "Bar Simulado"


def test_deduplication_by_source_id_preserves_first_and_applies_limit_afterwards() -> None:
    provider = StaticProvider(
        [
            make_business("Primeiro", source_id="1"),
            make_business("Repetido", source_id="1"),
            make_business("Segundo", source_id="2"),
            make_business("Terceiro", source_id="3"),
        ]
    )

    results = DiscoveryService(provider).search(
        DiscoveryRequest(city="Teresina", state="PI", max_results=2)
    )

    assert [business.name for business in results] == ["Primeiro", "Segundo"]


def test_ids_are_scoped_to_source_and_remain_case_sensitive() -> None:
    provider = StaticProvider(
        [
            make_business(source_id="A"),
            make_business(source_id="a"),
            make_business(source_id="A", source="outra-fonte-simulada"),
        ]
    )

    results = DiscoveryService(provider).search(DiscoveryRequest(city="Teresina", state="PI"))

    assert len(results) == 3


def test_distinct_source_ids_preserve_branches_with_similar_names() -> None:
    provider = StaticProvider(
        [
            make_business(source_id="1"),
            make_business(source_id="2"),
        ]
    )

    results = DiscoveryService(provider).search(DiscoveryRequest(city="Teresina", state="PI"))

    assert len(results) == 2


def test_fallback_matches_name_and_location_ignoring_case_accents_and_whitespace() -> None:
    first = make_business("  Comércio   Simulado  ", address="Rua   Fictícia, 1")
    duplicate = make_business("comercio simulado", address="rua ficticia, 1")
    duplicate.location.city = "  TERESINA  "
    branch = make_business("Comércio Simulado", address="Rua Fictícia, 2")

    results = DiscoveryService(StaticProvider([first, duplicate, branch])).search(
        DiscoveryRequest(city="Teresina", state="PI")
    )

    assert len(results) == 2
    assert results[0].name == "Comércio Simulado"
    assert results[0].location.address == "Rua Fictícia, 1"
    assert results[1].location.address == "Rua Fictícia, 2"
    assert first.name == "Comércio   Simulado"  # O objeto do provedor não é alterado.
    assert first.location.address == "Rua   Fictícia, 1"


def test_fallback_handles_missing_address() -> None:
    provider = StaticProvider(
        [
            make_business(address=None),
            make_business("BAR SIMULADO", address=None),
        ]
    )

    results = DiscoveryService(provider).search(DiscoveryRequest(city="Teresina", state="PI"))

    assert len(results) == 1


def test_fallback_does_not_merge_distinct_cities() -> None:
    other_city = make_business()
    other_city.location.city = "Parnaíba"
    provider = StaticProvider([make_business(), other_city])

    results = DiscoveryService(provider).search(DiscoveryRequest(city="Teresina", state="PI"))

    assert len(results) == 2


def test_empty_provider_result() -> None:
    results = DiscoveryService(StaticProvider([])).search(
        DiscoveryRequest(city="Teresina", state="PI")
    )

    assert results == []


def test_mock_results_are_deterministic_and_independent() -> None:
    provider = MockDiscoveryProvider()
    query = DiscoveryRequest(city="Teresina", state="PI")
    first = provider.search(query)
    second = provider.search(query)

    assert first == second
    assert len({business.source_id for business in first}) == len(first)
    first[0].location.city = "Alterada apenas neste resultado"
    assert second[0].location.city == "Teresina"
    assert provider.search(query) == second


def test_known_provider_error_propagates_to_http_boundary() -> None:
    class UnavailableProvider:
        def search(self, query: DiscoveryRequest) -> list[Business]:
            raise DiscoveryProviderError("fonte indisponível")

    with pytest.raises(DiscoveryProviderError, match="fonte indisponível"):
        DiscoveryService(UnavailableProvider()).search(
            DiscoveryRequest(city="Teresina", state="PI")
        )
