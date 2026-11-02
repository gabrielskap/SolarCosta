import React from 'react';
import type { Contrato, GeneroPessoa } from '../../../types';
import { isValidCPFCNPJ, maskCEP, maskCPF, maskCPFCNPJ, maskPhone, onlyDigits } from '../../../utils/format';
import { concordar } from '../../../procuracao/marcadores';
import { ajustarNacionalidade } from '../../../procuracao/padroes';
import { CabecalhoModulo, Campo, Grade } from '../../contrato/campos';
import { SeletorOrigem } from '../../documento/SeletorOrigem';
import { CampoGenero, type PropsModuloProcuracao } from '../campos';

interface Props extends PropsModuloProcuracao {
  contratos: Contrato[];
  onEscolherContrato: (c: Contrato | null) => void;
}

const ESTADOS_CIVIS: [string, string][] = [
  ['solteiro', 'solteira'], ['casado', 'casada'], ['divorciado', 'divorciada'], ['viúvo', 'viúva'],
];

export const ModuloOutorgante: React.FC<Props> = ({ r, alterar, alterarTermos, somenteLeitura, contratos, onEscolherContrato }) => {
  const t = r.termos;
  const pj = onlyDigits(r.cpfCnpj).length === 14;
  const avisoDoc = onlyDigits(r.cpfCnpj).length >= 11 && !isValidCPFCNPJ(r.cpfCnpj) ? 'CPF/CNPJ não confere — revise antes de emitir.' : null;
  const idEstados = React.useId();

  const mudarGenero = (g: GeneroPessoa) =>
    alterarTermos({ outorganteGenero: g, outorganteNacionalidade: ajustarNacionalidade(t.outorganteNacionalidade, g) });

  return (
    <div>
      <CabecalhoModulo
        titulo="Outorgante"
        onde="Quem dá os poderes: o titular das unidades consumidoras. Sai no quadro e na assinatura."
      />
      <Grade>
        {!r.id && (
          <SeletorOrigem
            id="contrato-origem"
            rotulo="Gerar a partir do contrato"
            placeholder="Buscar por número ou cliente"
            rotuloLista="Contratos disponíveis"
            semResultado="Nenhum contrato encontrado."
            dica="Preenche o outorgante, a concessionária e o local com os dados do contrato. Outorgados e textos ficam como estão."
            opcoes={contratos.map((c) => ({
              id: c.id,
              rotulo: `${c.numero} · ${c.clienteNome}`,
              busca: `${c.numero} ${c.clienteNome} ${c.cpfCnpj}`,
            }))}
            selecionadaId={r.contratoId}
            onSelecionar={(id) => onEscolherContrato(contratos.find((c) => c.id === id) ?? null)}
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
          dica={pj ? 'CNPJ: a procuração usa a qualificação de pessoa jurídica.' : undefined}
        />
        <Campo
          rotulo={pj ? 'Inscrição estadual' : 'RG'}
          valor={r.rgInscricao}
          onChange={(v) => alterar({ rgInscricao: v })}
          somenteLeitura={somenteLeitura}
          dica="Opcional; sai na qualificação quando preenchido."
        />
        {!pj && (
          <>
            <CampoGenero valor={t.outorganteGenero} onChange={mudarGenero} somenteLeitura={somenteLeitura} />
            <Campo
              rotulo="Nacionalidade"
              valor={t.outorganteNacionalidade}
              onChange={(v) => alterarTermos({ outorganteNacionalidade: v })}
              somenteLeitura={somenteLeitura}
              placeholder="brasileira"
            />
            <Campo
              rotulo="Estado civil"
              valor={t.outorganteEstadoCivil}
              onChange={(v) => alterarTermos({ outorganteEstadoCivil: v })}
              somenteLeitura={somenteLeitura}
              lista={idEstados}
              dica="Opcional."
            />
            <datalist id={idEstados}>
              {ESTADOS_CIVIS.map(([m, f]) => (
                <option key={m} value={concordar(t.outorganteGenero, m, f)} />
              ))}
              <option value="em união estável" />
            </datalist>
            <Campo
              rotulo="Profissão"
              valor={t.outorganteProfissao}
              onChange={(v) => alterarTermos({ outorganteProfissao: v })}
              somenteLeitura={somenteLeitura}
              dica="Opcional."
            />
          </>
        )}
        <Campo rotulo="Telefone" valor={r.telefone} onChange={(v) => alterar({ telefone: maskPhone(v) })} somenteLeitura={somenteLeitura} tipo="tel" dica="Não sai no documento; é o número sugerido no envio." />
        <Campo rotulo="Endereço completo" valor={r.endereco} onChange={(v) => alterar({ endereco: v })} somenteLeitura={somenteLeitura} larga placeholder="Rua, número – bairro, cidade/UF" />
        <Campo rotulo="CEP" valor={r.cep} onChange={(v) => alterar({ cep: maskCEP(v) })} somenteLeitura={somenteLeitura} />
      </Grade>

      {pj && (
        <>
          <h4 className="font-bold text-slate-800 text-sm mt-6 mb-1">Representante da empresa</h4>
          <p className="text-xs text-slate-500 mb-3">Quem assina pela pessoa jurídica: "neste ato representada por …".</p>
          <Grade>
            <Campo rotulo="Nome" valor={t.representanteNome} onChange={(v) => alterarTermos({ representanteNome: v })} somenteLeitura={somenteLeitura} />
            <Campo rotulo="CPF" valor={t.representanteCpf} onChange={(v) => alterarTermos({ representanteCpf: maskCPF(v) })} somenteLeitura={somenteLeitura} />
            <CampoGenero valor={t.representanteGenero} onChange={(g) => alterarTermos({ representanteGenero: g })} somenteLeitura={somenteLeitura} />
          </Grade>
        </>
      )}
    </div>
  );
};
