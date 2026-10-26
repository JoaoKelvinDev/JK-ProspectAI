"""Classificação conservadora e determinística da URL informada."""

import re
import unicodedata
from datetime import UTC, datetime
from html.parser import HTMLParser

from app.providers.website import WebsiteProvider, WebsiteProviderError
from app.schemas.business import Business
from app.schemas.website_inspection import (
    InspectionReason,
    WebsiteInspection,
    WebsiteStatus,
)


class _PageText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self._ignored_tags: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "template"}:
            self._ignored_tags.append(tag)
        if tag == "title" and not self._ignored_tags:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if self._ignored_tags:
            if tag == self._ignored_tags[-1]:
                self._ignored_tags.pop()
            return
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if not self._ignored_tags:
            self.parts.append(data)
            if self._in_title:
                self.title_parts.append(data)


def _normalized_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(re.sub(r"[\W_]+", " ", plain).split())


class WebsiteInspectorService:
    def __init__(self, provider: WebsiteProvider) -> None:
        self._provider = provider

    async def inspect(self, business: Business) -> WebsiteInspection:
        if business.is_simulated or business.website is None:
            return WebsiteInspection(
                status=WebsiteStatus.NOT_CHECKED,
                reason=(
                    InspectionReason.SIMULATED_BUSINESS
                    if business.is_simulated
                    else InspectionReason.MISSING_URL
                ),
                requested_url=business.website,
                is_simulated=business.is_simulated,
            )
        try:
            page = await self._provider.fetch(str(business.website))
        except WebsiteProviderError as exc:
            return WebsiteInspection(
                status=WebsiteStatus.INCONCLUSIVE,
                reason=exc.reason,
                requested_url=business.website,
                final_url=exc.evidence[-1].url if exc.evidence else None,
                checked_at=datetime.now(UTC),
                confidence="low",
                is_simulated=False,
                evidence=list(exc.evidence),
            )

        text = _PageText()
        text.feed(page.html)
        text.close()
        haystack = f" {_normalized_text(' '.join(text.parts))} "
        matches = [
            field
            for field, value in (("name", business.name), ("city", business.location.city))
            if (needle := _normalized_text(value)) and f" {needle} " in haystack
        ]
        found = len(matches) == 2
        final_evidence = page.evidence[-1].model_copy(
            update={
                "title": " ".join(" ".join(text.title_parts).split())[:200] or None,
                "matches": matches,
            }
        )
        return WebsiteInspection(
            status=WebsiteStatus.FOUND if found else WebsiteStatus.INCONCLUSIVE,
            reason=InspectionReason.MATCHING_PAGE if found else InspectionReason.IDENTITY_MISMATCH,
            requested_url=business.website,
            final_url=final_evidence.url,
            checked_at=datetime.now(UTC),
            confidence="medium" if found else "low",
            is_simulated=False,
            evidence=[*page.evidence[:-1], final_evidence],
        )
