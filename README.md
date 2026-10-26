# JK Prospect AI

Ferramenta de prospecção comercial assistida por inteligência artificial, desenvolvida
incrementalmente para a JK Dev. As diretrizes do projeto estão em [AGENTS.md](AGENTS.md).

## Forma de trabalho atual

O responsável autorizou autonomia nas decisões de desenvolvimento local, sem necessidade
de aprovação a cada decisão técnica. Essa orientação atualiza o fluxo de aprovações
rotineiras descrito no `AGENTS.md`; os requisitos funcionais e a ordem incremental dos
módulos continuam como referência.

- Ler este README antes de iniciar cada frente de trabalho e mantê-lo atualizado.
- Limitar alterações à pasta deste projeto, incluindo seu ambiente virtual e cache local.
- Executar testes relevantes e verificações de qualidade a cada mudança de código.
- Investigar falhas, corrigir suas causas e repetir as verificações afetadas.
- Apresentar o resultado, os testes executados e as limitações encontradas.

## Escopo implementado

Backend FastAPI com endpoint de saúde e módulo Discovery. A pesquisa usa exclusivamente
um catálogo em memória com **12 estabelecimentos fictícios em Teresina/PI**, distribuídos
entre os 11 segmentos suportados. Nomes, endereços, identificadores e sites são simulados.

O módulo Website Inspector inspeciona individualmente uma URL candidata informada para
um estabelecimento real. Ele registra evidências e uma conclusão conservadora, limitada
à URL fornecida. Estabelecimentos simulados não geram consultas externas.

O módulo Lead Scoring calcula uma pontuação comercial de 0 a 100 com regras versionadas,
evidências fornecidas pelo operador e justificativas por critério. Ele não consulta fontes.

O módulo AI Business Analyzer tem uma primeira implementação **simulada, sem LLM**.
Ele organiza o contexto recebido e sugere soluções somente para necessidades com
evidências atuais, mantendo hipóteses e sugestões separadas dos fatos do contexto.

A primeira versão do frontend está em `frontend/`, com React, TypeScript, Vite e
Tailwind CSS. Permite pesquisar, cadastrar registros manuais, inspecionar URLs,
documentar evidências, consultar pontuações e gerar análises simuladas rastreáveis.

Os módulos atuais não executam IA real, mensagens ou persistência. Nenhuma credencial é necessária.

## Antes de enviar ao GitHub

A revisão de conteúdo sensível, dependências e configuração está documentada em
[Revisão antes da publicação](docs/pre-publish-security-review.md), com resultados,
limitações e comandos para conferir os arquivos antes do primeiro commit.

Versione o monorepo a partir desta raiz. O `.gitignore` exclui ambientes, dependências,
builds, caches, configurações locais, credenciais e pastas de dados privados; mantenha
os dois lockfiles e o `.env.example` sem segredos no repositório. Não coloque chaves
em variáveis `VITE_*`, pois seus valores ficam disponíveis no navegador.

A versão atual é destinada ao uso local. A publicação do código não equivale ao deploy:
expor a aplicação na internet exigirá uma revisão específica de acesso e operação.

## Abrir a interface web

Requisitos do frontend: Node.js 22.12 ou superior e npm. As dependências e o cache npm
ficam dentro deste projeto. Não há instalação global de pacotes.

Abra dois terminais no VSCode, ambos inicialmente na raiz do projeto.

