// Faixa azul que abre as páginas internas. Casca fina sobre CabecalhoPagina,
// que continua existindo porque a marcação é reaproveitada por 4 páginas.

import React from 'react';
import logoFull from '../../assets/logo-full.png';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { useConfigPublica } from '../contexto';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import { icone } from './icones';
import type { ConteudoCabecalhoPagina } from './tipos';

export const CabecalhoBloco: React.FC<{ conteudo: ConteudoCabecalhoPagina }> = ({
  conteudo: c,
}) => {
  const { config } = useConfigPublica();
  const { modoEditor } = useEditor();
  const empresa = config?.empresa ?? null;

  return (
    <CabecalhoPagina
      rotulo={<Editavel como="span" campo="rotulo" valor={c.rotulo} placeholder="Seção" />}
      titulo={
        <Editavel como="span" campo="titulo" valor={c.titulo} placeholder="Título da página" />
      }
      // Descrição vazia continua sumindo do site; no editor ela vira um campo
      // com placeholder, senão não haveria onde clicar para escrevê-la.
      descricao={
        c.descricao || modoEditor ? (
          <Editavel
            como="span"
            campo="descricao"
            valor={c.descricao}
            multilinha
            placeholder="Um parágrafo de apresentação."
          />
        ) : undefined
      }
      Icone={c.icone ? icone(c.icone) : undefined}
    >
      {c.mostrar_marca && (
        <div className="mt-10 flex flex-wrap items-center gap-6 pt-8 border-t border-blue-800/60">
          <img
            src={logoFull}
            alt="Solar Costa Energia Solar"
            className="h-14 md:h-16 w-auto"
            width={1400}
            height={630}
          />
          <div className="font-mono text-xs text-blue-200/80 leading-relaxed">
            <p>{empresa?.razao_social || 'SOLAR COSTA ENERGIA SOLAR LTDA'}</p>
            {empresa?.cnpj && <p>CNPJ {empresa.cnpj}</p>}
          </div>
        </div>
      )}
    </CabecalhoPagina>
  );
};
