from datetime import UTC, datetime, timedelta

import pytest
from pydantic import HttpUrl, ValidationError

from app.schemas.business import Business, BusinessLocation
from app.schemas.discovery import Segment
from app.schemas.lead_scoring import (
    CriterionName,
    DigitalNeed,
    LeadScore,
    LeadScoringRequest,
    ManualWebsiteReview,
    NeedObservation,
    ScoringEvidence,
    ScoringWarning,
)
from app.schemas.website_inspection import WebsiteInspection
from app.services.lead_scoring_service import LeadScoringService

NOW = datetime(2026, 10, 25, 12, tzinfo=UTC)


def evidence(
    *,
    observed_at: datetime = NOW,
    url: str = "https://source.example/observation",
) -> ScoringEvidence:
    return ScoringEvidence(
        source="Fonte simulada de teste",
        source_url=HttpUrl(url),
        observed_at=observed_at,
        description="Observação fictícia registrada exclusivamente para este teste.",
    )


def review(*, at: datetime = NOW, status: str = "not_found") -> ManualWebsiteReview:
    return ManualWebsiteReview.model_validate(
        {
            "status": status,
            "reviewed_at": at,
            "website": "https://business.example/" if status == "found" else None,
            "checks": ["Pesquisa por nome e localização", "Revisão de outra fonte comercial"],
            "evidence": [
                evidence(observed_at=at),
                evidence(observed_at=at, url="https://second.example/observation"),
            ],
        }
    )


def request(**changes: object) -> LeadScoringRequest:
    return LeadScoringRequest.model_validate(
        {
            "business": Business(
                name="Negócio de teste",
                category=Segment.RESTAURANTES,
                location=BusinessLocation(city="Teresina", state="PI", address="Rua de teste, 1"),
                source="teste",
                source_id="test-1",
                is_simulated=False,
            ),
            **changes,
        }
    )


def points(result: LeadScore, name: CriterionName) -> int:
    return next(item.points for item in result.criteria if item.name == name)


def score(query: LeadScoringRequest) -> LeadScore:
    return LeadScoringService(clock=lambda: NOW).score(query)


def test_empty_evidence_never_implies_no_website_or_a_digital_need() -> None:
    result = score(request())

    assert result.score == 5  # Apenas endereço e identificador conhecidos.
    assert result.assessed_max_score == 10
    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0
    assert points(result, CriterionName.DIGITAL_NEED) == 0
    assert points(result, CriterionName.DIGITAL_ACTIVITY) == 0
    assert points(result, CriterionName.SERVICE_FIT) == 0
    assert set(result.warnings) == {
        ScoringWarning.WEBSITE_NOT_ASSESSED,
        ScoringWarning.NEED_NOT_ASSESSED,
        ScoringWarning.ACTIVITY_NOT_ASSESSED,
    }


def test_complete_evidence_reaches_100_and_is_repeatable_without_mutation() -> None:
    query = request(
        website_review=review(),
        activity_evidence=[evidence()],
        needs=[
            NeedObservation(need=kind, evidence=evidence())
            for kind in (DigitalNeed.ONLINE_MENU, DigitalNeed.ONLINE_ORDERING)
        ],
    )
    before = query.model_dump()

    result = score(query)

    assert result.score == result.assessed_max_score == result.max_score == 100
    assert result.rules_version == "1.0.0"
    assert result.basis == "provided_evidence"
    assert result.evaluated_at == NOW
    assert result.warnings == []
    assert all(item.evidence_urls for item in result.criteria)
    assert score(query) == result
    assert query.model_dump() == before


def test_duplicate_needs_cannot_inflate_score() -> None:
    need = NeedObservation(need=DigitalNeed.SCHEDULING, evidence=evidence())

    result = score(request(needs=[need] * 20))

    assert points(result, CriterionName.DIGITAL_NEED) == 15
    assert points(result, CriterionName.SERVICE_FIT) == 20
    assert len(result.criteria[1].evidence_urls) == 1
    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0


def test_many_distinct_needs_are_capped() -> None:
    result = score(
        request(needs=[NeedObservation(need=kind, evidence=evidence()) for kind in DigitalNeed])
    )

    assert points(result, CriterionName.DIGITAL_NEED) == 30


def test_manual_found_review_does_not_receive_absence_points() -> None:
    result = score(request(website_review=review(status="found")))

    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0
    assert result.criteria[0].assessed is True
    assert ScoringWarning.WEBSITE_NOT_ASSESSED not in result.warnings


def test_inconclusive_review_does_not_establish_website_absence() -> None:
    result = score(request(website_review=review(status="inconclusive")))

    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0
    assert result.criteria[0].assessed is False
    assert ScoringWarning.WEBSITE_NOT_ASSESSED in result.warnings


