import React, { useState } from 'react';
import { 
  ArrowLeft, FileText, Upload, Folder, Download, Trash2, Plus, 
  MessageSquare, FileCheck, DollarSign, Calendar, ChevronRight, CheckCircle2, X 
} from 'lucide-react';
import { Lead, LeadStage, DocumentoItem, Proposta, Contrato, Boleto, User } from '../types';

interface LeadDetailViewProps {
  lead: Lead;
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
}

export const LeadDetailView: React.FC<LeadDetailViewProps> = ({
  lead,
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
  onUpdateLead
}) => {
  const [activeTab, setActiveTab] = useState<'documentos' | 'historico' | 'propostas' | 'contratos' | 'financeiro'>('documentos');
  const [selectedFolder, setSelectedFolder] = useState<string>('Documentos pessoais');
  const [novaInteracao, setNovaInteracao] = useState('');
  const [isRegistrarContatoOpen, setIsRegistrarContatoOpen] = useState(false);

  // Linked proposal details
  const linkedProposal = propostas.find(p => p.leadId === lead.id || p.id === lead.propostaVinculadaId);
  const linkedContract = contratos.find(c => c.leadId === lead.id);
  const clientBoletos = boletos.filter(b => b.clienteNome.toLowerCase().includes(lead.nome.toLowerCase()));

  // Folders list
  const folderNames = [
    { name: 'Documentos pessoais', count: 4, date: '22/07/2026' },
    { name: 'Conta de energia', count: 12, date: '18/07/2026' },
    { name: 'Proposta assinada', count: 2, date: '24/07/2026' },
    { name: 'Contrato', count: 1, date: '26/07/2026' },
    { name: 'Projeto e ART', count: 5, date: '27/07/2026' },
    { name: 'Fotos do local / telhado', count: 18, date: '12/07/2026' },
    { name: 'Financiamento / banco', count: 6, date: '28/07/2026' },
  ];

  const handleUploadSimulate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: DocumentoItem[] = (Array.from(files) as File[]).map((f, index) => ({
      id: `doc-${Date.now()}-${index}`,
      nome: f.name,
      pasta: selectedFolder,
      tipo: f.name.split('.').pop()?.toUpperCase() || 'PDF',
      tamanho: `${(f.size / 1024).toFixed(0)} KB`,
      enviadoPor: currentUser.nome,
      dataEnvio: new Date().toLocaleDateString('pt-BR')
    }));

    const updatedLead = {
      ...lead,
      documentos: [...(lead.documentos || []), ...newDocs]
    };

    onUpdateLead(updatedLead);
    showToast('Documento anexado', 'success', `${files.length} arquivo(s) adicionado(s) em ${selectedFolder}.`);
  };

  const handleDeleteDoc = (docId: string) => {
    const updatedDocs = (lead.documentos || []).filter(d => d.id !== docId);
    onUpdateLead({ ...lead, documentos: updatedDocs });
    showToast('Arquivo excluído', 'info', 'Documento removido da pasta.');
  };

  const handleAddContato = () => {
    if (!novaInteracao.trim()) return;

    const newHist = {
      id: `h-${Date.now()}`,
      data: new Date().toLocaleDateString('pt-BR'),
      descricao: novaInteracao.trim(),
      usuario: currentUser.nome
    };

    const updatedLead = {
      ...lead,
      historico: [newHist, ...(lead.historico || [])]
    };

    onUpdateLead(updatedLead);
    setNovaInteracao('');
    setIsRegistrarContatoOpen(false);
    showToast('Interação registrada', 'success', 'Novo contato adicionado ao histórico.');
  };

  const handleAvancarEtapa = () => {
    const stages: LeadStage[] = [
      'Novo lead', 'Contato feito', 'Visita técnica', 'Proposta enviada', 'Negociação', 'Fechado'
    ];
    const currentIndex = stages.indexOf(lead.etapa);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      onUpdateLeadStage(lead.id, nextStage);
      showToast('Etapa atualizada', 'success', `Lead movido para "${nextStage}".`);
    } else {
      showToast('Status máximo', 'info', 'Lead já se encontra na etapa final (Fechado).');
    }
  };

  const currentFolderDocs = (lead.documentos || []).filter(d => d.pasta === selectedFolder);

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

        <div className="flex items-center gap-3">
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
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase">CPF / CNPJ</span>
                <p className="font-bold text-slate-900">{lead.cpfCnpj}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">TELEFONE</span>
                <p className="font-bold text-slate-900">{lead.telefone}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">E-MAIL</span>
                <p className="font-medium text-slate-800 truncate">{lead.email}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">ENDEREÇO DA INSTALAÇÃO</span>
                <p className="font-medium text-slate-800 leading-relaxed">{lead.endereco}</p>
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
                nº {linkedProposal ? linkedProposal.numero : '2026-0184'} · {linkedProposal ? `${linkedProposal.potenciaKwp} kWp` : '8,52 kWp'}
              </p>
              <h2 className="text-3xl font-black text-white mt-0.5">
                R$ {linkedProposal ? linkedProposal.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '22.490,00'}
              </h2>
              <p className="text-xs text-blue-200 mt-1 font-medium">
                60x de R$ 486,60 - entrada 10%
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
                  <p className="text-xs text-slate-500">48 arquivos armazenados na nuvem</p>
                </div>
                <button
                  onClick={() => showToast('Nova pasta', 'info', 'Criar nova pasta de arquivos.')}
                  className="text-xs font-bold text-[#004276] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nova pasta</span>
                </button>
              </div>

              {/* Folder Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {folderNames.map((folder) => {
                  const isSelected = selectedFolder === folder.name;
                  return (
                    <button
                      key={folder.name}
                      onClick={() => setSelectedFolder(folder.name)}
                      className={`p-3.5 rounded-xl text-left border transition flex flex-col justify-between h-24 ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#004276] ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className={`w-5 h-5 ${isSelected ? 'text-[#004276] fill-[#FFD100]' : 'text-amber-500'}`} />
                        <span className="font-bold text-xs text-slate-900 line-clamp-1">{folder.name}</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">{folder.count} arquivos</p>
                        <p className="text-[9px] text-slate-400">{folder.date}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Folder Files Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 text-sm">{selectedFolder}</h4>
                  <label className="cursor-pointer bg-[#004276] hover:bg-[#003159] text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Enviar arquivo</span>
                    <input type="file" multiple onChange={handleUploadSimulate} className="hidden" />
                  </label>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
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
                            <td className="p-3 font-semibold text-slate-900">{doc.nome}</td>
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded text-[10px]">
                                {doc.tipo}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500">{doc.tamanho}</td>
                            <td className="p-3 text-slate-600">{doc.enviadoPor} - {doc.dataEnvio}</td>
                            <td className="p-3 text-right font-bold space-x-2">
                              <button
                                onClick={() => showToast('Download iniciado', 'info', `Baixando ${doc.nome}...`)}
                                className="text-blue-600 hover:underline"
                              >
                                Baixar
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="text-rose-600 hover:underline"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            Nenhum arquivo nesta pasta. Arraste ou clique em enviar arquivo abaixo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dropzone Container */}
              <label className="border-2 border-dashed border-slate-300 hover:border-[#004276] bg-slate-50 hover:bg-blue-50/50 p-8 rounded-2xl text-center block cursor-pointer transition">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-sm">Arraste arquivos aqui para enviar</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG, DWG ou XLSX · até 25 MB por arquivo</p>
                <input type="file" multiple onChange={handleUploadSimulate} className="hidden" />
              </label>
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
                <table className="w-full text-left text-xs">
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
                          <td className="p-3 font-mono text-slate-700">{bol.numeroDocumento.slice(0, 15)}...</td>
                          <td className="p-3 font-bold">{bol.parcela}</td>
                          <td className="p-3 font-bold text-slate-900">R$ {bol.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3">{bol.vencimento}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              bol.situacao === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {bol.situacao === 'pago' ? 'Pago' : 'Em aberto'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Registrar Novo Contato</h3>
              <button onClick={() => setIsRegistrarContatoOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
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

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsRegistrarContatoOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddContato}
                  className="px-4 py-2 bg-[#004276] text-white rounded-xl text-xs font-bold shadow"
                >
                  Salvar Histórico
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
