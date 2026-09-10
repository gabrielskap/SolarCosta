// Editor do layout de módulos em tela cheia.
//
// A figura do card é uma foto estática de 640×640 com um SVG por cima: serve
// para conferir de relance e para imprimir, mas não deixa aproximar nem
// corrigir nada. Aqui o telhado abre num mapa de satélite de verdade, com zoom
// contínuo, e cada placa vira um polígono que o consultor pode arrastar,
// acrescentar, remover ou girar.
//
// Por que Maps JS e não a imagem estática ampliada: o Static Maps entrega no
// máximo 640×640 (com scale=2, 1280 px reais). Dá para exibir isso em tela
// cheia com nitidez, mas acaba ali — passou do 1:1, borra. O mapa interativo
// rebusca o tile a cada nível, então aproximar continua nítido até o limite
// óptico do satélite.
//
// O que este componente NÃO faz: mexer na proposta. Ele recebe uma cópia do
// layout, edita à vontade e só devolve em "Aplicar". Cancelar joga tudo fora.
// Quem grava é o PainelTelhado, pelo caminho de sempre.
//
// A geometria toda mora em utils/edicaoLayout.ts — aqui só tem mapa, clique e
// pintura.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Layers,
  Loader2,
  Maximize2,
  MousePointer2,
  Move,
  Plus,
  Redo2,
  Rows3,
  Ruler,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { ModuloLayout } from '../../types';
import { type TelhadoSolar } from '../../services/solar';
import {
  criarModulo,
  criarPlano,
  enquadrar,
  paraMetros,
  rosaDosVentos,
  rotacaoSegmento,
  type Coordenada,
  type DimensoesModulo,
} from '../../utils/layoutModulos';
import {
  adicionarModulo,
  contarPorSegmento,
  criarContexto,
  dentroDaMascara,
  girarSegmento,
  moverArranjo,
  moverModulo,
  removerModulo,
} from '../../utils/edicaoLayout';
import { useGoogleMaps } from './useGoogleMaps';

/** Sem @types/google.maps no projeto; não vale a dependência por um arquivo. */
type GMap = any;
type GPolygon = any;

/** Ferramenta ativa. Governa o cursor, o que o clique faz e o que arrasta. */
type Ferramenta = 'selecionar' | 'adicionar' | 'remover' | 'arranjo';

/**
 * Cor por água do telhado.
 *
 * Distinguir as águas é o que torna "2 águas identificadas" verificável: o
 * consultor vê na hora se o Google separou o telhado como ele separaria, ou se
 * juntou a garagem com a casa.
 */
const CORES = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#facc15'];
const corDoSegmento = (i: number) => CORES[Math.abs(i) % CORES.length];

/** Acima disto a máscara vira mais atrapalho que ajuda — e trava o mapa. */
const MAX_MASCARA_DESENHADA = 600;

/** Limite de passos guardados no desfazer. */
const MAX_HISTORICO = 50;

interface EditorTelhadoProps {
  aberto: boolean;
  onFechar: () => void;
  telhado: TelhadoSolar;
  /** Layout que está na tela hoje — o editor trabalha sobre uma cópia. */
  modulos: ModuloLayout[];
  /** Quantos módulos o dimensionamento pediu, para mostrar o alvo. */
  modulosQtd: number;
  modulo: DimensoesModulo;
  espacamentoM: number;
  chaveMaps: string | null | undefined;
  enderecoFormatado?: string;
  onAplicar: (modulos: ModuloLayout[], modulo: DimensoesModulo, espacamentoM: number) => void;
}

