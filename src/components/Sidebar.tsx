import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, FileCheck, DollarSign, Package, UserCheck, LogOut, ChevronRight, X, Calendar, BarChart3, History, HardHat, Globe, MessageCircle,
  Truck, Boxes, Sun, SlidersHorizontal, ChevronDown
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
  const location = useLocation();

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
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
        { to: '/sistema/whatsapp', label: 'WhatsApp', icon: MessageCircle, permissao: 'usarWhatsapp' as keyof UserPermissions },
      ]
    },
    {
      section: 'GESTÃO', items: [
        { to: '/sistema/financeiro', label: 'Financeiro', icon: DollarSign },
        { to: '/sistema/relatorios', label: 'Relatórios', icon: BarChart3 },
        { to: '/sistema/fornecedores', label: 'Fornecedores', icon: Truck },
        { to: '/sistema/usuarios', label: 'Usuários', icon: UserCheck },
        { to: '/sistema/auditoria', label: 'Auditoria', icon: History },
        { to: '/sistema/site', label: 'Configuração do Site', icon: Globe, permissao: 'gerenciarSite' as keyof UserPermissions },
      ]
    }
  ];

  const parametrosItems = [
    { to: '/sistema/parametros/produtos', label: 'Produtos', icon: Package },
    { to: '/sistema/parametros/kits', label: 'Kits', icon: Boxes },
    { to: '/sistema/parametros/placas', label: 'Placas', icon: Sun },
  ];

  /** Item sem `permissao` vale para todo mundo. */
  const podeVer = (item: { permissao?: keyof UserPermissions }) =>
    !item.permissao || currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.[item.permissao];

  const isParametrosActive = location.pathname.startsWith('/sistema/parametros');

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/*
        Sidebar com cabeçalho e rodapé fixos. A área central de navegação
        possui rolagem independente (flex-1 min-h-0 overflow-y-auto), mantendo
        o perfil do usuário e botão de logout sempre visíveis.
      */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-80 max-w-[85vw] altura-viewport overflow-hidden bg-[#004276] text-white flex flex-col transition-transform duration-300 ease-in-out shrink-0 select-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header — fixo no topo */}
        <div className="p-4 px-5 flex items-center justify-between border-b border-blue-900/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoFull} alt="Solar Costa" className="h-9 w-auto object-contain shrink-0" />
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            aria-label="Fechar menu"
            className="md:hidden text-slate-300 hover:text-white p-1 rounded-lg hover:bg-blue-900/40 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections — rolagem independente na área central com folga inferior */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sidebar-scrollbar pt-4 pb-8 px-3 space-y-5">
          {navItems.map((group) => {
            const itensVisiveis = group.items.filter(podeVer);
            if (itensVisiveis.length === 0) return null;

            return (
              <div key={group.section}>
                <h3 className="text-[11px] font-bold text-blue-300/80 tracking-wider uppercase px-3 mb-1.5 whitespace-nowrap">
                  {group.section}
                </h3>
                <div className="space-y-1">
                  {itensVisiveis.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsOpenMobile(false)}
                        title={item.label}
                        className={({ isActive }) =>
                          `group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? 'bg-[#002e5c] text-white font-semibold border border-[#FFD100] shadow-sm'
                              : 'text-blue-100 hover:bg-blue-900/40 hover:text-white border border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  isActive ? 'text-[#FFD100]' : 'text-blue-200 group-hover:text-white'
                                }`}
                              />
                              <span className="truncate whitespace-nowrap">{item.label}</span>
                            </div>
                            {isActive && <ChevronRight className="w-4 h-4 text-[#FFD100] shrink-0 ml-2" />}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Seção Parâmetros (Accordion estilizado) */}
          <div>
            <h3 className="text-[11px] font-bold text-blue-300/80 tracking-wider uppercase px-3 mb-1.5 whitespace-nowrap">
              SISTEMA
            </h3>
            <details open={isParametrosActive || true} className="group space-y-1">
              <summary className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer list-none transition-all select-none [&::-webkit-details-marker]:hidden ${
                isParametrosActive
                  ? 'bg-blue-900/30 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-900/40 hover:text-white'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <SlidersHorizontal className={`w-4 h-4 shrink-0 ${isParametrosActive ? 'text-[#FFD100]' : 'text-blue-200'}`} />
                  <span className="truncate whitespace-nowrap">Parâmetros</span>
                </div>
                <ChevronDown className="w-4 h-4 text-blue-300 shrink-0 transition-transform duration-200 group-open:rotate-180 ml-2" />
              </summary>
              <div className="pl-3 ml-2.5 border-l border-blue-800/60 space-y-1 pt-1">
                {parametrosItems.map((item) => {
                  const SubIcon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsOpenMobile(false)}
                      title={item.label}
                      className={({ isActive }) =>
                        `group w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-[#002e5c] text-white font-semibold border border-[#FFD100] shadow-sm'
                            : 'text-blue-100 hover:bg-blue-900/40 hover:text-white border border-transparent'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SubIcon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-[#FFD100]' : 'text-blue-200 group-hover:text-white'
                              }`}
                            />
                            <span className="truncate whitespace-nowrap">{item.label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#FFD100] shrink-0 ml-2" />}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </details>
          </div>
        </div>

        {/* Footer User Profile — fixo no rodapé */}
        <div className="area-segura-inferior p-3 px-4 bg-blue-950/95 border-t border-blue-900/80 flex items-center justify-between shrink-0 gap-2 z-10 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#FFD100] text-[#004276] font-extrabold text-xs flex items-center justify-center shrink-0 shadow">
              {getInitials(currentUser.nome)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate whitespace-nowrap" title={currentUser.nome}>
                {currentUser.nome}
              </p>
              <p className="text-[10px] text-blue-300 truncate whitespace-nowrap" title={currentUser.cargo || currentUser.perfil}>
                {currentUser.cargo || currentUser.perfil}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sair do sistema"
            aria-label="Sair do sistema"
            className="p-1.5 text-blue-300 hover:text-rose-400 rounded-lg hover:bg-blue-900/50 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
