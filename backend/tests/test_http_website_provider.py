import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable

import httpcore
import httpx
import pytest

from app.core.inspection_policy import InspectionPolicy
from app.providers.http_website_provider import HTTPWebsiteProvider
from app.providers.website import WebsiteProviderError
from app.schemas.website_inspection import InspectionReason


class TrackingStream(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes], *, delay: float = 0) -> None:
        self.chunks = chunks
        self.delay = delay
        self.closed = False
        self.read_chunks = 0

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            if self.delay:
                await asyncio.sleep(self.delay)
            self.read_chunks += 1
            yield chunk

    async def aclose(self) -> None:
        self.closed = True


class TrackingTransport(httpx.MockTransport):
    closed = False

    async def aclose(self) -> None:
        self.closed = True


def response(
    status: int = 200,
    *,
    headers: dict[str, str] | None = None,
    stream: httpx.AsyncByteStream | None = None,
) -> httpx.Response:
    return httpx.Response(
        status,
        headers={"content-type": "text/html", **(headers or {})},
        stream=stream if stream is not None else httpx.ByteStream(b"<p>Simulado</p>"),
    )


def provider(
    handler: Callable[[httpx.Request], httpx.Response | Awaitable[httpx.Response]],
    **policy: object,
) -> HTTPWebsiteProvider:
    return HTTPWebsiteProvider(
        InspectionPolicy.model_validate(policy), transport=httpx.MockTransport(handler)
    )


def test_success_streams_html_records_evidence_and_closes_resources() -> None:
    stream = TrackingStream([b"<p>Cafe ", b"Central</p>"])
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return response(stream=stream)

    transport = TrackingTransport(handler)
    page = asyncio.run(
        HTTPWebsiteProvider(InspectionPolicy(), transport).fetch("https://example.org/")
    )

    assert page.html == "<p>Cafe Central</p>"
    assert len(page.evidence) == 1
    assert page.evidence[0].status_code == 200
    assert str(page.evidence[0].url) == "https://example.org/"
    assert page.evidence[0].content_type == "text/html"
    assert requests[0].headers["accept-encoding"] == "identity"
    assert requests[0].extensions["timeout"]["connect"] == 3
    assert stream.closed and transport.closed


def test_three_redirects_are_allowed_and_evidence_preserves_each_hop() -> None:
    requests: list[str] = []
    streams: list[TrackingStream] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        hop = int(request.url.path.strip("/") or "0")
        stream = TrackingStream([b"body"])
        streams.append(stream)
        if hop < 3:
            return response(302, headers={"location": f"/{hop + 1}"}, stream=stream)
        return response(stream=stream)

    page = asyncio.run(provider(handler).fetch("https://example.org/"))

    assert requests == ["/", "/1", "/2", "/3"]
    assert [item.status_code for item in page.evidence] == [302, 302, 302, 200]
    assert all(stream.closed for stream in streams)
    assert all(stream.read_chunks == 0 for stream in streams[:-1])


def test_redirect_limit_stops_before_fifth_request() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return response(302, headers={"location": f"/{len(requests)}"})

    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(handler).fetch("https://example.org/"))

    assert failure.value.reason == InspectionReason.REDIRECT_LIMIT
    assert len(requests) == 4
    assert len(failure.value.evidence) == 4


@pytest.mark.parametrize(
    "location",
    [
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://10.0.0.1/",
        "http://169.254.169.254/",
        "https://example.org:8443/",
        "https://user:secret@example.org/",
        "file:///etc/passwd",
    ],
)
def test_redirect_destination_is_validated_before_request(location: str) -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return response(302, headers={"location": location})

    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(handler).fetch("https://example.org/"))

    assert failure.value.reason in {
        InspectionReason.BLOCKED_DESTINATION,
        InspectionReason.INVALID_URL,
    }
    assert requests == ["https://example.org/"]
    assert failure.value.evidence[0].status_code == 302


def test_redirect_loop_is_detected_ignoring_fragment() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return response(302, headers={"location": "/#new"})

    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(handler).fetch("https://example.org/"))

    assert failure.value.reason == InspectionReason.REDIRECT_LOOP
    assert len(requests) == 1


def test_redirect_without_location_is_inconclusive() -> None:
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(lambda request: response(302)).fetch("https://example.org/"))

    assert failure.value.reason == InspectionReason.INVALID_REDIRECT


@pytest.mark.parametrize("status", [204, 400, 401, 403, 404, 410, 429, 500, 503])
def test_non_success_http_status_keeps_evidence(status: int) -> None:
    # 204 é sucesso HTTP, mas sem conteúdo não comprova identidade (classificado no serviço).
    if status == 204:
        page = asyncio.run(
            provider(lambda request: response(status, stream=httpx.ByteStream(b""))).fetch(
                "https://example.org/"
            )
        )
        assert page.html == ""
        return
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(lambda request: response(status)).fetch("https://example.org/"))

    assert failure.value.reason == InspectionReason.HTTP_ERROR
    assert failure.value.evidence[-1].status_code == status


