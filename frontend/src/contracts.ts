import { z } from 'zod';

export const segments = {
  acaiterias: 'Açaiterias',
  restaurantes: 'Restaurantes',
  lanchonetes: 'Lanchonetes',
  bares: 'Bares',
  barbearias: 'Barbearias',
  saloes_de_beleza: 'Salões de beleza',
  lojas_de_roupas: 'Lojas de roupas',
  mercadinhos: 'Mercadinhos',
  pequenos_comercios: 'Pequenos comércios',
  prestadores_de_servicos: 'Prestadores de serviços',
  outros_estabelecimentos: 'Outros estabelecimentos',
} as const;
export type Segment = keyof typeof segments;
export const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export const needLabels = {
  website: 'Site institucional',
  online_menu: 'Cardápio digital',
  product_catalog: 'Catálogo de produtos',
  online_ordering: 'Pedidos online',
  scheduling: 'Agendamento',
  workflow_automation: 'Automação de processos',
  api_integration: 'Integração de APIs',
  custom_system: 'Sistema personalizado',
} as const;
export type DigitalNeed = keyof typeof needLabels;

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value));
const dateTime = z.iso.datetime({ offset: true });
export const businessSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(Object.keys(segments) as [Segment, ...Segment[]]),
  location: z.object({
    city: z.string().trim().min(1).max(120),
    state: z.enum(states),
    country: z.literal('BR'),
    address: z.string().nullable(),
  }),
  website: webUrl.nullable(),
  source_id: z.string().nullable(),
  source: z.string(),
  is_simulated: z.boolean(),
  website_status: z.literal('not_checked'),
});
export type Business = z.infer<typeof businessSchema>;
export interface SearchFilters {
  city: string;
  state: (typeof states)[number];
  segments: Segment[];
  max_results: number;
}

export const inspectionSchema = z.object({
  scope: z.literal('provided_url'),
  status: z.enum(['found', 'not_found', 'inconclusive', 'not_checked']),
  reason: z.string(),
  requested_url: webUrl.nullable(),
  final_url: webUrl.nullable(),
  checked_at: dateTime.nullable(),
  confidence: z.enum(['low', 'medium']).nullable(),
  is_simulated: z.boolean(),
  evidence: z.array(
    z.object({
      source: z.literal('http'),
      url: webUrl,
      observed_at: dateTime,
      status_code: z.number().int(),
      content_type: z.string(),
      title: z.string().nullable(),
      matches: z.array(z.enum(['name', 'city'])),
    }),
  ),
});
export type Inspection = z.infer<typeof inspectionSchema>;
export const scoreSchema = z.object({
  rules_version: z.string(),
  basis: z.literal('provided_evidence'),
  score: z.number().int().min(0).max(100),
  max_score: z.literal(100),
  assessed_max_score: z.number().int().min(0).max(100),
  evaluated_at: dateTime,
  is_simulated: z.boolean(),
  warnings: z.array(z.string()),
  criteria: z.array(
    z.object({
      name: z.string(),
      points: z.number().int().min(0),
      max_points: z.number().int().positive(),
      assessed: z.boolean(),
      reason: z.string(),
      evidence_urls: z.array(webUrl),
    }),
  ),
});
export type LeadScore = z.infer<typeof scoreSchema>;
export const analysisSchema = z
  .object({
    provider: z.literal('mock'),
    generation_mode: z.literal('simulated'),
    prompt_version: z.literal('1.0.0'),
    basis: z.literal('provided_evidence'),
    status: z.enum(['ready_for_review', 'insufficient_evidence']),
    analyzed_at: dateTime,
    business_is_simulated: z.boolean(),
    facts: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
          kind: z.enum([
            'business_profile',
            'documented_need',
            'digital_activity',
            'website_review',
            'website_inspection',
          ]),
          statement: z.string().min(1).max(1000),
          need: z.enum(Object.keys(needLabels) as [DigitalNeed, ...DigitalNeed[]]).nullable(),
          evidence: z
            .array(
              z.object({
                source: z.string(),
                source_url: webUrl,
                observed_at: dateTime,
                description: z.string(),
              }),
            )
            .max(10),
        }),
      )
      .min(1)
      .max(43),
    suggestions: z
      .array(
        z.object({
          need: z.enum(Object.keys(needLabels) as [DigitalNeed, ...DigitalNeed[]]),
          fact_ids: z.array(z.string()).min(1).max(21),
          hypothesis: z.string().min(1).max(1000),
          opportunity: z.string().min(1).max(1000),
          suggested_solution: z.string().min(1).max(1000),
          validation_question: z.string().min(1).max(1000),
        }),
      )
      .max(8),
    limitations: z.array(z.string().min(1).max(1000)).min(1).max(10),
  })
  .superRefine((analysis, context) => {
    const facts = new Map(analysis.facts.map((fact) => [fact.id, fact]));
    const valid =
      facts.size === analysis.facts.length &&
      new Set(analysis.suggestions.map((item) => item.need)).size === analysis.suggestions.length &&
      analysis.suggestions.every(
        (item) =>
          new Set(item.fact_ids).size === item.fact_ids.length &&
          item.fact_ids.every((id) => facts.get(id)?.need === item.need),
      ) &&
      analysis.status ===
        (analysis.suggestions.length ? 'ready_for_review' : 'insufficient_evidence');
    if (!valid) context.addIssue({ code: 'custom', message: 'Análise sem referências coerentes.' });
  });
