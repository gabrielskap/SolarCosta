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

import React, { Component, type ReactNode } from 'react';
import { definicao } from './blocos/registro';
import type { BlocoSite } from './blocos/tipos';

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

export const RenderizadorBlocos: React.FC<{ blocos: BlocoSite[] }> = ({ blocos }) => (
  <>
    {blocos.map((bloco) => {
      const def = definicao(bloco.tipo);
      if (!def) return null;

      const { Componente } = def;
      return (
        <LimiteDeErro key={bloco.id} tipo={bloco.tipo}>
          <Componente conteudo={bloco.conteudo} />
        </LimiteDeErro>
      );
    })}
  </>
);
