// Executar: npx tsx scripts/test-extenso.ts
import assert from 'node:assert/strict';
import {
  numeroComExtenso, numeroPorExtenso, percentualComExtenso, valorPorExtenso,
} from '../src/utils/extenso.ts';

const casos: [number, string][] = [
  [0, 'zero'],
  [1, 'um'],
  [10, 'dez'],
  [15, 'quinze'],
  [21, 'vinte e um'],
  [100, 'cem'],
  [101, 'cento e um'],
  [110, 'cento e dez'],
  [999, 'novecentos e noventa e nove'],
  [1000, 'mil'],
  [1001, 'mil e um'],
  [1100, 'mil e cem'],
  [1234, 'mil duzentos e trinta e quatro'],
  [15990, 'quinze mil novecentos e noventa'],
  [21000, 'vinte e um mil'],
  [100000, 'cem mil'],
  [1_000_000, 'um milhão'],
  [1_000_100, 'um milhão e cem'],
  [2_300_000, 'dois milhões e trezentos mil'],
  [1_234_567, 'um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete'],
];
for (const [n, esperado] of casos) assert.equal(numeroPorExtenso(n), esperado, `numeroPorExtenso(${n})`);

assert.equal(numeroPorExtenso(2, { feminino: true }), 'duas');
assert.equal(numeroPorExtenso(201, { feminino: true }), 'duzentas e uma');
assert.equal(numeroPorExtenso(2000, { feminino: true }), 'duas mil');
assert.equal(numeroPorExtenso(2_000_000, { feminino: true }), 'dois milhões', 'milhão é masculino');

assert.equal(valorPorExtenso(0), 'zero reais');
assert.equal(valorPorExtenso(1), 'um real');
assert.equal(valorPorExtenso(0.01), 'um centavo');
assert.equal(valorPorExtenso(0.5), 'cinquenta centavos');
assert.equal(valorPorExtenso(15990), 'quinze mil novecentos e noventa reais');
assert.equal(valorPorExtenso(10000), 'dez mil reais');
assert.equal(valorPorExtenso(5990.75), 'cinco mil novecentos e noventa reais e setenta e cinco centavos');
assert.equal(valorPorExtenso(1_000_000), 'um milhão de reais');
assert.equal(valorPorExtenso(1_500_000), 'um milhão e quinhentos mil reais');
// Ponto flutuante: 0.1 + 0.2 não pode virar "vinte e nove centavos".
assert.equal(valorPorExtenso(0.1 + 0.2), 'trinta centavos');

assert.equal(numeroComExtenso(30), '30 (trinta)');
assert.equal(numeroComExtenso(2, { feminino: true }), '2 (duas)');
assert.equal(percentualComExtenso(1), '1% (um por cento)');
assert.equal(percentualComExtenso(15), '15% (quinze por cento)');
assert.equal(percentualComExtenso(1.5), '1,5%');

console.log('extenso: ok');
