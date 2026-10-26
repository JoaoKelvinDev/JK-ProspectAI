"""Filtros e catálogo de segmentos do Discovery."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

BrazilianState = Literal[
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]
City = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class Segment(StrEnum):
    ACAITERIAS = "acaiterias"
    RESTAURANTES = "restaurantes"
    LANCHONETES = "lanchonetes"
    BARES = "bares"
    BARBEARIAS = "barbearias"
    SALOES_DE_BELEZA = "saloes_de_beleza"
    LOJAS_DE_ROUPAS = "lojas_de_roupas"
    MERCADINHOS = "mercadinhos"
    PEQUENOS_COMERCIOS = "pequenos_comercios"
    PRESTADORES_DE_SERVICOS = "prestadores_de_servicos"
    OUTROS_ESTABELECIMENTOS = "outros_estabelecimentos"


class DiscoveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: City
    state: BrazilianState
    segments: list[Segment] = Field(default_factory=list)
    max_results: Annotated[int, Field(strict=True, ge=1, le=100)] = 20

    @field_validator("city")
    @classmethod
    def normalize_city(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value