No primeiro, inicie o backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app
```

No segundo, prepare e inicie o frontend:

```powershell
cd frontend
npm.cmd ci --cache ..\.npm-cache --no-fund
npm.cmd run dev
```

As dependências já instaladas podem ser reutilizadas: nas próximas vezes, basta
`npm.cmd run dev`. Abra **http://127.0.0.1:5173/**. O endereço da interface é diferente
da documentação FastAPI, que continua em http://127.0.0.1:8000/docs.

Mantenha os dois terminais abertos; `Ctrl+C` encerra cada serviço. As portas do frontend
são fixas: se 5173 estiver ocupada, o Vite informa o conflito em vez de trocar de endereço
silenciosamente. O servidor escuta somente em `127.0.0.1`.

## Frontend: fluxos disponíveis

1. **Pesquisar negócios:** cidade, UF, um segmento ou todos e limite de 1 a 100. Os
   resultados vêm do Discovery; não existe fallback de registros embutidos na interface.
2. **Revisar resultados:** filtrar por nome/segmento, ordenar e abrir o painel de detalhes.
   URL informada pela fonte é apresentada separadamente de site verificado.
3. **Adicionar manualmente:** cadastrar um estabelecimento real, com URL opcional.
   O registro tem origem `manual` e não é tratado como simulação. Adicionar não consulta o site.
4. **Inspecionar URL:** ação explícita pelo backend. Registros simulados permanecem
   `not_checked`; registros reais estão sujeitos à política de consulta do Inspector.
5. **Registrar evidências:** necessidade digital, atividade digital ou revisão manual
   de site, sempre com origem, URL, descrição e data. A revisão de ausência exige duas
   verificações e duas origens distintas. Não há consulta automática dessas fontes.
6. **Calcular pontuação:** score, cobertura dos critérios, justificativas, referências e
   avisos. Adicionar/remover evidências ou executar nova inspeção invalida o score anterior.
7. **Gerar análise simulada:** fatos do contexto recebido, hipóteses, oportunidades,
   soluções e perguntas para revisão. Sem necessidade documentada atual, nenhuma solução
   é sugerida. Adicionar/remover evidências ou executar nova inspeção invalida a análise.

O cadastro e as evidências ficam **apenas na memória da página**. Atualizar, fechar ou
reabrir a página perde a sessão. Uma nova pesquisa substitui os resultados do Discovery;
cadastros manuais e suas evidências permanecem durante a sessão. Não há banco de dados,
login, envio de mensagens ou geração de conteúdo por um LLM na interface atual.

O estado da conexão verifica `/health` e a presença dos módulos em `/openapi.json`;
um processo antigo que responde saúde, mas não oferece Inspector, Scoring ou Analyzer, é indicado
como **Backend desatualizado**. Reinicie o backend no terminal do projeto e use o botão
de conexão para verificar novamente. O modo de desenvolvimento acima recarrega alterações
somente em `backend/app`, evitando continuar com módulos antigos após mudanças de código.
Falhas, listas vazias, consultas em andamento e respostas inválidas têm estados próprios.
Consultas canceladas ou respostas antigas não substituem uma pesquisa mais recente.

O Vite encaminha `/api`, `/health` e `/openapi.json` ao backend local, tanto em desenvolvimento quanto
no preview do build. Isso dispensa alterações de CORS no FastAPI. O destino padrão é
`http://127.0.0.1:8000`. Para testes com outra porta, `JK_BACKEND_URL` pode ser fornecido
somente ao processo Vite; essa configuração não é exposta no bundle do navegador.

A interface usa fontes locais e ícones empacotados, sem depender de CDN para renderizar.
Componentes nativos de formulário e diálogo, foco visível e layouts adaptáveis dão suporte
ao uso por teclado e em telas menores. A validação visual em navegador real continua
necessária quando não há navegador de automação conectado.

Na revisão da primeira versão, a lista recebeu apresentação em cartões nas telas pequenas,
navegação com foco para os detalhes e um botão de retorno ao registro selecionado.
Os diálogos restauram o foco e não fecham por um clique no espaço interno. Fontes das
evidências ficam acessíveis antes do cálculo, e os erros aparecem próximos à ação afetada.
Filtros locais são limpos em uma nova pesquisa ou ao adicionar um registro manual.

O [relatório de revisão do frontend](docs/frontend-review.md) diferencia o que foi testado
automaticamente da revisão visual ainda pendente. O Módulo 4 não faz parte desta revisão.

## Verificações do frontend

Execute a partir de `frontend/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run format:check
npm.cmd run build
npm.cmd run test:integration
```

`npm.cmd test` executa Vitest e Testing Library em JSDOM, sem rede real. Os testes usam
fixtures geradas por respostas reais do FastAPI e cobrem os contratos Zod, cancelamento,
erros, pesquisa, cadastro manual, inspeção, evidências e pontuação. JSDOM não verifica
layout visual ou o gerenciamento nativo completo de foco dos diálogos.

`npm.cmd run test:integration` gera o build, inicia seus próprios servidores temporários
em portas livres e verifica o proxy com o FastAPI real: pesquisa, inspeção, score,
validação e bloqueio de destino interno. Encerra os processos que criou ao terminar,
sem modificar serviços já abertos. Requer o ambiente `backend/.venv` preparado e não
consulta fontes externas.

`npm.cmd run build` verifica os tipos estritos e gera `frontend/dist/`. Para conferir esse
build localmente, use `npm.cmd run preview` e abra http://127.0.0.1:4173/, com o backend
iniciado. O build não é publicado automaticamente.

