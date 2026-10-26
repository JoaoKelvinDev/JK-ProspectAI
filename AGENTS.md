# AGENTS.md — JK Prospect AI

## 1. Identidade do projeto

**Nome:** JK Prospect AI  
**Tipo:** Aplicação web de prospecção comercial assistida por inteligência artificial  
**Desenvolvedor:** JK Dev  
**Status:** Planejamento e início do MVP  
**Arquitetura:** Monorepo com FastAPI e React  
**Persistência:** Adiada para a última etapa do MVP

### Objetivo principal

Desenvolver uma ferramenta capaz de encontrar pequenos negócios, comércios e prestadores de serviços, analisar sua presença digital, identificar oportunidades de desenvolvimento de sites, sistemas e automações, e gerar mensagens comerciais personalizadas.

O sistema será utilizado inicialmente para prospectar clientes freelancer para a JK Dev.

O projeto deve ser desenvolvido de forma modular, escalável e testável, priorizando funcionalidades isoladas antes da integração completa.

## 2. Contexto comercial

A JK Dev oferece soluções tecnológicas para pequenos negócios, incluindo:

- Sites institucionais e comerciais.
- Catálogos digitais.
- Sistemas de pedidos.
- Integrações com WhatsApp.
- Sistemas de agendamento.
- APIs e integrações.
- Automações de processos.
- Sistemas web personalizados.

O JK Prospect AI deve identificar empresas que possam se beneficiar dessas soluções.

### Público-alvo

- Açaiterias.
- Restaurantes.
- Lanchonetes.
- Bares.
- Barbearias.
- Salões de beleza.
- Lojas de roupas.
- Mercadinhos.
- Pequenos comércios.
- Prestadores de serviços.
- Outros estabelecimentos comerciais.

### Configuração inicial

- Cidade: Teresina.
- Estado: Piauí.
- País: Brasil.
- Segmentos: todos os segmentos suportados.
- Filtro principal: negócios sem site identificado após verificação.
- Modo operacional: revisão e aprovação humana.
- Expansão futura: outras cidades e estados brasileiros.

## 3. Fluxo funcional desejado

O sistema deverá seguir o fluxo:

1. Receber cidade, estado, segmento e quantidade máxima de resultados.
2. Pesquisar estabelecimentos por fontes autorizadas.
3. Coletar informações comerciais disponíveis e permitidas.
4. Normalizar e deduplicar os estabelecimentos.
5. Investigar a presença digital.
6. Verificar a existência de site oficial.
7. Identificar possíveis problemas ou oportunidades digitais.
8. Calcular uma pontuação comercial.
9. Gerar uma análise personalizada usando IA.
10. Produzir uma mensagem comercial contextualizada.
11. Apresentar a mensagem para revisão humana.
12. Permitir aprovar, editar ou rejeitar a mensagem.
13. Permitir contato somente por canais autorizados e quando os requisitos aplicáveis estiverem satisfeitos.
14. Futuramente, acompanhar respostas e negociações.

Nenhuma mensagem deve ser enviada automaticamente durante as primeiras etapas.

## 4. Stack tecnológica

### Backend
- Python 3.12 ou superior.
- FastAPI.
- Pydantic v2.
- HTTPX para integrações HTTP.
- Pytest para testes automatizados.
- Ruff para lint e formatação.

### Frontend
- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- TanStack Query, quando necessário.

### Inteligência artificial
- Integração modular com provedor de LLM.
- Saídas estruturadas e validadas com Pydantic.
- Prompts versionados.
- Separação entre fatos verificados, hipóteses e recomendações.

### Banco de dados
- Supabase com PostgreSQL, exclusivamente em uma etapa posterior.
- Não instalar nem configurar Supabase agora.
- Não implementar modelos SQLAlchemy, migrações ou tabelas nesta fase.

## 5. Arquitetura de desenvolvimento

Adotar uma arquitetura modular, com separação entre:

- API: endpoints HTTP.
- Schemas: contratos de entrada e saída.
- Services: regras de negócio.
- Providers: integrações com fontes externas.
- AI: análise e geração de mensagens.
- Tests: testes automatizados.

As regras de negócio não devem depender diretamente de FastAPI, React ou de um banco de dados.

Utilizar interfaces ou protocolos para integrações externas, permitindo substituir provedores simulados por provedores reais.

