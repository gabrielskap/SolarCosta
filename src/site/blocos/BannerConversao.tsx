// Dobra escura que junta a chamada do simulador ao formulário de captação.
//
// Bloco com LÓGICA: o administrador edita os textos, o formulário continua
// sendo o FormularioLead de sempre — honeypot, máscara de telefone e POST em
// /api/publico/leads ficam no código, fora do alcance do editor.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { FormularioLead } from '../components/FormularioLead';
import type { ConteudoBannerConversao } from './tipos';

export const BannerConversao: React.FC<{ conteudo: ConteudoBannerConversao }> = ({
  conteudo: c,
}) => (
  <section className="bg-marca text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
      <div className="space-y-6">
        {c.rotulo && (
          <span className="text-xs font-bold text-solar tracking-widest uppercase">{c.rotulo}</span>
        )}
        <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">{c.titulo}</h2>
        <div className="w-12 h-1 bg-emerald-500 rounded-full" />
        <p className="text-blue-100 leading-relaxed">{c.texto}</p>
        {c.botao?.rotulo && (
          <Link
            to={c.botao.destino}
            className="inline-flex items-center gap-2 bg-solar hover:bg-amber-300 text-marca font-extrabold px-6 py-4 rounded-xl shadow-lg transition-all"
          >
            {c.botao.rotulo}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <FormularioLead
        tom="escuro"
        titulo={c.formulario_titulo}
        descricao={c.formulario_descricao}
      />
    </div>
  </section>
);
