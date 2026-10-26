"""Vocabulário de soluções correspondente às necessidades já aceitas pela API."""

from app.schemas.lead_scoring import DigitalNeed

SOLUTION_LABELS: dict[DigitalNeed, str] = {
    DigitalNeed.WEBSITE: "site institucional",
    DigitalNeed.ONLINE_MENU: "cardápio digital",
    DigitalNeed.PRODUCT_CATALOG: "catálogo de produtos",
    DigitalNeed.ONLINE_ORDERING: "sistema de pedidos online",
    DigitalNeed.SCHEDULING: "sistema de agendamento",
    DigitalNeed.WORKFLOW_AUTOMATION: "automação de processos",
    DigitalNeed.API_INTEGRATION: "integração de APIs",
    DigitalNeed.CUSTOM_SYSTEM: "sistema web personalizado",
}
