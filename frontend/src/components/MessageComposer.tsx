import { useState } from 'react';
import { FilePenLine, LoaderCircle } from 'lucide-react';
import { needLabels } from '../contracts';
import type {
  BusinessEntry,
  DigitalNeed,
  MessageContent,
  MessageGenerationOptions,
} from '../contracts';
import { formatDate } from '../lib/format';

export function MessageComposer({
  entry,
  onGenerate,
  onEdit,
}: {
  entry: BusinessEntry;
  onGenerate: (options: MessageGenerationOptions) => void;
  onEdit: (content: MessageContent) => void;
}) {
  const [selectedNeed, setSelectedNeed] = useState<DigitalNeed | ''>(
    entry.message?.selected_need ?? '',
  );
  const [channel, setChannel] = useState<MessageGenerationOptions['channel']>(
    entry.message?.channel ?? 'short_message',
  );
  const suggestions = entry.analysis?.suggestions ?? [];
  const need = suggestions.some((item) => item.need === selectedNeed)
    ? selectedNeed
    : (suggestions[0]?.need ?? '');
  const draft = entry.message;
  const content = entry.messageEdits ?? draft?.content;
  const pending = entry.pending !== null;
  const edited =
    draft &&
    content &&
    (content.body !== draft.content.body || content.subject !== draft.content.subject);
  return (
    <section className="detail-section message-section" aria-label="Gerador de rascunhos">
      <div className="section-title">
        <FilePenLine size={16} />
        <h3>Mensagem comercial</h3>
      </div>
      <p className="small-note">
        Rascunho simulado para revisão. Nenhuma mensagem é enviada. Alterar evidências ou gerar nova
        análise descarta o rascunho da sessão.
      </p>
      {suggestions.length ? (
        <form
          className="message-options"
          onSubmit={(event) => {
            event.preventDefault();
            if (need && !pending) onGenerate({ selected_need: need, channel });
          }}
        >
          <label>
            Solução para o rascunho
            <select
              value={need}
              onChange={(event) => setSelectedNeed(event.target.value as DigitalNeed)}
              disabled={pending}
            >
              {suggestions.map((item) => (
                <option key={item.need} value={item.need}>
                  {needLabels[item.need]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Formato da mensagem
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as MessageGenerationOptions['channel'])
              }
              disabled={pending}
            >
              <option value="short_message">Mensagem curta</option>
              <option value="email">E-mail</option>
            </select>
          </label>
          <button className="button secondary full-width" type="submit" disabled={pending || !need}>
            {entry.pending === 'message' ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <FilePenLine size={16} />
            )}
            {entry.pending === 'message'
              ? 'Gerando rascunho…'
              : draft
                ? 'Gerar novo rascunho simulado'
                : 'Gerar rascunho simulado'}
          </button>
          {draft && (
            <p className="small-note">
              Gerar novamente substitui o rascunho e suas edições quando a geração concluir.
            </p>
          )}
        </form>
      ) : (
        <p className="small-note">
          Gere uma análise com necessidade documentada atual para habilitar o rascunho.
        </p>
      )}
      {entry.error && entry.errorAction === 'message' && (
        <div role="alert" className="panel-error">
          {entry.error}
        </div>
      )}
      {draft && content && (
        <div className="message-draft" aria-label="Rascunho comercial">
          <span className="badge demo">SIMULADO · NÃO ENVIADO</span>
          <p className="small-note">
            Pendente de revisão · {needLabels[draft.selected_need]} ·{' '}
            {draft.channel === 'email' ? 'E-mail' : 'Mensagem curta'} ·{' '}
            {formatDate(draft.generated_at)}
          </p>
          <p role="status">
            {edited
              ? 'Texto editado nesta sessão; ainda pendente de revisão.'
              : 'Rascunho gerado; revisão humana necessária.'}
          </p>
          {draft.channel === 'email' && (
            <label>
              Assunto do rascunho
              <input
                maxLength={160}
                value={content.subject ?? ''}
                disabled={pending}
                onChange={(event) => onEdit({ ...content, subject: event.target.value })}
              />
            </label>
          )}
          <label>
            Texto do rascunho
            <textarea
              rows={9}
              maxLength={draft.channel === 'email' ? 2000 : 900}
              value={content.body}
              disabled={pending}
              onChange={(event) => onEdit({ ...content, body: event.target.value })}
            />
          </label>
          <p className="small-note">
            {content.body.length}/{draft.channel === 'email' ? 2000 : 900} caracteres. Edições ficam
            somente nesta página e não são validadas automaticamente.
          </p>
          {!content.body.trim() && (
            <p className="small-note">Preencha o texto antes de concluir sua revisão.</p>
          )}
          <details>
            <summary>Contexto e limitações do rascunho</summary>
            <ul>
              {draft.context_facts.map((fact) => (
                <li key={fact.id}>{fact.statement}</li>
              ))}
            </ul>
            <ul>
              {draft.limitations.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
