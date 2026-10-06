// Editor visual do site — edita o site vendo o site.
//
// Rota /sistema/site/editor?pagina=<slug>. É rota de verdade (linkável,
// sobrevive ao F5, o botão voltar funciona) mas pinta `fixed inset-0`, porque
// a casca do CRM — sidebar, cabeçalho, padding — não cabe aqui: a ferramenta
// precisa do viewport inteiro. É o mesmo arranjo do EditorTelhado.
//
// NÃO HÁ PUBLICAÇÃO AUTOMÁTICA. Diferente da tela de Configuração do Site, que
// grava direto no ar, tudo aqui vai para o rascunho da página (V013) e só
// chega ao visitante no botão "Publicar". Era condição para existir um editor
// visual: num editor assim o administrador passa minutos arrastando e
// digitando, e cada passo intermediário iria ao ar.
//
// O autosave salva o RASCUNHO, não publica — e é por isso que ele pode ser
// agressivo (2s) sem ser perigoso. O que ele protege é o trabalho em
// andamento contra um F5 acidental.
//
// O preview é um iframe em /?editor=1, e o conteúdo chega nele por
// postMessage — o raciocínio completo está em src/site/editor/protocolo.ts.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Loader2,
  Monitor,
  Redo2,
  RotateCcw,
  Smartphone,
  Tablet,
  TriangleAlert,
  Undo2,
  UploadCloud,
  WifiOff,
} from 'lucide-react';
import { Site, type BlocoAdmin, type PaginaAdmin, type SiteAdmin } from '../../services/site';
import { ErroApi } from '../../services/http';
import type { SitePublico } from '../../services/publico';
import { REGISTRO_BLOCOS } from '../../site/blocos/registro';
import type { MidiaSite, TipoBloco } from '../../site/blocos/tipos';
import { enviar, receber, type MensagemParaEditor } from '../../site/editor/protocolo';
import type { User } from '../../types';
import { ArvoreBlocos } from './ArvoreBlocos';
import { InspetorBloco } from './InspetorBloco';

/* ------------------------------------------------------------ larguras -- */

/**
 * As três larguras de preview.
 *
 * Escolhidas pelos pontos de corte do Tailwind, não por aparelho: 390 fica
 * abaixo de `md` (768), 820 passa `md` mas não `lg` (1024), e "cheia" usa a
 * janela toda. São exatamente os três layouts que os blocos sabem desenhar —
 * conferir mais larguras que isso não mostraria nada novo.
 *
 * A largura é aplicada no elemento, nunca com transform: scale. Escalar
 * congelaria as media queries na largura original e o preview de celular seria
 * um desktop pequeno, que é o erro que o iframe existe para evitar.
 */
const LARGURAS = [
  { id: 'celular', rotulo: 'Celular', px: 390, Icone: Smartphone },
  { id: 'tablet', rotulo: 'Tablet', px: 820, Icone: Tablet },
  { id: 'cheia', rotulo: 'Computador', px: null, Icone: Monitor },
] as const;

type Largura = (typeof LARGURAS)[number]['id'];

/** Mesmo teto do EditorTelhado: fundo suficiente para desfazer uma sessão. */
const MAX_HISTORICO = 50;

/** Respiro do autosave. Longo o bastante para não postar por tecla digitada. */
const ESPERA_AUTOSAVE = 2000;

/* -------------------------------------------------------------- payload -- */

/**
 * Monta o payload do preview a partir do rascunho em memória.
 *
 * O formato é o mesmo de /api/publico/site de propósito: assim o preview passa
 * pelo caminho normal do site (usePagina → RenderizadorBlocos) sem um ramo
 * "quando for editor faça diferente" dentro dos componentes.
 *
 * Bloco oculto é FILTRADO aqui, como o endpoint público filtra `visivel` — o
 * preview tem de mostrar a página como ela ficará, e a árvore lateral é quem
 * mostra que o bloco existe mas está escondido.
 */
