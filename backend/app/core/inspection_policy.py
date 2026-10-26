"""Limites conservadores da inspeção, injetáveis sem configuração externa."""

from pydantic import BaseModel, ConfigDict, Field


class InspectionPolicy(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    connect_timeout: float = Field(default=3.0, gt=0)
    total_timeout: float = Field(default=10.0, gt=0)
    max_response_bytes: int = Field(default=512 * 1024, gt=0)
    max_redirects: int = Field(default=3, ge=0)
