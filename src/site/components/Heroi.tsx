// Primeira dobra da home.
//
// Reaproveita a composição do LoginView: painel #004276, logotipo grande,
// faixa amarela "ENERGIA SOLAR", régua verde. Quem já entrou no sistema
// reconhece a marca na hora; quem nunca entrou vê a mesma marca depois.
//
// O logotipo abre a página de propósito — antes do título. Marca visível
// junto de CNPJ e CREA é o que separa uma empresa de um anúncio.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, ShieldCheck, MapPin } from 'lucide-react';
import logoFull from '../../assets/logo-full.png';
import logoIcon from '../../assets/logo-icon.png';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO } from '../../services/publico';

export const Heroi: React.FC = () => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;
  const cidade = empresa?.cidade || CONTATO_PADRAO.cidade;
  const uf = empresa?.uf || CONTATO_PADRAO.uf;

  return (
    <section className="relative bg-marca text-white overflow-hidden">
      {/* Malha de luz ao fundo: puro CSS, sem imagem para baixar. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(255,209,0,.18), transparent 45%), radial-gradient(circle at 85% 10%, rgba(16,185,129,.18), transparent 40%)',
        }}
      />

      {/* Símbolo da marca em marca d'água, atrás do painel da direita. */}
      <img
        src={logoIcon}
        alt=""
        aria-hidden="true"
        className="hidden lg:block absolute right-[-6rem] top-1/2 -translate-y-1/2 h-[120%] w-auto opacity-[0.05] pointer-events-none select-none"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          {/* ---------------------------------------------------- marca -- */}
          <div>
            <img
              src={logoFull}
              alt="Solar Costa Energia Solar"
              className="h-16 md:h-24 w-auto"
              width={1400}
              height={630}
            />
            <p className="text-sm md:text-base font-bold text-solar tracking-[0.25em] uppercase mt-3">
              Energia Solar
            </p>
          </div>

          <div className="w-16 h-1 bg-emerald-500 rounded-full" />

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            A energia da sua casa
            <br />
            <span className="text-solar">passa a ser sua.</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-2xl">
            Projeto, instalação e homologação de sistemas fotovoltaicos com engenharia
            responsável. Você deixa de alugar energia da concessionária e passa a gerar a sua —
            com equipamentos, prazos e garantias por escrito.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              to="/simulador"
              className="inline-flex items-center justify-center gap-2 bg-solar hover:bg-amber-300 text-marca font-extrabold px-6 py-4 rounded-xl shadow-lg transition-all"
            >
              <Calculator className="w-5 h-5" />
              Simular minha economia
            </Link>
            <Link
              to="/contato"
              className="inline-flex items-center justify-center gap-2 border border-blue-700 hover:border-solar hover:text-solar text-white font-bold px-6 py-4 rounded-xl transition-all"
            >
              Falar com um consultor
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Faixa de confiança: onde atendemos + quem responde tecnicamente. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs font-mono text-blue-200/80">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-solar shrink-0" />
              {cidade}/{uf} e região metropolitana
            </span>
            {(empresa?.crea || empresa?.responsavel_tecnico) && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Projeto com ART e CREA
                {empresa?.crea ? ` ${empresa.crea}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Painel de destaques: mesma linguagem dos cards de KPI do dashboard,
            só que invertida para o fundo escuro. */}
        <div className="lg:col-span-5">
          <div className="bg-blue-950/40 border border-blue-800 rounded-2xl p-6 md:p-7 space-y-5 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-blue-300 tracking-widest uppercase">
              Por que gerar a própria energia
            </span>

            {[
              {
                titulo: 'A conta de luz vira investimento',
                texto:
                  'O valor que hoje some todo mês passa a pagar um sistema que fica com você por mais de 25 anos.',
              },
              {
                titulo: 'Proteção contra o reajuste',
                texto:
                  'A tarifa sobe todo ano. Quem gera a própria energia sente muito menos cada bandeira vermelha.',
              },
              {
                titulo: 'Imóvel mais valorizado',
                texto:
                  'Sistema instalado e homologado é benfeitoria permanente, e pesa na hora de vender ou alugar.',
              },
            ].map((item) => (
              <div key={item.titulo} className="flex gap-3.5">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-solar shrink-0" />
                <div>
                  <p className="font-bold text-white text-sm">{item.titulo}</p>
                  <p className="text-sm text-blue-200/90 leading-relaxed mt-0.5">{item.texto}</p>
                </div>
              </div>
            ))}

            <Link
              to="/simulador"
              className="flex items-center justify-between gap-2 w-full bg-blue-900/60 hover:bg-blue-900 border border-blue-800 rounded-xl px-4 py-3.5 text-sm font-bold text-white transition"
            >
              Ver quanto eu economizaria
              <ArrowRight className="w-4 h-4 text-solar" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