Organização do frontend:

```text
frontend/
├── public/favicon.svg       # Identidade visual local
├── src/
│   ├── App.tsx              # Estado da sessão e coordenação dos fluxos
│   ├── contracts.ts         # Contratos Zod e tipos compartilhados
│   ├── components/          # Pesquisa, lista, detalhes, formulários e pontuação
│   ├── lib/                 # Cliente HTTP e funções de apresentação
│   ├── test/                # Fixtures reais do backend e isolamento dos testes
│   └── styles.css           # Identidade visual e layout responsivo
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts           # React, Tailwind, testes e proxy local
```

## Preparação e execução local

Requisitos: Python 3.12 ou superior e `uv`. Execute os comandos a partir da raiz do projeto
no PowerShell. O cache fica no próprio projeto, evitando depender do cache global.

```powershell
cd backend
uv sync --locked --python 3.12 --cache-dir ..\.uv-cache
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app
```

O `uv sync` instala também as dependências de desenvolvimento. O `uv.lock` registra as
versões resolvidas. A instalação requer acesso ao registro de pacotes. O Discovery e
os testes não consultam a internet. O Inspector precisa de rede apenas quando recebe
explicitamente um estabelecimento real com URL candidata.

Não é necessário ativar o ambiente virtual ou copiar `.env.example`. Para encerrar o
servidor, use `Ctrl+C`.

- Saúde: <http://127.0.0.1:8000/health>
- Documentação interativa: <http://127.0.0.1:8000/docs>
- Contrato OpenAPI: <http://127.0.0.1:8000/openapi.json>

## Contratos HTTP

`GET /health` retorna HTTP `200` com `{"status": "ok"}`. Indica que a aplicação está
respondendo, sem verificar serviços externos.

`POST /api/v1/discovery/search` recebe:

```json
{
  "city": "Teresina",
  "state": "PI",
  "segments": [],
  "max_results": 20
}
```

| Campo | Regra |
| --- | --- |
| `city` | Obrigatório, de 1 a 120 caracteres após remoção de espaços nas extremidades; espaços internos repetidos são normalizados. |
| `state` | Obrigatório, uma UF brasileira válida; espaços nas extremidades e letras minúsculas são normalizados. |
| `segments` | Lista de segmentos conhecidos; omitida ou vazia seleciona todos os segmentos. |
| `max_results` | Inteiro de 1 a 100; padrão 20. Booleanos, strings e números decimais são rejeitados. |

Campos desconhecidos são rejeitados. Segmentos usam os seguintes identificadores exatos:

| Identificador | Categoria |
| --- | --- |
| `acaiterias` | Açaiterias |
| `restaurantes` | Restaurantes |
| `lanchonetes` | Lanchonetes |
| `bares` | Bares |
| `barbearias` | Barbearias |
| `saloes_de_beleza` | Salões de beleza |
| `lojas_de_roupas` | Lojas de roupas |
| `mercadinhos` | Mercadinhos |
| `pequenos_comercios` | Pequenos comércios |
| `prestadores_de_servicos` | Prestadores de serviços |
| `outros_estabelecimentos` | Outros estabelecimentos comerciais |

Exemplo de pesquisa pelo PowerShell:

```powershell
$searchBody = @{
    city = "Teresina"
    state = "PI"
    segments = @("restaurantes")
    max_results = 1
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "http://127.0.0.1:8000/api/v1/discovery/search" `
    -ContentType "application/json" `
    -Body $searchBody
```

A resposta HTTP `200` contém uma lista, por exemplo:

```json
[
  {
    "name": "Restaurante Simulado 02",
    "category": "restaurantes",
    "location": {
      "city": "Teresina",
      "state": "PI",
      "country": "BR",
      "address": "Rua Fictícia, 2"
    },
    "website": "https://restaurante.example/",
    "source_id": "mock-002",
    "source": "mock",
    "is_simulated": true,
    "website_status": "not_checked"
  }
]
```

`website` e `source_id` podem ser nulos. Os exemplos de site usam domínios `.example` e
não são acessados. Todos os resultados do Discovery têm `source="mock"`,
`is_simulated=true` e `website_status="not_checked"`, mesmo quando uma URL foi informada.
**Um site ausente no resultado não significa que o estabelecimento não tenha site.**

O catálogo é fixo: outras cidades ou UFs válidas retornam `[]`. O limite é um máximo;
pedir 20 resultados não gera estabelecimentos adicionais. Pesquisas idênticas retornam
resultados idênticos e na mesma ordem.

