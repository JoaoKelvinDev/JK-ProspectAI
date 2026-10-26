"""Inspeção individual e explícita de um estabelecimento."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_website_inspector_service
from app.schemas.business import Business
from app.schemas.website_inspection import WebsiteInspection
from app.services.website_inspector_service import WebsiteInspectorService

router = APIRouter(prefix="/api/v1/website-inspector", tags=["Website Inspector"])


@router.post(
    "/inspect",
    response_model=WebsiteInspection,
    summary="Inspecionar a URL candidata de um estabelecimento",
    description=(
        "Resultado limitado à URL fornecida; não comprova propriedade oficial ou ausência de site."
    ),
)
async def inspect_website(
    business: Business,
    service: Annotated[WebsiteInspectorService, Depends(get_website_inspector_service)],
) -> WebsiteInspection:
    return await service.inspect(business)
