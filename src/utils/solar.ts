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
 * Potência kWp = Consumo kWh / (30 · HSP · (1 − Perdas/100)).
 *
 * Os arredondamentos intermediários são propositais e reproduzem o que a
 * proposta impressa mostra: a potência fecha em 2 casas ANTES de virar
 * quantidade de módulos e geração.
 */
export function dimensionar({
  consumoKwh,
  hsp,
  perdasPct,
  moduloWp,
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

  const potenciaKwp = Number((consumoKwh / geracaoPorKwp).toFixed(2));
  const modulosQtd = Math.ceil((potenciaKwp * 1000) / moduloWp);
  const geracaoMediaKwh = Math.round(potenciaKwp * geracaoPorKwp);
  const areaEstimadaM2 = Number(
    (modulosQtd * MODULO_LARGURA_M * MODULO_ALTURA_M).toFixed(2),
  );
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

  return { economiaMensal, economiaAnual, economiaAcumulada };
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
