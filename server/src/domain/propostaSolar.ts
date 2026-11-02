/** Motor versionado da proposta. Sem parâmetros comerciais implícitos. */
export interface UnidadeSolar { nome: string; meses: number[]; adicionalKwh: number; disponibilidadeKwh: number }
export interface EntradaSolar {
  modo: 'tecnico' | 'excel'; anoInicial: number; ucs: UnidadeSolar[]; hspMensal: number[];
  moduloWp: number; perdasPct: number; larguraM: number; alturaM: number;
  inversorKw: number; oversizingPct: number; quantidadeInstalada: number | null;
  tarifa: number; taxaSem: number; disponibilidadeReais: number; taxaCom: number;
  investimento: number; parcela: number; parcelas: number;
  reajustePct: number; degradacaoInicialPct: number; degradacaoAnualPct: number;
  manutencaoAnual: number; reajusteManutencaoPct: number; trocaInversorAno: number; trocaInversorValor: number;
  poupancaMesPct: number; geracaoAnualExcel: number;
  origemOffGrid?: { id: string; titulo: string; importadoEm: string };
}
export function entradaSolarZerada(): EntradaSolar {
  return { modo: 'tecnico', anoInicial: Number(new Intl.DateTimeFormat('en', {timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date())),
    ucs: [{nome:'UC 1',meses:Array(12).fill(0),adicionalKwh:0,disponibilidadeKwh:0}], hspMensal:Array(12).fill(0),
    moduloWp:0,perdasPct:0,larguraM:0,alturaM:0,inversorKw:0,oversizingPct:0,quantidadeInstalada:null,
    tarifa:0,taxaSem:0,disponibilidadeReais:0,taxaCom:0,investimento:0,parcela:0,parcelas:0,
    reajustePct:0,degradacaoInicialPct:0,degradacaoAnualPct:0,manutencaoAnual:0,reajusteManutencaoPct:0,
    trocaInversorAno:0,trocaInversorValor:0,poupancaMesPct:0,geracaoAnualExcel:0 };
}
const soma = (v: number[]) => v.reduce((a,b)=>a+b,0);
const media = (v: number[]) => soma(v)/12;
export function calcularParcela(valor:number,jurosPct:number,parcelas:number):number {
  if(!(valor>0)||!(parcelas>0)) return 0;
  const i=jurosPct/100, fator=Math.pow(1+i,parcelas);
  return Number((i>0?valor*i*fator/(fator-1):valor/parcelas).toFixed(2));
}
export function calcularProposta(e: EntradaSolar) {
  const erros: string[] = [];
  const numeros = [e.anoInicial,e.moduloWp,e.perdasPct,e.larguraM,e.alturaM,e.inversorKw,e.oversizingPct,e.tarifa,e.taxaSem,e.disponibilidadeReais,e.taxaCom,e.investimento,e.parcela,e.parcelas,e.reajustePct,e.degradacaoInicialPct,e.degradacaoAnualPct,e.manutencaoAnual,e.reajusteManutencaoPct,e.trocaInversorAno,e.trocaInversorValor,e.poupancaMesPct,e.geracaoAnualExcel,...e.hspMensal,...e.ucs.flatMap(u=>[...u.meses,u.adicionalKwh,u.disponibilidadeKwh])];
  if(numeros.some(n=>!Number.isFinite(n)||n<0)) erros.push('Informe números finitos e não negativos.');
  if(e.ucs.length===0 || e.ucs.some(u=>u.meses.length!==12)) erros.push('Informe os 12 meses de cada UC.');
  if(e.hspMensal.length!==12 || e.hspMensal.some(h=>h<=0)) erros.push('Informe HSP positivo nos 12 meses.');
  if(e.perdasPct>=100 || e.degradacaoInicialPct>100 || e.degradacaoAnualPct>100) erros.push('Revise os percentuais de perdas e degradação.');
  if(!Number.isInteger(e.anoInicial)||e.anoInicial<1900||e.anoInicial>2200) erros.push('Ano inicial inválido.');
  if(!Number.isInteger(e.parcelas)||!Number.isInteger(e.trocaInversorAno)||e.trocaInversorAno>25) erros.push('Prazo e ano de substituição devem ser inteiros válidos.');
  if(e.quantidadeInstalada!==null && (!Number.isInteger(e.quantidadeInstalada)||e.quantidadeInstalada<0)) erros.push('Quantidade instalada inválida.');
  const consumoMensal = Array.from({length:12},(_,m)=>soma(e.ucs.map(u=>u.meses[m]??0)));
  const consumoMedio = media(consumoMensal);
  const compensacao = soma(e.ucs.map(u=>Math.max(0,media(u.meses)+u.adicionalKwh-u.disponibilidadeKwh)));
  if(consumoMedio<=0 || compensacao<=0) erros.push('Informe consumo compensável maior que zero.');
  if(e.moduloWp<=0 || e.tarifa<=0 || e.inversorKw<=0) erros.push('Informe potência do módulo, inversor e tarifa maiores que zero.');
  if(e.modo==='tecnico' && (e.larguraM<=0||e.alturaM<=0)) erros.push('Informe as dimensões do módulo.');
  if(e.modo==='excel' && e.geracaoAnualExcel<=0) erros.push('Informe a geração anual inicial da projeção Excel.');
  const hspMedia = media(e.hspMensal);
  const dias = (ano:number,m:number)=>e.modo==='excel'?30:new Date(Date.UTC(ano,m+1,0)).getUTCDate();
  const producaoModulo = e.hspMensal.map((h,m)=>e.moduloWp/1000*(1-e.perdasPct/100)*h*dias(e.anoInicial,m));
  const quantidadeCalculada = media(producaoModulo)>0?compensacao/media(producaoModulo):0;
  const modulosQtd = e.quantidadeInstalada ?? Math.ceil(quantidadeCalculada);
  const potenciaKwp = modulosQtd*e.moduloWp/1000;
  const potenciaNecessariaKwp = hspMedia>0?compensacao/30/hspMedia:0;
  const capacidadeInversor = e.inversorKw*(1+e.oversizingPct/100);
  if(potenciaKwp>capacidadeInversor) erros.push('Potência instalada excede a capacidade do inversor com oversizing.');
  const areaEstimadaM2 = e.modo==='excel'?quantidadeCalculada*2.2:modulosQtd*e.larguraM*e.alturaM;
  const geracaoMensal = e.hspMensal.map((h,m)=>e.modo==='excel'?potenciaNecessariaKwp*h*30:modulosQtd*(producaoModulo[m]??0));
  const geracaoMediaKwh = media(geracaoMensal);
  const contaSemSolar = consumoMedio*e.tarifa+e.taxaSem;
  const residual = e.modo==='excel'?0:media(consumoMensal.map((c,m)=>Math.max(0,c-(geracaoMensal[m]??0))));
  const contaComSolar = residual*e.tarifa+e.disponibilidadeReais+e.taxaCom;
  const economiaOperacional = contaSemSolar-contaComSolar;
  let saldo=-e.investimento, saldoPoupanca=-e.investimento, acumuladoSem=0, paybackAnos:number|null=null;
  const projecao = [];
  let degradacao=1;
  for(let indice=0;indice<25;indice++) {
    if(indice>0) degradacao*=1-(indice===1?e.degradacaoInicialPct:e.degradacaoAnualPct)/100;
    const ano=e.anoInicial+indice, tarifa=e.tarifa*Math.pow(1+e.reajustePct/100,indice);
    const geracoes=e.hspMensal.map((h,m)=>e.modo==='excel'?e.geracaoAnualExcel/12*degradacao:potenciaKwp*(1-e.perdasPct/100)*h*dias(ano,m)*degradacao);
    const despesaAnual= (consumoMedio*e.tarifa+e.taxaSem)*12*Math.pow(1+e.reajustePct/100,indice);
    const custos=e.manutencaoAnual*Math.pow(1+e.reajusteManutencaoPct/100,indice)+(indice+1===e.trocaInversorAno?e.trocaInversorValor:0);
    const receitaAnual=soma(geracoes)*tarifa;
    const beneficio=e.modo==='excel'?receitaAnual:soma(geracoes.map((g,m)=>Math.min(consumoMensal[m]??0,g)*tarifa))+12*(e.taxaSem-e.disponibilidadeReais-e.taxaCom);
    const resultadoAnual=beneficio-custos, anterior=saldo;
    saldo+=resultadoAnual;
    if(paybackAnos===null && e.investimento>0 && anterior<0 && saldo>=0 && resultadoAnual>0) paybackAnos=indice+(-anterior/resultadoAnual);
    let parcelasAno=0;
    for(let mes=0;mes<12;mes++) {
      const parcela=indice*12+mes<e.parcelas?e.parcela:0;
      parcelasAno+=parcela;
      const fluxo=e.modo==='excel'?resultadoAnual/12:Math.min(consumoMensal[mes]??0,geracoes[mes]??0)*tarifa+e.taxaSem-e.disponibilidadeReais-e.taxaCom-custos/12;
      saldoPoupanca+=(saldoPoupanca>0?saldoPoupanca*e.poupancaMesPct/100:0)+fluxo;
    }
    acumuladoSem+=despesaAnual;
    projecao.push({ano,tarifa,despesaAnual,despesaAcumulada:acumuladoSem,geracaoAnual:soma(geracoes),receitaAnual,custos,resultadoAnual,parcelasAno,resultadoAposParcelas:resultadoAnual-parcelasAno,saldoAcumulado:saldo,saldoComPoupanca:e.modo==='excel'?saldo*(1+e.poupancaMesPct/100):saldoPoupanca});
  }
  const resultado={versao:1 as const,entradas:e,completo:erros.length===0,erros,consumoMedio,compensacao,hspMedia,quantidadeCalculada,modulosQtd,potenciaKwp,potenciaNecessariaKwp,capacidadeInversor,areaEstimadaM2,geracaoMensal,geracaoMediaKwh,coberturaPct:consumoMedio>0?geracaoMediaKwh/consumoMedio*100:0,contaSemSolar,contaComSolar,valorGeracaoMensal:geracaoMediaKwh*e.tarifa,economiaOperacional,economiaMensal:economiaOperacional-(e.parcelas>0?e.parcela:0),economiaAnual:economiaOperacional*12,economia25Anos:saldo,paybackAnos,projecao};
  if(JSON.stringify(resultado).includes(':null') && numeros.some(n=>!Number.isFinite(n))) resultado.completo=false;
  return resultado;
}
export type CalculoSolar = ReturnType<typeof calcularProposta>;
