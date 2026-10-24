import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Proposta } from '../../../types';
import { condicoesDaProposta } from '../../../contrato/padroes';
import { valorPorExtenso, percentualComExtenso } from '../../../utils/extenso';
import { formatCurrencyBRL } from '../../../utils/format';
import { BOTAO_SECUNDARIO, CabecalhoModulo, Campo, CampoNumero, CampoTexto, Grade, type PropsModulo } from '../campos';

interface Props extends PropsModulo {
  proposta?: Proposta;
}

export const ModuloPagamento: React.FC<Props> = ({ r, alterar, alterarTermos, somenteLeitura, proposta }) => {
  const automatico = valorPorExtenso(r.valorTotal);
  return (
    <div>
      <CabecalhoModulo titulo="Preço e pagamento" onde="Cláusula 3 — preço, condições, juros e multa por atraso." />
      <Grade>
        <Campo
          rotulo="Valor total"
          valor={formatCurrencyBRL(r.valorTotal)}
          onChange={(v) => {
            // Máscara de centavos: só os dígitos contam, como no formulário antigo.
            const digitos = v.replace(/\D/g, '');
            alterar({ valorTotal: digitos ? Number(digitos) / 100 : 0 });
          }}
          somenteLeitura={somenteLeitura}
        />
        <Campo
          rotulo="Valor por extenso"
          valor={r.termos.valorExtenso}
          onChange={(v) => alterarTermos({ valorExtenso: v })}
          somenteLeitura={somenteLeitura}
          placeholder={automatico}
          dica={
            r.termos.valorExtenso && !somenteLeitura ? (
              <button type="button" className="font-bold text-[#004276] hover:underline" onClick={() => alterarTermos({ valorExtenso: '' })}>
                Voltar ao automático ({automatico})
              </button>
            ) : (
              'Em branco: gerado a partir do valor.'
            )
          }
        />
        <CampoTexto
          rotulo="Condições de pagamento"
          valor={r.termos.condicoesPagamento}
          onChange={(v) => alterarTermos({ condicoesPagamento: v })}
          somenteLeitura={somenteLeitura}
          placeholder="R$ 10.000,00 no cartão de crédito e R$ 5.990,00 na entrega da usina instalada."
          dica={`Completa a frase "…pagará o preço total de ${formatCurrencyBRL(r.valorTotal)} (…), nas seguintes condições:".`}
        />
        {proposta && !somenteLeitura && (
          <div className="sm:col-span-2 -mt-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => alterarTermos({ condicoesPagamento: condicoesDaProposta(proposta) })}>
              <RotateCcw className="w-3.5 h-3.5" />
              Condições da proposta {proposta.numero}
            </button>
          </div>
        )}
        <CampoNumero
          rotulo="Juros de mora"
          valor={r.termos.jurosMoraMesPct}
          onChange={(n) => alterarTermos({ jurosMoraMesPct: n })}
          somenteLeitura={somenteLeitura}
          sufixo="% ao mês"
          dica={`3.3: "${percentualComExtenso(r.termos.jurosMoraMesPct)} ao mês".`}
        />
        <CampoNumero
          rotulo="Multa moratória"
          valor={r.termos.multaMoratoriaPct}
          onChange={(n) => alterarTermos({ multaMoratoriaPct: n })}
          somenteLeitura={somenteLeitura}
          sufixo="%"
          dica="3.3 — sobre o saldo remanescente do preço."
        />
      </Grade>
    </div>
  );
};
