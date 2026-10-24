import React from 'react';
import type { Proposta } from '../../../types';
import { isValidCPFCNPJ, isValidEmail, maskCEP, maskCPFCNPJ, maskPhone, onlyDigits } from '../../../utils/format';
import { CabecalhoModulo, Campo, Grade, type PropsModulo } from '../campos';
import { SeletorProposta } from '../SeletorProposta';

interface Props extends PropsModulo {
  propostas: Proposta[];
  onEscolherProposta: (p: Proposta | null) => void;
}

export const ModuloContratante: React.FC<Props> = ({ r, alterar, alterarTermos, somenteLeitura, propostas, onEscolherProposta }) => {
  const digitos = onlyDigits(r.cpfCnpj);
  const pj = digitos.length === 14;
  const avisoDoc = digitos.length >= 11 && !isValidCPFCNPJ(r.cpfCnpj) ? 'CPF/CNPJ não confere — revise antes de emitir.' : null;
  const avisoEmail = r.termos.contratanteEmail && !isValidEmail(r.termos.contratanteEmail) ? 'E-mail inválido.' : null;

  return (
    <div>
      <CabecalhoModulo titulo="Contratante" onde="Preâmbulo (I), cláusula 10.8 e assinatura." />
      <Grade>
        {!r.id && (
          <SeletorProposta
            propostas={propostas}
            selecionadaId={r.propostaId ?? ''}
            onSelecionar={onEscolherProposta}
            desabilitado={somenteLeitura}
          />
        )}
        <Campo rotulo="Nome / razão social" valor={r.clienteNome} onChange={(v) => alterar({ clienteNome: v })} somenteLeitura={somenteLeitura} larga />
        <Campo
          rotulo="CPF / CNPJ"
          valor={r.cpfCnpj}
          onChange={(v) => alterar({ cpfCnpj: maskCPFCNPJ(v) })}
          somenteLeitura={somenteLeitura}
          aviso={avisoDoc}
          dica={pj ? 'CNPJ: o contrato usa a qualificação de pessoa jurídica.' : undefined}
        />
        <Campo rotulo={pj ? 'Inscrição estadual' : 'RG'} valor={r.rgInscricao} onChange={(v) => alterar({ rgInscricao: v })} somenteLeitura={somenteLeitura} dica="Opcional; sai no preâmbulo quando preenchido." />
        {!pj && (
          <Campo
            rotulo="Nacionalidade"
            valor={r.termos.contratanteNacionalidade}
            onChange={(v) => alterarTermos({ contratanteNacionalidade: v })}
            somenteLeitura={somenteLeitura}
            placeholder="brasileira"
          />
        )}
        <Campo rotulo="Telefone" valor={r.telefone} onChange={(v) => alterar({ telefone: maskPhone(v) })} somenteLeitura={somenteLeitura} tipo="tel" />
        <Campo rotulo="Endereço completo" valor={r.endereco} onChange={(v) => alterar({ endereco: v })} somenteLeitura={somenteLeitura} larga />
        <Campo rotulo="CEP" valor={r.cep} onChange={(v) => alterar({ cep: maskCEP(v) })} somenteLeitura={somenteLeitura} />
        <Campo
          rotulo="E-mail para notificações"
          valor={r.termos.contratanteEmail}
          onChange={(v) => alterarTermos({ contratanteEmail: v })}
          somenteLeitura={somenteLeitura}
          tipo="email"
          aviso={avisoEmail}
          dica="Cláusula 10.8."
        />
      </Grade>
    </div>
  );
};
