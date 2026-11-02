export interface CargaOffGrid {
  id: string;
  nome: string;
  potenciaW: number;
  quantidade: number;
  horasDia: number;
}

export const configOffGridPadrao = {
  eficienciaInversor: 96,
  profundidadeDescarga: 80,
  eficienciaCarga: 95,
  tensaoBateria: 48,
  capacidadeBateriaAh: 100,
  irradiacaoSolar: 4.2,
  potenciaModuloWp: 610,
  perdasSistema: 20,
  fatorDias: 1,
};
export type ConfigOffGrid = typeof configOffGridPadrao;

export function cargasOffGridPadrao(): CargaOffGrid[] {
  return [
    { id: 'roteador', nome: 'Roteador Wi-Fi', potenciaW: 15, quantidade: 1, horasDia: 12 },
    { id: 'tv', nome: 'TV LED 55"', potenciaW: 120, quantidade: 1, horasDia: 6 },
    { id: 'lampadas', nome: 'Lâmpada LED', potenciaW: 9, quantidade: 10, horasDia: 6 },
    { id: 'geladeira', nome: 'Geladeira Frost Free', potenciaW: 150, quantidade: 1, horasDia: 12 },
    { id: 'ar', nome: 'Ar Condicionado 9000 BTU', potenciaW: 1000, quantidade: 1, horasDia: 3 },
  ];
}

export function dimensionarSistema(equipamentos: CargaOffGrid[], config: ConfigOffGrid) {
  if (Object.values(config).some(v => !Number.isFinite(v))) throw new Error('Preencha todos os parâmetros com valores numéricos finitos.');
  const { eficienciaInversor, profundidadeDescarga, eficienciaCarga, tensaoBateria,
    capacidadeBateriaAh, irradiacaoSolar, potenciaModuloWp, perdasSistema, fatorDias } = config;
  if ([eficienciaInversor, profundidadeDescarga, eficienciaCarga].some(v => v <= 0 || v > 100)) {
    throw new Error('Eficiências e DoD devem ser maiores que 0 e até 100%.');
  }
  if ([tensaoBateria, capacidadeBateriaAh, irradiacaoSolar, potenciaModuloWp, fatorDias].some(v => v <= 0)
    || perdasSistema < 0 || perdasSistema >= 100) throw new Error('Tensão, capacidade, HSP, potência do módulo e fator dias devem ser positivos; perdas entre 0 e menos de 100%.');
  const cargas = equipamentos.map(item => {
    if (![item.potenciaW, item.quantidade, item.horasDia].every(Number.isFinite)
      || item.potenciaW < 0 || !Number.isInteger(item.quantidade) || item.quantidade < 0 || item.horasDia < 0 || item.horasDia > 24) {
      throw new Error(`Carga ${item.nome || 'sem nome'}: informe potência não negativa, quantidade inteira não negativa e horas entre 0 e 24.`);
    }
    const potenciaDemandadaW = item.potenciaW * item.quantidade;
    return { ...item, potenciaDemandadaW, consumoDiarioWh: potenciaDemandadaW * item.horasDia };
  });
  const potenciaTotalW = cargas.reduce((s, c) => s + c.potenciaDemandadaW, 0);
  const consumoDiarioKWh = cargas.reduce((s, c) => s + c.consumoDiarioWh, 0) / 1000;
  const consumoCorrigidoKWh = consumoDiarioKWh / (eficienciaInversor / 100);
  const capacidadeMinimaAh = consumoCorrigidoKWh * 1000 / ((profundidadeDescarga / 100) * (eficienciaCarga / 100) * tensaoBateria);
  const energiaMinimaBancoKWh = capacidadeMinimaAh * tensaoBateria / 1000;
  const quantidadeBateriasCalculada = capacidadeMinimaAh / capacidadeBateriaAh;
  const quantidadeBaterias = Math.max(1, Math.ceil(quantidadeBateriasCalculada));
  const geracaoModuloKWh = potenciaModuloWp * irradiacaoSolar * (1 - perdasSistema / 100) * fatorDias / 1000;
  const quantidadeModulos = Math.ceil(consumoCorrigidoKWh / geracaoModuloKWh);
  const potenciaSistemaKWp = quantidadeModulos * potenciaModuloWp / 1000;
  const resultado = { cargas, potenciaTotalW, potenciaInversorRecomendadaW: potenciaTotalW * 1.3,
    consumoDiarioKWh, consumoCorrigidoKWh, capacidadeMinimaAh, energiaMinimaBancoKWh,
    quantidadeBateriasCalculada, quantidadeBaterias, consultarFabricante: quantidadeBateriasCalculada > 10,
    geracaoModuloKWh, quantidadeModulos, potenciaSistemaKWp };
  if (Object.values(resultado).some(v => typeof v === 'number' && !Number.isFinite(v)) || geracaoModuloKWh <= 0) {
    throw new Error('Os valores informados excedem os limites de cálculo. Revise os parâmetros.');
  }
  return resultado;
}
