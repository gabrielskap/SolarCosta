// "Marcar como assinada?" — pede a data e confirma, porque assinar trava o
// documento. É o modal do contrato (ContractsView) em versão reaproveitável,
// usado pela procuração na lista e no editor.

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { hojeISO } from '../../contrato/padroes';

interface Props {
  titulo: string;
  /** O que trava ("nenhum dado ou texto poderá ser alterado depois"). */
  aviso: string;
  numero: string;
  cliente: string;
  /** "Sim, marcar como assinada". */
  rotuloConfirmar: string;
  /** `data` em AAAA-MM-DD. Rejeitar mantém o modal aberto. */
  onConfirmar: (data: string) => Promise<void>;
  onCancelar: () => void;
}

export const ConfirmarAssinatura: React.FC<Props> = ({
  titulo, aviso, numero, cliente, rotuloConfirmar, onConfirmar, onCancelar,
}) => {
  const [data, setData] = useState(hojeISO());
  const [assinando, setAssinando] = useState(false);
  const idTitulo = React.useId();
  const idData = React.useId();

  const confirmar = async () => {
    setAssinando(true);
    try {
      await onConfirmar(data);
    } catch {
      // Quem chamou já mostrou o erro.
    } finally {
      setAssinando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 id={idTitulo} className="text-lg font-bold text-slate-900">{titulo}</h3>
            <p className="text-xs text-slate-500">{aviso}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
          <p className="text-slate-700"><span className="font-semibold">Nº:</span> {numero}</p>
          <p className="text-slate-700"><span className="font-semibold">Cliente:</span> {cliente}</p>
        </div>

        <div>
          <label htmlFor={idData} className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Data da assinatura
          </label>
          <input
            id={idData}
            type="date"
            value={data}
            max={hojeISO()}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={assinando}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={assinando || !data}
            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {assinando ? 'Assinando...' : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
};
