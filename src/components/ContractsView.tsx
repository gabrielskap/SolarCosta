import React, { useState, useMemo } from 'react';
import { CheckCircle2, FileText, Plus, MessageCircle, Search, X, Trash2, AlertTriangle, PencilLine, Eye, Settings2 } from 'lucide-react';
import { Contrato, Lead, Proposta, User } from '../types';
import { type ConfigApp } from '../services/api';
import { EnviarPorWhatsApp } from './whatsapp/EnviarPorWhatsApp';
import { EditorContrato } from './contrato/EditorContrato';
import { PadroesContrato } from './contrato/PadroesContrato';
import { hojeISO } from '../contrato/padroes';
import { rascunhoDeContrato } from '../contrato/rascunho';

interface ContractsViewProps {
  contratos: Contrato[];
  leads: Lead[];
  /** Propostas disponíveis para gerar o contrato a partir do dimensionamento. */
  propostas?: Proposta[];
  /** Empresa, parâmetros e domínios vindos do banco. */
  config: ConfigApp | null;
  /** Salva e devolve o contrato gravado — o editor continua com id e número. */
  onSalvarContrato: (contrato: Contrato) => Promise<Contrato>;
  /** `data` em AAAA-MM-DD. */
  onAssinarContrato: (contratoId: string, data: string) => Promise<void>;
  onDeleteContract?: (contratoId: string) => Promise<void> | void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  /** Padrões do contrato salvos: empresa e parâmetros novos. */
  onConfigAlterada?: (config: ConfigApp) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

type Aba = 'lista' | 'editor' | 'padroes';

export const ContractsView: React.FC<ContractsViewProps> = ({
  contratos,
  leads,
  propostas = [],
  config,
  onSalvarContrato,
  onAssinarContrato,
  onDeleteContract,
  onOpenPDF,
  onConfigAlterada,
  currentUser,
  showToast
}) => {
  const [aba, setAba] = useState<Aba>('lista');

  /**
   * Contrato aberto no editor; null com o editor aberto = contrato novo. A
   * `chaveEditor` remonta o editor a cada abertura, para um contrato novo não
   * herdar o estado do anterior.
   */
  const [emEdicao, setEmEdicao] = useState<Contrato | null>(null);
  const [chaveEditor, setChaveEditor] = useState(0);

  /** Contrato escolhido para envio; null com o modal fechado. */
  const [enviando, setEnviando] = useState<Contrato | null>(null);

  /** Contrato selecionado para confirmação de exclusão */
  const [contratoParaExcluir, setContratoParaExcluir] = useState<Contrato | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  /** Confirmação de assinatura: trava o contrato, então pede a data e confirma. */
  const [contratoParaAssinar, setContratoParaAssinar] = useState<Contrato | null>(null);
  const [dataAssinatura, setDataAssinatura] = useState(hojeISO());
  const [assinando, setAssinando] = useState(false);

  /** Filtros de busca e status da lista */
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | Contrato['status']>('todos');
  const [pagamentoFiltro, setPagamentoFiltro] = useState<string>('todos');

  const ehAdmin = currentUser.cargo === 'Administrador';
  const podeEnviarWhatsApp = ehAdmin || !!currentUser.permissoes?.usarWhatsapp;
  const podeEmitir = ehAdmin || !!currentUser.permissoes?.emitirContratos;
  const podeExcluir = podeEmitir;
  // Mesma permissão que PATCH /api/config/empresa e /parametros exigem.
  const podeEditarPadroes = ehAdmin || !!currentUser.permissoes?.gerenciarUsuarios;

  const normalizarBusca = (texto: string) =>
    (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const contratosFiltrados = useMemo(() => {
    const termo = normalizarBusca(termoBusca.trim());
    return contratos.filter((c) => {
      if (statusFiltro !== 'todos' && c.status !== statusFiltro) return false;
      if (pagamentoFiltro !== 'todos') {
        if (pagamentoFiltro === 'sem_cobranca' && c.situacaoPagamento) return false;
        if (pagamentoFiltro !== 'sem_cobranca' && c.situacaoPagamento !== pagamentoFiltro) return false;
      }
      if (!termo) return true;
      const alvo = normalizarBusca(
        `${c.numero || ''} ${c.clienteNome || ''} ${c.cpfCnpj || ''} ${c.telefone || ''} ${c.endereco || ''} ${c.localInstalacao || ''} ${c.bancoAgente || ''}`
      );
      return alvo.includes(termo);
    });
  }, [contratos, termoBusca, statusFiltro, pagamentoFiltro]);

  const aguardandoAssinatura = contratos.filter((c) => c.status === 'aguardando').length;
  const valorTotalFiltrado = contratosFiltrados.reduce((acc, c) => acc + (c.valorTotal || 0), 0);

  const abrirEditor = (contrato: Contrato | null) => {
    setEmEdicao(contrato);
    setChaveEditor((k) => k + 1);
    setAba('editor');
  };

  const confirmarExclusao = async () => {
    if (!contratoParaExcluir || !onDeleteContract) return;
    try {
      setExcluindo(true);
      await onDeleteContract(contratoParaExcluir.id);
      setContratoParaExcluir(null);
    } catch {
      showToast('Erro ao excluir', 'error', 'Não foi possível excluir o contrato.');
    } finally {
      setExcluindo(false);
    }
  };

  const pedirAssinatura = (c: Contrato) => {
    setDataAssinatura(hojeISO());
    setContratoParaAssinar(c);
  };

  const confirmarAssinatura = async () => {
    if (!contratoParaAssinar) return;
    try {
      setAssinando(true);
      // Contrato legado (anterior ao modelo Solar Costa) é exibido e impresso
      // no modelo novo enquanto não é assinado. Gravar essa conversão antes de
      // assinar é o que faz o documento assinado ser o mesmo que se viu.
      if (!contratoParaAssinar.termos) {
        await onSalvarContrato(rascunhoDeContrato(contratoParaAssinar, config));
      }
      await onAssinarContrato(contratoParaAssinar.id, dataAssinatura);
      const assinado = contratoParaAssinar;
      setContratoParaAssinar(null);
      // Assinado no editor: volta para a lista, onde ele aparece travado.
      if (aba === 'editor' && emEdicao?.id === assinado.id) setAba('lista');
    } catch {
      // O App já mostrou o erro.
    } finally {
      setAssinando(false);
    }
  };

  return (
    <div className="space-y-6">
      {aba === 'editor' ? (
        <EditorContrato
          key={chaveEditor}
          inicial={emEdicao}
          propostas={propostas}
          leads={leads}
          config={config}
          podeEditar={podeEmitir}
          podeEnviar={podeEnviarWhatsApp}
          onSalvar={async (c) => {
            const salvo = await onSalvarContrato(c);
            setEmEdicao(salvo);
            return salvo;
          }}
          onAssinar={pedirAssinatura}
          onAbrirPDF={(c) => onOpenPDF('contrato', c)}
          onEnviar={setEnviando}
          onVoltar={() => setAba('lista')}
          showToast={showToast}
        />
      ) : (
        <>
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-[#004276]">
                {aba === 'lista' ? 'Contratos' : 'Padrões do contrato'}
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {aba === 'lista' ? (
                  <>
                    {contratosFiltrados.length}{' '}
                    {contratosFiltrados.length === 1 ? 'contrato listado' : 'contratos listados'}
                    {contratosFiltrados.length !== contratos.length && ` (de ${contratos.length})`}
                    {' · '}
                    R$ {valorTotalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {' · '}
                    {aguardandoAssinatura} aguardando assinatura
                  </>
                ) : (
                  'Dados da Solar Costa, prazos, multas e garantias que todo contrato novo traz preenchidos.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAba('lista')}
                  className={`px-3 py-1.5 rounded-lg transition ${aba === 'lista' ? 'bg-[#004276] text-white' : 'text-slate-600 hover:text-[#004276]'}`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setAba('padroes')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${aba === 'padroes' ? 'bg-[#004276] text-white' : 'text-slate-600 hover:text-[#004276]'}`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Padrões do contrato
                </button>
              </div>
              {podeEmitir && (
                <button
                  onClick={() => abrirEditor(null)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar novo contrato
                </button>
              )}
            </div>
          </div>

          {aba === 'padroes' ? (
            <PadroesContrato
              config={config}
              podeEditar={podeEditarPadroes}
              onConfigAlterada={(c) => onConfigAlterada?.(c)}
              showToast={showToast}
            />
          ) : (
            /* LIST OF EMITTED CONTRACTS */
            <div className="space-y-4">
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Campo de Busca */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Buscar por cliente, nº do contrato, CPF/CNPJ, telefone, cidade..."
                    className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#004276] focus:ring-1 focus:ring-[#004276] shadow-sm transition"
                  />
                  {termoBusca && (
                    <button
                      type="button"
                      onClick={() => setTermoBusca('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtro por Status e Pagamento */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFiltro}
                    onChange={(e) => setStatusFiltro(e.target.value as 'todos' | Contrato['status'])}
                    className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#004276] shadow-sm"
                  >
                    <option value="todos">Status: Todos</option>
                    <option value="aguardando">Status: Aguardando assinatura</option>
                    <option value="assinado">Status: Assinado</option>
                  </select>

                  <select
                    value={pagamentoFiltro}
                    onChange={(e) => setPagamentoFiltro(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#004276] shadow-sm"
                  >
                    <option value="todos">Pagamento: Todos</option>
                    <option value="pago">Pagamento: Pago</option>
                    <option value="aguardando">Pagamento: Aguardando</option>
                    <option value="vencido">Pagamento: Vencido</option>
                    <option value="sem_cobranca">Pagamento: Sem cobrança</option>
                  </select>

                  {(termoBusca || statusFiltro !== 'todos' || pagamentoFiltro !== 'todos') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTermoBusca('');
                        setStatusFiltro('todos');
                        setPagamentoFiltro('todos');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-2 rounded-lg hover:bg-slate-100 transition whitespace-nowrap"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-base">Contratos cadastrados</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="tabela-mobile w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                        <th className="p-3">Contrato</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Potência</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Pagamento</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contratosFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500">
                            {contratos.length === 0
                              ? 'Nenhum contrato cadastrado. Clique em “Cadastrar novo contrato” para começar.'
                              : 'Nenhum contrato encontrado para os filtros aplicados.'}
                          </td>
                        </tr>
                      )}
                      {contratosFiltrados.map((c) => {
                        const assinado = c.status === 'assinado';
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td data-label="Contrato" className="p-3 font-bold text-[#004276]">Nº {c.numero}</td>
                            <td data-label="Cliente" className="p-3 font-semibold text-slate-900">{c.clienteNome}</td>
                            <td data-label="Potência" className="p-3">{c.potenciaKwp} kWp</td>
                            <td data-label="Valor" className="p-3 font-bold text-slate-900">R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td data-label="Data" className="p-3 text-slate-500">{c.dataEmissao}</td>
                            <td data-label="Status" className="p-3">
                              {assinado ? (
                                <span
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800"
                                  title={c.dataAssinatura ? `Assinado em ${c.dataAssinatura}` : undefined}
                                >
                                  Assinado{c.dataAssinatura ? ` · ${c.dataAssinatura}` : ''}
                                </span>
                              ) : podeEmitir ? (
                                <button
                                  type="button"
                                  onClick={() => pedirAssinatura(c)}
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  title="Marcar como assinado"
                                >
                                  Aguardando assinatura
                                </button>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Aguardando assinatura
                                </span>
                              )}
                            </td>
                            <td data-label="Pagamento" className="p-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  c.situacaoPagamento === 'pago'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : c.situacaoPagamento === 'vencido'
                                    ? 'bg-red-100 text-red-800'
                                    : c.situacaoPagamento === 'aguardando'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {c.situacaoPagamento === 'pago'
                                  ? 'Pago'
                                  : c.situacaoPagamento === 'vencido'
                                  ? 'Pagamento vencido'
                                  : c.situacaoPagamento === 'aguardando'
                                  ? 'Aguardando pagamento'
                                  : 'Sem cobrança'}
                              </span>
                            </td>
                            <td data-label="Ações" className="p-3 text-right font-bold space-x-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => abrirEditor(c)}
                                className="text-[#004276] hover:underline inline-flex items-center gap-1"
                              >
                                {assinado || !podeEmitir ? <Eye className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
                                {assinado || !podeEmitir ? 'Ver' : 'Editar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenPDF('contrato', c)}
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                PDF
                              </button>
                              {podeEnviarWhatsApp && (
                                <button
                                  type="button"
                                  onClick={() => setEnviando(c)}
                                  className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  Enviar
                                </button>
                              )}
                              {podeExcluir && onDeleteContract && (
                                <button
                                  type="button"
                                  onClick={() => setContratoParaExcluir(c)}
                                  className="text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1"
                                  title="Excluir contrato"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {enviando && (
        <EnviarPorWhatsApp
          referencia={{ tipo: 'contrato', id: enviando.id }}
          clienteNome={enviando.clienteNome}
          telefoneSugerido={enviando.telefone}
          leadId={enviando.leadId || null}
          onFechar={() => setEnviando(null)}
          showToast={showToast}
        />
      )}

      {/* Confirmação de assinatura */}
      {contratoParaAssinar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-assinar-contrato"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="titulo-assinar-contrato" className="text-lg font-bold text-slate-900">Marcar como assinado?</h3>
                <p className="text-xs text-slate-500">
                  O contrato fica travado: nenhum dado ou texto poderá ser alterado depois.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-700"><span className="font-semibold">Nº:</span> {contratoParaAssinar.numero}</p>
              <p className="text-slate-700"><span className="font-semibold">Cliente:</span> {contratoParaAssinar.clienteNome}</p>
            </div>

            <div>
              <label htmlFor="data-assinatura" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Data da assinatura
              </label>
              <input
                id="data-assinatura"
                type="date"
                value={dataAssinatura}
                max={hojeISO()}
                onChange={(e) => setDataAssinatura(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContratoParaAssinar(null)}
                disabled={assinando}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarAssinatura()}
                disabled={assinando || !dataAssinatura}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {assinando ? 'Assinando...' : 'Sim, marcar como assinado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {contratoParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excluir contrato?</h3>
                <p className="text-xs text-slate-500">Essa ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-700">
                <span className="font-semibold">Nº:</span> {contratoParaExcluir.numero || 'Sem número'}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Cliente:</span> {contratoParaExcluir.clienteNome}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Potência:</span> {contratoParaExcluir.potenciaKwp} kWp
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Valor:</span> R${' '}
                {contratoParaExcluir.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContratoParaExcluir(null)}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {excluindo ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
