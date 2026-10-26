from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.website_inspection import WebsiteInspection


@pytest.mark.parametrize(
    "change",
    [
        {"status": "not_found", "reason": "http_error"},
        {"status": "found", "reason": "matching_page", "confidence": "medium"},
        {"status": "inconclusive", "reason": "timeout", "confidence": "low"},
        {"checked_at": datetime.now(UTC).isoformat()},
        {"confidence": "medium"},
        {"is_simulated": "true"},
    ],
)
def test_inconsistent_inspection_results_are_rejected(change: dict[str, object]) -> None:
    data = {
        "status": "not_checked",
        "reason": "simulated_business",
        "requested_url": "https://example.org/",
        "is_simulated": True,
        **change,
    }

    with pytest.raises(ValidationError):
        WebsiteInspection.model_validate(data)


@pytest.mark.parametrize(
    "problem",
    [
        "missing_evidence",
        "failed_http",
        "wrong_content",
        "missing_city",
        "wrong_url",
        "future_observation",
        "wrong_confidence",
        "wrong_reason",
    ],
)
def test_found_requires_consistent_http_and_identity_evidence(problem: str) -> None:
    now = datetime.now(UTC)
    evidence = {
        "url": "https://example.org/",
        "observed_at": now,
        "status_code": 200,
        "content_type": "text/html",
        "matches": ["name", "city"],
    }
    data = {
        "status": "found",
        "reason": "matching_page",
        "requested_url": "https://example.org/",
        "final_url": "https://example.org/",
        "is_simulated": False,
        "checked_at": now,
        "confidence": "medium",
        "evidence": [evidence],
    }
    if problem == "missing_evidence":
        data["evidence"] = []
    elif problem == "failed_http":
        evidence["status_code"] = 404
    elif problem == "wrong_content":
        evidence["content_type"] = "application/json"
    elif problem == "missing_city":
        evidence["matches"] = ["name"]
    elif problem == "wrong_url":
        data["final_url"] = "https://other.org/"
    elif problem == "future_observation":
        evidence["observed_at"] = now + timedelta(seconds=1)
    elif problem == "wrong_confidence":
        data["confidence"] = "low"
    else:
        data["reason"] = "timeout"

    with pytest.raises(ValidationError):
        WebsiteInspection.model_validate(data)