| Situação | Resultado HTTP |
| --- | --- |
| Pesquisa válida, com ou sem resultados | `200`, lista de estabelecimentos ou `[]` |
| Entrada inválida ou JSON malformado | `422`, detalhes de validação |
| `DiscoveryProviderError` | `502`, mensagem genérica sem detalhes internos da fonte |
| Erro inesperado | `500`, sem conversão silenciosa em pesquisa vazia |

## Lead Scoring: Etapa 3

`POST /api/v1/lead-scoring/score` recebe `business` obrigatório e os seguintes campos
opcionais: `website_inspection`, `website_review`, `needs` e `activity_evidence`.
Não há consulta externa, inferência por IA ou alteração dos dados de entrada.

As regras comerciais iniciais ficam em `app/core/scoring_policy.py`, versão **1.0.0**:

| Critério | Máximo | Regra |
| --- | --- | --- |
| `website_opportunity` | 25 | Revisão manual atual não localizou site após verificações documentadas. URL vazia, `404` ou resultado inconclusivo não pontuam. |
| `digital_need` | 30 | 15 pontos por tipo distinto de necessidade com evidência atual, até 30. Repetições não aumentam a pontuação. |
| `digital_activity` | 15 | Pelo menos uma evidência atual de atividade digital. Falta de evidência não equivale a inatividade. |
| `service_fit` | 20 | Pelo menos uma necessidade documentada dentre os serviços oferecidos pela JK Dev. O segmento isolado não comprova necessidade. |
| `data_quality` | 10 | Endereço informado: 3; identificador da fonte: 2; alguma evidência atual referenciada: 5. |

Esses pesos são uma política comercial inicial, sem calibração estatística. A pontuação
não representa probabilidade de compra, garantia de resultado ou autorização para contato.
Uma necessidade pode contribuir tanto para necessidade digital quanto para compatibilidade;
os critérios não são probabilidades independentes.

A saída contém `score`, `max_score=100`, `assessed_max_score`, `rules_version`,
`evaluated_at` em UTC, `basis="provided_evidence"`, `is_simulated`, critérios com pontos,
justificativas e URLs de evidência, além de avisos estruturados. Critérios sem evidência
recebem zero e `assessed=false`; o resultado não é reescalado para compensar a falta de
informação. `assessed_max_score` soma os pesos dos critérios que puderam ser avaliados.

As evidências precisam ter origem (`source`), URL (`source_url`), data com fuso
(`observed_at`) e descrição. São considerados até **90 dias**, incluindo o limite exato.
Evidências mais antigas ou futuras são ignoradas e sinalizadas. O endpoint valida a
estrutura e a coerência dos dados; **não autentica nem verifica automaticamente a
veracidade das observações enviadas**. A revisão do operador permanece necessária.

Cada item de `needs` tem `need` e `evidence`. Tipos aceitos:
`website`, `online_menu`, `product_catalog`, `online_ordering`, `scheduling`,
`workflow_automation`, `api_integration` e `custom_system`. A categoria não gera essas
necessidades automaticamente. `activity_evidence` recebe uma lista de evidências de
atividade, no mesmo formato.

`website_inspection` aceita o resultado do Inspector para a mesma URL e modo de simulação
do estabelecimento. Uma inspeção `found` registra site candidato e não pontua ausência.
Uma inspeção de URL isolada nunca comprova `not_found`.

Para registrar uma investigação manual mais ampla, `website_review` contém:

- `scope="manual_search"` e `status`: `found`, `not_found` ou `inconclusive`.
- `reviewed_at` com fuso horário, posterior ou igual às datas das evidências.
- `checks`: descrições das verificações realizadas.
- `evidence`: evidências com origem, URL, data e descrição.
- `website`: obrigatório para `found` e nulo para `not_found`.

Uma revisão `not_found` exige pelo menos **duas verificações distintas e evidências de
dois hosts distintos**. Isso registra que as buscas descritas não localizaram site,
sem provar inexistência. Revisões antigas ou com evidências antigas não pontuam. Uma
revisão `not_found` que contradiga uma inspeção `found` no mesmo pedido é rejeitada.

Exemplo mínimo, sem consultas externas:

```json
{
  "business": {
    "name": "Restaurante Simulado",
    "category": "restaurantes",
    "location": {"city": "Teresina", "state": "PI"},
    "source": "mock",
    "is_simulated": true
  }
}
```

