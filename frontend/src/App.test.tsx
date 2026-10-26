import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { basicScore, businesses, firstBusiness, json, mockBackend } from './test/backend';
import type { ScoreRequest } from './contracts';

async function search() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
  await screen.findByRole('button', { name: `Revisar ${firstBusiness().name}` });
  return user;
}

describe('primeira versão do dashboard', () => {
  it('avisa quando o processo responde mas ainda não oferece os módulos atuais', async () => {
    mockBackend((path) =>
      path === '/openapi.json'
        ? json({ paths: { '/api/v1/discovery/search': { post: {} } } })
        : undefined,
    );
    render(<App />);
    expect(await screen.findByText('Backend desatualizado')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Reinicie o servidor local');
    expect(screen.queryByText('Serviço conectado')).not.toBeInTheDocument();
  });
  it('foca os detalhes e permite voltar ao resultado em telas pequenas', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('max-width'), media: query })),
    );
    mockBackend();
    render(<App />);
    const user = await search();
    const button = screen.getByRole('button', { name: `Revisar ${firstBusiness().name}` });
    await user.click(button);
    expect(
      screen.getByRole('complementary', { name: `Detalhes de ${firstBusiness().name}` }),
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Voltar aos resultados' }));
    expect(button).toHaveFocus();
  });
  it('limpa o filtro local ao executar uma nova pesquisa', async () => {
    mockBackend();
    render(<App />);
    const user = await search();
    await user.type(
      screen.getByLabelText('Filtrar resultados pelo nome ou segmento'),
      'inexistente',
    );
    expect(screen.getByText('Nenhum resultado para este filtro.')).toBeVisible();
    await search();
    expect(screen.getByLabelText('Filtrar resultados pelo nome ou segmento')).toHaveValue('');
  });
  it('coloca erro de pontuação junto da ação e verifica a conexão novamente', async () => {
    const fetch = mockBackend((path) =>
      path.includes('lead-scoring')
        ? json({ detail: 'Não foi possível pontuar.' }, 503)
        : undefined,
    );
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível pontuar');
    expect(alert.closest('.scoring-section')).not.toBeNull();
    await waitFor(() =>
      expect(fetch.mock.calls.filter((call) => call[0] === '/health')).toHaveLength(2),
    );
  });
  it('começa sem resultados inventados e verifica a conexão', async () => {
    const fetch = mockBackend();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Encontre seu próximo cliente',
    );
    expect(screen.getByText('Descoberta em modo demonstração')).toBeVisible();
    expect(screen.getByText('Sua próxima pesquisa começa aqui.')).toBeVisible();
    await screen.findByText('Serviço conectado');
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/health', '/openapi.json']);
  });
  it('pesquisa com os filtros escolhidos e seleciona o primeiro resultado', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Segmento'), 'restaurantes');
    await user.clear(screen.getByLabelText('Limite'));
    await user.type(screen.getByLabelText('Limite'), '2');
    await search();
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('discovery'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      city: 'Teresina',
      state: 'PI',
      segments: ['restaurantes'],
      max_results: 2,
    });
    expect(
      screen.getByRole('complementary', { name: `Detalhes de ${firstBusiness().name}` }),
    ).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(businesses.length + 1);
  });
  it('filtra resultados por texto sem acentos e permite limpar o filtro', async () => {
    mockBackend();
    render(<App />);
    const user = await search();
    await user.type(screen.getByLabelText('Filtrar resultados pelo nome ou segmento'), 'acai');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.clear(screen.getByLabelText('Filtrar resultados pelo nome ou segmento'));
    await user.type(
      screen.getByLabelText('Filtrar resultados pelo nome ou segmento'),
      'inexistente',
    );
    expect(screen.getByText('Nenhum resultado para este filtro.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar filtro' }));
    expect(screen.getAllByRole('row')).toHaveLength(businesses.length + 1);
  });
  it('mostra falha de serviço sem resultados simulados de fallback', async () => {
    mockBackend((path) =>
      path.includes('discovery') ? json({ detail: 'Fonte indisponível.' }, 503) : undefined,
    );
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fonte indisponível');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pesquisar negócios' })).toBeEnabled();
  });
  it('mostra um estado vazio quando a API não encontra estabelecimentos', async () => {
    mockBackend((path) => (path.includes('discovery') ? json([]) : undefined));
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    expect(await screen.findByText('Nenhum estabelecimento encontrado.')).toBeVisible();
  });
  it('inspeciona o registro selecionado e explica a simulação', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Inspecionar URL' }));
    expect(
      await screen.findByText('O registro é simulado. Nenhuma consulta externa foi realizada.'),
    ).toBeVisible();
    expect(screen.getByText('Ainda não verificado')).toBeVisible();
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('website-inspector'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual(firstBusiness());
  });
  it('calcula score parcial com critérios e cobertura', async () => {
    mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    expect(await screen.findByLabelText('Pontuação comercial')).toHaveTextContent('5');
    expect(screen.getByText('10/100')).toBeVisible();
    expect(screen.getByText('Ausência de site não estabelecida.')).toBeVisible();
    await user.click(screen.getByText('Qualidade dos dados'));
    expect(
      screen.getByText(
        'Endereço: 3 pontos; identificador da fonte: 2; evidência atual referenciada: 5.',
      ),
    ).toBeVisible();
  });
  it('registra negócio manual sem inventar fonte ou simulação', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Adicionar manualmente' }));
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Nome do estabelecimento'),
      'Negócio real informado',
    );
    await user.type(within(dialog).getByLabelText(/URL candidata/), 'https://example.org/');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar à sessão' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Negócio real informado' })).toBeVisible();
    expect(fetch.mock.calls.some((call) => String(call[0]).includes('website-inspector'))).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Inspecionar URL' }));
    await waitFor(() =>
      expect(fetch.mock.calls.some((call) => String(call[0]).includes('website-inspector'))).toBe(
        true,
      ),
    );
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('website-inspector'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      source: 'manual',
      is_simulated: false,
      website: 'https://example.org/',
    });
  });
  it('preserva cadastros manuais durante uma nova pesquisa', async () => {
    mockBackend();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Adicionar manualmente' }));
    await user.type(screen.getByLabelText('Nome do estabelecimento'), 'Registro da sessão');
    await user.click(screen.getByRole('button', { name: 'Adicionar à sessão' }));
    await search();
    expect(screen.getByRole('button', { name: 'Revisar Registro da sessão' })).toBeVisible();
  });
  it('registra necessidade com evidência, recalcula e invalida score ao remover', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Inspecionar URL' }));
    await screen.findByText('O registro é simulado. Nenhuma consulta externa foi realizada.');
    await user.click(screen.getByRole('button', { name: 'Registrar evidência' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText('Necessidade identificada'),
      'online_menu',
    );
    await user.type(within(dialog).getByLabelText('Origem da informação'), 'Revisão manual');
    await user.type(within(dialog).getByLabelText('URL da evidência'), 'https://source.example/');
    await user.type(
      within(dialog).getByLabelText('Descrição da observação'),
      'Necessidade documentada para revisão.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    expect(await screen.findByLabelText('Pontuação comercial')).toHaveTextContent('45');
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('lead-scoring'));
    const body = JSON.parse(String(call?.[1]?.body)) as ScoreRequest;
    expect(body.website_inspection?.reason).toBe('simulated_business');
    expect(body.needs[0]).toMatchObject({
      need: 'online_menu',
      evidence: { source: 'Revisão manual', source_url: 'https://source.example/' },
    });
    expect(body.needs[0]?.evidence.observed_at).toMatch(/Z$/);
    const steps = fetch.mock.calls
      .map((item) => String(item[0]))
      .filter((path) => path.startsWith('/api/v1/'));
    expect(steps).toEqual([
      '/api/v1/discovery/search',
      '/api/v1/website-inspector/inspect',
      '/api/v1/lead-scoring/score',
    ]);
    await user.click(screen.getByRole('button', { name: 'Remover necessidade 1' }));
    expect(screen.queryByLabelText('Pontuação comercial')).not.toBeInTheDocument();
  });
  it('rejeita ausência de site baseada em duas URLs da mesma origem', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Registrar evidência' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Tipo de registro'), 'review');
    await user.selectOptions(within(dialog).getByLabelText('Resultado da revisão'), 'not_found');
    await user.type(within(dialog).getByLabelText('Origem da informação'), 'Primeira origem');
    await user.type(within(dialog).getByLabelText('URL da evidência'), 'https://source.example/');
    await user.type(
      within(dialog).getByLabelText('Primeira verificação realizada'),
      'Pesquisa pelo nome e cidade.',
    );
    await user.type(within(dialog).getByLabelText('Nome da segunda origem'), 'Segunda origem');
    await user.type(
      within(dialog).getByLabelText('URL da segunda evidência'),
      'https://source.example/other',
    );
    await user.type(
      within(dialog).getByLabelText('Segunda verificação realizada'),
      'Revisão de outra listagem comercial.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('dois domínios distintos');
    await user.clear(within(dialog).getByLabelText('URL da segunda evidência'));
    await user.type(
      within(dialog).getByLabelText('URL da segunda evidência'),
      'https://second.example/',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByText('Ver verificações e fontes'));
    expect(screen.getByRole('link', { name: 'Primeira origem' })).toHaveAttribute(
      'href',
      'https://source.example/',
    );
    expect(screen.getByRole('link', { name: 'Segunda origem' })).toHaveAttribute(
      'href',
      'https://second.example/',
    );
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    expect(await screen.findByLabelText('Pontuação comercial')).toHaveTextContent('35');
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('lead-scoring'));
    const body = JSON.parse(String(call?.[1]?.body)) as ScoreRequest;
    expect(body.website_review).toMatchObject({ status: 'not_found', scope: 'manual_search' });
    expect(body.website_review?.evidence).toHaveLength(2);
  });
  it('registra atividade digital e envia sua evidência para a pontuação', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Registrar evidência' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Tipo de registro'), 'activity');
    await user.type(within(dialog).getByLabelText('Origem da informação'), 'Página comercial');
    await user.type(within(dialog).getByLabelText('URL da evidência'), 'https://source.example/');
    await user.type(
      within(dialog).getByLabelText('Descrição da observação'),
      'Publicação comercial recente observada.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    expect(await screen.findByLabelText('Pontuação comercial')).toHaveTextContent('25');
    const call = fetch.mock.calls.find((item) => String(item[0]).includes('lead-scoring'));
    const body = JSON.parse(String(call?.[1]?.body)) as ScoreRequest;
    expect(body.activity_evidence[0]?.description).toBe('Publicação comercial recente observada.');
  });
  it('não aceita uma evidência com data futura', async () => {
    mockBackend();
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Registrar evidência' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Origem da informação'), 'Fonte futura');
    await user.type(within(dialog).getByLabelText('URL da evidência'), 'https://source.example/');
    await user.type(
      within(dialog).getByLabelText('Descrição da observação'),
      'Observação para testar a data.',
    );
    fireEvent.change(within(dialog).getByLabelText('Data e hora da observação'), {
      target: { value: new Date(Date.now() + 172_800_000).toISOString().slice(0, 16) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('sem estar no futuro');
  });
  it('ignora uma pontuação antiga recebida depois de nova pesquisa', async () => {
    let resolve!: (value: Response) => void;
    let searchCount = 0;
    mockBackend((path) => {
      if (path.includes('lead-scoring'))
        return new Promise<Response>((done) => {
          resolve = done;
        });
      if (path.includes('discovery')) return ++searchCount === 1 ? json(businesses) : json([]);
      return undefined;
    });
    render(<App />);
    const user = await search();
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    await screen.findByText('Nenhum estabelecimento encontrado.');
    await act(async () => {
      resolve(json(basicScore));
    });
    expect(screen.queryByLabelText('Pontuação comercial')).not.toBeInTheDocument();
  });
  it('fecha a ajuda pelo evento de cancelamento do diálogo', async () => {
    mockBackend();
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Como funciona' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
