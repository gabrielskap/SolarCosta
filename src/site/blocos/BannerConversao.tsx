// Dobra escura que junta a chamada do simulador ao formulário de captação.
//
// Bloco com LÓGICA: o administrador edita os textos, o formulário continua
// sendo o FormularioLead de sempre — honeypot, máscara de telefone e POST em
// /api/publico/leads ficam no código, fora do alcance do editor.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { FormularioLead } from '../components/FormularioLead';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import type { ConteudoBannerConversao } from './tipos';

export const BannerConversao: React.FC<{ conteudo: ConteudoBannerConversao }> = ({
  conteudo: c,
}) => {
  const { modoEditor } = useEditor();

  return (
  <section className="bg-marca text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
      <div className="space-y-6">
        {(c.rotulo || modoEditor) && (
          <Editavel
            como="span"
            campo="rotulo"
            valor={c.rotulo}
            placeholder="Rótulo"
            className="block text-xs font-bold text-solar tracking-widest uppercase"
          />
        )}
        <Editavel
          como="h2"
          campo="titulo"
          valor={c.titulo}
          placeholder="Título da chamada"
          className="text-3xl md:text-4xl font-black tracking-tight leading-tight"
        />
        <div className="w-12 h-1 bg-emerald-500 rounded-full" />
        <Editavel
          como="p"
          campo="texto"
          valor={c.texto}
          multilinha
          placeholder="Um parágrafo explicando o convite."
          className="text-blue-100 leading-relaxed"
        />
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
};
