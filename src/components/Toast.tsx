import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

/** Tempo, em ms, que cada toast permanece visível antes de fechar sozinho. */
const TOAST_DURACAO_MS = 3000;

/**
 * Duração da entrada/saída. Precisa bater com as classes `duration-*` abaixo:
 * é ela que decide quando o item sai do array do pai.
 */
const ANIMACAO_MS = 200;

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /**
   * Botão de ação. Usado pelo aviso de nova versão do app, onde o toast não é
   * só informativo — ele é o lugar onde o usuário decide atualizar.
   */
  action?: { label: string; onClick: () => void };
  /**
   * Não fecha sozinho. Para avisos que perderiam o sentido se sumissem antes
   * de o usuário reagir (de novo: a atualização do app).
   */
  persistente?: boolean;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

/*
 * Entrada e saída em CSS, sem biblioteca de animação.
 *
 * Antes isto usava `motion/react` (framer-motion) só pelo fade do toast — e
 * essa dependência sozinha respondia por ~468 kB dos 580 kB do chunk do CRM,
 * baixados em toda sessão, inclusive quando nenhum toast aparecia. Duas
 * transições de opacidade/transform não justificam esse peso no 4G.
 *
 * O detalhe que a lib resolvia de graça era a SAÍDA: o elemento precisa
 * continuar montado enquanto some. Aqui o próprio item pede a remoção ao pai
 * só depois de a animação terminar (`fase: 'saindo'` -> timeout -> onClose).
 */
type Fase = 'entrando' | 'visivel' | 'saindo';

const ESTILO_POR_TIPO: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  // Ref evita reiniciar a contagem caso o pai recrie o `onClose` a cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [fase, setFase] = useState<Fase>('entrando');

  // Dois quadros: o primeiro garante que o navegador PINTOU o estado inicial.
  // Trocando a classe no mesmo quadro da montagem, não há transição nenhuma —
  // o elemento já nasceria no estado final.
  useEffect(() => {
    let quadroInterno = 0;
    const quadro = requestAnimationFrame(() => {
      quadroInterno = requestAnimationFrame(() => setFase('visivel'));
    });
    return () => {
      cancelAnimationFrame(quadro);
      cancelAnimationFrame(quadroInterno);
    };
  }, []);

  const fechar = useCallback(() => {
    setFase('saindo');
    setTimeout(() => onCloseRef.current(toast.id), ANIMACAO_MS);
  }, [toast.id]);

  useEffect(() => {
    if (toast.persistente) return;
    const timer = setTimeout(fechar, TOAST_DURACAO_MS);
    return () => clearTimeout(timer);
  }, [fechar, toast.persistente]);

  const transformacao =
    fase === 'visivel'
      ? 'opacity-100 translate-y-0 scale-100'
      : fase === 'entrando'
        ? 'opacity-0 translate-y-5 scale-95'
        : 'opacity-0 translate-y-2.5 scale-95';

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border text-sm
        transition-all duration-200 ease-out motion-reduce:transition-none
        ${transformacao} ${ESTILO_POR_TIPO[toast.type]}`}
    >
      <div className="shrink-0 mr-3 mt-0.5">
        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
        {toast.description && <p className="mt-1 text-xs text-slate-600">{toast.description}</p>}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 px-3 py-1.5 bg-[#004276] hover:bg-[#003159] text-white text-xs font-bold rounded-lg transition"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={fechar}
        aria-label="Fechar aviso"
        className="shrink-0 text-slate-400 hover:text-slate-600 ml-2 p-1 rounded-md"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onClose }) => {
  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};
