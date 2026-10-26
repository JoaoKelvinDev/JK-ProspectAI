# Revisão da primeira versão do frontend

Data: 25/10/2026.

## Situação

| Trabalho solicitado | Situação |
| --- | --- |
| Aparência e navegação em desktop e celular | O usuário informou ter visualizado a primeira versão em desktop e mobile. A inspeção visual pelo agente, incluindo o novo painel do módulo 4, continua pendente de navegador conectado. |
| Fluxo pesquisar → selecionar → inspecionar → registrar evidência → pontuar → analisar | Aprovado em testes de interface JSDOM e integração HTTP com FastAPI real. |
| Correções de usabilidade identificadas | Implementadas e cobertas por regressão; verificação visual final pendente. |

Após essa revisão inicial, o usuário informou que viu a interface em desktop e mobile
e autorizou o módulo 4. O painel de análise simulada foi acrescentado, com contexto,
hipóteses, oportunidades, soluções e fontes. Essa autorização não foi interpretada como
verificação visual dos estados ou tamanhos específicos listados ao final deste documento.

## Problemas encontrados e correções

- O painel de detalhes ficava abaixo da lista no celular sem uma navegação direta.
  Selecionar explicitamente um registro agora leva o foco ao painel no layout empilhado;
  há retorno ao botão do registro selecionado. Em desktop, selecionar não desloca a página.
- As colunas exigiam rolagem lateral em telas pequenas. As linhas passam a usar disposição
  de cartões, preservando os papéis acessíveis de tabela, os rótulos e os controles.
  A navegação, os indicadores e os nomes longos receberam ajustes para larguras menores.
- O fechamento do diálogo não distinguia seu espaço interno do fundo externo.
  O clique interno não o fecha. O foco é restaurado e a rolagem da página é preservada.
- O filtro textual de uma pesquisa podia ocultar registros da próxima. Novas pesquisas
  e cadastros manuais reiniciam esse filtro, sem remover os cadastros manuais da sessão.
- As fontes das evidências comerciais não apareciam junto de cada observação.
  Origem, link e data estão disponíveis; revisões manuais permitem expandir as verificações.
- Erros de pontuação apareciam afastados da ação. Agora ficam na seção afetada, e falhas
  disparam nova verificação da conexão.
- Quatro combinações principais de texto tinham contraste abaixo de 4,5:1. As cores
  foram ajustadas e oito combinações declaradas no CSS receberam testes de contraste.
  Isso não representa uma auditoria completa de acessibilidade ou de renderização.
- O servidor que estava aberto na porta 8000 ainda executava somente a Etapa 1.
  A identidade foi conferida pelo título da API, comando Uvicorn e porta antes de reiniciar
  exclusivamente esse backend do projeto com o código atual. A interface agora verifica
  também as rotas do OpenAPI e sinaliza processos antigos como backend desatualizado.

A referência para os testes de contraste é o [critério 1.4.3 da WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Os testes calculam as cores declaradas; não medem pixels de uma captura de tela.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Frontend: Vitest e Testing Library | 62 testes aprovados em 7 arquivos, incluindo o módulo 4. |
| Backend: Pytest | 296 testes aprovados; permanece o aviso conhecido de depreciação Starlette/HTTPX. |
| TypeScript estrito e build Vite | Aprovados. |
| Formatação Prettier | Aprovada. |
| Integração HTTP do build com FastAPI real | Aprovada em servidores temporários isolados, encerrados ao terminar. |
| Frontend 5173 com backend 8000 em execução | Pesquisa filtrada, inspeção simulada e scores 5/45 aprovados após atualizar a execução do backend. |

Os cenários incluem filtros, lista vazia, fontes simuladas e manuais, cancelamento,
respostas tardias, contratos inesperados, duplicação, datas futuras, foco programático,
retorno aos resultados, contexto de erro e detecção de backend antigo.

O teste de integração também verifica:

- Inspeção de registro simulado com resultado `not_checked`.
- Score inicial 5, score 45 com uma necessidade e score 100 com contexto completo.
- Retorno a 5 após retirar as evidências da solicitação, sem estado residual no servidor.
- Descarte de evidências antigas ou futuras.
- Rejeição de revisão de ausência baseada em duas URLs da mesma origem.
- Erro `422` para filtros inválidos e bloqueio de URL interna pelo Inspector.
- Análise simulada sem evidências, com necessidades e com revisão manual de site;
  referências da mesma necessidade, descarte temporal e rejeição de escolha de provedor.

Os testes do novo painel também verificam a invalidação da análise após alteração de
evidências ou inspeção, preservação do score, cancelamento por nova pesquisa, erros e
renderização de HTML externo como texto. Um alerta duplicado encontrado nos testes foi
corrigido para que falhas de análise apareçam somente junto da ação correspondente.

Os dados usados nesses testes são fictícios. Nenhuma fonte externa foi consultada.

## Pendências de navegador real

A ferramenta de navegação retornou `browsers: []`, inclusive na nova consulta após a
implementação do módulo 4. Na revisão inicial, a tentativa de criar o navegador interno
também informou indisponibilidade. Não há capturas ou aprovação visual pelo agente.

Assim que houver navegador conectado, verificar:

- Desktop: 1366×768 e 1920×1080, com estados inicial, pesquisa, detalhes e pontuação.
- Celular: 320×640 e 375×812, com cartões, navegação de ida/volta e nomes longos.
- Formulários e diálogos: área visível, foco inicial, Tab, Shift+Tab e Escape.
- Mensagens de erro, campos inválidos, lista vazia e indicadores de conexão.
- Layout com necessidade, atividade e revisão manual registradas e critérios expandidos.
- Novo painel de análise com sugestões, fatos expandidos e descrições longas das fontes.
- Ausência de cortes, sobreposições e rolagem horizontal indevida na página.

JSDOM valida os eventos e o estado, mas não substitui essa inspeção visual nem o
comportamento nativo completo de foco do navegador.