Esse pedido retorna zero, `assessed_max_score=10` e avisos de simulação e critérios não
avaliados. Um item original do Discovery retorna 5 pontos pelos metadados de endereço
e identificador. Isso não o qualifica automaticamente como oportunidade.

Este exemplo de PowerShell encadeia os módulos usando apenas dados simulados:

```powershell
$discoveryBody = @{ city = "Teresina"; state = "PI"; max_results = 1 } | ConvertTo-Json
$business = (Invoke-RestMethod -Method Post `
    -Uri "http://127.0.0.1:8000/api/v1/discovery/search" `
    -ContentType "application/json; charset=utf-8" -Body $discoveryBody)[0]
$businessBody = $business | ConvertTo-Json -Depth 10
$inspection = Invoke-RestMethod -Method Post `
    -Uri "http://127.0.0.1:8000/api/v1/website-inspector/inspect" `
    -ContentType "application/json; charset=utf-8" -Body $businessBody
$scoreBody = @{ business = $business; website_inspection = $inspection } |
    ConvertTo-Json -Depth 15
Invoke-RestMethod -Method Post `
    -Uri "http://127.0.0.1:8000/api/v1/lead-scoring/score" `
    -ContentType "application/json; charset=utf-8" -Body $scoreBody
```

Para obter pontos adicionais, informe observações efetivamente revisadas e suas
evidências. Listas de necessidades e de atividade aceitam até 20 itens cada. Revisões
aceitam até 10 verificações e 10 evidências. Campos desconhecidos, datas sem fuso,
origens insuficientes e resultados incoerentes retornam HTTP `422`. O cliente não pode
sobrescrever pesos, score ou versão da política pelo pedido.

## AI Business Analyzer: módulo 4

`POST /api/v1/business-analysis/analyze` recebe o mesmo contexto de evidências do Scoring:
`business`, `website_inspection`, `website_review`, `needs` e `activity_evidence`. Não
recebe pontuação, instruções livres, escolha de provedor ou chave de API. Limites de
listas, datas com fuso e validações de coerência são reutilizados dos contratos existentes.

O módulo não depende de calcular o score primeiro e não altera as regras de pontuação.

Exemplo simulado com uma necessidade documentada (a data deve estar nos últimos 90 dias):

```json
{
  "business": {
    "name": "Restaurante Simulado",
    "category": "restaurantes",
    "location": {"city": "Teresina", "state": "PI"},
    "source": "mock",
    "is_simulated": true
  },
  "needs": [{
    "need": "online_menu",
    "evidence": {
      "source": "Observação fictícia para demonstração",
      "source_url": "https://source.example/",
      "observed_at": "2026-10-25T12:00:00Z",
      "description": "Necessidade simulada de organizar um cardápio digital."
    }
  }]
}
```

A resposta separa:

- `facts`: registros do contexto, cada um com identificador e evidências utilizadas.
  O cadastro é apresentado como informação recebida. Uma necessidade descreve o que
  o operador registrou; a aplicação não confirma automaticamente a veracidade da fonte.
- `suggestions`: hipótese condicional, oportunidade, solução sugerida e pergunta para
  validação. Cada sugestão referencia fatos da mesma necessidade por `fact_ids`.
- `limitations`: simulação, qualidade das fontes e eventual descarte de evidências.
- `status`: `ready_for_review` quando há sugestões ou `insufficient_evidence` quando não há.
- `analyzed_at`, `prompt_version="1.0.0"`, `basis="provided_evidence"`, `provider="mock"`
  e `generation_mode="simulated"`. `business_is_simulated` informa separadamente se o
  estabelecimento é fictício: analisar um registro manual também usa o provedor simulado.

Não há recomendações baseadas apenas no segmento. URL vazia, HTTP 404 ou inspeção
inconclusiva não geram uma necessidade de site. Uma revisão manual atual `not_found`,
com as duas verificações e origens exigidas, pode sustentar a sugestão de **avaliar**
um site; a redação mantém explícito que site não localizado não prova inexistência.

Evidências com mais de 90 dias ou com data futura são removidas antes de chamar o provedor.
Uma revisão/inspeção com qualquer evidência fora desse prazo é descartada por completo.
As observações atuais utilizadas preservam origem, URL, data e descrição. Descrições são
tratadas como dados, nunca como instruções. Os fatos da resposta são construídos pelo
serviço; o provedor recebe uma cópia e pode retornar apenas sugestões estruturadas.

