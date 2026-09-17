import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, MessageSquare } from 'lucide-react';
import { ErroApi } from '../../services/http';
import { useEhCelular } from '../comuns/useEhCelular';
import { WhatsApp, type Conversa, type Mensagem } from '../../services/whatsapp';
import type { Lead } from '../../types';
import { ListaConversas } from './ListaConversas';
import { ThreadConversa } from './ThreadConversa';
import { VincularLead } from './VincularLead';

/*
 * Caixa de entrada: lista de conversas à esquerda, thread à direita.
 *
 * ===================== POR QUE POLLING, E NÃO WEBSOCKET =====================
 * Não existe nada de tempo real no projeto — nem SSE, nem socket, nem Redis.
 * Um canal novo exigiria configuração própria no Nginx (streaming não passa
 * pelo proxy_pass padrão) e um segundo caminho de autenticação. O ganho sobre
 * 8 segundos de atraso numa conversa de vendas não paga essa infraestrutura.
 *
 * DOIS TEMPORIZADORES, cada um ao lado do dado que ele atualiza:
 *   · a lista, a cada 15 s — é uma consulta de 30 linhas com um LEFT JOIN;
 *   · a thread aberta, a cada 8 s, e só o DELTA (`depoisDe`), não a conversa
 *     inteira. Rebaixar 40 mensagens a cada 8 s seria desperdício puro.
 *
 * OS DOIS PARAM QUANDO A ABA ESTÁ ESCONDIDA. Sem isso, uma aba esquecida aberta
 * durante a noite faria milhares de requisições para ninguém ver. Ao voltar
 * para a aba, sincroniza na hora em vez de esperar o próximo tique.
 */

const INTERVALO_LISTA_MS = 15_000;
const INTERVALO_THREAD_MS = 8_000;
const ATRASO_BUSCA_MS = 300;

