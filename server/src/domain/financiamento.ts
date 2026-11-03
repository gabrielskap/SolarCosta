/** Financiamento com prestações fixas: metodologia da Calculadora do Cidadão/BCB.
 * Primeira prestação em um mês, sem carência, IOF, seguros ou tarifas.
 */
export type CampoFinanciamento = 'entradaValor' | 'valorFinanciado' | 'parcela' | 'totalPrestacoes' | 'jurosTotais' | 'totalPago';
export type AjustesFinanciamento = Partial<Record<CampoFinanciamento, number>>;
export interface EntradaFinanciamento {
  investimento: number;
  entradaPct?: number | null;
  /** Compatibilidade com propostas antigas que guardavam apenas a entrada em reais. */
  entradaValor?: number | null;
  parcelas?: number | null;
  jurosMesPct?: number | null;
  /** Cada resultado pode ser negociado separadamente. Ausência usa o cálculo. */
  ajustes?: AjustesFinanciamento | null;
}

export const moeda = (valor: number): number => Math.round((valor + Number.EPSILON) * 100) / 100;
export const temPrecisao = (valor: number, casas: number): boolean =>
  Number.isFinite(valor) && Math.abs(valor * 10 ** casas - Math.round(valor * 10 ** casas)) < 1e-7;

export function calcularParcela(valor: number, jurosPct: number, parcelas: number): number {
  if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(jurosPct) || jurosPct < 0 ||
      !Number.isInteger(parcelas) || parcelas < 1 || parcelas > 1200) return 0;
  const i = jurosPct / 100;
  // log1p/expm1 evitam perda de precisão nas taxas próximas de zero e overflow.
  return moeda(i === 0 ? valor / parcelas : valor * i / -Math.expm1(-parcelas * Math.log1p(i)));
}

export function calcularFinanciamento(e: EntradaFinanciamento) {
  const erros: Partial<Record<'investimento' | 'entradaPct' | 'parcelas' | 'jurosMesPct' | CampoFinanciamento, string>> = {};
  if (!Number.isFinite(e.investimento) || e.investimento <= 0)
    erros.investimento = 'Informe um investimento maior que zero para financiar.';
  if (e.entradaPct != null && (e.entradaPct < 0 || e.entradaPct > 100 || !temPrecisao(e.entradaPct, 2)))
    erros.entradaPct = 'Informe entrada entre 0% e 100%, com até duas casas decimais.';
  if (e.entradaPct == null && e.entradaValor != null &&
      (!Number.isFinite(e.entradaValor) || e.entradaValor < 0 || e.entradaValor > e.investimento || !temPrecisao(e.entradaValor, 2)))
    erros.entradaPct = 'Informe entrada entre zero e o investimento, com até duas casas decimais.';
  if (e.parcelas == null || !Number.isInteger(e.parcelas) || e.parcelas < 1 || e.parcelas > 1200)
    erros.parcelas = 'Informe um prazo inteiro entre 1 e 1.200 meses.';
  if (e.jurosMesPct == null || e.jurosMesPct < 0 || e.jurosMesPct > 999.999 || !temPrecisao(e.jurosMesPct, 3))
    erros.jurosMesPct = 'Informe juros mensais entre 0% e 999,999%, com até três casas decimais.';
  for (const campo of ['entradaValor','valorFinanciado','parcela','totalPrestacoes','jurosTotais','totalPago'] as const) {
    const valor = e.ajustes?.[campo];
    if (valor != null && (valor < 0 || valor > 999999999999.99 || !temPrecisao(valor, 2) ||
        ((campo === 'parcela' || campo === 'valorFinanciado') && valor === 0)))
      erros[campo] = 'Informe um valor válido em reais, com até duas casas decimais.';
  }

  const investimento = Number.isFinite(e.investimento) ? moeda(e.investimento) : 0;
  const entradaCalculada = erros.entradaPct ? 0 : moeda(e.entradaPct != null
    ? investimento * e.entradaPct / 100 : e.entradaValor ?? 0);
  const entradaValor = erros.entradaValor ? 0 : e.ajustes?.entradaValor ?? entradaCalculada;
  if (entradaValor > investimento) erros.entradaValor = 'A entrada não pode ser maior que o investimento.';
  const principalCalculado = moeda(investimento - entradaValor);
  const valorFinanciado = erros.valorFinanciado ? 0 : e.ajustes?.valorFinanciado ?? principalCalculado;
  if (!erros.investimento && !erros.entradaPct && valorFinanciado <= 0)
    erros.entradaPct = 'A entrada deve deixar um valor maior que zero para financiar.';
  const parcelaCalculada = erros.investimento || erros.entradaPct || erros.entradaValor || erros.valorFinanciado || erros.parcelas || erros.jurosMesPct ? 0
    : calcularParcela(valorFinanciado, e.jurosMesPct!, e.parcelas!);
  const parcela = Object.keys(erros).length ? 0 : e.ajustes?.parcela ?? parcelaCalculada;
  const somaPrestacoes = moeda(parcela * (e.parcelas ?? 0));
  const totalPrestacoes = erros.totalPrestacoes ? 0 : e.ajustes?.totalPrestacoes ?? somaPrestacoes;
  const jurosCalculados = moeda(totalPrestacoes - valorFinanciado);
  const jurosTotais = erros.jurosTotais ? 0 : e.ajustes?.jurosTotais ?? jurosCalculados;
  const totalCalculado = moeda(entradaValor + totalPrestacoes);
  const totalPago = erros.totalPago ? 0 : e.ajustes?.totalPago ?? totalCalculado;
  if (!Object.keys(erros).length && (!Number.isSafeInteger(Math.round(totalPago * 100)) || !Number.isFinite(parcela)))
    erros.investimento = 'Os valores excedem os limites de cálculo.';
  const completo = Object.keys(erros).length === 0;
  return { completo, erros, entradaValor, valorFinanciado,
    calculados: { entradaValor: entradaCalculada, valorFinanciado: principalCalculado, parcela: parcelaCalculada,
      totalPrestacoes: somaPrestacoes, jurosTotais: jurosCalculados, totalPago: totalCalculado },
    ajusteManual: Object.keys(e.ajustes ?? {}).length > 0,
    parcela: completo ? parcela : 0,
    totalPrestacoes: completo ? totalPrestacoes : 0,
    jurosTotais: completo ? jurosTotais : 0,
    totalPago: completo ? totalPago : 0 };
}

/** Mesma adaptação para a API, CRM e documento público. Ausência de taxa não vira zero. */
export function financiamentoDaProposta(p: {
  valorTotal: number; entradaFinanciamentoPct?: number | null; entradaFinanciamentoValor?: number | null;
  parcelasFinanciamento?: number | null; jurosFinanciamentoMesPct?: number | null;
  financiamentoAjustes?: AjustesFinanciamento | null;
}) {
  return calcularFinanciamento({ investimento: p.valorTotal,
    entradaPct: p.entradaFinanciamentoPct, entradaValor: p.entradaFinanciamentoValor,
    parcelas: p.parcelasFinanciamento, jurosMesPct: p.jurosFinanciamentoMesPct,
    ajustes: p.financiamentoAjustes });
}
