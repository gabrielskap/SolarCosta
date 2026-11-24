import React from 'react';
import type {CalculoSolar} from '../../server/src/domain/propostaSolar';
export function PropostaProjecao({calculo:c}:{calculo?:CalculoSolar}) {
  if(!c) return <p>Proposta anterior ao cálculo versionado. Revise os cálculos na edição para gerar uma projeção com premissas registradas. Indicadores originais preservados.</p>;
  const comParcelas = c.entradas.considerarParcelasPayback === true && c.entradas.parcelas > 0;
  const investimentoInicial = comParcelas ? c.entradas.entradaFinanciamento ?? 0 : c.entradas.investimento;
  return <div className="space-y-3">
    <h2 className="text-xl font-bold text-[#004276]">Projeção financeira em 25 anos</h2>
    <p className="text-xs">Modo: {c.entradas.modo==='excel'?'Por demanda de consumo':'Por equipamentos instalados'} · Reajuste: {c.entradas.reajustePct}% a.a. · Degradação: {c.entradas.degradacaoInicialPct}% na primeira transição e {c.entradas.degradacaoAnualPct}% nas seguintes.</p>
    <p className="text-xs">{comParcelas ? 'Entrada do financiamento' : 'Investimento inicial'}: R$ {investimentoInicial.toLocaleString('pt-BR',{minimumFractionDigits:2})}. {comParcelas ? 'As parcelas são descontadas do saldo e consideradas no payback durante o prazo do financiamento.' : 'Saldo e payback calculados pelo valor do sistema, sem descontar parcelas do financiamento.'}</p>
    <table className="w-full text-[9px] text-right border-collapse"><thead><tr className="bg-[#004276] text-white">{['Ano','Geração kWh','Sem solar R$','Valor geração R$','Custos R$','Resultado R$',...(comParcelas ? ['Parcelas R$'] : []),'Saldo R$','Com poupança R$'].map(t=><th key={t} className="p-1">{t}</th>)}</tr></thead><tbody>{c.projecao.map(a=><tr key={a.ano} className="border-b border-slate-200 even:bg-slate-50"><td className="p-1">{a.ano}</td>{[a.geracaoAnual,a.despesaAnual,a.receitaAnual,a.custos,a.resultadoAnual,...(comParcelas ? [a.parcelasAno] : []),a.saldoAcumulado,a.saldoComPoupanca].map((v,i)=><td key={i} className="p-1">{v.toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>)}</tr>)}</tbody></table>
    <p className="text-xs">Saldo final: R$ {c.economia25Anos.toLocaleString('pt-BR',{minimumFractionDigits:2})}. Retorno: {c.paybackAnos==null?'Sem retorno no período':c.paybackAnos.toLocaleString('pt-BR',{maximumFractionDigits:1})+' anos'}.</p>
    <p className="text-[10px] text-slate-500">Estimativas baseadas nas premissas informadas. Não representam garantia de geração ou retorno. O valor da geração difere da economia efetiva; excedentes não geram receita automática no modo técnico.</p>
  </div>;
}
