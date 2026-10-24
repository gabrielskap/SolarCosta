import React from 'react';
import type { TestemunhaContrato } from '../../../types';
import { dataPorExtenso } from '../../../contrato/marcadores';
import { numeroComExtenso } from '../../../utils/extenso';
import { maskCPF } from '../../../utils/format';
import { CabecalhoModulo, Campo, CampoNumero, Grade, type PropsModulo } from '../campos';

export const ModuloAssinatura: React.FC<PropsModulo> = ({ r, alterarTermos, somenteLeitura }) => {
  const t = r.termos;
  const testemunhas = [0, 1].map((i) => t.testemunhas[i] ?? { nome: '', rg: '', cpf: '' });
  const mudarTestemunha = (i: number, parcial: Partial<TestemunhaContrato>) =>
    alterarTermos({ testemunhas: testemunhas.map((x, j) => (j === i ? { ...x, ...parcial } : x)) });
  const data = dataPorExtenso(t.dataDocumento);

  return (
    <div>
      <CabecalhoModulo titulo="Foro, local, data e testemunhas" onde="Cláusula 10.12, fecho e bloco de assinaturas." />
      <Grade>
        <Campo rotulo="Foro (comarca)" valor={t.foro} onChange={(v) => alterarTermos({ foro: v })} somenteLeitura={somenteLeitura} dica="10.12: “foro da Comarca de …”." />
        <CampoNumero
          rotulo="Número de vias"
          valor={t.numeroVias}
          onChange={(n) => alterarTermos({ numeroVias: Math.max(1, n) })}
          somenteLeitura={somenteLeitura}
          inteiro
          dica={`"assinam o presente em ${numeroComExtenso(t.numeroVias, { feminino: true })} vias".`}
        />
        <Campo rotulo="Local de assinatura" valor={t.localAssinatura} onChange={(v) => alterarTermos({ localAssinatura: v })} somenteLeitura={somenteLeitura} placeholder="Belo Horizonte/MG" />
        <Campo
          rotulo="Data do contrato"
          valor={t.dataDocumento}
          onChange={(v) => alterarTermos({ dataDocumento: v })}
          somenteLeitura={somenteLeitura}
          tipo="date"
          dica={data ? `Sai como "${data}".` : 'Em branco: a data sai em linhas para preencher à mão.'}
        />
      </Grade>

      <h4 className="font-bold text-slate-800 text-sm mt-6 mb-1">Testemunhas</h4>
      <p className="text-xs text-slate-500 mb-3">Campos em branco saem como linhas para preencher na assinatura.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {testemunhas.map((x, i) => (
          <div key={i} className="space-y-3">
            <p className="text-xs font-bold text-slate-700">Testemunha {i + 1}</p>
            <Campo rotulo="Nome" valor={x.nome} onChange={(v) => mudarTestemunha(i, { nome: v })} somenteLeitura={somenteLeitura} />
            <Campo rotulo="RG" valor={x.rg} onChange={(v) => mudarTestemunha(i, { rg: v })} somenteLeitura={somenteLeitura} />
            <Campo rotulo="CPF" valor={x.cpf} onChange={(v) => mudarTestemunha(i, { cpf: maskCPF(v) })} somenteLeitura={somenteLeitura} />
          </div>
        ))}
      </div>
    </div>
  );
};
