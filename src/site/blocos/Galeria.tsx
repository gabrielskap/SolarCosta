// Grade de fotos da biblioteca de mídia. Bloco novo: até aqui o site não tinha
// nenhuma foto, só o logotipo e gradientes em CSS.
//
// Cada foto tem duas medidas que o editor visual ajusta arrastando, e as duas
// são opcionais — conteúdo salvo antes do editor existir desenha exatamente
// como desenhava:
//
//   · `altura_px`       vence o `tamanho` (baixa/média/alta) quando presente.
//     Fica numa chave própria, e não dentro do enum, para que o <select> do
//     painel continue válido; escolher um tamanho lá apaga o valor arrastado.
//   · `largura_colunas` diz quantas colunas da grade a foto ocupa (1 a 3).
//     Largura em PIXELS não existiria aqui: a grade tem 3 colunas no desktop,
//     2 no tablet e 1 no celular, e um valor em px só valeria numa delas.
//
// Reordenar é "mudar de lugar": a posição vem da ordem da lista, não de
// coordenadas. Para posicionar livremente em x,y existe o bloco "Área livre".

import React, { Suspense, lazy, useRef, useState } from 'react';
import { Secao, TituloSecao } from '../components/Secao';
import { Editavel } from '../editor/Editavel';
import { useBlocoAtual, useEditor } from '../editor/contexto';
import type { PreviaFoto } from '../editor/AlcasFoto';
import {
  FOTO_ALTURA_MAX,
  FOTO_ALTURA_MIN,
  FOTO_COLUNAS_MAX,
  urlMidia,
  type ConteudoGaleria,
} from './tipos';

const AlcasFoto = lazy(() => import('../editor/AlcasFoto'));

const ALTURAS: Record<string, string> = {
  baixa: 'h-40',
  media: 'h-56',
  alta: 'h-72',
};

/** Altura em px equivalente a cada opção do <select>, para a alça começar daí. */
const ALTURAS_PX: Record<string, number> = { baixa: 160, media: 224, alta: 288 };

const POSICOES: Record<string, string> = {
  topo: 'object-top',
  centro: 'object-center',
  base: 'object-bottom',
};

/**
 * Quantas colunas a foto ocupa.
 *
 * As classes são literais porque o Tailwind varre o código em busca de nomes
 * de classe: `col-span-${n}` não existiria no CSS gerado.
 */
const VAOS: Record<number, string> = {
  1: '',
  2: 'sm:col-span-2',
  3: 'sm:col-span-2 lg:col-span-3',
};

export const Galeria: React.FC<{ conteudo: ConteudoGaleria }> = ({ conteudo: c }) => {
  const { modoEditor, aoReordenarLista } = useEditor();
  const blocoId = useBlocoAtual();
  const imagens = (c.imagens ?? []).filter((i) => !!i.midia_id);

  // Galeria vazia some do site — mas no editor precisa aparecer, senão o bloco
  // recém-adicionado seria invisível e não haveria onde escolher a primeira foto.
  if (imagens.length === 0 && !modoEditor) return null;

  const mover = (de: number, para: number) => {
    if (!blocoId) return;
    const lista = [...(c.imagens ?? [])];
    const [movida] = lista.splice(de, 1);
    if (!movida) return;
    lista.splice(para, 0, movida);
    aoReordenarLista(blocoId, 'imagens', lista as unknown as Record<string, unknown>[]);
  };

  return (
    <Secao claro={!!c.claro}>
      {(c.rotulo || c.titulo || modoEditor) && (
        <TituloSecao
          rotulo={c.rotulo}
          titulo={c.titulo}
          descricao={c.descricao}
          centralizado
          campoRotulo="rotulo"
          campoTitulo="titulo"
          campoDescricao="descricao"
        />
      )}

      {imagens.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400 border border-dashed border-slate-300 rounded-2xl py-10">
          Nenhuma foto escolhida ainda. Use o painel à direita para adicionar.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {imagens.map((img, i) => (
            <Foto key={i} img={img} indice={i} modoEditor={modoEditor} onMover={mover} />
          ))}
        </div>
      )}
    </Secao>
  );
};

