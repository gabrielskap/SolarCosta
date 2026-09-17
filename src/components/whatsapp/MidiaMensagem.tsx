import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, Loader2 } from 'lucide-react';
import { WhatsApp, type Mensagem } from '../../services/whatsapp';

/*
 * O anexo de uma mensagem recebida.
 *
 * POR QUE NÃO É UM <img src="/api/whatsapp/midia/:id">: a sessão do sistema é
 * Bearer token em header, não cookie. A tag <img> não manda header nenhum e
 * tomaria 401. Então os bytes vêm por fetch autenticado e viram object URL —
 * mesmo arranjo da imagem de satélite da proposta (services/solar.ts).
 *
 * TRÊS ESTADOS, e nenhum deles é "imagem quebrada":
 *   · `midiaId` nulo e `erro` nulo — a fila de download ainda não chegou neste
 *     arquivo. O webhook grava a mensagem antes dos bytes de propósito, para
 *     responder 200 rápido;
 *   · `erro` preenchido — não deu para baixar (link expirado na uazapi, acima
 *     de 16 MB). Mostra o motivo, porque o vendedor precisa saber que tem de
 *     pedir o arquivo de novo;
 *   · `midiaId` preenchido — busca e mostra.
 */

interface Props {
  mensagem: Mensagem;
}

export const MidiaMensagem: React.FC<Props> = ({ mensagem }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!mensagem.midiaId) return;

    let atual: string | null = null;
    let vivo = true;

    void WhatsApp.midia(mensagem.midiaId)
      .then((u) => {
        // Componente desmontado no meio da busca: revoga na hora, senão o
        // object URL fica pendurado sem ninguém para liberá-lo.
        if (!vivo) {
          URL.revokeObjectURL(u);
          return;
        }
        atual = u;
        setUrl(u);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });

    // Sem este revoke, rolar uma conversa com muitas fotos vaza memória até a
    // aba travar — o navegador só libera o blob quando a URL é revogada.
    return () => {
      vivo = false;
      if (atual) URL.revokeObjectURL(atual);
    };
  }, [mensagem.midiaId]);

  if (mensagem.erro) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-800">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>{mensagem.erro}</span>
      </div>
    );
  }

  if (!mensagem.midiaId) {
    return (
      <div className="flex items-center gap-2 text-[11px] opacity-70">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Baixando o arquivo…
      </div>
    );
  }

  if (falhou) {
    return (
      <div className="flex items-center gap-2 text-[11px] opacity-70">
        <AlertCircle className="w-3.5 h-3.5" />
        Não foi possível abrir o arquivo.
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center gap-2 text-[11px] opacity-70">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (mensagem.tipo === 'imagem') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={mensagem.nomeArquivo ?? 'Imagem recebida'}
          className="rounded-xl max-h-64 w-auto"
        />
      </a>
    );
  }

  if (mensagem.tipo === 'video') {
    return <video src={url} controls className="rounded-xl max-h-64 w-auto" />;
  }

  if (mensagem.tipo === 'audio') {
    // `w-56` porque o player nativo estica até o container e estouraria a
    // bolha da mensagem no celular.
    return <audio src={url} controls className="w-56 max-w-full" />;
  }

  return (
    <a
      href={url}
      download={mensagem.nomeArquivo ?? undefined}
      className="flex items-center gap-2 rounded-xl bg-white/15 px-2.5 py-2 text-[11px] font-bold hover:bg-white/25"
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[12rem]">{mensagem.nomeArquivo ?? 'Arquivo'}</span>
      <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
    </a>
  );
};
