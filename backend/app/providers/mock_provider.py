"""Catálogo fictício e determinístico; nenhuma consulta externa é realizada."""

from pydantic import HttpUrl

from app.schemas.business import Business, BusinessLocation
from app.schemas.discovery import DiscoveryRequest, Segment

# Todos os nomes e endereços abaixo são inventados para demonstração.
_SEEDS: tuple[tuple[str, Segment, str, str | None], ...] = (
    ("Açaiteria Simulada 01", Segment.ACAITERIAS, "Rua Fictícia, 1", None),
    (
        "Restaurante Simulado 02",
        Segment.RESTAURANTES,
        "Rua Fictícia, 2",
        "https://restaurante.example/",
    ),
    ("Lanchonete Simulada 03", Segment.LANCHONETES, "Rua Fictícia, 3", None),
    ("Bar Simulado 04", Segment.BARES, "Rua Fictícia, 4", None),
    ("Barbearia Simulada 05", Segment.BARBEARIAS, "Rua Fictícia, 5", None),
    ("Salão Simulado 06", Segment.SALOES_DE_BELEZA, "Rua Fictícia, 6", None),
    (
        "Loja Simulada 07",
        Segment.LOJAS_DE_ROUPAS,
        "Rua Fictícia, 7",
        "https://loja.example/",
    ),
    ("Mercadinho Simulado 08", Segment.MERCADINHOS, "Rua Fictícia, 8", None),
    ("Comércio Simulado 09", Segment.PEQUENOS_COMERCIOS, "Rua Fictícia, 9", None),
    ("Serviço Simulado 10", Segment.PRESTADORES_DE_SERVICOS, "Rua Fictícia, 10", None),
    ("Estabelecimento Simulado 11", Segment.OUTROS_ESTABELECIMENTOS, "Rua Fictícia, 11", None),
    ("Restaurante Simulado 12", Segment.RESTAURANTES, "Rua Fictícia, 12", None),
)


class MockDiscoveryProvider:
    def search(self, query: DiscoveryRequest) -> list[Business]:
        if query.city.casefold() != "teresina" or query.state != "PI":
            return []

        return [
            Business(
                name=name,
                category=category,
                location=BusinessLocation(city="Teresina", state="PI", address=address),
                website=HttpUrl(website) if website is not None else None,
                source_id=f"mock-{index:03d}",
                source="mock",
                is_simulated=True,
            )
            for index, (name, category, address, website) in enumerate(_SEEDS, start=1)
            if not query.segments or category in query.segments
        ]
