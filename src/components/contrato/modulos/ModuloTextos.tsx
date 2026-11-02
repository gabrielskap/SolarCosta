// Texto das cláusulas, personalizado só neste contrato.
//
// O editor é o mesmo da procuração (EditorTextosModelo); aqui ele só recebe as
// seções de src/contrato/modeloSolarCosta.ts e os marcadores do contrato.

import React from 'react';
import type { ChaveSecaoContrato } from '../../../types';
import { SECOES } from '../../../contrato/modeloSolarCosta';
import { MARCADORES } from '../../../contrato/marcadores';
import { marcadoresDesconhecidos } from '../../../contrato/renderizar';
import { EditorTextosModelo } from '../../documento/EditorTextosModelo';
import type { PropsModulo } from '../campos';

interface Props extends PropsModulo {
  onFocarSecao: (chave: ChaveSecaoContrato | null) => void;
}

export const ModuloTextos: React.FC<Props> = ({ r, alterarTermos, somenteLeitura, onFocarSecao }) => (
  <EditorTextosModelo<ChaveSecaoContrato>
    titulo="Texto das cláusulas"
    onde="Reescreva qualquer seção só neste contrato. Os campos entre chaves continuam puxando os dados dos outros módulos."
    dicaRestaurar="Descarta o texto deste contrato e volta ao modelo"
    secoes={SECOES}
    marcadores={MARCADORES}
    textos={r.termos.textos ?? {}}
    onChange={(textos) => alterarTermos({ textos })}
    desconhecidos={marcadoresDesconhecidos}
    somenteLeitura={somenteLeitura}
    onFocarSecao={onFocarSecao}
  />
);
