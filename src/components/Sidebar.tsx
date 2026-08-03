import React from 'react';
import {
  LayoutDashboard, Users, FileText, FileCheck, DollarSign, Package, UserCheck, LogOut, Sun, ChevronRight, Menu, X, Calendar, BarChart3, History, HardHat
} from 'lucide-react';
import { User } from '../types';

export type ActiveTab =
  | 'dashboard'
  | 'agenda'
  | 'leads'
  | 'detalhe_lead'
  | 'proposta'
  | 'contrato'
  | 'financeiro'
  | 'fornecedores'
  | 'usuarios'
  | string;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
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
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'agenda', label: 'Agenda & Visitas', icon: Calendar },
      ]
    },
    {
      section: 'OPERAÇÃO', items: [
        { id: 'leads', label: 'Leads', icon: Users },
        { id: 'proposta', label: 'Propostas de orçamento', icon: FileText },
        { id: 'contrato', label: 'Contratos', icon: FileCheck },
        { id: 'obras', label: 'Obras & Instalação', icon: HardHat },
      ]
    },
    {
      section: 'GESTÃO', items: [
        { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
        { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
        { id: 'fornecedores', label: 'Fornecedores e produtos', icon: Package },
        { id: 'usuarios', label: 'Usuários', icon: UserCheck },
        { id: 'auditoria', label: 'Auditoria', icon: History },
      ]
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 h-screen bg-[#004276] text-white flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-blue-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFD100] flex items-center justify-center shadow-md shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#004276] flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFD100]" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-wider text-white leading-tight">SOLAR COSTA</h1>
              <p className="text-[10px] font-bold text-[#FFD100] tracking-widest uppercase">ENERGIA SOLAR</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden text-slate-300 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navItems.map((group) => (
            <div key={group.section}>
              <h3 className="text-[11px] font-bold text-blue-300 tracking-wider uppercase px-3 mb-2">
                {group.section}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (item.id === 'leads' && (activeTab === 'detalhe_lead' || activeTab === 'lead-detail'));
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsOpenMobile(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                          ? 'bg-[#002e5c] text-white font-semibold border border-[#FFD100] shadow-sm'
                          : 'text-blue-100 hover:bg-blue-900/40 hover:text-white border border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFD100]' : 'text-blue-200'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-[#FFD100]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer User Profile */}
        <div className="p-3 bg-blue-950/50 border-t border-blue-900/60 flex items-center justify-between shrink-0">
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
