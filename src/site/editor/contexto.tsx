// Estado "estou sendo editado" visto de dentro do site.
//
// ESTE ARQUIVO ENTRA NO BUNDLE PÚBLICO. Ele é importado por <Editavel>, que
// por sua vez é importado pelos componentes de bloco — ou seja, viaja para
// todo visitante do site, editando ou não. Por isso ele só pode importar
// React: nada de lucide, nada de services, nada do protocolo. Todo o resto do
// editor (a ponte, as sobreposições, os gestos) é carregado com React.lazy
// atrás de `modoEditor`, e some do site de quem só está lendo.
//
// Fora do editor o valor é o objeto congelado `INERTE`, sempre a mesma
// referência — nenhum re-render é causado por este contexto no site público.

import React, { createContext, useContext } from 'react';

export interface EstadoEditor {
  modoEditor: boolean;
  /** Bloco selecionado agora, ou null. */
  blocoSelecionado: string | null;
  /** Comita um texto editado no lugar. `campo` é o caminho dentro do conteúdo. */
  aoEditarTexto: (blocoId: string, campo: string, valor: string) => void;
  /** Comita um tamanho arrastado numa alça. Separado do texto porque viaja número. */
  aoRedimensionar: (blocoId: string, campo: string, valor: number) => void;
  /**
   * Substitui uma lista inteira dentro do conteúdo do bloco — é como "trocar
   * de lugar" é gravado. Vai a lista completa, e não "moveu de i para j",
   * porque é o mesmo contrato do endpoint de reordenação de blocos: a ordem
   * nova é o dado, não a operação que levou até ela.
   */
  aoReordenarLista: (
    blocoId: string,
    campo: string,
    lista: Record<string, unknown>[],
  ) => void;
  aoSelecionar: (blocoId: string) => void;
  aoReordenar: (ordem: string[]) => void;

  /** Elemento de área livre selecionado agora, ou null. */
  elementoSelecionado: string | null;
  aoSelecionarElemento: (elementoId: string | null) => void;
  /** Comita a geometria de um elemento de área livre, no fim do gesto. */
  aoMoverElemento: (
    blocoId: string,
    elementoId: string,
    geo: { x: number; y: number; largura: number; altura: number },
  ) => void;
}

const INERTE: EstadoEditor = Object.freeze({
  modoEditor: false,
  blocoSelecionado: null,
  aoEditarTexto: () => {},
  aoRedimensionar: () => {},
  aoReordenarLista: () => {},
  aoSelecionar: () => {},
  aoReordenar: () => {},
  elementoSelecionado: null,
  aoSelecionarElemento: () => {},
  aoMoverElemento: () => {},
});

const ContextoEditor = createContext<EstadoEditor>(INERTE);

export const ProvedorEditor: React.FC<{
  valor: EstadoEditor;
  children: React.ReactNode;
}> = ({ valor, children }) => (
  <ContextoEditor.Provider value={valor}>{children}</ContextoEditor.Provider>
);

export function useEditor(): EstadoEditor {
  return useContext(ContextoEditor);
}

/**
 * Qual bloco está sendo renderizado agora.
 *
 * Separado de EstadoEditor porque muda a cada bloco, enquanto o estado do
 * editor é um só para a árvore inteira — juntá-los faria todo bloco
 * re-renderizar quando a seleção mudasse. É o RenderizadorBlocos que o
 * fornece, e <Editavel> que o consome para saber a quem pertence o texto.
 */
const ContextoBloco = createContext<string | null>(null);

export const ProvedorBloco: React.FC<{ id: string; children: React.ReactNode }> = ({
  id,
  children,
}) => <ContextoBloco.Provider value={id}>{children}</ContextoBloco.Provider>;

export function useBlocoAtual(): string | null {
  return useContext(ContextoBloco);
}

/**
 * `true` quando a URL pede o modo editor.
 *
 * Lido do `location.search` cru, e não de useSearchParams, porque precisa
 * funcionar antes de qualquer rota montar — o SiteLayout decide com base nisto
 * se carrega a ponte do editor.
 */
export function pediuModoEditor(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('editor') === '1';
}
