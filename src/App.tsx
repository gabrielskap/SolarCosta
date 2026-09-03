import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Api, Auth, carregarTudo, type ConfigApp } from './services/api';
import { aoExpirarSessao, ErroApi } from './services/http';
import {
  Lead, Proposta, Contrato, Boleto, LancamentoFinanceiro, Produto, Fornecedor,
  User, LeadStage, Agendamento, AuditEntry, Obra, AppNotification,
} from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InteractiveCalendar } from './components/InteractiveCalendar';
import { LoginView } from './components/LoginView';
import { LeadsKanbanView } from './components/LeadsKanbanView';
import { LeadDetailView } from './components/LeadDetailView';
import { ProposalCalculatorView } from './components/ProposalCalculatorView';
import { ProposalsListView } from './components/ProposalsListView';
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
import { Menu, Loader2, WifiOff } from 'lucide-react';
import logoFull from './assets/logo-full.png';

interface LeadDetailRouteProps {
  leads: Lead[];
  propostas: Proposta[];
  contratos: Contrato[];
  boletos: Boleto[];
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  onUpdateLeadStage: (leadId: string, newStage: LeadStage) => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  onFetchDetalhe: (leadId: string) => void;
}

/** Casca de rota: resolve `:leadId` da URL, busca o detalhe completo e traduz "voltar"/"nova proposta" em navegação. */
const LeadDetailRoute: React.FC<LeadDetailRouteProps> = ({ leads, onFetchDetalhe, ...rest }) => {
  const { leadId = '' } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const lead = leads.find((l) => l.id === leadId);

  useEffect(() => {
    if (leadId) onFetchDetalhe(leadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Link direto para um lead inexistente (ou já excluído): volta para a listagem.
  useEffect(() => {
    if (!lead && leads.length > 0) navigate('/sistema/leads', { replace: true });
  }, [lead, leads.length, navigate]);

  if (!lead) return null;

  return (
    <LeadDetailView
      lead={lead}
      onBack={() => navigate('/sistema/leads')}
      onNavigateToProposal={(id) => navigate(`/sistema/propostas/nova?leadId=${encodeURIComponent(id)}`)}
      onNavigateToContract={() => navigate('/sistema/contratos')}
      {...rest}
    />
  );
};

interface NovaPropostaRouteProps {
  propostas: Proposta[];
  produtos: Produto[];
  leads: Lead[];
  config: ConfigApp | null;
  onSaveProposal: (proposta: Proposta) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

/** Casca de rota: lê `?leadId=` (opcional, vindo do detalhe do lead) para pré-vincular a proposta. */
const NovaPropostaRoute: React.FC<NovaPropostaRouteProps> = (props) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  return (
    <ProposalCalculatorView
      {...props}
      currentLeadId={searchParams.get('leadId') || undefined}
      onBack={() => navigate('/sistema/propostas')}
    />
  );
};

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  // Navigation State
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Data Collections State (carregadas da API)
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [config, setConfig] = useState<ConfigApp | null>(null);

  // Estado de carga da aplicação
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  // PDF Modal State
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    type: 'proposta' | 'contrato' | 'boleto';
    data: any;
  }>({ isOpen: false, type: 'proposta', data: null });

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, type: 'success' | 'error' | 'info', description?: string) => {
      setToasts((prev) => [
        ...prev,
        { id: `toast-${Date.now()}-${Math.random()}`, title, description, type },
      ]);
    },
    [],
  );

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  /** Traduz a falha da API num toast legível e devolve `false` para o chamador. */
  const tratarErro = useCallback(
    (erro: unknown, acao: string): false => {
      const mensagem =
        erro instanceof ErroApi ? erro.mensagemCompleta : 'Erro inesperado. Tente de novo.';
      showToast(acao, 'error', mensagem);
      return false;
    },
    [showToast],
  );

  /* ----------------------------------------------------------- sessão -- */

  // Tenta reaproveitar a sessão salva (sobrevive ao F5).
  useEffect(() => {
    let ativo = true;
    Auth.restaurar()
      .then((user) => {
        if (ativo && user) setCurrentUser(user);
      })
      .finally(() => {
        if (ativo) setVerificandoSessao(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // O cliente HTTP avisa quando o refresh token morre de vez.
  useEffect(
    () =>
      aoExpirarSessao(() => {
        setCurrentUser(null);
        showToast('Sessão expirada', 'info', 'Entre novamente para continuar.');
      }),
    [showToast],
  );

  /* ------------------------------------------------------ carga inicial -- */

  const recarregarNotificacoes = useCallback(async () => {
    try {
      const r = await Api.getNotificacoes();
      setNotifications(
        (r.notificacoes ?? []).map((n: any) => ({
          id: n.chave,
          categoria: n.categoria,
          prioridade: n.prioridade,
          titulo: n.titulo,
          descricao: n.descricao,
          meta: n.meta ?? undefined,
          destinoTab: n.destino_tab ?? undefined,
          leadId: n.lead_id ?? undefined,
        })),
      );
    } catch {
      // Notificação é acessório: falhar aqui não pode atrapalhar o resto.
    }
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const dados = await carregarTudo();
      setLeads(dados.leads);
      setPropostas(dados.propostas);
      setContratos(dados.contratos);
      setBoletos(dados.boletos);
      setLancamentos(dados.lancamentos);
      setAgendamentos(dados.agendamentos);
      setProdutos(dados.produtos);
      setFornecedores(dados.fornecedores);
      setUsuarios(dados.usuarios);
      setObras(dados.obras);
      setAuditLog(dados.auditoria);
      setConfig(dados.config);
      await recarregarNotificacoes();
    } catch (erro) {
      setErroCarga(
        erro instanceof ErroApi ? erro.mensagemCompleta : 'Não foi possível carregar os dados.',
      );
    } finally {
      setCarregando(false);
    }
  }, [recarregarNotificacoes]);

  useEffect(() => {
    if (currentUser) void carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  /** Recarrega a trilha depois de cada escrita — quem audita agora é o banco. */
  const atualizarAuditoria = useCallback(async () => {
    try {
      setAuditLog(await Api.getAuditoria());
    } catch {
      // Usuário sem permissão de auditoria: silêncio é o certo aqui.
    }
    void recarregarNotificacoes();
  }, [recarregarNotificacoes]);

  const notifCounts = useMemo(
    () =>
      notifications.reduce(
        (acc, n) => {
          acc.total += 1;
          acc[n.categoria] += 1;
          return acc;
        },
        { total: 0, boleto_vencido: 0, lead_sem_contato: 0, visita_hoje: 0 },
      ),
    [notifications],
  );

  /* ------------------------------------------------------------- auth -- */

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    navigate('/sistema/leads');
    showToast('Acesso realizado', 'success', `Bem-vindo(a) ao CRM Solar Costa, ${user.nome}!`);
  };

  const handleLogout = async () => {
    await Auth.logout();
    setCurrentUser(null);
    setLeads([]);
    setPropostas([]);
    setContratos([]);
    setBoletos([]);
    setLancamentos([]);
    setAgendamentos([]);
    setProdutos([]);
    setFornecedores([]);
    setObras([]);
    setAuditLog([]);
    setNotifications([]);
    showToast('Sessão encerrada', 'info', 'Você desconectou da plataforma.');
  };

  /* ------------------------------------------------------------ leads -- */

  const handleUpdateLeadStage = async (leadId: string, newStage: LeadStage) => {
    try {
      setLeads(await Api.updateLeadStage(leadId, newStage));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível mover o lead');
      void carregarDados();
    }
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    try {
      setLeads(await Api.saveLead(updatedLead));
      showToast('Lead atualizado', 'success', updatedLead.nome);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o lead');
    }
  };

  const handleCreateLead = async (newLead: Lead) => {
    try {
      setLeads(await Api.saveLead({ ...newLead, id: '' }));
      showToast('Novo Lead cadastrado', 'success', `Lead "${newLead.nome}" inserido com sucesso.`);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível cadastrar o lead');
    }
  };

  /* -------------------------------------------------------- propostas -- */

  const handleSaveProposal = async (proposta: Proposta) => {
    try {
      setPropostas(await Api.saveProposta(proposta));
      setLeads(await Api.getLeads());
      showToast('Proposta salva', 'success', `Proposta de ${proposta.clienteNome}.`);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar a proposta');
    }
  };

  /* -------------------------------------------------------- contratos -- */

  const handleSaveContract = async (contrato: Contrato) => {
    try {
      setContratos(await Api.saveContrato(contrato));
      setLeads(await Api.getLeads());
      showToast('Contrato salvo', 'success', `Contrato de ${contrato.clienteNome}.`);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o contrato');
    }
  };

  /* ------------------------------------------------------- financeiro -- */

  const handleSaveBoleto = async (boleto: Boleto) => {
    try {
      setBoletos(await Api.saveBoleto(boleto));
      // A baixa do boleto gera lançamento no banco: recarrega o caixa.
      setLancamentos(await Api.getLancamentos());
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o boleto');
    }
  };

  const handleDeleteBoleto = async (id: string) => {
    try {
      setBoletos(await Api.deleteBoleto(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir o boleto');
    }
  };

  const handleAddLancamento = async (lancamento: LancamentoFinanceiro) => {
    try {
      setLancamentos(await Api.saveLancamento(lancamento));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível registrar o lançamento');
    }
  };

  /* --------------------------------------------- produtos e fornecedores -- */

  const handleSaveProduto = async (produto: Produto) => {
    try {
      const novo = !produto.id || produto.id.startsWith('novo-');
      setProdutos(await Api.saveProduto(produto));
      showToast(novo ? 'Produto cadastrado' : 'Produto atualizado', 'success', `${produto.nome} gravado no catálogo.`);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o produto');
    }
  };

  const handleDeleteProduto = async (id: string) => {
    try {
      setProdutos(await Api.deleteProduto(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir o produto');
    }
  };

  const handleSaveFornecedor = async (fornecedor: Fornecedor) => {
    try {
      const novo = !fornecedor.id || fornecedor.id.startsWith('novo-');
      setFornecedores(await Api.saveFornecedor(fornecedor));
      showToast(novo ? 'Fornecedor cadastrado' : 'Fornecedor atualizado', 'success', `${fornecedor.nome} adicionado aos parceiros.`);
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o fornecedor');
    }
  };

  const handleDeleteFornecedor = async (id: string) => {
    try {
      setFornecedores(await Api.deleteFornecedor(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir o fornecedor');
    }
  };

  /* --------------------------------------------------------- usuários -- */

  const handleSaveUser = async (user: User) => {
    try {
      setUsuarios(await Api.saveUsuario(user));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o usuário');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      setUsuarios(await Api.deleteUsuario(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir o usuário');
    }
  };

  /* ------------------------------------------------------------ obras -- */

  const handleSaveObra = async (obra: Obra) => {
    try {
      setObras(await Api.saveObra(obra));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar a obra');
    }
  };

  const handleDeleteObra = async (id: string) => {
    try {
      setObras(await Api.deleteObra(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir a obra');
    }
  };

  /**
   * Baixa do kit no estoque. A regra mora no banco: a função é idempotente e
   * recusa deixar saldo negativo, devolvendo a mensagem que aparece no toast.
   */
  const handleBaixarEstoque = async (obraId: string) => {
    try {
      const { produtos: atualizados, itens } = await Api.baixarEstoqueObra(obraId);
      setProdutos(atualizados);
      setObras(await Api.getObras());
      showToast(
        itens > 0 ? 'Estoque baixado' : 'Estoque já havia sido baixado',
        itens > 0 ? 'success' : 'info',
        itens > 0 ? `${itens} produto(s) do catálogo consumidos.` : undefined,
      );
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível baixar o estoque');
    }
  };

  /* ----------------------------------------------------- agendamentos -- */

  const handleSaveAgendamento = async (agendamento: Agendamento) => {
    try {
      setAgendamentos(await Api.saveAgendamento(agendamento));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível salvar o agendamento');
    }
  };

  const handleDeleteAgendamento = async (id: string) => {
    try {
      setAgendamentos(await Api.deleteAgendamento(id));
      void atualizarAuditoria();
    } catch (erro) {
      tratarErro(erro, 'Não foi possível excluir o agendamento');
    }
  };

  /* ------------------------------------------------------- navegação -- */

  // Ao abrir o detalhe, busca documentos e timeline (a listagem não os traz).
  const fetchLeadDetalhe = useCallback(async (leadId: string) => {
    try {
      const completo = await Api.getLeadDetalhe(leadId);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? completo : l)));
    } catch (erro) {
      tratarErro(erro, 'Não foi possível abrir o lead');
    }
  }, [tratarErro]);

  const handleSelectLeadDetail = (leadId: string) => {
    navigate(`/sistema/leads/${leadId}`);
    void fetchLeadDetalhe(leadId);
  };

  const handleNotificationNavigate = (tab: string, leadId?: string) => {
    if (tab === 'detalhe_lead' && leadId) {
      handleSelectLeadDetail(leadId);
    } else {
      navigate(`/sistema/${tab}`);
    }
  };

  const handleNavigateToProposal = (leadId: string) => {
    navigate(`/sistema/propostas/nova?leadId=${encodeURIComponent(leadId)}`);
  };

  const handleOpenNewProposal = () => {
    navigate('/sistema/propostas/nova');
  };

  const handleNavigateToContract = (_leadId: string) => {
    navigate('/sistema/contratos');
  };

  const handleOpenPDF = (type: 'proposta' | 'contrato' | 'boleto', data: any) => {
    setPdfModal({ isOpen: true, type, data });
  };

  /* ----------------------------------------------------------- render -- */

  // Verificando se existe sessão salva antes de decidir entre login e app.
  if (verificandoSessao) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f4f6fa]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#004276] animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView onLoginSuccess={handleLogin} showToast={showToast} />
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  if (erroCarga) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f4f6fa] p-6">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <WifiOff className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="font-extrabold text-lg text-slate-900 mb-2">Falha ao carregar os dados</h2>
          <p className="text-sm text-slate-600 mb-6">{erroCarga}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => void carregarDados()}
              className="px-4 py-2 rounded-lg bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => void handleLogout()}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (carregando && leads.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f4f6fa]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#004276] animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Carregando o CRM…</p>
        </div>
      </div>
    );
  }

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
            <img src={logoFull} alt="Solar Costa" className="h-6 w-auto" />
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
        <Sidebar
          currentUser={currentUser}
          onLogout={() => void handleLogout()}
          isOpenMobile={isMobileSidebarOpen}
          setIsOpenMobile={setIsMobileSidebarOpen}
        />

        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden md:pl-64">
          <header className="hidden md:flex items-center justify-between gap-3 bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 z-10">
            <span className="text-xs font-semibold text-slate-500 first-letter:uppercase">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-3">
              {carregando && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
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

          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-h-0">
            <div className="max-w-[1920px] mx-auto w-full">
              <Routes>
                <Route index element={<Navigate to="/sistema/dashboard" replace />} />

                <Route
                  path="dashboard"
                  element={
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
                      onNavigateTab={(tab) => navigate(`/sistema/${tab}`)}
                    />
                  }
                />

                <Route
                  path="agenda"
                  element={
                    <InteractiveCalendar
                      agendamentos={agendamentos || []}
                      leads={leads || []}
                      users={usuarios || []}
                      onSaveAgendamento={handleSaveAgendamento}
                      onDeleteAgendamento={handleDeleteAgendamento}
                      onSelectLead={handleSelectLeadDetail}
                      showToast={showToast}
                    />
                  }
                />

                <Route
                  path="leads"
                  element={
                    <LeadsKanbanView
                      leads={leads || []}
                      users={usuarios || []}
                      onSelectLead={(lead) => handleSelectLeadDetail(lead.id)}
                      onUpdateLeadStage={handleUpdateLeadStage}
                      onCreateLead={handleCreateLead}
                      currentUser={currentUser}
                      showToast={showToast}
                    />
                  }
                />

                <Route
                  path="leads/:leadId"
                  element={
                    <LeadDetailRoute
                      leads={leads}
                      propostas={propostas}
                      contratos={contratos}
                      boletos={boletos}
                      currentUser={currentUser}
                      showToast={showToast}
                      onUpdateLeadStage={handleUpdateLeadStage}
                      onUpdateLead={handleUpdateLead}
                      onOpenPDF={handleOpenPDF}
                      onFetchDetalhe={fetchLeadDetalhe}
                    />
                  }
                />

                <Route
                  path="propostas"
                  element={
                    <ProposalsListView
                      propostas={propostas}
                      onNovaProposta={handleOpenNewProposal}
                      onOpenPDF={handleOpenPDF}
                    />
                  }
                />

                <Route
                  path="propostas/nova"
                  element={
                    <NovaPropostaRoute
                      propostas={propostas}
                      produtos={produtos}
                      leads={leads}
                      config={config}
                      onSaveProposal={handleSaveProposal}
                      onOpenPDF={handleOpenPDF}
                      currentUser={currentUser}
                      showToast={showToast}
                    />
                  }
                />

                <Route
                  path="contratos"
                  element={
                    <ContractsView
                      contratos={contratos}
                      leads={leads}
                      propostas={propostas}
                      onSaveContract={handleSaveContract}
                      config={config}
                      onOpenPDF={handleOpenPDF}
                      currentUser={currentUser}
                      showToast={showToast}
                    />
                  }
                />

                <Route
                  path="financeiro"
                  element={
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
                  }
                />

                <Route
                  path="fornecedores"
                  element={
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
                  }
                />

                <Route
                  path="usuarios"
                  element={
                    <UsersView
                      usuarios={usuarios}
                      onSaveUser={handleSaveUser}
                      onDeleteUser={handleDeleteUser}
                      currentUser={currentUser}
                      showToast={showToast}
                    />
                  }
                />

                <Route
                  path="obras"
                  element={
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
                  }
                />

                <Route
                  path="relatorios"
                  element={
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
                  }
                />

                <Route
                  path="auditoria"
                  element={
                    <AuditTrailView
                      audit={auditLog}
                      usuarios={usuarios || []}
                      currentUser={currentUser}
                      onClear={() => showToast('Trilha imutável', 'info', 'A auditoria é append-only e não pode ser apagada pelo sistema.')}
                      showToast={showToast}
                    />
                  }
                />

                <Route path="*" element={<Navigate to="/sistema/dashboard" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>

      {pdfModal.isOpen && (
        <PDFModal
          type={pdfModal.type}
          data={pdfModal.data}
          onClose={() => setPdfModal({ isOpen: false, type: 'proposta', data: null })}
        />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
