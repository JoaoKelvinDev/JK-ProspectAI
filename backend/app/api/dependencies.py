"""Composição explícita dos serviços e seus provedores."""

from app.ai.mock_analyzer import MockBusinessAnalysisProvider
from app.ai.mock_message_provider import MockMessageProvider
from app.core.inspection_policy import InspectionPolicy
from app.providers.http_website_provider import HTTPWebsiteProvider
from app.providers.mock_provider import MockDiscoveryProvider
from app.services.business_analysis_service import BusinessAnalysisService
from app.services.discovery_service import DiscoveryService
from app.services.lead_scoring_service import LeadScoringService
from app.services.message_generation_service import MessageGenerationService
from app.services.website_inspector_service import WebsiteInspectorService


def get_discovery_service() -> DiscoveryService:
    return DiscoveryService(provider=MockDiscoveryProvider())


def get_website_inspector_service() -> WebsiteInspectorService:
    return WebsiteInspectorService(provider=HTTPWebsiteProvider(policy=InspectionPolicy()))


def get_lead_scoring_service() -> LeadScoringService:
    return LeadScoringService()


def get_business_analysis_service() -> BusinessAnalysisService:
    return BusinessAnalysisService(provider=MockBusinessAnalysisProvider())


def get_message_generation_service() -> MessageGenerationService:
    return MessageGenerationService(
        analyzer=get_business_analysis_service(), provider=MockMessageProvider()
    )
