import { useState } from 'react';
import type { FormEvent } from 'react';
import { businessSchema, segments, states } from '../contracts';
import type { Business } from '../contracts';
import { cleanWebUrl } from '../lib/format';

export function BusinessForm({ onAdd }: { onAdd: (business: Business) => string | null }) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    try {
      const business = businessSchema.parse({
        name: value('name'),
        category: value('category'),
        location: {
          city: value('city'),
          state: value('state'),
          country: 'BR',
          address: value('address') || null,
        },
        website: value('website') ? cleanWebUrl(value('website')) : null,
        source: 'manual',
        source_id: null,
        is_simulated: false,
        website_status: 'not_checked',
      });
      setError(onAdd(business) ?? '');
    } catch {
      setError('Revise os campos. O site deve ser uma URL HTTP ou HTTPS sem credenciais.');
    }
  }
  return (
    <form className="modal-form" onSubmit={submit}>
      <p className="form-intro">
        Registre informações de um negócio real para revisão. O cadastro fica apenas nesta sessão.
      </p>
      <label>
        Nome do estabelecimento
        <input name="name" required maxLength={200} autoFocus />
      </label>
      <label>
        Segmento
        <select name="category" defaultValue="restaurantes">
          {Object.entries(segments).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-columns">
        <label>
          Cidade
          <input name="city" defaultValue="Teresina" required maxLength={120} />
        </label>
        <label>
          Estado
          <select name="state" defaultValue="PI">
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Endereço <span className="optional">opcional</span>
        <input name="address" maxLength={200} />
      </label>
      <label>
        URL candidata <span className="optional">opcional</span>
        <input type="url" name="website" placeholder="https://" maxLength={2048} />
      </label>
      <p className="small-note">
        Adicionar o registro não consulta o site. A inspeção acontece quando você a solicita.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary" type="submit">
        Adicionar à sessão
      </button>
    </form>
  );
}
