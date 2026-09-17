import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Loader2, MessageCircle, Plug, PlugZap, WifiOff,
} from 'lucide-react';
import { ErroApi } from '../../services/http';
import { formatarTelefoneInternacional } from '../../utils/contato';
import { WhatsApp, type EstadoWhatsApp, type InstanciaWhatsApp } from '../../services/whatsapp';
import type { Lead, User } from '../../types';
import { CaixaEntrada } from './CaixaEntrada';
import { ConexaoInstancia } from './ConexaoInstancia';

/*
 * WhatsApp — conexão do número da empresa.
 *
 * ESTA TELA BUSCA OS PRÓPRIOS DADOS, como a Configuração do Site e pelos
 * mesmos motivos: carregarTudo() roda no login de todo usuário e não deveria
 * carregar dados de uma tela que a maioria não abre; e o App.tsx já passa das
 * 900 linhas.
 *
 * A conexão vive aqui; a caixa de entrada é a CaixaEntrada, que cuida do
 * próprio polling. O que esta tela faz por ela é dizer se o número está
 * conectado — sem isso a caixa não sabe se pode habilitar a resposta.
 */

/**
 * O status é revalidado a cada 30 s.
 *
 * Sem isso, um número que caísse às 3h continuaria mostrando "Conectado" para
 * quem tivesse deixado a tela aberta, e o vendedor só descobriria no erro do
 * primeiro envio. O custo é baixo de propósito: GET /instancia lê uma linha do
 * banco e NÃO bate na uazapi.
 */
const INTERVALO_STATUS_MS = 30_000;

interface Props {
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  /** Vem do App, que já os tem em memória desde o login. Usados no seletor de lead. */
  leads: Lead[];
}

const RÓTULO_STATUS: Record<InstanciaWhatsApp['status'], string> = {
  conectada: 'Conectado',
  conectando: 'Aguardando leitura do QR code',
  desconectada: 'Desconectado',
  hibernada: 'Em espera',
};

export const WhatsAppView: React.FC<Props> = ({ currentUser, showToast, leads }) => {
  const [estado, setEstado] = useState<EstadoWhatsApp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const podeAdministrar =
    currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.gerenciarUsuarios;

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setEstado(await WhatsApp.estado());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível carregar o WhatsApp.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Revalida o status em laço, sem tocar no estado de carregamento — um
   * spinner a cada 30 s piscaria a tela inteira.
   *
   * Parado quando a aba está escondida, e sincronizado na hora ao voltar: aba
   * esquecida aberta a noite toda não deve gerar milhares de requisições, e 30 s
   * de espera depois de trocar de janela é exatamente quando alguém está
   * olhando.
   */
  useEffect(() => {
    const atualizar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        setEstado(await WhatsApp.estado());
      } catch {
        /* silencioso: é um tique de fundo, não uma ação do usuário */
      }
    };

    // A MESMA referência no add e no remove: uma arrow nova em cada chamada
    // registraria o ouvinte e não removeria nada.
    const aoTicar = () => void atualizar();

    const timer = setInterval(aoTicar, INTERVALO_STATUS_MS);
    document.addEventListener('visibilitychange', aoTicar);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoTicar);
    };
  }, []);

  const desconectar = async () => {
    setDesconectando(true);
    try {
      const instancia = await WhatsApp.desconectar();
      setEstado((e) => (e ? { ...e, instancia } : e));
      showToast('WhatsApp desconectado', 'info', 'Conecte um número novamente para voltar a enviar.');
    } catch (e) {
      showToast(
        'Não foi possível desconectar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setDesconectando(false);
    }
  };

  /* ----------------------------------------------------------- estados -- */

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-7 h-7 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Carregando o WhatsApp…</p>
      </div>
    );
  }

  if (erro || !estado) {
    return (
      <div className="max-w-md mx-auto text-center bg-white border border-slate-200 rounded-2xl p-8 mt-16">
        <WifiOff className="w-9 h-9 text-rose-500 mx-auto mb-4" />
        <h2 className="font-extrabold text-base text-slate-900 mb-2">
          Não foi possível abrir o WhatsApp
        </h2>
        <p className="text-sm text-slate-600 mb-6">{erro}</p>
        <button
          onClick={() => void carregar()}
          className="px-4 py-2 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { instancia, ativo } = estado;
  const conectada = instancia.status === 'conectada';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[#004276]" />
          WhatsApp
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Conecte o número da empresa para enviar propostas e atender clientes sem sair do sistema.
        </p>
      </header>

      {/*
        Integração desligada no servidor é uma situação diferente de "número
        não conectado", e confundir as duas faria o administrador ficar
        clicando em Conectar sem entender por que nada acontece.
      */}
      {!ativo && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">Integração desligada no servidor</p>
            <p className="text-amber-800 mt-1">
              Falta configurar <code className="font-mono text-xs">UAZAPI_ADMIN_TOKEN</code> no
              ambiente da API. Enquanto isso, o botão de conectar não tem o que chamar.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- conexão -- */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                conectada ? 'bg-emerald-50' : 'bg-slate-100'
              }`}
            >
              {conectada ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <Plug className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900">{RÓTULO_STATUS[instancia.status]}</p>
              <p className="text-sm text-slate-600 truncate">
                {conectada
                  ? `${instancia.perfil ?? 'WhatsApp'} · ${formatarTelefoneInternacional(instancia.numero)}`
                  : 'Nenhum número conectado.'}
              </p>
            </div>
          </div>

          {podeAdministrar && (
            <div className="flex items-center gap-2 shrink-0">
              {conectada ? (
                <button
                  onClick={() => void desconectar()}
                  disabled={desconectando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  {desconectando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlugZap className="w-4 h-4" />
                  )}
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={() => setConectando(true)}
                  disabled={!ativo}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plug className="w-4 h-4" />
                  Conectar número
                </button>
              )}
            </div>
          )}
        </div>

        {/* O erro guardado explica um envio que parou de funcionar — erro 463,
            limite de conversas novas, restrição do WhatsApp. Sem isso o
            sintoma chegaria como "o sistema não manda mais mensagem". */}
        {instancia.ultimoErro && (
          <p className="mt-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {instancia.ultimoErro}
          </p>
        )}

        {!podeAdministrar && !conectada && (
          <p className="mt-4 text-xs text-slate-500">
            Peça a um administrador para conectar o número da empresa.
          </p>
        )}
      </section>

      {/* --------------------------------------------- caixa de entrada -- */}
      {/*
        Aparece mesmo com o número desconectado: o histórico do que já passou
        continua valendo, e esconder a caixa faria parecer que as conversas
        foram perdidas. O que a desconexão desabilita é a resposta — a própria
        CaixaEntrada diz o motivo na caixa de texto.
      */}
      <CaixaEntrada conectada={conectada} leads={leads} showToast={showToast} />

      {conectando && (
        <ConexaoInstancia
          instanciaInicial={instancia}
          onFechar={() => {
            setConectando(false);
            void carregar();
          }}
          onAtualizar={(nova) => setEstado((e) => (e ? { ...e, instancia: nova } : e))}
        />
      )}
    </div>
  );
};

