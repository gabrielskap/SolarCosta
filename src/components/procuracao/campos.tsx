// O que os módulos do editor de procuração recebem, e o campo de gênero.
//
// Os campos em si (Campo, Grade, CabecalhoModulo…) são os do contrato, em
// src/components/contrato/campos.tsx: mesmo visual, mesmo `somenteLeitura`.

import React from 'react';
import type { GeneroPessoa, Procuracao, TermosProcuracao } from '../../types';
import type { ConfigApp } from '../../services/api';
import { CAMPO, ROTULO } from '../contrato/campos';

export interface PropsModuloProcuracao {
  r: Procuracao;
  alterar: (parcial: Partial<Procuracao>) => void;
  alterarTermos: (parcial: Partial<TermosProcuracao>) => void;
  somenteLeitura: boolean;
  config: ConfigApp | null;
}

const OPCOES_GENERO: { valor: GeneroPessoa; rotulo: string }[] = [
  { valor: '', rotulo: 'Não informar — "inscrito(a)"' },
  { valor: 'F', rotulo: 'Feminino — "inscrita"' },
  { valor: 'M', rotulo: 'Masculino — "inscrito"' },
];

/** Concordância do texto da qualificação. */
export const CampoGenero: React.FC<{
  valor: GeneroPessoa;
  onChange: (g: GeneroPessoa) => void;
  somenteLeitura?: boolean;
  rotulo?: string;
}> = ({ valor, onChange, somenteLeitura, rotulo = 'Gênero (concordância do texto)' }) => {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>{rotulo}</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value as GeneroPessoa)}
        disabled={somenteLeitura}
        className={CAMPO}
      >
        {OPCOES_GENERO.map((o) => (
          <option key={o.valor || 'neutro'} value={o.valor}>{o.rotulo}</option>
        ))}
      </select>
    </div>
  );
};
