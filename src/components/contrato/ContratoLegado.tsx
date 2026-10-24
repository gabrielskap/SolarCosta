// O contrato como era impresso ANTES do modelo Solar Costa (V024).
//
// Só aparece para contrato legado (modelo_versao NULL) que já foi ASSINADO:
// o cliente assinou este texto, e reimprimir outro por cima mudaria o
// documento assinado. Contrato legado ainda não assinado já abre no modelo
// novo, com os padrões derivados das colunas antigas.
//
// O JSX é o mesmo de PDFModal.tsx antes da mudança, com uma diferença: a
// classe `folha-pdf`. Sem ela o PDF do servidor (pdfDocumento.ts) esperava
// uma folha que nunca aparecia e o envio pelo WhatsApp morria em 504.

import React from 'react';
import type { Contrato } from '../../types';

export const ContratoLegado: React.FC<{ contrato: Contrato }> = ({ contrato: cont }) => (
  <div className="folha-pdf bg-white rounded-2xl shadow-xl print:shadow-none p-8 max-w-3xl mx-auto border border-slate-200 space-y-6 text-slate-800 text-xs leading-relaxed">
    <div className="text-center border-b pb-4">
      <h2 className="font-extrabold text-xl text-[#004276] uppercase">
        CONTRATO DE FORNECIMENTO E INSTALAÇÃO DE SISTEMA FOTOVOLTAICO
      </h2>
      <p className="font-bold text-slate-600">CONTRATO Nº {cont.numero}</p>
    </div>

    <div>
      <h3 className="font-bold text-sm text-[#004276] mb-1">1. DAS PARTES</h3>
      <p className="text-justify">
        <strong>CONTRATADA:</strong> SOLAR COSTA ENERGIA SOLAR LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 42.890.112/0001-90, com sede na Rua Alzira Maria Ferreira, 241 – Santa Mônica, Belo Horizonte/MG.
      </p>
      <p className="text-justify mt-1">
        <strong>CONTRATANTE:</strong> <strong>{cont.clienteNome}</strong>, inscrito no CPF/CNPJ sob o nº {cont.cpfCnpj}, RG/IE nº {cont.rgInscricao}, residente e domiciliado na {cont.endereco}, CEP {cont.cep}, telefone {cont.telefone}.
      </p>
    </div>

    <div>
      <h3 className="font-bold text-sm text-[#004276] mb-1">2. DO OBJETO DO CONTRATO</h3>
      <p className="text-justify">
        O presente contrato tem por objeto o fornecimento, projeto, instalação e homologação de um Sistema Gerador Fotovoltaico com potência nominal de <strong>{cont.potenciaKwp} kWp</strong>, composto por <strong>{cont.modulosQtd} módulos fotovoltaicos {cont.moduloModelo}</strong>, inversor(es) <strong>{cont.inversorModelo}</strong> e estrutura de fixação do tipo <strong>{cont.estrutura}</strong>, no local indicado: {cont.localInstalacao}.
      </p>
    </div>

    <div className="pt-8 grid grid-cols-2 gap-8 text-center">
      <div className="border-t border-slate-400 pt-2">
        <p className="font-bold text-slate-900">SOLAR COSTA ENERGIA SOLAR</p>
        <p className="text-slate-500">Contratada</p>
      </div>
      <div className="border-t border-slate-400 pt-2">
        <p className="font-bold text-slate-900">{cont.clienteNome}</p>
        <p className="text-slate-500">Contratante</p>
      </div>
    </div>
  </div>
);

/** Legado assinado mantém o layout antigo; todo o resto usa o modelo. */
export function usaLayoutLegado(c: Contrato): boolean {
  return c.modeloVersao == null && c.status === 'assinado' && !c.termos;
}
