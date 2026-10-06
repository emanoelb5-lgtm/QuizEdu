# QuizEdu

Site de quiz ao vivo para educadores, em português, com uma tela para o professor e outra para cada participante.

**Abrir o site:** https://quizedu-emanuel.emanuelb5.chatgpt.site

## Como usar

1. Clique em **Criar quiz** e escolha um nome para seu acesso temporário.
2. Escreva as perguntas, preencha de duas a quatro alternativas, marque a correta e configure o tempo.
3. Clique em **Salvar quiz** e depois **Abrir sala**.
4. Projete a tela da sala. Os alunos leem o QR code ou digitam o código de seis números na página inicial.
5. Cada participante escolhe um nome e um avatar. O professor aguarda a turma e clica em **Iniciar quiz**.
6. A pergunta aparece no telão e nos celulares. As respostas são enviadas ao tocar na alternativa.
7. Ao esgotar o tempo ou todos responderem, aparecem a resposta correta e a classificação acumulada.
8. O professor decide quando avançar. Ao final, o primeiro e o segundo lugares recebem destaque e os demais aparecem na classificação.

O quiz de exemplo **Brasil e natureza** contém cinco perguntas que podem ser adaptadas. O editor permite ordenar, duplicar e excluir perguntas, guardar uma cópia em JSON e importar uma cópia exportada.

## Regras

- Acerto: **500 pontos + até 500 pontos pela rapidez**.
- Fórmula: `500 + floor(500 * (1 - tempo_de_resposta / tempo_da_pergunta))`. Erros e ausência de resposta valem zero.
- O servidor mede o tempo. O celular não informa seus próprios pontos, se acertou ou quanto demorou.
- Cada participante pode enviar **uma única resposta por pergunta**. Reenvios da mesma resposta são idempotentes.
- As respostas corretas e as explicações não são enviadas aos participantes durante a pergunta.
- Classificação por pontos; empate resolvido por mais acertos, menor soma dos tempos nas respostas corretas e ordem de entrada.
- Até **100 participantes** por sala, **50 perguntas** por quiz e **50 quizzes** por acesso temporário.
- Há uma contagem de preparação de três segundos antes de cada pergunta. A turma fica fechada depois do início.
- A sala dura 24 horas. O professor pode encerrar uma rodada antecipadamente ou encerrar a sala.
- O acesso temporário dura 30 dias no navegador utilizado. Os quizzes são guardados no servidor; limpar os cookies ou trocar de aparelho perde a chave desse acesso. **Exporte seus quizzes para conservar uma cópia.**
- Esta versão oferece acesso temporário, sem senha. Não inclui contas permanentes por e-mail nem recuperação de senha.
- Professor e alunos precisam de internet. As telas se recuperam ao recarregar a página com o mesmo navegador e cookies.

## Arquitetura

- React 19 + TypeScript + Vinext/Vite, com componentes acessíveis Radix/Shadcn.
- Cloudflare Worker para as regras do jogo e APIs; Cloudflare D1/SQLite para quizzes, salas, participantes e respostas.
- QR code gerado no próprio aplicativo (`qrcode`), sem enviar os dados da sala a um serviço de terceiros.
- Atualização leve por consultas HTTP: a sala envia atualizações compactas quando a fase não mudou; o placar completo é calculado nas mudanças de etapa. O servidor decide quando a rodada termina.
- Sessões com chaves aleatórias de 256 bits, cookies HttpOnly/SameSite e somente o hash das chaves no banco. O professor só pode ler/editar seus quizzes e conduzir suas salas.
- Salas possuem uma cópia imutável das perguntas. Editar/excluir o quiz original não altera uma partida em andamento.
- Índices, contadores por triggers e uma restrição única por resposta protegem a pontuação e evitam consultas amplas a cada atualização.
- Nenhuma chave de API paga ou serviço de IA é necessário.

## Desenvolvimento local

Requisitos: Node.js 22.13 ou mais recente e pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

O build gera `dist/server/index.js` e os arquivos públicos em `dist/client/`.

Antes de executar a interface local, aplique **somente as migrações ainda não aplicadas** ao banco local:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wonderful_the_phantom.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_melted_skaar.sql
pnpm dev
```

As migrações em `drizzle/` são versionadas. Não edite uma migração aplicada; gere a próxima ao mudar o esquema. Os triggers complementares de contagem e revisão da turma estão registrados nas migrações SQL.

## Verificação

```sh
pnpm exec tsc --noEmit
pnpm build
node tests/integration.mjs
```

O teste de integração executa o Worker de produção contra um banco D1 descartável. Verifica acesso temporário, isolamento entre professores, validação das perguntas, entrada e nomes repetidos, remoção na sala de espera, privacidade das respostas, início e relógio, respostas duplicadas e simultâneas, acertos mais rápidos, soma de pontos, tempo esgotado, participantes sem resposta, classificação final, reconexão, limite simultâneo de 100 participantes, cópia imutável da sala e proteção contra envio de outra origem.

## Operação gratuita

O código não utiliza serviços pagos. A versão publicada usa hospedagem gerenciada, com D1 provisionado pela plataforma. Também é possível hospedar este Worker em sua própria conta **Cloudflare Workers Free + D1 Free**.

Na documentação consultada em 06/10/2026, o plano Workers Free inclui 100.000 requisições por dia; o D1 Free inclui 5 milhões de linhas lidas, 100.000 linhas escritas por dia e 5 GB de armazenamento total. Esses são os limites da conta Cloudflare independente, não uma promessa de uso ilimitado ou de quotas idênticas na hospedagem gerenciada.

Fontes oficiais: [Workers](https://developers.cloudflare.com/workers/platform/pricing/) · [D1](https://developers.cloudflare.com/d1/platform/pricing/).

O plano gratuito interrompe operações ao alcançar suas quotas. Não é preciso contratar um plano pago para iniciar. A capacidade do aplicativo por sala e as quotas diárias da hospedagem são limites diferentes.

Para hospedagem independente, consulte [DEPLOY.md](./DEPLOY.md).
