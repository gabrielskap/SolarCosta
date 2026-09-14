// Cartões de ícone + título + texto. É o formato mais reaproveitável do site:
// serve para "o que vai junto em todo projeto", para os princípios da empresa
// e para qualquer lista nova que o administrador queira montar.

import React from 'react';
import { Secao, TituloSecao, Cartao, ChipIcone } from '../components/Secao';
import { icone } from './icones';
import type { ConteudoListaItens, CorChip } from './tipos';

const COLUNAS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

const CORES: CorChip[] = ['blue', 'emerald', 'amber', 'violet'];

export const ListaItens: React.FC<{ conteudo: ConteudoListaItens }> = ({ conteudo: c }) => {
  const temTitulo = !!(c.rotulo || c.titulo);
  const grade = COLUNAS[c.colunas] ?? COLUNAS[3];

  return (
    <Secao claro={!!c.claro}>
      {temTitulo && (
        <TituloSecao
          rotulo={c.rotulo}
          titulo={c.titulo}
          descricao={c.descricao}
          centralizado={!!c.centralizado}
        />
      )}

      <div className={[temTitulo ? 'mt-12' : '', 'grid gap-6', grade].join(' ')}>
        {(c.itens ?? []).map((item, i) => (
          <Cartao key={i} className="h-full" regua="from-blue-600 to-indigo-500">
            <ChipIcone Icone={icone(item.icone)} cor={CORES.includes(item.cor) ? item.cor : 'blue'} />
            <h3 className="mt-4 text-base font-black text-slate-900 tracking-tight">{item.titulo}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.texto}</p>
          </Cartao>
        ))}
      </div>
    </Secao>
  );
};
