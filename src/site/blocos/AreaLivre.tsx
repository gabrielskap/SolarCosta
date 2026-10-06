// Área livre: o bloco onde o administrador posiciona texto, imagem e botão
// onde quiser, em vez de preencher os campos de um layout pronto.
//
// É o único bloco do site sem layout fixo, e por isso o único que precisa de
// uma regra explícita para o celular. A regra escolhida é UMA COMPOSIÇÃO SÓ:
// posiciona-se no desktop, e no celular os elementos empilham sozinhos em
// largura total, na ordem de leitura da composição (y, depois x). A
// alternativa — compor desktop e celular separadamente — dobra o trabalho de
// toda edição e deixa esquecer o celular, que é onde está a maior parte do
// tráfego.
//
// DUAS APRESENTAÇÕES, UMA ÁRVORE SÓ. A geometria viaja em custom properties e
// as variantes `md:` decidem se ela vale. Duplicar a árvore (uma por
// apresentação) duplicaria o download de cada <img>.
//
// ESCALA. No desktop o canvas tem largura fixa de LARGURA_AREA_LIVRE e é
// reduzido por `transform: scale()` até caber. O porquê de escalar em vez de
// usar porcentagem está no comentário de LARGURA_AREA_LIVRE, em tipos.ts.
// Como `transform` não afeta o layout, é o container de fora que reserva a
// altura já escalada — sem isso o bloco seguinte subiria por cima.

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Secao, TituloSecao } from '../components/Secao';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import {
  LARGURA_AREA_LIVRE,
  urlMidia,
  type ConteudoAreaLivre,
  type ElementoAreaLivre,
} from './tipos';

const SobreposicaoAreaLivre = lazy(() => import('../editor/SobreposicaoAreaLivre'));

const FUNDOS: Record<string, string> = {
  transparente: '',
  branco: 'bg-white',
  cinza: 'bg-slate-100',
  marca: 'bg-marca text-white',
};

const CORES: Record<string, string> = {
  escuro: 'text-slate-900',
  suave: 'text-slate-600',
  marca: 'text-marca',
  solar: 'text-solar',
  branco: 'text-white',
};

const PESOS: Record<string, string> = {
  normal: 'font-normal',
  bold: 'font-bold',
  black: 'font-black',
};

const ALINHAMENTOS: Record<string, string> = {
  esquerda: 'text-left',
  centro: 'text-center',
  direita: 'text-right',
};

const ALTURA_PADRAO = 420;

/**
 * Fator de redução do canvas, medido da largura disponível.
 *
 * ResizeObserver e não `window.resize`: o bloco também muda de largura quando
 * o iframe do editor troca de aparelho, sem a janela mudar de tamanho.
 */
function useEscala(alvo: React.RefObject<HTMLDivElement | null>): number {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;

    const medir = () => {
      const l = el.getBoundingClientRect().width;
      // Nunca passa de 1: o container do site para em max-w-7xl, e ampliar
      // além do projeto deixaria este bloco fora de escala com todo o resto.
      setEscala(l > 0 ? Math.min(1, l / LARGURA_AREA_LIVRE) : 1);
    };

    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [alvo]);

  return escala;
}

