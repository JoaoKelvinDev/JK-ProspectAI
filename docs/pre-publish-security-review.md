# Revisão antes da publicação no GitHub

Data: 25/10/2026. Escopo: código local dos módulos Discovery, Website Inspector,
Lead Scoring e primeira interface React, incluindo testes, documentação e lockfiles.

## Resultado

Não foram identificados segredos ou dados reais de clientes nos arquivos revisados,
nem vulnerabilidades conhecidas nas consultas de dependências realizadas nesta data.
Não foi identificado impedimento para versionar o estado atual do código no GitHub.
Isso não constitui garantia de ausência de vulnerabilidades ou autorização para deploy.

Nenhum repositório remoto foi criado e nenhum arquivo foi enviado ao GitHub.

## Verificações de conteúdo

- Gitleaks 8.30.1, obtido do projeto oficial com SHA-256 conferido contra o arquivo de
  checksums da mesma versão: nenhuma ocorrência nos arquivos candidatos à publicação.
  A verificação do checksum confere integridade; não é uma verificação de assinatura.
- Inventário final completo: 80 arquivos publicáveis, incluindo arquivos ocultos,
  frontend, backend, testes, lockfiles e a documentação desta revisão. Nenhuma ocorrência
  de segredo também na varredura separada do build frontend gerado nesta revisão.
- Inspeção complementar de padrões de tokens, chaves privadas, credenciais, caminhos
  pessoais e arquivos de configuração: nenhum segredo identificado. O único arquivo
  com nome de configuração de ambiente foi `backend/.env.example`, contendo comentários.
- As URLs com usuário e senha em testes são exemplos fictícios usados para verificar
  rejeição de credenciais embutidas. Não representam contas reais.
- O catálogo e as fixtures contêm estabelecimentos fictícios e identificados como
  simulados. Não foram encontrados bancos locais ou exportações de contatos no código.
- O lockfile npm usa `registry.npmjs.org`, sem credenciais nas URLs. O lockfile Python
  usa PyPI e seus arquivos de distribuição, com hashes das versões resolvidas.
- O cliente React não contém chave de API, autenticação, armazenamento persistente
  de registros ou renderização de HTML externo. Links externos usam HTTP/HTTPS e
  `noopener noreferrer`. O backend não retorna o HTML integral das páginas inspecionadas.

## Proteções ajustadas

O `.gitignore` foi ampliado para excluir configurações locais, credenciais e chaves,
dados, exportações, bancos locais, backups, logs, capturas HAR e artefatos de auditoria.
Ambientes virtuais, dependências instaladas, builds e caches continuam excluídos.
O exemplo de ambiente sem credenciais e ambos os lockfiles continuam publicáveis.

A aplicação das regras foi validada usando o próprio Git: 29 casos de arquivos
sensíveis/gerados ignorados e 9 arquivos essenciais preservados. Não foi necessário
inicializar um repositório na raiz para realizar essa verificação.

Havia um repositório Git vazio em `frontend/.git`, sem commits, arquivos rastreados ou
remotos. Ele foi movido para `.security-audit/frontend-git-backup`, mantendo uma cópia
local ignorada. Isso evita que o frontend seja tratado como outro repositório ao
versionar o monorepo. Nenhuma configuração global do Git foi alterada.

## Dependências e qualidade

| Verificação | Resultado |
| --- | --- |
| `npm audit --json`, incluindo dependências de desenvolvimento | Zero vulnerabilidades reportadas |
| API JSON oficial do PyPI para as 24 versões de distribuição em `backend/uv.lock` | Zero vulnerabilidades reportadas; nenhuma consulta falhou |
| Testes Python | 250 aprovados |
| Testes React/TypeScript | 54 aprovados |
| Ruff: lint e formatação | Aprovados |
| Prettier | Aprovado |
| TypeScript e build Vite | Aprovados |

A consulta Python utiliza o campo `vulnerabilities` de cada versão no PyPI; não foi
executado `pip-audit`. Esses resultados dependem da cobertura e da atualização das
bases consultadas e não analisam automaticamente o código de todas as dependências.
Nenhuma dependência da aplicação foi adicionada ou atualizada nesta revisão.

Há um aviso conhecido de depreciação do TestClient Starlette com HTTPX, sem falha de
testes. Não foi suprimido nem tratado como uma vulnerabilidade.

## Limites do parecer

- Não havia histórico Git na raiz, e o repositório interno vazio tinha zero commits.
  Não há histórico anterior local para auditar; não foram inspecionados repositórios
  remotos ou versões que possam ter sido publicadas fora desta pasta.
- As regras de ignore não reconhecem todo segredo possível. Um arquivo novo com outro
  nome, ou uma alteração futura, exige nova revisão antes do commit.
- Dados informados manualmente permanecem em memória nesta versão. Não inclua dados
  reais em fixtures, exemplos, screenshots ou arquivos adicionados posteriormente.
- Esta revisão não foi um pentest nem uma auditoria de infraestrutura.

## Código publicado e aplicação exposta

Os servidores documentados escutam somente em `127.0.0.1`. O Inspector valida destinos
públicos, DNS e redirecionamentos, preserva a validação TLS e limita tempo e conteúdo.
Esses comportamentos são cobertos por testes sem acesso externo não simulado.

A versão atual não implementa autenticação, autorização, limites de requisições por
usuário ou controles de produção. Antes de expor os endpoints na internet, será
necessária uma revisão específica de acesso, consumo de recursos, TLS, logs e saída
de rede. Publicar o código no GitHub não disponibiliza esses servidores na internet.

Credenciais futuras devem ficar no backend ou no ambiente do serviço que as utiliza.
Variáveis `VITE_*` entram no código do navegador e devem ser tratadas como públicas.
`JK_BACKEND_URL` é uma configuração do processo Vite, sem credencial no valor padrão.

## Procedimento recomendado para o primeiro envio

Use o Git a partir da raiz `jk-prospect-ai`, com um único repositório para backend e
frontend. Primeiro confira a seleção:

```powershell
git init
git add --dry-run .
```

A lista deve conter código, documentação, testes, arquivos de configuração sem
segredos e lockfiles. Não deve conter `.env`, `.venv`, `node_modules`, `dist`, caches,
dados privados ou as pastas `.security-audit` e `.audit-tools`.

Depois de conferir, prepare e examine o primeiro commit:

```powershell
git add .
git diff --cached --name-only
git diff --cached --check
git diff --cached
```

Só então faça o commit e conecte o remoto escolhido. Esses comandos são orientações;
nesta revisão não foram executados `git init` na raiz, staging, commit ou push.
Prefira esse fluxo a enviar um ZIP da pasta inteira: arquivos ignorados continuam
existindo no computador e podem entrar em um arquivo compactado.

Quando disponíveis no repositório GitHub, habilite secret scanning e push protection.
Se uma credencial for publicada futuramente, revogue ou rotacione-a; apagar o arquivo
do último commit não a remove do histórico.

## Referências

- [Gitleaks: código e documentação oficiais](https://github.com/gitleaks/gitleaks).
- [PyPI: API JSON e vulnerabilidades por versão](https://docs.pypi.org/api/json/).
- [Vite: exposição de variáveis de ambiente no cliente](https://vite.dev/guide/env-and-mode).
- [GitHub: secret scanning e tratamento de credenciais expostas](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning).
