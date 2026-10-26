import asyncio
import socket
import ssl
from collections.abc import Iterable

import httpcore
import pytest

from app.core.inspection_policy import InspectionPolicy
from app.providers.http_website_provider import HTTPWebsiteProvider
from app.providers.safe_http_transport import PublicNetworkBackend, SafeHTTPTransport, SocketOption
from app.providers.website import WebsiteProviderError
from app.schemas.website_inspection import InspectionReason
from app.security.url_policy import resolve_public_addresses, validate_public_ip, validate_url


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "0.0.0.0",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "192.0.2.1",
        "198.51.100.1",
        "203.0.113.1",
        "224.0.0.1",
        "255.255.255.255",
        "::",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "2001:db8::1",
        "::ffff:127.0.0.1",
        "::ffff:8.8.8.8",
        "2002:0808:0808::1",
        "not-an-ip",
    ],
)
def test_non_public_and_transition_ips_are_rejected(ip: str) -> None:
    with pytest.raises(WebsiteProviderError) as failure:
        validate_public_ip(ip)

    assert failure.value.reason == InspectionReason.BLOCKED_DESTINATION


@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_addresses_are_accepted_without_network(ip: str) -> None:
    assert validate_public_ip(ip) == ip


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.org/",
        "//example.org/",
        "https://user:secret@example.org/",
        "http://example.org:443/",
        "https://example.org:80/",
        "https://example.org:8443/",
        "https://localhost/",
        "http://LOCALHOST./",
        "http://a.localhost/",
        "http://router.local/",
        "http://metadata.google.internal/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://[fe80::1%25eth0]/",
        "https://site.example/",
        "https://site.test/",
        "https://example.org/\n",
        "https://example.org/" + "a" * 2048,
    ],
)
def test_unsafe_urls_are_rejected_without_resolution(url: str) -> None:
    with pytest.raises(WebsiteProviderError):
        validate_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://example.org/",
        "http://example.org:80/",
        "https://example.org:443/",
        "https://8.8.8.8/",
        "https://[2606:4700:4700::1111]/",
    ],
)
def test_safe_url_syntax_is_accepted_without_network(url: str) -> None:
    assert validate_url(url).host


def test_fragment_is_removed() -> None:
    assert str(validate_url("https://example.org/#anchor")) == "https://example.org/"


def test_resolver_rejects_mixed_public_and_private_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        async def getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
            return [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
                (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("::1", 443, 0, 0)),
            ]

        monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", getaddrinfo)
        with pytest.raises(WebsiteProviderError) as failure:
            await resolve_public_addresses("example.org", 443)
        assert failure.value.reason == InspectionReason.BLOCKED_DESTINATION

    asyncio.run(scenario())


@pytest.mark.parametrize("empty", [False, True])
def test_dns_failure_and_empty_answer_are_structured(
    monkeypatch: pytest.MonkeyPatch, empty: bool
) -> None:
    async def scenario() -> None:
        async def getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
            if empty:
                return []
            raise socket.gaierror("DNS unavailable")

        monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", getaddrinfo)
        with pytest.raises(WebsiteProviderError) as failure:
            await resolve_public_addresses("example.org", 443)
        assert failure.value.reason == InspectionReason.DNS_ERROR

    asyncio.run(scenario())


class RecordingStream(httpcore.AsyncMockStream):
    def __init__(self, data: list[bytes]) -> None:
        super().__init__(data)
        self.sent: list[bytes] = []
        self.tls_hosts: list[str | None] = []
        self.closed = False

    async def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self.sent.append(buffer)

    async def start_tls(
        self,
        ssl_context: ssl.SSLContext,
        server_hostname: str | None = None,
        timeout: float | None = None,
    ) -> httpcore.AsyncNetworkStream:
        assert ssl_context.check_hostname is True
        assert ssl_context.verify_mode == ssl.CERT_REQUIRED
        self.tls_hosts.append(server_hostname)
        return self

    async def aclose(self) -> None:
        self.closed = True
        await super().aclose()


class RecordingBackend(httpcore.AsyncNetworkBackend):
    def __init__(self, responses: list[bytes]) -> None:
        self.responses = responses
        self.connections: list[tuple[str, int]] = []
        self.streams: list[RecordingStream] = []

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[SocketOption] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        self.connections.append((host, port))
        stream = RecordingStream([self.responses[len(self.streams)]])
        self.streams.append(stream)
        return stream


def test_dns_is_resolved_once_connection_uses_ip_and_tls_uses_original_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    resolutions: list[str] = []

    async def resolver(host: str, port: int) -> tuple[str, ...]:
        resolutions.append(host)
        return ("8.8.8.8",) if len(resolutions) == 1 else ("127.0.0.1",)

    backend = RecordingBackend(
        [b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 4\r\n\r\nTest"]
    )
    # Proxies e certificados fornecidos pelo ambiente não devem substituir a política.
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:9")
    monkeypatch.setenv("SSL_CERT_FILE", "does-not-exist.pem")
    transport = SafeHTTPTransport(PublicNetworkBackend(resolver=resolver, backend=backend))

    page = asyncio.run(
        HTTPWebsiteProvider(InspectionPolicy(), transport).fetch("https://example.org/")
    )

    assert page.html == "Test"
    assert resolutions == ["example.org"]
    assert backend.connections == [("8.8.8.8", 443)]
    assert backend.streams[0].tls_hosts == ["example.org"]
    assert b"Host: example.org\r\n" in b"".join(backend.streams[0].sent)
    assert backend.streams[0].closed


def test_redirect_to_domain_resolving_to_private_ip_never_opens_second_socket() -> None:
    async def resolver(host: str, port: int) -> tuple[str, ...]:
        return ("8.8.8.8",) if host == "example.org" else ("10.0.0.1",)

    backend = RecordingBackend(
        [b"HTTP/1.1 302 Found\r\nLocation: https://other.org/\r\nContent-Length: 0\r\n\r\n"]
    )
    transport = SafeHTTPTransport(PublicNetworkBackend(resolver=resolver, backend=backend))
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            HTTPWebsiteProvider(InspectionPolicy(), transport).fetch("https://example.org/")
        )

    assert failure.value.reason == InspectionReason.BLOCKED_DESTINATION
    assert [item.status_code for item in failure.value.evidence] == [302]
    assert backend.connections == [("8.8.8.8", 443)]
    assert backend.streams[0].closed


def test_same_host_is_revalidated_on_new_connection_after_redirect() -> None:
    resolutions: list[str] = []

    async def resolver(host: str, port: int) -> tuple[str, ...]:
        resolutions.append(host)
        return ("8.8.8.8",) if len(resolutions) == 1 else ("127.0.0.1",)

    backend = RecordingBackend(
        [b"HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 0\r\n\r\n"]
    )
    transport = SafeHTTPTransport(PublicNetworkBackend(resolver=resolver, backend=backend))
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            HTTPWebsiteProvider(InspectionPolicy(), transport).fetch("https://example.org/")
        )

    assert failure.value.reason == InspectionReason.BLOCKED_DESTINATION
    assert resolutions == ["example.org", "example.org"]
    assert backend.connections == [("8.8.8.8", 443)]


def test_dns_resolution_is_included_in_connection_timeout() -> None:
    async def resolver(host: str, port: int) -> tuple[str, ...]:
        await asyncio.sleep(1)
        return ("8.8.8.8",)

    backend = RecordingBackend([])
    network = PublicNetworkBackend(resolver=resolver, backend=backend)
    with pytest.raises(httpcore.ConnectTimeout):
        asyncio.run(network.connect_tcp("example.org", 443, timeout=0.02))

    assert backend.connections == []
