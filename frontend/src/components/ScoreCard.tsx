import { ChartNoAxesColumnIncreasing, Info } from 'lucide-react';
import { criterionLabels, warningLabels } from '../contracts';
import type { LeadScore } from '../contracts';
import { formatDate } from '../lib/format';

export function ScoreCard({ score }: { score: LeadScore }) {
  return (
    <div className="score-card">
      <div className="score-overview">
        <div>
          <span className="eyebrow">PONTUAÇÃO COMERCIAL</span>
          <div className="score-value">
            <output aria-label="Pontuação comercial">{score.score}</output>
            <span>/100</span>
          </div>
        </div>
        <div className="score-symbol">
          <ChartNoAxesColumnIncreasing size={28} />
        </div>
      </div>
      <p className="coverage">
        Critérios avaliados: <strong>{score.assessed_max_score}/100</strong> pontos possíveis
      </p>
      <div className="criteria-list">
        {score.criteria.map((criterion) => (
          <details key={criterion.name} className="criterion">
            <summary>
              <span>{criterionLabels[criterion.name] ?? criterion.name}</span>
              <strong>
                {criterion.assessed
                  ? `${criterion.points}/${criterion.max_points}`
                  : 'Sem evidência'}
              </strong>
            </summary>
            <div
              className="criterion-meter"
              role="meter"
              aria-label={criterionLabels[criterion.name] ?? criterion.name}
              aria-valuemin={0}
              aria-valuemax={criterion.max_points}
              aria-valuenow={criterion.points}
            >
              <span style={{ width: `${(criterion.points / criterion.max_points) * 100}%` }} />
            </div>
            <p>{criterion.reason}</p>
            {criterion.evidence_urls.map((url) => (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                key={url}
                className="evidence-link"
              >
                {new URL(url).hostname}
              </a>
            ))}
          </details>
        ))}
      </div>
      {score.warnings.length > 0 && (
        <div className="score-warnings">
          <Info size={15} />
          <ul>
            {score.warnings.map((warning) => (
              <li key={warning}>{warningLabels[warning] ?? warning}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="score-meta">
        Regras {score.rules_version} · {formatDate(score.evaluated_at)}
      </p>
    </div>
  );
}