export const AreaLivre: React.FC<{ conteudo: ConteudoAreaLivre }> = ({ conteudo: c }) => {
  const { modoEditor } = useEditor();
  const caixa = useRef<HTMLDivElement | null>(null);
  const escala = useEscala(caixa);

  const altura = Number.isFinite(c.altura) && c.altura > 0 ? c.altura : ALTURA_PADRAO;

  // A ordem no DOM é a ordem de leitura da composição — é ela que o celular
  // usa para empilhar. No desktop a posição vem de left/top e o DOM não
  // importa, então ordenar aqui não custa nada lá.
  const elementos = [...(c.elementos ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);

  if (elementos.length === 0 && !modoEditor) return null;

  const variaveis = {
    ['--w' as string]: `${LARGURA_AREA_LIVRE}px`,
    ['--altura' as string]: `${altura}px`,
    ['--escala' as string]: String(escala),
  } as React.CSSProperties;

  return (
    <Secao claro={!!c.claro} className={FUNDOS[c.fundo ?? 'transparente'] ?? ''}>
      {(c.rotulo || c.titulo || modoEditor) && (
        <div className="mb-10">
          <TituloSecao
            rotulo={c.rotulo}
            titulo={c.titulo}
            campoRotulo="rotulo"
            campoTitulo="titulo"
          />
        </div>
      )}

      {/* Reserva no fluxo a altura JÁ ESCALADA. No celular a altura é
          automática, porque lá os elementos empilham. */}
      <div
        ref={caixa}
        style={variaveis}
        className="relative w-full overflow-hidden md:h-[calc(var(--altura)*var(--escala))]"
      >
        <div
          className="flex flex-col gap-4
                     md:block md:relative md:w-[var(--w)] md:h-[var(--altura)]
                     md:origin-top-left md:[transform:scale(var(--escala))]"
        >
          {elementos.map((el) => (
            <ElementoLivre key={el.id} el={el} modoEditor={modoEditor} />
          ))}

          {modoEditor && (
            <Suspense fallback={null}>
              {/* Dentro do canvas de propósito: assim as alças de arrasto
                  trabalham nas MESMAS coordenadas do projeto, e a conversão
                  tela → projeto é uma divisão pela escala, não um cálculo de
                  offset acumulado. */}
              <SobreposicaoAreaLivre elementos={elementos} escala={escala} altura={altura} />
            </Suspense>
          )}
        </div>
      </div>

      {elementos.length === 0 && modoEditor && (
        <p className="text-center text-sm text-slate-400 border border-dashed border-slate-300 rounded-2xl py-10">
          Área livre vazia. Use o painel à direita para adicionar texto, imagem ou botão.
        </p>
      )}
    </Secao>
  );
};

/**
 * Um elemento posicionado.
 *
 * As classes `md:` carregam toda a diferença entre as duas apresentações:
 * sem elas é um bloco de fluxo normal em largura total (celular), com elas é
 * absoluto na posição e no tamanho do projeto (desktop).
 */
const ElementoLivre: React.FC<{ el: ElementoAreaLivre; modoEditor: boolean }> = ({
  el,
  modoEditor,
}) => {
  const estilo = {
    ['--x' as string]: `${el.x}px`,
    ['--y' as string]: `${el.y}px`,
    ['--ew' as string]: `${el.largura}px`,
    ['--eh' as string]: `${el.altura}px`,
    ['--fs' as string]: `${el.tamanho_fonte ?? 16}px`,
    zIndex: el.camada ?? 1,
  } as React.CSSProperties;

  const posicao =
    'relative w-full h-auto ' +
    'md:absolute md:left-[var(--x)] md:top-[var(--y)] md:w-[var(--ew)] md:h-[var(--eh)]';

  const marca = modoEditor ? { 'data-elemento-livre': el.id } : {};

  if (el.tipo === 'imagem') {
    const url = urlMidia(el.midia_id);
    return (
      <div
        {...marca}
        style={{ ...estilo, borderRadius: el.raio ?? 16 }}
        className={`${posicao} overflow-hidden bg-slate-100`}
      >
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            className={`w-full h-full ${el.ajuste === 'conter' ? 'object-contain' : 'object-cover'}`}
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full min-h-24 text-xs text-slate-400">
            Escolha uma imagem
          </span>
        )}
      </div>
    );
  }

  if (el.tipo === 'botao') {
    const contorno = el.estilo === 'contorno';
    return (
      <div {...marca} style={estilo} className={`${posicao} flex`}>
        <Link
          to={el.destino || '/contato'}
          className={`inline-flex items-center justify-center w-full h-full min-h-11 px-5 rounded-xl font-bold md:text-[length:var(--fs)] transition ${
            contorno
              ? 'border border-slate-300 hover:border-marca text-slate-700 hover:text-marca'
              : 'bg-marca hover:bg-marca-escuro text-white shadow-md'
          }`}
        >
          {el.rotulo || 'Botão'}
        </Link>
      </div>
    );
  }

  return (
    <div
      {...marca}
      style={estilo}
      className={`${posicao} ${CORES[el.cor ?? 'escuro']} ${PESOS[el.peso ?? 'normal']} ${
        ALINHAMENTOS[el.alinhamento ?? 'esquerda']
      } text-base md:text-[length:var(--fs)] leading-snug`}
    >
      {/* O caminho usa o ID do elemento, não o índice: a lista é reordenada por
          (y, x) na renderização, então o índice daqui não é o índice guardado.
          Ver gravarEm() em EditorVisual.tsx, que resolve array por `id`. */}
      <Editavel
        como="div"
        campo={`elementos.${el.id}.texto`}
        valor={el.texto}
        multilinha
        placeholder="Escreva aqui"
        className="w-full h-full whitespace-pre-wrap"
      />
    </div>
  );
};
