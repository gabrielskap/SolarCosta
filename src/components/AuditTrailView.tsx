import React, { useMemo, useState } from 'react';
import { History, Search, Download, Trash2, ShieldCheck } from 'lucide-react';
import { AuditEntry, AuditAction, AuditEntity, User } from '../types';

interface AuditTrailViewProps {
  audit: AuditEntry[];
  usuarios: User[];
  currentUser: User;
  onClear: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const ACTION_META: Record<AuditAction, { label: string; cls: string }> = {
  criar: { label: 'Criou', cls: 'bg-emerald-100 text-emerald-800' },
  editar: { label: 'Editou', cls: 'bg-blue-100 text-blue-800' },
  excluir: { label: 'Excluiu', cls: 'bg-rose-100 text-rose-800' },
  mudanca_etapa: { label: 'Mudou etapa', cls: 'bg-violet-100 text-violet-800' },
  baixa: { label: 'Deu baixa', cls: 'bg-teal-100 text-teal-800' },
  login: { label: 'Entrou', cls: 'bg-slate-100 text-slate-700' },
  logout: { label: 'Saiu', cls: 'bg-slate-100 text-slate-700' },
  exportar: { label: 'Exportou', cls: 'bg-amber-100 text-amber-800' },
};

const ENTITIES: AuditEntity[] = [
  'Lead', 'Proposta', 'Contrato', 'Boleto', 'Lançamento', 'Usuário', 'Fornecedor', 'Produto', 'Agendamento', 'Sessão',
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  audit,
  usuarios,
  currentUser,
  onClear,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [filterEntidade, setFilterEntidade] = useState<string>('todas');
  const [filterAcao, setFilterAcao] = useState<string>('todas');
  const [filterUsuario, setFilterUsuario] = useState<string>('todos');

  const isAdmin = (currentUser.cargo || currentUser.perfil) === 'Administrador';

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return audit.filter((e) => {
      if (filterEntidade !== 'todas' && e.entidade !== filterEntidade) return false;
      if (filterAcao !== 'todas' && e.acao !== filterAcao) return false;
      if (filterUsuario !== 'todos' && e.usuario !== filterUsuario) return false;
      if (term) {
        const hay = `${e.alvo} ${e.detalhes || ''} ${e.usuario} ${e.entidade}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [audit, search, filterEntidade, filterAcao, filterUsuario]);

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('Nada para exportar', 'info', 'Nenhum registro no filtro atual.');
      return;
    }
    const headers = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Alvo', 'Detalhes', 'ID da entidade'];
    const esc = (v: string | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((e) => [
      formatTimestamp(e.timestamp),
      e.usuario,
      ACTION_META[e.acao]?.label || e.acao,
      e.entidade,
      e.alvo,
      e.detalhes || '',
      e.entidadeId || '',
    ]);
    const csv = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_solar_costa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exportação concluída', 'success', `${filtered.length} registros de auditoria exportados.`);
  };

  const handleClear = () => {
    if (!isAdmin) {
      showToast('Permissão negada', 'error', 'Apenas administradores podem limpar a trilha.');
      return;
    }
    if (window.confirm('Limpar toda a trilha de auditoria? Esta ação não pode ser desfeita.')) {
      onClear();
      showToast('Trilha limpa', 'info', 'Todos os registros de auditoria foram removidos.');
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return (parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276] flex items-center gap-2">
            <History className="w-6 h-6" />
            Trilha de auditoria
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Registro de quem alterou o quê e quando · {audit.length} eventos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          {isAdmin && (
            <button
              onClick={handleClear}
              className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por alvo, detalhe ou usuário"
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
          />
        </div>

        <select
          value={filterEntidade}
          onChange={(e) => setFilterEntidade(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#004276]"
        >
          <option value="todas">Entidade: todas</option>
          {ENTITIES.map((en) => (
            <option key={en} value={en}>{en}</option>
          ))}
        </select>

        <select
          value={filterAcao}
          onChange={(e) => setFilterAcao(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#004276]"
        >
          <option value="todas">Ação: todas</option>
          {(Object.keys(ACTION_META) as AuditAction[]).map((a) => (
            <option key={a} value={a}>{ACTION_META[a].label}</option>
          ))}
        </select>

        <select
          value={filterUsuario}
          onChange={(e) => setFilterUsuario(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#004276]"
        >
          <option value="todos">Usuário: todos</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.nome}>{u.nome}</option>
          ))}
        </select>
      </div>

      {/* Lista de eventos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600 text-sm">Nenhum registro encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou realize ações no sistema.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((e) => {
              const meta = ACTION_META[e.acao] || { label: e.acao, cls: 'bg-slate-100 text-slate-700' };
              return (
                <div key={e.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/70 transition">
                  <div className="w-9 h-9 rounded-full bg-[#004276] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    {getInitials(e.usuario)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{e.usuario}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {e.entidade}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 font-medium mt-1 leading-snug">{e.alvo}</p>
                    {e.detalhes && <p className="text-xs text-slate-500 mt-0.5">{e.detalhes}</p>}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                    {formatTimestamp(e.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
