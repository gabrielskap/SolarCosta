import assert from 'node:assert/strict';
import {calcularProposta,entradaSolarZerada,calcularParcela,type EntradaSolar} from '../server/src/domain/propostaSolar';
import {entradaSolarSchema,resultadosProposta} from '../server/src/schemas/propostaSolar';
import {calcularFinanciamento,financiamentoDaProposta} from '../server/src/domain/financiamento';
const perto=(a:number,b:number)=>assert.ok(Math.abs(a-b)<0.00001,`${a} != ${b}`);
const base=():EntradaSolar=>({...entradaSolarZerada(),anoInicial:2026,ucs:[{nome:'UC 1',meses:Array(12).fill(1000),adicionalKwh:0,disponibilidadeKwh:0}],hspMensal:Array(12).fill(5.20667),moduloWp:710,perdasPct:24,larguraM:2.2,alturaM:1.1,inversorKw:14,oversizingPct:30,tarifa:1.19,taxaSem:33.73,disponibilidadeReais:99,taxaCom:33,investimento:22490});
const zero=entradaSolarZerada();
for(const [k,v] of Object.entries(zero)) if(typeof v==='number'&&k!=='anoInicial') assert.equal(v,0,k);
assert.deepEqual(zero.hspMensal,Array(12).fill(0));assert.deepEqual(zero.ucs[0].meses,Array(12).fill(0));
assert.equal(calcularProposta(zero).completo,false);assert.ok(!JSON.stringify(calcularProposta(zero)).includes('NaN'));
const excel=calcularProposta({...base(),modo:'excel',geracaoAnualExcel:12000});
assert.equal(excel.completo,true);assert.equal(excel.modulosQtd,12);perto(excel.potenciaKwp,8.52);perto(excel.capacidadeInversor,18.2);
perto(excel.quantidadeCalculada,1000/30/5.20667*1000/(710*0.76));perto(excel.areaEstimadaM2,excel.quantidadeCalculada*2.2);
perto(excel.geracaoMediaKwh,1000);perto(excel.contaSemSolar,1223.73);perto(excel.contaComSolar,132);perto(excel.economiaMensal,1091.73);
assert.notEqual(excel.valorGeracaoMensal,excel.economiaMensal);
const tecnico=calcularProposta(base());assert.equal(tecnico.completo,true);perto(tecnico.areaEstimadaM2,tecnico.modulosQtd*2.2*1.1);
perto(tecnico.geracaoMensal[1],8.52*0.76*5.20667*28);perto(tecnico.geracaoMensal[0],8.52*0.76*5.20667*31);
const bissexto=calcularProposta({...base(),anoInicial:2028});perto(bissexto.geracaoMensal[1],8.52*0.76*5.20667*29);
perto(excel.geracaoMensal[0],excel.geracaoMensal[1]);
const multi=calcularProposta({...base(),ucs:[...base().ucs,{nome:'UC 2',meses:Array(12).fill(500),adicionalKwh:20,disponibilidadeKwh:30}]});
perto(multi.consumoMedio,1500);perto(multi.compensacao,1490);
assert.equal(entradaSolarSchema.safeParse({...base(),hspMensal:[5]}).success,false);
assert.equal(entradaSolarSchema.safeParse({...base(),ucs:[{...base().ucs[0],meses:[1,2]}]}).success,false);
// DC/AC acima do declarado é AVISO: a conta fecha e a proposta sai. Travar a
// emissão aqui barrava todo sistema com micro inversor, que oversiza por projeto.
const apertado=calcularProposta({...base(),inversorKw:1});
assert.equal(apertado.completo,true);
assert.deepEqual(apertado.erros,[]);
assert.ok(apertado.avisos.some(a=>a.includes('(8,52 kWp)')&&a.includes('(1 kW com 30% de oversizing)')&&a.includes('DC/AC de 8,52')));
assert.deepEqual(calcularProposta(base()).avisos,[]);
// Sem inversor informado não há o que comparar: o campo que falta é o único
// erro, e nenhum aviso de excesso aparece contra uma capacidade de 0.
const semInversor=calcularProposta({...base(),inversorKw:0});
assert.equal(semInversor.completo,false);
assert.ok(semInversor.erros.includes('Informe potência do módulo, inversor e tarifa maiores que zero.'));
assert.deepEqual(semInversor.avisos,[]);
const excesso=calcularProposta({...base(),quantidadeInstalada:24});assert.ok(excesso.valorGeracaoMensal>excesso.consumoMedio*1.19);perto(excesso.economiaOperacional,1091.73);
const parcial=calcularProposta({...base(),quantidadeInstalada:1});assert.ok(parcial.contaComSolar>132);
const degradacao=calcularProposta({...base(),modo:'excel',geracaoAnualExcel:12000,degradacaoInicialPct:1,degradacaoAnualPct:0.7,reajustePct:6});
perto(degradacao.projecao[1].geracaoAnual,11880);perto(degradacao.projecao[2].geracaoAnual,11880*0.993);
perto(degradacao.projecao[1].tarifa,1.19*1.06);
perto(degradacao.projecao[0].saldoAcumulado,degradacao.projecao[0].resultadoAnual-22490);
perto(degradacao.projecao[1].saldoAcumulado,degradacao.projecao[0].saldoAcumulado+degradacao.projecao[1].resultadoAnual);
const custos=calcularProposta({...base(),manutencaoAnual:200,trocaInversorAno:3,trocaInversorValor:3000});perto(custos.projecao[2].custos,3200);
const financiamento=calcularProposta({...base(),parcela:2136,parcelas:13});perto(financiamento.economiaMensal,tecnico.economiaOperacional-2136);perto(financiamento.projecao[0].parcelasAno,2136*12);perto(financiamento.projecao[1].parcelasAno,2136);perto(financiamento.projecao[2].parcelasAno,0);perto(financiamento.economia25Anos,tecnico.economia25Anos);
assert.equal(calcularProposta({...base(),investimento:1e9}).paybackAnos,null);
assert.ok(tecnico.paybackAnos!>0 && tecnico.paybackAnos!<25);
const poupExcel=calcularProposta({...base(),modo:'excel',geracaoAnualExcel:12000,poupancaMesPct:0.3});perto(poupExcel.projecao[0].saldoComPoupanca,poupExcel.projecao[0].saldoAcumulado*1.003);
const poupZero=calcularProposta({...base(),poupancaMesPct:0});perto(poupZero.projecao[24].saldoComPoupanca,poupZero.projecao[24].saldoAcumulado);
const negativo=calcularProposta({...base(),investimento:1e9,poupancaMesPct:1});perto(negativo.projecao[0].saldoComPoupanca,negativo.projecao[0].saldoAcumulado);
perto(calcularParcela(1200,0,12),100);perto(calcularParcela(1200,1,0),0);
// Valores de referência: imagem da proposta e exemplo oficial da Calculadora do Cidadão.
const condicoes={investimento:15990,entradaPct:0,parcelas:36,jurosMesPct:2.2};
const f=calcularFinanciamento(condicoes);
assert.equal(f.completo,true);assert.equal(f.parcela,647.66);assert.equal(f.valorFinanciado,15990);
assert.equal(f.totalPrestacoes,23315.76);assert.equal(f.jurosTotais,7325.76);assert.equal(f.totalPago,23315.76);
assert.equal(calcularFinanciamento({investimento:1290,parcelas:4,jurosMesPct:1.99}).parcela,338.70);
const comEntrada=calcularFinanciamento({...condicoes,entradaPct:20});
assert.equal(comEntrada.entradaValor,3198);assert.equal(comEntrada.valorFinanciado,12792);
assert.equal(comEntrada.parcela,518.13);assert.equal(comEntrada.totalPrestacoes,18652.68);
assert.equal(comEntrada.totalPago,21850.68);assert.equal(comEntrada.jurosTotais,5860.68);
const semJuros=calcularFinanciamento({investimento:1200,parcelas:12,jurosMesPct:0});
assert.equal(semJuros.completo,true);assert.equal(semJuros.parcela,100);assert.equal(semJuros.jurosTotais,0);
assert.equal(calcularFinanciamento({...condicoes,parcelas:1}).parcela,16341.78);
for(const invalido of [
  {jurosMesPct:undefined},{jurosMesPct:null},{jurosMesPct:-1},{jurosMesPct:Infinity},{jurosMesPct:NaN},
  {jurosMesPct:0.0001},{jurosMesPct:1000},{parcelas:undefined},{parcelas:0},{parcelas:-1},{parcelas:1.5},{parcelas:1201},
  {entradaPct:-1},{entradaPct:100},{entradaPct:101},{entradaPct:0.001},{entradaPct:NaN},{investimento:0},{investimento:Infinity},
]) {
  const r=calcularFinanciamento({...condicoes,...invalido});
  assert.equal(r.completo,false,JSON.stringify(invalido));assert.equal(r.parcela,0);assert.equal(r.totalPago,0);
}
assert.equal(calcularFinanciamento({...condicoes,parcelas:1200,jurosMesPct:999.999}).completo,true);
assert.equal(calcularParcela(15990,0.00000001,36),444.17,'taxas pequenas não perdem precisão');
assert.equal(calcularFinanciamento({...condicoes,investimento:15990.01,entradaPct:33.33}).entradaValor,5329.47);
const propostaFin={valorTotal:15990,entradaFinanciamentoPct:20,parcelasFinanciamento:36,jurosFinanciamentoMesPct:2.2};
assert.deepEqual(financiamentoDaProposta(propostaFin),comEntrada,'PDF e tela usam o mesmo resultado');
assert.equal(financiamentoDaProposta({...propostaFin,entradaFinanciamentoPct:undefined,entradaFinanciamentoValor:1000.01}).entradaValor,1000.01);
assert.equal(financiamentoDaProposta({...propostaFin,jurosFinanciamentoMesPct:undefined}).completo,false);
assert.equal(financiamentoDaProposta({...propostaFin,entradaFinanciamentoValor:9999}).entradaValor,3198,'entrada em reais é derivada do percentual');
const negociada=calcularFinanciamento({...condicoes,ajustes:{entradaValor:1000,valorFinanciado:14000,parcela:600,totalPrestacoes:21000,jurosTotais:6500,totalPago:23000}});
assert.equal(negociada.completo,true);
assert.equal(negociada.ajusteManual,true);
for(const [campo,valor] of Object.entries({entradaValor:1000,valorFinanciado:14000,parcela:600,totalPrestacoes:21000,jurosTotais:6500,totalPago:23000}))
  assert.equal(negociada[campo as keyof typeof negociada],valor,`${campo} respeita ajuste individual`);
