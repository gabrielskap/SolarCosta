import React from 'react';
import { RotateCcw } from 'lucide-react';
import { contratadaDoCadastro } from '../../../contrato/padroes';
import { maskCEP, maskCNPJ, maskCPF, maskPhone } from '../../../utils/format';
import { BOTAO_SECUNDARIO, CabecalhoModulo, Campo, Grade, type PropsModulo } from '../campos';

export const ModuloContratada: React.FC<PropsModulo> = ({ r, alterarContratada, alterarTermos, somenteLeitura, config }) => {
  const k = r.contratada;
  return (
    <div>
      <CabecalhoModulo
        titulo="Solar Costa (contratada)"
        onde="Preâmbulo (II), cláusula 10.8, assinatura e rodapé. É a cópia deste contrato: mudar aqui não altera o cadastro da empresa."
      >
        {!somenteLeitura && (
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onClick={() => {
              const cadastro = contratadaDoCadastro(config?.empresa ?? null);
              alterarContratada(cadastro);
              alterarTermos({ emailContratada: cadastro.email });
            }}
            title="Copia de novo os dados de Padrões do contrato"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Recarregar do cadastro
          </button>
        )}
      </CabecalhoModulo>
      <Grade>
        <Campo rotulo="Razão social" valor={k.razaoSocial} onChange={(v) => alterarContratada({ razaoSocial: v })} somenteLeitura={somenteLeitura} larga />
        <Campo rotulo="CNPJ" valor={k.cnpj} onChange={(v) => alterarContratada({ cnpj: maskCNPJ(v) })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="Telefone" valor={k.telefone} onChange={(v) => alterarContratada({ telefone: maskPhone(v) })} somenteLeitura={somenteLeitura} tipo="tel" />
        <Campo rotulo="Endereço (rua e número)" valor={k.endereco} onChange={(v) => alterarContratada({ endereco: v })} somenteLeitura={somenteLeitura} larga />
        <Campo rotulo="Bairro" valor={k.bairro} onChange={(v) => alterarContratada({ bairro: v })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="CEP" valor={k.cep} onChange={(v) => alterarContratada({ cep: maskCEP(v) })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="Cidade" valor={k.cidade} onChange={(v) => alterarContratada({ cidade: v })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="UF" valor={k.uf} onChange={(v) => alterarContratada({ uf: v.toUpperCase().slice(0, 2) })} somenteLeitura={somenteLeitura} />
        <Campo
          rotulo="E-mail para notificações"
          valor={r.termos.emailContratada}
          onChange={(v) => alterarTermos({ emailContratada: v })}
          somenteLeitura={somenteLeitura}
          tipo="email"
          dica="Cláusula 10.8."
        />
      </Grade>

      <h4 className="font-bold text-slate-800 text-sm mt-6 mb-3">Representante legal</h4>
      <Grade>
        <Campo rotulo="Nome" valor={k.representanteNome} onChange={(v) => alterarContratada({ representanteNome: v })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="Nacionalidade" valor={k.representanteNacionalidade} onChange={(v) => alterarContratada({ representanteNacionalidade: v })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="RG" valor={k.representanteRg} onChange={(v) => alterarContratada({ representanteRg: v })} somenteLeitura={somenteLeitura} />
        <Campo rotulo="CPF" valor={k.representanteCpf} onChange={(v) => alterarContratada({ representanteCpf: maskCPF(v) })} somenteLeitura={somenteLeitura} />
      </Grade>
    </div>
  );
};
