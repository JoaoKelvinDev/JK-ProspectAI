import { describe, expect, it } from 'vitest';
import { businessKey, cleanWebUrl, normalized } from './format';
import { firstBusiness } from '../test/backend';

describe('normalização e referências', () => {
  it('filtra sem diferença de caixa ou acentos', () => expect(normalized('AÇAÍ')).toBe('acai'));
  it('mantém identificadores opacos e distingue fontes', () => {
    const business = firstBusiness();
    expect(businessKey({ ...business, source_id: 'A' })).not.toBe(
      businessKey({ ...business, source_id: 'a' }),
    );
    expect(businessKey({ ...business, source: 'manual' })).not.toBe(businessKey(business));
  });
  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://example.org/',
    'https://user:pass@example.org/',
  ])('bloqueia URL inadequada: %s', (value) => {
    expect(() => cleanWebUrl(value)).toThrow();
  });
  it('normaliza uma URL HTTP válida', () =>
    expect(cleanWebUrl(' https://example.org ')).toBe('https://example.org/'));
  it('deduplica nomes e localização normalizados quando não há identificador', () => {
    const first = { ...firstBusiness(), source_id: null, name: 'Comércio   Central' };
    expect(businessKey(first)).toBe(businessKey({ ...first, name: 'comercio central' }));
  });
});
