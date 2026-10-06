// Arrastar e redimensionar com Pointer Events.
//
// POR QUE NÃO O DRAG-AND-DROP NATIVO DO HTML5, que é o padrão do resto do
// projeto (Kanban de leads, lista de blocos, obras): ele só avisa onde o
// ponteiro ESTÁ quando passa por cima de um alvo válido, e isso basta para
// "solte este cartão naquela coluna". Não basta para nada daqui — alça de
// imagem e elemento de área livre precisam da coordenada contínua a cada
// pixel, e o DnD nativo não a entrega. Ele também não funciona no toque sem
// polyfill, e arrasta uma imagem fantasma que não dá para desligar em todos os
// navegadores. Pointer Events resolve os três de uma vez, unifica mouse,
// toque e caneta, e não custa dependência nova.
//
// A REGRA QUE IMPORTA: todo delta é calculado contra o SNAPSHOT tirado no
// início do gesto, nunca contra o frame anterior. Somar deltas quadro a quadro
// acumula erro de ponto flutuante e o objeto escorrega sozinho ao longo de um
// arrasto longo — é a mesma razão pela qual EditorTelhado guarda
// `giroEmCurso` em vez de ir somando ângulo.

export interface Gesto<T> {
  /** Estado do alvo no pointerdown. Não muda durante o gesto. */
  base: T;
  /** Deslocamento acumulado desde o início, em pixels de tela. */
  dx: number;
  dy: number;
}

export interface OpcoesGesto<T> {
  /** Chamado a cada movimento. Deve desenhar, não salvar. */
  ao: (gesto: Gesto<T>, evento: PointerEvent) => void;
  /** Chamado uma vez no fim. É aqui que o valor vira estado/rede. */
  aoTerminar?: (gesto: Gesto<T>) => void;
  /** Gesto só começa depois de andar isto, em px. Evita que um clique vire arrasto. */
  limiar?: number;
}

/**
 * Inicia um gesto de ponteiro a partir de um onPointerDown.
 *
 * `setPointerCapture` é o que faz o gesto continuar mesmo quando o ponteiro
 * sai do elemento — sem ele, arrastar rápido "solta" o objeto no meio do
 * caminho, que é o bug clássico de arrasto escrito à mão.
 */
export function iniciarGesto<T>(
  evento: React.PointerEvent | PointerEvent,
  base: T,
  opcoes: OpcoesGesto<T>,
): void {
  const alvo = evento.target as Element | null;
  if (!alvo || !('setPointerCapture' in alvo)) return;

  const idPonteiro = evento.pointerId;
  const x0 = evento.clientX;
  const y0 = evento.clientY;
  const limiar = opcoes.limiar ?? 0;

  let passouLimiar = limiar === 0;
  let ultimo: Gesto<T> = { base, dx: 0, dy: 0 };

  try {
    (alvo as Element).setPointerCapture(idPonteiro);
  } catch {
    // Navegador recusou a captura (ponteiro já liberado). O gesto ainda
    // funciona enquanto o ponteiro estiver sobre o elemento — degradar é
    // melhor do que não começar.
  }

  const aoMover = (e: PointerEvent) => {
    if (e.pointerId !== idPonteiro) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;

    if (!passouLimiar) {
      if (Math.hypot(dx, dy) < limiar) return;
      passouLimiar = true;
    }

    ultimo = { base, dx, dy };
    opcoes.ao(ultimo, e);
  };

  const aoSoltar = (e: PointerEvent) => {
    if (e.pointerId !== idPonteiro) return;
    limpar();
    if (passouLimiar) opcoes.aoTerminar?.(ultimo);
  };

  function limpar() {
    window.removeEventListener('pointermove', aoMover);
    window.removeEventListener('pointerup', aoSoltar);
    window.removeEventListener('pointercancel', aoSoltar);
    try {
      (alvo as Element).releasePointerCapture(idPonteiro);
    } catch {
      /* já liberado */
    }
  }

  window.addEventListener('pointermove', aoMover);
  window.addEventListener('pointerup', aoSoltar);
  window.addEventListener('pointercancel', aoSoltar);
}

/** Prende um número a um intervalo. Usado por toda alça de redimensionamento. */
export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}
