import React from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { GarantiaContrato } from '../../../types';
import { garantiasDoParametro } from '../../../contrato/padroes';
import { numeroComExtenso } from '../../../utils/extenso';
import { BOTAO_SECUNDARIO, CAMPO, CabecalhoModulo, CampoNumero, Grade, type PropsModulo } from '../campos';

/** Editor da tabela da cláusula 7.2 — usado aqui e em Padrões do contrato. */
export const TabelaGarantiasEditavel: React.FC<{
  garantias: GarantiaContrato[];
  onChange: (g: GarantiaContrato[]) => void;
  somenteLeitura?: boolean;
}> = ({ garantias, onChange, somenteLeitura }) => {
  const mudar = (i: number, parcial: Partial<GarantiaContrato>) =>
    onChange(garantias.map((g, j) => (j === i ? { ...g, ...parcial } : g)));
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_120px_2fr_32px] gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
        <span>Equipamento</span>
        <span>Prazo</span>
        <span>Causa</span>
        <span />
      </div>
      {garantias.map((g, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_2fr_32px] gap-2 items-center border-b sm:border-0 border-slate-100 pb-2 sm:pb-0">
          <input aria-label={`Equipamento da linha ${i + 1}`} value={g.equipamento} onChange={(e) => mudar(i, { equipamento: e.target.value })} disabled={somenteLeitura} className={CAMPO} placeholder="Módulos" />
          <input aria-label={`Prazo da linha ${i + 1}`} value={g.prazo} onChange={(e) => mudar(i, { prazo: e.target.value })} disabled={somenteLeitura} className={CAMPO} placeholder="15 anos" />
          <input aria-label={`Causa da linha ${i + 1}`} value={g.causa} onChange={(e) => mudar(i, { causa: e.target.value })} disabled={somenteLeitura} className={CAMPO} placeholder="Defeitos de fabricação" />
          {!somenteLeitura ? (
            <button type="button" onClick={() => onChange(garantias.filter((_, j) => j !== i))} className="p-1.5 text-rose-500 hover:text-rose-700 justify-self-start" aria-label={`Remover linha ${i + 1}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {!somenteLeitura && (
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => onChange([...garantias, { equipamento: '', prazo: '', causa: '' }])}>
          <Plus className="w-3.5 h-3.5" />
          Adicionar linha
        </button>
      )}
    </div>
  );
};

export const ModuloGarantias: React.FC<PropsModulo> = ({ r, alterarTermos, somenteLeitura, config }) => (
  <div>
    <CabecalhoModulo titulo="Garantias" onde="Cláusula 7 — tabela dos fornecedores (7.2) e garantia legal (7.3).">
      {!somenteLeitura && (
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => alterarTermos({ garantias: garantiasDoParametro(config) })}>
          <RotateCcw className="w-3.5 h-3.5" />
          Tabela padrão
        </button>
      )}
    </CabecalhoModulo>
    <TabelaGarantiasEditavel garantias={r.termos.garantias} onChange={(garantias) => alterarTermos({ garantias })} somenteLeitura={somenteLeitura} />
    <div className="mt-6">
      <Grade>
        <CampoNumero
          rotulo="Garantia legal da Solar Costa"
          valor={r.termos.garantiaLegalDias}
          onChange={(n) => alterarTermos({ garantiaLegalDias: n })}
          somenteLeitura={somenteLeitura}
          inteiro
          sufixo="dias"
          dica={`7.3: "prazo legal de ${numeroComExtenso(r.termos.garantiaLegalDias)} dias".`}
        />
      </Grade>
    </div>
  </div>
);
