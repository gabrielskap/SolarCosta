import React from 'react';
import type { GarantiasProposta } from '../types';

export const GARANTIAS_PROPOSTA_PADRAO: GarantiasProposta = {
  modulosProduto: '',
  modulosPerformance: '25 anos',
  inversores: '12 anos',
};

export function textoGarantiasProposta(garantias: GarantiasProposta): string {
  const prazos = [
    garantias.modulosProduto.trim() && `${garantias.modulosProduto.trim()} de garantia do produto dos módulos`,
    garantias.modulosPerformance.trim() && `${garantias.modulosPerformance.trim()} de garantia de eficiência dos módulos`,
    garantias.inversores.trim() && `${garantias.inversores.trim()} para inversores`,
  ].filter(Boolean);
  return `🛡️ ${[...prazos, '1 ano para os serviços de instalação'].join(', ').replace(/, ([^,]*)$/, ' e $1')}.`;
}

export const GarantiasPropostaCampos: React.FC<{
  valor: GarantiasProposta;
  onChange: (valor: GarantiasProposta) => void;
  escuro?: boolean;
  disabled?: boolean;
}> = ({ valor, onChange, escuro = false, disabled = false }) => (
  <fieldset disabled={disabled} className="space-y-2.5">
    <legend className={`text-xs font-bold uppercase mb-2 ${escuro ? 'text-slate-300' : 'text-slate-600'}`}>Garantias dos equipamentos</legend>
    <p className={`text-[11px] ${escuro ? 'text-slate-400' : 'text-slate-500'}`}>Informe os prazos do fabricante para esta proposta. A garantia do produto é diferente da garantia de performance.</p>
    {([
      ['modulosProduto', 'Módulos — garantia do produto', 'Ex.: 15 anos'],
      ['modulosPerformance', 'Módulos — garantia de performance', 'Ex.: 30 anos'],
      ['inversores', 'Inversor — garantia do produto', 'Ex.: 10 anos'],
    ] as const).map(([campo, rotulo, placeholder]) => (
      <label key={campo} className={`block text-xs font-semibold ${escuro ? 'text-slate-300' : 'text-slate-600'}`}>
        {rotulo}
        <input
          type="text"
          aria-label={rotulo}
          maxLength={120}
          value={valor[campo]}
          placeholder={placeholder}
          onChange={e => onChange({ ...valor, [campo]: e.target.value })}
          className={`mt-1 w-full p-2 border rounded-lg text-xs focus:outline-none disabled:opacity-60 ${escuro ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-400' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#004276]'}`}
        />
      </label>
    ))}
  </fieldset>
);
