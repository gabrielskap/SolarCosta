import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from './services/storage';
import { AuditService, AuditInput } from './services/audit';
import { computeNotifications, countByCategory } from './utils/notifications';
import { REFERENCE_TODAY } from './utils/dates';
import { Lead, Proposta, Contrato, Boleto, LancamentoFinanceiro, Produto, Fornecedor, User, LeadStage, Agendamento, AuditEntry, Obra, PropostaItem } from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InteractiveCalendar } from './components/InteractiveCalendar';
import { LoginView } from './components/LoginView';
import { LeadsKanbanView } from './components/LeadsKanbanView';
import { LeadDetailView } from './components/LeadDetailView';
import { ProposalCalculatorView } from './components/ProposalCalculatorView';
import { ContractsView } from './components/ContractsView';
import { FinancialView } from './components/FinancialView';
import { SuppliersProductsView } from './components/SuppliersProductsView';
import { UsersView } from './components/UsersView';
import { ObrasView } from './components/ObrasView';
import { ReportsView } from './components/ReportsView';
import { AuditTrailView } from './components/AuditTrailView';
import { NotificationCenter } from './components/NotificationCenter';
import { PDFModal } from './components/PDFModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Menu, Sun } from 'lucide-react';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return StorageService.getCurrentUser();
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('lead-184');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Data Collections State (Loaded from localStorage via StorageService)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // PDF Modal State
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    type: 'proposta' | 'contrato' | 'boleto';
    data: any;
  }>({
    isOpen: false,
    type: 'proposta',
    data: null,
  });

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load Initial Data
  useEffect(() => {
    setLeads(StorageService.getLeads());
    setPropostas(StorageService.getPropostas());
    setContratos(StorageService.getContratos());
    setBoletos(StorageService.getBoletos());
    setLancamentos(StorageService.getLancamentos());
    setAgendamentos(StorageService.getAgendamentos());
    setProdutos(StorageService.getProdutos());
    setFornecedores(StorageService.getFornecedores());
    setUsuarios(StorageService.getUsuarios());
    setObras(StorageService.getObras());
    setAuditLog(AuditService.getAll());
  }, []);

  // Audit trail helper — records "who changed what". The actor (defaulting to
  // the current user) is injected here, so callers omit `usuario`/`usuarioId`.
  // `actor` param allows logging at login time, before currentUser settles.
  const logAudit = (
    input: Omit<AuditInput, 'usuario' | 'usuarioId'>,
    actor: User | null = currentUser,
  ) => {
    if (!actor) return;
    setAuditLog(AuditService.log({ ...input, usuario: actor.nome, usuarioId: actor.id }));
  };

  // Proactive reminders derived from the current data (Central de notificações).
  const notifications = useMemo(
    () => computeNotifications({ leads, boletos, agendamentos }),
    [leads, boletos, agendamentos],
  );
  const notifCounts = useMemo(() => countByCategory(notifications), [notifications]);

  // Agendamento CRUD handlers
  const handleSaveAgendamento = (agendamento: Agendamento) => {
    const isNew = !agendamentos.some((a) => a.id === agendamento.id);
    const updated = StorageService.saveAgendamento(agendamento);
    setAgendamentos(updated);
    logAudit({
      acao: isNew ? 'criar' : 'editar',
      entidade: 'Agendamento',
      entidadeId: agendamento.id,
      alvo: `${agendamento.titulo} — ${agendamento.leadNome}`,
      detalhes: `${agendamento.data} ${agendamento.horarioInicio}–${agendamento.horarioFim} · ${agendamento.responsavel}`,
    });
  };

  const handleDeleteAgendamento = (id: string) => {
    const alvo = agendamentos.find((a) => a.id === id);
    const updated = StorageService.deleteAgendamento(id);
    setAgendamentos(updated);
    logAudit({
      acao: 'excluir',
      entidade: 'Agendamento',
      entidadeId: id,
      alvo: alvo ? `${alvo.titulo} — ${alvo.leadNome}` : `Agendamento ${id}`,
    });
  };

  const handleClearAudit = () => {
    setAuditLog(AuditService.clear());
  };

  const handleNotificationNavigate = (tab: string, leadId?: string) => {
    if (tab === 'detalhe_lead' && leadId) {
      setSelectedLeadId(leadId);
      setActiveTab('detalhe_lead');
    } else {
      setActiveTab(tab);
    }
  };

  // Toast Helper
  const showToast = (title: string, type: 'success' | 'error' | 'info', description?: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      description,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Auth Handler
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    StorageService.setCurrentUser(user);
    setActiveTab('leads');
    logAudit({ acao: 'login', entidade: 'Sessão', alvo: `Entrou no sistema` }, user);
    showToast('Acesso realizado', 'success', `Bem-vindo(a) ao CRM Solar Costa, ${user.nome}!`);
  };

  const handleLogout = () => {
    logAudit({ acao: 'logout', entidade: 'Sessão', alvo: 'Saiu do sistema' });
    setCurrentUser(null);
    StorageService.setCurrentUser(null);
    showToast('Sessão encerrada', 'info', 'Você desconectou da plataforma.');
  };

  // Lead CRUD handlers
  const handleUpdateLeadStage = (leadId: string, newStage: LeadStage) => {
    const prev = leads.find((l) => l.id === leadId);
    const updated = StorageService.updateLeadStage(leadId, newStage);
    setLeads(updated);
    if (prev && prev.etapa !== newStage) {
      logAudit({
        acao: 'mudanca_etapa',
        entidade: 'Lead',
        entidadeId: leadId,
        alvo: prev.nome,
        detalhes: `${prev.etapa} → ${newStage}`,
      });
    }
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    const updated = StorageService.saveLead(updatedLead);
    setLeads(updated);
    logAudit({ acao: 'editar', entidade: 'Lead', entidadeId: updatedLead.id, alvo: updatedLead.nome });
  };

  const handleCreateLead = (newLead: Lead) => {
    const hojeBR = new Date().toLocaleDateString('pt-BR');
    // Garante um lead completo mesmo quando o formulário envia campos parciais.
    const complete: Lead = {
      ...newLead,
      id: newLead.id || `lead-${Date.now()}`,
      numero: newLead.numero || `#${Math.floor(100 + Math.random() * 900)}`,
      dataCriacao: newLead.dataCriacao || hojeBR,
      documentos: newLead.documentos || [],
      historico:
        newLead.historico && newLead.historico.length
          ? newLead.historico
          : [
              {
                id: `h-${Date.now()}`,
                data: hojeBR,
                descricao: 'Lead cadastrado no sistema',
                usuario: currentUser?.nome || 'Sistema',
              },
            ],
    };
    const updated = StorageService.saveLead(complete);
    setLeads(updated);
    logAudit({ acao: 'criar', entidade: 'Lead', entidadeId: complete.id, alvo: complete.nome });
    showToast('Novo Lead cadastrado', 'success', `Lead "${complete.nome}" inserido com sucesso.`);
  };

  // Proposal CRUD Handlers
  const handleSaveProposal = (proposta: Proposta) => {
    const isNew = !propostas.some((p) => p.id === proposta.id);
    const updated = StorageService.saveProposta(proposta);
    setPropostas(updated);
    logAudit({
      acao: isNew ? 'criar' : 'editar',
      entidade: 'Proposta',
      entidadeId: proposta.id,
      alvo: `Proposta ${proposta.numero} — ${proposta.clienteNome}`,
      detalhes: `Status: ${proposta.status}`,
    });
  };

  // Contract CRUD Handlers
  const handleSaveContract = (contrato: Contrato) => {
    const isNew = !contratos.some((c) => c.id === contrato.id);
    const updated = StorageService.saveContrato(contrato);
    setContratos(updated);
    logAudit({
      acao: isNew ? 'criar' : 'editar',
      entidade: 'Contrato',
      entidadeId: contrato.id,
      alvo: `Contrato ${contrato.numero} — ${contrato.clienteNome}`,
    });
  };

  // Financial Handlers
  const handleSaveBoleto = (boleto: Boleto) => {
    const prev = boletos.find((b) => b.id === boleto.id);
    const isNew = !prev;
    const isBaixa = prev && prev.situacao !== 'pago' && boleto.situacao === 'pago';
    const updated = StorageService.saveBoleto(boleto);
    setBoletos(updated);
    logAudit({
      acao: isBaixa ? 'baixa' : isNew ? 'criar' : 'editar',
      entidade: 'Boleto',
      entidadeId: boleto.id,
      alvo: `Boleto ${boleto.parcela} — ${boleto.clienteNome}`,
      detalhes: isBaixa ? `Baixa registrada (${boleto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).` : undefined,
    });
  };

  const handleDeleteBoleto = (id: string) => {
    const alvo = boletos.find((b) => b.id === id);
    const updated = StorageService.deleteBoleto(id);
    setBoletos(updated);
    logAudit({
      acao: 'excluir',
      entidade: 'Boleto',
      entidadeId: id,
      alvo: alvo ? `Boleto ${alvo.parcela} — ${alvo.clienteNome}` : `Boleto ${id}`,
    });
  };

  const handleAddLancamento = (lancamento: LancamentoFinanceiro) => {
    const updated = StorageService.saveLancamento(lancamento);
    setLancamentos(updated);
    logAudit({
      acao: 'criar',
      entidade: 'Lançamento',
      entidadeId: lancamento.id,
      alvo: lancamento.descricao,
      detalhes: `${lancamento.tipo === 'receita' ? 'Entrada' : 'Saída'} · ${Math.abs(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    });
  };

  // Products & Suppliers Handlers
  const handleSaveProduto = (produto: Produto) => {
    const isNew = !produtos.some((p) => p.id === produto.id);
    const updated = StorageService.saveProduto(produto);
    setProdutos(updated);
    logAudit({ acao: isNew ? 'criar' : 'editar', entidade: 'Produto', entidadeId: produto.id, alvo: produto.nome });
  };

  const handleDeleteProduto = (id: string) => {
    const alvo = produtos.find((p) => p.id === id);
    const updated = StorageService.deleteProduto(id);
    setProdutos(updated);
    logAudit({ acao: 'excluir', entidade: 'Produto', entidadeId: id, alvo: alvo ? alvo.nome : `Produto ${id}` });
  };

  const handleSaveFornecedor = (fornecedor: Fornecedor) => {
    const isNew = !fornecedores.some((f) => f.id === fornecedor.id);
    const updated = StorageService.saveFornecedor(fornecedor);
    setFornecedores(updated);
    logAudit({ acao: isNew ? 'criar' : 'editar', entidade: 'Fornecedor', entidadeId: fornecedor.id, alvo: fornecedor.nome });
  };

  const handleDeleteFornecedor = (id: string) => {
    const alvo = fornecedores.find((f) => f.id === id);
    const updated = StorageService.deleteFornecedor(id);
    setFornecedores(updated);
    logAudit({ acao: 'excluir', entidade: 'Fornecedor', entidadeId: id, alvo: alvo ? alvo.nome : `Fornecedor ${id}` });
  };

  // Users Handlers
  const handleSaveUser = (user: User) => {
    const isNew = !usuarios.some((u) => u.id === user.id);
    const updated = StorageService.saveUsuario(user);
    setUsuarios(updated);
    logAudit({ acao: isNew ? 'criar' : 'editar', entidade: 'Usuário', entidadeId: user.id, alvo: `${user.nome} (${user.cargo})` });
  };

  const handleDeleteUser = (id: string) => {
    const alvo = usuarios.find((u) => u.id === id);
    const updated = StorageService.deleteUsuario(id);
    setUsuarios(updated);
    logAudit({ acao: 'excluir', entidade: 'Usuário', entidadeId: id, alvo: alvo ? alvo.nome : `Usuário ${id}` });
  };

  // Obras (pós-venda) handlers
  const handleSaveObra = (obra: Obra) => {
    const isNew = !obras.some((o) => o.id === obra.id);
    const updated = StorageService.saveObra(obra);
    setObras(updated);
    logAudit({
      acao: isNew ? 'criar' : 'editar',
      entidade: 'Obra',
      entidadeId: obra.id,
      alvo: `${obra.numero} — ${obra.clienteNome}`,
      detalhes: `Etapa: ${obra.etapa}`,
    });
  };

  const handleDeleteObra = (id: string) => {
    const alvo = obras.find((o) => o.id === id);
    const updated = StorageService.deleteObra(id);
    setObras(updated);
    logAudit({
      acao: 'excluir',
      entidade: 'Obra',
      entidadeId: id,
      alvo: alvo ? `${alvo.numero} — ${alvo.clienteNome}` : `Obra ${id}`,
    });
  };

  // Baixa de estoque: chamada quando uma obra consome o kit vinculado.
  const handleBaixarEstoque = (itens: PropostaItem[]) => {
    if (!itens || itens.length === 0) return;
    const updated = StorageService.baixarEstoqueKit(itens);
    setProdutos(updated);
    const totalItens = itens.reduce((a, i) => a + (i.qtd || 0), 0);
    logAudit({
      acao: 'editar',
      entidade: 'Produto',
      alvo: 'Baixa de estoque por obra',
      detalhes: `${totalItens} itens consumidos (${itens.length} produtos do catálogo).`,
    });
  };

  // Open PDF Modal
  const handleOpenPDF = (type: 'proposta' | 'contrato' | 'boleto', data: any) => {
    setPdfModal({
      isOpen: true,
      type,
      data,
    });
  };

  // Navigation callbacks
  const handleSelectLeadDetail = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('detalhe_lead');
  };

  const handleNavigateToProposal = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('proposta');
  };

  const handleNavigateToContract = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('contrato');
  };

  // If user is not logged in, render Login View
  if (!currentUser) {
    return (
      <>
        <LoginView users={usuarios} onLoginSuccess={handleLogin} showToast={showToast} />
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  // Active Lead Object
  const currentLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f4f6fa] text-slate-800 flex flex-col font-sans antialiased">
      {/* Mobile Top Header Navigation */}
      <header className="md:hidden bg-[#004276] text-white p-4 flex items-center justify-between border-b border-blue-900 sticky top-0 z-30 shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-1.5 hover:bg-blue-900/60 rounded-lg text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#FFD100] flex items-center justify-center">
              <Sun className="w-4 h-4 text-[#004276] fill-[#004276]" />
            </div>
            <span className="font-extrabold text-sm tracking-wider">SOLAR COSTA</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NotificationCenter
            notifications={notifications}
            counts={notifCounts}
            onNavigate={handleNotificationNavigate}
            tone="onDark"
          />
          <div className="text-right">
            <p className="text-xs font-bold leading-none">{currentUser.nome ? currentUser.nome.split(' ')[0] : 'Usuário'}</p>
            <span className="text-[10px] text-[#FFD100] font-semibold">{currentUser.cargo || currentUser.perfil}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex h-full overflow-hidden relative">
        {/* Sidebar Desktop & Mobile Drawer */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          isOpenMobile={isMobileSidebarOpen}
          setIsOpenMobile={setIsMobileSidebarOpen}
        />

        {/* Right column: desktop top bar + scrollable workspace */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden md:pl-64">
          {/* Desktop top utility bar (notifications, user) */}
          <header className="hidden md:flex items-center justify-between gap-3 bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 z-10">
            <span className="text-xs font-semibold text-slate-500 first-letter:uppercase">
              {REFERENCE_TODAY.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-3">
              <NotificationCenter
                notifications={notifications}
                counts={notifCounts}
                onNavigate={handleNotificationNavigate}
                tone="onLight"
              />
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-[#004276] text-white text-[11px] font-bold flex items-center justify-center">
                  {currentUser.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800">{currentUser.nome}</p>
                  <p className="text-[10px] text-slate-400">{currentUser.cargo || currentUser.perfil}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-h-0">
            <div className="max-w-[1920px] mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardView
              leads={leads || []}
              contratos={contratos || []}
              propostas={propostas || []}
              lancamentos={lancamentos || []}
              usuarios={usuarios || []}
              agendamentos={agendamentos || []}
              onSaveAgendamento={handleSaveAgendamento}
              onDeleteAgendamento={handleDeleteAgendamento}
              onSelectLead={handleSelectLeadDetail}
              showToast={showToast}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'agenda' && (
            <InteractiveCalendar
              agendamentos={agendamentos || []}
              leads={leads || []}
              users={usuarios || []}
              onSaveAgendamento={handleSaveAgendamento}
              onDeleteAgendamento={handleDeleteAgendamento}
              onSelectLead={handleSelectLeadDetail}
              showToast={showToast}
            />
          )}

          {activeTab === 'leads' && (
            <LeadsKanbanView
              leads={leads || []}
              users={usuarios || []}
              onSelectLead={(lead) => handleSelectLeadDetail(lead.id)}
              onUpdateLeadStage={handleUpdateLeadStage}
              onCreateLead={handleCreateLead}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'detalhe_lead' && currentLead && (
            <LeadDetailView
              lead={currentLead}
              onBack={() => setActiveTab('leads')}
              onUpdateLeadStage={handleUpdateLeadStage}
              onNavigateToProposal={handleNavigateToProposal}
              onNavigateToContract={handleNavigateToContract}
              onOpenPDF={handleOpenPDF}
              propostas={propostas}
              contratos={contratos}
              boletos={boletos}
              currentUser={currentUser}
              showToast={showToast}
              onUpdateLead={handleUpdateLead}
            />
          )}

          {activeTab === 'proposta' && (
            <ProposalCalculatorView
              propostas={propostas}
              produtos={produtos}
              leads={leads}
              currentLeadId={selectedLeadId}
              onSaveProposal={handleSaveProposal}
              onOpenPDF={handleOpenPDF}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'contrato' && (
            <ContractsView
              contratos={contratos}
              leads={leads}
              onSaveContract={handleSaveContract}
              onOpenPDF={handleOpenPDF}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'financeiro' && (
            <FinancialView
              boletos={boletos}
              lancamentos={lancamentos}
              onSaveBoleto={handleSaveBoleto}
              onDeleteBoleto={handleDeleteBoleto}
              onAddLancamento={handleAddLancamento}
              onOpenPDF={handleOpenPDF}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'fornecedores' && (
            <SuppliersProductsView
              produtos={produtos}
              fornecedores={fornecedores}
              onSaveProduto={handleSaveProduto}
              onDeleteProduto={handleDeleteProduto}
              onSaveFornecedor={handleSaveFornecedor}
              onDeleteFornecedor={handleDeleteFornecedor}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'usuarios' && (
            <UsersView
              usuarios={usuarios}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'obras' && (
            <ObrasView
              obras={obras || []}
              contratos={contratos || []}
              propostas={propostas || []}
              produtos={produtos || []}
              users={usuarios || []}
              currentUser={currentUser}
              onSaveObra={handleSaveObra}
              onDeleteObra={handleDeleteObra}
              onBaixarEstoque={handleBaixarEstoque}
              showToast={showToast}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView
              leads={leads || []}
              contratos={contratos || []}
              propostas={propostas || []}
              boletos={boletos || []}
              lancamentos={lancamentos || []}
              usuarios={usuarios || []}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeTab === 'auditoria' && (
            <AuditTrailView
              audit={auditLog}
              usuarios={usuarios || []}
              currentUser={currentUser}
              onClear={handleClearAudit}
              showToast={showToast}
            />
          )}
            </div>
          </main>
        </div>
      </div>

      {/* PDF Generation and View Modal */}
      {pdfModal.isOpen && (
        <PDFModal
          type={pdfModal.type}
          data={pdfModal.data}
          onClose={() => setPdfModal({ isOpen: false, type: 'proposta', data: null })}
        />
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
