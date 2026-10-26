import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.dependencies import get_discovery_service
from app.main import app
from app.providers.base import DiscoveryProviderError
from app.schemas.business import Business, BusinessLocation
from app.schemas.discovery import DiscoveryRequest, Segment
from app.services.discovery_service import DiscoveryService

SEARCH_URL = "/api/v1/discovery/search"
DEFAULT_QUERY = {"city": "Teresina", "state": "PI", "segments": [], "max_results": 20}


def test_default_search_returns_explicitly_simulated_businesses(client: TestClient) -> None:
    response = client.post(SEARCH_URL, json=DEFAULT_QUERY)

    assert response.status_code == 200
    businesses = response.json()
    assert len(businesses) == 12
    assert {business["category"] for business in businesses} == {item.value for item in Segment}
    for data in businesses:
        business = Business.model_validate(data)
        assert business.source == "mock"
        assert business.is_simulated is True
        assert business.source_id is not None
        assert business.location.city == "Teresina"
        assert business.location.state == "PI"
        assert business.location.country == "BR"
        assert business.website_status == "not_checked"


def test_website_information_never_implies_verification(client: TestClient) -> None:
    businesses = client.post(SEARCH_URL, json=DEFAULT_QUERY).json()

    assert any(business["website"] is None for business in businesses)
    assert any(business["website"] is not None for business in businesses)
    assert all(business["website_status"] == "not_checked" for business in businesses)


def test_optional_filters_have_defaults(client: TestClient) -> None:
    response = client.post(SEARCH_URL, json={"city": "Teresina", "state": "PI"})

    assert response.status_code == 200
    assert response.json() == client.post(SEARCH_URL, json=DEFAULT_QUERY).json()


@pytest.mark.parametrize("segments", [["restaurantes"], ["bares", "barbearias"]])
def test_segment_filter(client: TestClient, segments: list[str]) -> None:
    response = client.post(SEARCH_URL, json={**DEFAULT_QUERY, "segments": segments})

    assert response.status_code == 200
    assert {item["category"] for item in response.json()} == set(segments)


def test_repeated_segments_do_not_duplicate_results(client: TestClient) -> None:
    response = client.post(
        SEARCH_URL, json={**DEFAULT_QUERY, "segments": ["restaurantes", "restaurantes"]}
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.parametrize("limit", [1, 2, 100])
def test_result_limit_is_a_maximum(client: TestClient, limit: int) -> None:
    response = client.post(SEARCH_URL, json={**DEFAULT_QUERY, "max_results": limit})

    assert response.status_code == 200
    assert len(response.json()) == min(limit, 12)


def test_request_normalizes_city_and_state(client: TestClient) -> None:
    response = client.post(
        SEARCH_URL, json={**DEFAULT_QUERY, "city": "  tErEsInA  ", "state": " pi "}
    )

    assert response.status_code == 200
    assert len(response.json()) == 12


@pytest.mark.parametrize(
    ("city", "state"), [("Parnaíba", "PI"), ("Teresina", "MA"), ("São Paulo", "SP")]
)
def test_uncovered_location_returns_empty_list(client: TestClient, city: str, state: str) -> None:
    response = client.post(SEARCH_URL, json={**DEFAULT_QUERY, "city": city, "state": state})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    "change",
    [
        {"city": ""},
        {"city": " \t\n"},
        {"city": "x" * 121},
        {"city": None},
        {"city": 123},
        {"state": "XX"},
        {"state": "Piauí"},
        {"state": None},
        {"segments": ["inexistente"]},
        {"segments": "bares"},
        {"segments": None},
        {"max_results": 0},
        {"max_results": -1},
        {"max_results": 101},
        {"max_results": True},
        {"max_results": 1.5},
        {"max_results": 2.0},
        {"max_results": "2"},
        {"max_results": None},
        {"unknown": "value"},
    ],
)
def test_invalid_filters_are_rejected(client: TestClient, change: dict[str, object]) -> None:
    response = client.post(SEARCH_URL, json={**DEFAULT_QUERY, **change})

    assert response.status_code == 422
    assert response.json()["detail"]


@pytest.mark.parametrize("missing_field", ["city", "state"])
def test_required_fields(client: TestClient, missing_field: str) -> None:
    query = {key: value for key, value in DEFAULT_QUERY.items() if key != missing_field}

    assert client.post(SEARCH_URL, json=query).status_code == 422


def test_malformed_json_is_rejected(client: TestClient) -> None:
    response = client.post(SEARCH_URL, content="{", headers={"Content-Type": "application/json"})

    assert response.status_code == 422


class FailingProvider:
    def __init__(self, error: Exception) -> None:
        self.error = error

    def search(self, query: DiscoveryRequest) -> list[Business]:
        raise self.error


def test_provider_error_is_translated_without_leaking_details(client: TestClient) -> None:
    app.dependency_overrides[get_discovery_service] = lambda: DiscoveryService(
        FailingProvider(DiscoveryProviderError("detalhes internos da fonte"))
    )

    response = client.post(SEARCH_URL, json=DEFAULT_QUERY)

    assert response.status_code == 502
    assert response.json() == {"detail": "Não foi possível consultar o provedor de descoberta."}


def test_unexpected_error_is_not_reported_as_empty_success(client: TestClient) -> None:
    app.dependency_overrides[get_discovery_service] = lambda: DiscoveryService(
        FailingProvider(RuntimeError("falha inesperada"))
    )

    with TestClient(app, raise_server_exceptions=False) as error_client:
        response = error_client.post(SEARCH_URL, json=DEFAULT_QUERY)

    assert response.status_code == 500
    assert "falha inesperada" not in response.text


def test_business_schema_rejects_unsupported_verification_and_invalid_url() -> None:
    business = Business(
        name="Simulado",
        category=Segment.BARES,
        location=BusinessLocation(city="Teresina", state="PI"),
        source="mock",
        is_simulated=True,
    )
    for change in (
        {"website_status": "not_found"},
        {"website": "ftp://site.example"},
        {"is_simulated": "true"},
    ):
        with pytest.raises(ValidationError):
            Business.model_validate({**business.model_dump(), **change})
