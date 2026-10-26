"""Mensagens condicionais por modelos de texto, sem LLM ou acesso externo."""

from app.ai.message_provider import MessageContext
from app.ai.solutions import SOLUTION_LABELS
from app.schemas.discovery import Segment
from app.schemas.message_generation import MessageChannel, MessageContent

SEGMENT_LABELS: dict[Segment, str] = {
    Segment.ACAITERIAS: "açaiterias",
    Segment.RESTAURANTES: "restaurantes",
    Segment.LANCHONETES: "lanchonetes",
    Segment.BARES: "bares",
    Segment.BARBEARIAS: "barbearias",
    Segment.SALOES_DE_BELEZA: "salões de beleza",
    Segment.LOJAS_DE_ROUPAS: "lojas de roupas",
    Segment.MERCADINHOS: "mercadinhos",
    Segment.PEQUENOS_COMERCIOS: "pequenos comércios",
    Segment.PRESTADORES_DE_SERVICOS: "prestadores de serviços",
    Segment.OUTROS_ESTABELECIMENTOS: "outros estabelecimentos comerciais",
}


class MockMessageProvider:
    async def generate(self, context: MessageContext, *, instructions: str) -> MessageContent:
        # Dados de cadastro entram em uma linha de texto, nunca em instruções ou cabeçalhos.
        name = " ".join(context.business_name.split())
        city = " ".join(context.city.split())
        label = SOLUTION_LABELS[context.need]
        segment = SEGMENT_LABELS[context.segment]
        greeting = f"Olá, equipe do {name}, em {city}!"
        proposal = (
            f"Sou da JK Dev. Desenvolvemos soluções como {label} para negócios "
            f"do segmento de {segment}."
        )
        question = (
            f"Se {label} fizer sentido para vocês, podemos conversar sobre "
            "as necessidades da equipe e avaliar um escopo adequado?"
        )
        if context.channel == MessageChannel.EMAIL:
            return MessageContent(
                subject=f"Uma possibilidade de {label} para o negócio",
                body=f"{greeting}\n\n{proposal}\n\n{question}\n\nAtenciosamente,\nJK Dev",
            )
        return MessageContent(body=f"{greeting} {proposal} {question}")
