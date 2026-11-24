export interface PremissasFioB {
  /** Parcela estimada do Fio B dentro da tarifa de energia. */
  componenteTarifaPct: number;
  /** Percentual de incidência sobre o Fio B integral, informado pelo consultor. */
  cobrancaPct: number;
  /** Parcela do consumo atendida diretamente pela geração local. */
  consumoSimultaneoPct: number;
}

// Premissas iniciais do modelo comercial, sempre editáveis na proposta.
export const FIO_B_PADRAO: PremissasFioB = {
  componenteTarifaPct: 30, cobrancaPct: 60, consumoSimultaneoPct: 40,
};

/** Estimativa com compensação dos excedentes dentro do balanço anual. Sem arredondamento intermediário. */
export function calcularCobrancaFioB(consumo: number, geracao: number, tarifa: number, p: PremissasFioB) {
  const consumoSimultaneoKwh = Math.min(geracao, consumo * p.consumoSimultaneoPct / 100);
  // Só a energia efetivamente compensada usa a rede; excedente não utilizado não é cobrado aqui.
  const energiaCompensadaKwh = Math.max(0, Math.min(consumo, geracao) - consumoSimultaneoKwh);
  const energiaNaoAtendidaKwh = Math.max(0, consumo - geracao);
  const tarifaIntegral = tarifa * p.componenteTarifaPct / 100;
  const tarifaAplicada = tarifaIntegral * p.cobrancaPct / 100;
  return {
    consumoSimultaneoKwh, energiaCompensadaKwh, energiaNaoAtendidaKwh,
    tarifaIntegral, tarifaAplicada,
    valorFioB: energiaCompensadaKwh * tarifaAplicada,
    valorEnergiaNaoAtendida: energiaNaoAtendidaKwh * tarifa,
  };
}

export type CobrancaFioB = ReturnType<typeof calcularCobrancaFioB>;
