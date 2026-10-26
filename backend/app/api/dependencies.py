"""Composição explícita dos serviços e seus provedores."""

from app.core.inspection_policy import InspectionPolicy
from app.providers.http_website_provider import HTTPWebsiteProvider
from app.providers.mock_provider import MockDiscoveryProvider
from app.services.discovery_service import DiscoveryService
from app.services.lead_scoring_service import LeadScoringService
from app.services.website_inspector_service import WebsiteInspectorService


def get_discovery_service() -> DiscoveryService:
    return DiscoveryService(provider=MockDiscoveryProvider())


def get_website_inspector_service() -> WebsiteInspectorService:
    return WebsiteInspectorService(provider=HTTPWebsiteProvider(policy=InspectionPolicy()))


def get_lead_scoring_service() -> LeadScoringService:
    return LeadScoringService()
