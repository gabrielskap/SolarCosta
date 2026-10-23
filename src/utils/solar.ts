// Dimensionamento fotovoltaico e projeção de economia.
//
// Estas contas nasceram inline no ProposalCalculatorView. Foram extraídas para
// cá quando o site público ganhou um simulador: as duas telas precisam devolver
// exatamente o mesmo número, senão o cliente chega na visita com uma conta e o
// consultor abre outra na frente dele.
//
// Os parâmetros (HSP, perdas, potência do módulo, tarifa) NÃO têm valor padrão
// aqui de propósito — eles moram em SolarCosta_Parametros e chegam pela API.
// Quem chama decide o fallback.

/** Dimensões físicas do módulo usadas na estimativa de área de telhado. */
const MODULO_LARGURA_M = 2.58;
const MODULO_ALTURA_M = 2.25;

export interface EntradaDimensionamento {
  /** Consumo médio mensal, em kWh. */
  consumoKwh: number;
  /** Horas de sol pleno da região (SolarCosta_Concessionarias.hsp_media). */
  hsp: number;
  /** Perdas do sistema, em % (sujeira, temperatura, cabeamento, inversor). */
  perdasPct: number;
  /** Potência de um módulo, em Wp. */
  moduloWp: number;
  quantidadeInstalada?: number;
  dimensoesModulo?: { larguraM: number; alturaM: number };
}

export interface Dimensionamento {
  /** kWh gerados por kWp instalado, por mês. */
  geracaoPorKwp: number;
  potenciaKwp: number;
  modulosQtd: number;
  geracaoMediaKwh: number;
  areaEstimadaM2: number;
  /** Quanto da conta o sistema cobre, em %. */
  coberturaPct: number;
}

/**
 * Dimensionamento fotovoltaico.
 *
 * 1. Geração mensal por kWp instalado:
 *    geracaoPorKwp = 30 · HSP · (1 − Perdas/100)
 *
 * 2. Geração média mensal de 1 módulo (kWh/mês por módulo):
 *    geracaoPorModulo = (moduloWp / 1000) · geracaoPorKwp
 *
 * 3. Quantidade necessária de módulos para cobrir o consumo mensal:
 *    modulosQtd = Math.ceil(consumoKwh / geracaoPorModulo)
 *
 * 4. Potência real instalada no sistema (kWp):
 *    potenciaKwp = (modulosQtd · moduloWp) / 1000
 *
 * 5. Geração média mensal real produzida pelos módulos (kWh/mês):
 *    geracaoMediaKwh = Math.round(potenciaKwp · geracaoPorKwp)
 *
 * 6. Cobertura real do consumo pela geração média calculada (%):
 *    coberturaPct = (geracaoMediaKwh / consumoKwh) · 100
 */
export function dimensionar({
  consumoKwh,
  hsp,
  perdasPct,
  moduloWp,
  quantidadeInstalada,
  dimensoesModulo,
}: EntradaDimensionamento): Dimensionamento {
  const geracaoPorKwp = 30 * hsp * (1 - perdasPct / 100);

  // Parâmetro zerado ou inválido: devolve tudo zerado em vez de Infinity/NaN.
  if (!(geracaoPorKwp > 0) || !(moduloWp > 0) || !(consumoKwh > 0)) {
    return {
      geracaoPorKwp: geracaoPorKwp > 0 ? geracaoPorKwp : 0,
      potenciaKwp: 0,
      modulosQtd: 0,
      geracaoMediaKwh: 0,
      areaEstimadaM2: 0,
      coberturaPct: 0,
    };
  }

  // Geração média mensal gerada por 1 único módulo (kWh/mês)
  const geracaoPorModulo = (moduloWp / 1000) * geracaoPorKwp;

  // Quantidade de módulos necessária para suprir o consumo informado
  const modulosQtd = quantidadeInstalada != null && Number.isInteger(quantidadeInstalada) && quantidadeInstalada >= 0
    ? quantidadeInstalada : Math.ceil(consumoKwh / geracaoPorModulo);

  // Potência real instalada do sistema (kWp) = Qtd Módulos · Potência do Módulo
  const potenciaKwp = Number(((modulosQtd * moduloWp) / 1000).toFixed(2));

  // Geração média mensal efetiva do sistema instalado (kWh/mês)
  const geracaoMediaKwh = Math.round(potenciaKwp * geracaoPorKwp);

  // Área estimada ocupada pelo conjunto de placas (m²)
  const areaEstimadaM2 = Number(
    (modulosQtd * (dimensoesModulo?.larguraM ?? MODULO_LARGURA_M) * (dimensoesModulo?.alturaM ?? MODULO_ALTURA_M)).toFixed(2),
  );

  // Percentual de cobertura do consumo pela geração dos módulos instalados
  const coberturaPct = Number(((geracaoMediaKwh / consumoKwh) * 100).toFixed(1));

  return {
    geracaoPorKwp,
    potenciaKwp,
    modulosQtd,
    geracaoMediaKwh,
    areaEstimadaM2,
    coberturaPct,
  };
}

