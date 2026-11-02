// Lista das procurações, na aba "Procurações" de Contratos e Procurações.
//
// Mesmo desenho da lista de contratos: busca, filtro de status, assinar pela
// etiqueta e as ações de cada linha. Os modais de assinatura e exclusão vivem
// aqui; o de assinatura é o mesmo que o editor usa.

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Eye, FileText, MessageCircle, PencilLine, Search, Trash2, X } from 'lucide-react';
import type { Procuracao } from '../../types';
import { ConfirmarAssinatura } from '../documento/ConfirmarAssinatura';
import { TITULO_ENVIO_DESLIGADO } from './EditorProcuracao';

interface Props {
  procuracoes: Procuracao[];
  /** Permissão emitir_contratos. */
  podeEmitir: boolean;
  podeEnviar: boolean;
  /** Falso onde o banco ainda não aceita link/mensagem de procuração. */
  envioAtivo: boolean;
  onAbrir: (p: Procuracao) => void;
  onPDF: (p: Procuracao) => void;
  onEnviar: (p: Procuracao) => void;
  /** `data` em AAAA-MM-DD. */
  onAssinar: (id: string, data: string) => Promise<void>;
  onExcluir?: (id: string) => Promise<void>;
}

const normalizarBusca = (texto: string) =>
  (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const ListaProcuracoes: React.FC<Props> = ({
  procuracoes, podeEmitir, podeEnviar, envioAtivo, onAbrir, onPDF, onEnviar, onAssinar, onExcluir,
}) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | Procuracao['status']>('todos');
  const [paraAssinar, setParaAssinar] = useState<Procuracao | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Procuracao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(termoBusca.trim());
    return procuracoes.filter((p) => {
      if (statusFiltro !== 'todos' && p.status !== statusFiltro) return false;
      if (!termo) return true;
      return normalizarBusca(`${p.numero} ${p.clienteNome} ${p.cpfCnpj} ${p.contratoNumero} ${p.telefone}`).includes(termo);
    });
  }, [procuracoes, termoBusca, statusFiltro]);

  const confirmarExclusao = async () => {
    if (!paraExcluir || !onExcluir) return;
    setExcluindo(true);
    try {
      await onExcluir(paraExcluir.id);
      setParaExcluir(null);
    } catch {
      // O App já mostrou o erro.
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Busca e filtro */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar por outorgante, nº da procuração ou do contrato, CPF/CNPJ..."
            aria-label="Buscar procurações"
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
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as 'todos' | Procuracao['status'])}
          aria-label="Filtrar por status"
          className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#004276] shadow-sm"
        >
          <option value="todos">Status: Todos</option>
          <option value="aguardando">Status: Aguardando assinatura</option>
          <option value="assinada">Status: Assinada</option>
        </select>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Procurações cadastradas</h3>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">Procuração</th>
                <th className="p-3">Outorgante</th>
                <th className="p-3">Contrato</th>
                <th className="p-3">Data</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {procuracoes.length === 0
                      ? 'Nenhuma procuração ainda. Gere uma pela ação “Procuração” de um contrato, ou em “Nova procuração”.'
                      : 'Nenhuma procuração encontrada para os filtros aplicados.'}
                  </td>
                </tr>
              )}
              {filtradas.map((p) => {
                const assinada = p.status === 'assinada';
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td data-label="Procuração" className="p-3 font-bold text-[#004276]">Nº {p.numero}</td>
                    <td data-label="Outorgante" className="p-3">
                      <span className="font-semibold text-slate-900">{p.clienteNome}</span>
                      <span className="block text-[10px] text-slate-500">{p.cpfCnpj}</span>
                    </td>
                    <td data-label="Contrato" className="p-3 text-slate-600">{p.contratoNumero ? `Nº ${p.contratoNumero}` : '—'}</td>
                    <td data-label="Data" className="p-3 text-slate-500">{p.dataEmissao}</td>
                    <td data-label="Status" className="p-3">
                      {assinada ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Assinada{p.dataAssinatura ? ` · ${p.dataAssinatura}` : ''}
                        </span>
                      ) : podeEmitir ? (
                        <button
                          type="button"
                          onClick={() => setParaAssinar(p)}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200"
                          title="Marcar como assinada"
                        >
                          Aguardando assinatura
                        </button>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Aguardando assinatura
                        </span>
                      )}
                    </td>
                    <td data-label="Ações" className="p-3 text-right font-bold space-x-3 whitespace-nowrap">
                      <button type="button" onClick={() => onAbrir(p)} className="text-[#004276] hover:underline inline-flex items-center gap-1">
                        {assinada || !podeEmitir ? <Eye className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
                        {assinada || !podeEmitir ? 'Ver' : 'Editar'}
                      </button>
                      <button type="button" onClick={() => onPDF(p)} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      {podeEnviar && (
                        <button
                          type="button"
                          onClick={() => onEnviar(p)}
                          disabled={!envioAtivo}
                          title={envioAtivo ? undefined : TITULO_ENVIO_DESLIGADO}
                          className="text-emerald-700 hover:underline inline-flex items-center gap-1 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Enviar
                        </button>
                      )}
                      {podeEmitir && onExcluir && (
                        <button
                          type="button"
                          onClick={() => setParaExcluir(p)}
                          className="text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1"
                          title="Excluir procuração"
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

      {paraAssinar && (
        <ConfirmarAssinatura
          titulo="Marcar como assinada?"
          aviso="A procuração fica travada: nenhum dado ou texto poderá ser alterado depois."
          numero={paraAssinar.numero}
          cliente={paraAssinar.clienteNome}
          rotuloConfirmar="Sim, marcar como assinada"
          onConfirmar={async (data) => {
            await onAssinar(paraAssinar.id, data);
            setParaAssinar(null);
          }}
          onCancelar={() => setParaAssinar(null)}
        />
      )}

      {paraExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excluir procuração?</h3>
                <p className="text-xs text-slate-500">Essa ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-700"><span className="font-semibold">Nº:</span> {paraExcluir.numero}</p>
              <p className="text-slate-700"><span className="font-semibold">Outorgante:</span> {paraExcluir.clienteNome}</p>
              {paraExcluir.contratoNumero && (
                <p className="text-slate-700"><span className="font-semibold">Contrato:</span> {paraExcluir.contratoNumero}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setParaExcluir(null)}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarExclusao()}
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
