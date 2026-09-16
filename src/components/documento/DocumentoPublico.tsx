import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, LinkIcon } from 'lucide-react';
import { http, ErroApi } from '../../services/http';
import { useSeo } from '../../site/seo';
import { paraContrato, paraProposta } from '../../services/mappers';
import type { Contrato, Proposta } from '../../types';
import { PDFModal } from '../PDFModal';

/*
 * /p/:token — a proposta ou o contrato abertos pelo CLIENTE.
 *
 * Fica fora de /sistema e fora do SiteLayout: não leva menu, não leva rodapé
 * institucional e não pede login. O token da URL é a credencial inteira.
 *
 * O documento é o MESMO componente que o vendedor vê (PDFModal, variante
 * 'pagina'). Uma "versão pública" separada divergiria da original na primeira
 * correção feita só de um lado, e o cliente acabaria recebendo um documento
 * diferente do que foi aprovado.
 */

type Estado =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; tipo: 'proposta'; documento: Proposta }
  | { fase: 'pronto'; tipo: 'contrato'; documento: Contrato };

export const DocumentoPublico: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  useEffect(() => {
    let vivo = true;

    void (async () => {
      try {
        const r = await http.getPublico<any>(`/api/publico/documento/${encodeURIComponent(token)}`);
        if (!vivo) return;

        // Os mesmos mappers do CRM: a rota pública devolve um SUBCONJUNTO das
        // mesmas colunas, então o que não vem simplesmente fica vazio.
        setEstado(
          r.tipo === 'proposta'
            ? { fase: 'pronto', tipo: 'proposta', documento: paraProposta(r.documento) }
            : { fase: 'pronto', tipo: 'contrato', documento: paraContrato(r.documento) },
        );
      } catch (e) {
        if (!vivo) return;
        setEstado({
          fase: 'erro',
          mensagem:
            e instanceof ErroApi
              ? e.message
              : 'Não foi possível abrir o documento. Verifique sua conexão.',
        });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [token]);

  // `naoIndexar` é o ponto: um documento comercial com o nome, o CPF e o
  // endereço de um cliente não pode entrar em buscador. O link é secreto, mas
  // basta o cliente colar a URL em qualquer lugar rastreável para o robô achar
  // — e aí o sigilo do token não vale mais nada.
  //
  // O título vem junto porque é o nome do arquivo que o navegador sugere
  // quando o cliente salva em PDF.
  useSeo({
    titulo:
      estado.fase === 'pronto'
        ? `${estado.tipo === 'proposta' ? 'Proposta' : 'Contrato'} ${estado.documento.numero}`
        : 'Documento',
    descricao: 'Documento emitido pela Solar Costa.',
    naoIndexar: true,
  });

  if (estado.fase === 'carregando') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Abrindo o documento…</p>
      </div>
    );
  }

  if (estado.fase === 'erro') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-2xl p-8">
          <LinkIcon className="w-9 h-9 text-slate-300 mx-auto mb-4" />
          <h1 className="font-extrabold text-base text-slate-900 mb-2">Documento indisponível</h1>
          <p className="text-sm text-slate-600">{estado.mensagem}</p>
        </div>
      </div>
    );
  }

  return (
    <PDFModal
      type={estado.tipo}
      data={estado.documento}
      variante="pagina"
      tokenPublico={token}
      // Não há para onde fechar: a variante 'pagina' esconde o X. O callback
      // segue obrigatório na interface porque o uso principal, no CRM, precisa
      // dele — e afrouxar o tipo para os dois casos esconderia um erro real lá.
      onClose={() => {}}
    />
  );
};
