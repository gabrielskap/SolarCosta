// FAQ em <details>/<summary> nativos: acessível por teclado e leitor de tela
// sem uma linha de JavaScript, e o conteúdo fica no HTML para o buscador ler
// mesmo com o item fechado.

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ, type Pergunta } from '../conteudo';
import { Secao, TituloSecao } from './Secao';

export const PerguntasFrequentes: React.FC<{
  /** Na home entram só as primeiras; em /simulador o conjunto muda. */
  perguntas?: Pergunta[];
  claro?: boolean;
}> = ({ perguntas = FAQ, claro = false }) => (
  <Secao claro={claro} id="duvidas">
    <TituloSecao
      rotulo="Dúvidas frequentes"
      titulo="O que todo mundo pergunta antes de fechar"
      descricao="As respostas honestas, inclusive as que não são a resposta que o vendedor gostaria de dar."
      centralizado
    />

    <div className="mt-10 max-w-3xl mx-auto space-y-3">
      {perguntas.map((p) => (
        <details
          key={p.pergunta}
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
