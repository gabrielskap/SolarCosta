import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { Proposta } from '../types';

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
          className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova proposta</span>
        </button>
      </div>

      {/* Proposals Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">Nº</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Cidade</th>
                <th className="p-3">Potência</th>
                <th className="p-3">Valor total</th>
                <th className="p-3">Data</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {propostas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhuma proposta cadastrada ainda.
                  </td>
                </tr>
              ) : (
                propostas.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#004276]">Nº {p.numero || '—'}</td>
                    <td className="p-3 font-semibold text-slate-900">{p.clienteNome}</td>
                    <td className="p-3 text-slate-600">{p.cidade || '—'}</td>
                    <td className="p-3 text-slate-600">{p.potenciaKwp} kWp</td>
                    <td className="p-3 font-bold text-slate-900">
                      R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-slate-500">{p.dataCriacao}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLASS[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">
                      <button
                        onClick={() => onOpenPDF('proposta', p)}
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Visualizar PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
