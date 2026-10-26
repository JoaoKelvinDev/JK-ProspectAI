"""A validação de endereço também é aplicada no momento da conexão TCP."""

import asyncio
import ipaddress
import socket

import httpx

from app.providers.website import WebsiteProviderError
from app.schemas.website_inspection import InspectionReason


def validate_public_ip(value: str) -> str:
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise WebsiteProviderError(InspectionReason.BLOCKED_DESTINATION) from exc
    if (
        not address.is_global
        or address.is_multicast
        or address.is_reserved
        or (
            isinstance(address, ipaddress.IPv6Address)
            and (address.ipv4_mapped or address.sixtofour or address.teredo)
        )
    ):
        raise WebsiteProviderError(InspectionReason.BLOCKED_DESTINATION)
    return str(address)


def validate_url(value: str) -> httpx.URL:
    if len(value) > 2048 or any(ord(char) <= 32 or ord(char) == 127 for char in value):
        raise WebsiteProviderError(InspectionReason.INVALID_URL)
    try:
        url = httpx.URL(value)
    except httpx.InvalidURL as exc:
        raise WebsiteProviderError(InspectionReason.INVALID_URL) from exc
    if (
        url.scheme not in {"http", "https"}
        or not url.is_absolute_url
        or not url.host
        or url.userinfo
        or url.port not in {None, 80 if url.scheme == "http" else 443}
    ):
        raise WebsiteProviderError(InspectionReason.INVALID_URL)

    host = url.host.rstrip(".").casefold()
    if (
        "%" in host
        or host == "localhost"
        or host.endswith((".localhost", ".local", ".internal", ".test", ".invalid", ".example"))
    ):
        raise WebsiteProviderError(InspectionReason.BLOCKED_DESTINATION)
    try:
        ipaddress.ip_address(host)
    except ValueError:
        # O DNS será resolvido e validado pelo backend antes de abrir o socket.
        pass
    else:
        validate_public_ip(host)
    return url.copy_with(fragment=None)


async def resolve_public_addresses(host: str, port: int) -> tuple[str, ...]:
    try:
        records = await asyncio.get_running_loop().getaddrinfo(
            host, port, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP
        )
    except socket.gaierror as exc:
        raise WebsiteProviderError(InspectionReason.DNS_ERROR) from exc
    # Rejeitar toda a resolução se houver qualquer destino não público.
    addresses = tuple(dict.fromkeys(validate_public_ip(record[4][0]) for record in records))
    if not addresses:
        raise WebsiteProviderError(InspectionReason.DNS_ERROR)
    return addresses
