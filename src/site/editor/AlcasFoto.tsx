// Redimensionar e mover uma foto da galeria, direto no preview.
//
// Lazy, só em modo editor.
//
// A galeria é uma GRADE RESPONSIVA, não uma tela em branco — e isso decide o
// que cada gesto significa:
//
//   · altura  → pixels, livres. É a única medida que não depende da largura da
//               tela, e é exatamente o que o campo `tamanho` (baixa/média/alta)
//               já significava.
//   · largura → quantas COLUNAS a foto ocupa (1, 2 ou 3), não pixels. Numa
//               grade de 3 colunas no desktop e 1 no celular, "600px de
//               largura" não quer dizer nada; "ocupa duas colunas" quer, e
//               continua valendo em qualquer tela.
//   · mover   → troca a posição da foto na grade. Posição livre em x,y não
//               existe aqui: para isso há o bloco "Área livre".
//
// O gesto mostra o resultado AO VIVO (via `onPrevia`), antes de virar estado.
// Sem isso o usuário arrasta, não vê nada mexer, e conclui que não funciona —
// o commit só acontece no fim do gesto e levaria um ciclo de postMessage para
// aparecer.

import React, { useRef } from 'react';
import { iniciarGesto, limitar } from './gestos';
import { useBlocoAtual, useEditor } from './contexto';
import {
  FOTO_ALTURA_MAX as ALTURA_MAX,
  FOTO_ALTURA_MIN as ALTURA_MIN,
  FOTO_COLUNAS_MAX as COLUNAS_MAX,
} from '../blocos/tipos';

export interface PreviaFoto {
  altura?: number;
  colunas?: number;
}

interface Props {
  /** Índice da foto dentro de `conteudo.imagens`. */
  indice: number;
  alturaAtual: number;
  colunasAtual: number;
  /** Largura de UMA coluna da grade, em px — para converter arrasto em colunas. */
  medirColuna: () => number;
  /** Desenha o resultado durante o gesto; `null` ao terminar. */
  onPrevia: (p: PreviaFoto | null) => void;
  /** Reordenação: devolve a nova lista de índices quando a foto é solta. */
  onMover: (de: number, para: number) => void;
}

export const AlcasFoto: React.FC<Props> = ({
  indice,
  alturaAtual,
  colunasAtual,
  medirColuna,
  onPrevia,
  onMover,
}) => {
  const { aoRedimensionar } = useEditor();
  const blocoId = useBlocoAtual();
  const previa = useRef<PreviaFoto>({});
  const alvoMover = useRef<number | null>(null);

  if (!blocoId) return null;

  /* ------------------------------------------------------ redimensionar -- */

  const pegarAlca = (e: React.PointerEvent, eixos: ('altura' | 'colunas')[]) => {
    e.stopPropagation();
    e.preventDefault();

    const coluna = medirColuna();
    const base = { altura: alturaAtual, colunas: colunasAtual };

    iniciarGesto(e, base, {
      ao: (g) => {
        const p: PreviaFoto = {};

        if (eixos.includes('altura')) {
          p.altura = Math.round(limitar(g.base.altura + g.dy, ALTURA_MIN, ALTURA_MAX));
        }
        if (eixos.includes('colunas') && coluna > 0) {
          // Quantas colunas o ponteiro andou, arredondando para a mais perto —
          // é o que faz a foto "encaixar" na grade em vez de ficar entre duas.
          const passos = Math.round(g.dx / coluna);
          p.colunas = limitar(g.base.colunas + passos, 1, COLUNAS_MAX);
        }

        previa.current = p;
        onPrevia(p);
      },

      aoTerminar: () => {
        const p = previa.current;
        previa.current = {};
        onPrevia(null);

        // Um campo por vez: cada um é um caminho diferente no conteúdo, e
        // mandar os dois só quando mudaram evita gravar valor igual.
        if (p.altura !== undefined && p.altura !== alturaAtual) {
          aoRedimensionar(blocoId, `imagens.${indice}.altura_px`, p.altura);
        }
        if (p.colunas !== undefined && p.colunas !== colunasAtual) {
          aoRedimensionar(blocoId, `imagens.${indice}.largura_colunas`, p.colunas);
        }
      },
    });
  };

  /* -------------------------------------------------------------- mover -- */

  const pegarMover = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    iniciarGesto(e, indice, {
      limiar: 6,
      ao: (_g, ev) => {
        // Pergunta ao DOM qual foto está sob o ponteiro. Mais simples e mais
        // confiável do que espelhar a lista aqui, e já vem na ordem visual.
        const sob = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .find((el) => el instanceof HTMLElement && el.dataset.foto !== undefined) as
          | HTMLElement
          | undefined;

        const i = sob ? Number(sob.dataset.foto) : NaN;
        alvoMover.current = Number.isInteger(i) && i !== indice ? i : null;

        document
          .querySelectorAll<HTMLElement>('[data-foto]')
          .forEach((el) =>
            el.classList.toggle(
              'ring-2',
              el.dataset.foto === String(alvoMover.current),
            ),
          );
      },
      aoTerminar: () => {
        document
          .querySelectorAll<HTMLElement>('[data-foto]')
          .forEach((el) => el.classList.remove('ring-2'));
        const para = alvoMover.current;
        alvoMover.current = null;
        if (para !== null) onMover(indice, para);
      },
    });
  };

  const alca =
    'absolute z-30 bg-[#004276] border-2 border-white rounded-full shadow touch-none';

  return (
    <>
      {/* Pegada de mover, no topo. Separada das alças de tamanho para que um
          gesto nunca seja confundido com o outro. */}
      <button
        type="button"
        data-alca=""
        onPointerDown={pegarMover}
        title="Arraste para trocar a foto de lugar"
        className="absolute top-2 left-2 z-30 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#004276]/90 text-white text-[10px] font-bold cursor-grab active:cursor-grabbing touch-none"
      >
        <svg width="9" height="12" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.3" />
          <circle cx="8" cy="2" r="1.3" />
          <circle cx="2" cy="7" r="1.3" />
          <circle cx="8" cy="7" r="1.3" />
          <circle cx="2" cy="12" r="1.3" />
          <circle cx="8" cy="12" r="1.3" />
        </svg>
        mover
      </button>

      {/* Borda de baixo: altura. */}
      <div
        data-alca=""
        onPointerDown={(e) => pegarAlca(e, ['altura'])}
        title="Arraste para mudar a altura"
        className={`${alca} left-1/2 -translate-x-1/2 -bottom-1.5 w-12 h-3 cursor-ns-resize`}
      />

      {/* Borda da direita: quantas colunas a foto ocupa. */}
      <div
        data-alca=""
        onPointerDown={(e) => pegarAlca(e, ['colunas'])}
        title="Arraste para a foto ocupar mais colunas"
        className={`${alca} top-1/2 -translate-y-1/2 -right-1.5 h-12 w-3 cursor-ew-resize`}
      />

      {/* Canto: os dois ao mesmo tempo. */}
      <div
        data-alca=""
        onPointerDown={(e) => pegarAlca(e, ['altura', 'colunas'])}
        title="Arraste para mudar altura e largura"
        className={`${alca} -right-1.5 -bottom-1.5 w-4 h-4 cursor-nwse-resize`}
      />
    </>
  );
};

export default AlcasFoto;
