import React from 'react';
import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { linkMapa, linkTelefone, linkWhatsApp } from '../../utils/contato';

/*
 * Ligar / WhatsApp / traçar rota, a partir dos dados que o registro já tem.
 *
 * Cada ação só aparece se o dado existir e for utilizável — um telefone sem
 * DDD não vira link, e um botão que não faz nada é pior que botão nenhum
 * (o vendedor toca, não acontece nada, e ele deixa de confiar no resto).
 */

interface AcoesContatoProps {
  telefone?: string | null;
  /** Partes do endereço; são juntadas na ordem recebida. */
  endereco?: (string | undefined | null)[];
  /** Texto já preenchido na conversa do WhatsApp. */
  mensagemWhatsApp?: string;
  /** `compacto` usa só os ícones — para caber dentro de um cartão de lista. */
  variante?: 'completo' | 'compacto';
  className?: string;
}

export const AcoesContato: React.FC<AcoesContatoProps> = ({
  telefone,
  endereco,
  mensagemWhatsApp,
  variante = 'completo',
  className = '',
}) => {
  const tel = linkTelefone(telefone);
  const zap = linkWhatsApp(telefone, mensagemWhatsApp);
  const mapa = endereco ? linkMapa(...endereco) : null;

  if (!tel && !zap && !mapa) return null;

  const compacto = variante === 'compacto';
  const base = `flex items-center justify-center gap-1.5 rounded-lg font-bold transition ${
    compacto ? 'px-2.5 py-1.5 text-[11px]' : 'flex-1 px-3 py-2.5 text-xs'
  }`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {tel && (
        <a
          href={tel}
          onClick={(e) => e.stopPropagation()}
          className={`${base} bg-slate-100 text-slate-700 hover:bg-slate-200`}
        >
          <Phone className="w-3.5 h-3.5" />
          {!compacto && 'Ligar'}
        </a>
      )}
      {zap && (
        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {!compacto && 'WhatsApp'}
        </a>
      )}
      {mapa && (
        <a
          href={mapa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`${base} bg-blue-50 text-[#004276] hover:bg-blue-100`}
        >
          <MapPin className="w-3.5 h-3.5" />
          {!compacto && 'Rota'}
        </a>
      )}
    </div>
  );
};
