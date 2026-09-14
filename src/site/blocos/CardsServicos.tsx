// Grade de serviços. Na home entra compacta (só o resumo) e em /servicos
// aberta (com a lista de detalhes) — a diferença é o campo `completo`.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Secao, TituloSecao } from '../components/Secao';
import { CardServico } from '../components/CardServico';
import type { ConteudoCardsServicos } from './tipos';

export const CardsServicos: React.FC<{ conteudo: ConteudoCardsServicos }> = ({ conteudo: c }) => {
  const itens = c.itens ?? [];
  const temTitulo = !!(c.rotulo || c.titulo);
  // Cartão aberto é alto: duas colunas dão mais ar que quatro.
  const colunas = c.completo ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <Secao claro={!!c.claro} id="servicos">
      {temTitulo && (
        <TituloSecao
          rotulo={c.rotulo}
          titulo={c.titulo}
          descricao={c.descricao}
          centralizado={!!c.centralizado}
        />
      )}

      <div className={[temTitulo ? 'mt-12' : '', 'grid gap-6', colunas].join(' ')}>
        {itens.map((s, i) => (
          <CardServico key={s.id || i} servico={s} completo={!!c.completo} />
        ))}
      </div>

      {c.link_rodape?.rotulo && (
        <div className="mt-10 text-center">
          <Link
            to={c.link_rodape.destino}
            className="inline-flex items-center gap-2 text-sm font-bold text-marca hover:text-marca-escuro transition"
          >
            {c.link_rodape.rotulo}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </Secao>
  );
};
