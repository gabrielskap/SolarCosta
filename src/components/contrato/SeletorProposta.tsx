// Combobox "Gerar a partir da proposta" — escolher uma proposta preenche o
// contrato inteiro (ver aplicarProposta em src/contrato/rascunho.ts). O
// combobox em si é o SeletorOrigem, o mesmo que a procuração usa para escolher
// o contrato.

import React from 'react';
import type { Proposta } from '../../types';
import { SeletorOrigem } from '../documento/SeletorOrigem';

interface Props {
  propostas: Proposta[];
  selecionadaId: string;
  onSelecionar: (proposta: Proposta | null) => void;
  desabilitado?: boolean;
}

export const SeletorProposta: React.FC<Props> = ({ propostas, selecionadaId, onSelecionar, desabilitado }) => (
  <SeletorOrigem
    id="proposta-origem"
    rotulo="Gerar a partir da proposta"
    placeholder="Buscar por número ou cliente"
    rotuloLista="Propostas disponíveis"
    semResultado="Nenhuma proposta encontrada."
    dica="Preenche contratante, sistema, preço, condições de pagamento e o Anexo I. Prazos, multas e textos ficam como estão."
    opcoes={propostas.map((p) => ({
      id: p.id,
      rotulo: `${p.numero} · ${p.clienteNome} · ${p.potenciaKwp} kWp`,
      busca: `${p.numero} ${p.clienteNome}`,
    }))}
    selecionadaId={selecionadaId}
    onSelecionar={(id) => onSelecionar(propostas.find((p) => p.id === id) ?? null)}
    desabilitado={desabilitado}
  />
);
