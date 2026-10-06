// A camada que torna cada bloco clicável e arrastável dentro do preview.
//
// Fica POR CIMA do bloco, não dentro dele: o site continua desenhado
// exatamente como será publicado, e a interação do editor vive numa camada
// separada que some junto com o modo editor. É também o que permite capturar o
// clique sem brigar com o conteúdo — o `pointer-events: none` que o PonteEditor
// aplica nos blocos faz o clique chegar limpo aqui.
//
// Lazy, carregada só em modo editor: nada disto entra no bundle de quem está
// lendo o site.

import React, { useRef, useState } from 'react';
import { iniciarGesto } from './gestos';

interface Props {
  blocoId: string;
  rotulo: string;
  selecionado: boolean;
  onSelecionar: (id: string) => void;
  /** Recebe a nova ordem completa quando um arrasto termina. */
  onReordenar: (ordem: string[]) => void;
}

/**
 * Lê a ordem atual dos blocos direto do DOM.
 *
 * O preview não conhece a lista de blocos — ele só recebe o conteúdo
 * renderizado. Perguntar ao DOM quem está onde é mais simples e mais confiável
 * do que espelhar a lista aqui, e já vem na ordem visual de verdade.
 */
function ordemNoDom(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-bloco]'))
    .map((el) => el.dataset.bloco!)
    .filter(Boolean);
}

export const SobreposicaoBlocos: React.FC<Props> = ({
  blocoId,
  rotulo,
  selecionado,
  onSelecionar,
  onReordenar,
}) => {
  const [arrastando, setArrastando] = useState(false);
  const [alvo, setAlvo] = useState<{ id: string; antes: boolean } | null>(null);
  const alvoRef = useRef<{ id: string; antes: boolean } | null>(null);

  /**
   * Decide onde a linha de inserção cai, pelo ponto médio de cada bloco.
   *
   * Comparar com o meio, e não com a borda, é o que faz o alvo trocar no
   * momento em que o cursor "passa" visualmente o vizinho — com a borda, a
   * linha só mudaria depois de atravessar o bloco inteiro.
   */
  const calcularAlvo = (clientY: number) => {
    const blocos = Array.from(document.querySelectorAll<HTMLElement>('[data-bloco]'));
    for (const el of blocos) {
      const id = el.dataset.bloco!;
      if (id === blocoId) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return { id, antes: clientY < r.top + r.height / 2 };
      }
    }
    return null;
  };

  const aoPegar = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelecionar(blocoId);

    iniciarGesto(e, null, {
      limiar: 6,
      ao: (_g, ev) => {
        setArrastando(true);
        const a = calcularAlvo(ev.clientY);
        alvoRef.current = a;
        setAlvo(a);
      },
      aoTerminar: () => {
        const a = alvoRef.current;
        setArrastando(false);
        setAlvo(null);
        alvoRef.current = null;
        if (!a) return;

        const atual = ordemNoDom();
        const de = atual.indexOf(blocoId);
        if (de < 0) return;

        const sem = atual.filter((id) => id !== blocoId);
        const i = sem.indexOf(a.id);
        if (i < 0) return;

        sem.splice(a.antes ? i : i + 1, 0, blocoId);
        onReordenar(sem);
      },
    });
  };

  return (
    <>
      {/* Captura de clique: cobre o bloco inteiro e só seleciona. */}
      <div
        onPointerDown={() => onSelecionar(blocoId)}
        className={`absolute inset-0 z-10 cursor-pointer transition ${
          selecionado
            ? 'ring-2 ring-[#004276] ring-inset'
            : 'hover:ring-2 hover:ring-[#FFD100] hover:ring-inset'
        }`}
        style={{ pointerEvents: 'auto' }}
      />

      {/* Etiqueta + pegada de arrasto. Só no hover ou no bloco selecionado,
          senão o preview vira um mural de tarjas azuis. */}
      <div
        className={`absolute top-0 left-0 z-20 flex items-stretch rounded-br-lg overflow-hidden shadow-sm transition ${
          selecionado ? 'opacity-100' : 'opacity-0 hover:opacity-100'
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        <span className="bg-[#004276] text-white text-[10px] font-bold px-2 py-1 whitespace-nowrap">
          {rotulo}
        </span>
        <button
          type="button"
          onPointerDown={aoPegar}
          title="Arraste para reordenar"
          className="bg-[#003158] text-blue-200 hover:text-white px-1.5 cursor-grab active:cursor-grabbing touch-none"
        >
          {/* SVG inline em vez de lucide: esta camada vive no bundle do site, e
              o preview não deve arrastar o pacote de ícones só por isto. */}
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="2" r="1.3" />
            <circle cx="8" cy="2" r="1.3" />
            <circle cx="2" cy="7" r="1.3" />
            <circle cx="8" cy="7" r="1.3" />
            <circle cx="2" cy="12" r="1.3" />
            <circle cx="8" cy="12" r="1.3" />
          </svg>
        </button>
      </div>

      {arrastando && (
        <div className="absolute inset-0 z-10 bg-[#004276]/10 ring-2 ring-[#FFD100] ring-inset pointer-events-none" />
      )}

      {alvo && <LinhaDeInsercao alvo={alvo} />}
    </>
  );
};

/**
 * Linha horizontal mostrando onde o bloco vai cair.
 *
 * Posicionada em `fixed` contra o viewport do iframe, porque o bloco de
 * destino é outro elemento da página — relativa ao bloco arrastado ela
 * apareceria no lugar errado.
 */
const LinhaDeInsercao: React.FC<{ alvo: { id: string; antes: boolean } }> = ({ alvo }) => {
  const el = document.querySelector<HTMLElement>(`[data-bloco="${alvo.id}"]`);
  if (!el) return null;

  const r = el.getBoundingClientRect();
  return (
    <div
      className="fixed left-0 right-0 z-30 pointer-events-none"
      style={{ top: (alvo.antes ? r.top : r.bottom) - 2 }}
    >
      <div className="h-1 bg-[#FFD100] shadow-[0_0_8px_rgba(255,209,0,.8)]" />
    </div>
  );
};

export default SobreposicaoBlocos;
