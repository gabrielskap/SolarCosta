import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { Lead, Proposta, Contrato, Boleto, LancamentoFinanceiro, Produto, Fornecedor, User, LeadStage, Agendamento } from './types';
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
  }, []);

  // Agendamento CRUD handlers
  const handleSaveAgendamento = (agendamento: Agendamento) => {
    const updated = StorageService.saveAgendamento(agendamento);
    setAgendamentos(updated);
  };

  const handleDeleteAgendamento = (id: string) => {
    const updated = StorageService.deleteAgendamento(id);
    setAgendamentos(updated);
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
    showToast('Acesso realizado', 'success', `Bem-vindo(a) ao CRM Solar Costa, ${user.nome}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    StorageService.setCurrentUser(null);
    showToast('Sessão encerrada', 'info', 'Você desconectou da plataforma.');
  };

  // Lead CRUD handlers
  const handleUpdateLeadStage = (leadId: string, newStage: LeadStage) => {
    const updated = StorageService.updateLeadStage(leadId, newStage);
    setLeads(updated);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    const updated = StorageService.saveLead(updatedLead);
    setLeads(updated);
  };

  const handleCreateLead = (newLead: Lead) => {
    const updated = StorageService.saveLead(newLead);
    setLeads(updated);
    showToast('Novo Lead cadastrado', 'success', `Lead "${newLead.nome}" inserido com sucesso.`);
  };

  // Proposal CRUD Handlers
  const handleSaveProposal = (proposta: Proposta) => {
    const updated = StorageService.saveProposta(proposta);
    setPropostas(updated);
  };

  // Contract CRUD Handlers
  const handleSaveContract = (contrato: Contrato) => {
    const updated = StorageService.saveContrato(contrato);
    setContratos(updated);
  };

  // Financial Handlers
  const handleSaveBoleto = (boleto: Boleto) => {
    const updated = StorageService.saveBoleto(boleto);
    setBoletos(updated);
  };

  const handleDeleteBoleto = (id: string) => {
    const updated = StorageService.deleteBoleto(id);
    setBoletos(updated);
  };

  const handleAddLancamento = (lancamento: LancamentoFinanceiro) => {
    const updated = StorageService.saveLancamento(lancamento);
    setLancamentos(updated);
  };

  // Products & Suppliers Handlers
  const handleSaveProduto = (produto: Produto) => {
    const updated = StorageService.saveProduto(produto);
    setProdutos(updated);
  };

  const handleDeleteProduto = (id: string) => {
    const updated = StorageService.deleteProduto(id);
    setProdutos(updated);
  };

  const handleSaveFornecedor = (fornecedor: Fornecedor) => {
    const updated = StorageService.saveFornecedor(fornecedor);
    setFornecedores(updated);
  };

  const handleDeleteFornecedor = (id: string) => {
    const updated = StorageService.deleteFornecedor(id);
    setFornecedores(updated);
  };

  // Users Handlers
  const handleSaveUser = (user: User) => {
    const updated = StorageService.saveUsuario(user);
    setUsuarios(updated);
  };

  const handleDeleteUser = (id: string) => {
    const updated = StorageService.deleteUsuario(id);
    setUsuarios(updated);
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
    <div className="min-h-screen bg-[#f4f6fa] text-slate-800 flex flex-col font-sans antialiased">
      {/* Mobile Top Header Navigation */}
      <header className="md:hidden bg-[#004276] text-white p-4 flex items-center justify-between border-b border-blue-900 sticky top-0 z-30 shadow-md">
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

        <div className="text-right">
          <p className="text-xs font-bold leading-none">{currentUser.nome ? currentUser.nome.split(' ')[0] : 'Usuário'}</p>
          <span className="text-[10px] text-[#FFD100] font-semibold">{currentUser.cargo || currentUser.perfil}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
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

        {/* Mobile Sidebar overlay backdrop */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-[1920px] mx-auto w-full">
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
        </main>
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
