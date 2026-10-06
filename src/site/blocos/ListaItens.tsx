// Cartões de ícone + título + texto. É o formato mais reaproveitável do site:
// serve para "o que vai junto em todo projeto", para os princípios da empresa
// e para qualquer lista nova que o administrador queira montar.

import React from 'react';
import { Secao, TituloSecao, Cartao, ChipIcone } from '../components/Secao';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import { icone } from './icones';
import type { ConteudoListaItens, CorChip } from './tipos';

const COLUNAS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

const CORES: CorChip[] = ['blue', 'emerald', 'amber', 'violet'];

export const ListaItens: React.FC<{ conteudo: ConteudoListaItens }> = ({ conteudo: c }) => {
  const { modoEditor } = useEditor();
  const temTitulo = !!(c.rotulo || c.titulo) || modoEditor;
  const grade = COLUNAS[c.colunas] ?? COLUNAS[3];

  return (
    <Secao claro={!!c.claro}>
      {temTitulo && (
        <TituloSecao
          rotulo={c.rotulo}
          titulo={c.titulo}
          descricao={c.descricao}
          centralizado={!!c.centralizado}
          campoRotulo="rotulo"
          campoTitulo="titulo"
          campoDescricao="descricao"
        />
      )}

      <div className={[temTitulo ? 'mt-12' : '', 'grid gap-6', grade].join(' ')}>
        {(c.itens ?? []).map((item, i) => (
          <Cartao key={i} className="h-full" regua="from-blue-600 to-indigo-500">
            <ChipIcone Icone={icone(item.icone)} cor={CORES.includes(item.cor) ? item.cor : 'blue'} />
            <Editavel
              como="h3"
              campo={`itens.${i}.titulo`}
              valor={item.titulo}
              placeholder="Título do item"
              className="mt-4 text-base font-black text-slate-900 tracking-tight"
            />
            <Editavel
              como="p"
              campo={`itens.${i}.texto`}
              valor={item.texto}
              multilinha
              placeholder="Explique em uma frase."
              className="mt-2 text-sm text-slate-600 leading-relaxed"
            />
          </Cartao>
        ))}
      </div>
    </Secao>
  );
};
