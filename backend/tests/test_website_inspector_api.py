from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import HttpUrl

from app.api.dependencies import get_website_inspector_service
from app.main import app
from app.providers.website import WebsitePage
from app.schemas.website_inspection import InspectionEvidence
from app.services.website_inspector_service import WebsiteInspectorService

URL = "/api/v1/website-inspector/inspect"
BUSINESS = {
    "name": "Café Central",
    "category": "restaurantes",
    "location": {"city": "Teresina", "state": "PI"},
    "website": "https://example.org/",
    "source": "manual",
    "is_simulated": False,
}


def test_endpoint_returns_typed_result_using_substitute_provider(client: TestClient) -> None:
    class Provider:
        async def fetch(self, url: str) -> WebsitePage:
            return WebsitePage(
                html="<title>Café Central</title><p>Teresina</p>",
                evidence=(
                    InspectionEvidence(
                        url=HttpUrl(url),
                        observed_at=datetime.now(UTC),
                        status_code=200,
                        content_type="text/html",
                    ),
                ),
            )

    app.dependency_overrides[get_website_inspector_service] = lambda: WebsiteInspectorService(
        Provider()
    )

    response = client.post(URL, json=BUSINESS)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "found"
    assert data["scope"] == "provided_url"
    assert data["confidence"] == "medium"
    assert data["evidence"][0]["matches"] == ["name", "city"]
    assert "html" not in data
    assert "<title>" not in response.text


def test_discovery_results_can_be_submitted_without_network_access(client: TestClient) -> None:
    businesses = client.post(
        "/api/v1/discovery/search", json={"city": "Teresina", "state": "PI"}
    ).json()

    for business in businesses:
        response = client.post(URL, json=business)
        assert response.status_code == 200
        assert response.json()["status"] == "not_checked"
        assert response.json()["reason"] == "simulated_business"
        assert response.json()["is_simulated"] is True


def test_no_url_is_not_checked_instead_of_not_found(client: TestClient) -> None:
    response = client.post(URL, json={**BUSINESS, "website": None})

    assert response.status_code == 200
    assert response.json()["status"] == "not_checked"
    assert response.json()["reason"] == "missing_url"


@pytest.mark.parametrize(
    "website",
    [
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://169.254.169.254/",
        "https://localhost/",
        "https://host.example/",
        "https://example.org:8443/",
        "https://user:password@example.org/",
    ],
)
def test_unsafe_url_is_an_inconclusive_inspection_without_network(
    client: TestClient, website: str
) -> None:
    response = client.post(URL, json={**BUSINESS, "website": website})

    assert response.status_code == 200
    assert response.json()["status"] == "inconclusive"
    assert response.json()["reason"] in {"blocked_destination", "invalid_url"}
    assert response.json()["evidence"] == []


@pytest.mark.parametrize(
    "change",
    [
        {"name": ""},
        {"website": "ftp://example.org/"},
        {"is_simulated": "false"},
        {"unknown": True},
        {"location": {"city": "Teresina", "state": "XX"}},
    ],
)
def test_invalid_input_is_rejected(client: TestClient, change: dict[str, object]) -> None:
    assert client.post(URL, json={**BUSINESS, **change}).status_code == 422


def test_openapi_documents_endpoint_and_all_states(client: TestClient) -> None:
    document = client.get("/openapi.json").json()

    assert "post" in document["paths"][URL]
    assert set(document["components"]["schemas"]["WebsiteStatus"]["enum"]) == {
        "found",
        "not_found",
        "inconclusive",
        "not_checked",
    }


def test_unexpected_provider_error_returns_500_without_internal_details(client: TestClient) -> None:
    class BrokenProvider:
        async def fetch(self, url: str) -> WebsitePage:
            raise RuntimeError("internal details")

    app.dependency_overrides[get_website_inspector_service] = lambda: WebsiteInspectorService(
        BrokenProvider()
    )
    with TestClient(app, raise_server_exceptions=False) as error_client:
        response = error_client.post(URL, json=BUSINESS)

    assert response.status_code == 500
    assert "internal details" not in response.text
