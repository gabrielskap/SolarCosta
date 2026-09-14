// Cabeçalho do site.
//
// Fundo #004276 de propósito: é a mesma barra escura do CRM (Sidebar.tsx) e
// o logotipo amarelo só tem contraste sobre ela. Quem já usa o sistema
// reconhece a marca antes de ler qualquer palavra.
//
// Os links vêm do menu `principal` (SolarCosta_SiteMenuItens) — o mesmo que o
// rodapé consome, acabando com a duplicação que existia entre os dois
// arquivos. O item marcado como `destaque` vira o botão amarelo.

import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, LogIn } from 'lucide-react';
import logoFull from '../assets/logo-full.png';
import { useMenu } from './contexto';
import type { ItemMenu } from './blocos/tipos';

/** Link externo sai do React Router; interno continua com NavLink. */
const ehExterno = (destino: string) => /^https?:\/\//i.test(destino);

export const SiteHeader: React.FC = () => {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const itens = useMenu('principal');

  const links = itens.filter((i) => !i.destaque);
  const destaque = itens.find((i) => i.destaque);

  // Trocar de página fecha o menu — senão ele fica por cima do conteúdo novo.
  useEffect(() => setAberto(false), [pathname]);

  const classe = (ativo: boolean, mobile: boolean) =>
    mobile
      ? `block px-3 py-2.5 rounded-lg text-sm font-semibold border ${
          ativo
            ? 'bg-blue-900/60 text-white border-solar'
            : 'text-blue-100 hover:bg-blue-900/40 border-transparent'
        }`
      : `px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border ${
          ativo
            ? 'bg-marca-profundo text-white border-solar'
            : 'text-blue-100 hover:bg-blue-900/40 hover:text-white border-transparent'
        }`;

  const item = (l: ItemMenu, mobile: boolean) =>
    ehExterno(l.destino) ? (
      <a
        key={l.id}
        href={l.destino}
        target={l.novaAba ? '_blank' : undefined}
        rel={l.novaAba ? 'noopener noreferrer' : undefined}
        className={classe(false, mobile)}
      >
        {l.rotulo}
      </a>
    ) : (
      <NavLink
        key={l.id}
        to={l.destino}
        end={l.destino === '/'}
        className={({ isActive }) => classe(isActive, mobile)}
      >
        {l.rotulo}
      </NavLink>
    );

  return (
    <header className="sticky top-0 z-50 bg-marca text-white border-b border-blue-900/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-18 md:h-20">
          <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="Solar Costa — início">
            <img src={logoFull} alt="Solar Costa Energia Solar" className="h-11 md:h-12 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Navegação principal">
            {links.map((l) => item(l, false))}
          </nav>

          <div className="flex items-center gap-2">
            {destaque && (
              <Link
                to={destaque.destino}
                className="hidden sm:inline-flex items-center gap-2 bg-solar hover:bg-amber-300 text-marca font-extrabold text-sm px-4 py-2.5 rounded-xl shadow-md transition-all"
              >
                {destaque.rotulo}
              </Link>
            )}

            {/* Fica chumbado: é acesso ao sistema, não conteúdo editorial.
                Sumir daqui por engano trancaria a equipe para fora. */}
            <Link
              to="/sistema"
              title="Área restrita a colaboradores"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-blue-100 border border-blue-800 hover:border-solar hover:text-solar transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sistema
            </Link>

            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-blue-900/60 text-white"
              aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={aberto}
            >
              {aberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {aberto && (
        <nav className="lg:hidden border-t border-blue-900/60 bg-marca-profundo px-4 py-3 space-y-1">
          {links.map((l) => item(l, true))}
          <Link
            to="/sistema"
            className="flex items-center gap-2 px-3 py-2.5 mt-2 rounded-lg text-sm font-bold text-solar border border-blue-800"
          >
            <LogIn className="w-4 h-4" />
            Acessar o sistema
          </Link>
        </nav>
      )}
    </header>
  );
};