const outraTaxa=calcularFinanciamento({...condicoes,jurosMesPct:3,ajustes:{parcela:600,totalPago:23000}});
assert.equal(outraTaxa.parcela,600);assert.equal(outraTaxa.totalPago,23000,'recálculo não apaga ajustes');
assert.equal(outraTaxa.totalPrestacoes,21600,'campos sem ajuste acompanham a parcela manual');
assert.deepEqual(calcularFinanciamento({...condicoes,ajustes:{}}),f,'limpar ajustes restaura a simulação');
for(const ajustes of [{parcela:0},{parcela:-1},{parcela:1.001},{jurosTotais:-1},{totalPago:Infinity},{entradaValor:16000},{valorFinanciado:0}])
  assert.equal(calcularFinanciamento({...condicoes,ajustes}).completo,false);
assert.equal(calcularFinanciamento({...condicoes,ajustes:{jurosTotais:0,totalPago:0}}).completo,true,'zero explícito nos totais é preservado');
const snapshot=JSON.parse(JSON.stringify(tecnico));perto(resultadosProposta(snapshot.entradas).calculo.economia25Anos,tecnico.economia25Anos);
console.log('Propostas: zeros iniciais, UCs, modos, calendário, economia, financiamento, custos, payback, poupança e snapshot passaram.');
