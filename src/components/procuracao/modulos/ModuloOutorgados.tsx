import React from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { GeneroPessoa, OutorgadoProcuracao } from '../../../types';
import { maskCPF } from '../../../utils/format';
import { MAXIMO_OUTORGADOS, OUTORGADO_VAZIO, ajustarNacionalidade, outorgadosPadrao } from '../../../procuracao/padroes';
import { BOTAO_SECUNDARIO, CabecalhoModulo, Campo, Grade } from '../../contrato/campos';
import { CampoGenero, type PropsModuloProcuracao } from '../campos';

/** Editor da lista de outorgados — usado aqui e em Padrões. */
export const ListaOutorgadosEditavel: React.FC<{
  outorgados: OutorgadoProcuracao[];
  onChange: (lista: OutorgadoProcuracao[]) => void;
  somenteLeitura?: boolean;
  /** O que dizer com a lista vazia — nos Padrões, vazio tem fallback. */
  vazio?: string;
}> = ({ outorgados, onChange, somenteLeitura, vazio = 'Nenhum outorgado. A procuração precisa de ao menos um.' }) => {
  const mudar = (i: number, parcial: Partial<OutorgadoProcuracao>) =>
    onChange(outorgados.map((o, j) => (j === i ? { ...o, ...parcial } : o)));
  const mudarGenero = (i: number, g: GeneroPessoa) =>
    mudar(i, { genero: g, nacionalidade: ajustarNacionalidade(outorgados[i].nacionalidade, g) });

  return (
    <div className="space-y-4">
      {outorgados.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-semibold text-slate-500">
          {vazio}
        </p>
      )}
      {outorgados.map((o, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-700">Outorgado {i + 1}</p>
            {!somenteLeitura && (
              <button
                type="button"
                onClick={() => onChange(outorgados.filter((_, j) => j !== i))}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800"
                aria-label={`Remover outorgado ${i + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <Grade>
            <Campo rotulo="Nome" valor={o.nome} onChange={(v) => mudar(i, { nome: v })} somenteLeitura={somenteLeitura} larga />
            <CampoGenero valor={o.genero} onChange={(g) => mudarGenero(i, g)} somenteLeitura={somenteLeitura} />
            <Campo rotulo="Nacionalidade" valor={o.nacionalidade} onChange={(v) => mudar(i, { nacionalidade: v })} somenteLeitura={somenteLeitura} />
            <Campo rotulo="CPF" valor={o.cpf} onChange={(v) => mudar(i, { cpf: maskCPF(v) })} somenteLeitura={somenteLeitura} />
            <Campo rotulo="RG" valor={o.rg} onChange={(v) => mudar(i, { rg: v })} somenteLeitura={somenteLeitura} dica="Opcional; o modelo não traz." />
            <Campo
              rotulo="Endereço completo"
              valor={o.endereco}
              onChange={(v) => mudar(i, { endereco: v })}
              somenteLeitura={somenteLeitura}
              larga
              placeholder="Rua, número – bairro, cidade/UF, CEP"
            />
          </Grade>
        </div>
      ))}
      {!somenteLeitura && outorgados.length < MAXIMO_OUTORGADOS && (
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => onChange([...outorgados, { ...OUTORGADO_VAZIO }])}>
          <Plus className="w-3.5 h-3.5" />
          Adicionar outorgado
        </button>
      )}
    </div>
  );
};

export const ModuloOutorgados: React.FC<PropsModuloProcuracao> = ({ r, alterar, somenteLeitura, config }) => (
  <div>
    <CabecalhoModulo
      titulo="Outorgados"
      onde="Os procuradores, na ordem em que saem no quadro. É a cópia desta procuração: mudar aqui não altera os Padrões."
    >
      {!somenteLeitura && (
        <button
          type="button"
          className={BOTAO_SECUNDARIO}
          onClick={() => alterar({ outorgados: outorgadosPadrao(config) })}
          title="Copia de novo os outorgados de Padrões"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Recarregar dos padrões
        </button>
      )}
    </CabecalhoModulo>
    <ListaOutorgadosEditavel outorgados={r.outorgados} onChange={(outorgados) => alterar({ outorgados })} somenteLeitura={somenteLeitura} />
  </div>
);
