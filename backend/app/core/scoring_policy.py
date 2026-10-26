"""Política comercial inicial: pesos explícitos, sem inferência por LLM."""

from datetime import timedelta
from types import MappingProxyType

from app.schemas.lead_scoring import CriterionName

RULES_VERSION = "1.0.0"
EVIDENCE_MAX_AGE = timedelta(days=90)
POINTS_PER_DISTINCT_NEED = 15
ADDRESS_POINTS = 3
SOURCE_ID_POINTS = 2
CURRENT_EVIDENCE_POINTS = 5
MAX_POINTS = MappingProxyType(
    {
        CriterionName.WEBSITE_OPPORTUNITY: 25,
        CriterionName.DIGITAL_NEED: 30,
        CriterionName.DIGITAL_ACTIVITY: 15,
        CriterionName.SERVICE_FIT: 20,
        CriterionName.DATA_QUALITY: 10,
    }
)
