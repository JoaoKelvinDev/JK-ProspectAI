import type { BusinessAnalysis } from '../contracts';
import { needLabels } from '../contracts';
import { formatDate } from '../lib/format';

export function AnalysisCard({ analysis }: { analysis: BusinessAnalysis }) {
  return (
    <div className="analysis-card" aria-label="Análise do negócio">
      <span className="badge demo">ANÁLISE SIMULADA · SEM LLM</span>
      <p className="small-note">
        Gerada em {formatDate(analysis.analyzed_at)}. Revise as sugestões.
      </p>
      <ul className="analysis-limitations">
        {analysis.limitations.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      {analysis.status === 'insufficient_evidence' && (
        <p>Nenhuma solução sugerida. Registre uma necessidade com evidência atual para analisar.</p>
      )}
      <details className="analysis-facts">
        <summary>Fatos do contexto e evidências utilizadas</summary>
        <p className="small-note">
          Informações recebidas; as fontes do operador não foram verificadas automaticamente.
        </p>
        <ol>
          {analysis.facts.map((fact) => (
            <li key={fact.id}>
              <p>{fact.statement}</p>
              {fact.evidence.map((item, index) => (
                <div className="analysis-source" key={`${fact.id}-${index}`}>
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                    {item.source}
                  </a>
                  <small>{formatDate(item.observed_at)}</small>
                  <p>{item.description}</p>
                </div>
              ))}
            </li>
          ))}
        </ol>
      </details>
      {analysis.suggestions.map((suggestion) => (
        <article className="analysis-suggestion" key={suggestion.need}>
          <h4>{needLabels[suggestion.need]}</h4>
          <dl>
            <dt>Hipótese a validar</dt>
            <dd>{suggestion.hypothesis}</dd>
            <dt>Oportunidade</dt>
            <dd>{suggestion.opportunity}</dd>
            <dt>Solução sugerida</dt>
            <dd>{suggestion.suggested_solution}</dd>
            <dt>Pergunta para revisão</dt>
            <dd>{suggestion.validation_question}</dd>
          </dl>
          <details>
            <summary>Contexto que sustenta a sugestão</summary>
            <ul>
              {suggestion.fact_ids.map((id) => (
                <li key={id}>{analysis.facts.find((fact) => fact.id === id)?.statement}</li>
              ))}
            </ul>
          </details>
        </article>
      ))}
    </div>
  );
}