Evitar abstrações desnecessárias e arquiteturas complexas antes de existir uma necessidade concreta.

## 6. Módulos planejados

### Módulo 1 — Discovery

Responsável por descobrir estabelecimentos comerciais.

Entradas:
- Cidade.
- Estado.
- Segmentos.
- Limite de resultados.

Saídas:
- Nome do estabelecimento.
- Categoria.
- Localização.
- Site, quando informado pela fonte.
- Identificador da fonte, quando permitido.
- Origem dos dados.
- Estado de verificação do site.

Requisitos:
- Provedor simulado para testes.
- Interface para futuros provedores reais.
- Validação com Pydantic.
- Tratamento de erros.
- Deduplicação básica.
- Testes automatizados.

O módulo não deve concluir que uma empresa não possui site apenas porque o campo de site veio vazio.

### Módulo 2 — Website Inspector

Responsável por investigar a presença digital de um estabelecimento.

Estados possíveis:
- found: site identificado.
- not_found: site não localizado após as verificações definidas.
- inconclusive: evidências insuficientes.
- not_checked: verificação não executada.

O resultado deve conter evidências, origem, data da verificação e grau de confiança.

A ausência de resultado não representa prova definitiva de inexistência de site.

Implementar proteção contra SSRF, limites de tempo, tamanho de resposta e redirecionamentos.

### Módulo 3 — Lead Scoring

Responsável por classificar oportunidades comerciais.

Critérios iniciais:
- Presença ou ausência de site.
- Necessidade identificável de funcionalidades digitais.
- Atividade digital observável.
- Compatibilidade com os serviços da JK Dev.
- Qualidade e confiabilidade das informações.

O score será de 0 a 100.

As pontuações deverão ser calculadas com regras explícitas, justificáveis e versionadas.

Não atribuir pontuações arbitrárias apenas com base na opinião do LLM.

### Módulo 4 — AI Business Analyzer

Responsável por interpretar informações verificadas e sugerir soluções.

Exemplos:
- Cardápio digital para restaurante.
- Catálogo online para loja.
- Agendamento para barbearia.
- Sistema de pedidos para açaiteria.
- Site institucional para prestador de serviços.

A análise deverá separar:
- Fatos confirmados.
- Hipóteses.
- Oportunidades.
- Soluções sugeridas.
- Evidências utilizadas.

O agente não pode inventar informações sobre os estabelecimentos.

### Módulo 5 — Message Generator

Responsável por gerar mensagens comerciais personalizadas.

As mensagens deverão:
- Utilizar português brasileiro.
- Ser profissionais e naturais.
- Considerar o segmento comercial.
- Apresentar uma solução relevante.
- Evitar promessas de resultados não comprovados.
- Evitar afirmações não verificadas.
- Ser objetivas e adequadas ao canal.
- Permitir edição antes de aprovação.

O sistema não deverá enviar mensagens nessa etapa.

### Módulo 6 — Review Dashboard

Interface web para:
- Configurar pesquisas.
- Visualizar estabelecimentos.
- Consultar diagnósticos.
- Visualizar pontuações.
- Examinar evidências.
- Revisar mensagens.
- Aprovar, editar ou rejeitar rascunhos.

A interface será desenvolvida com React e TypeScript.

### Módulo 7 — Persistência

Implementar somente após a validação dos módulos anteriores.

Tecnologia prevista: Supabase/PostgreSQL.

Responsabilidades:
- Persistir estabelecimentos.
- Registrar pesquisas.
- Armazenar análises.
- Versionar mensagens.
- Registrar aprovações.
- Controlar permissões de contato.
- Armazenar histórico de operações.

A arquitetura anterior deverá permitir a integração da persistência sem reescrever a lógica central.

## 7. Regras para fontes externas

Priorizar integrações oficiais e autorizadas.

Google Places API poderá ser avaliada para descoberta de estabelecimentos, respeitando custos, cotas, atribuições e restrições de uso e armazenamento.

Instagram deverá ser integrado somente por meios autorizados e dentro das capacidades disponíveis da API.

Não implementar scraping massivo, evasão de bloqueios, coleta não autorizada ou automação de mensagens que viole regras das plataformas.

Não presumir que um telefone ou perfil público autoriza contato comercial automatizado.

Observar os requisitos aplicáveis da LGPD e as regras dos canais utilizados.

