# Hospedagem independente

O Prativerso (repositório histórico QuizEdu) pode operar em uma conta Cloudflare própria, usando Workers para site e API, D1 para registros e R2 para arquivos de imagem. Não aponte o Android nem o domínio definitivo para o novo Worker antes de concluir os testes e a importação dos dados. Confira as quotas e condições dos planos gratuitos antes de habilitar recursos.

**Atenção aos dados atuais:** criar o D1 vazio não migra aulas, professores, respostas nem imagens da hospedagem do ChatGPT. Faça exportação e restauração verificáveis dos dados e objetos do R2 da origem antes da troca. Não invente sessão de usuário a partir de cookies ou cabeçalhos transportados do ambiente antigo.\n\n**Contas permanentes:** o login do ChatGPT desta versão pertence ao gateway da hospedagem gerenciada. Uma publicação independente funciona com acesso temporário. Para oferecer login permanente, integre um provedor de identidade e valide as sessões no servidor antes de substituir `platformIdentity()`. Nunca aceite identidade a partir de cabeçalhos arbitrários do cliente. As rotas `/signin-with-chatgpt`, `/signout-with-chatgpt` e `/callback` não são implementadas neste Worker.

1. Crie uma conta Cloudflare e selecione os recursos gratuitos disponíveis. Não é necessário comprar domínio.
2. Clone este repositório, use Node 22.18+ (recomendado para a CLI `cf`) e execute `pnpm install --frozen-lockfile`. O repositório usa Next.js 16 + vinext e não exige Laravel/PHP.
3. No painel Cloudflare, crie ou selecione o banco D1 `prativerso` e habilite o R2 antes de tentar criar o bucket `prativerso-imagens`. A assinatura R2 precisa estar habilitada na conta, mesmo quando o uso permanece na franquia mensal gratuita. **Em 07/11/2026, o D1 `prativerso` já foi criado e todas as cinco migrações abaixo foram aplicadas a ele. Não execute as migrações novamente nesse mesmo banco.**
4. Guarde o `database_id` retornado e rode `pnpm build`.
5. Crie um `wrangler.deploy.json` na raiz com seu ID real:

```json
{
  "name": "quizedu",
  "main": "dist/server/index.js",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "no_bundle": true,
  "find_additional_modules": true,
  "rules": [{"type": "ESModule", "globs": ["**/*.js", "**/*.mjs"]}],
  "assets": {"directory": "dist/client"},
  "d1_databases": [{
    "binding": "DB",
    "database_name": "quizedu",
    "database_id": "SUBSTITUA-PELO-ID-REAL"
  }],
  "r2_buckets": [{
    "binding": "BUCKET",
    "bucket_name": "quizedu-imagens"
  }]
}
```

6. Em um banco **novo e vazio**, aplique cada migração uma única vez e na ordem. No banco `prativerso` já provisionado, esta etapa está concluída:

```sh
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0000_wonderful_the_phantom.sql
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0001_melted_skaar.sql
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0002_empty_edwin_jarvis.sql\npnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0003_short_medusa.sql\npnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0004_wild_susan_delgado.sql
```

7. Antes da primeira publicação, conecte o repositório GitHub `emanoelb5-lgtm/QuizEdu` à Cloudflare em **Workers & Pages → Create application → GitHub**, autorizando o aplicativo Cloudflare no GitHub se solicitado. Configure os bindings `DB` e `BUCKET`, os comandos de instalação/build e a publicação em ambiente de testes. O build próprio do projeto deve ser validado antes de optar pela autoconfiguração. Como alternativa à integração direta, publique localmente: `pnpm exec wrangler deploy --config wrangler.deploy.json`. A Cloudflare retorna uma URL HTTPS `workers.dev`. O QR code e os links compartilhados passam a usar essa origem.
8. A conta permanente do ChatGPT NÃO funciona automaticamente no novo domínio. Implemente e teste um provedor de identidade (por exemplo, Google OAuth) com validação no servidor, ou mantenha apenas o modo temporário. Não permita que cabeçalhos `oai-authenticated-user-*` vindos da internet atribuam identidade.\n9. Só depois de validar todas as funções, migre dados e imagens, e configure o novo domínio. Para gerar um APK/AAB de teste com a nova URL, defina `PRATIVERSO_SITE_URL=https://SEU-WORKER.workers.dev` no ambiente de compilação Android. Sem essa variável, o app mantém a URL atual da hospedagem ChatGPT.
10. Guarde sua configuração, ative logs e consulte o painel de métricas para acompanhar as quotas. Verifique: entrar/sair, salvar aula, imagens, sala e QR code, respostas, ranking, controle remoto, sincronização Android e retomada após desconexão.

O ID do banco identifica um recurso, não uma senha. Tokens de acesso ficam somente no login local/segredos da plataforma. Não coloque tokens no repositório. O bucket de imagens não precisa ser público: o aplicativo entrega as imagens pelas URLs `/api/media/<id>`.

Para atualizar, compile novamente, aplique apenas novas migrações e repita a publicação. Preserve o banco e o bucket existentes para manter os quizzes, relatórios e imagens.
