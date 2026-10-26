import { useState } from 'react';
import type { FormEvent } from 'react';
import { needLabels } from '../contracts';
import type { DigitalNeed, EvidenceAddition, ManualReview, ScoringEvidence } from '../contracts';
import { cleanWebUrl, localDateTime, normalized } from '../lib/format';

export function EvidenceForm({ onAdd }: { onAdd: (addition: EvidenceAddition) => string | null }) {
  const [kind, setKind] = useState<'need' | 'activity' | 'review'>('need');
  const [reviewStatus, setReviewStatus] = useState<ManualReview['status']>('inconclusive');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    try {
      const observed = new Date(value('observed'));
      if (!Number.isFinite(observed.getTime()) || observed.getTime() > Date.now()) {
        setError('Informe uma data válida, sem estar no futuro.');
        return;
      }
      const first: ScoringEvidence = {
        source: value('source'),
        source_url: cleanWebUrl(value('url')),
        observed_at: observed.toISOString(),
        description: value('description'),
      };
      if (!first.source || !first.description) {
        setError('Informe a origem e a descrição da observação.');
        return;
      }
      let addition: EvidenceAddition;
      if (kind === 'need')
        addition = { kind, value: { need: value('need') as DigitalNeed, evidence: first } };
      else if (kind === 'activity') addition = { kind, value: first };
      else {
        const evidence = [first];
        if (reviewStatus === 'not_found') {
          const second: ScoringEvidence = {
            source: value('secondSource'),
            source_url: cleanWebUrl(value('secondUrl')),
            observed_at: observed.toISOString(),
            description: value('secondDescription'),
          };
          const host = (url: string) => new URL(url).hostname.toLowerCase().replace(/\.$/, '');
          if (
            !second.source ||
            !second.description ||
            host(first.source_url) === host(second.source_url) ||
            normalized(first.description).replace(/\s+/g, ' ') ===
              normalized(second.description).replace(/\s+/g, ' ')
          ) {
            setError(
              'Documente duas verificações diferentes, com evidências de dois domínios distintos.',
            );
            return;
          }
          evidence.push(second);
        }
        addition = {
          kind,
          value: {
            scope: 'manual_search',
            status: reviewStatus,
            reviewed_at: observed.toISOString(),
            website: reviewStatus === 'found' ? cleanWebUrl(value('reviewWebsite')) : null,
            checks: evidence.map((item) => item.description),
            evidence,
          },
        };
      }
      setError(onAdd(addition) ?? '');
    } catch {
      setError('Revise as URLs. Use HTTP ou HTTPS, sem usuário ou senha.');
    }
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <p className="form-intro">
        Registre o que você observou e de onde veio a informação. As fontes não são consultadas
        automaticamente.
      </p>
      <label>
        Tipo de registro
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setError('');
          }}
        >
          <option value="need">Necessidade digital</option>
          <option value="activity">Atividade digital</option>
          <option value="review">Revisão manual de site</option>
        </select>
      </label>
      {kind === 'need' && (
        <label>
          Necessidade identificada
          <select name="need">
            {Object.entries(needLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'review' && (
        <>
          <label>
            Resultado da revisão
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as typeof reviewStatus)}
            >
              <option value="inconclusive">Inconclusivo</option>
              <option value="found">Site identificado</option>
              <option value="not_found">Site não localizado após revisão</option>
            </select>
          </label>
          {reviewStatus === 'found' && (
            <label>
              URL identificada
              <input
                type="url"
                name="reviewWebsite"
                placeholder="https://"
                required
                maxLength={2048}
              />
            </label>
          )}
          {reviewStatus === 'not_found' && (
            <p className="notice compact">
              São necessárias duas verificações e duas origens diferentes. O resultado não comprova
              que um site não exista.
            </p>
          )}
        </>
      )}
      <label>
        Origem da informação
        <input
          name="source"
          placeholder="Ex.: página comercial revisada"
          required
          maxLength={200}
        />
      </label>
      <label>
        URL da evidência
        <input name="url" type="url" placeholder="https://" required maxLength={2048} />
      </label>
      <label>
        {kind === 'review' ? 'Primeira verificação realizada' : 'Descrição da observação'}
        <textarea name="description" required maxLength={1000} rows={3} />
      </label>
      <label>
        Data e hora da observação
        <input type="datetime-local" name="observed" defaultValue={localDateTime()} required />
      </label>
      {kind === 'review' && reviewStatus === 'not_found' && (
        <fieldset className="secondary-evidence">
          <legend>Segunda origem</legend>
          <label>
            Nome da segunda origem
            <input name="secondSource" required maxLength={200} />
          </label>
          <label>
            URL da segunda evidência
            <input name="secondUrl" type="url" required maxLength={2048} placeholder="https://" />
          </label>
          <label>
            Segunda verificação realizada
            <textarea name="secondDescription" required maxLength={1000} rows={3} />
          </label>
        </fieldset>
      )}
      <p className="small-note">
        Evidências com mais de 90 dias serão sinalizadas e não pontuarão. Alterações exigem
        recalcular o score.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary" type="submit">
        Registrar evidência
      </button>
    </form>
  );
}
