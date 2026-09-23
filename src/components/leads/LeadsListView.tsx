import React, { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Lead, LeadStage, User as UserType } from '../../types';
import { TabelaResponsiva, type ColunaTabela } from '../comuns/TabelaResponsiva';
import { LeadFormModal } from './LeadFormModal';
import { STAGES } from '../LeadsKanbanView';

interface LeadsListViewProps {
  leads: Lead[];
  users: UserType[];
  currentUser: UserType;
  onSelectLead: (lead: Lead) => void;
  onCreateLead: (newLead: Partial<Lead>) => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onDeleteLead: (id: string) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const LeadsListView: React.FC<LeadsListViewProps> = ({
  leads, users, currentUser, onSelectLead, onCreateLead, onUpdateLead, onDeleteLead, showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<'todas' | LeadStage>('todas');
  /** null = fechado; lead ausente = criando; lead presente = editando. */
  const [editando, setEditando] = useState<{ lead?: Lead } | null>(null);

  const filteredLeads = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return leads.filter((l) => {
      if (etapaFilter !== 'todas' && l.etapa !== etapaFilter) return false;
      if (!termo) return true;
      const alvo = `${l.nome} ${l.numero} ${l.telefone} ${l.email} ${l.cidade} ${l.cpfCnpj}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [leads, searchTerm, etapaFilter]);

  const valorFiltrado = filteredLeads.reduce((acc, l) => acc + l.valor, 0);

  const handleDelete = (lead: Lead) => {
    if (!window.confirm(`Excluir o lead "${lead.nome}"? Ele deixa de aparecer no Kanban e na lista de leads.`)) return;
    onDeleteLead(lead.id);
    showToast('Lead excluído', 'info', `${lead.nome} removido.`);
  };

  const colunas: ColunaTabela<Lead>[] = [
    { chave: 'numero', titulo: 'Nº', celula: (l) => <span className="font-bold text-[#004276]">{l.numero}</span> },
    {
      chave: 'nome',
      titulo: 'Nome',
      celula: (l) => (
        <button type="button" onClick={() => onSelectLead(l)} className="font-semibold text-slate-900 hover:text-[#004276] hover:underline text-left">
          {l.nome}
        </button>
      ),
    },
    { chave: 'telefone', titulo: 'Telefone', prioridade: 'secundaria', celula: (l) => <span className="text-slate-600">{l.telefone || '—'}</span> },
    { chave: 'cidade', titulo: 'Cidade', prioridade: 'secundaria', celula: (l) => <span className="text-slate-600">{l.cidade || '—'}</span> },
    {
      chave: 'etapa',
      titulo: 'Etapa',
      celula: (l) => <span className="bg-blue-50 text-[#004276] font-bold px-2.5 py-0.5 rounded-full text-[10px]">{l.etapa}</span>,
    },
    { chave: 'responsavel', titulo: 'Responsável', prioridade: 'secundaria', celula: (l) => <span className="text-slate-600">{l.responsavel || '—'}</span> },
    {
      chave: 'valor',
      titulo: 'Valor estimado',
      alinhamento: 'direita',
      celula: (l) => <span className="font-bold text-slate-900">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>,
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhamento: 'direita',
      celula: (l) => (
        <div className="inline-flex items-center gap-3">
          <button type="button" onClick={() => setEditando({ lead: l })} className="text-blue-600 hover:underline inline-flex items-center gap-1 font-bold">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button type="button" onClick={() => handleDelete(l)} className="text-rose-600 hover:underline inline-flex items-center gap-1 font-bold">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Leads</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {filteredLeads.length} de {leads.length} leads · R$ {valorFiltrado.toLocaleString('pt-BR')} em pipeline
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, nº, telefone, e-mail, cidade ou CPF/CNPJ"
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
            />
          </div>

          <select
            value={etapaFilter}
            onChange={(e) => setEtapaFilter(e.target.value as 'todas' | LeadStage)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#004276]"
          >
            <option value="todas">Etapa: todas</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <button
            onClick={() => setEditando({})}
            className="bg-[#004276] hover:bg-[#003159] text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-md shrink-0 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo lead</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <TabelaResponsiva
          colunas={colunas}
          dados={filteredLeads}
          chaveDe={(l) => l.id}
          vazio={leads.length === 0 ? 'Nenhum lead cadastrado ainda.' : 'Nenhum lead encontrado com os filtros atuais.'}
        />
      </div>

      {editando && (
        <LeadFormModal
          key={editando.lead?.id ?? 'novo'}
          lead={editando.lead}
          users={users}
          currentUser={currentUser}
          onClose={() => setEditando(null)}
          onCreateLead={onCreateLead}
          onUpdateLead={onUpdateLead}
          showToast={showToast}
        />
      )}
    </div>
  );
};