function montarPayload(
  paginas: PaginaAdmin[],
  blocosDaPaginaAtual: BlocoAdmin[],
  paginaAtual: PaginaAdmin,
  menus: SiteAdmin['menus'],
): SitePublico {
  return {
    paginas: paginas.map((p) => {
      const blocos = p.id === paginaAtual.id ? blocosDaPaginaAtual : p.blocos;
      return {
        slug: p.slug,
        caminho: p.caminho,
        titulo_seo: p.tituloSeo,
        descricao_seo: p.descricaoSeo,
        blocos: blocos
          .filter((b) => b.visivel)
          .map((b) => ({ id: b.id, tipo: b.tipo, conteudo: b.conteudo })),
      };
    }),
    menus: Object.fromEntries(
      menus.map((m) => [
        m.chave,
        m.itens
          .filter((i) => i.visivel)
          .map((i) => ({
            id: i.id,
            rotulo: i.rotulo,
            destino: i.destino,
            nova_aba: i.novaAba,
            destaque: i.destaque,
          })),
      ]),
    ),
  };
}

/* ---------------------------------------------------------------- tela -- */

interface Props {
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EditorVisual: React.FC<Props> = ({ showToast }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const slug = params.get('pagina') ?? 'home';

  const [dados, setDados] = useState<SiteAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [blocos, setBlocos] = useState<BlocoAdmin[]>([]);
  const [historico, setHistorico] = useState<BlocoAdmin[][]>([]);
  const [futuro, setFuturo] = useState<BlocoAdmin[][]>([]);

  const [rascunhoEm, setRascunhoEm] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  /** Preenchido num 409: o rascunho não pode mais ser salvo nem publicado. */
  const [travado, setTravado] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [largura, setLargura] = useState<Largura>('cheia');

  /**
   * Quantas vezes o preview se anunciou pronto.
   *
   * CONTADOR, e não booleano. Trocar de página recarrega o iframe, e o
   * documento novo manda `pronto` outra vez — com um booleano, o segundo
   * `pronto` não mudaria estado nenhum, nada re-renderizaria e o conteúdo
   * jamais seria reenviado. O iframe ficaria sem conteúdo para sempre.
   */
  const [prontoEm, setProntoEm] = useState(0);

  const quadro = useRef<HTMLIFrameElement | null>(null);

  const pagina = useMemo(
    () => dados?.paginas.find((p) => p.slug === slug) ?? dados?.paginas[0] ?? null,
    [dados, slug],
  );

  const blocoAtual = useMemo(
    () => blocos.find((b) => b.id === selecionado) ?? null,
    [blocos, selecionado],
  );

  const falhou = useCallback(
    (e: unknown, acao: string) =>
      showToast(acao, 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.'),
    [showToast],
  );

  /* ------------------------------------------------------------ mudança -- */

  // O histórico e os handlers de mensagem precisam do rascunho corrente sem
  // recriar os callbacks a cada tecla digitada — uma ref resolve sem
  // transformar `blocos` em dependência de tudo.
  const blocosRef = useRef<BlocoAdmin[]>(blocos);
  useEffect(() => {
    blocosRef.current = blocos;
  }, [blocos]);

  /**
   * Toda escrita no rascunho passa por aqui.
   *
   * Empilha o estado ANTERIOR (não o novo) e zera o futuro: é o contrato
   * normal de desfazer, e o mesmo do EditorTelhado. Marcar `sujo` aqui, num
   * lugar só, é o que garante que nenhuma edição escape do autosave.
   */
  const aplicar = useCallback((proximos: BlocoAdmin[]) => {
    setHistorico((h) => [...h, blocosRef.current].slice(-MAX_HISTORICO));
    setFuturo([]);
    setBlocos(proximos);
    setSujo(true);
  }, []);

  const desfazer = useCallback(() => {
    setHistorico((h) => {
      if (h.length === 0) return h;
      const anterior = h[h.length - 1]!;
      setFuturo((f) => [blocosRef.current, ...f]);
      setBlocos(anterior);
      setSujo(true);
      return h.slice(0, -1);
    });
  }, []);

  const refazer = useCallback(() => {
    setFuturo((f) => {
      if (f.length === 0) return f;
      const proximo = f[0]!;
      setHistorico((h) => [...h, blocosRef.current].slice(-MAX_HISTORICO));
      setBlocos(proximo);
      setSujo(true);
      return f.slice(1);
    });
  }, []);

  /* ------------------------------------------------------------ carga -- */

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    void Site.carregar()
      .then((site) => {
        if (ativo) setDados(site);
      })
      .catch((e) => {
        if (ativo) {
          setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível abrir o editor.');
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  /**
   * Semeia o rascunho da página escolhida.
   *
   * Abre no rascunho quando existe; sem rascunho, parte do que está no ar.
   * Rascunho desatualizado (a tela antiga publicou algo por cima) já abre
   * travado, porque publicá-lo falharia de qualquer forma — melhor saber antes
   * de investir meia hora editando do que no clique de publicar.
   */
  const semear = useCallback(
    async (paginaId: string, forcarDoAr = false) => {
      const r = await Site.carregarRascunho(paginaId);
      const usarRascunho = !forcarDoAr && r.rascunho && !r.rascunho.desatualizado;

      setBlocos(usarRascunho ? r.rascunho!.blocos : r.blocos);
      setRascunhoEm(usarRascunho ? r.rascunho!.rascunhoEm : null);
      setHistorico([]);
      setFuturo([]);
      setSelecionado(null);
      setSujo(false);

      if (forcarDoAr) {
        setTravado(null);
        return;
      }

      if (r.rascunho?.desatualizado) {
        setTravado(
          'Esta página mudou fora do editor depois que o rascunho começou. ' +
            'Recarregue para partir do conteúdo que está no ar — o rascunho antigo será descartado.',
        );
      } else {
        setTravado(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!pagina) return;
    let ativo = true;

    void semear(pagina.id).catch((e) => {
      if (ativo) falhou(e, 'Não foi possível abrir o rascunho desta página');
    });

    return () => {
      ativo = false;
    };
  }, [pagina, semear, falhou]);

  /* ------------------------------------------------------------ salvar -- */

  const salvar = useCallback(async (): Promise<boolean> => {
    if (!pagina || travado) return false;
    setSalvando(true);
    try {
      const novo = await Site.salvarRascunho(pagina.id, blocosRef.current, rascunhoEm);
      setRascunhoEm(novo);
      setSujo(false);
      return true;
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        setTravado(e.mensagemCompleta);
      } else {
        falhou(e, 'Não foi possível salvar o rascunho');
      }
      return false;
    } finally {
      setSalvando(false);
    }
  }, [pagina, rascunhoEm, travado, falhou]);

  // Autosave. Depende de `sujo` e não de `blocos` para que o timer reinicie a
  // cada edição e não dispare no meio de uma sequência de digitação.
  useEffect(() => {
    if (!sujo || travado || salvando) return;
    const id = window.setTimeout(() => void salvar(), ESPERA_AUTOSAVE);
    return () => window.clearTimeout(id);
  }, [sujo, blocos, travado, salvando, salvar]);

  const publicar = async () => {
    if (!pagina) return;
    setPublicando(true);
    try {
      // Salvar antes é obrigatório: publicar lê o snapshot DO BANCO, então o
      // que não foi salvo simplesmente não iria ao ar — e o administrador
      // veria o editor dizer "publicado" sem a última edição aparecer.
      if (sujo && !(await salvar())) return;

      const publicados = await Site.publicarPagina(pagina.id);
      setBlocos(publicados);
      setRascunhoEm(null);
      setSujo(false);
      setHistorico([]);
      setFuturo([]);
      setDados((d) =>
        d
          ? {
              ...d,
              paginas: d.paginas.map((p) =>
                p.id === pagina.id
                  ? { ...p, blocos: publicados, temRascunho: false, rascunhoEm: null }
                  : p,
              ),
            }
          : d,
      );
      showToast('Página publicada', 'success', `${pagina.nome} já está no ar.`);
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        setTravado(e.mensagemCompleta);
      } else {
        falhou(e, 'Não foi possível publicar');
      }
    } finally {
      setPublicando(false);
    }
  };

  const descartar = async () => {
    if (!pagina) return;
    if (
      !window.confirm(
        'Descartar o rascunho? Tudo o que foi editado aqui e ainda não foi publicado é perdido, ' +
          'e o editor volta ao conteúdo que está no ar.',
      )
    )
      return;

    try {
      await Site.descartarRascunho(pagina.id);
      await semear(pagina.id, true);
      showToast('Rascunho descartado', 'info', 'O editor voltou ao conteúdo publicado.');
    } catch (e) {
      falhou(e, 'Não foi possível descartar o rascunho');
    }
  };

  /* ------------------------------------------- ações sobre os blocos -- */

  const adicionar = (tipo: TipoBloco) => {
    // O id é gerado aqui porque o bloco precisa de identidade estável antes de
    // existir no banco — é o que permite selecioná-lo e reordená-lo sem ter
    // publicado nada. Ver blocoRascunhoSchema em site.routes.ts.
    const novo: BlocoAdmin = {
      id: crypto.randomUUID(),
      paginaId: pagina?.id ?? '',
      tipo,
      ordem: blocos.length + 1,
      visivel: true,
      conteudo: REGISTRO_BLOCOS[tipo].padrao(),
    };
    aplicar([...blocos, novo]);
    setSelecionado(novo.id);
  };

  const excluir = (id: string) => {
    const nome = REGISTRO_BLOCOS[blocos.find((b) => b.id === id)?.tipo as TipoBloco]?.rotulo ?? 'bloco';
    if (!window.confirm(`Excluir o bloco "${nome}"? Ele só some do site quando você publicar.`)) {
      return;
    }
    aplicar(blocos.filter((b) => b.id !== id));
    if (selecionado === id) setSelecionado(null);
  };

  const alternarVisivel = (id: string) =>
    aplicar(blocos.map((b) => (b.id === id ? { ...b, visivel: !b.visivel } : b)));

  const alterarConteudo = (conteudo: Record<string, unknown>) => {
    if (!blocoAtual) return;
    aplicar(blocos.map((b) => (b.id === blocoAtual.id ? { ...b, conteudo } : b)));
  };

  /* ------------------------------------------- conversa com o preview -- */

  const payload = useMemo(
    () => (dados && pagina ? montarPayload(dados.paginas, blocos, pagina, dados.menus) : null),
    [dados, pagina, blocos],
  );

  useEffect(() => {
    const janela = quadro.current?.contentWindow;
    if (!janela || prontoEm === 0 || !payload || !pagina) return;

    const id = window.setTimeout(() => {
      enviar(janela, { tipo: 'conteudo', dados: { site: payload, caminho: pagina.caminho } });
    }, 120);

    return () => window.clearTimeout(id);
  }, [payload, pagina, prontoEm]);

  /**
   * Espelha a seleção no preview.
   *
   * Vale nos dois sentidos: clicar na árvore destaca e rola até o bloco no
   * site, e clicar no site destaca na árvore (pelo `selecionou` que chega de
   * volta). Reenviar a seleção que veio do próprio preview é inofensivo — ele
   * já está nesse estado e o setState não re-renderiza.
   */
  useEffect(() => {
    const janela = quadro.current?.contentWindow;
    if (!janela || prontoEm === 0) return;

    enviar(janela, { tipo: 'selecao', dados: { blocoId: selecionado, elementoId: null } });
    if (selecionado) {
      enviar(janela, { tipo: 'rolar_para', dados: { blocoId: selecionado } });
    }
  }, [selecionado, prontoEm]);

  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      const msg = receber<MensagemParaEditor>(evento, quadro.current?.contentWindow ?? null);
      if (!msg) return;

      if (msg.tipo === 'pronto') {
        setProntoEm((n) => n + 1);
        return;
      }

      if (msg.tipo === 'selecionou') {
        setSelecionado(msg.dados.blocoId);
        return;
      }

      // Texto digitado no lugar, tamanho arrastado numa alça e lista
      // reordenada gravam do mesmo jeito: um caminho e um valor novo. O que
      // muda entre eles é só o tipo do valor.
      if (msg.tipo === 'lista') {
        const { blocoId, campo, lista } = msg.dados;
        aplicar(
          blocosRef.current.map((b) =>
            b.id === blocoId ? { ...b, conteudo: gravarEm(b.conteudo, campo, lista) } : b,
          ),
        );
        return;
      }

      if (msg.tipo === 'texto' || msg.tipo === 'imagem') {
        const { blocoId, campo, valor } = msg.dados;
        aplicar(
          blocosRef.current.map((b) =>
            b.id === blocoId ? { ...b, conteudo: gravarEm(b.conteudo, campo, valor) } : b,
          ),
        );
        return;
      }

      if (msg.tipo === 'elemento') {
        const { blocoId, elementoId, x, y, largura, altura } = msg.dados;
        aplicar(
          blocosRef.current.map((b) => {
            if (b.id !== blocoId) return b;
            const lista = (b.conteudo.elementos as Record<string, unknown>[] | undefined) ?? [];
            return {
              ...b,
              conteudo: {
                ...b.conteudo,
                elementos: lista.map((el) =>
                  el.id === elementoId ? { ...el, x, y, largura, altura } : el,
                ),
              },
            };
          }),
        );
        return;
      }

      if (msg.tipo === 'ordem') {
        const porId = new Map(blocosRef.current.map((b) => [b.id, b]));
        const reordenados = msg.dados.ordem
          .map((id) => porId.get(id))
          .filter((b): b is BlocoAdmin => !!b);
        // Bloco oculto não vai no payload do preview, então não volta na
        // ordem — ele é reanexado no fim para não sumir do rascunho.
        const ocultos = blocosRef.current.filter((b) => !msg.dados.ordem.includes(b.id));
        aplicar([...reordenados, ...ocultos]);
      }
    };

    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [aplicar]);

  /* ----------------------------------------------------------- teclado -- */

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      // Digitando num campo, as teclas são do campo. Sem esta guarda, Ctrl+Z
      // dentro de um input desfaria a edição do bloco inteiro.
      if (
        alvo &&
        (alvo.isContentEditable ||
          alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
        return;
      }

      if (e.key === 'Escape') setSelecionado(null);
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [desfazer, refazer]);

  /** Fechar a aba com rascunho não salvo é o jeito mais fácil de perder trabalho. */
  useEffect(() => {
    if (!sujo) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [sujo]);

  const sair = () => {
    if (sujo && !window.confirm('Há alterações não salvas no rascunho. Sair mesmo assim?')) return;
    navigate('/sistema/site');
  };

  /* ------------------------------------------------------------ estados -- */

  if (carregando) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Abrindo o editor…</p>
      </div>
    );
  }

  if (erro || !dados || !pagina) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8">
          <WifiOff className="w-9 h-9 text-rose-500 mx-auto mb-4" />
          <h2 className="font-extrabold text-base text-slate-900 mb-2">
            Não foi possível abrir o editor
          </h2>
          <p className="text-sm text-slate-600 mb-6">{erro ?? 'Nenhuma página encontrada.'}</p>
          <button
            onClick={() => navigate('/sistema/site')}
            className="px-4 py-2 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
          >
            Voltar para Configuração do Site
          </button>
        </div>
      </div>
    );
  }

  const larguraAtual = LARGURAS.find((l) => l.id === largura)!;
  const temRascunho = !!rascunhoEm || sujo;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-200">
      {/* ------------------------------------------------------ topo --- */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sair}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-[#004276] rounded-lg hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Configuração do Site
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <select
          value={pagina.slug}
          onChange={(e) => setParams({ pagina: e.target.value }, { replace: true })}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-[#004276]"
        >
          {dados.paginas.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.nome}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {LARGURAS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLargura(l.id)}
              title={l.rotulo}
              className={`p-1.5 rounded-md transition ${
                largura === l.id
                  ? 'bg-white text-[#004276] shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <l.Icone className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={desfazer}
            disabled={historico.length === 0}
            title="Desfazer (Ctrl+Z)"
            className="p-1.5 text-slate-400 hover:text-[#004276] disabled:opacity-25 rounded-lg hover:bg-slate-50"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={refazer}
            disabled={futuro.length === 0}
            title="Refazer (Ctrl+Shift+Z)"
            className="p-1.5 text-slate-400 hover:text-[#004276] disabled:opacity-25 rounded-lg hover:bg-slate-50"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1.5">
            {salvando ? (
              <>
                <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                salvando…
              </>
            ) : sujo ? (
              'alterações não salvas'
            ) : rascunhoEm ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                rascunho salvo
              </>
            ) : (
              'igual ao que está no ar'
            )}
          </span>

          {temRascunho && (
            <button
              type="button"
              onClick={() => void descartar()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 text-slate-600 hover:border-rose-300 hover:text-rose-600 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Descartar
            </button>
          )}

          <button
            type="button"
            onClick={() => void publicar()}
            disabled={publicando || !!travado || !temRascunho}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#004276] hover:bg-[#003158] disabled:bg-slate-300 text-white shadow-sm transition"
          >
            {publicando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            Publicar
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------- travado --- */}
      {travado && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center gap-3">
          <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-900 flex-1 min-w-0 leading-relaxed">{travado}</p>
          <button
            type="button"
            onClick={() => void semear(pagina.id, true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            Recarregar do que está no ar
          </button>
        </div>
      )}

      {/* ----------------------------------------------------- corpo --- */}
      <div className="flex-1 min-h-0 flex">
        <aside className="w-56 shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col">
          <ArvoreBlocos
            blocos={blocos}
            selecionado={selecionado}
            onSelecionar={setSelecionado}
            onReordenar={aplicar}
            onAlternarVisivel={alternarVisivel}
            onExcluir={excluir}
            onAdicionar={adicionar}
          />
        </aside>

        <div className="flex-1 min-w-0 overflow-auto flex justify-center p-4">
          <div
            className="bg-white shadow-xl rounded-lg overflow-hidden transition-[width] duration-200 h-full"
            style={{ width: larguraAtual.px ?? '100%', maxWidth: '100%' }}
          >
            {/* A key força um iframe NOVO a cada página, em vez de reaproveitar
                o elemento e só trocar o src. Com o reaproveitamento, a
                navegação do iframe entra no histórico do navegador e o botão
                voltar passa a desfazer trocas de página do preview em vez de
                sair do editor. */}
            <iframe
              key={pagina.caminho}
              ref={quadro}
              src={`${pagina.caminho}?editor=1`}
              title={`Preview de ${pagina.nome}`}
              className="w-full h-full border-0"
            />
          </div>
        </div>

        <aside className="w-80 shrink-0 bg-white border-l border-slate-200 hidden lg:flex flex-col">
          <InspetorBloco
            bloco={blocoAtual}
            midia={dados.midia}
            onMidiaAlterada={(midia: MidiaSite[]) =>
              setDados((d) => (d ? { ...d, midia } : d))
            }
            onAlterar={alterarConteudo}
            onExcluir={() => blocoAtual && excluir(blocoAtual.id)}
            showToast={showToast}
          />
        </aside>
      </div>
    </div>
  );
};

/**
 * Resolve um segmento de caminho dentro de um array.
 *
 * Aceita duas formas, e ambas são usadas: índice ("itens.2.titulo") para as
 * listas que o site renderiza na ordem guardada, e id ("elementos.<uuid>.texto")
 * para a área livre, que reordena os elementos por (y, x) ao desenhar — ali o
 * índice visto na tela não é o índice guardado, e só o id é estável.
 */
function indiceNoArray(lista: unknown[], segmento: string): number {
  const porIndice = Number(segmento);
  if (Number.isInteger(porIndice) && porIndice >= 0 && porIndice < lista.length) return porIndice;
  return lista.findIndex((i) => (i as { id?: string } | null)?.id === segmento);
}

/**
 * Grava um valor num caminho do conteúdo ("titulo", "itens.2.texto").
 *
 * Imutável por nível: copia só o que está no caminho e reaproveita o resto, que
 * é o que o React precisa para re-renderizar o bloco certo sem recriar a
 * árvore inteira. Os segmentos chegam como string porque o caminho vem de um
 * atributo do DOM.
 */
function gravarEm(
  objeto: Record<string, unknown>,
  caminho: string,
  valor: unknown,
): Record<string, unknown> {
  const partes = caminho.split('.');
  const copia: Record<string, unknown> = { ...objeto };
  let atual: any = copia;

  for (let i = 0; i < partes.length - 1; i++) {
    const bruto = partes[i]!;
    const filho = atual[bruto];

    if (Array.isArray(atual)) {
      // Nunca acontece na primeira volta (o conteúdo é sempre objeto), mas
      // acontece em "elementos.<id>.texto" a partir da segunda.
      break;
    }

    if (Array.isArray(filho)) {
      const copiaLista = [...filho];
      atual[bruto] = copiaLista;
      const prox = partes[i + 1]!;
      const j = indiceNoArray(copiaLista, prox);
      // Caminho apontando para item que não existe mais (apagado em outra
      // aba, por exemplo): desiste em silêncio em vez de criar um buraco.
      if (j < 0) return objeto;
      copiaLista[j] = { ...(copiaLista[j] as object) };
      atual = copiaLista[j];
      i++; // o segmento do índice/id já foi consumido aqui
      continue;
    }

    atual[bruto] = { ...(filho as object) };
    atual = atual[bruto];
  }

  atual[partes[partes.length - 1]!] = valor;
  return copia;
}

export default EditorVisual;
