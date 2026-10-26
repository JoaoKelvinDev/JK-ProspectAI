import socket
from collections.abc import Iterator
from typing import NoReturn

import httpcore
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def deny_network(*args: object, **kwargs: object) -> NoReturn:
        raise AssertionError("Consultas externas são proibidas nos testes")

    monkeypatch.setattr(socket, "getaddrinfo", deny_network)
    monkeypatch.setattr(httpcore.AnyIOBackend, "connect_tcp", deny_network)


@pytest.fixture
def client() -> Iterator[TestClient]:
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
