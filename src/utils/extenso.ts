// Números por extenso, em português do Brasil, para o contrato.
//
// O modelo da Solar Costa escreve prazos, multas e preço duas vezes — "30
// (trinta) dias", "R$ 15.990,00 (quinze mil novecentos e noventa reais)" — e a
// segunda escrita é a que vale em caso de divergência. Gerar a partir do
// número evita o erro clássico de corrigir um e esquecer o outro.
//
// Regras seguidas:
//   · "e" entre centenas, dezenas e unidades ("cento e vinte e três");
//   · "cem" sozinho, "cento" acompanhado;
//   · "mil", nunca "um mil";
//   · entre classes, "e" só antes da última classe não nula quando ela é menor
//     que 100 ou centena redonda ("mil e cem", "dois milhões e trezentos mil",
//     mas "mil duzentos e trinta e quatro");
//   · "de reais" depois de milhão/bilhão redondo ("um milhão de reais").

const UNIDADES_M = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const UNIDADES_F = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = [
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS_M = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];
const CENTENAS_F = [
  '', 'cento', 'duzentas', 'trezentas', 'quatrocentas', 'quinhentas', 'seiscentas', 'setecentas', 'oitocentas', 'novecentas',
];

/** 1..999 por extenso. */
function ate999(n: number, feminino: boolean): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push((feminino ? CENTENAS_F : CENTENAS_M)[c]);
  if (resto >= 10 && resto < 20) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d) partes.push(DEZENAS[d]);
    if (u) partes.push((feminino ? UNIDADES_F : UNIDADES_M)[u]);
  }
  return partes.join(' e ');
}

const CLASSES: { singular: string; plural: string }[] = [
  { singular: '', plural: '' },
  { singular: 'mil', plural: 'mil' },
  { singular: 'milhão', plural: 'milhões' },
  { singular: 'bilhão', plural: 'bilhões' },
];

/**
 * Inteiro não negativo por extenso. `feminino` concorda com substantivo
 * feminino: "duas vias", "duzentas e uma unidades".
 */
export function numeroPorExtenso(valor: number, opcoes: { feminino?: boolean } = {}): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return 'zero';
  if (n >= 1e12) return String(n);

  const grupos: number[] = [];
  for (let resto = n; resto > 0; resto = Math.floor(resto / 1000)) grupos.push(resto % 1000);

  const naoNulos = grupos.map((g, i) => ({ g, i })).filter((x) => x.g > 0);
  const ultimo = naoNulos[0]; // classe mais baixa não nula

  const partes: string[] = [];
  for (let k = naoNulos.length - 1; k >= 0; k--) {
    const { g, i } = naoNulos[k];
    // Milhão e bilhão são masculinos; o gênero só vale para mil e unidades.
    const fem = i <= 1 && !!opcoes.feminino;
    let texto: string;
    if (i === 1 && g === 1) texto = 'mil';
    else if (i === 0) texto = ate999(g, fem);
    else texto = `${ate999(g, fem)} ${g === 1 ? CLASSES[i].singular : CLASSES[i].plural}`;

    const ehUltimo = k === 0 && naoNulos.length > 1;
    if (ehUltimo && ultimo && (ultimo.g < 100 || ultimo.g % 100 === 0)) partes.push('e');
    partes.push(texto);
  }
  return partes.join(' ');
}

/** 15990.5 -> "quinze mil novecentos e noventa reais e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return '';
  const centavosTotais = Math.round(valor * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];
  if (reais > 0 || centavos === 0) {
    const texto = numeroPorExtenso(reais);
    // "um milhão de reais", "dois bilhões de reais" — só quando a última
    // palavra é milhão/bilhão.
    const de = reais >= 1e6 && reais % 1e6 === 0 ? ' de' : '';
    partes.push(`${texto}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  return partes.join(' e ');
}

/** 30 -> "30 (trinta)". */
export function numeroComExtenso(valor: number, opcoes: { feminino?: boolean } = {}): string {
  return `${valor} (${numeroPorExtenso(valor, opcoes)})`;
}

/**
 * 15 -> "15% (quinze por cento)". Percentual fracionário sai só com o número
 * ("1,5%"): "um vírgula cinco por cento" não é como contrato se escreve.
 */
export function percentualComExtenso(valor: number): string {
  const numero = `${String(valor).replace('.', ',')}%`;
  return Number.isInteger(valor) ? `${numero} (${numeroPorExtenso(valor)} por cento)` : numero;
}
