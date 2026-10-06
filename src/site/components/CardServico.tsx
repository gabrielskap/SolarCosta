// Cartão de serviço, no padrão dos KPIs do dashboard: ícone em chip colorido,
// rótulo em caixa alta, régua de gradiente no rodapé.

import React from 'react';
import { Check } from 'lucide-react';
import { Cartao, ChipIcone } from './Secao';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import { icone } from '../blocos/icones';
import type { ConteudoCardsServicos, CorChip } from '../blocos/tipos';

type Servico = ConteudoCardsServicos['itens'][number];

const REGUAS: Record<CorChip, string> = {
  blue: 'from-blue-600 to-indigo-500',
  emerald: 'from-emerald-500 to-teal-400',
  amber: 'from-amber-500 to-orange-400',
  violet: 'from-violet-500 to-fuchsia-400',
};

export const CardServico: React.FC<{
  servico: Servico;
  /** Na home o cartão mostra só o resumo; em /servicos abre a lista inteira. */
  completo?: boolean;
  /**
   * Caminho do serviço dentro do conteúdo do bloco ("itens.2"), para o editor
   * saber qual campo está sendo digitado. Sem ele o cartão só exibe — é o que
   * mantém este componente usável fora de um bloco.
   */
  campoBase?: string;
}> = ({ servico, completo = false, campoBase }) => {
  const { modoEditor } = useEditor();
  const cor: CorChip = REGUAS[servico.cor] ? servico.cor : 'blue';
  const detalhes = servico.detalhes ?? [];

  return (
    <Cartao className="h-full flex flex-col" regua={REGUAS[cor]}>
      <ChipIcone Icone={icone(servico.icone)} cor={cor} />

      {campoBase ? (
        <>
          <Editavel
            como="h3"
            campo={`${campoBase}.titulo`}
            valor={servico.titulo}
            placeholder="Nome do serviço"
            className="mt-4 text-lg font-black text-slate-900 tracking-tight"
          />
          <Editavel
            como="p"
            campo={`${campoBase}.resumo`}
            valor={servico.resumo}
            multilinha
            placeholder="Uma frase sobre o serviço."
            className="mt-2 text-sm text-slate-600 leading-relaxed"
          />
        </>
      ) : (
        <>
          <h3 className="mt-4 text-lg font-black text-slate-900 tracking-tight">
            {servico.titulo}
          </h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{servico.resumo}</p>
        </>
      )}

      {completo && (detalhes.length > 0 || (modoEditor && campoBase)) && (
        <ul className="mt-5 space-y-2.5 pt-4 border-t border-slate-100">
          {/* Chave pelo índice, não pelo texto: o texto é o que está sendo
              editado, e trocar de chave a cada tecla remontaria o <li> e
              tiraria o foco do campo. */}
          {detalhes.map((d, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              {campoBase ? (
                <Editavel
                  como="span"
                  campo={`${campoBase}.detalhes.${i}`}
                  valor={d}
                  placeholder="Item incluso"
                />
              ) : (
                <span>{d}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
};
