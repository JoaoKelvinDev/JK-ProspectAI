import {
  ArrowUpRight,
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  FilePlus2,
  Globe2,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { inspectionReasons, needLabels, segments } from '../contracts';
import type {
  BusinessEntry,
  MessageContent,
  MessageGenerationOptions,
  ScoringEvidence,
} from '../contracts';
import { businessKey, formatDate, initials } from '../lib/format';
import { ScoreCard } from './ScoreCard';
import { AnalysisCard } from './AnalysisCard';
import { MessageComposer } from './MessageComposer';

export function BusinessPanel({
  entry,
  onInspect,
  onScore,
  onAnalyze,
  onGenerateMessage,
  onEditMessage,
  onAddEvidence,
  onRemove,
  onBack,
}: {
  entry: BusinessEntry | undefined;
  onInspect: () => void;
  onScore: () => void;
  onAnalyze: () => void;
  onGenerateMessage: (options: MessageGenerationOptions) => void;
  onEditMessage: (content: MessageContent) => void;
  onAddEvidence: () => void;
  onRemove: (kind: 'need' | 'activity' | 'review', index?: number) => void;
  onBack: () => void;
}) {
  if (!entry)
    return (
      <aside className="detail-panel detail-placeholder" aria-label="Seu fluxo de trabalho">
        <div className="placeholder-heading">
          <span className="icon-tile">
            <CompassIcon />
          </span>
          <span className="eyebrow">DA PESQUISA À OPORTUNIDADE</span>
        </div>
        <h2>
          Um passo de cada vez.
          <br />
          Com contexto.
        </h2>
        <p>Uma boa prospecção começa com informação, não com suposições.</p>
        <ol className="workflow">
          <li>
            <span>01</span>
            <div>
              <strong>Descubra negócios</strong>
              <p>Defina a região e o segmento.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Revise as evidências</strong>
              <p>Confira a fonte e a presença digital.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Avalie a oportunidade</strong>
              <p>Entenda cada ponto do score.</p>
            </div>
          </li>
        </ol>
        <div className="control-note">
          <ShieldCheck size={19} />
          <p>
            Você conduz a revisão.
            <br />
            <strong>Nenhuma mensagem é enviada.</strong>
          </p>
        </div>
      </aside>
    );
  const { business, inspection } = entry;
  const hasEvidence = entry.needs.length + entry.activity.length + (entry.review ? 1 : 0) > 0;
  const statusLabel =
    inspection?.status === 'found'
      ? 'Site candidato identificado'
      : inspection?.status === 'inconclusive'
        ? 'Verificação inconclusiva'
        : 'Ainda não verificado';
  return (
    <aside
      className="detail-panel"
      id="business-details"
      tabIndex={-1}
      aria-label={`Detalhes de ${business.name}`}
    >
      <button className="button secondary mobile-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Voltar aos resultados
      </button>
      <div className="detail-heading">
        <span className={`business-avatar large tone-${business.category.length % 4}`}>
          {initials(business.name)}
        </span>
        <span className={`badge ${business.is_simulated ? 'demo' : 'manual'}`}>
          {business.is_simulated ? 'Simulado' : 'Manual'}
        </span>
      </div>
      <div className="detail-identity">
        <h2>{business.name}</h2>
        <p>{segments[business.category]}</p>
        <span className="location-line">
          <MapPin size={14} />
          {business.location.city}, {business.location.state}
        </span>
      </div>
      {business.location.address && <p className="address-line">{business.location.address}</p>}
      <div className="detail-section">
        <div className="section-title">
          <Globe2 size={16} />
          <h3>Presença digital</h3>
        </div>
        {business.website ? (
          business.is_simulated ? (
            <span className="website-line">
              {new URL(business.website).hostname}
              <span className="muted text-xs">URL de exemplo</span>
            </span>
          ) : (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="website-line"
            >
              {new URL(business.website).hostname}
              <ArrowUpRight size={15} />
            </a>
          )
        ) : (
          <p className="muted text-sm">Site não informado pela fonte.</p>
        )}
        <span className={`inspection-status ${inspection?.status === 'found' ? 'positive' : ''}`}>
          <span className="mini-dot" />
          {statusLabel}
        </span>
        <p className="small-note">
          {inspection
            ? (inspectionReasons[inspection.reason] ?? 'Revise as evidências da consulta.')
            : 'Sem informação não significa sem site. A URL ainda precisa de verificação.'}
        </p>
        {entry.error && entry.errorAction === 'inspect' && (
          <div role="alert" className="panel-error">
            {entry.error}
          </div>
        )}
        <button
          className="button secondary full-width"
          disabled={entry.pending !== null}
          onClick={onInspect}
        >
          {entry.pending === 'inspect' ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Globe2 size={15} />
          )}
          {entry.pending === 'inspect' ? 'Inspecionando…' : 'Inspecionar URL'}
        </button>
        {inspection && (
          <details className="evidence-details">
            <summary>
              Evidências da inspeção <span>{inspection.evidence.length}</span>
            </summary>
            <p className="small-note">{formatDate(inspection.checked_at)}</p>
            {inspection.evidence.map((item, index) => (
              <div className="http-evidence" key={`${item.url}-${index}`}>
                <strong>
                  HTTP {item.status_code} · {item.content_type || 'Tipo não informado'}
                </strong>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.url}
                  <ExternalLink size={12} />
                </a>
                <span>{item.title}</span>
                <small>{formatDate(item.observed_at)}</small>
              </div>
            ))}
          </details>
        )}
      </div>
      <div className="detail-section">
        <div className="section-title">
          <ClipboardList size={16} />
          <h3>Evidências comerciais</h3>
          <span className="count-badge">
            {entry.needs.length + entry.activity.length + (entry.review ? 1 : 0)}
          </span>
        </div>
        {!hasEvidence && (
          <p className="small-note">
            Documente uma necessidade, atividade ou revisão de site para enriquecer a avaliação.
          </p>
        )}
        {entry.needs.map((need, index) => (
          <div className="evidence-item" key={`need-${index}`}>
            <div>
              <strong>{needLabels[need.need]}</strong>
              <p>{need.evidence.description}</p>
              <EvidenceReference evidence={need.evidence} />
            </div>
            <button
              className="icon-button"
              disabled={entry.pending !== null}
              aria-label={`Remover necessidade ${index + 1}`}
              onClick={() => onRemove('need', index)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {entry.activity.map((evidence, index) => (
          <div className="evidence-item" key={`activity-${index}`}>
            <div>
              <strong>Atividade digital</strong>
              <p>{evidence.description}</p>
              <EvidenceReference evidence={evidence} />
            </div>
            <button
              className="icon-button"
              disabled={entry.pending !== null}
              aria-label={`Remover atividade ${index + 1}`}
              onClick={() => onRemove('activity', index)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {entry.review && (
          <div className="evidence-item">
            <div>
              <strong>Revisão manual de site</strong>
              <p>
                {entry.review.status === 'not_found'
                  ? 'Não localizado após as verificações descritas'
                  : entry.review.status === 'found'
                    ? 'Site identificado na revisão'
                    : 'Revisão inconclusiva'}
              </p>
              <small>
                {entry.review.evidence.length} fonte(s) · {formatDate(entry.review.reviewed_at)}
              </small>
              <details className="manual-review-sources">
                <summary>Ver verificações e fontes</summary>
                {entry.review.evidence.map((evidence, index) => (
                  <div key={`${evidence.source_url}-${index}`}>
                    <p>{entry.review?.checks[index] ?? evidence.description}</p>
                    <EvidenceReference evidence={evidence} />
                  </div>
                ))}
                {entry.review.website && (
                  <a
                    className="evidence-link"
                    href={entry.review.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Site identificado <ExternalLink size={12} />
                  </a>
                )}
              </details>
            </div>
            <button
              className="icon-button"
              disabled={entry.pending !== null}
              aria-label="Remover revisão manual"
              onClick={() => onRemove('review')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
        <button
          className="button secondary full-width"
          disabled={entry.pending !== null}
          onClick={onAddEvidence}
        >
          <FilePlus2 size={15} />
          Registrar evidência
        </button>
      </div>
      <div className="detail-section scoring-section">
        <div className="section-title">
          <Target size={16} />
          <h3>Avaliação comercial</h3>
        </div>
        {entry.score ? (
          <ScoreCard score={entry.score} />
        ) : (
          <div className="score-empty">
            <span>
              —<small>/100</small>
            </span>
            <p>
              Avalie com as informações disponíveis.
              <br />
              Cada ponto terá uma justificativa.
            </p>
          </div>
        )}
        {entry.error && entry.errorAction === 'score' && (
          <div role="alert" className="panel-error">
            {entry.error}
          </div>
        )}
        <button
          className="button primary full-width"
          disabled={entry.pending !== null}
          onClick={onScore}
        >
          {entry.pending === 'score' ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Target size={16} />
          )}
          {entry.pending === 'score'
            ? 'Calculando…'
            : entry.score
              ? 'Recalcular pontuação'
              : 'Calcular pontuação'}
        </button>
        <p className="small-note">
          O score não representa probabilidade de venda nem autorização para contato.
        </p>
      </div>
      <div className="detail-section analysis-section">
        <div className="section-title">
          <ClipboardList size={16} />
          <h3>Análise do negócio</h3>
        </div>
        {entry.analysis ? (
          <AnalysisCard analysis={entry.analysis} />
        ) : (
          <p className="small-note">
            Separe o contexto registrado, as hipóteses e as soluções possíveis. Esta versão usa um
            provedor simulado, sem IA real.
          </p>
        )}
        {entry.error && entry.errorAction === 'analyze' && (
          <div role="alert" className="panel-error">
            {entry.error}
          </div>
        )}
        <button
          className="button secondary full-width"
          disabled={entry.pending !== null}
          onClick={onAnalyze}
        >
          {entry.pending === 'analyze' ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ClipboardList size={16} />
          )}
          {entry.pending === 'analyze'
            ? 'Analisando…'
            : entry.analysis
              ? 'Gerar nova análise simulada'
              : 'Gerar análise simulada'}
        </button>
      </div>
      <MessageComposer
        key={businessKey(business)}
        entry={entry}
        onGenerate={onGenerateMessage}
        onEdit={onEditMessage}
      />
      <footer className="detail-source">
        Origem: {business.source}
        {business.source_id ? ` · ${business.source_id}` : ''}
      </footer>
    </aside>
  );
}

function CompassIcon() {
  return <Target size={20} />;
}

function EvidenceReference({ evidence }: { evidence: ScoringEvidence }) {
  return (
    <div className="evidence-reference">
      <a href={evidence.source_url} target="_blank" rel="noopener noreferrer">
        {evidence.source}
        <ExternalLink size={12} />
      </a>
      <small>{formatDate(evidence.observed_at)}</small>
    </div>
  );
}
