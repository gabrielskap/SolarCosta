import React, { useId } from 'react';
import { FIO_B_PADRAO, type CobrancaFioB, type PremissasFioB } from '../../server/src/domain/fioB';

export function FioBPropostaCampos({ valor, cobranca, onChange }: {
  valor?: PremissasFioB;
  cobranca?: CobrancaFioB;
  onChange: (valor: PremissasFioB) => void;
}) {
  const id = useId();
  const moeda = (v: number, casas = 2) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
  const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const valido = valor && Object.values(valor).every(v => Number.isFinite(v) && v >= 0 && v <= 100);
  return <fieldset className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
    <legend className="px-1 text-sm font-bold text-[#004276]">Fio B e consumo simultâneo</legend>
    {!valor ? <>
      <p className="text-sm leading-relaxed text-slate-600">Esta proposta mantém o cálculo anterior. Aplique a nova premissa para considerar a cobrança do Fio B.</p>
      <button type="button" onClick={() => onChange({ ...FIO_B_PADRAO })}
        className="min-h-11 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-[#004276] hover:bg-blue-50">Usar cálculo do Fio B nesta proposta</button>
    </> : <>
      <p id={`${id}-ajuda`} className="text-xs leading-relaxed text-slate-600">O consumo simultâneo é atendido diretamente pela usina. A energia compensada pela rede recebe a cobrança do Fio B, conforme os percentuais informados.</p>
      <div className="grid grid-cols-1 @min-[28rem]:grid-cols-2 @min-[46rem]:grid-cols-3 gap-4">
        {([
          ['componenteTarifaPct', 'Parcela do Fio B na tarifa (%)', 'Ex.: 30% da tarifa do kWh.'],
          ['cobrancaPct', 'Percentual de cobrança do Fio B (%)', 'Ex.: 60% sobre o Fio B integral.'],
          ['consumoSimultaneoPct', 'Consumo simultâneo (%)', 'Ex.: 40% do consumo sem uso da rede.'],
        ] as const).map(([chave, rotulo, ajuda]) => {
          const invalido = !Number.isFinite(valor[chave]) || valor[chave] < 0 || valor[chave] > 100;
          return <div key={chave} className="min-w-0 space-y-1.5">
            <label htmlFor={`${id}-${chave}`} className="block text-sm font-semibold text-slate-700">{rotulo}</label>
            <input id={`${id}-${chave}`} type="number" min="0" max="100" step="0.01"
              value={valor[chave]} onChange={e => onChange({ ...valor, [chave]: Number(e.target.value) })}
              aria-invalid={invalido} aria-describedby={`${id}-${chave}-ajuda`} className="w-full" />
            <p id={`${id}-${chave}-ajuda`} className={`text-xs leading-relaxed ${invalido ? 'text-rose-700' : 'text-slate-600'}`}>{invalido ? 'Informe um percentual entre 0 e 100.' : ajuda}</p>
          </div>;
        })}
      </div>
      {valido && cobranca && <div className="space-y-2 rounded-xl border border-blue-100 bg-white p-3 text-sm text-[#004276]" aria-live="polite">
        <p><strong>Consumo simultâneo:</strong> {numero(cobranca.consumoSimultaneoKwh)} kWh/mês · <strong>Compensação pela rede:</strong> {numero(cobranca.energiaCompensadaKwh)} kWh/mês</p>
        <p>Fio B aplicado: <strong>{moeda(cobranca.tarifaAplicada, 4)}/kWh</strong> · Custo mensal estimado: <strong>{moeda(cobranca.valorFioB)}</strong></p>
        {cobranca.energiaNaoAtendidaKwh > 0 && <p className="text-xs text-slate-600">Consumo além da geração: {numero(cobranca.energiaNaoAtendidaKwh)} kWh/mês ({moeda(cobranca.valorEnergiaNaoAtendida)}), cobrado separadamente pela tarifa integral.</p>}
      </div>}
      <p className="text-xs leading-relaxed text-slate-600">A estimativa compensa os excedentes no balanço anual. Os percentuais são manuais e permanecem fixos na projeção; a tarifa acompanha o reajuste informado.</p>
    </>}
  </fieldset>;
}
