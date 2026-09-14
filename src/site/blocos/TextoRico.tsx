// Parágrafos livres, com imagem opcional ao lado. Não existia no site antes do
// CMS: é o bloco para o administrador escrever algo que os tipos fechados não
// comportam, sem precisar de código novo.

import React from 'react';
import { Secao, TituloSecao } from '../components/Secao';
import { urlMidia, type ConteudoTextoRico } from './tipos';

export const TextoRico: React.FC<{ conteudo: ConteudoTextoRico }> = ({ conteudo: c }) => {
  const imagem = urlMidia(c.imagem_id);
  const paragrafos = (c.paragrafos ?? []).filter(Boolean);

  return (
    <Secao claro={!!c.claro}>
      <div className={imagem ? 'grid lg:grid-cols-2 gap-10 items-center' : 'max-w-3xl'}>
        <div>
          {(c.rotulo || c.titulo) && <TituloSecao rotulo={c.rotulo} titulo={c.titulo} />}
          <div className="mt-6 space-y-4">
            {paragrafos.map((p, i) => (
              <p key={i} className="text-base text-slate-600 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>

        {imagem && (
          <img
            src={imagem}
            alt=""
            className="w-full rounded-2xl border border-slate-200/80 shadow-xs"
            loading="lazy"
          />
        )}
      </div>
    </Secao>
  );
};
