import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";
import {readSheet} from "read-excel-file/node";

// Exercise the actual parsers without a browser, network or production data.
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"quizedu-authoring-"));let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const rejects=(operation,expression)=>{assert.throws(operation,expression);checks++;};
try{
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');
  for(const name of ["quiz","question-import"]){const source=await fs.readFile(`lib/${name}.ts`,"utf8");let output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;output=output.replace('from "./quiz"','from "./quiz.js"');await fs.writeFile(path.join(temp,name+".js"),output);}
  const {newQuestion,newQuiz,applyQuestionTemplate,emptyQuestion,questionIssues,quizError}=await import(pathToFileURL(path.join(temp,"quiz.js")));
  const {IMPORT_EXAMPLE,IMPORT_CSV,parseQuestionText,parseQuestionCsv,parseQuestionRows,importNeedsReview}=await import(pathToFileURL(path.join(temp,"question-import.js")));
  const blank=newQuestion();eq(blank.correct,-1,"A new question must not silently mark A as correct.");eq(blank.options.length,4);ok(emptyQuestion(blank));eq(newQuiz().questions[0].correct,-1);
  const tf=newQuestion("true_false",{seconds:60});eq(tf.options,["Verdadeiro","Falso"]);eq(tf.correct,-1);eq(tf.seconds,60);ok(emptyQuestion(tf));eq(emptyQuestion({...tf,correct:0}),false);
  eq(newQuestion("scenario",{seconds:45,optionCount:3}).options.length,3);eq(newQuestion("image",{seconds:45}).seconds,45);eq(newQuestion("multiple",{seconds:25,optionCount:1}).seconds,30);eq(newQuestion("multiple",{optionCount:9}).options.length,4);
  const complete={...blank,text:"Qual prática protege o solo?",options:["Cobertura vegetal","Queimada"],correct:0,explanation:"A cobertura reduz a erosão."};eq(questionIssues(complete),[]);eq(quizError({title:"Aula",questions:[complete]}),null);ok(!emptyQuestion(complete));ok(emptyQuestion({...blank,correct:0}),"Empty drafts from the old editor can be replaced by an import.");
  const transformed=applyQuestionTemplate({...complete,image:"/api/media/"+crypto.randomUUID(),optionImages:["",""],seconds:60},"true_false");eq(transformed.options,["Verdadeiro","Falso"]);eq(transformed.correct,-1);eq(transformed.text,complete.text);eq(transformed.explanation,complete.explanation);eq(transformed.seconds,60);ok(transformed.image);eq(transformed.optionImages,undefined);
  const practical=applyQuestionTemplate(complete,"scenario");eq(practical.options,complete.options);eq(practical.correct,0);eq(practical.kind,"scenario");eq(applyQuestionTemplate(transformed,"multiple").correct,-1);
  ok(questionIssues({...complete,correct:-1}).some(i=>i.field==="correct"&&i.severity==="error"));ok(questionIssues({...complete,kind:"image"}).some(i=>i.field==="image"&&i.severity==="error"));ok(questionIssues({...complete,options:["Solo fértil"," solo   FÉRTIL "]}).some(i=>i.field==="options"));ok(questionIssues({...complete,text:"x".repeat(241)}).some(i=>i.severity==="warning"));ok(!questionIssues({...complete,text:"x".repeat(241)}).some(i=>i.severity==="error"));ok(questionIssues({...complete,options:[1,"B"]}).some(i=>i.severity==="error"));ok(questionIssues({...complete,kind:"true_false"}).some(i=>i.field==="options"));ok(questionIssues({...complete,image:"/api/media/"+crypto.randomUUID()}).some(i=>i.field==="imageAlt"&&i.severity==="warning"));
  const example=parseQuestionText(IMPORT_EXAMPLE);eq(example.items.length,2);eq(example.items.map(i=>i.question.correct),[0,0]);eq(example.items[0].question.options.length,3);eq(example.items[1].question.kind,"true_false");eq(example.items[1].question.options,["Verdadeiro","Falso"]);eq(example.items.some(importNeedsReview),false);
  const text=parseQuestionText("1. Primeira pergunta?\nA) Um\nB) Dois\n\n2. Segunda pergunta?\nA) Três\nB) Quatro\nGabarito: 1-B; 2-A");eq(text.items.map(i=>i.question.correct),[1,0]);eq(text.items[1].question.text,"Segunda pergunta?");
  const starred=parseQuestionText("Qual alternativa?\n*A) Escolha correta\nB) Outra escolha");eq(starred.items[0].question.correct,0);
  const missing=parseQuestionText("1. Uma pergunta?\nA) Uma resposta\nB) Outra resposta");eq(missing.items[0].question.correct,-1);ok(importNeedsReview(missing.items[0]));
  const conflict=parseQuestionText("1. Uma pergunta?\n*A) Uma resposta\nB) Outra resposta\nResposta: B");eq(conflict.items[0].question.correct,-1);ok(conflict.items[0].notes.length);
  const duplicates=parseQuestionText("1. Uma pergunta?\nA) Uma resposta\nA) Outra resposta\nB) Terceira resposta");ok(duplicates.items[0].fatal.length);
  const gap=parseQuestionText("1. Uma pergunta?\nA) Uma resposta\nC) Terceira resposta\nResposta: C");eq(gap.items[0].question.options,["Uma resposta","","Terceira resposta"]);eq(gap.items[0].question.correct,2);ok(importNeedsReview(gap.items[0]));
  const wrapped=parseQuestionText("1. Um enunciado\ncom duas linhas?\nA) Uma resposta\ncontinua aqui\nB) Outra resposta\nResposta: A\nExplicação: Uma explicação\ncom duas linhas.");eq(wrapped.items[0].question.text,"Um enunciado\ncom duas linhas?");eq(wrapped.items[0].question.options[0],"Uma resposta\ncontinua aqui");eq(wrapped.items[0].question.explanation,"Uma explicação\ncom duas linhas.");
  const falseText=parseQuestionText("A chuva nunca causa erosão.\nResposta: Falso\n\nA cobertura vegetal protege o solo.\nResposta: Verdadeiro");eq(falseText.items.length,2);eq(falseText.items.map(i=>i.question.correct),[1,0]);
  const timing=parseQuestionText("1. Uma pergunta?\nA) Sim\nB) Não\nResposta: A\nTempo: 25",45);eq(timing.items[0].question.seconds,45);ok(timing.items[0].notes[0].includes("25"));
  ok(parseQuestionText("1. "+"x".repeat(401)+"\nA) Um\nB) Dois").items[0].fatal.length);
  ok(parseQuestionText("1. Pergunta?\nA) Um\nB) Dois\nC) Três\nD) Quatro\nE) Cinco").items[0].fatal.length);
  rejects(()=>parseQuestionText("1. P?\nA) A\nB) B\nGabarito: 9-A"),/9/);rejects(()=>parseQuestionText("1. P?\nA) A\nB) B\nGabarito: 1-A\nGabarito: 1-B"),/dois gabaritos/);rejects(()=>parseQuestionText("x".repeat(524289)),/512 KB/);
  const csv=parseQuestionCsv(IMPORT_CSV);eq(csv.items.length,2);eq(csv.items.map(i=>i.question.correct),[0,0]);eq(csv.items[1].question.kind,"true_false");eq(csv.items.some(importNeedsReview),false);
  const quoted=parseQuestionCsv('Pergunta,A,B,Correta,Explicação\r\n"Pergunta, com vírgula?","Diz ""sim""","Diz não",2,"Linha 1\nLinha 2"');eq(quoted.items[0].question.text,"Pergunta, com vírgula?");eq(quoted.items[0].question.options[0],'Diz "sim"');eq(quoted.items[0].question.correct,1);eq(quoted.items[0].question.explanation,"Linha 1\nLinha 2");
  eq(parseQuestionCsv("Pergunta\tA\tB\tCorreta\nPergunta?\tSim\tNão\tB").items[0].question.correct,1);
  rejects(()=>parseQuestionCsv('Pergunta;A;B\n"Aspas abertas;Sim;Não'),/aspas abertas/);rejects(()=>parseQuestionCsv('Pergunta;A;B\n"Fechada"texto;Sim;Não'),/fora das aspas/);rejects(()=>parseQuestionRows([["A","B","Correta"],["A","B","A"]]),/coluna Pergunta/);rejects(()=>parseQuestionRows([["Pergunta","Enunciado","A","B"],["P?","P?","A","B"]]),/repetida/);
  const noKey=parseQuestionRows([["Enunciado","A","B"],["Pergunta?","A","B"]]);eq(noKey.items[0].question.correct,-1);ok(noKey.notes.length);
  const international=parseQuestionRows([["Question - max 95 characters","Answer 1 - max 60 characters","Answer 2 - max 60 characters","Correct answer(s)","Time limit (sec)"],["Question?","One","Two",2,60]]);eq(international.items[0].question.correct,1);eq(international.items[0].question.seconds,60);
  const truthRows=parseQuestionRows([["Pergunta","Correta"],["Uma afirmação.",false],["Outra afirmação.",true]]);eq(truthRows.items.map(i=>i.question.correct),[1,0]);eq(truthRows.items[0].question.kind,"true_false");eq(truthRows.items[0].notes,[]);
  const reversed=parseQuestionRows([["Pergunta","A","B","Modelo"],["Afirmação.","Falso","Verdadeiro","Verdadeiro ou falso"]]);ok(reversed.items[0].fatal.length);
  const unavailable=parseQuestionRows([["Pergunta","A","B","Correta","Tempo"],["P?","A","B","A",25]],60);eq(unavailable.items[0].question.seconds,60);ok(unavailable.items[0].notes.length);
  const duplicateOptions=parseQuestionRows([["Pergunta","A","B","Correta"],["P?","Mesmo","mesmo","Mesmo"]]);eq(duplicateOptions.items[0].question.correct,-1);
  const count=Array.from({length:100},(_,i)=>`${i+1}. Pergunta ${i+1}?\nA) Sim\nB) Não\nResposta: A`).join("\n\n");eq(parseQuestionText(count).items.length,100);rejects(()=>parseQuestionText(count+"\n\n101. Pergunta?\nA) Sim\nB) Não"),/até 100/);
  const rows=await readSheet("tests/fixtures/question-import.xlsx");const excel=parseQuestionRows(rows);eq(excel.items.length,2);eq(excel.items[0].question.correct,0);eq(excel.items[0].question.seconds,30);eq(excel.items[1].question.correct,0);eq(excel.items[1].question.kind,"true_false");eq(excel.items.some(importNeedsReview),false);
  console.log(`✓ Question templates, explicit answer marking, text/CSV/Excel import, ambiguity checks, multiline content and review. ${checks} checks passed.`);
}finally{await fs.rm(temp,{recursive:true,force:true});}
