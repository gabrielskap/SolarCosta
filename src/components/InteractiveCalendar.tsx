import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  User, 
  Building, 
  AlertCircle,
  ExternalLink,
  Trash2,
  X,
  FileText,
  Zap,
  Check
} from 'lucide-react';
import { Agendamento, Lead, User as UserType, TipoAgendamento, StatusAgendamento } from '../types';

interface InteractiveCalendarProps {
  agendamentos: Agendamento[];
  leads: Lead[];
  users: UserType[];
  onSaveAgendamento: (agendamento: Agendamento) => void;
  onDeleteAgendamento: (id: string) => void;
  onSelectLead?: (leadId: string) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const InteractiveCalendar: React.FC<InteractiveCalendarProps> = ({
  agendamentos = [],
  leads = [],
  users = [],
  onSaveAgendamento,
  onDeleteAgendamento,
  onSelectLead,
  showToast,
}) => {
  // Calendar View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 6, 31)); // July 31, 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-07-31');
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'lista'>('mes');
  
  // Filters State
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterResponsavel, setFilterResponsavel] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<Agendamento | null>(null);

  // New Agendamento Form State
  const [formLeadId, setFormLeadId] = useState<string>(leads[0]?.id || '');
  const [formTipo, setFormTipo] = useState<TipoAgendamento>('visita_tecnica');
  const [formTitulo, setFormTitulo] = useState<string>('');
  const [formData, setFormData] = useState<string>('2026-07-31');
  const [formHorarioInicio, setFormHorarioInicio] = useState<string>('09:00');
  const [formHorarioFim, setFormHorarioFim] = useState<string>('10:30');
  const [formEndereco, setFormEndereco] = useState<string>('');
  const [formCidade, setFormCidade] = useState<string>('');
  const [formResponsavel, setFormResponsavel] = useState<string>('Thiago Gonçalves Leal');
  const [formObservacoes, setFormObservacoes] = useState<string>('');

  // Auto populate form when lead changes
  const handleLeadSelectChange = (leadId: string) => {
    setFormLeadId(leadId);
    const selectedLead = leads.find(l => l.id === leadId);
    if (selectedLead) {
      setFormEndereco(selectedLead.endereco || '');
      setFormCidade(selectedLead.cidade || '');
      if (selectedLead.responsavel) {
        setFormResponsavel(selectedLead.responsavel);
      }
      if (!formTitulo || formTitulo.startsWith('Visita') || formTitulo.startsWith('Reunião')) {
        const prefix = formTipo === 'visita_tecnica' ? 'Visita Técnica' : formTipo === 'reuniao' ? 'Reunião com Cliente' : 'Vistoria Pré-Instalação';
        setFormTitulo(`${prefix} - ${selectedLead.nome}`);
      }
    }
  };

  // Open modal pre-filled for a date
  const handleOpenNewModalForDate = (dateStr: string) => {
    setFormData(dateStr);
    const lead = leads[0];
    if (lead) {
      handleLeadSelectChange(lead.id);
    }
    setIsNewModalOpen(true);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date(2026, 6, 31);
    setCurrentDate(today);
    setSelectedDateStr('2026-07-31');
  };

