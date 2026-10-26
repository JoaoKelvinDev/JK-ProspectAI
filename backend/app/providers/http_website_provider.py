"""Consulta limitada de uma URL candidata, sem navegação ou execução de JavaScript."""

import asyncio
from datetime import UTC, datetime

import httpcore
import httpx
from pydantic import HttpUrl

from app.core.inspection_policy import InspectionPolicy
from app.providers.safe_http_transport import SafeHTTPTransport
from app.providers.website import WebsitePage, WebsiteProviderError
from app.schemas.website_inspection import InspectionEvidence, InspectionReason
from app.security.url_policy import validate_url

_REDIRECTS = {301, 302, 303, 307, 308}
_HTML_TYPES = {"text/html", "application/xhtml+xml"}


class HTTPWebsiteProvider:
    def __init__(
        self,
        policy: InspectionPolicy,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._policy = policy
        self._transport = transport

    async def fetch(self, url: str) -> WebsitePage:
        evidence: list[InspectionEvidence] = []
        try:
            async with asyncio.timeout(self._policy.total_timeout):
                return await self._fetch(url, evidence)
        except WebsiteProviderError as exc:
            raise WebsiteProviderError(exc.reason, tuple(evidence)) from exc
        except (TimeoutError, httpx.TimeoutException, httpcore.TimeoutException) as exc:
            raise WebsiteProviderError(InspectionReason.TIMEOUT, tuple(evidence)) from exc
        except (
            httpx.HTTPError,
            httpcore.NetworkError,
            httpcore.ProtocolError,
        ) as exc:
            raise WebsiteProviderError(InspectionReason.CONNECTION_ERROR, tuple(evidence)) from exc

    async def _fetch(self, url: str, evidence: list[InspectionEvidence]) -> WebsitePage:
        current = validate_url(url)
        visited: set[str] = set()
        transport = self._transport if self._transport is not None else SafeHTTPTransport()
        async with httpx.AsyncClient(
            transport=transport,
            trust_env=False,
            follow_redirects=False,
            timeout=httpx.Timeout(self._policy.connect_timeout),
            headers={"User-Agent": "JK-Prospect-AI/0.1", "Accept-Encoding": "identity"},
        ) as client:
            for hop in range(self._policy.max_redirects + 1):
                current = validate_url(str(current))
                if str(current) in visited:
                    raise WebsiteProviderError(InspectionReason.REDIRECT_LOOP)
                visited.add(str(current))
                # O cliente é exclusivo desta inspeção e não propaga cookies entre saltos.
                client.cookies.clear()
                async with client.stream("GET", current) as response:
                    content_type = response.headers.get("content-type", "").split(";", 1)[0]
                    evidence.append(
                        InspectionEvidence(
                            url=HttpUrl(str(current)),
                            observed_at=datetime.now(UTC),
                            status_code=response.status_code,
                            content_type=content_type.strip().lower()[:200],
                        )
                    )
                    if response.status_code in _REDIRECTS:
                        if hop == self._policy.max_redirects:
                            raise WebsiteProviderError(InspectionReason.REDIRECT_LIMIT)
                        location = response.headers.get("location")
                        if not location:
                            raise WebsiteProviderError(InspectionReason.INVALID_REDIRECT)
                        try:
                            current = validate_url(str(current.join(location)))
                        except httpx.InvalidURL as exc:
                            raise WebsiteProviderError(InspectionReason.INVALID_REDIRECT) from exc
                        continue
                    if not 200 <= response.status_code < 300:
                        raise WebsiteProviderError(InspectionReason.HTTP_ERROR)
                    if evidence[-1].content_type not in _HTML_TYPES:
                        raise WebsiteProviderError(InspectionReason.UNSUPPORTED_CONTENT)
                    encoding_header = response.headers.get("content-encoding", "identity")
                    if encoding_header.strip().lower() != "identity":
                        raise WebsiteProviderError(InspectionReason.UNSUPPORTED_ENCODING)
                    length = response.headers.get("content-length")
                    if length is not None and (
                        not length.isdecimal()
                        or len(length) > 10
                        or int(length) > self._policy.max_response_bytes
                    ):
                        raise WebsiteProviderError(InspectionReason.RESPONSE_TOO_LARGE)
                    body = bytearray()
                    async for chunk in response.aiter_raw():
                        if len(body) + len(chunk) > self._policy.max_response_bytes:
                            raise WebsiteProviderError(InspectionReason.RESPONSE_TOO_LARGE)
                        body.extend(chunk)
                    encoding = response.encoding or "utf-8"
                    try:
                        html = body.decode(encoding, errors="replace")
                    except LookupError:
                        html = body.decode("utf-8", errors="replace")
                    return WebsitePage(html=html, evidence=tuple(evidence))
        raise AssertionError("Redirect loop must return a page or raise a known error")
