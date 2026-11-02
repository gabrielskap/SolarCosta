import { z } from 'zod';
import { calcularProposta, type EntradaSolar } from '../domain/propostaSolar.js';
const n=z.number().finite().nonnegative();
const pct=n.max(100);
export const entradaSolarSchema=z.object({
  modo:z.enum(['tecnico','excel']),anoInicial:z.number().int().min(1900).max(2200),
  ucs:z.array(z.object({nome:z.string().max(120),meses:z.array(n).length(12),adicionalKwh:n,disponibilidadeKwh:n})).min(1).max(100),
  hspMensal:z.array(n.max(24)).length(12),moduloWp:n.int(),perdasPct:n.lt(100),larguraM:n,alturaM:n,
  inversorKw:n,oversizingPct:n,quantidadeInstalada:n.int().nullable(),tarifa:n,taxaSem:n,disponibilidadeReais:n,taxaCom:n,
  investimento:n,parcela:n,parcelas:n.int().max(1200),reajustePct:pct,degradacaoInicialPct:pct,degradacaoAnualPct:pct,
  manutencaoAnual:n,reajusteManutencaoPct:pct,trocaInversorAno:n.int().max(25),trocaInversorValor:n,poupancaMesPct:pct,geracaoAnualExcel:n,
  origemOffGrid:z.object({id:z.string().uuid(),titulo:z.string().max(200),importadoEm:z.string().datetime()}).optional(),
});
export function resultadosProposta(e:EntradaSolar) {
  const calculo=calcularProposta(e);
  return {calculo,campos:{consumo_kwh:calculo.consumoMedio,hsp:calculo.hspMedia,potencia_kwp:calculo.potenciaKwp,
    modulos_qtd:calculo.modulosQtd,area_estimada_m2:calculo.areaEstimadaM2,geracao_media_kwh:calculo.geracaoMediaKwh,
    cobertura_pct:calculo.coberturaPct,economia_mensal:calculo.economiaMensal,economia_anual:calculo.economiaAnual,
    economia_25_anos:calculo.economia25Anos,payback_anos:calculo.paybackAnos}};
}
