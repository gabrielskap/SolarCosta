// Arrastar e redimensionar os elementos de um bloco de área livre.
//
// Vive DENTRO do canvas escalado (ver AreaLivre.tsx), então as coordenadas aqui
// já são as do projeto de 1200px. A única conversão necessária é dividir o
// deslocamento do ponteiro — que vem em pixels de tela — pela escala.
//
// Só aparece a partir de `md:`. Abaixo disso os elementos empilham e não têm
// posição para arrastar; oferecer alças ali seria mentir sobre o que elas
// fazem.

import React, { useRef, useState } from 'react';
import { iniciarGesto, limitar } from './gestos';
import { useBlocoAtual, useEditor } from './contexto';
import { LARGURA_AREA_LIVRE, type ElementoAreaLivre } from '../blocos/tipos';

/** Menor elemento utilizável. Abaixo disso a alça cobre o próprio elemento. */
const MIN = 24;

interface Props {
  elementos: ElementoAreaLivre[];
  escala: number;
  altura: number;
}

type Geometria = Pick<ElementoAreaLivre, 'x' | 'y' | 'largura' | 'altura'>;

export const SobreposicaoAreaLivre: React.FC<Props> = ({ elementos, escala, altura }) => {
  const { aoMoverElemento, elementoSelecionado, aoSelecionarElemento } = useEditor();
  const blocoId = useBlocoAtual();

  // Geometria em curso, por id. Fica local durante o gesto e só vira estado no
  // fim — mandar cada quadro ao pai custaria um postMessage, um re-render do
  // editor e um reenvio do conteúdo inteiro por pixel arrastado.
  const [previa, setPrevia] = useState<Record<string, Geometria>>({});
  const previaRef = useRef<Geometria | null>(null);

  if (!blocoId) return null;

  const comecar = (
    e: React.PointerEvent,
    el: ElementoAreaLivre,
    modo: 'mover' | 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    aoSelecionarElemento(el.id);

    const base: Geometria = { x: el.x, y: el.y, largura: el.largura, altura: el.altura };

    iniciarGesto(e, base, {
      ao: (g) => {
        // Escala aplicada ao DELTA, não à posição: o ponteiro anda em pixels
        // de tela e o canvas está reduzido, então 10px de mouse são mais de
        // 10px de projeto.
        const dx = g.dx / (escala || 1);
        const dy = g.dy / (escala || 1);
        const b = g.base;

        let n: Geometria;
        if (modo === 'mover') {
          n = { ...b, x: b.x + dx, y: b.y + dy };
        } else {
          const oeste = modo === 'nw' || modo === 'sw';
          const norte = modo === 'nw' || modo === 'ne';

          // Arrastar a borda oeste/norte move o canto E encolhe: o canto
          // oposto é que precisa ficar parado.
          const largura = Math.max(MIN, oeste ? b.largura - dx : b.largura + dx);
          const alt = Math.max(MIN, norte ? b.altura - dy : b.altura + dy);

          n = {
            x: oeste ? b.x + (b.largura - largura) : b.x,
            y: norte ? b.y + (b.altura - alt) : b.y,
            largura,
            altura: alt,
          };
        }

        // Preso ao canvas: um elemento arrastado para fora ficaria invisível e
        // inalcançável, e a única saída seria o painel lateral.
        n.largura = limitar(Math.round(n.largura), MIN, LARGURA_AREA_LIVRE);
        n.altura = limitar(Math.round(n.altura), MIN, altura);
        n.x = limitar(Math.round(n.x), 0, LARGURA_AREA_LIVRE - n.largura);
        n.y = limitar(Math.round(n.y), 0, altura - n.altura);

        previaRef.current = n;
        setPrevia((p) => ({ ...p, [el.id]: n }));
      },

      aoTerminar: () => {
        const n = previaRef.current;
        previaRef.current = null;
        setPrevia((p) => {
          const { [el.id]: _fora, ...resto } = p;
          return resto;
        });
        if (n) aoMoverElemento(blocoId, el.id, n);
      },
    });
  };

  return (
    <div className="hidden md:block absolute inset-0 z-50 pointer-events-none">
      {elementos.map((el) => {
        const g = previa[el.id] ?? el;
        const ativo = elementoSelecionado === el.id;

        return (
          <div
            key={el.id}
            data-alca=""
            className="absolute pointer-events-auto touch-none"
            style={{ left: g.x, top: g.y, width: g.largura, height: g.altura }}
          >
            {/* Área de arrasto. Não cobre o conteúdo inteiro quando o elemento
                é de texto e está selecionado: aí o clique precisa chegar ao
                contentEditable para escrever. */}
            <div
              onPointerDown={(e) => comecar(e, el, 'mover')}
              className={`absolute inset-0 cursor-move transition ${
                ativo
                  ? 'ring-2 ring-[#004276] bg-[#004276]/5'
                  : 'ring-1 ring-dashed ring-slate-400/50 hover:ring-2 hover:ring-[#FFD100]'
              } ${ativo && el.tipo === 'texto' ? 'pointer-events-none' : ''}`}
            />

            {/* Com o texto selecionado, sobra uma faixa no topo para mover —
                o resto fica livre para digitar. */}
            {ativo && el.tipo === 'texto' && (
              <div
                onPointerDown={(e) => comecar(e, el, 'mover')}
                title="Arraste para mover"
                className="absolute -top-5 left-0 h-5 px-2 bg-[#004276] text-white text-[10px] font-bold rounded-t cursor-move flex items-center"
              >
                mover
              </div>
            )}

            {ativo &&
              (['nw', 'ne', 'sw', 'se'] as const).map((canto) => (
                <span
                  key={canto}
                  onPointerDown={(e) => comecar(e, el, canto)}
                  className={`absolute w-3 h-3 bg-white border-2 border-[#004276] rounded-sm ${
                    canto === 'nw'
                      ? '-left-1.5 -top-1.5 cursor-nwse-resize'
                      : canto === 'ne'
                        ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                        : canto === 'sw'
                          ? '-left-1.5 -bottom-1.5 cursor-nesw-resize'
                          : '-right-1.5 -bottom-1.5 cursor-nwse-resize'
                  }`}
                />
              ))}

            {previa[el.id] && (
              <span className="absolute -top-5 right-0 bg-[#004276] text-white text-[10px] font-mono px-1.5 rounded">
                {g.x},{g.y} · {g.largura}×{g.altura}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SobreposicaoAreaLivre;
