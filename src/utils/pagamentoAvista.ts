/** A entrega recebe o restante em centavos para que as duas etapas fechem o total. */
export function dividirPagamentoAvista(total: number, entradaPct: number) {
  const centavos = Math.round(total * 100);
  const entradaCentavos = Math.round(centavos * entradaPct / 100);
  return {
    entrada: entradaCentavos / 100,
    entrega: (centavos - entradaCentavos) / 100,
    entregaPct: Number((100 - entradaPct).toFixed(2)),
  };
}
