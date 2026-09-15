import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { Proposta } from '../types';
import { TabelaResponsiva, type ColunaTabela } from './comuns/TabelaResponsiva';

interface ProposalsListViewProps {
  propostas: Proposta[];
  onNovaProposta: () => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
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
  onOpenPDF,
}) => {
  const aguardandoAceite = propostas.filter((p) => p.status === 'enviada').length;

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
      celula: (p) => <span className="font-bold text-[#004276]">Nº {p.numero || '—'}</span>,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      celula: (p) => <span className="font-semibold text-slate-900">{p.clienteNome}</span>,
    },
    {
      chave: 'cidade',
      titulo: 'Cidade',
      prioridade: 'secundaria',
      celula: (p) => <span className="text-slate-600">{p.cidade || '—'}</span>,
    },
    {
      chave: 'potencia',
      titulo: 'Potência',
      prioridade: 'secundaria',
      celula: (p) => <span className="text-slate-600">{p.potenciaKwp} kWp</span>,
    },
    {
      chave: 'valor',
      titulo: 'Valor total',
      celula: (p) => (
        <span className="font-bold text-slate-900">
          R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      chave: 'data',
      titulo: 'Data',
      prioridade: 'secundaria',
      celula: (p) => <span className="text-slate-500">{p.dataCriacao}</span>,
    },
    {
      chave: 'status',
      titulo: 'Status',
      celula: (p) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLASS[p.status]}`}>
          {STATUS_LABEL[p.status]}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhamento: 'direita',
      celula: (p) => (
        <button
          onClick={() => onOpenPDF('proposta', p)}
          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-bold"
        >
          <FileText className="w-3.5 h-3.5" />
          Visualizar PDF
        </button>
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
            {propostas.length} {propostas.length === 1 ? 'proposta cadastrada' : 'propostas cadastradas'}
            {' · '}
            {aguardandoAceite} aguardando aceite
          </p>
        </div>

        <button
          onClick={onNovaProposta}
          className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova proposta</span>
        </button>
      </div>

      {/* Proposals Table */}
      <div className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <TabelaResponsiva
          colunas={colunas}
          dados={propostas}
          chaveDe={(p) => p.id}
          vazio="Nenhuma proposta cadastrada ainda."
        />
      </div>
    </div>
  );
};
