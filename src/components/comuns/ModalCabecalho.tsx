import React from 'react';
import { X, LucideIcon } from 'lucide-react';

/*
 * Faixa de título dos modais do CRM.
 *
 * Por que virou componente: os dezoito modais do sistema repetiam a mesma
 * estrutura à mão — `bg-[#004276] text-white p-4 flex items-center
 * justify-between`, um <h3>, e um X com `text-slate-300 hover:text-white` —
 * com divergências que só o acaso explica (p-4 em uns, p-5 em outros, h2 aqui,
 * h3 ali, ícone amarelo em cinco deles). Modernizar isso copiando gradiente e
 * chip de ícone para dezoito lugares garantiria que o próximo ajuste visual
 * nascesse desalinhado de novo.
 *
 * A classe `.modal-cabecalho` continua no elemento raiz: é ela que o CSS usa
 * para não deixar a faixa encolher quando o modal vira folha de tela cheia no
 * celular (ver "MODAL COMO SHEET" em index.css).
 */

interface ModalCabecalhoProps {
  /** Ícone do lucide — entra num chip translúcido à esquerda do título. */
  icone: LucideIcon;
  titulo: React.ReactNode;
  /** Linha de contexto: código do registro, nome do cliente, o que o modal faz. */
  subtitulo?: React.ReactNode;
  onFechar: () => void;
  /**
   * `escuro` para os modais de leitura (detalhe de evento), onde o azul da
   * marca disputa atenção com o conteúdo em vez de emoldurá-lo.
   */
  tom?: 'marca' | 'escuro';
}

export const ModalCabecalho: React.FC<ModalCabecalhoProps> = ({
  icone: Icone,
  titulo,
  subtitulo,
  onFechar,
  tom = 'marca',
}) => {
  const fundo =
    tom === 'escuro'
      ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950'
      : 'bg-gradient-to-br from-[#00528f] via-[#004276] to-[#002844]';

  const corSubtitulo = tom === 'escuro' ? 'text-slate-300/80' : 'text-blue-100/80';

  return (
    <div
      className={`modal-cabecalho relative overflow-hidden text-white px-5 py-4 flex items-center gap-3 ${fundo}`}
    >
      {/* Brilho decorativo: dá profundidade à faixa sem depender de imagem. */}
      <div className="pointer-events-none absolute -top-12 -right-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />

      <span className="relative w-10 h-10 shrink-0 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
        <Icone className="w-5 h-5" />
      </span>

      <div className="relative min-w-0 flex-1">
        <h3 className="font-extrabold text-base leading-tight truncate">{titulo}</h3>
        {subtitulo && (
          <p className={`text-[11px] font-medium truncate ${corSubtitulo}`}>{subtitulo}</p>
        )}
      </div>

      {/*
       * `type="button"` não é decorativo: em metade dos modais esta faixa fica
       * DENTRO do <form>, e um <button> sem type é submit — fechar enviaria o
       * formulário.
       */}
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/15 hover:text-white transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