  // Month info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pMonth = month === 0 ? 11 : month - 1;
      const pYear = month === 0 ? year - 1 : year;
      const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      days.push({
        dayNumber: pDay,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === '2026-07-31';
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday,
      });
    }

    // Next month padding days to complete grid (42 cells: 6 rows of 7)
    const remainingCells = 42 - days.length;
    for (let n = 1; n <= remainingCells; n++) {
      const nMonth = month === 11 ? 0 : month + 1;
      const nYear = month === 11 ? year + 1 : year;
      const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      days.push({
        dayNumber: n,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  // Filtered Agendamentos
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(ag => {
      // Type filter
      if (filterTipo !== 'todos' && ag.tipo !== filterTipo) return false;

      // Responsavel filter
      if (filterResponsavel !== 'todos' && ag.responsavel !== filterResponsavel) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesLead = ag.leadNome.toLowerCase().includes(query);
        const matchesTitle = ag.titulo.toLowerCase().includes(query);
        const matchesCity = ag.cidade.toLowerCase().includes(query);
        const matchesResp = ag.responsavel.toLowerCase().includes(query);
        if (!matchesLead && !matchesTitle && !matchesCity && !matchesResp) return false;
      }

      return true;
    });
  }, [agendamentos, filterTipo, filterResponsavel, searchQuery]);

  // Map agendamentos by date
  const agendamentosByDate = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    filteredAgendamentos.forEach(ag => {
      if (!map[ag.data]) {
        map[ag.data] = [];
      }
      map[ag.data].push(ag);
    });
    return map;
  }, [filteredAgendamentos]);

  // Handle Form Submit
  const handleSubmitNewAgendamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      showToast('Campos incompletos', 'error', 'Informe o título ou motivo do agendamento.');
      return;
    }

    const selectedLead = leads.find(l => l.id === formLeadId);

    const newAgendamento: Agendamento = {
      id: `ag-${Date.now()}`,
      leadId: formLeadId,
      leadNome: selectedLead ? selectedLead.nome : 'Lead',
      tipo: formTipo,
      titulo: formTitulo,
      data: formData,
      horarioInicio: formHorarioInicio,
      horarioFim: formHorarioFim,
      endereco: formEndereco,
      cidade: formCidade,
      responsavel: formResponsavel,
      status: 'agendado',
      observacoes: formObservacoes,
      dataCriacao: new Date().toISOString().slice(0, 10),
    };

    onSaveAgendamento(newAgendamento);
    showToast('Agendamento salvo', 'success', `${formTipo === 'visita_tecnica' ? 'Visita Técnica' : 'Reunião'} agendada para ${formData}.`);
    setIsNewModalOpen(false);

    // Reset Form
    setFormTitulo('');
    setFormObservacoes('');
  };

  // Quick Status change
  const handleToggleStatus = (ag: Agendamento, newStatus: StatusAgendamento) => {
    const updated = { ...ag, status: newStatus };
    onSaveAgendamento(updated);
    if (selectedEventDetails?.id === ag.id) {
      setSelectedEventDetails(updated);
    }
    const statusMsg = newStatus === 'realizado' ? 'marcado como REALIZADO' : newStatus === 'cancelado' ? 'CANCELADO' : 'reagendado';
    showToast('Status atualizado', 'success', `Agendamento ${statusMsg}.`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este agendamento?')) {
      onDeleteAgendamento(id);
      setSelectedEventDetails(null);
      showToast('Agendamento removido', 'info', 'O compromisso foi excluído da agenda.');
    }
  };

  // Helper for badges
  const getTipoBadge = (tipo: TipoAgendamento) => {
    switch (tipo) {
      case 'visita_tecnica':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Zap className="w-3 h-3 text-indigo-600" />
            Visita Técnica
          </span>
        );
      case 'reuniao':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Users className="w-3 h-3 text-sky-600" />
            Reunião
          </span>
        );
      case 'vistoria':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Vistoria
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Today indicator */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#004276]/10 text-[#004276] flex items-center justify-center shrink-0">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Agenda de Visitas & Reuniões</h2>
                <span className="bg-[#FFD100]/20 text-[#004276] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#FFD100]/40">
                  Solar Costa
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Agende vistorias técnicas, dimensionamentos e reuniões comerciais vinculadas aos leads.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => handleOpenNewModalForDate(selectedDateStr)}
            className="bg-[#004276] hover:bg-[#003159] text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FFD100]" />
            <span>Novo Agendamento</span>
          </button>
        </div>

        {/* Toolbar: Navigation, Filters and Search */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-slate-800 px-3 min-w-36 text-center">
                {monthNames[month]} {year}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Hoje
            </button>

            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl ml-2">
              <button
                onClick={() => setViewMode('mes')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'mes' ? 'bg-[#004276] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'lista' ? 'bg-[#004276] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Próximos
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar lead ou local..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#004276] focus:border-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#004276]"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="visita_tecnica">Visitas Técnicas</option>
              <option value="reuniao">Reuniões Comercial</option>
              <option value="vistoria">Vistorias</option>
            </select>

            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#004276]"
            >
              <option value="todos">Todos os Responsáveis</option>
              {users.map(u => (
                <option key={u.id} value={u.nome}>{u.nome.split(' ')[0]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main View Grid or List */}
      {viewMode === 'mes' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Calendar Grid (3 columns on lg) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200/80">
            {/* Days of week header */}
            <div className="grid grid-cols-7 mb-2 text-center text-[11px] font-black uppercase tracking-wider text-slate-400">
              <span className="py-2 text-rose-500">Dom</span>
              <span className="py-2">Seg</span>
              <span className="py-2">Ter</span>
              <span className="py-2">Qua</span>
              <span className="py-2">Qui</span>
              <span className="py-2">Sex</span>
              <span className="py-2 text-rose-500">Sáb</span>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
              {calendarDays.map((cell, idx) => {
                const dayAgendamentos = agendamentosByDate[cell.dateStr] || [];
                const isSelected = selectedDateStr === cell.dateStr;

                return (
                  <div
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={`min-h-24 md:min-h-28 p-1.5 md:p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                      !cell.isCurrentMonth 
                        ? 'bg-slate-50/60 border-slate-100 text-slate-300' 
                        : isSelected
                        ? 'bg-blue-50/50 border-[#004276] ring-2 ring-[#004276]/20'
                        : cell.isToday
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-white border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Top Row: Day Number & Add button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-[#FFD100] text-[#004276] font-extrabold shadow-xs'
                            : isSelected
                            ? 'bg-[#004276] text-white'
                            : cell.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {cell.isCurrentMonth && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateStr(cell.dateStr);
                            handleOpenNewModalForDate(cell.dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#004276] hover:text-white text-slate-400 rounded-md transition text-[10px]"
                          title="Agendar neste dia"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Events inside Cell */}
                    <div className="space-y-1 my-1 overflow-hidden flex-1">
                      {dayAgendamentos.slice(0, 3).map((ag) => {
                        const isDone = ag.status === 'realizado';
                        const isCanceled = ag.status === 'cancelado';

                        return (
                          <div
                            key={ag.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventDetails(ag);
                            }}
                            className={`px-1.5 py-1 rounded-md text-[10px] font-bold border truncate transition hover:scale-[1.02] ${
                              isCanceled
                                ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                                : isDone
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 opacity-80'
                                : ag.tipo === 'visita_tecnica'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100'
                                : ag.tipo === 'reuniao'
                                ? 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            }`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              <span className="font-mono text-[9px] text-slate-500 shrink-0">
                                {ag.horarioInicio}
                              </span>
                              <span className="truncate">{ag.leadNome}</span>
                            </div>
                          </div>
                        );
                      })}

                      {dayAgendamentos.length > 3 && (
                        <div className="text-[9px] font-extrabold text-slate-500 text-center">
                          +{dayAgendamentos.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Sidebar (1 column on lg) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Agenda do Dia
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedDateStr.split('-').reverse().join('/')}
                </p>
              </div>

              <button
                onClick={() => handleOpenNewModalForDate(selectedDateStr)}
                className="p-1.5 bg-[#004276]/10 text-[#004276] hover:bg-[#004276] hover:text-white rounded-lg text-xs transition"
                title="Novo para este dia"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of events for selected day */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1">
              {(agendamentosByDate[selectedDateStr] || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
                  <p className="text-xs font-semibold">Nenhum compromisso para este dia.</p>
                  <button
                    onClick={() => handleOpenNewModalForDate(selectedDateStr)}
                    className="text-xs font-bold text-[#004276] hover:underline inline-block mt-1"
                  >
                    + Agendar Visita ou Reunião
                  </button>
                </div>
              ) : (
                (agendamentosByDate[selectedDateStr] || []).map((ag) => (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedEventDetails(ag)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer hover:shadow-md ${
                      ag.status === 'realizado'
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : ag.status === 'cancelado'
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : ag.tipo === 'visita_tecnica'
                        ? 'bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300'
                        : 'bg-sky-50/40 border-sky-200/80 hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      {getTipoBadge(ag.tipo)}
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {ag.horarioInicio} - {ag.horarioFim}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-xs leading-tight mb-1">
                      {ag.titulo}
                    </h4>

                    <div className="space-y-1 text-[11px] text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800">{ag.leadNome}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{ag.cidade} - {ag.endereco}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-semibold">
                        Resp: {ag.responsavel.split(' ')[0]}
                      </span>

                      <div className="flex items-center gap-1">
                        {ag.status !== 'realizado' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(ag, 'realizado');
                            }}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Upcoming List View */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-black text-slate-900 text-base">Próximos Compromissos Agendados</h3>
            <span className="text-xs font-bold text-slate-500">
              Total: {filteredAgendamentos.length} agendamentos
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredAgendamentos.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CalendarIcon className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
                <p className="font-semibold text-sm">Nenhum compromisso encontrado.</p>
              </div>
            ) : (
              filteredAgendamentos.map((ag) => (
                <div
                  key={ag.id}
                  onClick={() => setSelectedEventDetails(ag)}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 px-3 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#004276] flex flex-col items-center justify-center font-extrabold shrink-0 border border-slate-200">
                      <span className="text-xs text-slate-400 uppercase leading-none font-bold">
                        {ag.data.split('-')[1]}
                      </span>
                      <span className="text-base text-[#004276] leading-none mt-0.5">
                        {ag.data.split('-')[2]}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTipoBadge(ag.tipo)}
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {ag.horarioInicio} - {ag.horarioFim}
                        </span>
                        {ag.status === 'realizado' && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Realizado
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{ag.titulo}</h4>

                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        <span className="font-semibold text-slate-800">Lead: {ag.leadNome}</span>
                        <span>{ag.cidade} - {ag.endereco}</span>
                        <span className="text-slate-400">| Resp: {ag.responsavel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {ag.status !== 'realizado' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(ag, 'realizado');
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Concluir</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventDetails(ag);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Agendar Novo Compromisso */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-[#004276] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#FFD100]" />
                <h3 className="font-black text-base">Agendar Visita ou Reunião</h3>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitNewAgendamento} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* Tipo de Agendamento */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1.5">
                  Tipo de Compromisso *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('visita_tecnica');
                      const l = leads.find(item => item.id === formLeadId);
                      if (l) setFormTitulo(`Visita Técnica - ${l.nome}`);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 ${
                      formTipo === 'visita_tecnica'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span>Visita Técnica</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('reuniao');
                      const l = leads.find(item => item.id === formLeadId);
                      if (l) setFormTitulo(`Reunião com Cliente - ${l.nome}`);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 ${
                      formTipo === 'reuniao'
                        ? 'bg-sky-50 border-sky-600 text-sky-900 ring-2 ring-sky-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>Reunião</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('vistoria');
                      const l = leads.find(item => item.id === formLeadId);
                      if (l) setFormTitulo(`Vistoria Pré-Instalação - ${l.nome}`);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 ${
                      formTipo === 'vistoria'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Vistoria</span>
                  </button>
                </div>
              </div>

              {/* Lead Selector */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Lead Vinculado *
                </label>
                <select
                  value={formLeadId}
                  onChange={(e) => handleLeadSelectChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#004276]"
                >
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>
                      {lead.nome} - {lead.cidade} ({lead.etapa})
                    </option>
                  ))}
                </select>
              </div>

              {/* Título / Assunto */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Título / Assunto *
                </label>
                <input
                  type="text"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ex: Vistoria Técnica e Análise do Telhado"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#004276]"
                  required
                />
              </div>

              {/* Data e Horários */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#004276]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Início *
                  </label>
                  <input
                    type="time"
                    value={formHorarioInicio}
                    onChange={(e) => setFormHorarioInicio(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#004276]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Término *
                  </label>
                  <input
                    type="time"
                    value={formHorarioFim}
                    onChange={(e) => setFormHorarioFim(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#004276]"
                    required
                  />
                </div>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Responsável Técnico / Comercial *
                </label>
                <select
                  value={formResponsavel}
                  onChange={(e) => setFormResponsavel(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#004276]"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.nome}>{u.nome} ({u.cargo || u.perfil})</option>
                  ))}
                </select>
              </div>

              {/* Endereço e Cidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formCidade}
                    onChange={(e) => setFormCidade(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#004276]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Endereço / Local
                  </label>
                  <input
                    type="text"
                    value={formEndereco}
                    onChange={(e) => setFormEndereco(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#004276]"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Observações / Pauta
                </label>
                <textarea
                  rows={2}
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  placeholder="Itens a verificar no telhado, fiação elétricas, padrão CEMIG ou pauta da reunião..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#004276]"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white rounded-xl font-bold transition shadow-md"
                >
                  Confirmar Agendamento
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes do Compromisso */}
      {selectedEventDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTipoBadge(selectedEventDetails.tipo)}
              </div>
              <button
                onClick={() => setSelectedEventDetails(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base mb-1">
                  {selectedEventDetails.titulo}
                </h3>
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    {selectedEventDetails.data.split('-').reverse().join('/')} das {selectedEventDetails.horarioInicio} às {selectedEventDetails.horarioFim}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Lead Vinculado</span>
                  {onSelectLead && (
                    <button
                      onClick={() => {
                        const id = selectedEventDetails.leadId;
                        setSelectedEventDetails(null);
                        onSelectLead(id);
                      }}
                      className="text-[#004276] font-bold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Abrir Lead no CRM</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="font-extrabold text-slate-900 text-sm">
                  {selectedEventDetails.leadNome}
                </p>
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedEventDetails.cidade} - {selectedEventDetails.endereco}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Responsável</span>
                <p className="font-bold text-slate-800">{selectedEventDetails.responsavel}</p>
              </div>

              {selectedEventDetails.observacoes && (
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Observações e Pauta</span>
                  <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 font-medium leading-relaxed">
                    {selectedEventDetails.observacoes}
                  </p>
                </div>
              )}

              {/* Status Selector / Actions */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700">Status atual:</span>
                  <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                    selectedEventDetails.status === 'realizado'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedEventDetails.status === 'cancelado'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedEventDetails.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {selectedEventDetails.status !== 'realizado' && (
                    <button
                      onClick={() => handleToggleStatus(selectedEventDetails, 'realizado')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Marcar Realizado</span>
                    </button>
                  )}

                  {selectedEventDetails.status !== 'cancelado' && (
                    <button
                      onClick={() => handleToggleStatus(selectedEventDetails, 'cancelado')}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                    >
                      Cancelar
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(selectedEventDetails.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title="Excluir agendamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
