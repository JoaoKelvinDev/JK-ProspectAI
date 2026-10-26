import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { businesses, firstBusiness, json, mockBackend } from '../test/backend';

describe('cliente da API', () => {
  it('verifica os módulos disponíveis além da saúde do processo', async () => {
    const fetch = mockBackend();
    expect(await api.health()).toEqual({ status: 'ok' });
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/health', '/openapi.json']);
  });
  it('detecta um backend antigo mesmo quando a saúde responde ok', async () => {
    mockBackend((path) =>
      path === '/openapi.json'
        ? json({ paths: { '/api/v1/discovery/search': { post: {} } } })
        : undefined,
    );
    await expect(api.health()).rejects.toMatchObject({ code: 'incompatible_backend' });
  });
  it('orienta reinício quando um endpoint atual retorna 404', async () => {
    mockBackend((path) =>
      path.includes('website-inspector') ? json({ detail: 'Not Found' }, 404) : undefined,
    );
    await expect(api.inspect(firstBusiness())).rejects.toMatchObject({
      code: 'incompatible_backend',
      message: expect.stringContaining('Reinicie'),
    });
  });
  it('valida respostas reais do FastAPI usadas como fixtures', async () => {
    const fetch = mockBackend();
    const filters = { city: 'Teresina', state: 'PI' as const, segments: [], max_results: 20 };
    expect(await api.search(filters)).toEqual(businesses);
    const [, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(filters);
  });
  it('rejeita contrato inesperado em vez de usar dados locais como fallback', async () => {
    mockBackend((path) =>
      path.includes('discovery') ? json([{ name: 'incompleto' }]) : undefined,
    );
    await expect(
      api.search({ city: 'Teresina', state: 'PI', segments: [], max_results: 20 }),
    ).rejects.toThrow('dados inesperados');
  });
  it('apresenta campos inválidos retornados pelo Pydantic', async () => {
    mockBackend(() => json({ detail: [{ loc: ['body', 'city'], msg: 'invalid' }] }, 422));
    await expect(api.health()).rejects.toMatchObject({
      status: 422,
      message: 'Revise os campos informados: city.',
    });
  });
  it('apresenta incoerências entre campos sem expor objetos internos', async () => {
    mockBackend(() => json({ detail: [{ loc: ['body'], ctx: { error: 'internal' } }] }, 422));
    await expect(api.health()).rejects.toThrow('coerência');
  });
  it('trata erro HTTP sem corpo JSON', async () => {
    mockBackend(() => new Response('Bad gateway', { status: 502 }));
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
  });
  it('trata falha de conexão com mensagem acionável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.health()).rejects.toThrow('backend local está iniciado');
  });
  it('não publica uma resposta tardia depois de cancelada', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const controller = new AbortController();
    const pending = api.health(controller.signal);
    controller.abort();
    resolve(json({ status: 'ok' }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('aplica prazo de 20 segundos e libera o temporizador', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_path: string, init: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              );
            }),
        ),
      );
      const result = api.health().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(20_001);
      expect(await result).toMatchObject({ message: expect.stringContaining('demorou') });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('inspeciona sem alterar o estabelecimento enviado', async () => {
    const fetch = mockBackend();
    const business = firstBusiness();
    expect((await api.inspect(business)).is_simulated).toBe(true);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual(business);
  });
});
