// Cartão de chamada que fecha uma página. Um ou dois botões; o primeiro é o
// cheio, o segundo o de contorno.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Secao, Cartao } from '../components/Secao';
import type { ConteudoCta } from './tipos';

const PRIMARIO =
  'inline-flex items-center justify-center gap-2 bg-marca hover:bg-marca-escuro text-white font-extrabold px-6 py-4 rounded-xl shadow-md transition-all';
const SECUNDARIO =
  'inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-marca text-slate-700 hover:text-marca font-bold px-6 py-4 rounded-xl transition-all';

export const Cta: React.FC<{ conteudo: ConteudoCta }> = ({ conteudo: c }) => {
  const botoes = c.botoes ?? [];

  return (
    <Secao>
      <Cartao className="p-10 md:p-14 text-center" regua={c.regua || 'from-blue-600 to-indigo-500'}>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">{c.titulo}</h2>
        {c.texto && (
          <p className="mt-3 text-slate-600 max-w-xl mx-auto leading-relaxed">{c.texto}</p>
        )}

        {botoes.length > 0 && (
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {botoes.map((b, i) => (
              <Link key={i} to={b.destino} className={i === 0 ? PRIMARIO : SECUNDARIO}>
                {b.rotulo}
                {i === 0 && <ArrowRight className="w-4 h-4" />}
              </Link>
            ))}
          </div>
        )}
      </Cartao>
    </Secao>
  );
};
