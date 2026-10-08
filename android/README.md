# QuizEdu Android

Cliente **nativo**, sem WebView, em Kotlin e Jetpack Compose. Compartilha salas, pontuação, biblioteca, imagens e apresentações com o site. A autorização da conta acontece no navegador do usuário e concede uma sessão revogável ao aparelho; o app não recebe a senha do ChatGPT.

## Instalar

Baixe `QuizEdu-Android-1.2.1.apk` na [última versão do GitHub Releases](https://github.com/emanoelb5-lgtm/QuizEdu/releases/latest), abra o arquivo no Android e permita a instalação pelo navegador ou gerenciador de arquivos quando solicitado. Requer Android 7.0 ou superior. No app, escolha **Aluno** para entrar por código/QR code ou **Professor** para vincular a conta, editar aulas e controlar a apresentação no computador.

## Compilar no GitHub

O workflow [.github/workflows/android.yml](../.github/workflows/android.yml) roda em pushes de alterações Android para main e pode ser iniciado em **Actions → QuizEdu Android → Run workflow**. Executa testes JVM, lint, testes de interface em emulador Android 15, compila o APK de distribuição, verifica o certificado e publica no GitHub Releases. Pull requests só compilam/testam.

Ferramentas fixadas: Java 17, Gradle 8.13, AGP 8.11.1, Kotlin 2.1.21, Compose BOM 2025.05.01, compile/target SDK 36 e min SDK 24. As actions são fixadas por commit.

Para compilar localmente com Android Studio, abra esta pasta e sincronize o Gradle. Para CLI: instale Gradle 8.13 e Android SDK 36, então execute `gradle :app:assembleDebug`. Você pode gerar o wrapper com `gradle wrapper --gradle-version 8.13`.

## Autorização e assinatura

- Credenciais e cookies separados para aluno/professor, cifrados com AES-GCM e chave do Android Keystore. Backup de dados do app está desativado.
- Alunos usam a sessão do participante existente; o servidor continua sendo a autoridade da pontuação e da primeira resposta.
- Professores autorizam um desafio de 256 bits pelo site. Só o aparelho que conhece o segredo conclui o vínculo. Sessão de até 30 dias, limitada também à validade do acesso temporário. Revogação em “Aparelhos vinculados”.
- Aprovação exige a conta do navegador e proteção de origem. Android nunca envia cabeçalhos de identidade da hospedagem.
- O certificado de distribuição fica em um segredo de runtime da hospedagem. Actions obtém a assinatura por OIDC; o servidor valida assinatura RSA do GitHub, emissor, audiência, IDs imutáveis do repositório/dono, branch main, workflow exato, evento e validade. Nenhuma chave privada entra no repositório, release, cache ou artifact. O runner mascara as credenciais e apaga o arquivo ao final.
- A assinatura depende do segredo ANDROID_SIGNING_BUNDLE do mesmo site. Preserve esse segredo para manter atualizações compatíveis. O bundle nunca deve ser publicado em logs ou artifacts.
- As identidades antigas e atuais do GitHub são aceitas. Quando `job_workflow_ref` está presente, precisa apontar para este mesmo workflow em main; outro workflow, repositório ou branch é recusado.

## Estado e edição

JSON dos slides é o mesmo do editor web, preservando objetos/atributos ao editar outras partes da aula. Rascunhos são gravados atomicamente por conta em armazenamento interno. Salvar usa revisão e writeId; respostas de salvamento perdidas são reconciliadas antes de repetir. Conflitos mostram erro e preservam a cópia local; o usuário pode exportar, duplicar ou abrir a versão da conta.

Salas guardam uma cópia da aula na abertura, como no site. Editar a biblioteca não altera uma rodada já aberta. Polling para ao colocar o app em segundo plano; reconexão conserva cookies, sala e participante. Vídeos do YouTube abrem no aplicativo/navegador externo.