@pytest.mark.parametrize(
    ("at", "warning"),
    [
        (NOW - timedelta(days=91), ScoringWarning.STALE_EVIDENCE),
        (NOW + timedelta(seconds=1), ScoringWarning.FUTURE_EVIDENCE),
    ],
)
def test_old_or_future_evidence_is_excluded(at: datetime, warning: ScoringWarning) -> None:
    result = score(
        request(
            website_review=review(at=at),
            activity_evidence=[evidence(observed_at=at)],
            needs=[NeedObservation(need=DigitalNeed.WEBSITE, evidence=evidence(observed_at=at))],
        )
    )

    assert result.score == 5
    assert result.assessed_max_score == 10
    assert result.warnings.count(warning) == 1
    assert all(not item.evidence_urls for item in result.criteria)


@pytest.mark.parametrize(
    ("age", "expected"),
    [(timedelta(days=90), 15), (timedelta(days=90, microseconds=1), 0)],
)
def test_evidence_freshness_boundary(age: timedelta, expected: int) -> None:
    result = score(
        request(
            needs=[
                NeedObservation(
                    need=DigitalNeed.SCHEDULING, evidence=evidence(observed_at=NOW - age)
                )
            ]
        )
    )

    assert points(result, CriterionName.DIGITAL_NEED) == expected


def test_stale_need_does_not_count_as_second_distinct_need() -> None:
    result = score(
        request(
            needs=[
                NeedObservation(need=DigitalNeed.ONLINE_MENU, evidence=evidence()),
                NeedObservation(
                    need=DigitalNeed.ONLINE_ORDERING,
                    evidence=evidence(observed_at=NOW - timedelta(days=91)),
                ),
            ]
        )
    )

    assert points(result, CriterionName.DIGITAL_NEED) == 15


def test_current_review_with_old_supporting_evidence_is_not_counted() -> None:
    data = review().model_dump()
    data["evidence"][0]["observed_at"] = NOW - timedelta(days=91)

    result = score(request(website_review=data))

    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0
    assert ScoringWarning.STALE_EVIDENCE in result.warnings


def test_simulated_scores_are_explicitly_marked() -> None:
    data = request().model_dump()
    data["business"]["is_simulated"] = True

    result = score(LeadScoringRequest.model_validate(data))

    assert result.is_simulated is True
    assert ScoringWarning.SIMULATED_DATA in result.warnings


def inspection(*, found: bool, at: datetime = NOW) -> WebsiteInspection:
    return WebsiteInspection.model_validate(
        {
            "status": "found" if found else "inconclusive",
            "reason": "matching_page" if found else "http_error",
            "requested_url": "https://business.example/",
            "final_url": "https://business.example/",
            "checked_at": at,
            "confidence": "medium" if found else "low",
            "is_simulated": False,
            "evidence": [
                {
                    "url": "https://business.example/",
                    "observed_at": at,
                    "status_code": 200 if found else 404,
                    "content_type": "text/html",
                    "matches": ["name", "city"] if found else [],
                }
            ],
        }
    )


@pytest.mark.parametrize("found", [False, True])
def test_url_inspection_never_supplies_website_absence_points(found: bool) -> None:
    data = request().model_dump()
    data["business"]["website"] = "https://business.example/"
    data["website_inspection"] = inspection(found=found)

    result = score(LeadScoringRequest.model_validate(data))

    assert points(result, CriterionName.WEBSITE_OPPORTUNITY) == 0
    assert result.criteria[0].assessed is found


def test_stale_inspection_is_not_counted_as_current_evidence() -> None:
    data = request().model_dump()
    data["business"]["website"] = "https://business.example/"
    data["website_inspection"] = inspection(found=True, at=NOW - timedelta(days=91))

    result = score(LeadScoringRequest.model_validate(data))

    assert result.score == 5
    assert result.criteria[0].assessed is False
    assert ScoringWarning.STALE_EVIDENCE in result.warnings


def test_inspection_for_another_website_is_rejected() -> None:
    with pytest.raises(ValidationError, match="corresponder"):
        request(website_inspection=inspection(found=True))


def test_contradictory_manual_review_is_rejected() -> None:
    data = request(website_review=review()).model_dump()
    data["business"]["website"] = "https://business.example/"
    data["website_inspection"] = inspection(found=True)

    with pytest.raises(ValidationError, match="contradiz"):
        LeadScoringRequest.model_validate(data)


def test_naive_evaluation_clock_is_rejected() -> None:
    with pytest.raises(ValueError, match="fuso"):
        LeadScoringService(clock=lambda: datetime(2026, 10, 25)).score(request())
