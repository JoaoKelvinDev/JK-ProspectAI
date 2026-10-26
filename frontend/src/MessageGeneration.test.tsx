import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { businesses, firstBusiness, json, mockBackend, shortMessage } from './test/backend';
import type { MessageGenerationRequest } from './contracts';

async function prepareAnalysis() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
  await screen.findByRole('button', { name: `Revisar ${firstBusiness().name}` });
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
  await user.click(screen.getByRole('button', { name: 'Gerar análise simulada' }));
  await screen.findByLabelText('Análise do negócio');
  return user;
}

async function prepareDraft() {
  const user = await prepareAnalysis();
  await user.click(screen.getByRole('button', { name: 'Gerar rascunho simulado' }));
  await screen.findByLabelText('Rascunho comercial');
  return user;
}

describe('Message Generator', () => {
  it('não gera automaticamente nem habilita mensagem sem solução da análise', async () => {
    const fetch = mockBackend();
    render(<App />);
    await screen.findByText('Serviço conectado');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    await screen.findByRole('button', { name: `Revisar ${firstBusiness().name}` });
    expect(
      screen.queryByRole('button', { name: 'Gerar rascunho simulado' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Gere uma análise com necessidade documentada/)).toBeVisible();
    expect(fetch.mock.calls.some(([path]) => String(path).includes('messages'))).toBe(false);
  });

  it('gera um rascunho rastreável e permite editar sem enviar nem aprovar', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await prepareDraft();
    const card = screen.getByLabelText('Rascunho comercial');
    expect(card).toHaveTextContent('SIMULADO · NÃO ENVIADO');
    expect(card).toHaveTextContent('Pendente de revisão');
    expect(screen.getByLabelText('Texto do rascunho')).toHaveValue(shortMessage.content.body);
    const call = fetch.mock.calls.find(([path]) => String(path).includes('messages/generate'));
    const input = JSON.parse(String(call?.[1]?.body)) as MessageGenerationRequest;
    expect(input.selected_need).toBe('online_menu');
    expect(input.channel).toBe('short_message');
    expect(input.needs[0]?.evidence.description).toBe('Necessidade registrada.');
    expect(input).not.toHaveProperty('analysis');
    expect(input).not.toHaveProperty('recipient');
    const calls = fetch.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Texto do rascunho'), {
      target: { value: 'Minha revisão local.' },
    });
    expect(within(card).getByRole('status')).toHaveTextContent('Texto editado nesta sessão');
    expect(fetch.mock.calls).toHaveLength(calls);
    expect(screen.queryByRole('button', { name: /enviar|aprovar/i })).not.toBeInTheDocument();
    const other = businesses[1];
    if (!other) throw new Error('Fixture sem segundo negócio.');
    await user.click(screen.getByRole('button', { name: `Revisar ${other.name}` }));
    expect(screen.queryByLabelText('Rascunho comercial')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Revisar ${firstBusiness().name}` }));
    expect(screen.getByLabelText('Texto do rascunho')).toHaveValue('Minha revisão local.');
  });

  it('gera e permite editar o assunto do formato e-mail', async () => {
    const fetch = mockBackend();
    render(<App />);
    const user = await prepareAnalysis();
    await user.selectOptions(screen.getByLabelText('Formato da mensagem'), 'email');
    await user.click(screen.getByRole('button', { name: 'Gerar rascunho simulado' }));
    const subject = await screen.findByLabelText('Assunto do rascunho');
    expect(subject).toHaveAttribute('maxLength', '160');
    expect(screen.getByLabelText('Texto do rascunho')).toHaveAttribute('maxLength', '2000');
    fireEvent.change(subject, { target: { value: 'Assunto revisado' } });
    expect(subject).toHaveValue('Assunto revisado');
    expect(screen.getByLabelText('Rascunho comercial')).toHaveTextContent(
      'ainda pendente de revisão',
    );
    const call = fetch.mock.calls.find(([path]) => String(path).includes('messages/generate'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      channel: 'email',
      selected_need: 'online_menu',
    });
  });

  it('preserva edições quando uma nova geração falha', async () => {
    let attempts = 0;
    mockBackend((path) =>
      path.includes('messages/generate') && ++attempts > 1
        ? json({ detail: 'Geração indisponível.' }, 502)
        : undefined,
    );
    render(<App />);
    const user = await prepareDraft();
    fireEvent.change(screen.getByLabelText('Texto do rascunho'), {
      target: { value: 'Edição preservada.' },
    });
    await user.click(screen.getByRole('button', { name: 'Gerar novo rascunho simulado' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Geração indisponível');
    expect(alert.closest('.message-section')).not.toBeNull();
    expect(screen.getByLabelText('Texto do rascunho')).toHaveValue('Edição preservada.');
    expect(screen.getByRole('button', { name: 'Gerar novo rascunho simulado' })).toBeEnabled();
  });

  it('uma nova geração bem-sucedida substitui as edições', async () => {
    mockBackend();
    render(<App />);
    const user = await prepareDraft();
    fireEvent.change(screen.getByLabelText('Texto do rascunho'), {
      target: { value: 'Texto editado.' },
    });
    await user.click(screen.getByRole('button', { name: 'Gerar novo rascunho simulado' }));
    expect(await screen.findByText('Rascunho gerado; revisão humana necessária.')).toBeVisible();
    expect(screen.getByLabelText('Texto do rascunho')).toHaveValue(shortMessage.content.body);
  });

  it.each(['evidence', 'inspection', 'analysis'])(
    'descarta rascunho e edições após alterar %s',
    async (action) => {
      mockBackend();
      render(<App />);
      const user = await prepareDraft();
      fireEvent.change(screen.getByLabelText('Texto do rascunho'), {
        target: { value: 'Texto antigo.' },
      });
      const label =
        action === 'evidence'
          ? 'Remover necessidade 1'
          : action === 'inspection'
            ? 'Inspecionar URL'
            : 'Gerar nova análise simulada';
      await user.click(screen.getByRole('button', { name: label }));
      if (action === 'inspection')
        await screen.findByText('O registro é simulado. Nenhuma consulta externa foi realizada.');
      if (action === 'analysis')
        await screen.findByRole('button', { name: 'Gerar nova análise simulada' });
      expect(screen.queryByLabelText('Rascunho comercial')).not.toBeInTheDocument();
    },
  );

  it('ignora geração tardia após nova pesquisa e bloqueia mudanças durante a geração', async () => {
    let resolve!: (response: Response) => void;
    let searches = 0;
    const fetch = mockBackend((path) => {
      if (path.includes('messages/generate'))
        return new Promise<Response>((done) => {
          resolve = done;
        });
      if (path.includes('discovery')) return ++searches === 1 ? json(businesses) : json([]);
      return undefined;
    });
    render(<App />);
    const user = await prepareAnalysis();
    await user.click(screen.getByRole('button', { name: 'Gerar rascunho simulado' }));
    expect(screen.getByRole('button', { name: 'Gerando rascunho…' })).toBeDisabled();
    expect(screen.getByLabelText('Solução para o rascunho')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar evidência' })).toBeDisabled();
    const call = fetch.mock.calls.find(([path]) => String(path).includes('messages/generate'));
    await user.click(screen.getByRole('button', { name: 'Pesquisar negócios' }));
    await screen.findByText('Nenhum estabelecimento encontrado.');
    expect(call?.[1]?.signal?.aborted).toBe(true);
    await act(async () => {
      resolve(json(shortMessage));
    });
    expect(screen.queryByLabelText('Rascunho comercial')).not.toBeInTheDocument();
  });
});
