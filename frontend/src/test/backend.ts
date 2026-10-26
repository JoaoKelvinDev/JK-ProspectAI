import { vi } from 'vitest';
import { z } from 'zod';
import fixtures from './backend-fixtures.json';
import { businessSchema, inspectionSchema, scoreSchema } from '../contracts';
import type { Business, ScoreRequest } from '../contracts';

export const businesses = businessSchema.array().parse(fixtures.businesses);
export const inspection = inspectionSchema.parse(fixtures.inspection);
export const basicScore = scoreSchema.parse(fixtures.basicScore);
export const enrichedScore = scoreSchema.parse(fixtures.enrichedScore);
const scoreVariants = z.record(z.string(), scoreSchema).parse(fixtures.scoreVariants);
export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
type Override = (path: string, body: unknown) => Response | Promise<Response> | undefined;

export function mockBackend(override?: Override) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = String(input);
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const custom = override?.(path, body);
    if (custom !== undefined) return custom;
    if (path === '/health') return json({ status: 'ok' });
    if (path === '/openapi.json')
      return json({
        paths: {
          '/api/v1/discovery/search': { post: {} },
          '/api/v1/website-inspector/inspect': { post: {} },
          '/api/v1/lead-scoring/score': { post: {} },
        },
      });
    if (path === '/api/v1/discovery/search') return json(businesses);
    if (path === '/api/v1/website-inspector/inspect') {
      const business = businessSchema.parse(body);
      if (!business.is_simulated && business.website) {
        const at = new Date().toISOString();
        return json({
          ...inspection,
          requested_url: business.website,
          final_url: business.website,
          is_simulated: false,
          status: 'inconclusive',
          reason: 'identity_mismatch',
          checked_at: at,
          confidence: 'low',
          evidence: [
            {
              source: 'http',
              url: business.website,
              observed_at: at,
              status_code: 200,
              content_type: 'text/html',
              title: null,
              matches: [],
            },
          ],
        });
      }
      return json({
        ...inspection,
        requested_url: business.website,
        is_simulated: business.is_simulated,
        reason: business.is_simulated ? 'simulated_business' : 'missing_url',
      });
    }
    if (path === '/api/v1/lead-scoring/score') {
      const query = body as ScoreRequest;
      const key = `${Number(query.needs.length > 0)}${Number(query.activity_evidence.length > 0)}${Number(Boolean(query.website_review))}`;
      const score = scoreVariants[key];
      if (!score) throw new Error(`Combinação de score não simulada: ${key}`);
      return json(score);
    }
    throw new Error(`Chamada não simulada: ${path}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
export function firstBusiness(): Business {
  const first = businesses[0];
  if (!first) throw new Error('Fixture de estabelecimentos vazia.');
  return first;
}
