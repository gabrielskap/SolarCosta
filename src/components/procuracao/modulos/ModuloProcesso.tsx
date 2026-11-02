import React from 'react';
import { dataPorExtenso } from '../../../contrato/marcadores';
import { CabecalhoModulo, Campo, Grade } from '../../contrato/campos';
import type { PropsModuloProcuracao } from '../campos';

export const ModuloProcesso: React.FC<PropsModuloProcuracao> = ({ r, alterarTermos, somenteLeitura }) => {
  const t = r.termos;
  const data = dataPorExtenso(t.dataDocumento);
  return (
    <div>
      <CabecalhoModulo titulo="Concessionária, local e data" onde="Poderes conferidos e fecho." />
      <Grade>
        <Campo
          rotulo="Concessionária"
          valor={t.concessionaria}
          onChange={(v) => alterarTermos({ concessionaria: v })}
          somenteLeitura={somenteLeitura}
          dica={`"perante a Concessionária ${t.concessionaria || '…'}".`}
        />
        <Campo
          rotulo="Local de assinatura"
          valor={t.localAssinatura}
          onChange={(v) => alterarTermos({ localAssinatura: v })}
          somenteLeitura={somenteLeitura}
          placeholder="Belo Horizonte/MG"
        />
        <Campo
          rotulo="Data da procuração"
          valor={t.dataDocumento}
          onChange={(v) => alterarTermos({ dataDocumento: v })}
          somenteLeitura={somenteLeitura}
          tipo="date"
          dica={data ? `Sai como "${data}".` : 'Em branco: a data sai em linhas para preencher à mão.'}
        />
      </Grade>
      <p className="mt-5 text-xs text-slate-500">
        Os poderes e a vigência seguem o texto do modelo. Para mudar só nesta procuração — citar a UC, por exemplo —, use
        "Texto da procuração".
      </p>
    </div>
  );
};