A saída passa por validação Pydantic, incluindo referências existentes, necessidades
compatíveis, ausência de duplicações e limites. Falhas conhecidas ou saída inválida
do provedor retornam `502`, prazo de 10 segundos excedido retorna `504`, entrada inválida
retorna `422`. Os erros de provedor não expõem detalhes internos.

Na interface: pesquise ou adicione um negócio, registre uma necessidade em **Registrar
evidência** e clique em **Gerar análise simulada** no painel de detalhes. Abra **Fatos
do contexto e evidências utilizadas** para conferir as origens. Sem evidências, o botão
continua disponível para demonstrar a conclusão de informação insuficiente.

Arquivos principais:

```text
backend/app/schemas/business_analysis.py          # Contratos de entrada, fatos e análise
backend/app/services/business_analysis_service.py # Seleção temporal e validação de referências
backend/app/ai/base.py                           # Interface assíncrona e erro do provedor
backend/app/ai/mock_analyzer.py                  # Sugestões determinísticas de demonstração
backend/app/ai/solutions.py                      # Vocabulário das soluções aceitas
backend/app/ai/prompts.py                        # Instruções versionadas
backend/app/api/routes/business_analysis.py      # Endpoint e tratamento HTTP de falhas
backend/tests/test_business_analysis.py          # Regras, falhas, contratos e isolamento
frontend/src/components/AnalysisCard.tsx         # Contexto, hipóteses, soluções e fontes
frontend/src/BusinessAnalysis.test.tsx            # Fluxo, invalidação, cancelamento e HTML
frontend/src/test/analysis-fixtures.json          # Respostas obtidas com o FastAPI real
```

A composição em `api/dependencies.py`, as rotas em `main.py`, os contratos/clientes React,
o estado da sessão e o teste de integração também incluem esse módulo. Não houve novas
dependências. O protocolo permite implementar um provedor real posteriormente, com sua
própria configuração, identidade na resposta, avaliação de qualidade e controles de custo.
Referências válidas não garantem a veracidade de um texto gerado por um futuro LLM;
essa integração exigirá validação específica e revisão humana.

## Website Inspector: Etapa 2

`POST /api/v1/website-inspector/inspect` recebe diretamente um objeto `Business`, no
mesmo formato de um item do Discovery. Não há um campo externo `business` envolvendo o
objeto. A inspeção não altera o objeto original nem executa novas buscas por empresas.

Este exemplo é simulado e pode ser testado sem consultas à internet:

```json
{
  "name": "Restaurante Simulado 02",
  "category": "restaurantes",
  "location": {
    "city": "Teresina",
    "state": "PI",
    "country": "BR"
  },
  "website": "https://restaurante.example/",
  "source": "mock",
  "is_simulated": true
}
```

A resposta é HTTP `200`:

```json
{
  "scope": "provided_url",
  "status": "not_checked",
  "reason": "simulated_business",
  "requested_url": "https://restaurante.example/",
  "final_url": null,
  "checked_at": null,
  "confidence": null,
  "is_simulated": true,
  "evidence": []
}
```

Para inspecionar um estabelecimento real, informe seu nome, categoria e localização,
uma URL candidata pública, `source="manual"` e `is_simulated=false`. Isso realiza um
GET para a URL informada, sujeito à política de destino. Não use os dados fictícios
como se fossem de uma empresa real.

O endpoint aparece na seção **Website Inspector** do `/docs`. Reinicie o Uvicorn se ele
estava aberto antes desta atualização, pois o comando de execução não usa recarga
automática.

| Estado | Critério |
| --- | --- |
| `found` | HTML HTTP `2xx` contém o nome completo e a cidade, com normalização de caixa, acentos, pontuação e espaços. Confiança `medium`. |
| `inconclusive` | Evidência insuficiente, falha de acesso ou bloqueio pela política. Confiança `low`. |
| `not_checked` | Dados simulados ou URL ausente. Sem data de verificação, evidências ou confiança. |
| `not_found` | Reservado no contrato; não é emitido automaticamente nesta implementação. |

As correspondências usam limites de palavras e texto da página, incluindo o título.
Comentários, atributos e conteúdo de `script`, `style` e `template` não contam como
evidência textual. O parser não executa JavaScript, carrega recursos ou navega em links.

`found` significa que foi localizado **um site candidato com correspondência textual**.
Não confirma propriedade oficial nem legitimidade do conteúdo. Homônimos podem coincidir;
sites com nome diferente, conteúdo dinâmico ou bloqueios podem permanecer inconclusivos.
Falhas HTTP, inclusive `404` e `410`, não provam que a empresa não possui outro site.
Esta etapa não habilita um filtro comercial de empresas sem site.

