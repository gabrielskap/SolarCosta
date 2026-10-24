import React from 'react';
import { numeroComExtenso } from '../../../utils/extenso';
import { CabecalhoModulo, Campo, CampoNumero, Grade, type PropsModulo } from '../campos';

export const ModuloRescisao: React.FC<PropsModulo> = ({ r, alterarTermos, somenteLeitura, config }) => {
  const t = r.termos;
  return (
    <div>
      <CabecalhoModulo titulo="Rescisão" onde="Cláusula 9 — hipóteses de rescisão, multas e concessionária." />
      <Grade>
        <CampoNumero
          rotulo="Força maior que permite rescindir"
          valor={t.forcaMaiorDias}
          onChange={(n) => alterarTermos({ forcaMaiorDias: n })}
          somenteLeitura={somenteLeitura}
          inteiro
          sufixo="dias"
          dica={`9.1 a: "por mais de ${numeroComExtenso(t.forcaMaiorDias)} dias".`}
        />
        <CampoNumero
          rotulo="Prazo para sanar descumprimento"
          valor={t.prazoCuraDias}
          onChange={(n) => alterarTermos({ prazoCuraDias: n })}
          somenteLeitura={somenteLeitura}
          inteiro
          sufixo="dias corridos"
          dica="9.1 b — depois da notificação."
        />
        <CampoNumero
          rotulo="Multa se o contratante desistir"
          valor={t.multaRescisoriaContratantePct}
          onChange={(n) => alterarTermos({ multaRescisoriaContratantePct: n })}
          somenteLeitura={somenteLeitura}
          sufixo="%"
          dica="9.2 — antes da entrega, sobre o valor do contrato."
        />
        <CampoNumero
          rotulo="Multa se a Solar Costa atrasar"
          valor={t.multaRescisoriaContratadaPct}
          onChange={(n) => alterarTermos({ multaRescisoriaContratadaPct: n })}
          somenteLeitura={somenteLeitura}
          sufixo="%"
          dica="9.2.1 — descumprimento do prazo da cláusula 2.4."
        />
        <CampoNumero
          rotulo="Prazo para pagar estruturas específicas"
          valor={t.prazoPagamentoEstruturasDiasUteis}
          onChange={(n) => alterarTermos({ prazoPagamentoEstruturasDiasUteis: n })}
          somenteLeitura={somenteLeitura}
          inteiro
          sufixo="dias úteis"
          dica="9.3 — contados do envio da fatura."
        />
        <Campo
          rotulo="Concessionária"
          valor={t.concessionaria}
          onChange={(v) => alterarTermos({ concessionaria: v })}
          somenteLeitura={somenteLeitura}
          lista="contrato-concessionarias"
          dica="9.4 — se ela não aprovar a conexão, o contrato é cancelado sem prejuízo."
        />
        <datalist id="contrato-concessionarias">
          {(config?.concessionarias ?? []).map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>
      </Grade>
    </div>
  );
};
