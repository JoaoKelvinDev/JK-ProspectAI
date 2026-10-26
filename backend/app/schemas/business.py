"""Informações comerciais recebidas de uma fonte, ainda sem inspeção de site."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints

from app.schemas.discovery import BrazilianState, City, Segment

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class BusinessLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: City
    state: BrazilianState
    country: Literal["BR"] = "BR"
    address: Text | None = None


class Business(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Text
    category: Segment
    location: BusinessLocation
    website: HttpUrl | None = None
    source_id: Text | None = None
    source: Text
    is_simulated: Annotated[bool, Field(strict=True)]
    website_status: Literal["not_checked"] = "not_checked"
