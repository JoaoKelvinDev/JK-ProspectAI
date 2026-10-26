import { z } from 'zod';
import {
  analysisSchema,
  businessSchema,
  inspectionSchema,
  messageDraftSchema,
  scoreSchema,
} from '../contracts';
import type { Business, MessageGenerationRequest, ScoreRequest, SearchFilters } from '../contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
    public readonly code?: 'incompatible_backend',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function validationMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return null;
  if (typeof body.detail === 'string') return body.detail;
  if (!Array.isArray(body.detail)) return null;
  const fields = body.detail
    .flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('loc' in item) || !Array.isArray(item.loc))
        return [];
      return [item.loc.filter((part: unknown) => part !== 'body').join('.')];
    })
    .filter(Boolean);
  return fields.length
    ? `Revise os campos informados: ${[...new Set(fields)].join(', ')}.`
    : 'Revise os dados e a coerência das evidências informadas.';
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetch(path, {
      method: data === undefined ? 'GET' : 'POST',
      ...(data === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
    if (response.status === 404 && path.startsWith('/api/v1/')) {
      throw new ApiError(
        'O backend em execução está desatualizado. Reinicie o servidor local para usar os módulos atuais.',
        404,
        'incompatible_backend',
      );
    }
    if (!response.ok)
      throw new ApiError(
        validationMessage(body) ??
          'Não foi possível concluir a operação. Verifique se o backend local está iniciado.',
        response.status,
      );
    const result = schema.safeParse(body);
    if (!result.success)
      throw new ApiError('O serviço retornou dados inesperados. Tente novamente.');
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
    if (controller.signal.aborted)
      throw new ApiError('A consulta demorou além do esperado. Tente novamente.');
    throw new ApiError(
      'Não foi possível conectar ao serviço. Verifique se o backend local está iniciado.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export const api = {
  health: async (signal?: AbortSignal) => {
    const health = await request(
      '/health',
      z.object({ status: z.literal('ok') }),
      undefined,
      signal,
    );
    const description = await request(
      '/openapi.json',
      z.object({
        paths: z.record(
          z.string(),
          z.object({ post: z.record(z.string(), z.unknown()).optional() }),
        ),
      }),
      undefined,
      signal,
    );
    const required = [
      '/api/v1/discovery/search',
      '/api/v1/website-inspector/inspect',
      '/api/v1/lead-scoring/score',
      '/api/v1/business-analysis/analyze',
      '/api/v1/messages/generate',
    ];
    if (required.some((path) => !description.paths[path]?.post)) {
      throw new ApiError(
        'O backend em execução está desatualizado. Reinicie o servidor local para usar os módulos atuais.',
        null,
        'incompatible_backend',
      );
    }
    return health;
  },
  search: (filters: SearchFilters, signal?: AbortSignal) =>
    request('/api/v1/discovery/search', z.array(businessSchema), filters, signal),
  inspect: (business: Business, signal?: AbortSignal) =>
    request('/api/v1/website-inspector/inspect', inspectionSchema, business, signal),
  score: (input: ScoreRequest, signal?: AbortSignal) =>
    request('/api/v1/lead-scoring/score', scoreSchema, input, signal),
  analyze: (input: ScoreRequest, signal?: AbortSignal) =>
    request('/api/v1/business-analysis/analyze', analysisSchema, input, signal),
  generateMessage: async (input: MessageGenerationRequest, signal?: AbortSignal) => {
    const draft = await request('/api/v1/messages/generate', messageDraftSchema, input, signal);
    if (
      draft.selected_need !== input.selected_need ||
      draft.channel !== input.channel ||
      draft.business_is_simulated !== input.business.is_simulated
    )
      throw new ApiError('O serviço retornou um rascunho incompatível com o pedido.');
    return draft;
  },
};
