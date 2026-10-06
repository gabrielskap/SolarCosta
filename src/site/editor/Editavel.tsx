// Um texto do site que vira editável quando o editor visual está aberto.
//
// ESTE ARQUIVO ENTRA NO BUNDLE PÚBLICO — ele é importado pelos componentes de
// bloco, que todo visitante baixa. Por isso só importa React e o contexto
// (que também é mínimo). Fora do editor ele devolve exatamente
// `<tag className=…>{valor}</tag>`: nenhum atributo a mais, nenhum nó a mais,
// nenhum listener. O DOM do site publicado é idêntico ao de antes do editor
// existir.
//
// POR QUE OS COMPONENTES FORAM ALTERADOS, EM VEZ DE ADIVINHAR PELO DOM
//
// A alternativa barata seria, em modo editor, percorrer o `conteudo` do bloco
// e casar cada string com o elemento cujo texto fosse igual. Ela quebra em
// quatro casos que o site tem hoje:
//
//   · Heroi põe `titulo` e `titulo_destaque` dentro do MESMO <h1>, e `titulo`
//     é um nó de texto solto — não existe elemento para marcar.
//   · Textos repetem: "Falar com um consultor" aparece em mais de um bloco, e
//     o casamento ficaria ambíguo.
//   · Campo vazio não tem nó nenhum no DOM, então seria ineditável — e campo
//     vazio é comum no conteúdo de fábrica (`rotulo: ''`).
//   · Só o componente sabe o que mostrar num campo vazio e quando esconder a
//     seção inteira (`{(c.rotulo || c.titulo) && …}`).
//
// Trocar ~5 linhas por componente compra precisão em todos os quatro.
//
// NÃO CONTROLADO DE PROPÓSITO: o texto é escrito no DOM imperativamente e
// nunca enquanto o nó está com foco. Um contentEditable controlado pelo React
// re-renderiza a cada tecla e joga o caret para o fim da linha a cada letra.

import React, { useEffect, useRef } from 'react';
import { useBlocoAtual, useEditor } from './contexto';

type Tag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'li' | 'strong';

interface Props {
  /** Tag que será renderizada. O componente DESENHA a tag, não envolve nada. */
  como: Tag;
  /** Caminho dentro do conteúdo do bloco: "titulo", "itens.2.texto". */
  campo: string;
  valor: string | undefined | null;
  className?: string;
  /** Enter quebra linha em vez de confirmar. Para parágrafos longos. */
  multilinha?: boolean;
  /** Texto fantasma quando o campo está vazio (só aparece no editor). */
  placeholder?: string;
}

export const Editavel: React.FC<Props> = ({
  como,
  campo,
  valor,
  className,
  multilinha,
  placeholder,
}) => {
  const { modoEditor, aoEditarTexto } = useEditor();
  const blocoId = useBlocoAtual();
  const no = useRef<HTMLElement | null>(null);
  const texto = valor ?? '';

  // Sincroniza o DOM com o estado — exceto enquanto o usuário digita. Sem a
  // guarda de foco, o eco do rascunho voltando do pai reescreveria o nó no
  // meio da frase e o caret saltaria.
  useEffect(() => {
    const el = no.current;
    if (!el || !modoEditor) return;
    if (document.activeElement === el) return;
    if (el.textContent !== texto) el.textContent = texto;
  }, [texto, modoEditor]);

  if (!modoEditor || !blocoId) {
    return React.createElement(como, { className }, texto);
  }

  const comitar = () => {
    const atual = no.current?.textContent ?? '';
    if (atual !== texto) aoEditarTexto(blocoId, campo, atual);
  };

  return React.createElement(como, {
    ref: no,
    className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-editavel': '',
    'data-campo': campo,
    // Só marca vazio quando está vazio DE VERDADE: o ::before do placeholder
    // viraria texto duplicado por cima do conteúdo real.
    'data-vazio': texto.trim() === '' ? (placeholder ?? 'Escreva aqui…') : undefined,

    // O clique não pode subir até a sobreposição do bloco, senão selecionar o
    // bloco rouba o foco do campo que acabou de ser clicado.
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),

    onBlur: comitar,

    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multilinha) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
        return;
      }
      // Escape devolve o valor salvo e sai, sem comitar: é o "desfazer esta
      // edição" que todo campo de texto do CRM já tem.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (no.current) no.current.textContent = texto;
        (e.target as HTMLElement).blur();
      }
    },

    // Cola sempre como texto puro. Colar de um editor de texto traria <span>
    // com estilo embutido para dentro do conteúdo, e o `conteudo` do bloco
    // guarda string, não HTML.
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault();
      const t = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, multilinha ? t : t.replace(/\s*\n+\s*/g, ' '));
    },
  });
};
