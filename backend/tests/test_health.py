from fastapi.testclient import TestClient


def test_application_starts_and_health_responds(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_exposes_search_and_health(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "post" in paths["/api/v1/discovery/search"]
    assert "get" in paths["/health"]
    assert client.get("/docs").status_code == 200
