// Vídeo do YouTube incorporado, com tamanho e posição ajustáveis pelo
// administrador. O `src` do iframe nunca usa a URL crua do campo — só o ID
// de 11 caracteres extraído por `idVideoYoutube`, servido por
// youtube-nocookie.com (modo sem cookie de rastreamento antes do play).

import React from 'react';
import { Secao, TituloSecao } from '../components/Secao';
import { idVideoYoutube, type ConteudoVideoYoutube } from './tipos';

const LARGURAS: Record<string, string> = {
  pequena: 'max-w-md',
  media: 'max-w-2xl',
  grande: 'max-w-4xl',
  completa: 'max-w-none',
};

const ALINHAMENTOS: Record<string, string> = {
  esquerda: 'mr-auto',
  centro: 'mx-auto',
  direita: 'ml-auto',
};

export const VideoYoutube: React.FC<{ conteudo: ConteudoVideoYoutube }> = ({ conteudo: c }) => {
  const id = idVideoYoutube(c.url);
  if (!id) return null;

  const largura = LARGURAS[c.tamanho] ?? LARGURAS.grande;
  const alinhamento = c.tamanho === 'completa' ? '' : (ALINHAMENTOS[c.alinhamento] ?? ALINHAMENTOS.centro);

  return (
    <Secao claro={!!c.claro}>
      {(c.rotulo || c.titulo) && (
        <TituloSecao rotulo={c.rotulo} titulo={c.titulo} descricao={c.descricao} centralizado />
      )}

      <div className={['mt-10', largura, alinhamento].join(' ')}>
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs bg-slate-900">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={c.titulo || 'Vídeo do YouTube'}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {c.legenda && (
          <p className="mt-3 text-xs text-slate-600 leading-relaxed text-center">{c.legenda}</p>
        )}
      </div>
    </Secao>
  );
};
