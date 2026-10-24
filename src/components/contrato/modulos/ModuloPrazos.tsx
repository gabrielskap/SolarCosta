import React from 'react';
import { numeroComExtenso } from '../../../utils/extenso';
import { CabecalhoModulo, CampoNumero, Grade, type PropsModulo } from '../campos';

export const ModuloPrazos: React.FC<PropsModulo> = ({ r, alterarTermos, somenteLeitura }) => (
  <div>
    <CabecalhoModulo titulo="Prazos" onde="Cláusula 2 — despacho do sistema e entrega dos serviços." />
    <Grade>
      <CampoNumero
        rotulo="Despacho pelo fornecedor"
        valor={r.termos.prazoDespachoDias}
        onChange={(n) => alterarTermos({ prazoDespachoDias: n })}
        somenteLeitura={somenteLeitura}
        inteiro
        sufixo="dias"
        dica={`2.3 e 2.3.1: "${numeroComExtenso(r.termos.prazoDespachoDias)} dias", contados do pagamento da 1ª parcela.`}
      />
      <CampoNumero
        rotulo="Entrega dos serviços"
        valor={r.termos.prazoExecucaoDias}
        onChange={(n) => alterarTermos({ prazoExecucaoDias: n })}
        somenteLeitura={somenteLeitura}
        inteiro
        sufixo="dias corridos"
        dica="2.4 — o atraso aqui é o que dispara a multa da cláusula 9.2.1."
      />
    </Grade>
  </div>
);