## 8. Regras de autonomia do Codex

O Codex deverá atuar como engenheiro de software responsável pela implementação incremental.

### Permitido

- Inspecionar arquivos existentes.
- Propor arquitetura.
- Criar código da etapa autorizada.
- Criar testes.
- Executar verificações locais de baixo risco.
- Refatorar código dentro do escopo aprovado.
- Documentar decisões técnicas.

### Exige aprovação explícita

- Iniciar uma nova etapa.
- Instalar dependências.
- Executar comandos destrutivos.
- Alterar arquivos fora do escopo autorizado.
- Configurar serviços externos.
- Utilizar APIs pagas.
- Criar ou modificar recursos em nuvem.
- Manipular credenciais.
- Enviar mensagens.
- Publicar aplicações.

### Proibido sem autorização específica

- Configurar banco de dados antecipadamente.
- Enviar mensagens automaticamente.
- Realizar disparos em massa.
- Fazer deploy.
- Executar migrações em produção.
- Excluir dados do usuário.
- Expor segredos em código, logs ou commits.

### Processo de trabalho

Antes de cada etapa:

1. Inspecionar o estado atual do projeto.
2. Explicar o objetivo da implementação.
3. Informar os arquivos que pretende criar ou modificar.
4. Informar as dependências necessárias.
5. Apontar riscos e decisões técnicas.
6. Aguardar autorização do desenvolvedor.

Depois da aprovação:

1. Implementar somente o escopo autorizado.
2. Executar os testes permitidos.
3. Informar arquivos alterados.
4. Apresentar resultados e eventuais falhas.
5. Sugerir o próximo passo.
6. Aguardar nova autorização.

Não interpretar a aprovação de uma etapa como autorização para todas as seguintes.

## 9. Padrões de qualidade

- Código modular e tipado.
- Type hints em Python.
- Modelos Pydantic para validação.
- Tratamento explícito de exceções.
- Separação entre configuração e código.
- Variáveis de ambiente para credenciais.
- Testes para comportamentos críticos.
- Sem valores sensíveis hardcoded.
- Sem dependências desnecessárias.
- Sem funcionalidades fictícias apresentadas como reais.
- Documentação atualizada conforme a implementação.

Não criar funcionalidades adicionais apenas por conveniência.

## 10. Primeira etapa autorizável

A primeira etapa será a implementação do backend mínimo e do módulo Discovery com provedor simulado.

Estrutura inicial:

```text
jk-prospect-ai/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── discovery.py
│   │   ├── schemas/
│   │   │   └── business.py
│   │   ├── services/
│   │   │   └── discovery_service.py
│   │   └── providers/
│   │       ├── base.py
│   │       └── mock_provider.py
│   ├── tests/
│   │   └── test_discovery.py
│   ├── pyproject.toml
│   └── .env.example
├── AGENTS.md
└── README.md
```

Endpoint inicial:

`POST /api/v1/discovery/search`

Entrada:

```json
{
  "city": "Teresina",
  "state": "PI",
  "segments": [],
  "max_results": 20
}
```

O array vazio de segmentos representa todos os segmentos suportados.

A resposta deverá retornar uma lista de estabelecimentos fictícios, devidamente identificados como dados simulados.

O endpoint deverá possuir validação, tratamento de erros e testes automatizados.

Nenhuma API externa, banco de dados ou sistema de envio deverá ser integrado nessa primeira etapa.

## 11. Critério de conclusão da primeira etapa

A etapa estará concluída quando:

- O FastAPI iniciar corretamente.
- O endpoint de saúde responder.
- O endpoint Discovery aceitar filtros válidos.
- As entradas inválidas forem rejeitadas adequadamente.
- O provedor simulado retornar dados consistentes.
- O serviço de descoberta estiver desacoplado do provedor.
- Os testes automatizados passarem.
- A documentação básica estiver disponível.

Ao concluir, apresentar um relatório técnico e aguardar autorização antes de desenvolver o Website Inspector.

## 12. Diretriz final

Priorizar desenvolvimento incremental, código verificável e controle humano.

Não antecipar a implementação de funcionalidades futuras.

O objetivo inicial não é entregar um produto completo, mas construir uma base funcional e confiável que possa evoluir progressivamente até se tornar uma ferramenta real de prospecção comercial.
