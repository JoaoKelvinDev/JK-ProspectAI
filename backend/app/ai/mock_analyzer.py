"""Provedor determinístico de demonstração, sem LLM e sem consultas de rede."""

from app.ai.solutions import SOLUTION_LABELS
from app.schemas.business_analysis import AnalysisDraft, AnalysisFact, AnalysisSuggestion


class MockBusinessAnalysisProvider:
    async def analyze(self, facts: tuple[AnalysisFact, ...], *, instructions: str) -> AnalysisDraft:
        suggestions: list[AnalysisSuggestion] = []
        for need, label in SOLUTION_LABELS.items():
            ids = [item.id for item in facts if item.need == need]
            if not ids:
                continue
            suggestions.append(
                AnalysisSuggestion(
                    need=need,
                    fact_ids=ids,
                    hypothesis=(
                        f"Se a necessidade de {label} for confirmada com o responsável, "
                        "uma solução poderá ser adequada ao processo do negócio."
                    ),
                    opportunity=f"Avaliar a viabilidade de {label} com o contexto registrado.",
                    suggested_solution=f"Considerar {label}, com escopo definido após validação.",
                    validation_question=(
                        f"Como o negócio atende hoje essa necessidade e quais requisitos "
                        f"precisariam ser considerados em um projeto de {label}?"
                    ),
                )
            )
        return AnalysisDraft(suggestions=suggestions)
