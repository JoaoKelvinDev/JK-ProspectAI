"""Contrato HTTP da pesquisa de estabelecimentos."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_discovery_service
from app.providers.base import DiscoveryProviderError
from app.schemas.business import Business
from app.schemas.discovery import DiscoveryRequest
from app.services.discovery_service import DiscoveryService

router = APIRouter(prefix="/api/v1/discovery", tags=["Discovery"])


@router.post(
    "/search",
    response_model=list[Business],
    summary="Pesquisar estabelecimentos simulados",
    responses={502: {"description": "Falha ao consultar o provedor de descoberta"}},
)
def search_businesses(
    query: DiscoveryRequest,
    service: Annotated[DiscoveryService, Depends(get_discovery_service)],
) -> list[Business]:
    try:
        return service.search(query)
    except DiscoveryProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar o provedor de descoberta.",
        ) from exc
