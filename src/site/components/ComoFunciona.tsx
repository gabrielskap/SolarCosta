// Os quatro passos entre o primeiro contato e a energia gerando.
//
// Não é enfeite: são os mesmos estágios que a equipe operacionaliza no CRM
// (Leads → Propostas → Contratos/Obras → acompanhamento). O cliente lê aqui o
// processo que de fato existe lá dentro.

import React from 'react';
import { ETAPAS } from '../conteudo';
import { Secao, TituloSecao } from './Secao';

export const ComoFunciona: React.FC = () => (
  <Secao claro id="como-funciona">
    <TituloSecao
      rotulo="Como funciona"
      titulo="Da visita técnica ao medidor trocado"
      descricao="Quatro etapas, com um responsável em cada uma delas. Você sabe sempre em que ponto está o seu projeto."
      centralizado
    />

    <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {ETAPAS.map((etapa, i) => {
        const { Icone } = etapa;
        return (
          <li key={etapa.numero} className="relative">
            {/* Conector entre os passos, só onde há um próximo à direita. */}
            {i < ETAPAS.length - 1 && (
              <span
                aria-hidden="true"
                className="hidden lg:block absolute top-7 left-[calc(50%+2.5rem)] right-[-1.5rem] h-px bg-gradient-to-r from-slate-300 to-transparent"
              />
            )}

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-marca text-solar flex items-center justify-center shadow-md">
                  <Icone className="w-6 h-6" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-solar text-marca text-[11px] font-black flex items-center justify-center border-2 border-white">
                  {etapa.numero}
                </span>
              </div>

              <h3 className="mt-5 text-base font-black text-slate-900">{etapa.titulo}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{etapa.descricao}</p>
            </div>
          </li>
        );
      })}
    </ol>
  </Secao>
);