export type BusinessAnalysis = z.infer<typeof analysisSchema>;
export const messageContentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value))
    .nullable(),
  body: z.string().trim().min(1).max(2000),
});
export const messageDraftSchema = z
  .object({
    status: z.literal('draft'),
    review_status: z.literal('pending_review'),
    delivery_status: z.literal('not_sent'),
    locale: z.literal('pt-BR'),
    provider: z.literal('mock'),
    generation_mode: z.literal('simulated'),
    prompt_version: z.literal('1.0.0'),
    generated_at: dateTime,
    business_is_simulated: z.boolean(),
    selected_need: z.enum(Object.keys(needLabels) as [DigitalNeed, ...DigitalNeed[]]),
    channel: z.enum(['short_message', 'email']),
    content: messageContentSchema,
    context_facts: analysisSchema.shape.facts.max(21),
    limitations: z.array(z.string().min(1).max(1000)).min(1).max(10),
  })
  .superRefine((draft, context) => {
    const validFacts =
      new Set(draft.context_facts.map((fact) => fact.id)).size === draft.context_facts.length &&
      draft.context_facts.every(
        (fact) => fact.need === draft.selected_need && fact.evidence.length > 0,
      );
    const validChannel =
      draft.channel === 'email'
        ? draft.content.subject !== null
        : draft.content.subject === null && draft.content.body.length <= 900;
    if (!validFacts || !validChannel)
      context.addIssue({ code: 'custom', message: 'Rascunho sem contexto ou formato coerente.' });
  });
export type MessageDraft = z.infer<typeof messageDraftSchema>;
export type MessageContent = z.infer<typeof messageContentSchema>;
export interface MessageGenerationOptions {
  selected_need: DigitalNeed;
  channel: 'short_message' | 'email';
}
export interface ScoringEvidence {
  source: string;
  source_url: string;
  observed_at: string;
  description: string;
}
export interface NeedObservation {
  need: DigitalNeed;
  evidence: ScoringEvidence;
}
export interface ManualReview {
  scope: 'manual_search';
  status: 'found' | 'not_found' | 'inconclusive';
  reviewed_at: string;
  website: string | null;
  checks: string[];
  evidence: ScoringEvidence[];
}
export interface ScoreRequest {
  business: Business;
  website_inspection?: Inspection;
  website_review?: ManualReview;
  needs: NeedObservation[];
  activity_evidence: ScoringEvidence[];
}
export type MessageGenerationRequest = ScoreRequest & MessageGenerationOptions;
export interface BusinessEntry {
  business: Business;
  inspection?: Inspection;
  score?: LeadScore;
  analysis?: BusinessAnalysis;
  message?: MessageDraft;
  messageEdits?: MessageContent;
  review?: ManualReview;
  needs: NeedObservation[];
  activity: ScoringEvidence[];
  pending: 'inspect' | 'score' | 'analyze' | 'message' | null;
  error: string | null;
  errorAction?: 'inspect' | 'score' | 'analyze' | 'message';
}
export type EvidenceAddition =
  | { kind: 'need'; value: NeedObservation }
  | { kind: 'activity'; value: ScoringEvidence }
  | { kind: 'review'; value: ManualReview };

export const criterionLabels: Record<string, string> = {
  website_opportunity: 'Oportunidade de site',
  digital_need: 'Necessidade digital',
  digital_activity: 'Atividade digital',
  service_fit: 'Compatibilidade com a JK Dev',
  data_quality: 'Qualidade dos dados',
};
export const inspectionReasons: Record<string, string> = {
  simulated_business: 'O registro é simulado. Nenhuma consulta externa foi realizada.',
  missing_url: 'Não há URL candidata para inspecionar. Isso não significa ausência de site.',
  matching_page: 'A página contém nome e cidade. O vínculo oficial ainda precisa de revisão.',
  identity_mismatch: 'A página não trouxe correspondência suficiente de nome e cidade.',
  http_error: 'A URL retornou um erro HTTP. Isso não comprova ausência de site.',
  unsupported_content: 'O conteúdo recebido não é uma página HTML.',
  timeout: 'O prazo da consulta foi excedido.',
  dns_error: 'Não foi possível resolver o domínio.',
  connection_error: 'Falha de conexão, certificado ou protocolo.',
  blocked_destination: 'O destino foi bloqueado pela política de segurança.',
  invalid_url: 'A URL não atende à política de consulta.',
  invalid_redirect: 'Redirecionamento inválido.',
  redirect_limit: 'A URL excedeu o limite de redirecionamentos.',
  redirect_loop: 'Foi identificado um ciclo de redirecionamentos.',
  response_too_large: 'A página excedeu o limite de conteúdo.',
  unsupported_encoding: 'A resposta comprimida não é aceita nesta versão.',
};
export const warningLabels: Record<string, string> = {
  simulated_data: 'Pontuação de demonstração: dados simulados.',
  stale_evidence: 'Evidências com mais de 90 dias foram desconsideradas.',
  future_evidence: 'Evidências com data futura foram desconsideradas.',
  website_not_assessed: 'Ausência de site não estabelecida.',
  need_not_assessed: 'Necessidades digitais ainda não documentadas.',
  activity_not_assessed: 'Atividade digital ainda não documentada.',
};
