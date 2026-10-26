"""Contrato de geração de texto; não possui destinatário, credenciais ou transporte."""

from dataclasses import dataclass
from typing import Protocol

from app.schemas.discovery import Segment
from app.schemas.lead_scoring import DigitalNeed
from app.schemas.message_generation import MessageChannel, MessageContent


@dataclass(frozen=True)
class MessageContext:
    business_name: str
    city: str
    segment: Segment
    need: DigitalNeed
    channel: MessageChannel


class MessageProviderError(Exception):
    """Falha conhecida de geração; detalhes internos não pertencem à resposta HTTP."""


class MessageContextError(Exception):
    """A solução escolhida não tem suporte no contexto atual."""


class MessageProvider(Protocol):
    async def generate(self, context: MessageContext, *, instructions: str) -> MessageContent: ...