export interface EntradaEconomia {
  geracaoMediaKwh: number;
  tarifaKwh: number;
  /** Reajuste anual da tarifa usado na projeção longa. Padrão: 6% a.a. */
  reajusteAnual?: number;
  /** Horizonte da projeção acumulada, em anos. Padrão: 25 (vida útil do módulo). */
  anos?: number;
}

export interface Economia {
  economiaMensal: number;
  economiaAnual: number;
  /** Soma dos `anos`, com a tarifa reajustada a cada ano. */
  economiaAcumulada: number;
}

export function projetarEconomia({
  geracaoMediaKwh,
  tarifaKwh,
  reajusteAnual = 0.06,
  anos = 25,
}: EntradaEconomia): Economia {
  const economiaMensal = Number((geracaoMediaKwh * tarifaKwh).toFixed(2));
  const economiaAnual = Number((economiaMensal * 12).toFixed(2));

  let economiaAcumulada = 0;
  let doAno = economiaAnual;
  for (let ano = 1; ano <= anos; ano++) {
    economiaAcumulada += doAno;
    doAno *= 1 + reajusteAnual;
  }

  return {
    economiaMensal,
    economiaAnual,
    economiaAcumulada: Number(economiaAcumulada.toFixed(2)),
  };
}

export interface EntradaParcela {
  /** Total menos a entrada — o que efetivamente é financiado. */
  valorFinanciado: number;
  /** Juros ao mês, em PONTOS PERCENTUAIS (1.45 = 1,45% a.m.). */
  jurosMesPct: number;
  parcelas: number;
}

/**
 * Prestação mensal pela Tabela Price.
 *
 * Mora aqui, e não na calculadora, porque a folha de despesas mensais da
 * proposta precisa da MESMA parcela que o consultor viu na tela ao fechar o
 * negócio. Com a fórmula escrita duas vezes, bastava um arredondamento
 * diferente para o PDF enviado ao cliente divergir do que foi combinado — e
 * ninguém descobriria antes dele apontar.
 *
 * O PDF não pode simplesmente ler a parcela do banco: ela nunca foi
 * persistida. O que a proposta guarda são as ENTRADAS (valor financiado via
 * entrada_financiamento_valor, parcelas_financiamento, juros_financiamento_mes_pct),
 * e delas a parcela se reconstrói exatamente.
 */
export function parcelaFinanciamento({
  valorFinanciado,
  jurosMesPct,
  parcelas,
}: EntradaParcela): number {
  // Sem prazo não há prestação. A versão inline que isto substituiu dividia
  // por `parcelas` direto e devolvia Infinity quando o campo ficava em branco.
  if (!(parcelas > 0) || !(valorFinanciado > 0)) return 0;

  const i = jurosMesPct / 100;
  // Juros zero não é caso degenerado: é o "financiamento" sem juros que
  // algumas campanhas oferecem — e na fórmula de Price daria 0/0.
  if (i <= 0) return Number((valorFinanciado / parcelas).toFixed(2));

  const fator = Math.pow(1 + i, parcelas);
  return Number(((valorFinanciado * (i * fator)) / (fator - 1)).toFixed(2));
}

/**
 * Consumo aproximado a partir do valor da conta de luz — a pergunta que o
 * visitante do site sabe responder de cabeça, ao contrário de "quantos kWh".
 *
 * `custoDisponibilidade` é a parcela fixa que a concessionária cobra mesmo de
 * quem gera a própria energia (taxa mínima + iluminação pública). No banco ela
 * está EM REAIS — SolarCosta_Concessionarias.custo_disponibilidade é
 * numeric(10,2) e vale 33,73 para todas as concessionárias, independentemente
 * da tarifa —, então é subtraída direto do valor da conta, sem multiplicar.
 */
export function consumoAPartirDaConta(
  valorContaMensal: number,
  tarifaKwh: number,
  custoDisponibilidadeReais = 0,
): number {
  if (!(tarifaKwh > 0)) return 0;
  const compensavel = valorContaMensal - custoDisponibilidadeReais;
  return compensavel > 0 ? Math.round(compensavel / tarifaKwh) : 0;
}
