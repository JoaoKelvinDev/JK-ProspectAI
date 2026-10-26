import { useState } from 'react';
import { ArrowUpDown, Building2, ChevronRight, Radar, Search } from 'lucide-react';
import { segments } from '../contracts';
import type { BusinessEntry } from '../contracts';
import { businessKey, initials, normalized } from '../lib/format';

export function BusinessList({
  entries,
  selectedKey,
  status,
  onSelect,
}: {
  entries: BusinessEntry[];
  selectedKey: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  onSelect: (key: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('original');
  const shown = entries
    .filter((entry) =>
      normalized(`${entry.business.name} ${segments[entry.business.category]}`).includes(
        normalized(filter),
      ),
    )
    .toSorted((a, b) =>
      sort === 'name'
        ? a.business.name.localeCompare(b.business.name, 'pt-BR')
        : sort === 'score'
          ? (b.score?.score ?? -1) - (a.score?.score ?? -1)
          : 0,
    );
  return (
    <section
      className="results-card"
      aria-labelledby="results-title"
      aria-busy={status === 'loading'}
    >
      <div className="results-heading">
        <div className="flex items-center gap-2">
          <h2 id="results-title">Estabelecimentos</h2>
          <span className="count-badge">{entries.length}</span>
        </div>
        <span className="muted text-xs">Selecione para revisar</span>
      </div>
      {entries.length > 0 && (
        <div className="results-tools">
          <div className="input-with-icon">
            <Search size={15} />
            <input
              aria-label="Filtrar resultados pelo nome ou segmento"
              placeholder="Buscar nos resultados"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <label className="sort-control">
            <ArrowUpDown size={14} />
            <select
              aria-label="Ordenar resultados"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="original">Ordem da pesquisa</option>
              <option value="name">Nome A–Z</option>
              <option value="score">Maior pontuação</option>
            </select>
          </label>
        </div>
      )}
      {status === 'loading' ? (
        <div className="loading-results" role="status">
          <div className="radar-art">
            <Radar size={48} />
          </div>
          <h3>Preparando os resultados…</h3>
          <p>Consultando o catálogo de demonstração.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-results">
          <div className="radar-art">
            <Radar size={48} />
          </div>
          <h3>
            {status === 'idle'
              ? 'Sua próxima pesquisa começa aqui.'
              : status === 'error'
                ? 'Não foi possível carregar a pesquisa.'
                : 'Nenhum estabelecimento encontrado.'}
          </h3>
          <p>
            {status === 'idle'
              ? 'Escolha uma cidade e um segmento. Depois, explore cada negócio com cuidado.'
              : status === 'error'
                ? 'Verifique o serviço local e tente pesquisar novamente.'
                : 'O catálogo simulado cobre Teresina, PI. Você também pode adicionar um registro manual.'}
          </p>
          <span className="empty-caption">
            <Building2 size={14} /> Informações claras. Decisões humanas.
          </span>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-results small">
          <Search size={28} />
          <h3>Nenhum resultado para este filtro.</h3>
          <button className="text-button" onClick={() => setFilter('')}>
            Limpar filtro
          </button>
        </div>
      ) : (
        <div className="table-scroll">
          <table role="table">
            <caption className="sr-only">Estabelecimentos encontrados na sessão</caption>
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  Estabelecimento
                </th>
                <th role="columnheader" scope="col">
                  Site na fonte
                </th>
                <th role="columnheader" scope="col">
                  Pontuação
                </th>
                <th role="columnheader" scope="col">
                  <span className="sr-only">Abrir detalhes</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {shown.map((entry) => {
                const business = entry.business;
                const key = businessKey(business);
                const selected = key === selectedKey;
                return (
                  <tr role="row" key={key} className={selected ? 'selected' : ''}>
                    <td role="cell">
                      <button
                        className="business-select"
                        onClick={() => onSelect(key)}
                        aria-label={`Revisar ${business.name}`}
                        aria-pressed={selected}
                      >
                        <span className={`business-avatar tone-${business.category.length % 4}`}>
                          {initials(business.name)}
                        </span>
                        <span className="business-title">
                          <strong>{business.name}</strong>
                          <span>
                            {segments[business.category]}
                            {!business.is_simulated && (
                              <span className="manual-dot"> · Manual</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td role="cell">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Site na fonte
                      </span>
                      <span className={`site-badge ${business.website ? 'informed' : ''}`}>
                        <span className="mini-dot" />
                        {business.website ? 'URL informada' : 'Não informado'}
                      </span>
                    </td>
                    <td role="cell">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Pontuação
                      </span>
                      <span className={entry.score ? 'table-score' : 'unscored'}>
                        {entry.score ? (
                          <>
                            {entry.score.score}
                            <small>/100</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td role="cell">
                      <button
                        className="row-open"
                        aria-label={`Ver detalhes de ${business.name}`}
                        onClick={() => onSelect(key)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {entries.length > 0 && (
        <footer className="results-footer">
          <span>
            {shown.length} de {entries.length} registros
          </span>
          <span>Dados apenas nesta sessão</span>
        </footer>
      )}
    </section>
  );
}
