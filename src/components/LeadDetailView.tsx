import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, FileText, Upload, Folder, Download, Trash2, Plus, Pencil,
  MessageSquare, FileCheck, DollarSign, Calendar, ChevronRight, CheckCircle2
} from 'lucide-react';
import { Lead, LeadStage, PastaDocumento, Proposta, Contrato, Boleto, User } from '../types';
import { Api } from '../services/api';
import { AcoesContato } from './comuns/AcoesContato';
import { ModalCabecalho } from './comuns/ModalCabecalho';
import { LeadFormModal } from './leads/LeadFormModal';
import { STAGES } from './LeadsKanbanView';

/**
 * Extensões aceitas. A mesma lista existe em documentos.routes.ts e é LÁ que
 * ela vale — aqui serve para recusar cedo, sem subir 10 MB para receber 409.
 */
const EXTENSOES_ACEITAS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'dwg', 'xlsx', 'xls', 'docx', 'doc'];

/** Espelha o client_max_body_size do Nginx e o CHECK da V015. */
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

const ACCEPT = EXTENSOES_ACEITAS.map((e) => `.${e}`).join(',');

function extensaoDe(nome: string): string {
  const partes = nome.split('.');
  return partes.length > 1 ? partes.pop()!.toLowerCase() : '';
}

interface LeadDetailViewProps {
  lead: Lead;
  users: User[];
  onBack: () => void;
  onUpdateLeadStage: (leadId: string, newStage: LeadStage) => void;
  onNavigateToProposal: (leadId: string) => void;
  onNavigateToContract: (leadId: string) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  propostas: Proposta[];
  contratos: Contrato[];
  boletos: Boleto[];
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onDeleteLead: (id: string) => void;
  /** Relê o lead do servidor. Documento e interação são gravados aqui, direto na API. */
  onReloadLead: () => void;
}

