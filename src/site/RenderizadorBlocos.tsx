// Desenha a lista de blocos de uma página, na ordem em que vieram.
//
// Duas proteções, ambas porque o CMS publica direto, sem rascunho:
//
//   1. Tipo desconhecido é PULADO em silêncio. Acontece quando o banco tem um
//      bloco que este bundle ainda não conhece (deploy em andamento) — o resto
//      da página continua no ar.
//   2. Cada bloco vai dentro do seu próprio error boundary. Um conteúdo com a
//      forma errada derruba só aquele bloco; sem isso, um campo faltando numa
//      lista levaria a página inteira para a tela branca do React.
//
// Em modo editor (dentro do iframe do editor visual) cada bloco ganha um
// invólucro `relative` com `data-bloco`, o provedor que diz a <Editavel> a quem
// o texto pertence, e a camada de seleção/arrasto. Fora do editor nada disso é
// montado nem baixado: a sobreposição é lazy e o invólucro vira o fragmento
// de sempre, para que o DOM público continue idêntico.

import React, { Component, Suspense, lazy, type ReactNode } from 'react';
import { definicao } from './blocos/registro';
import type { BlocoSite } from './blocos/tipos';
import { ProvedorBloco, useEditor } from './editor/contexto';

const SobreposicaoBlocos = lazy(() => import('./editor/SobreposicaoBlocos'));

interface EstadoErro {
  falhou: boolean;
}

interface PropsLimite {
  children: ReactNode;
  tipo: string;
}

class LimiteDeErro extends Component<PropsLimite, EstadoErro> {
  // Declarado à mão de propósito: o projeto não tem @types/react instalado,
  // então `Component` chega aqui como `any` e não traz `props` herdado. A
  // asserção é só de tipo — com useDefineForClassFields:false nada é emitido.
  props!: PropsLimite;
  state: EstadoErro = { falhou: false };

  static getDerivedStateFromError(): EstadoErro {
    return { falhou: true };
  }

  componentDidCatch(erro: unknown): void {
    // Vai para o console do navegador, não para a tela: o visitante não tem o
    // que fazer com um stack trace. Quem precisa ver é quem editou o bloco.
    console.error(`[site] bloco "${this.props.tipo}" falhou ao renderizar`, erro);
  }

  render(): ReactNode {
    if (this.state.falhou) return null;
    return this.props.children;
  }
}

/**
 * Seleção e reordenação vêm do contexto, não por props.
 *
 * Passá-las por prop obrigaria PaginaCms (e a rota curinga, e qualquer lugar
 * que renderize blocos) a carregar e repassar estado que só existe no editor —
 * três arquivos do site público mudariam por causa de uma ferramenta de
 * administração. Pelo contexto, o site público não sabe que o editor existe.
 */
export const RenderizadorBlocos: React.FC<{ blocos: BlocoSite[] }> = ({ blocos }) => {
  const { modoEditor, blocoSelecionado, aoSelecionar, aoReordenar } = useEditor();

  return (
    <>
      {blocos.map((bloco) => {
        const def = definicao(bloco.tipo);
        if (!def) return null;

        const { Componente } = def;
        const corpo = (
          <LimiteDeErro tipo={bloco.tipo}>
            <Componente conteudo={bloco.conteudo} />
          </LimiteDeErro>
        );

        if (!modoEditor) return <React.Fragment key={bloco.id}>{corpo}</React.Fragment>;

        return (
          <ProvedorBloco key={bloco.id} id={bloco.id}>
            <div data-bloco={bloco.id} className="relative">
              {corpo}
              <Suspense fallback={null}>
                <SobreposicaoBlocos
                  blocoId={bloco.id}
                  rotulo={def.rotulo}
                  selecionado={blocoSelecionado === bloco.id}
                  onSelecionar={aoSelecionar}
                  onReordenar={aoReordenar}
                />
              </Suspense>
            </div>
          </ProvedorBloco>
        );
      })}
    </>
  );
};