A resposta inclui `requested_url`, última URL efetivamente observada (`final_url`),
`checked_at` em UTC e evidências HTTP em ordem. Cada evidência informa origem `http`, URL,
data, status e tipo de conteúdo; a última pode incluir título limitado a 200 caracteres
e os campos correspondentes (`name`, `city`). O HTML completo não é retornado ou persistido.
Em falhas anteriores à resposta HTTP, a lista de evidências pode estar vazia.

O campo `website_status` de `Business` continua `not_checked`: ele pertence ao contrato
do Discovery. A inspeção é um resultado separado, sem armazenamento ou integração
automática entre os módulos.

Os contratos também rejeitam conclusões incoerentes: `found` sem evidência HTML e
correspondência de nome e cidade, dados simulados tratados como inspeção real, datas
invertidas e `not_found` no escopo de uma URL isolada. O Scoring usa um contrato distinto
para a revisão manual de múltiplas fontes.

| Motivo (`reason`) | Significado |
| --- | --- |
| `simulated_business`, `missing_url` | Consulta não executada. |
| `matching_page`, `identity_mismatch` | Correspondência textual suficiente ou insuficiente. |
| `http_error`, `unsupported_content` | Status HTTP incompatível ou conteúdo diferente de HTML/XHTML. |
| `timeout`, `dns_error`, `connection_error` | Prazo excedido, falha DNS ou falha de conexão/TLS/protocolo. |
| `blocked_destination`, `invalid_url` | Destino não permitido ou URL incompatível com a política. |
| `invalid_redirect`, `redirect_limit`, `redirect_loop` | Redirecionamento incompleto, excessivo ou circular. |
| `response_too_large`, `unsupported_encoding` | Conteúdo acima do limite ou resposta comprimida. |

Inspeções inconclusivas retornam HTTP `200` com estado e motivo estruturados. Dados de
entrada inválidos retornam `422`. Erros inesperados continuam retornando `500`, sem
detalhes internos para o cliente.

## Política de consultas externas

Os limites ficam em `app/core/inspection_policy.py`, com valores tipados e injetáveis
nos testes, sem novas variáveis de ambiente:

| Controle | Regra |
| --- | --- |
| Protocolos e portas | HTTP/80 e HTTPS/443, sem credenciais embutidas na URL. |
| Destinos | Somente IPs públicos; bloqueio de endereços privados, locais, reservados, multicast e mecanismos IPv6 de transição. |
| DNS | Todos os endereços retornados devem ser públicos; a conexão usa um desses IPs sem nova resolução do hostname. |
| TLS | Verificação de certificado e hostname obrigatória, mantendo o nome original no Host e no SNI. |
| Redirecionamentos | Até 3, controlados manualmente e validados em cada salto e nova conexão. |
| Tempo | Até 3 segundos por operação de I/O, incluindo DNS na conexão; prazo total de 10 segundos para a consulta, sem reinício a cada salto. |
| Conteúdo | Até 512 KiB, com verificação prévia de Content-Length e limite aplicado durante a leitura. |
| Compressão | Solicita `identity`; respostas comprimidas são rejeitadas antes de descomprimir. |
| Ambiente e sessão | Não usa proxies ou certificados definidos por variáveis do ambiente e não encaminha cookies entre saltos. |

A configuração é deliberadamente conservadora: uma URL com credenciais, porta diferente
ou destino bloqueado produz resultado inconclusivo. A aplicação permanece destinada
ao uso local desta etapa. Essas verificações não substituem controles de saída de rede
ao preparar um ambiente de produção em uma etapa futura.

