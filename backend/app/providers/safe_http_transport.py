"""Transporte HTTPX com conexão ao IP validado, mantendo Host e SNI originais."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable

import httpcore
import httpx

from app.security.url_policy import resolve_public_addresses, validate_public_ip, validate_url

type SocketOption = tuple[int, int, int | bytes] | tuple[int, int, None, int]
type Resolver = Callable[[str, int], Awaitable[tuple[str, ...]]]


class PublicNetworkBackend(httpcore.AsyncNetworkBackend):
    def __init__(
        self,
        resolver: Resolver = resolve_public_addresses,
        backend: httpcore.AsyncNetworkBackend | None = None,
    ) -> None:
        self._resolver = resolver
        self._backend = backend if backend is not None else httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[SocketOption] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        validate_url(f"{'https' if port == 443 else 'http'}://{_url_host(host)}:{port}/")
        # Inclui DNS no timeout de conexão; nunca resolve o hostname uma segunda vez.
        try:
            async with asyncio.timeout(timeout):
                addresses = await self._resolver(host, port)
                # Mesmo resolvedores injetados devem satisfazer a política completa.
                validated = tuple(validate_public_ip(address) for address in addresses)
                if not validated:
                    raise httpcore.ConnectError("DNS returned no addresses")
                return await self._backend.connect_tcp(
                    validated[0],
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
        except TimeoutError as exc:
            raise httpcore.ConnectTimeout() from exc

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


def _url_host(host: str) -> str:
    return f"[{host}]" if ":" in host else host


class CoreResponseStream(httpx.AsyncByteStream):
    def __init__(self, stream: httpcore.Response) -> None:
        self._response = stream

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for chunk in self._response.aiter_stream():
            yield chunk

    async def aclose(self) -> None:
        await self._response.aclose()


class SafeHTTPTransport(httpx.AsyncBaseTransport):
    def __init__(self, backend: PublicNetworkBackend | None = None) -> None:
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=httpcore.default_ssl_context(),
            network_backend=backend if backend is not None else PublicNetworkBackend(),
            max_connections=1,
            max_keepalive_connections=0,
            retries=0,
            http2=False,
        )

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        validate_url(str(request.url))
        response = await self._pool.handle_async_request(
            httpcore.Request(
                method=request.method,
                url=httpcore.URL(
                    scheme=request.url.raw_scheme,
                    host=request.url.raw_host,
                    port=request.url.port,
                    target=request.url.raw_path,
                ),
                headers=request.headers.raw,
                content=request.stream,
                extensions=request.extensions,
            )
        )
        return httpx.Response(
            status_code=response.status,
            headers=response.headers,
            stream=CoreResponseStream(response),
            extensions=response.extensions,
        )

    async def aclose(self) -> None:
        await self._pool.aclose()
