# Prativerso 1.6.0 — primeira publicação no Google Play

Guia de trabalho para o professor responsável pela publicação · Português do Brasil

**Situação deste rascunho:** a preparação técnica está em andamento. As opções de exclusão de conta, os termos, a denúncia de conteúdo, a moderação e os testes devem ser conferidos na versão final. Este documento não confirma aprovação do Google nem publicação na loja.

<!-- PÁGINA 1 — PREPARAR OS ARQUIVOS -->

## 1. O que você vai usar

Você já tem conta de desenvolvedor. Portanto, comece pelo cadastro do aplicativo no [Play Console](https://play.google.com/console/), sem criar outra conta nem pagar uma nova inscrição.

| Informação | Versão preparada |
|---|---|
| Nome público | Prativerso |
| Versão | 1.6.0 |
| Pacote Android | `br.com.quizedu.app` — preservar |
| Plataforma | Android, smartphones e tablets compatíveis |
| SDK de compilação e de destino | 36 — Android 16 |
| Categoria sugerida | Educação |
| Modelo desta publicação | Gratuito, sem anúncios, analytics ou compras |

### Arquivos do pacote de publicação

Arquivos preparados para esta versão:

| Arquivo | Para que serve |
|---|---|
| `Prativerso-Google-Play-1.6.0.aab` | Arquivo que você envia ao Google Play |
| `Prativerso-Android-1.6.0.apk` | Instalação direta para verificar o aplicativo no seu celular |
| Ícone da loja, 512 × 512 | Imagem de identificação na ficha |
| Recurso gráfico, 1024 × 500 | Imagem de destaque da ficha |
| Capturas reais do aplicativo | Mostrar as telas e funções aos usuários |
| Textos da ficha e este guia | Copiar os campos e seguir os passos |

**O AAB é para publicar. O APK é para instalar diretamente.** O Google gera os APKs adequados a cada aparelho a partir do AAB.

Antes do envio, conferir na entrega: pacote correto, versão 1.6.0, `versionCode` maior que o das versões anteriores, assinatura release e testes aprovados. Depois de cadastrar o pacote no Google Play, o nome do pacote é permanente.

### Preencher antes do envio

- [ ] **E-mail público de suporte:** ____________________
- [ ] **Responsável/desenvolvedor exibido na ficha:** ____________________
- [ ] **Contato de privacidade:** ____________________
URLs públicas da plataforma:

- Privacidade: https://quizedu-emanuel.emanuelb5.chatgpt.site/privacidade
- Exclusão de conta/dados: https://quizedu-emanuel.emanuelb5.chatgpt.site/excluir-conta
- Termos: https://quizedu-emanuel.emanuelb5.chatgpt.site/termos
- Contato: https://quizedu-emanuel.emanuelb5.chatgpt.site/contato

O e-mail público de suporte ainda precisa ser escolhido por você no Console. Use o nome de desenvolvedor verificado da sua conta. A página de privacidade identifica o Prativerso e oferece um formulário privado para consultas. Não há endereço de e-mail inventado nesta entrega.

**Fontes oficiais:** [AAB](https://developer.android.com/guide/app-bundle?hl=pt-br) · [API exigida](https://developer.android.com/google/play/requirements/target-sdk?hl=pt-br) · [Criar e configurar](https://support.google.com/googleplay/android-developer/answer/9859152?hl=pt-BR)

---

<!-- PÁGINA 2 — CONSOLE E ASSINATURA -->

## 2. Criar o aplicativo e preservar a assinatura

### No Play Console

1. Entre com a conta de desenvolvedor que você já possui.
2. Escolha **Criar app**.
3. Informe **Prativerso**, idioma **Português (Brasil)**, tipo **App** e distribuição **Gratuita**.
4. Informe o e-mail de suporte e aceite as declarações solicitadas.
5. Abra o painel do novo app e siga as tarefas de configuração.

### Atenção especial: instalações que já vieram pelo APK

O pacote `br.com.quizedu.app` já foi distribuído fora da loja. Para que uma instalação antiga possa receber atualização compatível pelo Google Play, é preciso preservar a assinatura do app, além do pacote e de um `versionCode` maior.

O AAB da entrega deve usar o certificado das versões anteriores. Contudo, **assinar o AAB com essa chave não faz o Google usar automaticamente a mesma chave nos APKs que ele distribui**. Configure isso no Play App Signing.

1. Localize **Assinatura de apps do Google Play / Play App Signing**.
2. Antes de um lançamento em teste aberto ou produção, escolha alterar a chave padrão e **fornecer uma cópia da sua chave de assinatura do app**.
3. Use a ferramenta **PEPK** e os parâmetros apresentados pelo seu próprio Console para importar a chave original de modo criptografado.
4. Confira se a impressão digital **SHA-256 da chave de assinatura do app** corresponde à do certificado dos APKs anteriores.
5. Depois, teste uma atualização sobre um APK antigo, preservando os dados, antes de liberar amplamente.

O Console atual pode apresentar a assinatura padrão com chaves geradas pelo Google. Não aceite essa escolha sem verificar a compatibilidade desejada. A chave de **upload** verifica o arquivo que você envia; a chave de **assinatura do app** assina o APK instalado. Elas podem ser diferentes.

O arquivo PEPK não pode ser preparado corretamente sem os parâmetros da configuração do seu Console. A chave privada e suas senhas devem ficar em local seguro; não inclua esses dados no ZIP público, na ficha nem nas instruções da revisão.

Se houver login ou links que dependam de impressão digital, conferir os certificados registrados também após a configuração do Play App Signing.

**Fontes oficiais:** [Assinar seu aplicativo](https://developer.android.com/studio/publish/app-signing?hl=pt-br) · [Play App Signing — configuração atual](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)

---

<!-- PÁGINA 3 — FICHA COPIÁVEL -->

## 3. Preencher a ficha da loja

Abra a **Página principal de detalhes do app**. Os nomes do menu podem variar com o idioma do Console.

### Nome — até 30 caracteres

```text
Prativerso
```

### Descrição breve — até 80 caracteres

```text
Aulas interativas com slides, quizzes, enquetes e participação pelo celular
```

### Descrição completa — texto original para copiar

```text
Transforme a participação em sala de aula com o Prativerso.

O professor conduz a aula presencial e os estudantes participam pelo celular. Apresentações, perguntas, enquetes e nuvens de palavras ajudam a transformar o conteúdo em uma experiência compartilhada.

PARA O PROFESSOR
• Organize apresentações e atividades para a sua aula.
• Use aulas prontas e adapte o conteúdo à turma.
• Abra uma sala e compartilhe o código ou QR code de acesso.
• Controle pelo aplicativo uma apresentação iniciada no computador, usando a mesma conta.
• Conduza quizzes, enquetes e nuvens de palavras durante a explicação.
• Acompanhe as respostas e os resultados da turma.

PARA O ESTUDANTE
• Entre na sala pelo código ou QR code compartilhado pelo professor.
• Responda às perguntas e participe das enquetes.
• Envie palavras nas atividades abertas pelo professor.
• Acompanhe sua pontuação e o ranking da atividade.

NA AULA PRESENCIAL
A apresentação pode ser exibida no computador e projetada para a turma. Os celulares funcionam como instrumentos de participação, enquanto o professor mantém a condução da aula.

O aplicativo requer conexão com a internet para acessar salas, sincronizar apresentações e enviar respostas. Para iniciar uma atividade ao vivo, o professor precisa abrir a sala no Prativerso. O controle remoto da apresentação depende do computador e do aplicativo vinculados à mesma conta.

O Prativerso foi pensado para professores e estudantes, com participação supervisionada em sala de aula. Esta versão é gratuita, sem anúncios e sem compras no aplicativo.
```

**Conferir antes de copiar:** cada recurso descrito deve funcionar no AAB final. Não prometer acompanhamento de resultados ou controle remoto se alguma dessas funções estiver indisponível na versão enviada.

### Elementos gráficos

- Ícone: PNG 32 bits, **512 × 512**, até **1.024 KB**.
- Recurso gráfico: JPEG ou PNG sem transparência, **1024 × 500**.
- Capturas: pelo menos **2**; recomenda-se **4 capturas reais em 1080 × 1920** para smartphones.
- Capturas incluídas: entrada na sala, editor nativo, nuvem de palavras e resultado de enquete. Todos os nomes são fictícios.
- Evite nomes/fotos reais de alunos. Não use screenshots inventadas ou selos como “nº 1”.
- Vídeo demonstrativo: opcional.

**Fontes oficiais:** [Ficha e limites de texto](https://support.google.com/googleplay/android-developer/answer/9859152?hl=pt-BR) · [Imagens e capturas](https://support.google.com/googleplay/android-developer/answer/9866151?hl=pt-BR)

---

<!-- PÁGINA 4 — CONTEÚDO E PRIVACIDADE -->

## 4. Preencher “Conteúdo do app”

No Console, procure **Políticas e programas → Conteúdo do app** e conclua todas as tarefas solicitadas. Responda conforme o comportamento da versão enviada.

| Campo | Orientação |
|---|---|
| Anúncios | Não, desde que o AAB realmente não contenha publicidade |
| Política de Privacidade | Colar a URL pública da política do Prativerso |
| Exclusão de conta | Informar o mecanismo e a URL web, depois de conferir funcionamento |
| Acesso ao app | Informar que há recursos restritos e fornecer instruções de revisão |
| Público-alvo | Declarar as faixas de estudantes e adultos que o app realmente atende |
| Classificação indicativa | Responder ao questionário IARC com fidelidade; a classificação será atribuída pelo sistema |
| Segurança dos dados | Declarar os dados enviados, finalidades e práticas de segurança reais |

### Público misto, incluindo menores de 13 anos

O app atende professores adultos e estudantes, inclusive turmas que podem ter alunos de 12 anos. Portanto, não marque apenas “Maiores de 18 anos”. As faixas **9–12, 13–15, 16–17 e 18+** são candidatas para este escopo, desde que o produto final esteja adequado a cada uma. Não incluir crianças menores de 9 anos por simples desejo de ampliar o alcance.

Incluir crianças exige conformidade com a Política para Famílias. Conferir conteúdo, SDKs, coleta de dados e recursos compartilhados. A idade deve ser declarada honestamente; a classificação indicativa e o público-alvo são informações distintas.

### Privacidade e exclusão — recursos desta versão

- Política acessível no app e em página pública HTML, sem login.
- [ ] Nome Prativerso, responsável e contato de privacidade preenchidos.
- [ ] Tipos de dados, finalidade, hospedagem, retenção e exclusão explicados.
- No professor: opções da conta → Excluir conta e dados → digitar EXCLUIR. No aluno: Excluir meus dados dentro da sala.
- [ ] Página web permite solicitar exclusão mesmo após desinstalar o aplicativo.
- [ ] Exclusão alcança os dados associados à conta; eventual retenção legítima é informada.

Ter acesso sem conta para alunos não elimina a obrigação de excluir as contas que o app permite criar. “Sair” e “desativar” não substituem exclusão.

### Nuvens e conteúdo compartilhado

- [ ] Termos aceitos antes de enviar conteúdo.
- [ ] Aviso adequado de segurança para estudantes.
- Avisar professor envia uma descrição privada; Contacto e ajuda atende questões gerais e conteúdo compartilhado.
- Em Moderar sala o professor lê avisos privados, oculta palavras e remove participantes durante a aula. Ocultar palavras preserva os 100 pontos já registrados.
- [ ] Controles e consentimentos necessários para recursos de crianças conferidos.

As palavras da nuvem são conteúdo de usuário visível a outras pessoas, mesmo em uma sala privada. Não declare ausência de compartilhamento de conteúdo entre usuários no questionário se esse recurso existe.

**Fontes oficiais:** [Conteúdo e revisão](https://support.google.com/googleplay/android-developer/answer/9859455?hl=pt-BR) · [Público-alvo](https://support.google.com/googleplay/android-developer/answer/9867159?hl=pt-BR) · [Famílias](https://support.google.com/googleplay/android-developer/answer/9893335?hl=pt-BR) · [Dados do usuário](https://support.google.com/googleplay/android-developer/answer/10144311?hl=pt-BR) · [Exclusão](https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR) · [Conteúdo gerado pelo usuário](https://support.google.com/googleplay/android-developer/answer/9876937?hl=pt-BR)

---

<!-- PÁGINA 5 — DADOS E REVISÃO -->

## 5. Dados e acesso para a revisão

### Segurança dos dados: não confundir “sem anúncios” com “sem coleta”

O Prativerso usa um servidor para sincronizar a sala e receber respostas. Preencha o formulário de acordo com o código e os serviços da versão final, incluindo SDKs. O quadro abaixo orienta a conferência; não é uma declaração final já validada.

| Dado a conferir | Onde verificar |
|---|---|
| Nome ou apelido | Conta e identificação do participante |
| E-mail | Cadastro/login do professor, quando utilizado |
| ID de usuário | Identificação de contas e participantes no servidor |
| Interações no app | Respostas, votos e atividades registradas |
| Outro conteúdo gerado pelo usuário | Palavras, textos e apresentações enviados |
| Arquivos/documentos e fotos | Declarar quando enviados para fora do aparelho; não marcar só porque existe seletor de arquivo |
| Diagnósticos e identificadores | Verificar bibliotecas, serviços e logs efetivamente usados |

Informar finalidades como funcionamento do app e gerenciamento de contas quando forem as reais. Conferir quais dados são opcionais e quais são necessários; declarar criptografia em trânsito somente se todas as transmissões pertinentes forem protegidas.

Serviços que processam dados em nome do desenvolvedor podem se enquadrar na exceção de “compartilhamento” do formulário, mas a transmissão ainda pode ser “coleta”. Não marcar automaticamente “não compartilha” nem “não coleta”.

O formulário é obrigatório para teste fechado, aberto e produção. Se o app estiver **exclusivamente em teste interno**, existe dispensa dessa seção, o que não deve ser usado para adiar a preparação para o lançamento.

### Acesso ao app para a equipe do Google

O revisor precisa testar sem esperar você abrir uma aula ao vivo. Preparar uma conta e demonstração reutilizáveis, disponíveis a qualquer horário, sem dados reais de alunos, sem códigos de autenticação de uso único ou senha que expire.

Em **Acesso ao app**, incluir instruções em inglês. Preencher os campos entre colchetes antes do envio:

```text
Prativerso is a classroom interaction app for teachers and students.

Teacher access (no existing account or password required):
1. In the Android app choose "Criar uma atividade" or "Começar", then
   "Experimentar sem conta". Enter "Play Review", accept the terms checkbox and choose "Continuar".
   This creates a fresh review session; do not use a previously supplied login.
2. Use "Explorar aulas por disciplina" to open the Portuguese lesson
   "Artigo de opinião" and choose the option to use/copy the lesson.
3. The lesson is editable. Use "Apresentar" to start a classroom session.
   Presentations can start without students. Record the six-digit room code.
4. Advance the slides to see questions, polls and a word cloud.

Student access:
On a second device, open
https://quizedu-emanuel.emanuelb5.chatgpt.site/jogar
Enter the room code created above, a fictional nickname and an avatar.
No student account, password or SMS is required. Students may join after
presentation start. They can answer questions, vote and send words.
The word cloud asks for agreement with the classroom rules before posting.

Web presentation and Android remote control (optional):
1. On a computer open https://quizedu-emanuel.emanuelb5.chatgpt.site
   and create a fresh temporary teacher access without a password.
2. In Android choose "Criar com minha conta" or the account option
   "Vincular ou trocar conta". The app opens a linking URL in the browser.
3. Copy that fresh linking URL to the computer browser where the temporary
   teacher account is open, then choose "Vincular este Android".
4. Return to Android. On the computer open a lesson and start its presentation.
   Android shows "Apresentação iniciada"; choose "Controlar".
The app and computer must use the same Prativerso account.

Privacy and deletion:
Home has "Privacidade e termos" and "Contato e ajuda".
Teacher account options contain "Excluir conta e dados".
Students have "Avisar professor" and "Excluir meus dados" in the classroom.
Use fictional data only. Fresh temporary access can be created whenever needed.
No paid subscription, existing external login or one-time code is needed to
review the core features. Linking is initiated by the reviewer on their devices.
```

O percurso acima cria uma sessão nova em cada revisão e não depende de uma senha fornecida ou de uma sala antiga. O acesso temporário dura 30 dias; se ele expirar, saia e crie outro. O QR é opcional: o código digitado oferece o mesmo acesso. Confira os rótulos no teste interno antes de copiar as instruções.

**Fontes oficiais:** [Segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469?hl=pt-BR) · [Credenciais e instruções de revisão](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en)

---

<!-- PÁGINA 6 — TESTAR E ENVIAR -->

## 6. Testar, enviar e acompanhar

### Primeiro teste na Play

1. Abra **Testar e lançar → Teste → Teste interno**.
2. Crie uma versão e envie o **AAB**, após configurar a assinatura.
3. Leia e resolva os avisos impeditivos apresentados pelo Console.
4. Adicione testadores autorizados e envie o link de participação.
5. Instale pela Play e confira a versão 1.6.0; observe também o relatório de pré-lançamento, quando disponível.

Não depender apenas do APK direto. O teste pela Play também verifica o aplicativo produzido a partir do AAB e a assinatura aplicada pelo Google.

### Percurso essencial de sala de aula

- [ ] Professor inicia a aula no computador; celular na mesma conta oferece controle.
- [ ] Aluno entra antes e **depois** do início, pelo código e pelo QR.
- [ ] Entrada tardia alcança a atividade atual, sem ficar presa em “Aguardando professor”.
- [ ] Aluno troca de aplicativo, volta e recupera a sala.
- [ ] Oscilação de internet recupera sincronização sem duplicar participante/resposta.
- [ ] Perguntas, enquetes e nuvens funcionam para todos os participantes.
- [ ] Encerramento e reentrada apresentam o estado correto da sala.
- [ ] Atualização sobre o APK anterior preserva acesso e dados quando a assinatura é compatível.
- [ ] Exclusão, denúncia, termos e privacidade funcionam na versão instalada pela Play.

### Somente se sua conta pessoal foi criada após 13/11/2023

Você precisa realizar **teste fechado com pelo menos 12 testadores inscritos durante 14 dias consecutivos** e então solicitar acesso à produção. Convide pessoas que realmente usem a versão e guarde o feedback e as correções. Instaladores fora da Play e teste interno não substituem esse requisito.

Se alguém sair e voltar, o período contínuo dessa pessoa recomeça. Ao solicitar produção, descreva o uso, o feedback recebido e como verificou a prontidão. A liberação depende da análise do Google, não ocorre automaticamente no 14º dia.

Contas organizacionais ou pessoais anteriores não entram automaticamente nessa regra específica. Confira as tarefas reais do painel. Novas contas pessoais também podem precisar verificar acesso a um Android físico pelo app Play Console.

**Fontes oficiais:** [Requisitos de testes](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR) · [Verificação de dispositivo](https://support.google.com/googleplay/android-developer/answer/14316361?hl=pt-BR)

---

<!-- PÁGINA 7 — PUBLICAÇÃO -->

## 7. Publicar a primeira versão

1. Conclua ficha, conteúdo do app, contato, política e instruções de acesso.
2. Quando produção estiver disponível, abra **Testar e lançar → Produção**.
3. Selecione os países/regiões pretendidos; para início, pode escolher Brasil.
4. Prepare a versão, confira o AAB e adicione as notas abaixo.
5. Revise todos os avisos e envie as mudanças para análise.
6. Acompanhe **Visão geral da publicação** e o e-mail da conta de desenvolvedor. Se a publicação gerenciada estiver ativada, publique as alterações aprovadas quando estiver pronto.

Notas originais da primeira versão, para usar após os testes:

```text
Primeira versão do Prativerso no Google Play.
Aulas presenciais com apresentações, quizzes, enquetes e nuvens de palavras.
Participação pelo código ou QR code e controle da apresentação pelo celular.
```

**Conferência final:** os contatos estão preenchidos; nenhuma instrução contém colchetes vazios; as páginas públicas funcionam; os testes e a assinatura estão documentados; o AAB correto foi enviado. Depois da aprovação e disponibilização, use o link público exibido pelo Console para divulgar à turma.

**Fontes oficiais:** [Requisitos de testes](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR) · [Verificação de dispositivo](https://support.google.com/googleplay/android-developer/answer/14316361?hl=pt-BR) · [Preparar revisão](https://support.google.com/googleplay/android-developer/answer/9859455?hl=pt-BR)

---

Informações de regras verificadas em fontes oficiais em **14 de outubro de 2026**. O Console pode atualizar nomes de menus e exibir tarefas específicas da conta. Este rascunho deve ser ajustado aos nomes finais dos arquivos, URLs publicadas, dados do responsável e resultados de testes antes de virar o guia entregue.


## Operação após publicar

Mantenha as URLs de privacidade, exclusão e contato disponíveis. O formulário de contato cria um protocolo privado na tabela `support_requests`; não envia e-mail automaticamente. A administração pode consultar essas solicitações pelo acesso de proprietário ao projeto Sites. Você pode pedir a revisão desses contatos aqui. Defina e monitore o e-mail público informado na ficha da loja.

As próximas versões devem manter o pacote `br.com.quizedu.app`, incrementar o versionCode e usar a chave autorizada. O certificado público está em `certificado-upload.pem`; a impressão digital e as verificações estão em `VERIFICACOES.txt`. A chave privada não está no pacote público. Caso escolha importar a assinatura existente para a Play, os parâmetros PEPK dependem do seu Console; configure isso antes da primeira distribuição pela loja.