interface Props {
  /** Falso quando o número não está conectado: a resposta fica desabilitada. */
  conectada: boolean;
  leads: Lead[];
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const visivel = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

export const CaixaEntrada: React.FC<Props> = ({ conectada, leads, showToast }) => {
  const ehCelular = useEhCelular();

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [naoLidasTotal, setNaoLidasTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [arquivadas, setArquivadas] = useState(false);

  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregandoThread, setCarregandoThread] = useState(false);

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  // Em ref, não em state: os temporizadores leem isto e não devem reiniciar a
  // cada mensagem que chega.
  const selecionadaRef = useRef<Conversa | null>(null);
  selecionadaRef.current = selecionada;

  /* ------------------------------------------------------------- lista -- */

  const carregarLista = useCallback(
    async (opcoes: { silencioso?: boolean } = {}) => {
      if (!opcoes.silencioso) setCarregandoLista(true);
      try {
        const p = await WhatsApp.conversas({
          busca: buscaAplicada || undefined,
          arquivadas: arquivadas ? 'sim' : 'nao',
        });
        setConversas(p.conversas);
        setNaoLidasTotal(p.naoLidasTotal);
        setCursor(p.proximoCursor);
      } catch (e) {
        // Falha silenciosa no tique automático: um toast a cada 15 s seria pior
        // que o próprio erro. Mesmo critério do laço de QR em
        // ConexaoInstancia.tsx.
        if (!opcoes.silencioso) {
          showToast(
            'Não foi possível carregar as conversas',
            'error',
            e instanceof ErroApi ? e.mensagemCompleta : undefined,
          );
        }
      } finally {
        if (!opcoes.silencioso) setCarregandoLista(false);
      }
    },
    [buscaAplicada, arquivadas, showToast],
  );

  /** Debounce da busca: uma consulta por pausa de digitação, não por tecla. */
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  const verMaisConversas = async () => {
    if (!cursor) return;
    setCarregandoLista(true);
    try {
      const p = await WhatsApp.conversas({
        busca: buscaAplicada || undefined,
        arquivadas: arquivadas ? 'sim' : 'nao',
        antesDe: cursor,
      });
      // Dedupe por id: entre a primeira página e esta, uma conversa pode ter
      // subido para o topo e apareceria duas vezes.
      setConversas((atuais) => {
        const vistos = new Set(atuais.map((c) => c.id));
        return [...atuais, ...p.conversas.filter((c) => !vistos.has(c.id))];
      });
      setCursor(p.proximoCursor);
    } catch (e) {
      showToast(
        'Não foi possível carregar mais conversas',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setCarregandoLista(false);
    }
  };

  /* ------------------------------------------------------------ thread -- */

  const abrir = async (c: Conversa) => {
    // A ref é escrita AQUI, e não só no render: as guardas depois do `await`
    // comparam contra ela, e depender do momento em que o React re-renderiza
    // tornaria a corrida dependente de timing.
    selecionadaRef.current = c;
    setSelecionada(c);
    setMensagens([]);
    setTemMais(false);
    setTexto('');
    setCarregandoThread(true);

    // Zera o badge na hora, antes da resposta do servidor: o usuário acabou de
    // abrir a conversa, e esperar meio segundo para o número sumir parece
    // travamento.
    setConversas((atuais) => atuais.map((x) => (x.id === c.id ? { ...x, naoLidas: 0 } : x)));
    setNaoLidasTotal((t) => Math.max(0, t - c.naoLidas));

    try {
      const p = await WhatsApp.mensagens(c.id);

      // Clicar numa segunda conversa enquanto a primeira carrega é comum, e sem
      // esta guarda a resposta atrasada da primeira sobrescreveria a thread da
      // segunda — o usuário veria a conversa errada sob o nome certo.
      if (selecionadaRef.current?.id !== c.id) return;

      setMensagens(p.mensagens);
      setTemMais(p.temMais);
      setSelecionada(p.conversa);
      if (c.naoLidas > 0) await WhatsApp.marcarLida(c.id);
    } catch (e) {
      if (selecionadaRef.current?.id !== c.id) return;
      showToast(
        'Não foi possível abrir a conversa',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      if (selecionadaRef.current?.id === c.id) setCarregandoThread(false);
    }
  };

  const verMaisMensagens = async () => {
    const c = selecionada;
    const maisAntiga = mensagens[mensagens.length - 1];
    if (!c || !maisAntiga) return;

    setCarregandoThread(true);
    try {
      const p = await WhatsApp.mensagens(c.id, { antesDe: maisAntiga.ocorridoEm });
      setMensagens((atuais) => {
        const vistos = new Set(atuais.map((m) => m.id));
        return [...atuais, ...p.mensagens.filter((m) => !vistos.has(m.id))];
      });
      setTemMais(p.temMais);
    } catch (e) {
      showToast(
        'Não foi possível carregar mensagens anteriores',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setCarregandoThread(false);
    }
  };

  /** O delta do polling. Silencioso por definição. */
  const sincronizarThread = useCallback(async () => {
    const c = selecionadaRef.current;
    if (!c) return;

    const maisRecente = mensagens[0]?.ocorridoEm;
    try {
      const p = await WhatsApp.mensagens(c.id, maisRecente ? { depoisDe: maisRecente } : {});
      if (p.mensagens.length === 0) return;

      setMensagens((atuais) => {
        const vistos = new Set(atuais.map((m) => m.id));
        const novas = p.mensagens.filter((m) => !vistos.has(m.id));
        return novas.length ? [...novas, ...atuais] : atuais;
      });

      // Chegou mensagem com a conversa aberta na frente do usuário: ela já
      // está lida, mas o webhook incrementou o contador do lado do servidor.
      setConversas((atuais) => atuais.map((x) => (x.id === c.id ? { ...x, naoLidas: 0 } : x)));
      await WhatsApp.marcarLida(c.id).catch(() => {});
    } catch {
      /* tique automático não incomoda o usuário com erro */
    }
  }, [mensagens]);

  /* --------------------------------------------------------- polling -- */

  useEffect(() => {
    const tique = () => {
      if (visivel()) void carregarLista({ silencioso: true });
    };
    const timer = setInterval(tique, INTERVALO_LISTA_MS);

    // Voltar para a aba sincroniza na hora: esperar 15 s depois de trocar de
    // janela é justamente quando o usuário está olhando.
    const aoVoltar = () => {
      if (visivel()) void carregarLista({ silencioso: true });
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregarLista]);

  useEffect(() => {
    if (!selecionada) return;

    const tique = () => {
      if (visivel()) void sincronizarThread();
    };
    const timer = setInterval(tique, INTERVALO_THREAD_MS);
    document.addEventListener('visibilitychange', tique);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tique);
    };
  }, [selecionada, sincronizarThread]);

  /* ---------------------------------------------------------- ações -- */

  const responder = async () => {
    const c = selecionada;
    const corpo = texto.trim();
    if (!c || !corpo) return;

    setEnviando(true);
    try {
      const r = await WhatsApp.responder(c.id, corpo);
      setMensagens((atuais) => [r.mensagem, ...atuais]);
      setSelecionada(r.conversa);
      setTexto('');
      // A lista precisa refletir a nova prévia e a reordenação.
      void carregarLista({ silencioso: true });
    } catch (e) {
      showToast(
        'Não foi possível enviar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setEnviando(false);
    }
  };

  const arquivar = async () => {
    const c = selecionada;
    if (!c) return;

    try {
      const nova = await WhatsApp.arquivar(c.id, !c.arquivada);
      setSelecionada(nova);
      showToast(
        nova.arquivada ? 'Conversa arquivada' : 'Conversa desarquivada',
        'info',
        nova.arquivada ? 'Ela volta para a lista se o cliente escrever de novo.' : undefined,
      );
      // Arquivar tira a conversa da lista atual — fechar a thread evita ficar
      // com uma conversa aberta que não está mais em lugar nenhum.
      if (nova.arquivada !== arquivadas) setSelecionada(null);
      void carregarLista({ silencioso: true });
    } catch (e) {
      showToast(
        'Não foi possível arquivar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    }
  };

  const vincular = async (leadId: string | null) => {
    const c = selecionada;
    if (!c) return;

    setSalvandoVinculo(true);
    try {
      const nova = await WhatsApp.vincularLead(c.id, leadId);
      setSelecionada(nova);
      setConversas((atuais) => atuais.map((x) => (x.id === nova.id ? nova : x)));
      setVinculando(false);
      showToast(
        leadId ? 'Conversa vinculada ao lead' : 'Vínculo removido',
        'success',
        leadId ? 'A conversa agora aparece na timeline do lead.' : undefined,
      );
    } catch (e) {
      showToast(
        'Não foi possível vincular',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setSalvandoVinculo(false);
    }
  };

  /* ---------------------------------------------------------- render -- */

  const motivoBloqueio = !conectada
    ? 'O número da empresa está desconectado. Reconecte para responder.'
    : selecionada?.eGrupo
      ? 'Responder em grupo ainda não é suportado pelo sistema. Use o WhatsApp no celular.'
      : null;

  const lista = (
    <ListaConversas
      conversas={conversas}
      selecionadaId={selecionada?.id ?? null}
      busca={busca}
      arquivadas={arquivadas}
      carregando={carregandoLista}
      temMais={!!cursor}
      onBusca={setBusca}
      onAlternarArquivadas={() => {
        setArquivadas((v) => !v);
        setSelecionada(null);
      }}
      onSelecionar={(c) => void abrir(c)}
      onVerMais={() => void verMaisConversas()}
    />
  );

  const thread = selecionada ? (
    <ThreadConversa
      conversa={selecionada}
      mensagens={mensagens}
      temMais={temMais}
      carregando={carregandoThread}
      enviando={enviando}
      podeEnviar={conectada && !selecionada.eGrupo}
      motivoBloqueio={motivoBloqueio}
      texto={texto}
      ehCelular={ehCelular}
      onTexto={setTexto}
      onEnviar={() => void responder()}
      onVerMais={() => void verMaisMensagens()}
      onVoltar={() => setSelecionada(null)}
      onArquivar={() => void arquivar()}
      onVincular={() => setVinculando(true)}
    />
  ) : (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <MessageSquare className="w-8 h-8 text-slate-300 mb-3" />
      <p className="font-bold text-slate-700 text-sm">Escolha uma conversa</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">
        As mensagens enviadas e recebidas pelo número da empresa ficam registradas aqui.
      </p>
    </div>
  );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <Inbox className="w-4 h-4 text-[#004276]" />
        <h2 className="font-extrabold text-sm text-slate-900">Caixa de entrada</h2>
        {naoLidasTotal > 0 && (
          <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
            {naoLidasTotal > 99 ? '99+' : naoLidasTotal}
          </span>
        )}
      </header>

      {/*
        Altura fixa em vez de h-full: o <main> do App é `flex-1 overflow-y-auto`,
        então um filho com h-full não tem contra o que medir e colapsa. O
        min-h garante que a thread continue utilizável em tela baixa.
      */}
      <div className="flex h-[calc(100dvh-20rem)] min-h-[26rem]">
        {ehCelular ? (
          // No celular a thread SUBSTITUI a lista, com botão de voltar. Modal
          // sobre teclado virtual é onde essa interface costuma quebrar.
          <div className="flex-1 min-w-0">{selecionada ? thread : lista}</div>
        ) : (
          <>
            <div className="w-80 shrink-0 border-r border-slate-200">{lista}</div>
            <div className="flex-1 min-w-0">{thread}</div>
          </>
        )}
      </div>

      {vinculando && selecionada && (
        <VincularLead
          conversa={selecionada}
          leads={leads}
          salvando={salvandoVinculo}
          onVincular={(leadId) => void vincular(leadId)}
          onFechar={() => setVinculando(false)}
        />
      )}
    </section>
  );
};
