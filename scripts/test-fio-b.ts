import assert from 'node:assert/strict';
import { calcularCobrancaFioB, FIO_B_PADRAO } from '../server/src/domain/fioB';
import { calcularProposta, entradaSolarZerada, type EntradaSolar } from '../server/src/domain/propostaSolar';
import { entradaSolarSchema, resultadosProposta } from '../server/src/schemas/propostaSolar';
import { deProposta, paraProposta } from '../src/services/mappers';

const perto = (real: number, esperado: number) => assert.ok(Math.abs(real - esperado) < 1e-8, `${real} != ${esperado}`);
const exemplo = calcularCobrancaFioB(500, 500, 1.17, FIO_B_PADRAO);
perto(exemplo.consumoSimultaneoKwh, 200);
perto(exemplo.energiaCompensadaKwh, 300);
perto(exemplo.tarifaIntegral, 0.351);
perto(exemplo.tarifaAplicada, 0.2106);
perto(exemplo.valorFioB, 63.18);
perto(exemplo.valorEnergiaNaoAtendida, 0);
perto(calcularCobrancaFioB(500, 500, 1.17, { ...FIO_B_PADRAO, consumoSimultaneoPct: 100 }).valorFioB, 0);
perto(calcularCobrancaFioB(500, 500, 1.17, { ...FIO_B_PADRAO, consumoSimultaneoPct: 0 }).valorFioB, 105.3);
perto(calcularCobrancaFioB(500, 500, 1.17, { ...FIO_B_PADRAO, cobrancaPct: 0 }).valorFioB, 0);
perto(calcularCobrancaFioB(500, 500, 1.17, { ...FIO_B_PADRAO, componenteTarifaPct: 0 }).valorFioB, 0);
perto(calcularCobrancaFioB(500, 500, 1.17, { ...FIO_B_PADRAO, cobrancaPct: 100 }).valorFioB, 105.3);
const parcial = calcularCobrancaFioB(500, 250, 1.17, FIO_B_PADRAO);
perto(parcial.energiaCompensadaKwh, 50);
perto(parcial.valorFioB, 10.53);
perto(parcial.valorEnergiaNaoAtendida, 292.5);
const semGeracao = calcularCobrancaFioB(500, 0, 1.17, FIO_B_PADRAO);
perto(semGeracao.valorFioB, 0);
perto(semGeracao.valorEnergiaNaoAtendida, 585);
perto(calcularCobrancaFioB(500, 1000, 1.17, FIO_B_PADRAO).valorFioB, 63.18);

const entrada: EntradaSolar = {
  ...entradaSolarZerada(), modo: 'excel', anoInicial: 2026,
  ucs: [{ nome: 'UC 1', meses: Array(12).fill(500), adicionalKwh: 0, disponibilidadeKwh: 0 }],
  hspMensal: Array(12).fill(5.2), moduloWp: 710, perdasPct: 24, inversorKw: 14,
  tarifa: 1.17, taxaSem: 37, disponibilidadeReais: 67, taxaCom: 37,
  geracaoAnualExcel: 6000, investimento: 15990, fioB: { ...FIO_B_PADRAO },
};
const c = calcularProposta(entrada);
assert.equal(c.completo, true, c.erros.join('; '));
perto(c.contaSemSolar, 622);
perto(c.contaComSolar, 167.18);
perto(c.economiaOperacional, 454.82);
perto(c.projecao[0].custos, 63.18 * 12);
perto(c.projecao[0].resultadoAnual, c.economiaAnual);
const semFio = calcularProposta({ ...entrada, fioB: { ...FIO_B_PADRAO, cobrancaPct: 0 } });
assert.ok(c.paybackAnos! > semFio.paybackAnos!);
perto(semFio.economia25Anos - c.economia25Anos, 63.18 * 12 * 25);
const reajuste = calcularProposta({ ...entrada, reajustePct: 6 });
perto(reajuste.projecao[1].custos, c.projecao[0].custos * 1.06);
assert.equal(reajuste.entradas.fioB!.cobrancaPct, 60, 'percentual manual não muda pelo ano');
const degradado = calcularProposta({ ...entrada, degradacaoInicialPct: 10 });
// 2027: 450 kWh gerados/mês, 200 simultâneos, 250 compensados e 50 pagos à tarifa integral.
perto(degradado.projecao[1].custos, 250 * 0.2106 * 12);
perto(degradado.projecao[1].resultadoAnual, (585 - 50 * 1.17 - 250 * 0.2106 - 67) * 12);
const poupancaZero = calcularProposta({ ...entrada, poupancaMesPct: 0 });
perto(poupancaZero.projecao[24].saldoAcumulado, poupancaZero.projecao[24].saldoComPoupanca);
const financiada = calcularProposta({ ...entrada, parcela: 500, parcelas: 13 });
perto(financiada.economiaMensal, 454.82 - 500);
perto(financiada.economia25Anos, c.economia25Anos);
const fluxoFinanciado = calcularProposta({ ...financiada.entradas, considerarParcelasPayback: true, entradaFinanciamento: 1000 });
perto(fluxoFinanciado.projecao[0].saldoAcumulado, -1000 + c.economiaAnual - 6000);

// Sazonalidade sem déficit anual não volta a ser cobrada como compra de energia mês a mês.
const tecnico = calcularProposta({ ...entrada, modo: 'tecnico', quantidadeInstalada: 8, larguraM: 2, alturaM: 1.1, hspMensal: [2, 2, 2, 2, 2, 2, 12, 12, 12, 12, 12, 12] });
assert(tecnico.geracaoMediaKwh > 500);
assert(tecnico.geracaoMensal[0] < 500);
perto(tecnico.cobrancaFioB!.valorEnergiaNaoAtendida, 0);
perto(tecnico.cobrancaFioB!.valorFioB, 63.18);
perto(tecnico.projecao[0].resultadoAnual, tecnico.economiaAnual);

for (const chave of ['componenteTarifaPct', 'cobrancaPct', 'consumoSimultaneoPct'] as const) {
  for (const valor of [-1, 100.01, NaN, Infinity]) {
    const invalida = { ...entrada, fioB: { ...FIO_B_PADRAO, [chave]: valor } };
    assert.equal(entradaSolarSchema.safeParse(invalida).success, false);
    assert.equal(calcularProposta(invalida).completo, false);
  }
}
assert.equal(entradaSolarSchema.safeParse({ ...entrada, fioB: {} }).success, false);
const persistida = entradaSolarSchema.parse(JSON.parse(JSON.stringify(entrada)));
perto(resultadosProposta(persistida as EntradaSolar).calculo.cobrancaFioB!.valorFioB, 63.18);
const mapeada = deProposta(paraProposta({ calculo_solar: c }));
assert.deepEqual((mapeada.calculo_solar as any).entradas.fioB, FIO_B_PADRAO);
const legada = calcularProposta({ ...entrada, fioB: undefined });
assert.equal(legada.cobrancaFioB, undefined);
assert.equal(entradaSolarSchema.parse(legada.entradas).fioB, undefined);
console.log('Fio B: exemplo de R$ 63,18, limites, balanço anual, projeção, payback, financiamento, validação e persistência passaram.');
