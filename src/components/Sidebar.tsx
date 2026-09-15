import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, FileCheck, DollarSign, Package, UserCheck, LogOut, ChevronRight, X, Calendar, BarChart3, History, HardHat, Globe
} from 'lucide-react';
import { User, UserPermissions } from '../types';
import logoFull from '../assets/logo-full.png';

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onLogout,
  isOpenMobile = false,
  setIsOpenMobile = (_open: boolean) => { },
}) => {
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navItems = [
    {
      section: 'VISÃO GERAL', items: [
        { to: '/sistema/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/sistema/agenda', label: 'Agenda & Visitas', icon: Calendar },
      ]
    },
    {
      section: 'OPERAÇÃO', items: [
        { to: '/sistema/leads', label: 'Leads', icon: Users },
        { to: '/sistema/propostas', label: 'Propostas de orçamento', icon: FileText },
        { to: '/sistema/contratos', label: 'Contratos', icon: FileCheck },
        { to: '/sistema/obras', label: 'Obras & Instalação', icon: HardHat },
      ]
    },
    {
      section: 'GESTÃO', items: [
        { to: '/sistema/financeiro', label: 'Financeiro', icon: DollarSign },
        { to: '/sistema/relatorios', label: 'Relatórios', icon: BarChart3 },
        { to: '/sistema/fornecedores', label: 'Fornecedores e produtos', icon: Package },
        { to: '/sistema/usuarios', label: 'Usuários', icon: UserCheck },
        { to: '/sistema/auditoria', label: 'Auditoria', icon: History },
        // Único item filtrado por permissão hoje. O restante do menu continua
        // visível para todos — estender o gating aos demais é decisão à parte,
        // e fazê-la de carona aqui esconderia telas sem ninguém ter pedido.
        { to: '/sistema/site', label: 'Configuração do Site', icon: Globe, permissao: 'gerenciarSite' as keyof UserPermissions },
      ]
    }
  ];

  /** Item sem `permissao` vale para todo mundo. */
  const podeVer = (item: { permissao?: keyof UserPermissions }) =>
    !item.permissao || currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.[item.permissao];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/*
        A GAVETA INTEIRA ROLA — logo, itens e rodapé numa coluna só.

        Antes, a navegação era `flex-1 overflow-y-auto` com o rodapé preso por
        `shrink-0`. Somando 12 itens (~656px) + logo (~80px) + rodapé (~56px)
        dá ~790px, contra ~650px visíveis num iPhone com as barras do Safari.
        Os últimos itens — "Auditoria" e "Configuração do Site" — caíam dentro
        de uma rolagem ANINHADA, que no iOS não mostra barra e não dá nenhuma
        pista de existir. Na prática, "Configuração do Site" estava inacessível.

        Com a rolagem na própria <aside>, o gesto é o óbvio: arrastar a gaveta.
        E continua correto quando o 13º item for adicionado ao menu — que é o
        motivo de não ter simplesmente compactado o espaçamento.
      */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 altura-viewport overflow-y-auto overscroll-contain bg-[#004276] text-white flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-blue-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoFull} alt="Solar Costa" className="h-10 w-auto" />
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden text-slate-300 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections — `flex-1` empurra o rodapé para o fim quando
            sobra espaço; a rolagem agora é da <aside>, não daqui. */}
        <div className="flex-1 py-4 px-3 space-y-6">
          {navItems.map((group) => (
            <div key={group.section}>
              <h3 className="text-[11px] font-bold text-blue-300 tracking-wider uppercase px-3 mb-2">
                {group.section}
              </h3>
              <div className="space-y-1">
                {group.items.filter(podeVer).map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsOpenMobile(false)}
                      className={({ isActive }) => `w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                          ? 'bg-[#002e5c] text-white font-semibold border border-[#FFD100] shadow-sm'
                          : 'text-blue-100 hover:bg-blue-900/40 hover:text-white border border-transparent'
                        }`}
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFD100]' : 'text-blue-200'}`} />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-4 h-4 text-[#FFD100]" />}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer User Profile */}
        <div className="area-segura-inferior p-3 bg-blue-950/50 border-t border-blue-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#FFD100] text-[#004276] font-extrabold text-xs flex items-center justify-center shrink-0 shadow">
              {getInitials(currentUser.nome)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser.nome}</p>
              <p className="text-[10px] text-blue-300 truncate">{currentUser.perfil}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sair do sistema"
            className="p-1.5 text-blue-300 hover:text-rose-400 rounded-lg hover:bg-blue-900/50 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
