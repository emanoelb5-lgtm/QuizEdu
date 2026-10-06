# Hospedagem independente no plano gratuito

A primeira versão já possui o endereço informado no README. Estes passos são uma alternativa para quem quiser manter a hospedagem na própria conta Cloudflare.

1. Crie uma conta Cloudflare e mantenha o plano **Workers Free**. Não é necessário comprar domínio.
2. Clone este repositório, use Node 22.13+ e execute `pnpm install --frozen-lockfile`.
3. Execute `pnpm exec wrangler login` e `pnpm exec wrangler d1 create quizedu`.
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
  }]
}
```

6. Aplique cada migração, uma única vez e na ordem:

```sh
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0000_wonderful_the_phantom.sql
pnpm exec wrangler d1 execute DB --remote --config wrangler.deploy.json --file drizzle/0001_melted_skaar.sql
```

7. Publique: `pnpm exec wrangler deploy --config wrangler.deploy.json`. A Cloudflare retorna uma URL HTTPS `workers.dev` gratuita. O QR code passa a usar essa URL automaticamente.
8. Guarde a configuração da sua hospedagem e consulte o painel de métricas para acompanhar as quotas do plano gratuito.

O ID do banco identifica um recurso, não uma senha. Tokens de acesso ficam somente no login local/segredos da plataforma. Não coloque tokens no repositório.

Para atualizar, compile novamente, aplique apenas novas migrações e repita a publicação. O banco preserva as salas e quizzes existentes.
