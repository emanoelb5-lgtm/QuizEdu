# Prativerso na Cloudflare

A publicação independente usa Cloudflare Pages com um Worker ES Module em modo avançado, banco D1 e arquivos R2. O projeto é separado do site institucional B5 Soluções.

- Domínio: https://prativerso.b5solucoes.online
- Repositório: emanoelb5-lgtm/QuizEdu, branch main.
- Projeto Pages: prativerso.
- Banco D1: prativerso (`6687dd06-6270-4826-91df-f02a2e2f912c`), binding `DB`.
- Bucket R2: prativerso-imagens, binding `BUCKET`.
- Node: 22.16.0 ou superior. Gerenciador: pnpm 11.25.0, conforme lockfile.
- Comando de build: `pnpm run build:cloudflare`.
- Diretório publicado: `dist/pages`.
- Compatibilidade: 2026-05-15, flag `nodejs_compat`.

O painel Cloudflare mantém os bindings. Não há token Cloudflare no repositório. A integração Git da conta retornou o erro 8000011 na criação do projeto; esta primeira publicação foi feita por upload direto. A publicação automática a partir do GitHub requer configurar o token Cloudflare em um workflow de CI. Não configure dados de produção nos deployments de preview.

## Atualizações e migrações

1. Instale com `pnpm install --frozen-lockfile`.
2. Aplique uma única vez as novas migrações SQL em `drizzle/`, na ordem numérica, pelo D1 da conta Cloudflare. As migrações 0000 a 0008 são necessárias nesta versão. Preserve o banco existente e nunca reaplique as migrações antigas.
3. Valide `pnpm typecheck`, `pnpm build:cloudflare`, `pnpm test` e `pnpm test:accounts`.
4. Envie a versão validada para main e publique a saída `dist/pages` no projeto Pages prativerso. Até configurar CI, o push sozinho não publica o site.

`dist/pages/_worker.js` contém o servidor e não deve ser entregue como arquivo estático. `_routes.json` permite servir imagens e scripts estáticos sem invocar o Worker. Todas as rotas dinâmicas e APIs continuam no Worker, com D1/R2.

## Login próprio

Educadores criam conta em `/entrar`, com nome, e-mail e senha. A senha usa PBKDF2-SHA256 com sal individual; sessões usam tokens aleatórios, somente seus resumos ficam no banco, e cookies HttpOnly/Secure/SameSite. Há limites de tentativas por IP e conta. Nenhum cabeçalho de identidade fornecido pelo visitante concede acesso.

O cadastro entrega um código de recuperação, exibido somente uma vez. Guarde-o; ele permite redefinir a senha sem depender de um serviço de e-mail. Recuperação e alteração de senha trocam esse código e revogam sessões e aparelhos anteriores. `/conta` permite alterar a senha. A exclusão remove também a conta e suas sessões.

O Android 1.7.0 usa a nova origem. O vínculo continua pelo navegador, usando o login próprio e um token revogável no aparelho. Alunos continuam entrando por QR/código, sem conta. O acesso temporário para experimentar continua disponível.

Os dados gravados no banco da hospedagem anterior não foram importados: permanecem disponíveis no site anterior. As funcionalidades, exemplos e aulas que fazem parte do código foram preservados.

## Assinatura Android

A chave de assinatura existente permanece protegida no serviço de assinatura já configurado para o GitHub Actions. O aplicativo instalado e o login operam no novo domínio. Preserve a chave original para que atualizações continuem compatíveis. A compilação nunca deve gerar uma chave diferente silenciosamente.
