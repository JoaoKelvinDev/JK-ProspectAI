import asyncio
from datetime import UTC, datetime

import pytest
from pydantic import HttpUrl

from app.providers.website import WebsitePage, WebsiteProviderError
from app.schemas.business import Business, BusinessLocation
from app.schemas.discovery import Segment
from app.schemas.website_inspection import InspectionEvidence, InspectionReason, WebsiteStatus
from app.services.website_inspector_service import WebsiteInspectorService


def make_business(*, simulated: bool = False, with_url: bool = True) -> Business:
    return Business(
        name="Café Central",
        category=Segment.RESTAURANTES,
        location=BusinessLocation(city="Teresina", state="PI"),
        website=HttpUrl("https://example.org/") if with_url else None,
        source="manual",
        is_simulated=simulated,
    )


class StaticProvider:
    def __init__(self, html: str) -> None:
        self.html = html
        self.calls: list[str] = []

    async def fetch(self, url: str) -> WebsitePage:
        self.calls.append(url)
        return WebsitePage(
            html=self.html,
            evidence=(
                InspectionEvidence(
                    url=HttpUrl(url),
                    observed_at=datetime.now(UTC),
                    status_code=200,
                    content_type="text/html",
                ),
            ),
        )


def test_found_requires_both_name_and_city_and_does_not_mutate_business() -> None:
    provider = StaticProvider(
        "<html><title>Café Central</title><body>Bem-vindo a Teresina!</body></html>"
    )
    business = make_business()
    before = business.model_dump()

    result = asyncio.run(WebsiteInspectorService(provider).inspect(business))

    assert result.status == WebsiteStatus.FOUND
    assert result.reason == InspectionReason.MATCHING_PAGE
    assert result.confidence == "medium"
    assert result.scope == "provided_url"
    assert result.evidence[-1].matches == ["name", "city"]
    assert result.evidence[-1].title == "Café Central"
    assert result.evidence[-1].source == "http"
    assert result.checked_at is not None and result.checked_at.utcoffset().total_seconds() == 0
    assert result.evidence[-1].observed_at.tzinfo is not None
    assert provider.calls == [str(business.website)]
    assert business.model_dump() == before
    assert business.website_status == "not_checked"


@pytest.mark.parametrize(
    "html",
    [
        "<p>  CAFE    CENTRAL — TERESINA </p>",
        "<h1>Café <em>Central</em></h1><p>Teresina</p>",
        "<p>Caf&#233; Central, Teresina</p>",
    ],
)
def test_matching_normalizes_accents_case_whitespace_and_html_entities(html: str) -> None:
    result = asyncio.run(WebsiteInspectorService(StaticProvider(html)).inspect(make_business()))

    assert result.status == WebsiteStatus.FOUND


@pytest.mark.parametrize(
    "html",
    [
        "<p>Café Central</p>",
        "<p>Teresina</p>",
        "<p>Outra empresa em Teresina</p>",
        "<p>Café Centralizado em Teresina</p>",
        "",
        "<script>Café Central Teresina</script>",
        "<style>Café Central Teresina</style>",
        "<template>Café Central Teresina</template>",
        "<template></style>Café Central Teresina</template>",
        "<!-- Café Central Teresina -->",
        '<img alt="Café Central Teresina">',
    ],
)
def test_missing_identity_evidence_is_inconclusive(html: str) -> None:
    result = asyncio.run(WebsiteInspectorService(StaticProvider(html)).inspect(make_business()))

    assert result.status == WebsiteStatus.INCONCLUSIVE
    assert result.reason == InspectionReason.IDENTITY_MISMATCH
    assert result.confidence == "low"


@pytest.mark.parametrize(
    ("simulated", "with_url", "reason"),
    [
        (True, True, InspectionReason.SIMULATED_BUSINESS),
        (True, False, InspectionReason.SIMULATED_BUSINESS),
        (False, False, InspectionReason.MISSING_URL),
    ],
)
def test_skipped_inspection_does_not_call_provider(
    simulated: bool, with_url: bool, reason: InspectionReason
) -> None:
    provider = StaticProvider("must not be fetched")

    result = asyncio.run(
        WebsiteInspectorService(provider).inspect(
            make_business(simulated=simulated, with_url=with_url)
        )
    )

    assert result.status == WebsiteStatus.NOT_CHECKED
    assert result.reason == reason
    assert result.checked_at is None
    assert result.confidence is None
    assert result.evidence == []
    assert result.final_url is None
    assert provider.calls == []


@pytest.mark.parametrize(
    "reason",
    [
        InspectionReason.TIMEOUT,
        InspectionReason.DNS_ERROR,
        InspectionReason.BLOCKED_DESTINATION,
        InspectionReason.HTTP_ERROR,
        InspectionReason.CONNECTION_ERROR,
    ],
)
def test_expected_failure_is_inconclusive_with_collected_evidence(reason: InspectionReason) -> None:
    evidence = InspectionEvidence(
        url=HttpUrl("https://example.org/"),
        observed_at=datetime.now(UTC),
        status_code=302,
        content_type="text/html",
    )

    class FailingProvider:
        async def fetch(self, url: str) -> WebsitePage:
            raise WebsiteProviderError(reason, (evidence,))

    result = asyncio.run(WebsiteInspectorService(FailingProvider()).inspect(make_business()))

    assert result.status == WebsiteStatus.INCONCLUSIVE
    assert result.reason == reason
    assert result.evidence == [evidence]
    assert result.final_url == evidence.url
    assert result.checked_at is not None


def test_unexpected_error_is_not_disguised_as_inspection_result() -> None:
    class BrokenProvider:
        async def fetch(self, url: str) -> WebsitePage:
            raise RuntimeError("unexpected bug")

    with pytest.raises(RuntimeError, match="unexpected bug"):
        asyncio.run(WebsiteInspectorService(BrokenProvider()).inspect(make_business()))


def test_external_cancellation_is_not_swallowed() -> None:
    class CancelledProvider:
        async def fetch(self, url: str) -> WebsitePage:
            raise asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(WebsiteInspectorService(CancelledProvider()).inspect(make_business()))