@pytest.mark.parametrize("content_type", ["application/json", "image/png", "", "application/pdf"])
def test_non_html_is_not_read(content_type: str) -> None:
    stream = TrackingStream([b"must not be read"])
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            provider(
                lambda request: response(headers={"content-type": content_type}, stream=stream)
            ).fetch("https://example.org/")
        )

    assert failure.value.reason == InspectionReason.UNSUPPORTED_CONTENT
    assert stream.read_chunks == 0
    assert stream.closed


def test_content_type_case_and_charset_and_unknown_charset() -> None:
    page = asyncio.run(
        provider(
            lambda request: response(
                headers={"content-type": "Text/HTML; charset=unknown-charset"},
                stream=httpx.ByteStream("Café".encode()),
            )
        ).fetch("https://example.org/")
    )

    assert page.html == "Café"
    assert page.evidence[0].content_type == "text/html"


@pytest.mark.parametrize("length", ["9", "100000000000000000000000000000", "invalid"])
def test_content_length_over_limit_is_rejected_without_reading(length: str) -> None:
    stream = TrackingStream([b"must not be read"])
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            provider(
                lambda request: response(headers={"content-length": length}, stream=stream),
                max_response_bytes=8,
            ).fetch("https://example.org/")
        )

    assert failure.value.reason == InspectionReason.RESPONSE_TOO_LARGE
    assert stream.closed and stream.read_chunks == 0


def test_chunked_body_limit_is_enforced_during_streaming() -> None:
    stream = TrackingStream([b"1234", b"5678", b"9", b"must not be read"])
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            provider(lambda request: response(stream=stream), max_response_bytes=8).fetch(
                "https://example.org/"
            )
        )

    assert failure.value.reason == InspectionReason.RESPONSE_TOO_LARGE
    assert stream.read_chunks == 3
    assert stream.closed


def test_body_exactly_at_limit_is_accepted() -> None:
    page = asyncio.run(
        provider(
            lambda request: response(stream=httpx.ByteStream(b"12345678")), max_response_bytes=8
        ).fetch("https://example.org/")
    )

    assert page.html == "12345678"


def test_compressed_response_is_rejected_before_decompression() -> None:
    stream = TrackingStream([b"not a gzip archive"])
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            provider(
                lambda request: response(headers={"content-encoding": "gzip"}, stream=stream)
            ).fetch("https://example.org/")
        )

    assert failure.value.reason == InspectionReason.UNSUPPORTED_ENCODING
    assert stream.read_chunks == 0 and stream.closed


def test_total_deadline_covers_streaming_and_closes_resources() -> None:
    stream = TrackingStream([b"slow body"], delay=1)
    transport = TrackingTransport(lambda request: response(stream=stream))
    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(
            HTTPWebsiteProvider(InspectionPolicy(total_timeout=0.02), transport).fetch(
                "https://example.org/"
            )
        )

    assert failure.value.reason == InspectionReason.TIMEOUT
    assert len(failure.value.evidence) == 1
    assert stream.closed and transport.closed


def test_total_deadline_is_not_reset_on_redirect() -> None:
    calls: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        if len(calls) == 1:
            await asyncio.sleep(0.05)
            return response(302, headers={"location": "/next"})
        await asyncio.sleep(1)
        return response()

    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(handler, total_timeout=0.15).fetch("https://example.org/"))

    assert failure.value.reason == InspectionReason.TIMEOUT
    assert len(calls) == 2
    assert [item.status_code for item in failure.value.evidence] == [302]


@pytest.mark.parametrize(
    ("error", "reason"),
    [
        (httpx.ReadTimeout("timeout"), InspectionReason.TIMEOUT),
        (httpcore.ConnectTimeout(), InspectionReason.TIMEOUT),
        (httpx.ConnectError("TLS or connection failure"), InspectionReason.CONNECTION_ERROR),
        (httpcore.ConnectError("TLS failure"), InspectionReason.CONNECTION_ERROR),
        (httpcore.RemoteProtocolError("bad response"), InspectionReason.CONNECTION_ERROR),
    ],
)
def test_known_transport_errors_are_translated(error: Exception, reason: InspectionReason) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    with pytest.raises(WebsiteProviderError) as failure:
        asyncio.run(provider(handler).fetch("https://example.org/"))

    assert failure.value.reason == reason
    assert failure.value.evidence == ()


def test_cookies_are_not_forwarded_between_redirects() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if len(requests) == 1:
            return response(302, headers={"location": "/next", "set-cookie": "session=fake"})
        return response()

    asyncio.run(provider(handler).fetch("https://example.org/"))

    assert "cookie" not in requests[1].headers
