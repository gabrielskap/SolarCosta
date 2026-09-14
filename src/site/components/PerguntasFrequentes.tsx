// FAQ em <details>/<summary> nativos: acessível por teclado e leitor de tela
// sem uma linha de JavaScript, e o conteúdo fica no HTML para o buscador ler
// mesmo com o item fechado.

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Secao, TituloSecao } from './Secao';
import type { ConteudoFaq } from '../blocos/tipos';

export const PerguntasFrequentes: React.FC<{ conteudo: ConteudoFaq }> = ({ conteudo: c }) => (
  <Secao claro={!!c.claro} id="duvidas">
    {(c.rotulo || c.titulo) && (
      <TituloSecao rotulo={c.rotulo} titulo={c.titulo} descricao={c.descricao} centralizado />
    )}

    <div className="mt-10 max-w-3xl mx-auto space-y-3">
      {(c.perguntas ?? []).map((p, i) => (
        <details
          key={`${p.pergunta}-${i}`}
          className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-4 font-bold text-slate-900 hover:text-marca transition">
            <span className="text-sm md:text-base">{p.pergunta}</span>
            <ChevronDown className="w-5 h-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-5 -mt-1">
            <p className="text-sm text-slate-600 leading-relaxed">{p.resposta}</p>
          </div>
        </details>
      ))}
    </div>
  </Secao>
);
