from copy import deepcopy
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/lead-scoring/score"


@pytest.fixture
def payload() -> dict:
    observed_at = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    evidence = {
        "source": "Fonte fictícia para demonstração",
        "source_url": "https://first.example/",
        "observed_at": observed_at,
        "description": "Observação simulada, sem consulta externa.",
    }
    return {
        "business": {
            "name": "Restaurante Simulado",
            "category": "restaurantes",
            "location": {"city": "Teresina", "state": "PI", "address": "Rua Fictícia, 1"},
            "source": "mock",
            "source_id": "mock-001",
            "is_simulated": True,
        },
        "website_review": {
            "status": "not_found",
            "reviewed_at": observed_at,
            "checks": [
                "Busca simulada pelo nome e localização",
                "Consulta simulada a outra origem",
            ],
            "evidence": [evidence, {**evidence, "source_url": "https://second.example/"}],
        },
        "needs": [
            {"need": "online_menu", "evidence": evidence},
            {"need": "online_ordering", "evidence": evidence},
        ],
        "activity_evidence": [evidence],
    }


def test_score_endpoint_returns_100_with_explanations_and_simulation_flag(
    client: TestClient,
    payload: dict,
) -> None:
    response = client.post(URL, json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["score"] == data["assessed_max_score"] == 100
    assert data["rules_version"] == "1.0.0"
    assert data["basis"] == "provided_evidence"
    assert data["is_simulated"] is True
    assert "simulated_data" in data["warnings"]
    assert len(data["criteria"]) == 5
    assert all(item["reason"] for item in data["criteria"])


def test_discovery_result_can_be_scored_without_network_or_extra_context(
    client: TestClient,
) -> None:
    business = client.post(
        "/api/v1/discovery/search", json={"city": "Teresina", "state": "PI", "max_results": 1}
    ).json()[0]
    inspection = client.post("/api/v1/website-inspector/inspect", json=business).json()

    response = client.post(URL, json={"business": business, "website_inspection": inspection})

    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 5
    assert data["assessed_max_score"] == 10
    assert data["criteria"][0]["points"] == 0
    assert "website_not_assessed" in data["warnings"]


@pytest.mark.parametrize("field", ["score", "rules_version", "weights"])
def test_caller_cannot_override_policy(client: TestClient, payload: dict, field: str) -> None:
    assert client.post(URL, json={**payload, field: 100}).status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        {"business": None},
        {"needs": None},
        {"activity_evidence": "invalid"},
        {"needs": [{"need": "imaginary", "evidence": {}}]},
        {
            "website_inspection": {
                "status": "not_found",
                "reason": "http_error",
                "requested_url": None,
                "is_simulated": False,
            }
        },
    ],
)
def test_invalid_input_is_rejected(client: TestClient, payload: dict, change: dict) -> None:
    assert client.post(URL, json={**payload, **change}).status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        {"checks": []},
        {"evidence": []},
        {"scope": "provided_url"},
        {"checks": ["Uma verificação", "  UMA   VERIFICAÇÃO  "]},
        {"website": "https://business.example/"},
        {"reviewed_at": "2020-01-01T00:00:00"},
        {"reviewed_at": "2020-01-01T00:00:00Z"},
        {"status": "found"},
    ],
)
def test_incomplete_or_contradictory_manual_review_is_rejected(
    client: TestClient,
    payload: dict,
    change: dict,
) -> None:
    payload["website_review"].update(change)

    assert client.post(URL, json=payload).status_code == 422


@pytest.mark.parametrize("second_url", ["https://first.example/other", "https://first.example./"])
def test_absence_review_requires_two_distinct_origins(
    client: TestClient,
    payload: dict,
    second_url: str,
) -> None:
    payload["website_review"]["evidence"][1]["source_url"] = second_url

    assert client.post(URL, json=payload).status_code == 422


@pytest.mark.parametrize("field", ["source", "source_url", "description", "observed_at"])
def test_need_requires_documented_evidence(client: TestClient, payload: dict, field: str) -> None:
    payload = deepcopy(payload)
    del payload["needs"][0]["evidence"][field]

    assert client.post(URL, json=payload).status_code == 422


def test_list_limits_are_enforced(client: TestClient, payload: dict) -> None:
    payload["needs"] = [payload["needs"][0]] * 21

    assert client.post(URL, json=payload).status_code == 422


def test_openapi_exposes_scoring_and_structured_contracts(client: TestClient) -> None:
    document = client.get("/openapi.json").json()

    assert "post" in document["paths"][URL]
    assert "LeadScore" in document["components"]["schemas"]
    assert "ManualWebsiteReview" in document["components"]["schemas"]


def test_minimal_readme_example_has_zero_score_and_explicit_missing_context(
    client: TestClient,
    payload: dict,
) -> None:
    business = payload["business"]
    del business["source_id"]
    del business["location"]["address"]

    response = client.post(URL, json={"business": business})

    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 0
    assert data["assessed_max_score"] == 10
    assert len(data["warnings"]) == 4
