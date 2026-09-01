import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import logoIcon from '../../assets/logo-icon.png';
import { useSeo } from '../seo';

export const NaoEncontrado: React.FC = () => {
  useSeo({
    titulo: 'Página não encontrada',
    descricao: 'A página que você procurou não existe no site da Solar Costa.',
    naoIndexar: true,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 md:py-32 text-center">
      <div className="w-20 h-20 rounded-2xl bg-marca flex items-center justify-center mx-auto shadow-md">
        <img src={logoIcon} alt="Solar Costa" className="w-12 h-12" />
      </div>

      <p className="mt-8 font-mono text-xs tracking-widest uppercase text-slate-400">Erro 404</p>
      <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
        Esta página não existe
      </h1>
      <p className="mt-3 text-slate-600 leading-relaxed max-w-md mx-auto">
        O endereço pode ter mudado ou o link estar incompleto. Os caminhos abaixo levam ao que
        interessa.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-marca hover:bg-marca-escuro text-white font-extrabold px-6 py-3.5 rounded-xl shadow-md transition-all"
        >
          Ir para o início
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/simulador"
          className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-marca text-slate-700 hover:text-marca font-bold px-6 py-3.5 rounded-xl transition-all"
        >
          Simular economia
        </Link>
      </div>
    </div>
  );
};