const Foto: React.FC<{
  img: ConteudoGaleria['imagens'][number];
  indice: number;
  modoEditor: boolean;
  onMover: (de: number, para: number) => void;
}> = ({ img, indice, modoEditor, onMover }) => {
  const caixa = useRef<HTMLDivElement | null>(null);
  // Resultado do gesto em andamento. Fica local e some no fim: é o que faz a
  // foto acompanhar o mouse enquanto arrasta, em vez de só pular no fim.
  const [previa, setPrevia] = useState<PreviaFoto | null>(null);

  const alturaSalva =
    typeof img.altura_px === 'number' && Number.isFinite(img.altura_px)
      ? Math.min(FOTO_ALTURA_MAX, Math.max(FOTO_ALTURA_MIN, img.altura_px))
      : null;

  const colunasSalvas =
    typeof img.largura_colunas === 'number' && img.largura_colunas >= 1
      ? Math.min(FOTO_COLUNAS_MAX, Math.round(img.largura_colunas))
      : 1;

  const altura = previa?.altura ?? alturaSalva;
  const colunas = previa?.colunas ?? colunasSalvas;

  // "Automática" mostra a foto inteira — mas perde o sentido assim que existe
  // uma altura fixa, arrastada ou escolhida.
  const automatica = img.tamanho === 'automatica' && altura === null;

  const classeImagem = automatica
    ? 'w-full h-auto'
    : [
        'w-full object-cover',
        // A classe de altura só entra quando não há valor em px: as duas juntas
        // brigariam, e qual venceria dependeria da ordem no CSS gerado.
        altura === null ? (ALTURAS[img.tamanho] ?? ALTURAS.media) : '',
        POSICOES[img.posicao] ?? POSICOES.centro,
      ].join(' ');

  return (
    <figure
      data-foto={indice}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ring-[#FFD100] ${VAOS[colunas] ?? ''}`}
    >
      {/* Wrapper só da imagem: é nele que as alças se ancoram, para ficarem na
          borda da FOTO e não na borda do cartão (que inclui a legenda). */}
      <div ref={caixa} className="relative">
        <img
          src={urlMidia(img.midia_id) ?? ''}
          alt={img.legenda || ''}
          className={classeImagem}
          style={altura !== null ? { height: altura } : undefined}
          loading="lazy"
        />

        {modoEditor && (
          <Suspense fallback={null}>
            <AlcasFoto
              indice={indice}
              alturaAtual={
                altura ?? ALTURAS_PX[img.tamanho] ?? caixa.current?.getBoundingClientRect().height ?? 224
              }
              colunasAtual={colunas}
              medirColuna={() => caixa.current?.getBoundingClientRect().width ?? 0}
              onPrevia={setPrevia}
              onMover={onMover}
            />
          </Suspense>
        )}

        {previa && (
          <span className="absolute top-2 right-2 z-30 bg-[#004276] text-white text-[10px] font-bold font-mono px-2 py-1 rounded-md pointer-events-none">
            {previa.altura !== undefined ? `${previa.altura}px` : ''}
            {previa.altura !== undefined && previa.colunas !== undefined ? ' · ' : ''}
            {previa.colunas !== undefined
              ? `${previa.colunas} ${previa.colunas === 1 ? 'coluna' : 'colunas'}`
              : ''}
          </span>
        )}
      </div>

      {(img.legenda || modoEditor) && (
        <Editavel
          como="div"
          campo={`imagens.${indice}.legenda`}
          valor={img.legenda}
          placeholder="Legenda (opcional)"
          className="px-4 py-3 text-xs text-slate-600 leading-relaxed"
        />
      )}
    </figure>
  );
};
