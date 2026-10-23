import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, MessageCircle, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';
import { Proposta, User } from '../types';
import { TabelaResponsiva, type ColunaTabela } from './comuns/TabelaResponsiva';
import { EnviarPorWhatsApp } from './whatsapp/EnviarPorWhatsApp';

interface ProposalsListViewProps {
  propostas: Proposta[];
  onNovaProposta: () => void;
  /** Reabre a proposta na calculadora, com tudo que já foi preenchido. */
  onContinuarProposta: (propostaId: string) => void;
  onDeleteProposta?: (propostaId: string) => Promise<void> | void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const STATUS_LABEL: Record<Proposta['status'], string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
};

const STATUS_CLASS: Record<Proposta['status'], string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviada: 'bg-amber-100 text-amber-800',
  aceita: 'bg-emerald-100 text-emerald-800',
};

export const ProposalsListView: React.FC<ProposalsListViewProps> = ({
  propostas,
  onNovaProposta,
  onContinuarProposta,
  onDeleteProposta,
  onOpenPDF,
  currentUser,
  showToast,
}) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | Proposta['status']>('todos');

  /** Proposta escolhida para envio; null com o modal fechado. */
  const [enviando, setEnviando] = useState<Proposta | null>(null);

  /** Proposta selecionada para confirmação de exclusão */
  const [propostaParaExcluir, setPropostaParaExcluir] = useState<Proposta | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const podeEnviarWhatsApp =
    currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.usarWhatsapp;

  const podeExcluir =
    currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.emitirPropostas;

  const propostasFiltradas = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    return propostas.filter((p) => {
      if (statusFiltro !== 'todos' && p.status !== statusFiltro) return false;
      if (!termo) return true;
      const alvo = `${p.numero || ''} ${p.clienteNome || ''} ${p.cidade || ''} ${p.cpfCnpj || ''} ${p.telefone || ''} ${p.email || ''}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [propostas, termoBusca, statusFiltro]);

  const aguardandoAceite = propostas.filter((p) => p.status === 'enviada').length;
  const valorTotalFiltrado = propostasFiltradas.reduce((acc, p) => acc + (p.valorTotal || 0), 0);

  const confirmarExclusao = async () => {
    if (!propostaParaExcluir || !onDeleteProposta) return;
    try {
      setExcluindo(true);
      await onDeleteProposta(propostaParaExcluir.id);
      setPropostaParaExcluir(null);
    } catch {
      showToast('Erro ao excluir', 'error', 'Não foi possível excluir a proposta.');
    } finally {
      setExcluindo(false);
    }
  };

  /*
   * Quem é `principal` e quem é `secundaria` responde a uma pergunta só: o que
   * o vendedor precisa ver para ACHAR a proposta certa numa lista, no celular,
   * na frente do cliente. Cliente, valor, status e o botão do PDF bastam —
   * cidade, potência e data servem para confirmar depois de achar.
   */
  const colunas: ColunaTabela<Proposta>[] = [
    {
      chave: 'numero',
      titulo: 'Nº',
      celula: (p) => <span className="font-bold text-[#004276] whitespace-nowrap">Nº {p.numero || '—'}</span>,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      celula: (p) => (
        <div className="min-w-0 max-w-[200px] sm:max-w-[260px] md:max-w-[320px] text-left">
          <span className="font-semibold text-slate-900 break-words whitespace-normal block leading-snug">
            {p.clienteNome}
          </span>
          {p.cpfCnpj && (
            <span className="text-[11px] text-slate-400 block truncate font-normal">
              {p.cpfCnpj}
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'cidade',
      titulo: 'Cidade',
      prioridade: 'secundaria',
      celula: (p) => (
        <span className="text-slate-600 break-words whitespace-normal block max-w-[140px]">
          {p.cidade || '—'}
        </span>
      ),
    },
    {
      chave: 'potencia',
      titulo: 'Potência',
      prioridade: 'secundaria',
      celula: (p) => <span className="text-slate-600 whitespace-nowrap">{p.potenciaKwp} kWp</span>,
    },
    {
      chave: 'valor',
      titulo: 'Valor total',
      celula: (p) => (
        <span className="font-bold text-slate-900 whitespace-nowrap">
          R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      chave: 'data',
      titulo: 'Data',
      prioridade: 'secundaria',
      celula: (p) => <span className="text-slate-500 whitespace-nowrap">{p.dataCriacao}</span>,
    },
    {
      chave: 'status',
      titulo: 'Status',
      celula: (p) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${STATUS_CLASS[p.status]}`}>
          {STATUS_LABEL[p.status]}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhamento: 'direita',
      celula: (p) => (
        <div className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {/* Rascunho é proposta inacabada: a ação principal dele é voltar ao
              formulário, não imprimir. Por isso vem primeiro — e só nele, que
              proposta enviada ou aceita se altera por outro caminho. */}
          {p.status === 'rascunho' && (
            <button
              type="button"
              onClick={() => onContinuarProposta(p.id)}
              className="text-[#004276] hover:underline inline-flex items-center gap-1 font-bold"
            >
              <PencilLine className="w-3.5 h-3.5" />
              Continuar preenchendo
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenPDF('proposta', p)}
            className="text-blue-600 hover:underline inline-flex items-center gap-1 font-bold"
          >
            <FileText className="w-3.5 h-3.5" />
            Visualizar PDF
          </button>
          {podeEnviarWhatsApp && (
            <button
              type="button"
              onClick={() => setEnviando(p)}
              className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-bold"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Enviar
            </button>
          )}
          {podeExcluir && onDeleteProposta && (
            <button
              type="button"
              onClick={() => setPropostaParaExcluir(p)}
              className="text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1 font-bold"
              title="Excluir proposta"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Propostas de orçamento</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {propostasFiltradas.length}{' '}
            {propostasFiltradas.length === 1 ? 'proposta listada' : 'propostas listadas'}
            {propostasFiltradas.length !== propostas.length && ` (de ${propostas.length})`}
            {' · '}
            R$ {valorTotalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            {' · '}
            {aguardandoAceite} aguardando aceite
          </p>
        </div>

        <button
          onClick={onNovaProposta}
          className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova proposta</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar por cliente, nº da proposta, cidade, CPF/CNPJ..."
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

        {/* Filtro por Status */}
        <div className="flex items-center gap-2">
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as 'todos' | Proposta['status'])}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#004276] shadow-sm"
          >
            <option value="todos">Status: Todos</option>
            <option value="rascunho">Status: Rascunho</option>
            <option value="enviada">Status: Enviada</option>
            <option value="aceita">Status: Aceita</option>
          </select>

          {(termoBusca || statusFiltro !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setTermoBusca('');
                setStatusFiltro('todos');
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-2 rounded-lg hover:bg-slate-100 transition whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Proposals Table */}
      <div className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <TabelaResponsiva
          colunas={colunas}
          dados={propostasFiltradas}
          chaveDe={(p) => p.id}
          vazio={
            propostas.length === 0
              ? 'Nenhuma proposta cadastrada ainda.'
              : 'Nenhuma proposta encontrada para os filtros aplicados.'
          }
        />
      </div>

      {/* Modal de envio por WhatsApp */}
      {enviando && (
        <EnviarPorWhatsApp
          referencia={{ tipo: 'proposta', id: enviando.id }}
          clienteNome={enviando.clienteNome}
          telefoneSugerido={enviando.telefone}
          leadId={enviando.leadId || null}
          onFechar={() => setEnviando(null)}
          showToast={showToast}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {propostaParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excluir proposta?</h3>
                <p className="text-xs text-slate-500">Essa ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-700">
                <span className="font-semibold">Nº:</span> {propostaParaExcluir.numero || 'Sem número'}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Cliente:</span> {propostaParaExcluir.clienteNome}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Valor:</span> R${' '}
                {propostaParaExcluir.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPropostaParaExcluir(null)}
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
