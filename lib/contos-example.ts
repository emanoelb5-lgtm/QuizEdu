import type {Question, Quiz} from "./quiz";
import {baseElement, newDeck, newSlide, questionSlide, richText, type LessonSlide, type SlideElement} from "./presentation";
import {CONTOS_EXAMPLE} from "./example-catalog";

type ReviewItem = Omit<Question, "id" | "seconds"> & {discussion: string; objective: string};

// Original questions for day five of the supplied UFRA lesson plan. Story facts
// were checked against the original texts, linked in the teacher's cover notes.
const questions: ReviewItem[] = [
  {
    kind: "multiple", text: "Que característica ajuda a reconhecer um conto?",
    options: ["Uma lista de instruções para realizar uma tarefa", "Uma narrativa breve, centrada em um conflito", "Uma notícia sobre um acontecimento recente", "Uma explicação científica sem personagens"], correct: 1,
    explanation: "O conto é uma narrativa breve que concentra personagens e acontecimentos em torno de um conflito. Não se define apenas pelo tamanho do texto.",
    objective: "Reconhecer características do gênero conto.", discussion: "Que conflito organiza cada um dos contos que lemos?"
  },
  {
    kind: "multiple", text: "Em uma narrativa, o que chamamos de conflito?",
    options: ["O lugar onde os acontecimentos se passam", "A voz que conta os acontecimentos", "O momento em que a história termina", "O problema ou tensão que movimenta a história"], correct: 3,
    explanation: "O conflito cria uma tensão que impulsiona as ações. Espaço é o lugar, narrador é a voz que conta e desfecho é o encerramento da história.",
    objective: "Distinguir conflito, espaço, narrador e desfecho.", discussion: "Retomem uma ação provocada pelo conflito em um dos contos."
  },
  {
    kind: "multiple", text: "Em “A cartomante”, qual relação entre os personagens está ligada ao conflito principal?",
    options: ["Vilela e Camilo disputam a mesma vaga de emprego", "Rita e a cartomante são irmãs que não se entendem", "Rita é casada com Vilela e se envolve com Camilo, amigo dele", "Camilo e Vilela são desconhecidos que se encontram na rua"], correct: 2,
    explanation: "Rita é esposa de Vilela, e Camilo é amigo dele. O envolvimento de Rita e Camilo e o medo de serem descobertos sustentam o conflito.",
    objective: "Identificar personagens e conflito em A cartomante.", discussion: "Como a amizade entre Camilo e Vilela torna a situação mais tensa?"
  },
  {
    kind: "true_false", text: "Em “A cartomante”, as cartas anônimas aumentam o medo de Camilo de que seu envolvimento com Rita seja descoberto.",
    options: ["Verdadeiro", "Falso"], correct: 0,
    explanation: "As cartas indicam que alguém conhece a relação. Camilo fica receoso e diminui as visitas à casa de Vilela, tentando evitar suspeitas.",
    objective: "Relacionar acontecimentos e reações de Camilo.", discussion: "Procurem a passagem em que Camilo muda seu comportamento depois de receber uma carta."
  },
  {
    kind: "multiple", text: "O narrador de “A cartomante” conta as ações e revela pensamentos e medos de Camilo. Qual descrição combina com essa voz?",
    options: ["Narrador em terceira pessoa, com acesso à vida interior do personagem", "Camilo contando sua própria história em primeira pessoa", "Rita contando apenas o que presencia", "Vilela escrevendo uma carta para o leitor"], correct: 0,
    explanation: "A voz narrativa está fora da ação e acompanha sentimentos e pensamentos de Camilo. Personagem e narrador não são a mesma coisa.",
    objective: "Identificar narrador e acesso à interioridade.", discussion: "Que pensamento de Camilo o narrador apresenta ao leitor?"
  },
  {
    kind: "multiple", text: "Camilo inicialmente ri da crença de Rita. Por que, mais tarde, ele procura a cartomante?",
    options: ["Para descobrir o preço de uma casa", "Para provar a Rita que as cartas sempre acertam", "Para conversar sobre seu emprego", "Por medo e pela esperança de receber uma resposta tranquilizadora"], correct: 3,
    explanation: "A convocação de Vilela e o medo da descoberta abalam a descrença de Camilo. A consulta lhe oferece a segurança que ele deseja naquele momento.",
    objective: "Inferir motivações e mudança de atitude.", discussion: "Compare a atitude de Camilo no início com sua atitude antes da consulta."
  },
  {
    kind: "true_false", text: "O desfecho de “A cartomante” confirma a previsão de que Rita e Camilo não corriam perigo.",
    options: ["Verdadeiro", "Falso"], correct: 1,
    explanation: "O final contraria a tranquilidade prometida: Rita está morta quando Camilo chega, e Vilela mata Camilo. O contraste cria um efeito de ironia.",
    objective: "Interpretar o desfecho e o contraste com a previsão.", discussion: "A confiança de Camilo combina com o que o leitor descobre no final? Justifiquem."
  },
  {
    kind: "multiple", text: "Em “O Boi Velho”, a estância, o arroio e o carretão ajudam a reconhecer qual espaço?",
    options: ["Uma escola de uma cidade grande", "Um porto com navios de passageiros", "Um ambiente rural ligado à vida no campo", "Uma fábrica de máquinas"], correct: 2,
    explanation: "A estância, o arroio e o transporte por carretão compõem o ambiente rural. Essas pistas de espaço ajudam a compreender o cotidiano dos personagens.",
    objective: "Identificar o espaço por pistas do texto.", discussion: "Que outra palavra do conto ajuda a imaginar esse ambiente?"
  },
  {
    kind: "multiple", text: "Qual serviço Dourado e Cabiúna realizam durante anos em “O Boi Velho”?",
    options: ["Vigiam a entrada da estância", "Puxam o carretão que leva a família ao banho no arroio", "Carregam cartas para outra cidade", "Conduzem sozinhos o rebanho pelos campos"], correct: 1,
    explanation: "Os dois bois transportam a família até o arroio. Esse longo serviço e o convívio com várias gerações tornam mais forte o contraste com o tratamento dado a Cabiúna no final.",
    objective: "Compreender a situação inicial e a relação entre família e animais.", discussion: "Por que o texto lembra que as crianças cresceram durante esses anos de serviço?"
  },
  {
    kind: "true_false", text: "Depois que Dourado morre por uma picada de cobra, Cabiúna fica sem seu companheiro.",
    options: ["Verdadeiro", "Falso"], correct: 0,
    explanation: "Dourado morre após uma picada de cobra. Cabiúna permanece perto dele por alguns dias; o narrador interpreta seus mugidos como saudade.",
    objective: "Reconhecer um acontecimento que muda a situação de Cabiúna.", discussion: "Distingam o acontecimento narrado da interpretação que o narrador faz dos mugidos."
  },
  {
    kind: "multiple", text: "No início de “O Boi Velho”, o narrador lembra um “caso que vi”. Que pista essa expressão oferece?",
    options: ["Ele se apresenta como testemunha do caso, em primeira pessoa", "Ele é o boi contando sua própria vida", "Ele conhece o caso apenas por uma notícia de jornal", "Ele narra sem se referir a si mesmo"], correct: 0,
    explanation: "A expressão “que vi” marca uma voz em primeira pessoa que se apresenta como testemunha. O narrador também comenta e avalia as atitudes humanas.",
    objective: "Identificar marcas de primeira pessoa e narrador testemunha.", discussion: "Compare essa voz com o narrador de A cartomante."
  },
  {
    kind: "multiple", text: "Mesmo ferido, Cabiúna se coloca no lugar de puxar o carretão. Qual leitura combina com essa cena e com os comentários do narrador?",
    options: ["O boi quer abandonar a família", "A família decide cuidar melhor do boi", "O boi é castigado porque atacou as crianças", "A dedicação do boi contrasta com a crueldade de quem o mata"], correct: 3,
    explanation: "O gesto final retoma o serviço prestado pelo boi. Os comentários do narrador criticam a crueldade e a ingratidão de quem o sacrifica para aproveitar o couro.",
    objective: "Inferir a crítica construída pelo desfecho.", discussion: "Que comentário do narrador sustenta essa leitura? Peçam uma pista do texto."
  },
  {
    kind: "multiple", text: "Em “O Boi Velho”, o narrador usa “vancê” para se dirigir a quem o escuta. Nesse contexto, a palavra corresponde a:",
    options: ["Ontem", "Você", "Arroio", "Companheiro de trabalho"], correct: 1,
    explanation: "“Vancê” é uma forma regional de tratamento equivalente a “você”. Ela ajuda a construir a voz do narrador e o efeito de uma conversa oral.",
    objective: "Interpretar uma forma regional pelo contexto.", discussion: "Como o contexto ajuda a entender a palavra, mesmo sem consultar um dicionário?"
  },
  {
    kind: "true_false", text: "As formas regionais de falar em “O Boi Velho” permitem concluir que seus falantes são menos inteligentes.",
    options: ["Verdadeiro", "Falso"], correct: 1,
    explanation: "Diferenças linguísticas expressam histórias, regiões e grupos sociais. Elas não medem inteligência. Desvalorizar pessoas por sua fala é preconceito linguístico.",
    objective: "Reconhecer a diversidade linguística sem preconceito.", discussion: "Como acolher uma forma de falar diferente da nossa sem ridicularizar o falante?"
  },
  {
    kind: "multiple", text: "Qual comparação dos espaços de “A cartomante” e “O Boi Velho” é sustentada pelos textos?",
    options: ["Os dois se passam no mesmo ambiente rural", "O primeiro ocorre na estância e o segundo em ruas da cidade", "O primeiro apresenta ruas e casas urbanas; o segundo, uma estância e um arroio", "Os dois se passam em uma escola contemporânea"], correct: 2,
    explanation: "Em A cartomante, ruas e casas compõem o espaço urbano. Em O Boi Velho, estância e arroio situam a ação no campo. O espaço participa da construção de cada conto.",
    objective: "Comparar elementos narrativos dos dois contos.", discussion: "Como esses ambientes se relacionam com os acontecimentos de cada história?"
  },
  {
    kind: "multiple", text: "Ao criar um novo desfecho para um dos contos, como manter a adaptação coerente?",
    options: ["Relacionar o novo final ao conflito e explicar as mudanças nas ações dos personagens", "Mudar o título e conservar todos os acontecimentos, sem criar um novo final", "Eliminar o conflito sem mostrar como ele se resolve", "Acrescentar um acontecimento sem relação com a história"], correct: 0,
    explanation: "Um novo desfecho pode mudar a história, desde que as ações façam sentido em relação ao conflito e às mudanças propostas. A turma deve conseguir justificar essas escolhas.",
    objective: "Retomar a produção de adaptações com coerência.", discussion: "Retomem uma adaptação produzida nos dias anteriores: o que precisou mudar para sustentar o novo final?"
  }
];

