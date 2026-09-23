import React, { useState } from 'react';
import { Kanban, List } from 'lucide-react';
import { Lead, LeadStage, User as UserType } from '../../types';
import { LeadsKanbanView } from '../LeadsKanbanView';
import { LeadsListView } from './LeadsListView';

interface LeadsViewProps {
  leads: Lead[];
  users: UserType[];
  onSelectLead: (lead: Lead) => void;
  onUpdateLeadStage: (leadId: string, newStage: LeadStage) => void;
  onCreateLead: (newLead: Partial<Lead>) => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onDeleteLead: (id: string) => void;
  currentUser: UserType;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

/**
 * Casca de alternância Kanban/Lista para /sistema/leads. Os dois modos
 * compartilham os mesmos `leads` já carregados pelo App — trocar de modo não
 * dispara nenhuma chamada de API nova.
 */
export const LeadsView: React.FC<LeadsViewProps> = ({
  leads, users, onSelectLead, onUpdateLeadStage, onCreateLead, onUpdateLead, onDeleteLead, currentUser, showToast,
}) => {
  const [modo, setModo] = useState<'kanban' | 'lista'>('kanban');
  const pill = (ativo: boolean) =>
    `px-3.5 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
      ativo ? 'bg-[#004276] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setModo('kanban')} className={pill(modo === 'kanban')}>
          <Kanban className="w-3.5 h-3.5" /> Kanban
        </button>
        <button type="button" onClick={() => setModo('lista')} className={pill(modo === 'lista')}>
          <List className="w-3.5 h-3.5" /> Lista
        </button>
      </div>

      {modo === 'kanban' ? (
        <LeadsKanbanView
          leads={leads}
          users={users}
          onSelectLead={onSelectLead}
          onUpdateLeadStage={onUpdateLeadStage}
          onCreateLead={onCreateLead}
          currentUser={currentUser}
          showToast={showToast}
        />
      ) : (
        <LeadsListView
          leads={leads}
          users={users}
          currentUser={currentUser}
          onSelectLead={onSelectLead}
          onCreateLead={onCreateLead}
          onUpdateLead={onUpdateLead}
          onDeleteLead={onDeleteLead}
          showToast={showToast}
        />
      )}
    </div>
  );
};
