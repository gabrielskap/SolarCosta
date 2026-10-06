// Grade de fotos da biblioteca de mídia. Bloco novo: até aqui o site não tinha
// nenhuma foto, só o logotipo e gradientes em CSS.

import React from 'react';
import { Secao, TituloSecao } from '../components/Secao';
import { urlMidia, type ConteudoGaleria } from './tipos';

const ALTURAS: Record<string, string> = {
  baixa: 'h-40',
  media: 'h-56',
  alta: 'h-72',
};

const POSICOES: Record<string, string> = {
  topo: 'object-top',
  centro: 'object-center',
  base: 'object-bottom',
};

export const Galeria: React.FC<{ conteudo: ConteudoGaleria }> = ({ conteudo: c }) => {
  const imagens = (c.imagens ?? []).filter((i) => !!i.midia_id);
  if (imagens.length === 0) return null;

  return (
    <Secao claro={!!c.claro}>
      {(c.rotulo || c.titulo) && (
        <TituloSecao rotulo={c.rotulo} titulo={c.titulo} descricao={c.descricao} centralizado />
      )}

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {imagens.map((img, i) => {
          const automatica = img.tamanho === 'automatica';
          const classeImagem = automatica
            ? 'w-full h-auto'
            : [
                'w-full object-cover',
                ALTURAS[img.tamanho] ?? ALTURAS.media,
                POSICOES[img.posicao] ?? POSICOES.centro,
              ].join(' ');

          return (
            <figure
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              <img
                src={urlMidia(img.midia_id) ?? ''}
                alt={img.legenda || ''}
                className={classeImagem}
                loading="lazy"
              />
              {img.legenda && (
                <figcaption className="px-4 py-3 text-xs text-slate-600 leading-relaxed">
                  {img.legenda}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </Secao>
  );
};