export const EditorTelhado: React.FC<EditorTelhadoProps> = ({
  aberto,
  onFechar,
  telhado,
  modulos: modulosIniciais,
  modulosQtd,
  modulo: moduloInicial,
  espacamentoM: espacamentoInicial,
  chaveMaps,
  enderecoFormatado,
  onAplicar,
}) => {
  const { pronto, carregando, erro } = useGoogleMaps(chaveMaps, aberto);

  const [modulos, setModulos] = useState<ModuloLayout[]>(modulosIniciais);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [mostrarMascara, setMostrarMascara] = useState(false);
  const [dim, setDim] = useState<DimensoesModulo>(moduloInicial);
  const [espacamento, setEspacamento] = useState(espacamentoInicial);
  const [giro, setGiro] = useState(0);

  const [historico, setHistorico] = useState<ModuloLayout[][]>([]);
  const [futuro, setFuturo] = useState<ModuloLayout[][]>([]);

  const mapaDiv = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<GMap>(null);
  const poligonos = useRef<GPolygon[]>([]);
  const poligonosMascara = useRef<GPolygon[]>([]);
  /**
   * Handles dos NOSSOS ouvintes, por polígono.
   *
   * Guardados um a um porque `clearInstanceListeners` derruba tudo que está
   * pendurado no objeto — inclusive os ouvintes internos que implementam o
   * arrasto do próprio Maps. Usá-lo aqui deixaria o polígono `draggable` e
   * imóvel, um bug silencioso e difícil de ligar à causa.
   */
  const ouvintes = useRef<any[][]>([]);
  /** Estado de um arrasto em curso, para o modo "mover água". */
  const arrasto = useRef<{ origem: Coordenada; irmaos: Array<{ p: GPolygon; caminho: Coordenada[] }> } | null>(null);
  /** Snapshot de onde o giro começou: o slider é absoluto, não incremental. */
  const baseGiro = useRef<ModuloLayout[] | null>(null);

  /**
   * Contexto de edição — malha, fases, ordem das águas.
   *
   * Depende do layout de ABERTURA, não do atual, e essa é a razão de ser do
   * `modulosIniciais` congelado: a fase da grade precisa ficar parada. Se
   * recalculasse a cada arrasto, a malha seguiria a última placa movida e cada
   * encaixe herdaria o desvio do anterior.
   */
  const ctx = useMemo(
    () =>
      criarContexto({
        segmentos: telhado.segmentos,
        mascara: telhado.placasGoogle.map((p) => ({
          centro: p.centro,
          segmentoIndice: p.segmentoIndice,
        })),
        placaMascara: { alturaM: telhado.placaGoogle.alturaM, larguraM: telhado.placaGoogle.larguraM },
        modulo: dim,
        espacamentoM: espacamento,
        modulos: modulosIniciais,
      }),
    // `modulosIniciais` de propósito fora: ver o comentário acima.
    [telhado, dim, espacamento], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Vagas do empacotamento automático, para o "adicionar" ter onde encaixar. */
  const segmentoSelecionado =
    selecionado != null && modulos[selecionado] ? modulos[selecionado]!.segmento : null;

  /* ------------------------------------------------------- histórico -- */

  const aplicarMudanca = useCallback(
    (novos: ModuloLayout[]) => {
      setModulos((atuais) => {
        if (novos === atuais) return atuais;
        setHistorico((h) => [...h.slice(-(MAX_HISTORICO - 1)), atuais]);
        setFuturo([]);
        return novos;
      });
    },
    [],
  );

  const desfazer = useCallback(() => {
    setHistorico((h) => {
      if (h.length === 0) return h;
      const anterior = h[h.length - 1]!;
      setModulos((atuais) => {
        setFuturo((f) => [atuais, ...f]);
        return anterior;
      });
      setSelecionado(null);
      return h.slice(0, -1);
    });
  }, []);

  const refazer = useCallback(() => {
    setFuturo((f) => {
      if (f.length === 0) return f;
      const proximo = f[0]!;
      setModulos((atuais) => {
        setHistorico((h) => [...h, atuais]);
        return proximo;
      });
      setSelecionado(null);
      return f.slice(1);
    });
  }, []);

  /* ------------------------------------------------- ciclo de vida -- */

  // Reabrir precisa partir do layout atual da proposta, não do que ficou da
  // sessão anterior de edição.
  useEffect(() => {
    if (!aberto) return;
    setModulos(modulosIniciais);
    setDim(moduloInicial);
    setEspacamento(espacamentoInicial);
    setHistorico([]);
    setFuturo([]);
    setSelecionado(null);
    setFerramenta('selecionar');
    setGiro(0);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape fecha; Delete remove a placa selecionada.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionado != null) {
        e.preventDefault();
        aplicarMudanca(removerModulo(modulos, selecionado));
        setSelecionado(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, selecionado, modulos, onFechar, aplicarMudanca, desfazer, refazer]);

  // A página atrás não pode rolar enquanto o editor ocupa a tela.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  /* ------------------------------------------------------ o mapa -- */

  useEffect(() => {
    if (!aberto || !pronto || !mapaDiv.current || mapa.current) return;
    const g = (window as any).google;

    const enq = enquadrar(modulosIniciais, [
      telhado.centro,
      ...telhado.segmentos.map((s) => s.centro),
    ]);

    mapa.current = new g.maps.Map(mapaDiv.current, {
      center: { lat: enq.centro.latitude, lng: enq.centro.longitude },
      zoom: enq.zoom,
      mapTypeId: 'satellite',
      // Sem inclinação e sem rotação: o layout é calculado em planta, e uma
      // vista oblíqua faria as placas parecerem fora do telhado.
      tilt: 0,
      rotateControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      // O satélite tem cobertura óptica nativa até o 20; daí para cima é
      // ampliação digital. Deixamos passar um pouco para o ajuste fino, mas o
      // ganho de detalhe acaba no 20.
      maxZoom: 22,
      minZoom: 15,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });

    return () => {
      // setMap(null) já solta os ouvintes junto com o objeto; zerar o array
      // evita que um índice velho aponte para handle de um mapa que morreu.
      poligonos.current.forEach((p) => p.setMap(null));
      poligonos.current = [];
      ouvintes.current = [];
      poligonosMascara.current.forEach((p) => p.setMap(null));
      poligonosMascara.current = [];
      mapa.current = null;
    };
  }, [aberto, pronto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clique no mapa (fora de qualquer placa): adiciona ou limpa a seleção.
  useEffect(() => {
    if (!mapa.current || !pronto) return;
    const g = (window as any).google;
    const ouvinte = mapa.current.addListener('click', (e: any) => {
      const ponto: Coordenada = { latitude: e.latLng.lat(), longitude: e.latLng.lng() };
      if (ferramenta === 'adicionar') {
        aplicarMudanca(adicionarModulo(ctx, modulos, ponto));
        return;
      }
      setSelecionado(null);
    });
    return () => g.maps.event.removeListener(ouvinte);
  }, [pronto, ferramenta, modulos, ctx, aplicarMudanca]);

  /**
   * Sincroniza os polígonos com o estado.
   *
   * Atualiza os que já existem em vez de recriar tudo: recriar a cada arrasto
   * pisca e perde o polígono debaixo do cursor no meio do gesto.
   */
  useEffect(() => {
    if (!mapa.current || !pronto) return;
    const g = (window as any).google;

    /** Solta só os ouvintes que este componente pendurou no polígono. */
    const soltarOuvintes = (i: number) => {
      ouvintes.current[i]?.forEach((h) => g.maps.event.removeListener(h));
      ouvintes.current[i] = [];
    };

    // Sobrando polígono de uma remoção: tira do mapa.
    while (poligonos.current.length > modulos.length) {
      const i = poligonos.current.length - 1;
      soltarOuvintes(i);
      ouvintes.current.pop();
      poligonos.current.pop()?.setMap(null);
    }

    modulos.forEach((m, i) => {
      const caminho = m.cantos.map((c) => ({ lat: c.latitude, lng: c.longitude }));
      const cor = corDoSegmento(m.segmento);
      const ativo = selecionado === i;
      const estilo = {
        fillColor: ativo ? '#ffffff' : '#0b1b2b',
        fillOpacity: ativo ? 0.55 : 0.82,
        strokeColor: ativo ? '#ffd100' : cor,
        strokeWeight: ativo ? 3 : 1.6,
        zIndex: ativo ? 20 : 10,
        draggable: ferramenta === 'selecionar' || ferramenta === 'arranjo',
        clickable: true,
      };

      let p = poligonos.current[i];
      if (!p) {
        p = new g.maps.Polygon({ ...estilo, paths: caminho, map: mapa.current });
        poligonos.current[i] = p;
      } else {
        p.setOptions(estilo);
        p.setPath(caminho);
      }

      // Ouvintes trocam junto com a ferramenta/índice — solta antes de religar.
      soltarOuvintes(i);
      const meus: any[] = [];
      ouvintes.current[i] = meus;

      meus.push(
        p.addListener('click', (e: any) => {
          if (e?.domEvent) e.domEvent.stopPropagation();
          if (ferramenta === 'remover') {
            aplicarMudanca(removerModulo(modulos, i));
            setSelecionado(null);
            return;
          }
          setSelecionado(i);
          setGiro(0);
        }),
      );

      meus.push(
        p.addListener('dragstart', () => {
          setSelecionado(i);
          if (ferramenta !== 'arranjo') return;
          // Guarda o caminho original das irmãs para arrastá-las juntas.
          arrasto.current = {
            origem: m.centro,
            irmaos: modulos
              .map((outro, j) => ({ outro, j }))
              .filter(({ outro, j }) => j !== i && outro.segmento === m.segmento)
              .map(({ j }) => ({
                p: poligonos.current[j],
                caminho: modulos[j]!.cantos.map((c) => ({ ...c })),
              })),
          };
        }),
      );

      meus.push(
        // Arrasto do bloco: as irmãs acompanham em tempo real. Sem isto o
        // consultor arrastaria uma placa sozinha e as outras só saltariam para
        // o lugar ao soltar — parece que o gesto não funcionou.
        p.addListener('drag', () => {
          if (ferramenta !== 'arranjo' || !arrasto.current) return;
          const centroAtual = centroDoPoligono(p);
          const dLat = centroAtual.latitude - arrasto.current.origem.latitude;
          const dLng = centroAtual.longitude - arrasto.current.origem.longitude;
          for (const irmao of arrasto.current.irmaos) {
            if (!irmao.p) continue;
            irmao.p.setPath(
              irmao.caminho.map((c) => ({ lat: c.latitude + dLat, lng: c.longitude + dLng })),
            );
          }
        }),
      );

      meus.push(
        p.addListener('dragend', (e: any) => {
          const centroNovo = centroDoPoligono(p);

          if (ferramenta === 'arranjo') {
            // Deslocamento em metros no plano do contexto: a diferença entre
            // onde a placa arrastada estava e onde foi solta.
            const antes = paraMetros(ctx.plano, m.centro);
            const depois = paraMetros(ctx.plano, centroNovo);
            arrasto.current = null;
            aplicarMudanca(
              moverArranjo(ctx, modulos, m.segmento, {
                x: depois.x - antes.x,
                y: depois.y - antes.y,
              }),
            );
            return;
          }

          // Alt durante o arrasto solta o encaixe na malha.
          const livre = !!e?.domEvent?.altKey;
          aplicarMudanca(moverModulo(ctx, modulos, i, centroNovo, { livre }));
        }),
      );
    });
  }, [pronto, modulos, selecionado, ferramenta, ctx, aplicarMudanca]);

  /** Máscara do Google: o "porquê" do empacotamento automático ter parado ali. */
  useEffect(() => {
    if (!mapa.current || !pronto) return;
    const g = (window as any).google;

    poligonosMascara.current.forEach((p) => p.setMap(null));
    poligonosMascara.current = [];
    if (!mostrarMascara) return;

    const plano = criarPlano(telhado.segmentos[0]?.centro ?? telhado.centro);
    const placa = { larguraM: telhado.placaGoogle.larguraM, alturaM: telhado.placaGoogle.alturaM };

    telhado.placasGoogle.slice(0, MAX_MASCARA_DESENHADA).forEach((pg) => {
      const seg = telhado.segmentos.find((s) => s.indice === pg.segmentoIndice);
      if (!seg) return;
      const rot = rotacaoSegmento(seg.azimuteGraus);
      const uv = rot.paraUV(paraMetros(plano, pg.centro));
      const fake = criarModulo(plano, seg, uv.u, uv.v, placa, rot);
      poligonosMascara.current.push(
        new g.maps.Polygon({
          paths: fake.cantos.map((c) => ({ lat: c.latitude, lng: c.longitude })),
          map: mapa.current,
          fillColor: '#22d3ee',
          fillOpacity: 0.16,
          strokeColor: '#22d3ee',
          strokeOpacity: 0.5,
          strokeWeight: 0.6,
          clickable: false,
          zIndex: 1,
        }),
      );
    });
  }, [pronto, mostrarMascara, telhado]);

  /* ------------------------------------------------------- ações -- */

  const aoGirar = (valor: number) => {
    if (segmentoSelecionado == null) return;
    if (baseGiro.current === null) baseGiro.current = modulos;
    setGiro(valor);
    // Gira SEMPRE a partir do snapshot: aplicar deltas sucessivos acumularia
    // erro e as placas iriam escorregando a cada meio grau.
    setModulos(girarSegmento(ctx, baseGiro.current, segmentoSelecionado, valor));
  };

  const confirmarGiro = () => {
    if (baseGiro.current && baseGiro.current !== modulos) {
      setHistorico((h) => [...h.slice(-(MAX_HISTORICO - 1)), baseGiro.current!]);
      setFuturo([]);
    }
    baseGiro.current = null;
  };

  const aplicarDimensoes = (novaDim: DimensoesModulo, novoEsp: number) => {
    setDim(novaDim);
    setEspacamento(novoEsp);
    // Não redimensiona aqui: o `ctx` recalcula pelo useMemo e o efeito abaixo
    // reconstrói as placas com a medida nova, mantendo cada centro.
  };

  // Redesenha as placas quando a medida muda, preservando os centros.
  const dimAnterior = useRef(dim);
  const espAnterior = useRef(espacamento);
  useEffect(() => {
    if (dimAnterior.current === dim && espAnterior.current === espacamento) return;
    dimAnterior.current = dim;
    espAnterior.current = espacamento;
    setModulos((atuais) =>
      atuais.map((m) => {
        const seg = telhado.segmentos.find((s) => s.indice === m.segmento) ?? {
          indice: m.segmento,
          azimuteGraus: m.azimuteGraus,
        };
        const rot = rotacaoSegmento(seg.azimuteGraus);
        const uv = rot.paraUV(paraMetros(ctx.plano, m.centro));
        return criarModulo(ctx.plano, seg, uv.u, uv.v, dim, rot);
      }),
    );
  }, [dim, espacamento, ctx, telhado]);

  if (!aberto) return null;

  const faltam = modulosQtd - modulos.length;
  const porSegmento = contarPorSegmento(ctx, modulos);
  const foraDaMascara = modulos.filter((m) => !dentroDaMascara(ctx, m.centro)).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-[#004276] text-white shrink-0">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
            <Maximize2 className="w-4 h-4 shrink-0" />
            Layout do telhado
          </h2>
          <p className="text-[11px] text-blue-100 truncate">
            {enderecoFormatado ?? 'Arraste, acrescente ou remova as placas conforme o telhado.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="p-2 rounded-xl hover:bg-white/15 transition shrink-0"
          aria-label="Fechar editor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Mapa */}
        <div className="relative flex-1 min-h-0 bg-slate-900">
          <div ref={mapaDiv} className="absolute inset-0" />

          {(carregando || (!pronto && !erro)) && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando o mapa…
            </div>
          )}

          {erro && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-[11px] text-amber-900">
                <p className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Não foi possível abrir o mapa interativo: {erro} A proposta continua
                    válida — o layout automático segue valendo, só não dá para ajustar à mão
                    agora.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Barra de ferramentas */}
          {pronto && (
            <div className="absolute top-3 left-3 flex flex-col gap-1 rounded-2xl bg-white/95 backdrop-blur p-1.5 shadow-lg">
              <Ferramentinha
                ativa={ferramenta === 'selecionar'}
                onClick={() => setFerramenta('selecionar')}
                icone={<MousePointer2 className="w-4 h-4" />}
                titulo="Selecionar e mover placa (Alt solta o encaixe)"
              />
              <Ferramentinha
                ativa={ferramenta === 'adicionar'}
                onClick={() => setFerramenta('adicionar')}
                icone={<Plus className="w-4 h-4" />}
                titulo="Adicionar placa: clique sobre o telhado"
              />
              <Ferramentinha
                ativa={ferramenta === 'remover'}
                onClick={() => setFerramenta('remover')}
                icone={<Trash2 className="w-4 h-4" />}
                titulo="Remover placa: clique sobre ela"
              />
              <Ferramentinha
                ativa={ferramenta === 'arranjo'}
                onClick={() => setFerramenta('arranjo')}
                icone={<Move className="w-4 h-4" />}
                titulo="Mover a água inteira: arraste qualquer placa dela"
              />
              <div className="h-px bg-slate-200 my-0.5" />
              <Ferramentinha
                ativa={false}
                desabilitada={historico.length === 0}
                onClick={desfazer}
                icone={<Undo2 className="w-4 h-4" />}
                titulo="Desfazer (Ctrl+Z)"
              />
              <Ferramentinha
                ativa={false}
                desabilitada={futuro.length === 0}
                onClick={refazer}
                icone={<Redo2 className="w-4 h-4" />}
                titulo="Refazer (Ctrl+Shift+Z)"
              />
              <div className="h-px bg-slate-200 my-0.5" />
              <Ferramentinha
                ativa={mostrarMascara}
                onClick={() => setMostrarMascara((v) => !v)}
                icone={<Layers className="w-4 h-4" />}
                titulo="Mostrar a área que o Google considerou aproveitável"
              />
            </div>
          )}

          {pronto && (
            <p className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] text-white/90 max-w-xs leading-relaxed">
              {ferramenta === 'selecionar' && 'Arraste uma placa para reposicionar. Segure Alt para sair da malha.'}
              {ferramenta === 'adicionar' && 'Clique sobre o telhado para acrescentar uma placa.'}
              {ferramenta === 'remover' && 'Clique numa placa para removê-la.'}
              {ferramenta === 'arranjo' && 'Arraste qualquer placa para deslocar a água inteira.'}
            </p>
          )}
        </div>

        {/* Painel lateral */}
        <div className="w-full lg:w-80 shrink-0 bg-white flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Contagem */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Módulos posicionados
                </p>
                <p
                  className={`text-lg font-extrabold ${
                    faltam > 0 ? 'text-amber-700' : 'text-[#004276]'
                  }`}
                >
                  {modulos.length} <span className="text-xs font-bold">de {modulosQtd}</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    faltam > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, modulosQtd ? (modulos.length / modulosQtd) * 100 : 0)}%`,
                  }}
                />
              </div>
              {faltam > 0 && (
                <p className="mt-2 text-[10px] text-amber-800">
                  Faltam {faltam} para o kit dimensionado.
                </p>
              )}
              {faltam < 0 && (
                <p className="mt-2 text-[10px] text-slate-600">
                  {-faltam} a mais que o kit dimensionado.
                </p>
              )}
            </div>

            {/* Giro da água selecionada */}
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <Rows3 className="w-3.5 h-3.5" />
                Girar a água selecionada
              </p>
              {segmentoSelecionado == null ? (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Selecione uma placa para girar o arranjo daquela água.
                </p>
              ) : (
                <>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={0.5}
                    value={giro}
                    onChange={(e) => aoGirar(Number(e.target.value))}
                    onPointerUp={confirmarGiro}
                    onKeyUp={confirmarGiro}
                    className="mt-2 w-full accent-[#004276]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Água {segmentoSelecionado}</span>
                    <span className="font-bold text-slate-700">
                      {giro > 0 ? '+' : ''}
                      {giro.toFixed(1)}°
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                    Use quando as fileiras não acompanharem a cumeeira da foto.
                  </p>
                </>
              )}
            </div>

            {/* Tamanho da placa */}
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <Ruler className="w-3.5 h-3.5" />
                Tamanho da placa
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <CampoMedida
                  rotulo="Largura (m)"
                  valor={dim.larguraM}
                  onChange={(v) => aplicarDimensoes({ ...dim, larguraM: v }, espacamento)}
                />
                <CampoMedida
                  rotulo="Altura (m)"
                  valor={dim.alturaM}
                  onChange={(v) => aplicarDimensoes({ ...dim, alturaM: v }, espacamento)}
                />
                <CampoMedida
                  rotulo="Espaçamento (m)"
                  valor={espacamento}
                  onChange={(v) => aplicarDimensoes(dim, v)}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
                Vem dos parâmetros do sistema. Altere quando o kit fechar com um módulo de
                outra medida — as placas são redesenhadas no mesmo lugar.
              </p>
            </div>

            {/* Águas */}
            {porSegmento.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Águas aproveitadas
                </p>
                <ul className="mt-2 space-y-1.5">
                  {porSegmento.map((s) => (
                    <li key={s.segmento} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: corDoSegmento(s.segmento) }}
                      />
                      <span className="text-slate-600">
                        Água {s.segmento} · {rosaDosVentos(s.azimuteGraus)}
                      </span>
                      <span className="ml-auto font-bold text-slate-800">{s.modulos}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {foraDaMascara > 0 && (
              <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>{foraDaMascara}</strong>{' '}
                  {foraDaMascara === 1 ? 'placa está' : 'placas estão'} fora da área que o
                  Google mapeou como telhado. Pode ser laje ou anexo que não aparece na foto —
                  confirme na visita.
                </p>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="shrink-0 border-t border-slate-200 p-3 flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onAplicar(modulos, dim, espacamento)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-xs font-bold hover:bg-[#003158] transition"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Centro geométrico do polígono como está no mapa agora. */
function centroDoPoligono(p: GPolygon): Coordenada {
  const pontos: any[] = p.getPath().getArray();
  const n = pontos.length || 1;
  return {
    latitude: pontos.reduce((t, c) => t + c.lat(), 0) / n,
    longitude: pontos.reduce((t, c) => t + c.lng(), 0) / n,
  };
}

const Ferramentinha: React.FC<{
  ativa: boolean;
  desabilitada?: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titulo: string;
}> = ({ ativa, desabilitada, onClick, icone, titulo }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={desabilitada}
    title={titulo}
    aria-label={titulo}
    aria-pressed={ativa}
    className={`p-2 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed ${
      ativa ? 'bg-[#004276] text-white' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    {icone}
  </button>
);

const CampoMedida: React.FC<{
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
}> = ({ rotulo, valor, onChange }) => (
  <label className="block">
    <span className="block text-[9px] font-bold uppercase text-slate-400">{rotulo}</span>
    <input
      type="number"
      step={0.01}
      min={0.1}
      value={valor}
      onChange={(e) => {
        const n = Number(e.target.value);
        // Medida zerada faria o passo da malha virar zero e o encaixe dividir
        // por zero — ignora em vez de aceitar e quebrar o layout.
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#004276] focus:outline-none"
    />
  </label>
);
