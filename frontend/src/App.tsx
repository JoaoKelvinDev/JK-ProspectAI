import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  CircleHelp,
  Compass,
  ExternalLink,
  FlaskConical,
  Globe2,
  Leaf,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from './lib/api';
import { businessKey } from './lib/format';
import { focusDetailsOnSmallScreen, returnToSelectedResult } from './lib/navigation';
import type {
  Business,
  BusinessEntry,
  EvidenceAddition,
  MessageContent,
  MessageGenerationOptions,
  SearchFilters,
} from './contracts';
import { SearchForm } from './components/SearchForm';
import { BusinessList } from './components/BusinessList';
import { BusinessPanel } from './components/BusinessPanel';
import { BusinessForm } from './components/BusinessForm';
import { EvidenceForm } from './components/EvidenceForm';
import { Modal } from './components/Modal';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';
const newEntry = (business: Business): BusinessEntry => ({
  business,
  needs: [],
  activity: [],
  pending: null,
  error: null,
});

export default function App() {
  const [health, setHealth] = useState<'checking' | 'online' | 'offline' | 'incompatible'>(
    'checking',
  );
  const [entries, setEntries] = useState<BusinessEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [modal, setModal] = useState<'help' | 'business' | 'evidence' | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [detailNavigation, setDetailNavigation] = useState(0);
  const controllers = useRef(new Map<string, AbortController>());
  const generation = useRef(0);
  const healthGeneration = useRef(0);
  const selected = entries.find((entry) => businessKey(entry.business) === selectedKey);
  function patchEntry(key: string, update: (entry: BusinessEntry) => BusinessEntry) {
    setEntries((previous) =>
      previous.map((entry) => (businessKey(entry.business) === key ? update(entry) : entry)),
    );
  }
  function selectBusiness(key: string) {
    setSelectedKey(key);
    setDetailNavigation((previous) => previous + 1);
  }
  useEffect(() => {
    if (detailNavigation > 0) focusDetailsOnSmallScreen();
  }, [detailNavigation]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++healthGeneration.current;
    void api
      .health(controller.signal)
      .then(() => {
        if (current === healthGeneration.current) setHealth('online');
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted && current === healthGeneration.current)
          setHealth(
            caught instanceof ApiError && caught.code === 'incompatible_backend'
              ? 'incompatible'
              : 'offline',
          );
      });
    const activeControllers = controllers.current;
    return () => {
      controller.abort();
      activeControllers.forEach((active) => active.abort());
    };
  }, []);
  async function checkHealth() {
    const controller = new AbortController();
    const current = ++healthGeneration.current;
    controllers.current.get('health')?.abort();
    controllers.current.set('health', controller);
    setHealth('checking');
    try {
      await api.health(controller.signal);
      if (current === healthGeneration.current) setHealth('online');
    } catch (caught) {
      if (!controller.signal.aborted && current === healthGeneration.current)
        setHealth(
          caught instanceof ApiError && caught.code === 'incompatible_backend'
            ? 'incompatible'
            : 'offline',
        );
    } finally {
      if (controllers.current.get('health') === controller) controllers.current.delete('health');
    }
  }
  async function search(filters: SearchFilters) {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    const current = ++generation.current;
    setListVersion((previous) => previous + 1);
    const controller = new AbortController();
    controllers.current.set('search', controller);
    const retained = entries
      .filter((entry) => entry.business.source === 'manual')
      .map((entry) => ({ ...entry, pending: null, error: null }));
    setEntries(retained);
    setSelectedKey(null);
    setError(null);
    setStatus('loading');
    setQuery(null);
    try {
      const results = await api.search(filters, controller.signal);
      if (current !== generation.current) return;
      const combined = [...results.map(newEntry), ...retained];
      setEntries(combined);
      setSelectedKey(combined[0] ? businessKey(combined[0].business) : null);
      setStatus('success');
      setQuery(`${filters.city}, ${filters.state}`);
      if (health !== 'online') void checkHealth();
    } catch (caught) {
      if (controller.signal.aborted || current !== generation.current) return;
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'Não foi possível pesquisar.');
      void checkHealth();
    } finally {
      if (controllers.current.get('search') === controller) controllers.current.delete('search');
    }
  }
  async function perform(
    action: 'inspect' | 'score' | 'analyze' | 'message',
    options?: MessageGenerationOptions,
  ) {
    if (!selected || !selectedKey || selected.pending) return;
    if (action === 'message' && !options) return;
    const key = selectedKey;
    const snapshot = selected;
    const current = generation.current;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    patchEntry(key, (entry) => ({ ...entry, pending: action, error: null }));
    try {
      if (action === 'inspect') {
        const inspection = await api.inspect(snapshot.business, controller.signal);
        if (current === generation.current && !controller.signal.aborted)
          patchEntry(key, (entry) => ({
            ...entry,
            inspection,
            score: undefined,
            analysis: undefined,
            message: undefined,
            messageEdits: undefined,
            pending: null,
            error:
              inspection.status === 'found' && entry.review?.status === 'not_found'
                ? 'A inspeção identificou um site candidato e contradiz a revisão manual. Revise as evidências antes de pontuar.'
                : null,
            errorAction: 'inspect',
          }));
      } else if (action === 'score') {
        const score = await api.score(
          {
            business: snapshot.business,
            website_inspection: snapshot.inspection,
            website_review: snapshot.review,
            needs: snapshot.needs,
            activity_evidence: snapshot.activity,
          },
          controller.signal,
        );
        if (current === generation.current && !controller.signal.aborted)
          patchEntry(key, (entry) => ({ ...entry, score, pending: null }));
      } else if (action === 'analyze') {
        const analysis = await api.analyze(
          {
            business: snapshot.business,
            website_inspection: snapshot.inspection,
            website_review: snapshot.review,
            needs: snapshot.needs,
            activity_evidence: snapshot.activity,
          },
          controller.signal,
        );
        if (current === generation.current && !controller.signal.aborted)
          patchEntry(key, (entry) => ({
            ...entry,
            analysis,
            message: undefined,
            messageEdits: undefined,
            pending: null,
          }));
      } else if (options) {
        const message = await api.generateMessage(
          {
            business: snapshot.business,
            website_inspection: snapshot.inspection,
            website_review: snapshot.review,
            needs: snapshot.needs,
            activity_evidence: snapshot.activity,
            ...options,
          },
          controller.signal,
        );
        if (current === generation.current && !controller.signal.aborted)
          patchEntry(key, (entry) => ({
            ...entry,
            message,
            messageEdits: undefined,
            pending: null,
          }));
      }
      if (!controller.signal.aborted && health !== 'online') void checkHealth();
    } catch (caught) {
      if (controller.signal.aborted || current !== generation.current) return;
      patchEntry(key, (entry) => ({
        ...entry,
        pending: null,
        error: caught instanceof Error ? caught.message : 'Não foi possível concluir a operação.',
        errorAction: action,
      }));
      void checkHealth();
    } finally {
      if (controllers.current.get(key) === controller) controllers.current.delete(key);
    }
  }
  function addBusiness(business: Business): string | null {
    const key = businessKey(business);
    if (entries.some((entry) => businessKey(entry.business) === key))
      return 'Este estabelecimento já está na sessão.';
    setEntries((previous) => [...previous, newEntry(business)]);
    selectBusiness(key);
    setListVersion((previous) => previous + 1);
    setStatus('success');
    setError(null);
    setModal(null);
    return null;
  }
  function editMessage(content: MessageContent) {
    if (!selectedKey || !selected?.message || selected.pending) return;
    patchEntry(selectedKey, (entry) => ({ ...entry, messageEdits: content }));
  }
  function addEvidence(addition: EvidenceAddition): string | null {
    if (!selected || !selectedKey || selected.pending)
      return 'Selecione um estabelecimento disponível para revisão.';
    if (
      addition.kind === 'review' &&
      addition.value.status === 'not_found' &&
      selected.inspection?.status === 'found'
    )
      return 'A inspeção identificou um site candidato. Revise esse resultado antes de declarar ausência.';
    if (
      (addition.kind === 'need' && selected.needs.length >= 20) ||
      (addition.kind === 'activity' && selected.activity.length >= 20)
    )
      return 'O limite é de 20 registros por tipo.';
    patchEntry(selectedKey, (entry) => ({
      ...entry,
      score: undefined,
      analysis: undefined,
      message: undefined,
      messageEdits: undefined,
      error: null,
      ...(addition.kind === 'need'
        ? { needs: [...entry.needs, addition.value] }
        : addition.kind === 'activity'
          ? { activity: [...entry.activity, addition.value] }
          : { review: addition.value }),
    }));
    setModal(null);
    return null;
  }
  function removeEvidence(kind: 'need' | 'activity' | 'review', index?: number) {
    if (!selectedKey || selected?.pending) return;
    patchEntry(selectedKey, (entry) => ({
      ...entry,
      score: undefined,
      analysis: undefined,
      message: undefined,
      messageEdits: undefined,
      error: null,
      ...(kind === 'need'
        ? { needs: entry.needs.filter((_, current) => current !== index) }
        : kind === 'activity'
          ? { activity: entry.activity.filter((_, current) => current !== index) }
          : { review: undefined }),
    }));
  }
  const scoredCount = entries.filter((entry) => entry.score).length;
  const showCounts = entries.length > 0 || status === 'success';
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <a href="#main-content" className="brand">
          <span className="brand-mark">
            JK<span>↗</span>
          </span>
          <span>
            Prospect<span className="brand-ai">AI</span>
          </span>
        </a>
        <span className="workspace-label">SEU ESPAÇO DE PROSPECÇÃO</span>
        <nav aria-label="Navegação principal">
          <a href="#discovery" className="nav-item active" aria-current="page">
            <Compass size={19} />
            Descoberta
            <ChevronRight size={15} />
          </a>
          <button className="nav-item" onClick={() => setModal('help')}>
            <CircleHelp size={19} />
            Como funciona
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-orbit">
            <Leaf size={25} />
          </span>
          <h3>
            Relacionamentos
            <br />
            começam com contexto.
          </h3>
          <p>Encontre oportunidades com informação e revisão humana.</p>
        </div>
        <div className="sidebar-footer">
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} />
            Documentação da API
          </a>
          <div className="local-workspace">
            <span className="workspace-avatar">JK</span>
            <span>
              <strong>JK Dev</strong>
              <small>Ambiente local · v0.1</small>
            </span>
            <span className="local-dot" />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Building2 size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>Descoberta</strong>
          </div>
          <button
            className={`connection ${health}`}
            onClick={() => void checkHealth()}
            disabled={health === 'checking'}
            aria-label="Verificar conexão com o serviço"
          >
            <span className="mini-dot" />
            {health === 'online'
              ? 'Serviço conectado'
              : health === 'checking'
                ? 'Verificando serviço'
                : health === 'incompatible'
                  ? 'Backend desatualizado'
                  : 'Serviço indisponível'}
            <RefreshCw size={12} className={health === 'checking' ? 'spin' : ''} />
          </button>
        </header>
        <main id="main-content">
          <section className="page-intro" id="discovery">
            <div>
              <span className="eyebrow">PROSPECÇÃO COM CONTEXTO</span>
              <h1>
                Encontre seu próximo cliente<span>.</span>
              </h1>
              <p>Descubra negócios. Entenda necessidades. Identifique oportunidades.</p>
            </div>
            <button
              className="button secondary add-business"
              onClick={() => setModal('business')}
              disabled={status === 'loading'}
            >
              <Plus size={17} />
              Adicionar manualmente
            </button>
          </section>
          <div className="demo-banner">
            <span className="banner-icon">
              <FlaskConical size={18} />
            </span>
            <div>
              <strong>Descoberta em modo demonstração</strong>
              <p>
                As pesquisas usam negócios fictícios de Teresina, PI. Registros manuais são
                identificados separadamente.
              </p>
            </div>
            <span className="demo-label">DADOS SIMULADOS</span>
          </div>
          <SearchForm pending={status === 'loading'} onSearch={(filters) => void search(filters)} />
          {health === 'incompatible' && (
            <div className="error-banner" role="alert">
              O backend aberto é de uma versão anterior. Reinicie o servidor local e use o botão de
              conexão para verificar novamente. A inspeção, a pontuação e a análise precisam dos
              módulos atuais.
            </div>
          )}
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          <section className="metrics" aria-label="Resumo da sessão" aria-live="polite">
            <div className="metric">
              <span className="metric-icon green">
                <Building2 size={20} />
              </span>
              <div>
                <span>Estabelecimentos</span>
                <strong>{showCounts ? entries.length : '—'}</strong>
                <small>{query ?? 'Nesta sessão'}</small>
              </div>
            </div>
            <div className="metric">
              <span className="metric-icon sand">
                <Globe2 size={20} />
              </span>
              <div>
                <span>URLs informadas</span>
                <strong>
                  {showCounts ? entries.filter((entry) => entry.business.website).length : '—'}
                </strong>
                <small>Informadas não significa verificadas</small>
              </div>
            </div>
            <div className="metric">
              <span className="metric-icon lavender">
                <ChartNoAxesColumnIncreasing size={20} />
              </span>
              <div>
                <span>Avaliações calculadas</span>
                <strong>{scoredCount}</strong>
                <small>Com regras e justificativas</small>
              </div>
              <ArrowUpRight size={17} className="metric-decoration" />
            </div>
          </section>
          <div className="results-layout">
            <BusinessList
              key={listVersion}
              entries={entries}
              selectedKey={selectedKey}
              status={status}
              onSelect={selectBusiness}
            />
            <BusinessPanel
              entry={selected}
              onInspect={() => void perform('inspect')}
              onScore={() => void perform('score')}
              onAnalyze={() => void perform('analyze')}
              onGenerateMessage={(options) => void perform('message', options)}
              onEditMessage={editMessage}
              onAddEvidence={() => setModal('evidence')}
              onRemove={removeEvidence}
              onBack={returnToSelectedResult}
            />
          </div>
          <footer className="page-footer">
            <span>
              <ShieldCheck size={14} />
              Revisão humana em cada decisão.
            </span>
            <span>Sessão temporária · os dados se perdem ao atualizar a página.</span>
          </footer>
        </main>
      </div>
      {modal === 'business' && (
        <Modal title="Adicionar estabelecimento" onClose={() => setModal(null)}>
          <BusinessForm onAdd={addBusiness} />
        </Modal>
      )}
      {modal === 'evidence' && selected && (
        <Modal title="Registrar evidência" onClose={() => setModal(null)}>
          <EvidenceForm onAdd={addEvidence} />
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Prospecção com contexto" onClose={() => setModal(null)}>
          <div className="help-content">
            <p>Esta versão conecta os cinco módulos disponíveis do JK Prospect AI.</p>
            <ol>
              <li>
                <strong>Pesquise.</strong> O Discovery retorna registros fictícios. Você pode
                adicionar negócios reais manualmente.
              </li>
              <li>
                <strong>Revise.</strong> Inspecione uma URL candidata e documente o que encontrou.
                Dados simulados não geram consultas externas.
              </li>
              <li>
                <strong>Avalie.</strong> Calcule o score e confira a justificativa de cada critério.
                Evidências ausentes não são fatos negativos.
              </li>
              <li>
                <strong>Analise.</strong> Gere uma análise simulada com hipóteses e sugestões
                vinculadas ao contexto registrado. Revise tudo antes de decidir.
              </li>
              <li>
                <strong>Prepare um rascunho.</strong> Escolha uma solução da análise, gere uma
                mensagem simulada e edite o texto para sua revisão. Nenhum envio é realizado.
              </li>
            </ol>
            <p>
              O backend precisa estar iniciado para pesquisar, inspecionar, pontuar e analisar. A
              sessão não é salva ao fechar ou atualizar esta página.
            </p>
            <div className="notice compact">
              <Search size={17} />A análise usa regras e modelos de texto, sem IA real. Nenhuma
              mensagem é enviada.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
