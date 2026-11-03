// Requer npm run build. Exercita componentes reais com dados fictícios, sem acessar serviços externos.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
const requireServer = createRequire(resolve('server/package.json'));
const puppeteer = requireServer('puppeteer-core');
const destino = resolve('build/financiamento-qa');
await mkdir(destino, { recursive: true });
const cssNome = (await readdir('dist/assets')).find(n => n.endsWith('.css'));
assert(cssNome, 'Execute npm run build antes do teste visual.');
const css = await readFile(join('dist/assets', cssNome));
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {ProposalCalculatorView} from './src/components/ProposalCalculatorView';
    import {PDFModal} from './src/components/PDFModal';
    import {Api} from './src/services/api';
    import {http} from './src/services/http';
    import {calcularProposta,entradaSolarZerada} from './server/src/domain/propostaSolar';
    Api.getUsuarios=async()=>[];
    http.get=async()=>({placas:[]});
    const e={...entradaSolarZerada(),anoInicial:2026,ucs:[{nome:'UC 1',meses:Array(12).fill(1000),adicionalKwh:0,disponibilidadeKwh:0}],
      hspMensal:Array(12).fill(5.2),moduloWp:710,perdasPct:24,larguraM:2,alturaM:1.1,inversorKw:14,oversizingPct:30,
      tarifa:1.19,taxaSem:33.73,disponibilidadeReais:99,taxaCom:33,investimento:15990,parcela:647.66,parcelas:36};
    const c=calcularProposta(e);
    const p={id:'e944d60d-8951-4c2a-b03f-48ef29b936b5',numero:'PROP-QA',clienteNome:'Cliente de teste',cidade:'Belo Horizonte / MG',
      dataCriacao:'03/11/2026',status:'rascunho',formaPagamento:'financiamento',valorTotal:15990,valorTotalAjustado:15990,
      entradaFinanciamentoPct:0,entradaFinanciamentoValor:0,jurosFinanciamentoMesPct:2.2,parcelasFinanciamento:36,
      consumoKwh:1000,tarifaKwh:1.19,hsp:5.2,perdasPct:24,moduloWp:710,potenciaKwp:c.potenciaKwp,modulosQtd:c.modulosQtd,
      geracaoMediaKwh:c.geracaoMediaKwh,areaEstimadaM2:c.areaEstimadaM2,economiaMensal:c.economiaMensal,economiaAnual:c.economiaAnual,
      economia25Anos:c.economia25Anos,paybackAnos:c.paybackAnos,coberturaPct:c.coberturaPct,calculoSolar:c,
      custoDisponibilidade:99,iluminacaoPublicaComSfcr:33,iluminacaoPublicaSemSfcr:33.73,
      kitItens:[{id:'item-1',descricao:'Kit de teste',qtd:1,valorUnit:15990,total:15990}]};
    const root=createRoot(document.getElementById('root'));let chave=0;
    window.renderMode=(modo,extra={})=>{window.salva=null;window.abriuPDF=false;window.toast=null;
      const proposta={...p,...extra};
      root.render(modo==='formulario'?<ProposalCalculatorView key={++chave} propostaExistente={proposta}
        propostas={[]} produtos={[]} kits={[]} leads={[]} config={{google_maps_ativo:false,parametros:[],concessionarias:[],telhados:[]}}
        currentUser={{id:'qa',nome:'Teste',cargo:'Administrador'}}
        onSaveProposal={async p=>{window.salva=p;return p;}} onOpenPDF={()=>{window.abriuPDF=true;}}
        showToast={(...args)=>{window.toast=args;}} />:
        <PDFModal key={++chave} type="proposta" data={proposta} variante={modo==='publico'?'pagina':'modal'} onClose={()=>{}}/>);
    };
    window.renderMode('formulario');
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
  loader: { '.png': 'dataurl', '.jpg': 'dataurl' },
});
const js = bundle.outputFiles[0].contents;
const servidor = createServer((req, res) => {
  res.setHeader('Content-Type',req.url==='/qa.js'?'text/javascript':req.url==='/qa.css'?'text/css':'text/html; charset=utf-8');
  res.end(req.url==='/qa.js'?js:req.url==='/qa.css'?css:'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="/qa.css"><div id="root"></div><script src="/qa.js"></script></html>');
});
await new Promise(r => servidor.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1080,deviceScaleFactor:1});
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('data:')?r.continue():r.abort());
  const erros=[];page.on('pageerror',e=>{erros.push(e.message);console.error('Erro no navegador:',e.message);});
  await page.goto(`http://127.0.0.1:${servidor.address().port}`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.body.innerText.length>0);
  const texto=()=>page.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const render=async(modo,extra={})=>{await page.evaluate((m,e)=>window.renderMode(m,e),modo,extra);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const preencher=async(label,valor)=>{await page.$eval(`[aria-label="${label}"]`,(el,v)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);
    el.dispatchEvent(new Event('input',{bubbles:true}));},String(valor));};
  const clicar=async(t)=>{await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes(t)).click(),t);};
  const campo=label=>page.$eval(`[aria-label="${label}"]`,el=>Number(el.value));
  assert.equal(await campo('Valor da parcela'),647.66);assert.equal(await campo('Total com entrada'),23315.76);assert.equal(await campo('Juros totais'),7325.76);
  await preencher('Prazo do financiamento (meses)',13);
  await preencher('Juros mensais (%)',0);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Valor da parcela"]').value==='1230');
  await clicar('Salvar alterações');await page.waitForFunction(()=>window.salva);
  assert.equal(await page.evaluate(()=>window.salva.jurosFinanciamentoMesPct),0);
  assert.equal(await page.evaluate(()=>window.salva.calculoSolar.entradas.parcela),1230);
  await preencher('Juros mensais (%)','');
  await page.waitForFunction(()=>document.body.innerText.includes('Aguardando simulação'));
  await clicar('Salvar alterações');await page.waitForFunction(()=>window.salva.jurosFinanciamentoMesPct===undefined);
  await clicar('Gerar proposta em PDF');
  assert.equal(await page.evaluate(()=>window.abriuPDF),false);
  assert.equal(await page.evaluate(()=>window.toast[0]),'Financiamento incompleto');
  await render('formulario',{parcelasFinanciamento:null,jurosFinanciamentoMesPct:null});
  await page.waitForFunction(()=>document.querySelector('[aria-label="Juros mensais (%)"]').value==='');
  assert.equal(await page.$eval('[aria-label="Prazo do financiamento (meses)"]',e=>e.value),'');
  await preencher('Prazo do financiamento (meses)',36);await preencher('Juros mensais (%)',2.2);
  await preencher('Entrada (%)',20);await page.waitForFunction(()=>document.querySelector('[aria-label="Valor da parcela"]').value==='518.13');
  const ajustes={entradaValor:1000,valorFinanciado:14000,parcela:600,totalPrestacoes:21000,jurosTotais:6500,totalPago:23000};
  for (const [label,valor] of [['Valor da entrada',1000],['Valor financiado',14000],['Valor da parcela',600],['Total das prestações',21000],['Juros totais',6500],['Total com entrada',23000]])
    await preencher(label,valor);
  await preencher('Juros mensais (%)',3);
  assert.equal(await campo('Valor da parcela'),600);assert.equal(await campo('Total com entrada'),23000);
  await clicar('Salvar alterações');await page.waitForFunction(()=>window.salva?.financiamentoAjustes?.totalPago===23000);
  assert.deepEqual(await page.evaluate(()=>window.salva.financiamentoAjustes),ajustes);
  assert.equal(await page.evaluate(()=>window.salva.calculoSolar.entradas.parcela),600);
  await page.$eval('[aria-label="Entrada (%)"]',e=>{e.parentElement.parentElement.parentElement.parentElement.dataset.qa='pagamento';});
  await (await page.$('[data-qa="pagamento"]')).screenshot({path:join(destino,'formulario-desktop.png')});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await clicar('Pagamento');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Entrada (%)"]').getClientRects().length>0);
  await (await page.$('[data-qa="pagamento"]')).screenshot({path:join(destino,'formulario-mobile.png')});
  assert.equal(await page.$eval('[data-qa="pagamento"]',e=>e.scrollWidth<=e.clientWidth),true,'pagamento cabe no celular');
  await page.$eval('[aria-label="Restaurar valor da parcela"]',e=>e.click());
  assert.equal(await campo('Total com entrada'),23000,'restaurar parcela mantém os outros ajustes');
  await clicar('Restaurar todos os valores calculados');
  await preencher('Juros mensais (%)',2.2);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Valor da parcela"]').value==='518.13');
  await page.setViewport({width:1440,height:1080,deviceScaleFactor:1});
  for(const modo of ['pdf','publico']) {
    await render(modo);await page.waitForSelector('.folha-pdf');
    assert.match(await texto(),/647,66/);assert.match(await texto(),/23\.315,76/);assert.match(await texto(),/7\.325,76/);
    const folha=await page.$('.folha-pdf');await folha.screenshot({path:join(destino,`${modo}-primeira-folha.png`)});
    if(modo==='publico') {
      const pdf=await page.pdf({path:join(destino,'proposta-financiamento.pdf'),format:'A4',printBackground:true});
      const folhas=await page.$$eval('.folha-pdf',els=>els.length);
      assert.equal((Buffer.from(pdf).toString('latin1').match(/\/Type \/Page\b/g)||[]).length,folhas,'cada folha ocupa uma página sem transbordamento');
    }
  }
  await render('publico',{formaPagamento:'avista',jurosFinanciamentoMesPct:null,parcelasFinanciamento:null});
  await page.waitForFunction(()=>document.body.innerText.includes('Financiamento não simulado'));
  assert.doesNotMatch(await texto(),/Plano em 60 meses|1[.,]45%/);
  await render('publico',{calculoSolar:null,jurosFinanciamentoMesPct:null});
  await page.waitForSelector('[role="alert"]');
  assert.match(await texto(),/Financiamento não simulado/);
  await render('publico',{financiamentoAjustes:ajustes});
  assert.match(await texto(),/600,00/);assert.match(await texto(),/23\.000,00/);assert.match(await texto(),/6\.500,00/);
  assert.match(await texto(),/Valores ajustados manualmente/);
  await (await page.$('.folha-pdf')).screenshot({path:join(destino,'pdf-ajustes-manuais.png')});
  assert.deepEqual(erros,[]);
  console.log(`Financiamento UI: edição de todos os resultados, restauração, salvamento e PDFs interno/público passaram. Evidências em ${destino}`);
} finally {await browser?.close();await new Promise(r=>servidor.close(r));}
