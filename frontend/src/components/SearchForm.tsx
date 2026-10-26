import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, LoaderCircle, MapPin, SlidersHorizontal } from 'lucide-react';
import { segments, states } from '../contracts';
import type { SearchFilters, Segment } from '../contracts';

export function SearchForm({
  pending,
  onSearch,
}: {
  pending: boolean;
  onSearch: (filters: SearchFilters) => void;
}) {
  const [city, setCity] = useState('Teresina');
  const [state, setState] = useState<(typeof states)[number]>('PI');
  const [segment, setSegment] = useState<Segment | ''>('');
  const [limit, setLimit] = useState('20');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const max = Number(limit);
    if (!city.trim() || !Number.isInteger(max) || max < 1 || max > 100) {
      setError('Informe uma cidade e um limite inteiro entre 1 e 100.');
      return;
    }
    setError('');
    onSearch({ city: city.trim(), state, segments: segment ? [segment] : [], max_results: max });
  }
  return (
    <section className="search-card" aria-labelledby="search-title">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={17} />
          <h2 id="search-title">Configure sua pesquisa</h2>
        </div>
        <span className="muted text-xs">Um bom ponto de partida</span>
      </div>
      <form onSubmit={submit} className="search-form">
        <label className="city-field">
          Cidade
          <div className="input-with-icon">
            <MapPin size={16} />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={120}
              placeholder="Nome da cidade"
            />
          </div>
        </label>
        <label>
          Estado
          <select value={state} onChange={(e) => setState(e.target.value as typeof state)}>
            {states.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        <label className="segment-field">
          Segmento
          <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | '')}>
            <option value="">Todos os segmentos</option>
            {Object.entries(segments).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Limite
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            min={1}
            max={100}
            step={1}
            required
          />
        </label>
        <button type="submit" className="button primary search-submit" disabled={pending}>
          {pending ? <LoaderCircle size={17} className="spin" /> : null}
          {pending ? 'Pesquisando…' : 'Pesquisar negócios'}
          {!pending && <ArrowRight size={17} />}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
