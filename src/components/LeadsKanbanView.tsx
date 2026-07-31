import React, { useState } from 'react';
import { Search, Plus, Filter, User, MapPin, Zap, ArrowRight, MoveRight, X, Download, FileSpreadsheet, Loader2, MapPinned } from 'lucide-react';
import { Lead, LeadStage, User as UserType } from '../types';
import {
  maskCPFCNPJ, maskPhone, maskCEP, onlyDigits, docLabel,
  isValidCPFCNPJ, isValidEmail, isValidPhoneBR,
} from '../utils/format';
import { parseBRDate, daysBetween, today } from '../utils/dates';
import { fetchAddressByCep, buildEnderecoLine, buildCidadeUf } from '../services/cep';
import { SEM_CONTATO_DIAS } from '../utils/notifications';

interface LeadsKanbanViewProps {
  leads?: Lead[];
  users?: UserType[];
  onSelectLead: (lead: Lead) => void;
  onUpdateLeadStage: (leadId: string, newStage: LeadStage) => void;
  onCreateLead: (newLead: Partial<Lead>) => void;
  currentUser: UserType;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const STAGES: LeadStage[] = [
  'Novo lead',
  'Contato feito',
  'Visita técnica',
  'Proposta enviada',
  'Negociação',
  'Fechado'
];

export const LeadsKanbanView: React.FC<LeadsKanbanViewProps> = ({
  leads = [],
  users = [],
  onSelectLead,
  onUpdateLeadStage,
  onCreateLead,
  currentUser,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'todos' | 'meus' | 'semContato'>('todos');
  const [responsavelFilter, setResponsavelFilter] = useState('todos');
  const [origemFilter, setOrigemFilter] = useState('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New lead form state
  const [novoNome, setNovoNome] = useState('');
  const [novoCpfCnpj, setNovoCpfCnpj] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaCidade, setNovaCidade] = useState('Belo Horizonte/MG');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoConsumo, setNovoConsumo] = useState(800);
  const [novaConcessionaria, setNovaConcessionaria] = useState('CEMIG');
  const [novoTelhado, setNovoTelhado] = useState('Colonial');
  const [novaOrigem, setNovaOrigem] = useState('Google Ads');
  const [novoResponsavel, setNovoResponsavel] = useState(currentUser.nome);
  const [novoCep, setNovoCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  // Drag and drop state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  // Integração CEP -> endereço (ViaCEP). Preenche endereço e cidade/UF.
  const handleCepLookup = async (cepValue: string) => {
    if (onlyDigits(cepValue).length !== 8) return;
    setCepLoading(true);
    const result = await fetchAddressByCep(cepValue);
    setCepLoading(false);
    if (!result.ok || !result.endereco) {
      showToast('CEP não encontrado', 'error', result.erro || 'Verifique o CEP informado.');
      return;
    }
    const linha = buildEnderecoLine(result.endereco);
    if (linha) setNovoEndereco(linha);
    const cidadeUf = buildCidadeUf(result.endereco);
    if (cidadeUf) setNovaCidade(cidadeUf);
    showToast('Endereço preenchido', 'success', `${linha || cidadeUf} (via ViaCEP).`);
  };

  // Dias desde a última interação registrada (para o filtro "sem contato").
  const diasSemContato = (l: Lead): number => {
    const datas = (l.historico || [])
      .map((h) => parseBRDate(h.data))
      .filter((d): d is Date => d !== null);
    const ultima = datas.length ? datas.reduce((m, d) => (d > m ? d : m)) : parseBRDate(l.dataCriacao);
    if (!ultima) return Infinity;
    return daysBetween(ultima, today());
  };

  // Filter leads
  const filteredLeads = leads.filter(l => {
    // search text
    const matchesSearch = 
      l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.telefone.includes(searchTerm);

    if (!matchesSearch) return false;

    // filter pill
    if (filterMode === 'meus' && l.responsavel !== currentUser.nome) return false;
    if (filterMode === 'semContato') {
      // Leads em aberto sem qualquer interação há 7+ dias.
      if (l.etapa === 'Fechado') return false;
      if (diasSemContato(l) < SEM_CONTATO_DIAS) return false;
    }

    // select filters
    if (responsavelFilter !== 'todos' && l.responsavel !== responsavelFilter) return false;
    if (origemFilter !== 'todas' && l.origem !== origemFilter) return false;

    return true;
  });

  // Calculate totals
  const totalLeads = filteredLeads.length;
  const pipelineValue = filteredLeads.reduce((acc, l) => acc + l.valor, 0);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (id) {
      onUpdateLeadStage(id, targetStage);
      setDraggedLeadId(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome) return;

    // Validação dos campos preenchidos (todos opcionais exceto o nome).
    if (novoCpfCnpj && !isValidCPFCNPJ(novoCpfCnpj)) {
      showToast('Documento inválido', 'error', `Verifique o ${docLabel(novoCpfCnpj)} informado.`);
      return;
    }
    if (novoEmail && !isValidEmail(novoEmail)) {
      showToast('E-mail inválido', 'error', 'Informe um e-mail no formato nome@dominio.com.');
      return;
    }
    if (novoTelefone && !isValidPhoneBR(novoTelefone)) {
      showToast('Telefone inválido', 'error', 'Informe DDD + número (10 ou 11 dígitos).');
      return;
    }

    // Estimated value: kWp calculation ~ consumo / 117 * 21000
    const estKwp = Number((novoConsumo / 117.3).toFixed(2));
    const estValor = Math.round(estKwp * 2639);

    onCreateLead({
      nome: novoNome,
      cpfCnpj: novoCpfCnpj || '000.000.000-00',
      telefone: novoTelefone || '(31) 99999-0000',
      email: novoEmail || `${novoNome.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      cidade: novaCidade,
      endereco: novoEndereco || `${novaCidade}`,
      cep: novoCep || undefined,
      consumoKwh: Number(novoConsumo),
      concessionaria: novaConcessionaria,
      telhado: novoTelhado,
      origem: novaOrigem,
      responsavel: novoResponsavel,
      etapa: 'Novo lead',
      valor: estValor > 10000 ? estValor : 18500,
    });

    setIsModalOpen(false);
    // Reset form
    setNovoNome('');
    setNovoCpfCnpj('');
    setNovoTelefone('');
    setNovoEmail('');
    setNovoCep('');
    setNovoEndereco('');
  };

  const handleExportCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      showToast('Nenhum lead para exportar', 'info', 'A lista atual está vazia.');
      return;
    }

    const headers = [
      'ID',
      'Número',
      'Nome do Cliente',
      'CPF/CNPJ',
      'RG/Inscrição',
      'Telefone',
      'E-mail',
      'Cidade',
      'Endereço',
      'CEP',
      'Consumo (kWh)',
      'Concessionária',
      'Telhado',
      'Origem',
      'Responsável',
      'Etapa',
      'Valor Estimado (R$)',
      'Data de Criação'
    ];

    const formatField = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredLeads.map(lead => [
      formatField(lead.id),
      formatField(lead.numero),
      formatField(lead.nome),
      formatField(lead.cpfCnpj),
      formatField(lead.rgInscricao || ''),
      formatField(lead.telefone),
      formatField(lead.email),
      formatField(lead.cidade),
      formatField(lead.endereco),
      formatField(lead.cep || ''),
      formatField(lead.consumoKwh),
      formatField(lead.concessionaria),
      formatField(lead.telhado),
      formatField(lead.origem),
      formatField(lead.responsavel),
      formatField(lead.etapa),
      formatField(lead.valor),
      formatField(lead.dataCriacao)
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\r\n');

    // UTF-8 BOM prefix for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `leads_solar_costa_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Exportação concluída', 'success', `${filteredLeads.length} leads exportados com sucesso.`);
  };

  // Indicadores de validação em tempo real (só sinalizam quando há conteúdo).
  const cpfInvalido = !!novoCpfCnpj && !isValidCPFCNPJ(novoCpfCnpj);
  const emailInvalido = !!novoEmail && !isValidEmail(novoEmail);
  const telefoneInvalido = !!novoTelefone && !isValidPhoneBR(novoTelefone);
  const fieldBase = 'w-full p-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none';
  const okBorder = 'border-slate-200 focus:border-[#004276]';
  const errBorder = 'border-rose-300 focus:border-rose-500 bg-rose-50/40';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Leads</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {totalLeads} leads ativos · R$ {pipelineValue.toLocaleString('pt-BR')} em pipeline · 8 propostas aguardando retorno
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, cidade ou telefone"
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
            />
          </div>

          <button
            onClick={handleExportCSV}
            title="Exportar lista de leads visíveis para CSV"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm shrink-0 transition"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#004276] hover:bg-[#003159] text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-md shrink-0 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo lead</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterMode('todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterMode === 'todos'
                ? 'bg-[#004276] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos os leads
          </button>
          <button
            onClick={() => setFilterMode('meus')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterMode === 'meus'
                ? 'bg-[#004276] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Meus leads
          </button>
          <button
            onClick={() => setFilterMode('semContato')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterMode === 'semContato'
                ? 'bg-[#004276] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Sem contato há 7 dias
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden md:block" />

          {/* Select Responsavel */}
          <select
            value={responsavelFilter}
            onChange={(e) => setResponsavelFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#004276]"
          >
            <option value="todos">Responsável: todos</option>
            {users.map(u => (
              <option key={u.id} value={u.nome}>{u.nome}</option>
            ))}
          </select>

          {/* Select Origem */}
          <select
            value={origemFilter}
            onChange={(e) => setOrigemFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#004276]"
          >
            <option value="todas">Origem: todas</option>
            <option value="Google Ads">Google Ads</option>
            <option value="Indicação">Indicação</option>
            <option value="Instagram">Instagram</option>
            <option value="Prospecção Ativa">Prospecção Ativa</option>
            <option value="Site Solar Costa">Site Solar Costa</option>
          </select>
        </div>

        <span className="text-[11px] text-slate-400 font-medium hidden lg:inline">
          Arraste o cartão para mudar a etapa
        </span>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-6">
        {STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter(l => l.etapa === stage);
          const stageTotal = stageLeads.reduce((acc, l) => acc + l.valor, 0);

          return (
            <div
              key={stage}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
              className="bg-slate-100/90 rounded-2xl p-3 flex flex-col gap-3 min-w-[240px] border border-slate-200/80"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <h3 className="font-bold text-xs text-slate-800 truncate">{stage}</h3>
                </div>
                <span className="bg-white text-slate-600 font-bold px-2 py-0.5 rounded-full text-[11px] border border-slate-200">
                  {stageLeads.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold text-left -mt-2">
                R$ {stageTotal.toLocaleString('pt-BR')}
              </p>

              {/* Cards List */}
              <div className="flex-1 space-y-3 min-h-[400px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onClick={() => onSelectLead(lead)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/90 hover:shadow-md hover:border-blue-300 transition cursor-pointer group relative"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#004276] leading-snug">
                        {lead.nome}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {lead.cidade}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {lead.consumoKwh} kWh/mês
                      </p>
                      <p className="text-base font-extrabold text-[#004276] pt-1">
                        R$ {lead.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-[#004276] font-bold text-[9px] flex items-center justify-center shrink-0">
                          {getInitials(lead.responsavel)}
                        </span>
                        <span className="truncate">{lead.responsavel.split(' ')[0]}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {lead.historico && lead.historico[0]?.data ? `há ${lead.historico[0].data.slice(0, 5)}` : 'recente'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Quick Add Button at Bottom of Column */}
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                  }}
                  className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-white text-slate-500 hover:text-[#004276] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Lead</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Cadastro de Novo Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in">
            <div className="bg-[#004276] text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-lg">Novo Lead de Energia Solar</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Nome Completo / Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: João da Silva / Padaria Sol"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    {docLabel(novoCpfCnpj)}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={novoCpfCnpj}
                    onChange={(e) => setNovoCpfCnpj(maskCPFCNPJ(e.target.value))}
                    placeholder="000.000.000-00"
                    className={`${fieldBase} ${cpfInvalido ? errBorder : okBorder}`}
                  />
                  {cpfInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">{docLabel(novoCpfCnpj)} inválido</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(maskPhone(e.target.value))}
                    placeholder="(31) 99999-8888"
                    className={`${fieldBase} ${telefoneInvalido ? errBorder : okBorder}`}
                  />
                  {telefoneInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">Telefone incompleto</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className={`${fieldBase} ${emailInvalido ? errBorder : okBorder}`}
                  />
                  {emailInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">E-mail inválido</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    CEP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={novoCep}
                      onChange={(e) => {
                        const masked = maskCEP(e.target.value);
                        setNovoCep(masked);
                        if (onlyDigits(masked).length === 8) handleCepLookup(masked);
                      }}
                      onBlur={() => handleCepLookup(novoCep)}
                      placeholder="00000-000"
                      className={`${fieldBase} ${okBorder} pr-9`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPinned className="w-4 h-4" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Preenche endereço automaticamente (ViaCEP)</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Cidade / UF
                  </label>
                  <input
                    type="text"
                    value={novaCidade}
                    onChange={(e) => setNovaCidade(e.target.value)}
                    placeholder="Belo Horizonte/MG"
                    className={`${fieldBase} ${okBorder}`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className={`${fieldBase} ${okBorder}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Consumo Médio (kWh/mês)
                  </label>
                  <input
                    type="number"
                    value={novoConsumo}
                    onChange={(e) => setNovoConsumo(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Tipo de Telhado
                  </label>
                  <select
                    value={novoTelhado}
                    onChange={(e) => setNovoTelhado(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                  >
                    <option value="Colonial">Colonial</option>
                    <option value="Laje">Laje</option>
                    <option value="Metálico">Metálico</option>
                    <option value="Fibrocimento">Fibrocimento</option>
                    <option value="Solo/Estrutura">Solo/Estrutura</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Origem do Lead
                  </label>
                  <select
                    value={novaOrigem}
                    onChange={(e) => setNovaOrigem(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                  >
                    <option value="Google Ads">Google Ads</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Prospecção Ativa">Prospecção Ativa</option>
                    <option value="Site Solar Costa">Site Solar Costa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Vendedor Responsável
                  </label>
                  <select
                    value={novoResponsavel}
                    onChange={(e) => setNovoResponsavel(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.nome}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow"
                >
                  Cadastrar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
