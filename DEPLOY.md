# Hospedagem independente

O QuizEdu já está publicado no endereço do README. Estes passos são uma alternativa para manter o aplicativo em sua própria conta Cloudflare, com D1 para os dados e R2 para as imagens. Confira as quotas e condições dos planos gratuitos antes de habilitar recursos na sua conta.

**Contas permanentes:** o login do ChatGPT desta versão pertence ao gateway da hospedagem gerenciada. Uma publicação independente funciona com acesso temporário. Para oferecer login permanente, integre um provedor de identidade e valide as sessões no servidor antes de substituir `platformIdentity()`. Nunca aceite identidade a partir de cabeçalhos arbitrários do cliente. As rotas `/signin-with-chatgpt`, `/signout-with-chatgpt` e `/callback` não são implementadas neste Worker.

1. Crie uma conta Cloudflare e selecione os recursos gratuitos disponíveis. Não é necessário comprar domínio.
2. Clone este repositório, use Node 22.13+ e execute `pnpm install --frozen-lockfile`.
3. Execute `pnpm exec wrangler login`, `pnpm exec wrangler d1 create quizedu` e `pnpm exec wrangler r2 bucket create quizedu-imagens`.
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

6. Aplique cada migração uma única vez e na ordem:

```sh
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0000_wonderful_the_phantom.sql
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0001_melted_skaar.sql
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0002_empty_edwin_jarvis.sql
```

7. Publique: `pnpm exec wrangler deploy --config wrangler.deploy.json`. A Cloudflare retorna uma URL HTTPS `workers.dev`. O QR code e os links compartilhados passam a usar essa origem.
8. Adapte a interface do login para seu provedor, ou apresente apenas o acesso temporário até concluir essa integração.
9. Guarde sua configuração e consulte o painel de métricas para acompanhar as quotas.

O ID do banco identifica um recurso, não uma senha. Tokens de acesso ficam somente no login local/segredos da plataforma. Não coloque tokens no repositório. O bucket de imagens não precisa ser público: o aplicativo entrega as imagens pelas URLs `/api/media/<id>`.

Para atualizar, compile novamente, aplique apenas novas migrações e repita a publicação. Preserve o banco e o bucket existentes para manter os quizzes, relatórios e imagens.
