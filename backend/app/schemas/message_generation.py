"""Rascunhos comerciais para revisão, sem estado de aprovação ou envio."""

from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.schemas.business_analysis import AnalysisFact, BusinessAnalysisRequest
from app.schemas.lead_scoring import Description, DigitalNeed


class MessageChannel(StrEnum):
    SHORT_MESSAGE = "short_message"
    EMAIL = "email"


class MessageGenerationRequest(BusinessAnalysisRequest):
    selected_need: DigitalNeed
    channel: MessageChannel = MessageChannel.SHORT_MESSAGE


class MessageContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
        | None
    ) = None
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

    @field_validator("subject", mode="before")
    @classmethod
    def reject_subject_controls(cls, value: object) -> object:
        if isinstance(value, str) and any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("O assunto deve ocupar uma linha, sem caracteres de controle")
        return value


class MessageDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["draft"] = "draft"
    review_status: Literal["pending_review"] = "pending_review"
    delivery_status: Literal["not_sent"] = "not_sent"
    locale: Literal["pt-BR"] = "pt-BR"
    provider: Literal["mock"] = "mock"
    generation_mode: Literal["simulated"] = "simulated"
    prompt_version: Literal["1.0.0"] = "1.0.0"
    generated_at: AwareDatetime
    business_is_simulated: Annotated[bool, Field(strict=True)]
    selected_need: DigitalNeed
    channel: MessageChannel
    content: MessageContent
    context_facts: list[AnalysisFact] = Field(min_length=1, max_length=21)
    limitations: list[Description] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_draft(self) -> Self:
        ids = [item.id for item in self.context_facts]
        if len(ids) != len(set(ids)) or any(
            item.need != self.selected_need or not item.evidence for item in self.context_facts
        ):
            raise ValueError("O rascunho requer fatos documentados da solução escolhida")
        if self.channel == MessageChannel.SHORT_MESSAGE:
            if self.content.subject is not None or len(self.content.body) > 900:
                raise ValueError("Mensagem curta deve ter até 900 caracteres e não ter assunto")
        elif self.content.subject is None:
            raise ValueError("E-mail requer assunto")
        return self
