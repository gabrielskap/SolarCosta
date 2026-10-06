// Alças para aumentar e diminuir uma imagem arrastando a borda.
//
// Lazy, só em modo editor. Fica numa camada por cima da imagem; a imagem em si
// não muda de componente nem ganha wrapper no site publicado.
//
// O VALOR É GRAVADO NUMA CHAVE NOVA, AO LADO DO ENUM EXISTENTE — e não no
// lugar dele. A galeria já tem `tamanho: baixa|media|alta|automatica`, que é um
// <select> no painel. Se a alça escrevesse ali um número, o <select> ficaria em
// branco (nenhuma opção bate) e o conteúdo já salvo teria de ser migrado. Com
// uma chave separada, o componente prefere o número quando ele existe e cai no
// enum quando não existe: conteúdo antigo continua desenhando igual, e escolher
// um tamanho no painel volta a valer porque apaga o número.
//
// Nada disso precisou de migration: `conteudo` é jsonb e o schema do servidor
// (schemaConteudo em site.routes.ts) aceita número em qualquer chave.

import React, { useRef, useState } from 'react';
import { iniciarGesto, limitar } from './gestos';
import { useBlocoAtual, useEditor } from './contexto';

interface Props {
  /** Caminho do campo numérico: "imagens.2.altura_px", "imagem_largura_pct". */
  campo: string;
  /** Valor atual, ou null quando ainda não houve ajuste manual. */
  valor: number | null;
  min: number;
  max: number;
  /**
   * `altura` arrasta a borda de baixo (galeria: a restrição é a altura da
   * linha). `largura` arrasta a borda direita e o valor é percentual (texto
   * livre: a imagem vive numa coluna cuja largura em px muda com o viewport,
   * então px estaria errado no celular).
   */
  eixo: 'altura' | 'largura';
  /** Medida corrente do elemento, usada quando ainda não há valor salvo. */
  medirAtual: () => number;
  /** Largura do container, para converter px em % no eixo horizontal. */
  medirContainer?: () => number;
  /**
   * Desenha o resultado DURANTE o gesto; `null` ao terminar.
   *
   * Sem isto a imagem só muda de tamanho depois do pointerup, quando o valor
   * dá a volta por postMessage até o editor e volta no conteúdo. O usuário
   * arrasta, não vê nada acontecer, e conclui que a alça não funciona.
   */
  onPrevia?: (valor: number | null) => void;
}

export const AlcasImagem: React.FC<Props> = ({
  campo,
  valor,
  min,
  max,
  eixo,
  medirAtual,
  medirContainer,
  onPrevia,
}) => {
  const { aoRedimensionar } = useEditor();
  const blocoId = useBlocoAtual();
  const [previa, setPrevia] = useState<number | null>(null);
  const previaRef = useRef<number | null>(null);

  const anunciar = (v: number | null) => {
    previaRef.current = v;
    setPrevia(v);
    onPrevia?.(v);
  };

  if (!blocoId) return null;

  const aoPegar = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const inicial = valor ?? medirAtual();
    const container = eixo === 'largura' ? (medirContainer?.() ?? 0) : 0;

    iniciarGesto(e, inicial, {
      ao: (g) => {
        // Delta sempre contra o snapshot `g.base`, nunca acumulado quadro a
        // quadro — ver o cabeçalho de gestos.ts.
        const bruto =
          eixo === 'altura'
            ? g.base + g.dy
            : container > 0
              ? g.base + (g.dx / container) * 100
              : g.base;

        anunciar(Math.round(limitar(bruto, min, max)));
      },
      aoTerminar: () => {
        const v = previaRef.current;
        anunciar(null);
        // Só o fim do gesto vira estado: mandar cada quadro ao pai custaria um
        // postMessage, um re-render do editor e um reenvio do conteúdo inteiro
        // por pixel arrastado.
        if (v !== null && v !== valor) aoRedimensionar(blocoId, campo, v);
      },
    });
  };

  const vertical = eixo === 'altura';

  return (
    <>
      <div
        data-alca=""
        onPointerDown={aoPegar}
        title={vertical ? 'Arraste para mudar a altura' : 'Arraste para mudar a largura'}
        // z-30 para passar por cima da camada de seleção do bloco
        // (SobreposicaoBlocos usa z-10): sem isso o clique na alça seria
        // engolido por ela e viraria "selecionar o bloco".
        className={
          vertical
            ? 'absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-4 w-14 cursor-ns-resize touch-none z-30 flex items-center justify-center'
            : 'absolute top-1/2 -translate-y-1/2 -right-1.5 w-4 h-14 cursor-ew-resize touch-none z-30 flex items-center justify-center'
        }
      >
        <span
          className={`bg-[#004276] rounded-full shadow border-2 border-white ${
            vertical ? 'w-12 h-2.5' : 'h-12 w-2.5'
          }`}
        />
      </div>

      {previa !== null && (
        <div className="absolute top-2 right-2 z-30 bg-[#004276] text-white text-[10px] font-bold font-mono px-2 py-1 rounded-md pointer-events-none">
          {previa}
          {vertical ? 'px' : '%'}
        </div>
      )}
    </>
  );
};

export default AlcasImagem;