O transporte usa as interfaces públicas de [HTTPX](https://www.python-httpx.org/advanced/transports/)
e [HTTPCore](https://www.encode.io/httpcore/network-backends/). A validação na conexão
segue a orientação da [OWASP sobre SSRF e mudança de DNS](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Organização e decisões

```text
backend/
├── app/
│   ├── main.py                  # Aplicação ASGI e saúde
│   ├── api/
│   │   ├── dependencies.py       # Composição do serviço e provedor
│   │   └── routes/               # Discovery, Website Inspector e Lead Scoring
│   ├── core/
│   │   ├── inspection_policy.py  # Limites do Inspector
│   │   └── scoring_policy.py     # Pesos e versão das regras comerciais
│   ├── security/url_policy.py    # Validação de URLs e endereços públicos
│   ├── schemas/
│   │   ├── business.py           # Estabelecimento e localização
│   │   ├── discovery.py          # Filtros, UFs e segmentos
│   │   ├── lead_scoring.py       # Evidências, revisão manual e pontuação
│   │   └── website_inspection.py # Estados, evidências e resultado do Inspector
│   ├── services/
│   │   ├── discovery_service.py  # Normalização, deduplicação e limite
│   │   ├── lead_scoring_service.py # Regras comerciais determinísticas
│   │   └── website_inspector_service.py # Classificação do site candidato
│   └── providers/
│       ├── base.py               # Protocol e erro do provedor
│       ├── mock_provider.py      # Catálogo simulado e filtragem
│       ├── website.py            # Contrato de consulta de páginas
│       ├── http_website_provider.py # HTTP com limites e evidências
│       └── safe_http_transport.py  # Conexão ao IP público validado
├── tests/                        # Contratos HTTP e regras de negócio
├── pyproject.toml                # Dependências e ferramentas
├── uv.lock                       # Versões resolvidas
└── .env.example                  # Ausência de configuração obrigatória
```

O serviço Discovery recebe qualquer implementação de `DiscoveryProvider` e não importa FastAPI.
O provedor aplica filtros de localização e segmento e retorna candidatos sem truncar
pelo limite; o serviço remove duplicatas antes de limitar a saída. A interface é
síncrona, suficiente para o catálogo em memória. O Inspector tem seu próprio protocolo
assíncrono, adequado às consultas HTTP e ao cancelamento por prazo. Seus serviços também
não importam FastAPI.

O Scoring recebe modelos validados, aplica a política versionada e devolve critérios
explicados. Seu relógio é injetável para testar prazos sem depender da data da execução.
Ele não depende de um provedor externo ou de banco de dados.

A deduplicação prioriza o par `(source, source_id)`. Identificadores são sensíveis a
maiúsculas e minúsculas. Na ausência de identificador, usa nome, país, UF, cidade e
endereço, ignorando caixa, acentos e espaços repetidos nos textos. Preserva a primeira
ocorrência e não altera os objetos recebidos do provedor.

Essa regra é aproximada: homônimos sem identificador e com localização indistinguível
podem ser agrupados. Registros com identificadores diferentes são preservados, mesmo
com nomes iguais. Não há deduplicação aproximada entre registros identificados e não
identificados, nem fusão de evidências ou dados.

## Verificações locais

Execute a partir de `backend/`, com o ambiente instalado:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
```

O comando desativa apenas o cache opcional do Pytest para evitar problemas de permissão
no Windows. Os testes usam o cliente ASGI em memória e provedores substitutos. Cobrem inicialização,
saúde, OpenAPI, filtros, validação, identificação da simulação, estado de verificação,
deduplicação, limite após deduplicação, isolamento dos resultados e tratamento de erros.
Os testes do Inspector também cobrem classificação, normalização de HTML, IPs IPv4/IPv6,
DNS com respostas mistas, mudança de DNS, preservação de Host/SNI, redirecionamentos,
prazos, conteúdo e fechamento de conexões. Uma fixture bloqueia consultas DNS e conexões
externas não simuladas durante toda a suíte.

Os testes de Scoring verificam os limites 0 e 100, duplicação de necessidades, evidências
antigas ou futuras, fronteira de 90 dias, coerência de revisões manuais, vínculo da
inspeção à URL, simulação, repetibilidade e soma dos critérios. Há também regressão para
HTML com tags de fechamento inconsistentes e validação dos estados do Inspector.

Com as versões do lockfile, o TestClient de Starlette emite um aviso de depreciação sobre
o uso de HTTPX. A suíte continua executando; o aviso não é suprimido. Não foi adicionada
uma biblioteca alternativa fora das dependências aprovadas.

Os testes do Analyzer verificam seleção temporal, referências, hipóteses condicionais,
ausência de diagnósticos por segmento, separação da simulação, comandos em descrições,
limites, cancelamento e falhas do provedor. O frontend testa a invalidação da análise
e a apresentação de descrições externas como texto. O teste de integração inclui o
endpoint real de análise pelo proxy, com e sem evidências.

O módulo 4 está implementado com provedor simulado. A integração com um LLM real e o
módulo 5 (Message Generator) continuam fora desta implementação, aguardando uma próxima
etapa. A persistência permanece prevista para o final do MVP.
