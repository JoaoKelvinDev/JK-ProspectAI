import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(frontend, '..', 'backend');
const python = resolve(
  backend,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const vite = resolve(frontend, 'node_modules/vite/bin/vite.js');
const children = [];
const output = [];

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  await new Promise((done, reject) => server.close((error) => (error ? reject(error) : done())));
  return port;
}

function start(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => {
      output.push(data.toString());
      if (output.length > 50) output.shift();
    });
  }
  child.on('error', (error) => output.push(error.message));
  return child;
}

async function ready(url, child) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('O serviço encerrou antes da inicialização.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(700) });
      if (response.ok) return response;
    } catch {
      /* O processo pode ainda estar abrindo a porta local. */
    }
    await delay(150);
  }
  throw new Error(`O serviço não iniciou: ${url}`);
}

async function cleanup() {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit').catch(() => {});
      child.kill();
      await Promise.race([
        exited,
        delay(3000).then(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }),
      ]);
    }),
  );
}
process.once('SIGINT', () => {
  void cleanup().then(() => process.exit(130));
});

try {
  assert(existsSync(python), 'Prepare o ambiente virtual em backend/.venv antes deste teste.');
  assert(existsSync(vite), 'Instale as dependências do frontend antes deste teste.');
  const backendPort = await freePort();
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const apiProcess = start(
    python,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(backendPort)],
    backend,
    { PYTHONDONTWRITEBYTECODE: '1' },
  );
  await ready(`${backendUrl}/health`, apiProcess);
  const frontendPort = await freePort();
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  const uiProcess = start(
    process.execPath,
    [vite, 'preview', '--port', String(frontendPort)],
    frontend,
    { JK_BACKEND_URL: backendUrl },
  );
  const page = await ready(frontendUrl, uiProcess);
  const html = await page.text();
  assert.match(html, /lang="pt-BR"/);
  for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
    assert.equal((await fetch(frontendUrl + asset[1])).status, 200);
  }
  assert.deepEqual(await (await fetch(`${frontendUrl}/health`)).json(), { status: 'ok' });
  const description = await (await fetch(`${frontendUrl}/openapi.json`)).json();
  for (const path of [
    '/api/v1/discovery/search',
    '/api/v1/website-inspector/inspect',
    '/api/v1/lead-scoring/score',
  ]) {
    assert(description.paths[path]?.post, `Módulo ausente no servidor: ${path}`);
  }

  async function post(path, body, expected = 200) {
    const response = await fetch(frontendUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, expected, `Status inesperado em ${path}`);
    return response.json();
  }
  const businesses = await post('/api/v1/discovery/search', {
    city: 'Teresina',
    state: 'PI',
    max_results: 3,
  });
  assert.equal(businesses.length, 3);
  const business = businesses[0];
  assert.equal(business.is_simulated, true);
  const inspection = await post('/api/v1/website-inspector/inspect', business);
  assert.equal(inspection.status, 'not_checked');
  const input = { business, website_inspection: inspection };
  const score = await post('/api/v1/lead-scoring/score', input);
  assert.equal(score.score, 5);
  assert.equal(score.assessed_max_score, 10);
  assert.equal(score.criteria.length, 5);
  assert.equal(score.is_simulated, true);
  const enriched = await post('/api/v1/lead-scoring/score', {
    ...input,
    needs: [
      {
        need: 'online_menu',
        evidence: {
          source: 'Fonte fictícia de integração',
          source_url: 'https://source.example/',
          observed_at: new Date(Date.now() - 60_000).toISOString(),
          description: 'Observação simulada para o teste local, sem consulta externa.',
        },
      },
    ],
  });
  assert.equal(enriched.score, 45);
  const observedAt = new Date(Date.now() - 60_000).toISOString();
  const evidence = {
    source: 'Origem fictícia para revisão local',
    source_url: 'https://source.example/',
    observed_at: observedAt,
    description: 'Verificação simulada por nome e localização.',
  };
  const secondEvidence = {
    ...evidence,
    source: 'Segunda origem fictícia',
    source_url: 'https://second.example/',
    description: 'Revisão simulada de outra fonte comercial.',
  };
  const completeInput = {
    ...input,
    needs: [
      { need: 'online_menu', evidence },
      { need: 'online_ordering', evidence },
    ],
    activity_evidence: [evidence],
    website_review: {
      scope: 'manual_search',
      status: 'not_found',
      reviewed_at: observedAt,
      checks: [evidence.description, secondEvidence.description],
      evidence: [evidence, secondEvidence],
    },
  };
  const complete = await post('/api/v1/lead-scoring/score', completeInput);
  assert.equal(complete.score, 100);
  assert.equal(complete.assessed_max_score, 100);
  assert.deepEqual(complete.warnings, ['simulated_data']);
  const emptyAnalysis = await post('/api/v1/business-analysis/analyze', input);
  assert.equal(emptyAnalysis.generation_mode, 'simulated');
  assert.equal(emptyAnalysis.status, 'insufficient_evidence');
  assert.deepEqual(emptyAnalysis.suggestions, []);
  const analysis = await post('/api/v1/business-analysis/analyze', completeInput);
  assert.equal(analysis.status, 'ready_for_review');
  assert.equal(analysis.provider, 'mock');
  assert.equal(analysis.prompt_version, '1.0.0');
  assert.equal(analysis.business_is_simulated, true);
  assert.deepEqual(
    analysis.suggestions.map((item) => item.need),
    ['website', 'online_menu', 'online_ordering'],
  );
  for (const suggestion of analysis.suggestions) {
    assert(
      suggestion.fact_ids.every((id) =>
        analysis.facts.some((fact) => fact.id === id && fact.need === suggestion.need),
      ),
    );
  }
  const removedAnalysis = await post('/api/v1/business-analysis/analyze', input);
  assert.deepEqual(removedAnalysis.suggestions, []);
  await post('/api/v1/business-analysis/analyze', { ...input, provider: 'custom' }, 422);
  const messageInput = { ...completeInput, selected_need: 'online_menu' };
  const draft = await post('/api/v1/messages/generate', messageInput);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.review_status, 'pending_review');
  assert.equal(draft.delivery_status, 'not_sent');
  assert.equal(draft.generation_mode, 'simulated');
  assert.equal(draft.business_is_simulated, true);
  assert.equal(draft.locale, 'pt-BR');
  assert.equal(draft.channel, 'short_message');
  assert.equal(draft.content.subject, null);
  assert(draft.content.body.includes(business.name));
  assert(draft.content.body.includes('cardápio digital'));
  assert(draft.context_facts.every((fact) => fact.need === 'online_menu' && fact.evidence.length));
  const email = await post('/api/v1/messages/generate', { ...messageInput, channel: 'email' });
  assert.equal(email.channel, 'email');
  assert(email.content.subject && email.content.body.includes('Atenciosamente'));
  await post('/api/v1/messages/generate', { ...input, selected_need: 'online_menu' }, 409);
  await post('/api/v1/messages/generate', { ...messageInput, selected_need: 'scheduling' }, 409);
  await post('/api/v1/messages/generate', { ...messageInput, recipient: 'not-accepted' }, 422);
  const withoutEvidence = await post('/api/v1/lead-scoring/score', input);
  assert.equal(
    withoutEvidence.score,
    5,
    'Remover evidências deve recalcular o score sem estado residual',
  );
  for (const [at, warning] of [
    [new Date(Date.now() + 86_400_000).toISOString(), 'future_evidence'],
    [new Date(Date.now() - 91 * 86_400_000).toISOString(), 'stale_evidence'],
  ]) {
    const ignored = await post('/api/v1/lead-scoring/score', {
      ...input,
      needs: [{ need: 'online_menu', evidence: { ...evidence, observed_at: at } }],
    });
    assert.equal(ignored.score, 5);
    assert(ignored.warnings.includes(warning));
    const ignoredAnalysis = await post('/api/v1/business-analysis/analyze', {
      ...input,
      needs: [{ need: 'online_menu', evidence: { ...evidence, observed_at: at } }],
    });
    assert.deepEqual(ignoredAnalysis.suggestions, []);
    await post(
      '/api/v1/messages/generate',
      {
        ...input,
        selected_need: 'online_menu',
        needs: [{ need: 'online_menu', evidence: { ...evidence, observed_at: at } }],
      },
      409,
    );
  }
  const sameOrigin = structuredClone(completeInput);
  sameOrigin.website_review.evidence[1].source_url = 'https://source.example/another-page';
  await post('/api/v1/lead-scoring/score', sameOrigin, 422);
  assert.deepEqual(await post('/api/v1/discovery/search', { city: 'Parnaíba', state: 'PI' }), []);
  const restaurants = await post('/api/v1/discovery/search', {
    city: 'Teresina',
    state: 'PI',
    segments: ['restaurantes'],
    max_results: 1,
  });
  assert.equal(restaurants.length, 1);
  assert.equal(restaurants[0].category, 'restaurantes');
  const invalid = await post(
    '/api/v1/discovery/search',
    { city: 'Teresina', state: 'PI', max_results: 0 },
    422,
  );
  assert(Array.isArray(invalid.detail));
  const blocked = await post('/api/v1/website-inspector/inspect', {
    ...business,
    website: 'http://127.0.0.1/',
    source: 'manual',
    is_simulated: false,
  });
  assert.equal(blocked.reason, 'blocked_destination');
  assert.deepEqual(blocked.evidence, []);
  console.log(
    'PASS: build e assets, proxy local, filtros, inspeção, scores 5/45/100, análise rastreável, rascunhos de mensagem curta/e-mail sem envio, evidências atuais, validação=422, contexto=409 e bloqueio interno.',
  );
} catch (error) {
  console.error(error);
  console.error(output.join('').slice(-5000));
  process.exitCode = 1;
} finally {
  await cleanup();
  console.log('Servidores temporários encerrados; nenhum serviço existente foi alterado.');
}
