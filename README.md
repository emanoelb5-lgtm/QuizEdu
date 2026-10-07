# QuizEdu

Plataforma gratuita para educadores, em português, com quizzes ao vivo e aulas completas de slides com perguntas intercaladas. Uma tela para o professor, um telão e outra tela para cada participante.

**Abrir o site:** https://quizedu-emanuel.emanuelb5.chatgpt.site

**Aplicativo Android:** [baixar o APK no GitHub Releases](https://github.com/emanoelb5-lgtm/QuizEdu/releases/latest). Cliente nativo em Kotlin para alunos e professores, com leitura de QR code, retomada da sala, editor de slides, biblioteca sincronizada e controle da apresentação do computador. Requer Android 7.0 ou superior. Salas ao vivo precisam de internet; rascunhos de aulas já abertas podem ser editados no aparelho sem conexão.

O [GitHub Actions](.github/workflows/android.yml) compila, testa no emulador, assina e publica as versões do app. Código e instruções de desenvolvimento estão em [android/README.md](android/README.md).

## Como usar

1. Use **Continuar com ChatGPT** para guardar suas atividades em uma conta permanente, acessível em outros aparelhos. Também é possível começar com um nome e um acesso temporário. Os alunos não precisam de conta.
2. Clique em **Criar quiz**, dê um título e, se quiser, informe a disciplina e o assunto.
3. Escolha um modelo: **Múltipla escolha**, **Verdadeiro ou falso**, **Identificar uma imagem** ou **Situação prática**. Escreva o enunciado, preencha as alternativas e marque a correta. Nenhuma resposta vem marcada em uma pergunta nova.
4. Abra **Configurações da atividade** para escolher **Competição** (acerto e rapidez) ou **Aprendizagem** (pontuação apenas por acerto). No segundo modo, também é possível responder sem cronômetro.
5. O rascunho é salvo automaticamente. Use **Salvar quiz** para concluir a atividade e **Abrir sala** para jogar.
6. Projete a tela da sala. Os alunos leem o QR code ou digitam o código de seis números na página inicial, escolhem nome e avatar e entram.
7. Aguarde a turma e clique em **Iniciar quiz**. A pergunta aparece no telão e nos celulares.
8. Ao terminar a rodada, aparecem a resposta correta, a explicação e a classificação acumulada. O professor decide quando avançar.
9. Ao final, o primeiro e o segundo lugares recebem destaque. Abra **Ver relatório da aula** ou a aba **Minhas aulas** para consultar os resultados, baixar CSV ou imprimir/salvar PDF.

O exemplo **Brasil e natureza** contém cinco perguntas que podem ser adaptadas. O editor permite ordenar, duplicar e excluir perguntas, exportar JSON e importar uma cópia exportada.

## Aulas com slides

No painel inicial, abra **Aulas com slides** e **Nova aula**. O exemplo **Solo vivo, turma em ação** oferece oito slides de Agroecologia com duas perguntas intercaladas.

- **Criação nativa:** tela 16:9 com 11 modelos e oito temas. Insira e formate textos com fontes, cores, títulos, listas, links e alinhamento; adicione imagens com recorte, formas, tabelas editáveis, gráficos de colunas/linha/pizza e vídeos do YouTube iniciados por clique.
- **Edição visual:** arraste e redimensione objetos, altere rotação/opacidade, use seleção múltipla, agrupamento, alinhamento, distribuição, grade, guias, camadas, bloqueio, ocultação e entradas progressivas. Duplo clique abre a formatação de texto. Ctrl/Cmd Z desfaz; Shift Z refaz; C/V copia e cola objetos; D duplica. Setas movem a seleção, Shift + setas move dez unidades. Page Up/Down troca de slide. No celular, a tela mantém o slide acima e os painéis abaixo.
- **Sequência:** arraste as miniaturas ou use setas para ordenar. Insira perguntas de múltipla escolha, verdadeiro/falso, sim/não ou imagem depois do slide atual. Reaproveite seu banco, um quiz pronto ou a importação e o fluxo de IA já existentes. As perguntas têm uma única resposta correta e exigem gabarito para abrir a sala.
- **Salvamento:** automático, na conta ou no acesso temporário, com revisões para evitar que uma tela sobrescreva outra. Uma cópia no aparelho protege alterações durante falhas de conexão. Conflitos oferecem guardar outra cópia ou abrir a versão da conta. Notas do professor pertencem à aula e não são enviadas aos alunos.
- **Apresentação:** a prévia permite ensaiar sem abrir uma partida. **Abrir sala** usa o mesmo QR code, nomes, avatares e app persistente dos alunos. **Iniciar aula** começa no primeiro slide. Setas/Space avançam, B pausa o telão entre perguntas e F alterna tela inteira. Uma nova pergunta inicia a rodada nos celulares. O ranking lateral segue acumulado até o pódio final, usando as mesmas regras de pontuação. As notas ficam no painel do professor; **Abrir telão em outra janela** projeta só a apresentação e o ranking. O ponteiro acompanha o telão em outra janela do mesmo navegador quando BroadcastChannel está disponível.
- **Retomada e revisão:** todos os aparelhos acompanham o slide atual. Novos alunos podem entrar no intervalo de conteúdo; perguntas em andamento preservam a lista da rodada. Perguntas concluídas podem ser revistas, sem nova tentativa e sem repetir pontos. A ordem das perguntas inéditas é preservada. Salas guardam uma cópia da aula: editar ou excluir a apresentação original não muda aulas já abertas nem seus relatórios.
- **Arquivos:** **Arquivo** baixa a aula QuizEdu em JSON, insere slides de uma cópia JSON, exporta PowerPoint com textos/formas/tabelas/gráficos editáveis e notas, ou abre impressão com um slide por página para salvar PDF pelo navegador. PowerPoint e PDF são cópias estáticas: as rodadas, o ranking e as entradas progressivas acontecem dentro do QuizEdu. Vídeos são links no PowerPoint. A importação oferece prévia e seleção de slides de PPTX/PPSX/POTX, ODP/OTP, PPT/PPS/POT antigos, PDF e JSON. PPTX preserva objetos básicos editáveis; formatos antigos recuperam textos; PDF abre como páginas visuais sobre as quais é possível adicionar conteúdo e perguntas. Animações, fontes e objetos especiais podem precisar de ajustes; os avisos aparecem antes de confirmar.
- **Limites de preparação:** até 150 slides, 60 objetos por slide, 50 perguntas, 5.000 caracteres de notas por slide e 1 MB no documento JSON, sem os arquivos de imagem, que ficam no armazenamento de mídia. Até 200 aulas em conta permanente ou 50 em acesso temporário. A lista usa apenas metadados, sem carregar os documentos completos. Os limites existentes de sala continuam: 100 participantes, cinco salas abertas por educador e validade de 24 horas.

### Importação e edição (3.3 / Android 1.1)

Use **Importar apresentação** na biblioteca ou no editor, confira a prévia e selecione os slides. Arquivos até 15 MB, até 150 slides, 12 MB de imagens extraídas e 32 MB de conteúdo descompactado. Os limites da aula e da conta continuam sendo respeitados. Imagens são reduzidas antes do envio; apenas imagens dos slides selecionados são enviadas. O documento é validado e nenhuma macro é executada.

O site oferece copiar/aplicar formatação entre objetos do mesmo tipo e redimensionamento proporcional com Shift. O Android acrescenta desfazer/refazer, copiar/colar entre slides, seleção múltipla, agrupamento, alinhamento, redimensionamento pelo toque e edição ampliada com estilos por trecho, cor e links. Na importação do Android, arquivos PowerPoint/LibreOffice são enviados ao QuizEdu para leitura; PDFs são renderizados no aparelho. O site lê os arquivos no navegador. Depois de salvar, os dois clientes acessam a mesma aula.

### Refinamentos do editor (3.1)

- **Texto no próprio slide:** no computador, dê dois cliques em uma caixa, ou selecione-a e pressione Enter. A barra contextual formata o trecho selecionado e acompanha fonte, tamanho, cor e alinhamento. **Concluir** ou Esc encerra a edição; cada alteração entra no salvamento e na cópia local. Texto bloqueado precisa ser desbloqueado antes de editar. Ctrl/Cmd S salva também durante a digitação.
- **Edição ampliada:** o celular abre uma área maior para escrever, e o computador oferece **Ampliar**. A prévia mostra o slide com o texto em preparação; **Aplicar** ou Ctrl/Cmd Enter confirma, enquanto **Cancelar** descarta apenas o que foi alterado nessa janela. Links são editados em um formulário com validação, e há paleta de cores e limpeza de formatação. A edição direta avisa quando o texto ultrapassa a altura da caixa.
- **Sequência e espaço:** busque títulos, perguntas e conteúdo dos objetos, inclusive sem acentos; filtre apenas perguntas sem mudar a ordem da aula. O slide selecionado acompanha a navegação. O botão de foco oculta os painéis para ampliar o canvas; as notas podem ser recolhidas. Controles e rótulos maiores, atalhos acessíveis pelo teclado e alças com uma área de toque maior facilitam a edição.
- **Camadas:** o painel permite mostrar, ocultar, bloquear e desbloquear cada objeto sem precisar abrir suas propriedades. **Ajustes do slide** retorna às configurações do fundo e da aula.

### QuizEdu padrão e futuro Pro

O QuizEdu padrão mantém gratuitamente as funções de quiz já existentes. A criação e apresentação de aulas com slides estão **liberadas no gratuito agora**, conforme a decisão do proprietário. A proposta de **QuizEdu Pro a R$19 por mês** está registrada para uma etapa futura. Esta versão não configura pagamentos, assinatura, cobrança automática, limite artificial de acesso ao editor ou retirada de recursos existentes.

## App do aluno e retomada da sala

- Ao abrir o QR code da sala, o aluno encontra a instalação do app. **Instalar QuizEdu** abre diretamente a janela nativa do navegador. O botão só é habilitado quando essa instalação está disponível; antes disso, aparece **Preparando instalação**. A solicitação é capturada antes de a página terminar de carregar e usada uma única vez, no clique. Cancelar a instalação mantém o aluno no quiz. **Como instalar pelo menu** é uma ajuda separada. O app usa o mesmo site e não exige loja nem conta. No iPhone/iPad, use Compartilhar e **Adicionar à Tela de Início**; se necessário, abra no Safari. Navegadores dentro de outros aplicativos podem exigir abrir o endereço no navegador do aparelho.
- O ícone abre **[o acesso dos alunos](https://quizedu-emanuel.emanuelb5.chatgpt.site/jogar)** e retoma a última sala neste aparelho. Nome, avatar, respostas confirmadas e pontos continuam no servidor. A sala permanece válida por 24 horas; encerrar a sala impede novas respostas.
- **Sair da sala** desativa a retomada automática e abre a entrada por código ou câmera. Sair não exclui o participante nem seus pontos; voltar pelo mesmo aparelho/navegador mantém o acesso, mesmo depois de iniciar o quiz.
- **Ler QR code** pede permissão de câmera, lê apenas códigos de salas deste site e encerra a câmera ao fechar a janela, trocar de página ou colocar o app em segundo plano. As imagens são processadas no aparelho, sem envio ao servidor; também há entrada por seis números.
- A instalação preserva a sala inicial e permite retomar o participante quando o navegador e o app usam sessões separadas. O vínculo é assinado, limitado ao aluno e à validade da sala; não concede acesso de educador. O endereço de instalação usa um fragmento removido ao abrir, e o manifesto pessoal não é guardado em cache.
- Sem internet, aparece uma tela de reconexão com acesso à sala guardada. O quiz ao vivo precisa de conexão: respostas, cronômetro, placar, páginas pessoais e autenticação não são guardados pelo service worker. Apenas a tela de reconexão e arquivos públicos do app entram no cache.
- Limpar os dados do navegador/app remove a lembrança local e pode remover o acesso temporário do aluno. Instalar não impede que o próprio usuário apague esses dados.

## Preparar perguntas com menos trabalho

- **Adicionar em lote:** cole uma lista de perguntas com alternativas e gabarito, ou importe CSV, Excel (.xlsx) e texto (.txt). Confira a seleção antes de adicionar. Os arquivos são lidos no aparelho; as perguntas selecionadas passam a fazer parte do rascunho.
- **Planilha:** baixe o modelo CSV no próprio editor e abra-o no Excel, LibreOffice ou Google Planilhas. Cabeçalhos: `Pergunta`, `A`, `B`, `C`, `D`, `Correta`, `Tempo`, `Explicação`, `Modelo`. A correta pode ser A–D ou 1–4. Campos sem gabarito ficam como rascunho para completar. No Excel, use a primeira aba. Limites de leitura: 3 MB para XLSX, 512 KB para CSV/TXT e até 100 perguntas por importação; selecione apenas as que cabem no limite de 50 do quiz.
- **Texto colado:** use perguntas numeradas, alternativas `A)`, `B)` etc. e `Resposta: A`. Para afirmações, use `Resposta: Verdadeiro` ou `Resposta: Falso`. Também são aceitos gabaritos coletivos no formato `Gabarito: 1-A; 2-B`. O editor mostra ambiguidades e campos pendentes; não inventa respostas.
- **Modelos:** são formas de preparar perguntas com uma única resposta correta. Verdadeiro ou falso oferece as duas alternativas prontas. Identificar uma imagem exige a foto antes de salvar o quiz. Situação prática ajuda a escrever um caso com alternativas de decisão. Enunciado, imagem e explicação são preservados ao mudar de modelo; mudanças que substituem alternativas pedem confirmação.
- **Concluir e próxima:** verifica a pergunta atual e avança. Ao chegar à última, acrescenta outra com o mesmo modelo, tempo e quantidade de alternativas. A edição no celular inclui ações fixas na parte inferior.
- **Ajustar tempos:** aplique uma duração a todas as perguntas ou só às selecionadas. A mudança é guardada no rascunho.
- **Revisar quiz:** mostra campos incompletos, alternativas repetidas, gabaritos pendentes e avisos de leitura/descrição de imagens. Os avisos de leitura não bloqueiam o jogo; os campos obrigatórios precisam estar completos.
- **Testar como aluno:** abre uma simulação da pergunta, com escolha de resposta, cronômetro, resultado e visão do telão. Usa os mesmos componentes de enunciado e alternativas da sala. Não cria participantes, aulas nem respostas no histórico.
- Imagens e explicações ficam em **Mais opções** quando são opcionais. O envio de imagens precisa terminar antes de salvar ou abrir a sala.

## Criar perguntas com IA

No editor, use **Criar com IA**. Informe assunto, turma, quantidade (até 20 por pedido), dificuldade e modelo: múltipla escolha, verdadeiro/falso ou situação prática. Opcionalmente, cole um texto de apoio de até 12.000 caracteres. O pedido solicita linguagem adequada à turma, gabarito explícito e explicações curtas no formato aceito pelo QuizEdu.

1. Clique em **Preparar pedido** e **Copiar pedido**.
2. Use **Abrir ChatGPT**, entre na conta que deseja usar e envie o pedido em uma conversa.
3. Copie a resposta completa, volte ao QuizEdu e use **Colar resposta e revisar**.
4. Confira os fatos, as alternativas e o gabarito. Selecione as perguntas e adicione ao rascunho.

Este é um fluxo assistido com copiar/colar. O QuizEdu não envia chamadas de IA, não usa uma chave do proprietário, não recebe a senha do ChatGPT e não tem acesso às conversas. A geração acontece na conta aberta no ChatGPT e segue os limites dela. O login **Continuar com ChatGPT** do QuizEdu identifica o educador e guarda suas atividades; não autoriza geração de IA.

A integração automática que utiliza o plano ChatGPT do visitante exige autorização própria para inferência. A [documentação oficial de Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) disponibiliza o fluxo aberto para aplicativos locais/de código aberto; aplicativos pagos ou hospedados remotamente precisam solicitar acesso à OpenAI. Esse acesso não está configurado neste site. A geração direta não deve ser ativada apenas com o login de identidade nem com a chave/saldo do proprietário.

## Biblioteca e recuperação

- **Conta permanente:** o login do ChatGPT identifica o educador; quizzes, rascunhos, banco e aulas ficam no servidor. Ao vincular o acesso temporário, o trabalho existente é transferido para sua conta. O login não exige chave de API nem assinatura de um serviço de IA.
- **Acesso temporário:** dura 30 dias no navegador utilizado. Limpar cookies ou trocar de aparelho perde a chave desse acesso. Vincule a conta ou exporte seus quizzes para conservar uma cópia.
- **Rascunhos:** são salvos no servidor mesmo com campos incompletos. Uma cópia no aparelho preserva alterações durante falhas de conexão e tenta sincronizar novamente. Alterações simultâneas em duas telas são detectadas; a cópia local pode ser exportada ou salva como outro rascunho.
- **Banco de questões:** organize por disciplina/assunto e pesquise por texto. Adicionar uma questão a um quiz cria uma cópia independente.
- **Compartilhamento:** um link permite que outro educador veja as perguntas e faça sua própria cópia, incluindo as respostas corretas. O original continua sob seu controle. Você pode atualizar ou desativar o link.
- **Minhas aulas:** mostra histórico, classificação, acertos por participante, respostas individuais e distribuição das alternativas por questão. O relatório é privado do professor. O CSV contém as respostas individuais; a versão para impressão/PDF contém o resumo, a classificação e a análise das questões.

## Regras do jogo

- **Competição:** o primeiro acerto registrado em cada pergunta recebe **1.000 pontos**, independentemente da demora dentro do prazo. Do segundo acerto em diante, aplica-se uma redução fixa de **300 pontos (30% do máximo)**, além da redução pelo tempo que já existia: `200 + floor(500 * (1 - tempo_de_resposta / tempo_da_pergunta))`, entre **200 e 700 pontos**. O desconto de 30% não aumenta para o terceiro ou os demais. Erros e ausência de resposta valem zero e não consomem o prêmio do primeiro acerto. Empates são resolvidos por mais acertos, menor soma dos tempos nos acertos e ordem de entrada.
- **Aprendizagem:** 1.000 pontos por acerto, sem bônus de rapidez. Empates são resolvidos por mais acertos e ordem de entrada. O professor pode escolher tempo livre.
- O servidor mede o tempo e calcula os pontos. A primeira resposta correta é determinada no mesmo registro atômico da resposta, garantindo um único prêmio máximo por pergunta mesmo em envios simultâneos. O celular não decide sua pontuação.
- Cada participante pode enviar **uma única resposta por pergunta**. Reenvios da mesma resposta são idempotentes; o celular confirma o envio quando o servidor aceita a resposta.
- As respostas corretas e as explicações não são enviadas aos alunos durante a pergunta.
- Até **100 participantes** por sala, **50 perguntas** por quiz, **200 quizzes** por conta permanente ou **50** por acesso temporário, **100 rascunhos** e **500 questões** no banco.
- Há três segundos de preparação antes de cada pergunta. A entrada na turma fecha depois do início.
- A sala expira em 24 horas. O professor pode encerrar uma rodada antecipadamente ou encerrar a sala. Os relatórios continuam no histórico depois da expiração e da exclusão do quiz original.
- As telas de professor e aluno oferecem teste de conexão, leitura em voz alta, tamanho de texto e sons opcionais. A voz depende dos recursos do navegador/aparelho. As animações respeitam a preferência por movimento reduzido.
- O professor vê quem teve contato recente com a sala; isso é um indicador de conexão, não prova de atenção ou de presença física.
- Imagens JPEG, PNG e WebP são reduzidas no navegador antes do envio, para até 1 MB. Limite por educador: **200 imagens ou 50 MB**. Escreva uma descrição quando a imagem for necessária para compreender a pergunta.
- Professor e alunos precisam de internet. Respostas pendentes são reenviadas durante a mesma rodada; no modo com cronômetro, a resposta precisa chegar ao servidor antes do prazo.

## Arquitetura

- React 19 + TypeScript + Vinext/Vite, com componentes acessíveis Radix/Shadcn.
- Cloudflare Worker para as regras e APIs; D1/SQLite para os dados persistentes e R2 para imagens.
- Identidade permanente fornecida pelo fluxo **Sign in with ChatGPT** da hospedagem gerenciada. O servidor usa o identificador estável da conta; os alunos continuam anônimos.
- QR code gerado no aplicativo (`qrcode`), sem enviar os dados da sala a terceiros.
- Consultas HTTP compactas para acompanhar a sala. O servidor determina as mudanças de etapa; a presença é consultada separadamente para o professor.
- Sessões temporárias com chaves aleatórias de 256 bits, cookies HttpOnly/SameSite e somente o hash das chaves no banco. Quizzes, banco, rascunhos e relatórios exigem autorização do educador responsável.
- Salas e links compartilhados guardam cópias das perguntas. Editar o original não altera uma partida em andamento ou um compartilhamento até que o professor o atualize.
- Índices, contadores por triggers, revisões de rascunho e uma restrição única por resposta protegem a pontuação e os dados durante envios simultâneos.
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
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_empty_edwin_jarvis.sql
pnpm dev
```

As migrações em `drizzle/` são versionadas. Não edite uma migração aplicada; gere a próxima ao mudar o esquema. A terceira migração acrescenta as funcionalidades da versão 2 sem apagar os dados existentes.

O login permanente depende do gateway da hospedagem gerenciada. Em desenvolvimento local, use acesso temporário; não simule uma conta real com cabeçalhos enviados pelo navegador.

## Verificação

```sh
pnpm exec tsc --noEmit
pnpm build
pnpm test
```

Os testes de integração executam o Worker compilado contra D1 e R2 descartáveis. A suíte também verifica os modelos e os importadores de texto, CSV e Excel: regras de pontuação, privacidade das respostas, capacidade simultânea de 100 alunos, reconexão, propriedade dos dados, validação de imagens, compartilhamento, relatórios/CSV, migração de conta, concorrência de rascunhos e quizzes, gabaritos ambíguos e preservação das alternativas importadas. O fluxo da identidade é simulado apenas no ambiente de teste; o login real é fornecido pela hospedagem.

## Hospedagem e custos

O código não exige serviços pagos. A versão publicada usa hospedagem gerenciada, com D1 e R2 provisionados pela plataforma. Os planos gratuitos dos provedores têm quotas; a capacidade por sala não significa uso diário ilimitado.

Também é possível hospedar o Worker em sua conta Cloudflare, adicionando D1 e R2. O login permanente desta versão utiliza uma função da hospedagem gerenciada e precisa de uma integração de identidade verificada para funcionar em outro provedor. Consulte [DEPLOY.md](./DEPLOY.md).

Documentação dos limites: [Workers](https://developers.cloudflare.com/workers/platform/pricing/) · [D1](https://developers.cloudflare.com/d1/platform/pricing/) · [R2](https://developers.cloudflare.com/r2/pricing/).