export const LeadDetailView: React.FC<LeadDetailViewProps> = ({
  lead,
  users,
  onBack,
  onUpdateLeadStage,
  onNavigateToProposal,
  onNavigateToContract,
  onOpenPDF,
  propostas,
  contratos,
  boletos,
  currentUser,
  showToast,
  onUpdateLead,
  onDeleteLead,
  onReloadLead
}) => {
  const [activeTab, setActiveTab] = useState<'documentos' | 'historico' | 'propostas' | 'contratos' | 'financeiro'>('documentos');
  const [novaInteracao, setNovaInteracao] = useState('');
  const [isRegistrarContatoOpen, setIsRegistrarContatoOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Pastas e contagens vêm de SolarCosta_vw_PastasDocumentos — uma view que
  // existia desde a V004 e nunca tinha sido consultada. Até aqui, a grade era
  // um array literal com contadores fixos, iguais para todo lead.
  const [pastas, setPastas] = useState<PastaDocumento[]>([]);
  const [totalArquivos, setTotalArquivos] = useState(0);
  const [pastaSelecionada, setPastaSelecionada] = useState<number | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // Linked proposal details
  const linkedProposal = propostas.find(p => p.leadId === lead.id || p.id === lead.propostaVinculadaId);
  const linkedContract = contratos.find(c => c.leadId === lead.id);
  const clientBoletos = boletos.filter(b => b.clienteNome.toLowerCase().includes(lead.nome.toLowerCase()));

  const podeAnexar = currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.anexarDocumentos;
  const ehAdministrador = currentUser.cargo === 'Administrador';

  const carregarPastas = useCallback(async () => {
    try {
      const { pastas: lista, total } = await Api.getPastasLead(lead.id);
      setPastas(lista);
      setTotalArquivos(total);
      // Primeira carga (ou pasta que deixou de existir): cai na primeira.
      setPastaSelecionada((atual) =>
        atual != null && lista.some((p) => p.id === atual) ? atual : lista[0]?.id ?? null,
      );
    } catch (erro) {
      showToast('Não foi possível carregar as pastas', 'error', (erro as Error).message);
    }
  }, [lead.id, showToast]);

  useEffect(() => {
    void carregarPastas();
  }, [carregarPastas]);

  const pastaAtual = pastas.find((p) => p.id === pastaSelecionada);

  /** Recusa o que o servidor recusaria, sem gastar o upload para descobrir. */
  const arquivoValido = (f: File): boolean => {
    if (!EXTENSOES_ACEITAS.includes(extensaoDe(f.name))) {
      showToast('Formato não suportado', 'error', `${f.name} — envie ${EXTENSOES_ACEITAS.join(', ')}.`);
      return false;
    }
    if (f.size > TAMANHO_MAXIMO) {
      showToast('Arquivo muito grande', 'error', `${f.name} passa de 10 MB.`);
      return false;
    }
    if (f.size === 0) {
      showToast('Arquivo vazio', 'error', `${f.name} não tem conteúdo.`);
      return false;
    }
    return true;
  };

  const enviarArquivos = async (lista: FileList | File[]) => {
    const arquivos = Array.from(lista);
    if (arquivos.length === 0) return;

    if (pastaSelecionada == null) {
      showToast('Escolha uma pasta', 'info', 'Selecione onde o arquivo deve ficar.');
      return;
    }

    const aceitos = arquivos.filter(arquivoValido);
    if (aceitos.length === 0) return;

    // Sequencial, e não Promise.all: dez arquivos de 10 MB em paralelo seguram
    // os dois lados na memória ao mesmo tempo, do browser ao container.
    let enviados = 0;
    try {
      for (const arquivo of aceitos) {
        setEnviando(arquivo.name);
        await Api.enviarDocumento(lead.id, pastaSelecionada, arquivo);
        enviados += 1;
      }
      showToast('Documento anexado', 'success',
        `${enviados} arquivo(s) em ${pastaAtual?.nome ?? 'pasta'}.`);
    } catch (erro) {
      showToast('Falha ao enviar', 'error', (erro as Error).message);
    } finally {
      setEnviando(null);
      // Mesmo com erro no meio: o que já subiu precisa aparecer.
      await carregarPastas();
      onReloadLead();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await enviarArquivos(files);
    // Zera o input: sem isso, reenviar o mesmo arquivo não dispara onChange.
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (!podeAnexar) return;
    await enviarArquivos(e.dataTransfer.files);
  };

  const handleDownloadDoc = async (docId: string, nome: string) => {
    try {
      // A rota exige Authorization, então um <a href> direto viria 401: os
      // bytes chegam por fetch e viram object URL por um clique sintético.
      const blob = await Api.baixarDocumento(lead.id, docId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (erro) {
      showToast('Não foi possível baixar', 'error', (erro as Error).message);
    }
  };

  const handleDeleteDoc = async (docId: string, nome: string) => {
    if (!window.confirm(`Excluir o arquivo "${nome}"?`)) return;
    try {
      await Api.excluirDocumento(lead.id, docId);
      showToast('Arquivo excluído', 'info', `${nome} removido da pasta.`);
      await carregarPastas();
      onReloadLead();
    } catch (erro) {
      showToast('Não foi possível excluir', 'error', (erro as Error).message);
    }
  };

  const handleNovaPasta = async () => {
    const nome = window.prompt('Nome da nova pasta:')?.trim();
    if (!nome) return;
    try {
      await Api.criarPastaDocumento(nome);
      showToast('Pasta criada', 'success', `"${nome}" disponível para todos os leads.`);
      await carregarPastas();
    } catch (erro) {
      showToast('Não foi possível criar a pasta', 'error', (erro as Error).message);
    }
  };

  const handleAddContato = async () => {
    const descricao = novaInteracao.trim();
    if (!descricao || salvandoContato) return;

    setSalvandoContato(true);
    try {
      // Api.registrarInteracao e POST /api/leads/:id/historico já existiam e
      // nunca tinham sido chamados: a tela montava o item em memória e ele
      // sumia no F5.
      await Api.registrarInteracao(lead.id, descricao);
      setNovaInteracao('');
      setIsRegistrarContatoOpen(false);
      showToast('Interação registrada', 'success', 'Novo contato adicionado ao histórico.');
      onReloadLead();
    } catch (erro) {
      showToast('Não foi possível registrar', 'error', (erro as Error).message);
    } finally {
      setSalvandoContato(false);
    }
  };

  const handleAvancarEtapa = () => {
    // Ordem vem de STAGES (LeadsKanbanView) — a cópia local que existia aqui
    // saía de sincronia com o kanban a cada mudança no funil.
    const currentIndex = STAGES.indexOf(lead.etapa);
    if (currentIndex < STAGES.length - 1) {
      const nextStage = STAGES[currentIndex + 1];
      onUpdateLeadStage(lead.id, nextStage);
      showToast('Etapa atualizada', 'success', `Lead movido para "${nextStage}".`);
    } else {
      showToast('Status máximo', 'info', 'Lead já se encontra na etapa final (Fechado).');
    }
  };

  const handleDelete = () => {
    if (!window.confirm(`Excluir o lead "${lead.nome}"? Essa ação não pode ser desfeita.`)) return;
    onDeleteLead(lead.id);
    showToast('Lead excluído', 'info', `${lead.nome} removido.`);
  };

  // Filtra por pastaId, e não pelo nome: renomear uma pasta no banco deixaria
  // os arquivos órfãos numa comparação de string.
  const currentFolderDocs = (lead.documentos || []).filter(d => d.pastaId === pastaSelecionada);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-[#004276]">{lead.nome}</h1>
              <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1 rounded-full text-xs">
                {lead.etapa}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Lead {lead.numero} · criado em {lead.dataCriacao} · responsável {lead.responsavel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsEditOpen(true)}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition flex items-center gap-1.5"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-bold rounded-xl text-sm transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          <button
            onClick={() => setIsRegistrarContatoOpen(true)}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition"
          >
            Registrar contato
          </button>
          <button
            onClick={handleAvancarEtapa}
            className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition"
          >
            Avançar etapa
          </button>
        </div>
      </div>

      {/* Main Grid: Left Details Panel (1/3) & Right Content Tabs (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL */}
        <div className="space-y-6">
          {/* Card Dados do cliente */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-[#004276] text-base border-b pb-2">Dados do cliente</h3>

            {/*
              Ligar / WhatsApp / rota logo no topo: é o que o vendedor faz com
              esta tela quando está em campo. Antes o telefone era só texto para
              copiar à mão.
            */}
            <AcoesContato
              telefone={lead.telefone}
              endereco={[lead.endereco, lead.cidade]}
              mensagemWhatsApp={`Olá, ${lead.nome.split(' ')[0]}! Aqui é da Solar Costa.`}
            />

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase">CPF / CNPJ</span>
                <p className="font-bold text-slate-900">{lead.cpfCnpj || '—'}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">TELEFONE</span>
                <p className="font-bold text-slate-900">{lead.telefone || '—'}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">E-MAIL</span>
                <p className="font-medium text-slate-800 truncate">{lead.email || '—'}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">ENDEREÇO DA INSTALAÇÃO</span>
                <p className="font-medium text-slate-800 leading-relaxed">{lead.endereco || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="font-bold text-slate-400 uppercase">CONSUMO MÉDIO</span>
                  <p className="font-extrabold text-slate-900 text-sm">{lead.consumoKwh.toLocaleString('pt-BR')} kWh</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase">CONCESSIONÁRIA</span>
                  <p className="font-bold text-slate-900">{lead.concessionaria}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-bold text-slate-400 uppercase">TELHADO</span>
                  <p className="font-bold text-slate-900">{lead.telhado}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase">ORIGEM</span>
                  <p className="font-bold text-slate-900">{lead.origem}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dark Blue Box "PROPOSTA VINCULADA" */}
          <div className="bg-[#004276] text-white p-5 rounded-2xl shadow-md space-y-4">
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block">
              PROPOSTA VINCULADA
            </span>
            
            <div>
              <p className="text-xs text-blue-100 font-semibold">
                {linkedProposal
                  ? `nº ${linkedProposal.numero} · ${linkedProposal.potenciaKwp} kWp`
                  : 'nenhuma proposta emitida'}
              </p>
              <h2 className="text-3xl font-black text-white mt-0.5">
                {linkedProposal
                  ? `R$ ${linkedProposal.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : '—'}
              </h2>
              <p className="text-xs text-blue-200 mt-1 font-medium">
                {linkedProposal?.formaPagamento === 'financiamento' && linkedProposal.parcelasFinanciamento
                  ? `${linkedProposal.parcelasFinanciamento}x` +
                    (linkedProposal.entradaFinanciamentoPct
                      ? ` · entrada ${linkedProposal.entradaFinanciamentoPct}%`
                      : '')
                  : linkedProposal?.formaPagamento === 'cartao' && linkedProposal.parcelasCartao
                    ? `${linkedProposal.parcelasCartao}x no cartão`
                    : linkedProposal
                      ? 'Pagamento à vista'
                      : 'Emita uma proposta para este lead'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  if (linkedProposal) {
                    onOpenPDF('proposta', linkedProposal);
                  } else {
                    onNavigateToProposal(lead.id);
                  }
                }}
                className="w-full bg-blue-900/80 hover:bg-blue-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs border border-blue-700 transition"
              >
                Ver proposta
              </button>
              <button
                onClick={() => onNavigateToContract(lead.id)}
                className="w-full bg-[#FFD100] hover:bg-amber-400 text-[#004276] font-bold py-2.5 px-3 rounded-xl text-xs transition shadow"
              >
                Gerar contrato
              </button>
            </div>
          </div>

          {/* Últimas interações Timeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-[#004276] text-sm border-b pb-2">Últimas interações</h3>
            
            <div className="space-y-3">
              {lead.historico && lead.historico.length > 0 ? (
                lead.historico.map((hist) => (
                  <div key={hist.id} className="flex items-start gap-2.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">{hist.descricao}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{hist.data} · {hist.usuario}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhuma interação registrada ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT AREA (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs header */}
          <div className="bg-white p-1 rounded-2xl border border-slate-200 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('documentos')}
              className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-bold transition ${
                activeTab === 'documentos'
                  ? 'bg-[#004276] text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Documentos ({(lead.documentos || []).length})
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-bold transition ${
                activeTab === 'historico'
                  ? 'bg-[#004276] text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('propostas')}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-bold transition ${
                activeTab === 'propostas'
                  ? 'bg-[#004276] text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Propostas ({propostas.filter(p => p.leadId === lead.id).length || 1})
            </button>
            <button
              onClick={() => setActiveTab('contratos')}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-bold transition ${
                activeTab === 'contratos'
                  ? 'bg-[#004276] text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Contratos ({contratos.filter(c => c.leadId === lead.id).length || (linkedContract ? 1 : 0)})
            </button>
            <button
              onClick={() => setActiveTab('financeiro')}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-bold transition ${
                activeTab === 'financeiro'
                  ? 'bg-[#004276] text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Financeiro
            </button>
          </div>

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'documentos' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Pastas do cliente</h3>
                  <p className="text-xs text-slate-500">
                    {totalArquivos === 1 ? '1 arquivo armazenado' : `${totalArquivos} arquivos armazenados`}
                  </p>
                </div>
                {/* Pasta é global: criar uma muda a tela de TODO lead. Por isso
                    só o Administrador vê o botão — ver documentos.routes.ts. */}
                {ehAdministrador && (
                  <button
                    onClick={handleNovaPasta}
                    className="text-xs font-bold text-[#004276] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Nova pasta</span>
                  </button>
                )}
              </div>

              {/* Folder Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pastas.map((pasta) => {
                  const isSelected = pastaSelecionada === pasta.id;
                  return (
                    <button
                      key={pasta.id}
                      onClick={() => setPastaSelecionada(pasta.id)}
                      className={`p-3.5 rounded-xl text-left border transition flex flex-col justify-between h-24 ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#004276] ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className={`w-5 h-5 ${isSelected ? 'text-[#004276] fill-[#FFD100]' : 'text-amber-500'}`} />
                        <span className="font-bold text-xs text-slate-900 line-clamp-1">{pasta.nome}</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">
                          {pasta.qtdArquivos === 1 ? '1 arquivo' : `${pasta.qtdArquivos} arquivos`}
                        </p>
                        <p className="text-[9px] text-slate-400">{pasta.ultimoEnvio ?? '—'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Folder Files Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 text-sm">{pastaAtual?.nome ?? 'Pastas'}</h4>
                  {podeAnexar && (
                    <label
                      className={`bg-[#004276] text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                        enviando ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-[#003159]'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{enviando ? 'Enviando…' : '+ Enviar arquivo'}</span>
                      <input
                        type="file"
                        multiple
                        accept={ACCEPT}
                        disabled={!!enviando || pastaSelecionada == null}
                        onChange={handleUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="tabela-mobile w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="p-3">Arquivo</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Tamanho</th>
                        <th className="p-3">Enviado por</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentFolderDocs.length > 0 ? (
                        currentFolderDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50">
                            <td data-label="Arquivo" className="p-3 font-semibold text-slate-900">{doc.nome}</td>
                            <td data-label="Tipo" className="p-3">
                              <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded text-[10px]">
                                {doc.tipo}
                              </span>
                            </td>
                            <td data-label="Tamanho" className="p-3 text-slate-500">{doc.tamanho}</td>
                            <td data-label="Enviado por" className="p-3 text-slate-600">{doc.enviadoPor} - {doc.dataEnvio}</td>
                            <td data-label="Ações" className="p-3 text-right font-bold space-x-2">
                              <button
                                onClick={() => void handleDownloadDoc(doc.id, doc.nome)}
                                className="text-blue-600 hover:underline"
                              >
                                Baixar
                              </button>
                              {podeAnexar && (
                                <button
                                  onClick={() => void handleDeleteDoc(doc.id, doc.nome)}
                                  className="text-rose-600 hover:underline"
                                >
                                  Excluir
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            {podeAnexar
                              ? 'Nenhum arquivo nesta pasta. Arraste ou clique em enviar arquivo abaixo.'
                              : 'Nenhum arquivo nesta pasta.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dropzone — agora com onDrop de verdade. Antes era só um label
                  com input escondido: arrastar um arquivo aqui fazia o browser
                  abri-lo numa aba nova. */}
              {podeAnexar && (
                <label
                  onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(e) => void handleDrop(e)}
                  className={`border-2 border-dashed p-8 rounded-2xl text-center block transition ${
                    enviando
                      ? 'border-slate-300 bg-slate-100 cursor-wait'
                      : arrastando
                        ? 'border-[#004276] bg-blue-50 cursor-copy'
                        : 'border-slate-300 hover:border-[#004276] bg-slate-50 hover:bg-blue-50/50 cursor-pointer'
                  }`}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${arrastando ? 'text-[#004276]' : 'text-slate-400'}`} />
                  <p className="font-bold text-slate-800 text-sm">
                    {enviando ? `Enviando ${enviando}…` : 'Arraste arquivos aqui para enviar'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PDF, JPG, PNG, WEBP, DWG, XLS(X) ou DOC(X) · até 10 MB por arquivo
                  </p>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    disabled={!!enviando || pastaSelecionada == null}
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* TAB: HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Histórico de interações</h3>
                <button
                  onClick={() => setIsRegistrarContatoOpen(true)}
                  className="bg-[#004276] text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#003159]"
                >
                  + Nova interação
                </button>
              </div>

              <div className="space-y-4">
                {lead.historico.map((h) => (
                  <div key={h.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-[#004276] font-bold flex items-center justify-center text-xs shrink-0">
                      {h.usuario.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{h.descricao}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Registrado em {h.data} por {h.usuario}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PROPOSTAS */}
          {activeTab === 'propostas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Propostas comerciais vinculadas</h3>
                <button
                  onClick={() => onNavigateToProposal(lead.id)}
                  className="bg-[#004276] text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  + Nova proposta
                </button>
              </div>

              {propostas.filter(p => p.leadId === lead.id || p.id === lead.propostaVinculadaId).map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-blue-300">
                  <div>
                    <h4 className="font-bold text-[#004276] text-base">Proposta nº {p.numero}</h4>
                    <p className="text-xs text-slate-500">{p.potenciaKwp} kWp · {p.modulosQtd} módulos · Geração {p.geracaoMediaKwh} kWh/mês</p>
                    <p className="text-xs text-slate-400 mt-1">Criada em {p.dataCriacao} · Status: {p.status}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-xl font-extrabold text-[#004276]">R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <button
                      onClick={() => onOpenPDF('proposta', p)}
                      className="bg-blue-50 text-[#004276] border border-blue-200 hover:bg-blue-100 font-bold px-3 py-1 rounded-lg text-xs"
                    >
                      Abrir PDF Proposta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: CONTRATOS */}
          {activeTab === 'contratos' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Contratos de prestação de serviço</h3>
                <button
                  onClick={() => onNavigateToContract(lead.id)}
                  className="bg-[#004276] text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  + Emitir contrato
                </button>
              </div>

              {(linkedContract || contratos.find(c => c.leadId === lead.id)) ? (
                (() => {
                  const c = linkedContract || contratos.find(c => c.leadId === lead.id)!;
                  return (
                    <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-blue-300">
                      <div>
                        <h4 className="font-bold text-[#004276] text-base">Contrato nº {c.numero}</h4>
                        <p className="text-xs text-slate-500">{c.potenciaKwp} kWp · {c.modulosQtd} módulos · {c.formaPagamento}</p>
                        <p className="text-xs text-slate-400 mt-1">Emissão {c.dataEmissao} · Status: {c.status}</p>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-xl font-extrabold text-[#004276]">R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <button
                          onClick={() => onOpenPDF('contrato', c)}
                          className="bg-blue-50 text-[#004276] border border-blue-200 hover:bg-blue-100 font-bold px-3 py-1 rounded-lg text-xs"
                        >
                          Visualizar Contrato PDF
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhum contrato gerado para este cliente ainda.</p>
              )}
            </div>
          )}

          {/* TAB: FINANCEIRO */}
          {activeTab === 'financeiro' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base">Boletos e parcelas do cliente</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="tabela-mobile w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                      <th className="p-3">Documento</th>
                      <th className="p-3">Parcela</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientBoletos.length > 0 ? (
                      clientBoletos.map((bol) => (
                        <tr key={bol.id} className="hover:bg-slate-50">
                          <td data-label="Documento" className="p-3 font-mono text-slate-700">{bol.numeroDocumento.slice(0, 15)}...</td>
                          <td data-label="Parcela" className="p-3 font-bold">{bol.parcela}</td>
                          <td data-label="Valor" className="p-3 font-bold text-slate-900">R$ {bol.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td data-label="Vencimento" className="p-3">{bol.vencimento}</td>
                          <td data-label="Situação" className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              bol.situacao === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {bol.situacao === 'pago' ? 'Pago' : 'Em aberto'}
                            </span>
                          </td>
                          <td data-label="Ação" className="p-3 text-right">
                            <button
                              onClick={() => onOpenPDF('boleto', bol)}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              Ver Boleto BB
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                          Nenhum boleto gerado ainda para este cliente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Registrar Contato */}
      {isRegistrarContatoOpen && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <ModalCabecalho
              icone={MessageSquare}
              titulo="Registrar novo contato"
              subtitulo={lead.nome}
              onFechar={() => setIsRegistrarContatoOpen(false)}
            />
            <div className="modal-corpo campos-modal p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Descrição da Interação
                </label>
                <textarea
                  rows={4}
                  value={novaInteracao}
                  onChange={(e) => setNovaInteracao(e.target.value)}
                  placeholder="Ex: Reunião realizada com o cliente. Apresentada proposta comercial nº 2026-0184..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div className="rodape-modal barra-acoes text-xs">
                <button
                  type="button"
                  onClick={() => setIsRegistrarContatoOpen(false)}
                  className="btn-modal-cancelar"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddContato()}
                  disabled={salvandoContato || !novaInteracao.trim()}
                  className="btn-modal-salvar"
                >
                  {salvandoContato ? 'Salvando…' : 'Salvar histórico'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Lead */}
      {isEditOpen && (
        <LeadFormModal
          lead={lead}
          users={users}
          currentUser={currentUser}
          onClose={() => setIsEditOpen(false)}
          onUpdateLead={onUpdateLead}
          showToast={showToast}
        />
      )}
    </div>
  );
};
