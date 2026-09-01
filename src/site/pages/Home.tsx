import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSeo } from '../seo';
import { SERVICOS, FAQ } from '../conteudo';
import { Secao, TituloSecao, Cartao } from '../components/Secao';
import { CardServico } from '../components/CardServico';
import { ComoFunciona } from '../components/ComoFunciona';
import { PerguntasFrequentes } from '../components/PerguntasFrequentes';
import { Heroi } from '../components/Heroi';
import { SeloCredibilidade } from '../components/SeloCredibilidade';
import { FormularioLead } from '../components/FormularioLead';

export const Home: React.FC = () => {
  useSeo({
    titulo: 'Energia solar em Belo Horizonte',
    descricao:
      'Projeto, instalação e homologação de energia solar em Belo Horizonte e região. Simule sua economia e receba uma proposta com engenharia responsável.',
  });

  return (
    <>
      <Heroi />
      <SeloCredibilidade />

      <Secao claro id="servicos">
        <TituloSecao
          rotulo="O que fazemos"
          titulo="Do telhado de casa ao galpão da empresa"
          descricao="Cada projeto é dimensionado pela sua conta de luz e pelo seu telhado — não por um kit de catálogo."
          centralizado
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICOS.map((s) => (
            <CardServico key={s.id} servico={s} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/servicos"
            className="inline-flex items-center gap-2 text-sm font-bold text-marca hover:text-marca-escuro transition"
          >
            Ver o que está incluído em cada serviço
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Secao>

      <ComoFunciona />

      {/* Chamada do simulador + formulário: a dobra que converte. */}
      <section className="bg-marca text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs font-bold text-solar tracking-widest uppercase">
              Comece pelo número
            </span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Descubra em 30 segundos quanto a sua conta de luz pode cair.
            </h2>
            <div className="w-12 h-1 bg-emerald-500 rounded-full" />
            <p className="text-blue-100 leading-relaxed">
              O simulador usa exatamente a mesma fórmula de dimensionamento que os nossos
              consultores aplicam na proposta: a sua média de consumo, as horas de sol da região e
              as perdas reais do sistema. Sem número inflado para impressionar.
            </p>
            <Link
              to="/simulador"
              className="inline-flex items-center gap-2 bg-solar hover:bg-amber-300 text-marca font-extrabold px-6 py-4 rounded-xl shadow-lg transition-all"
            >
              Abrir o simulador
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <FormularioLead
            tom="escuro"
            titulo="Prefere falar com gente?"
            descricao="Deixe seu contato que um consultor retorna para agendar a visita técnica."
          />
        </div>
      </section>

      <PerguntasFrequentes perguntas={FAQ.slice(0, 4)} claro />

      <Secao>
        <Cartao className="text-center p-10 md:p-14" regua="from-amber-500 to-orange-400">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            A visita técnica é gratuita.
          </h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto leading-relaxed">
            Um consultor vai até o local, mede o telhado, confere o padrão de entrada e só então
            monta a proposta. Se não fizer sentido para você, a gente diz.
          </p>
          <Link
            to="/contato"
            className="mt-7 inline-flex items-center gap-2 bg-marca hover:bg-marca-escuro text-white font-extrabold px-6 py-4 rounded-xl shadow-md transition-all"
          >
            Agendar minha visita
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Cartao>
      </Secao>
    </>
  );
};
