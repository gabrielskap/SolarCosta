import React, { useId } from 'react';
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
  confortavel?: boolean;
}> = ({ valor, onChange, escuro = false, disabled = false, confortavel = false }) => {
  const ajudaId = useId();
  return (
  <fieldset disabled={disabled} className={confortavel ? 'min-w-0 space-y-3' : 'space-y-2.5'}>
    <legend className={confortavel ? 'mb-1.5 text-sm font-bold text-[#004276]' : `text-xs font-bold uppercase mb-2 ${escuro ? 'text-slate-300' : 'text-slate-600'}`}>Garantias dos equipamentos</legend>
    <p id={ajudaId} className={confortavel ? 'text-xs leading-relaxed text-slate-600' : `text-[11px] ${escuro ? 'text-slate-400' : 'text-slate-500'}`}>Informe os prazos do fabricante para esta proposta. A garantia do produto é diferente da garantia de performance.</p>
    {([
      ['modulosProduto', 'Módulos — garantia do produto', 'Ex.: 15 anos'],
      ['modulosPerformance', 'Módulos — garantia de performance', 'Ex.: 30 anos'],
      ['inversores', 'Inversor — garantia do produto', 'Ex.: 10 anos'],
    ] as const).map(([campo, rotulo, placeholder]) => (
      <label key={campo} className={confortavel ? 'block text-sm font-semibold text-slate-700' : `block text-xs font-semibold ${escuro ? 'text-slate-300' : 'text-slate-600'}`}>
        {rotulo}
        <input
          type="text"
          aria-label={rotulo}
          aria-describedby={ajudaId}
          maxLength={120}
          value={valor[campo]}
          placeholder={placeholder}
          onChange={e => onChange({ ...valor, [campo]: e.target.value })}
          className={confortavel ? 'mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 transition focus:border-[#004276] focus:outline-none focus:ring-2 focus:ring-[#004276]/25 disabled:opacity-60' : `mt-1 w-full p-2 border rounded-lg text-xs focus:outline-none disabled:opacity-60 ${escuro ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-400' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#004276]'}`}
        />
      </label>
    ))}
  </fieldset>
  );
};
