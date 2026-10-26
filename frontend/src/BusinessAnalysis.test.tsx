import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import {
  businesses,
  emptyAnalysis,
  enrichedAnalysis,
  firstBusiness,
  json,
  mockBackend,
} from './test/backend';
import type { ScoreRequest } from './contracts';

async function openBusiness() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
  await screen.findByRole('button', { name: `Revisar ${firstBusiness().name}` });
  return user;
}

describe('análise simulada no dashboard', () => {
  it('só consulta ao clicar e deixa explícita a falta de evidências', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await openBusiness();
    expect(fetch.mock.calls.some(([path]) => String(path).includes('business-analysis'))).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    const card = await screen.findByLabelText('Análise do negócio');
    expect(card).toHaveTextContent('ANÁLISE SIMULADA · SEM LLM');
    expect(card).toHaveTextContent('Nenhuma solução sugerida');
    await user.click(within(card).getByText('Fatos do contexto e evidências utilizadas'));
    expect(card).toHaveTextContent('Cadastro informado:');
  });

  it('envia evidências, separa sugestões e invalida análise e score ao remover', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await openBusiness();
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
      'Necessidade registrada.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar evidência' }));
    await user.click(screen.getByRole('button', { name: 'Calcular pontuação' }));
    await screen.findByLabelText('Pontuação comercial');
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    const card = await screen.findByLabelText('Análise do negócio');
    expect(card).toHaveTextContent('Hipótese a validar');
    expect(card).toHaveTextContent('Oportunidade');
    expect(card).toHaveTextContent('Solução sugerida');
    expect(card).toHaveTextContent('Pergunta para revisão');
    expect(screen.getByLabelText('Pontuação comercial')).toHaveTextContent('45');
    const call = fetch.mock.calls.find(([path]) => String(path).includes('business-analysis'));
    const request = JSON.parse(String(call?.[1]?.body)) as ScoreRequest;
    expect(request.business).toEqual(firstBusiness());
    expect(request.needs[0]?.evidence.description).toBe('Necessidade registrada.');
    expect(request).not.toHaveProperty('score');
    await user.click(screen.getByRole('button', { name: 'Remover necessidade 1' }));
    expect(screen.queryByLabelText('Análise do negócio')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pontuação comercial')).not.toBeInTheDocument();
  });

  it('uma nova inspeção invalida a análise anterior', async () => {
    mockBackend();
    render(<App />);
    const user = await openBusiness();
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    await screen.findByLabelText('Análise do negócio');
    await user.click(screen.getByRole('button', { name: 'Inspecionar URL' }));
    await screen.findByText('O registro é simulado. Nenhuma consulta externa foi realizada.');
    expect(screen.queryByLabelText('Análise do negócio')).not.toBeInTheDocument();
  });

  it('apresenta falha junto à análise e permite tentar novamente', async () => {
    mockBackend((path) =>
      path.includes('business-analysis')
        ? json({ detail: 'Análise indisponível.' }, 502)
        : undefined,
    );
    render(<App />);
    const user = await openBusiness();
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Análise indisponível');
    expect(alert.closest('.analysis-section')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Gerar análise simulada' })).toBeEnabled();
  });

  it('cancela a análise pendente e ignora resposta tardia após uma nova pesquisa', async () => {
    let resolve!: (value: Response) => void;
    let count = 0;
    const fetch = mockBackend((path) => {
      if (path.includes('business-analysis'))
        return new Promise<Response>((done) => {
          resolve = done;
        });
      if (path.includes('discovery')) return ++count === 1 ? json(businesses) : json([]);
      return undefined;
    });
    render(<App />);
    const user = await openBusiness();
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    expect(screen.getByRole('button', { name: 'Analisando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar evidência' })).toBeDisabled();
    const call = fetch.mock.calls.find(([path]) => String(path).includes('business-analysis'));
    await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    await screen.findByText('Nenhum estabelecimento encontrado.');
    expect(call?.[1]?.signal?.aborted).toBe(true);
    await act(async () => {
      resolve(json(emptyAnalysis));
    });
    expect(screen.queryByLabelText('Análise do negócio')).not.toBeInTheDocument();
  });

  it('renderiza descrições externas como texto, sem executar HTML', async () => {
    const attack = '<img src=x onerror=alert(1)>';
    const response = structuredClone(enrichedAnalysis);
    const fact = response.facts.find((item) => item.need === 'online_menu');
    if (!fact?.evidence[0]) throw new Error('Fixture sem evidência.');
    fact.evidence[0].description = attack;
    mockBackend((path) => (path.includes('business-analysis') ? json(response) : undefined));
    const { container } = render(<App />);
    const user = await openBusiness();
    await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
    const card = await screen.findByLabelText('Análise do negócio');
    await user.click(within(card).getByText('Fatos do contexto e evidências utilizadas'));
    await waitFor(() => expect(within(card).getByText(attack)).toBeVisible());
    expect(container.querySelector('img')).toBeNull();
    const link = within(card).getByRole('link', { name: fact.evidence[0].source });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