export function contosExample() {
  const quiz: Quiz = {
    id: crypto.randomUUID(), title: CONTOS_EXAMPLE.title,
    subject: CONTOS_EXAMPLE.subject, topic: CONTOS_EXAMPLE.topic,
    mode: "accuracy", untimed: true,
    questions: questions.map(({discussion: _discussion, objective: _objective, ...q}) => ({...q, options: [...q.options], id: crypto.randomUUID(), seconds: 60}))
  };
  const theme = "prativerso";
  const text = (value: string, x: number, y: number, w: number, h: number, size: number, color = "#23213d", font = "Arial"): SlideElement =>
    ({...baseElement("text", theme), x, y, w, h, fontSize: size, color, font, doc: richText(value)});
  const shape = (x: number, y: number, w: number, h: number, fill: string, radius = 12): SlideElement =>
    ({...baseElement("shape", theme), x, y, w, h, fill, strokeWidth: 0, radius});
  const cover = newSlide("blank", theme);
  cover.title = quiz.title; cover.background = {color: "#23213d"};
  cover.elements = [
    shape(790, 169, 128, 173, "#56dbc2"), shape(770, 183, 120, 173, "#ffb35c"),
    ...[223, 254, 285].map(y => shape(795, y, 64, 8, "#23213d", 0)),
    text("PORTUGUÊS · REVISÃO DO 5º DIA", 70, 48, 860, 35, 18, "#56dbc2"),
    text("Contos\nem diálogo.", 65, 128, 670, 210, 76, "#ffffff", "Georgia"),
    text("A cartomante · Machado de Assis\nO Boi Velho · Simões Lopes Neto", 70, 360, 860, 80, 26, "#e2dcf6"),
    text("7º ano  ·  16 perguntas  ·  Tempo livre", 70, 487, 860, 36, 22, "#ffb35c")
  ];
  cover.notes = "Exemplo baseado no 5º dia (3 horas-aula) do Plano de Aula Conto UFRA: revisão e atividade interativa no Prativerso, 7º ano. Pressupõe a leitura mediada dos dois contos nos dias anteriores. Comece retomando gênero, conflito, narrador, tempo, espaço e variação linguística. Use o modo Aprendizagem sem cronômetro: a rapidez não é critério de aprendizagem. Faça avaliação diagnóstica e formativa, com discussão após cada questão. BNCC indicada no planejamento: EF69LP47, EF67LP30, EF69LP55.\nTextos de referência: Machado de Assis, A cartomante, Várias histórias (1896): https://pt.wikisource.org/wiki/A_Cartomante\nSimões Lopes Neto, O Boi Velho, Contos gauchescos (1912): https://pt.wikisource.org/wiki/Contos_gauchescos_(1912)/O_boi_velho";

  const instructions = newSlide("blank", theme);
  instructions.title = "Leia, responda, converse"; instructions.background = {color: "#f8f7fc"};
  instructions.elements = [
    text("UMA LEITURA, MUITAS DESCOBERTAS", 65, 43, 870, 35, 18, "#6546d7"),
    text(instructions.title, 65, 105, 870, 80, 46, "#23213d", "Georgia"),
    shape(65, 212, 870, 243, "#ffffff"),
    text("1. Entre com o código ou QR code.\n2. Responda no seu ritmo, sozinho ou em dupla.\n3. Após cada questão, explique sua escolha.\n4. Procure no conto pistas para sua leitura.", 90, 233, 820, 202, 28),
    text("Errar também ajuda a descobrir o que precisamos retomar.", 65, 483, 870, 43, 22, "#6546d7")
  ];
  instructions.notes = "Organize a participação individualmente ou em duplas, conforme celulares e conectividade. Abra a sala e compartilhe o código/QR code. Aguarde as respostas ou encerre a rodada manualmente, sem avaliar rapidez. Após cada questão, leia a explicação, discuta as alternativas e retome passagens dos contos. Registre dificuldades para retomada. Sem internet: use as mesmas perguntas oralmente ou nos slides exportados, com cartões A/B/C/D; nas questões de verdadeiro/falso, A = Verdadeiro e B = Falso.";

  const rounds: LessonSlide[] = quiz.questions.map((q, index) => {
    const slide = questionSlide(q, theme), item = questions[index];
    slide.title = `${String(index + 1).padStart(2, "0")} · ${q.text.slice(0, 90)}`;
    slide.notes = `Objetivo: ${item.objective}\nGabarito: ${String.fromCharCode(65 + q.correct)} · ${q.options[q.correct]}\n${q.explanation}\nDiscussão após a resposta: ${item.discussion}\nPeça uma justificativa ou pista do conto e acolha as hipóteses antes de retomar o texto.`;
    return slide;
  });
  const closing = newSlide("blank", theme);
  closing.title = "Que ideia você leva desta aula?"; closing.background = {color: "#23213d"};
  closing.elements = [
    text("DA RESPOSTA À REFLEXÃO", 70, 48, 860, 35, 18, "#56dbc2"),
    text("Que ideia você\nleva desta aula?", 65, 149, 870, 175, 58, "#ffffff", "Georgia"),
    text("Compartilhe um aprendizado.\nDiga o que ainda quer entender.", 70, 376, 860, 100, 28, "#e2dcf6")
  ];
  closing.notes = "Convide cada estudante ou dupla a compartilhar um aprendizado e uma dúvida. Retome a comparação entre os contos e o respeito à diversidade linguística. Consulte as respostas e o relatório para escolher o que revisar; considere compreensão, justificativas, escuta e participação, conforme a avaliação formativa prevista no plano. Este exemplo é uma cópia editável: adapte linguagem e perguntas à turma.";
  const presentation = {...newDeck(), title: quiz.title, subject: quiz.subject!, topic: quiz.topic!, theme, mode: quiz.mode!, untimed: true, slides: [cover, instructions, ...rounds, closing]};
  return {quiz, presentation};
}
