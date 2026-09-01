import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck, Zap, FileSignature } from 'lucide-react';
import { useSeo } from '../seo';
import { SERVICOS } from '../conteudo';
import { Secao, TituloSecao, Cartao, ChipIcone } from '../components/Secao';
import { CardServico } from '../components/CardServico';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { ComoFunciona } from '../components/ComoFunciona';

/** O que acompanha qualquer projeto, independentemente do porte. */
const INCLUSO = [
  {
    Icone: FileSignature,
    titulo: 'Engenharia e documentação',
    texto:
      'ART do responsável técnico, projeto elétrico, memorial descritivo e o processo completo de acesso junto à concessionária.',
  },
  {
    Icone: PackageCheck,
    titulo: 'Equipamento com procedência',
    texto:
      'Módulos e inversores de fabricantes com representação no Brasil, nota fiscal em seu nome e garantia registrada.',
  },
  {
    Icone: Zap,
    titulo: 'Instalação com equipe própria',
    texto:
      'Quem instala é a nossa equipe, com estrutura de fixação adequada ao seu telhado e proteções elétricas dimensionadas.',
  },
];

export const Servicos: React.FC = () => {
  useSeo({
    titulo: 'Serviços',
    descricao:
      'Energia solar residencial, comercial e rural, projeto e homologação na concessionária, manutenção e monitoramento em Belo Horizonte e região.',
  });

  return (
    <>
      <CabecalhoPagina
        rotulo="Serviços"
        titulo="Energia solar feita para o seu consumo, não para a média do mercado."
        descricao="Dimensionar por cima encarece o projeto; por baixo, deixa conta para pagar todo mês. A visita técnica existe para acertar esse número antes de qualquer proposta."
      />

      <Secao>
        <div className="grid gap-6 md:grid-cols-2">
          {SERVICOS.map((s) => (
            <CardServico key={s.id} servico={s} completo />
          ))}
        </div>
      </Secao>

      <Secao claro>
        <TituloSecao
          rotulo="Sempre incluso"
          titulo="O que vai junto em todo projeto"
          descricao="Itens que costumam aparecer como extra em orçamento concorrente e aqui fazem parte do serviço."
          centralizado
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {INCLUSO.map((item) => (
            <Cartao key={item.titulo} regua="from-blue-600 to-indigo-500">
              <ChipIcone Icone={item.Icone} cor="blue" />
              <h3 className="mt-4 text-base font-black text-slate-900">{item.titulo}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.texto}</p>
            </Cartao>
          ))}
        </div>
      </Secao>

      <ComoFunciona />

      <Secao>
        <Cartao className="p-10 md:p-14 text-center" regua="from-emerald-500 to-teal-400">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Não sabe qual se aplica ao seu caso?
          </h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto leading-relaxed">
            Comece pelo simulador: com a sua conta de luz já dá para ver o porte do sistema. Depois
            um consultor confirma tudo na visita.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/simulador"
              className="inline-flex items-center justify-center gap-2 bg-marca hover:bg-marca-escuro text-white font-extrabold px-6 py-4 rounded-xl shadow-md transition-all"
            >
              Simular economia
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contato"
              className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-marca text-slate-700 hover:text-marca font-bold px-6 py-4 rounded-xl transition-all"
            >
              Falar com um consultor
            </Link>
          </div>
        </Cartao>
      </Secao>
    </>
  );
};
