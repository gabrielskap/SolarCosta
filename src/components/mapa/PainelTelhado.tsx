// Card "Localização e layout do telhado" da calculadora de propostas.
//
// Fluxo: endereço -> coordenada (Geocoding) -> análise do Google (Solar API)
// -> empacotamento dos NOSSOS módulos (utils/layoutModulos) -> figura.
//
// O consultor decide se aproveita: nada aqui altera o dimensionamento. A
// quantidade de módulos continua vindo de dimensionar(); esta tela só mostra
// onde eles caberiam e avisa quando não cabem.
//
// A busca acontece SOZINHA quando o CEP é preenchido em Dados do cliente: o
// pai monta a string `consultaAuto` e este componente decide quando gastar as
// chamadas. Cada rodada custa três requisições faturadas ao Google (Geocoding,
// Solar API e Static Maps), então quase tudo que parece paranoia aqui —
// debounce, memo da última busca, token de sequência, quebra-circuito — está
// protegendo a fatura, não a renderização.
//
// O card é só a vista de conferência. Ajustar as placas acontece no
// EditorTelhado, em tela cheia, sobre o mapa interativo. O que volta de lá
// entra em `layoutManual` e passa a mandar na figura — ver o efeito de
// `modulosQtd` para o que acontece quando o kit muda depois disso.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  MapPinned,
  Maximize2,
  RotateCcw,
  Satellite,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { MedidaModulo, ModuloLayout, SegmentoLayout } from '../../types';
import { paramNum, type ConfigApp } from '../../services/api';
import {
  buscarTelhado,
  dataMaisRecente,
  descreverImagem,
  geocodificar,
  idadeImagemAnos,
  imagemTelhado,
  legendaSatelite,
  type EnderecoGeocodificado,
  type TelhadoSolar,
} from '../../services/solar';
import {
  calcularLayout,
  enquadrar,
  type DimensoesModulo,
  type Enquadramento,
} from '../../utils/layoutModulos';
import { ajustarQuantidade, criarContexto, segmentosOrientados } from '../../utils/edicaoLayout';
import { TelhadoSatelite } from './TelhadoSatelite';
import { EditorTelhado } from './EditorTelhado';

/** Acima disso a foto é velha o bastante para o telhado ter mudado. */
const IMAGEM_VELHA_ANOS = 3;

/**
 * Espera antes de disparar a cadeia paga.
 *
 * Dimensionada pela digitação do número do imóvel: "5" -> "51" -> "512" são
 * três valores de `consultaAuto` em menos de um segundo, e sem a espera
 * viravam três rodadas de três chamadas.
 */
const ESPERA_AUTO_MS = 700;

/** O que o painel devolve para a proposta quando a busca dá certo. */
export interface DadosTelhadoProposta {
  latitude: number;
  longitude: number;
  placeId: string;
  enderecoFormatado: string;
  edificacaoId: string;
  mapaZoom: number;
  telhadoImagemData?: string;
  telhadoAreaM2: number;
  layoutModulos: ModuloLayout[];
  layoutSegmentos: SegmentoLayout[];
  /** O layout veio do editor, não do empacotamento automático. */
  layoutAjusteManual: boolean;
  /** Medida da placa, quando o editor a redefiniu. Nula = valem os parâmetros. */
  layoutModulo?: MedidaModulo;
}

/** Coordenada que já provou acertar o telhado (gravada num lead). */
export interface CoordenadaConhecida {
  latitude: number;
  longitude: number;
  placeId?: string;
}

/** De onde partiu a rodada — muda como as falhas são comunicadas. */
type Origem = 'auto' | 'manual';

/** Por que a busca automática parou no meio. Nulo = nada a avisar. */
type AvisoAuto = 'aproximado' | 'sem_telhado' | 'nao_localizado' | null;

interface PainelTelhadoProps {
  /** Endereço digitado na proposta — a busca MANUAL parte dele. */
  endereco: string;
  cidade: string;
  /** Só para decidir se vale insistir num ponto aproximado; a consulta já vem montada. */
  numeroEndereco: string;
  /**
   * Endereço pronto para geocodificar, montado pelo pai a partir do ViaCEP.
   * Nulo = não há alvo automático (CEP ainda não consultado, ou CEP geral de
   * cidade, que geocodifica no centro do município e só gasta chamada à toa).
   * Mudou = endereço diferente, o painel busca sozinho.
   */
  consultaAuto: string | null;
  /** Coordenada já conhecida (lead). Pula o geocoding: uma chamada a menos. */
  coordenadaConhecida?: CoordenadaConhecida | null;
  /** Quantos módulos o dimensionamento pediu. */
  modulosQtd: number;
  config: ConfigApp | null;
  onResultado: (r: DadosTelhadoProposta | null) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const PainelTelhado: React.FC<PainelTelhadoProps> = ({
  endereco,
  cidade,
  numeroEndereco,
  consultaAuto,
  coordenadaConhecida,
  modulosQtd,
  config,
  onResultado,
  showToast,
}) => {
  const [buscando, setBuscando] = useState(false);
  const [geo, setGeo] = useState<EnderecoGeocodificado | null>(null);
  const [telhado, setTelhado] = useState<TelhadoSolar | null>(null);
  const [modulos, setModulos] = useState<ModuloLayout[]>([]);
  const [capacidade, setCapacidade] = useState(0);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [avisoAuto, setAvisoAuto] = useState<AvisoAuto>(null);

  /**
   * Layout ajustado à mão no editor. Nulo = o automático manda, que é o
   * comportamento de sempre.
   *
   * Preenchido, ele passa a ser a posição de verdade: o recálculo por mudança
   * de kit para de sobrescrever e passa a só acertar a diferença.
   */
  const [layoutManual, setLayoutManual] = useState<ModuloLayout[] | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);

  /**
   * Medida da placa definida no editor, quando difere da cadastrada nos
   * parâmetros (kit fechado com módulo de outra potência).
   */
  const [dimEditor, setDimEditor] = useState<DimensoesModulo | null>(null);
  const [espEditor, setEspEditor] = useState<number | null>(null);

  /**
   * Quantos módulos o kit pedia quando o ajuste manual foi aplicado.
   *
   * É o que transforma "o kit mudou" em um número: o efeito compara este valor
   * com o `modulosQtd` atual e move só a DIFERENÇA. Sem ele, o efeito
   * empurraria o layout manual de volta para `modulosQtd` no primeiro render
   * depois de aplicar — desfazendo, por exemplo, a placa que o consultor tirou
   * de propósito por causa de uma chaminé.
   */
  const qtdBaseManual = useRef(0);

  /**
   * Enquadramento da imagem que está na tela — NÃO o do layout corrente.
   *
   * A foto é baixada uma vez por busca; o layout é recalculado a cada tecla no
   * campo de consumo. Se o SVG re-enquadrasse junto, os módulos escorregariam
   * da telha, porque a foto por trás continua a mesma. Então o quadro fica
   * congelado até uma nova imagem chegar.
   */
  const [enquadramentoImagem, setEnquadramentoImagem] = useState<Enquadramento | null>(null);

  /**
   * A API respondeu que o Google Maps está desligado. Um 503 basta: sem a
   * chave, cada CEP digitado repetiria a mesma requisição perdida. O botão
   * manual continua vivo, para o consultor ver o erro de propósito.
   */
  const [autoIndisponivel, setAutoIndisponivel] = useState(false);

  // A API diz de antemão se a chave existe (GET /api/config). Quando o campo
  // não vem — API mais antiga — o padrão é tentar.
  const recursoDesligado = config?.google_maps_ativo === false;
  const autoBloqueada = autoIndisponivel || recursoDesligado;

  // Chave da Maps JavaScript API. Sem ela o card funciona igual, só não abre
  // em tela cheia — é uma chave separada da que a API usa no servidor.
  const chaveMaps = config?.google_maps_browser_key ?? null;

  // Object URL não é coletado enquanto a aba viver: guardamos o atual para
  // revogar antes de trocar e no desmonte.
  const urlAtual = useRef<string | null>(null);
  const trocarImagem = useCallback((nova: string | null) => {
    if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
    urlAtual.current = nova;
    setImagemUrl(nova);
  }, []);
  useEffect(() => () => trocarImagem(null), [trocarImagem]);

  /**
   * Chave do que já foi buscado ('end:<consulta>' ou 'coord:<lat>,<lng>').
   *
   * É o que impede repetir chamada paga quando um efeito roda de novo com o
   * mesmo alvo: re-render do pai, clique em REMOVER, recarga da lista de leads
   * depois de salvar. Só um alvo DIFERENTE volta a disparar.
   */
  const ultimaBusca = useRef<string | null>(null);

  /**
   * Token de sequência: cada rodada ganha um número e só a mais recente
   * escreve na tela.
   *
   * Não é firula de UI — a checagem entre os `await` aborta as chamadas
   * restantes de uma rodada obsoleta, e é aí que está o dinheiro: a Solar API
   * é a mais cara das três.
   */
  const sequencia = useRef(0);

  const moduloParam = {
    larguraM: paramNum(config, 'layout.modulo_largura_m', 2.38),
    alturaM: paramNum(config, 'layout.modulo_altura_m', 1.3),
  };
  const espacamentoParam = paramNum(config, 'layout.espacamento_m', 0.02);

  // O editor pode redefinir a medida da placa; sem isso vale o parâmetro.
  const modulo = dimEditor ?? moduloParam;
  const espacamentoM = espEditor ?? espacamentoParam;

  /**
   * Medida a gravar na proposta — só quando difere do parâmetro do sistema.
   *
   * Repetir o valor cadastrado em toda proposta congelaria na linha do tempo
   * um número que deveria continuar seguindo o cadastro: trocado o módulo
   * padrão da empresa, as propostas antigas continuariam certas (a geometria
   * já está gravada) mas "Refazer automático" nelas usaria a medida velha.
   */
  const medidaSeDiferente = (d: DimensoesModulo, esp: number): MedidaModulo | undefined => {
    const igual =
      d.larguraM === moduloParam.larguraM &&
      d.alturaM === moduloParam.alturaM &&
      esp === espacamentoParam;
    return igual ? undefined : { larguraM: d.larguraM, alturaM: d.alturaM, espacamentoM: esp };
  };

  /**
   * Recalcula o layout AUTOMÁTICO — na primeira busca e sempre que o kit muda
   * de tamanho.
   *
   * Não escreve enquadramento nenhum de propósito: quem desenha precisa do
   * quadro da FOTO (ver `enquadramentoImagem`), e um `setState` aqui dentro
   * viraria laço com o efeito que reage a `modulosQtd`.
   */
  const recalcular = useCallback(
    (t: TelhadoSolar, quantidade: number) => {
      const r = calcularLayout({
        segmentos: t.segmentos,
        mascara: t.placasGoogle.map((p) => ({
          centro: p.centro,
          segmentoIndice: p.segmentoIndice,
        })),
        placaMascara: { alturaM: t.placaGoogle.alturaM, larguraM: t.placaGoogle.larguraM },
        modulo,
        espacamentoM,
        quantidade,
      });
      setModulos(r.modulos);
      setCapacidade(r.capacidadeMaxima);
      return r;
    },
    // `modulo`/`espacamentoM` são derivados de `config` e do editor — depender
    // deles evita recriar o callback a cada render por causa dos objetos novos.
    [config, dimEditor, espEditor], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Empacota o resultado para a proposta.
   *
   * Existe como função por ser chamada de dois lugares (fim da busca e
   * recálculo por mudança de kit): são dez campos, e montá-los em duplicata
   * garantiria divergência no primeiro campo novo — o mesmo motivo que fez
   * nascer o `montarProposta` do componente pai.
   */
  const emitirResultado = useCallback(
    (
      g: EnderecoGeocodificado,
      t: TelhadoSolar,
      posicionados: ModuloLayout[],
      zoom: number,
      manual?: { modulo?: MedidaModulo },
    ) => {
      const d = dataMaisRecente(t);
      onResultado({
        latitude: g.latitude,
        longitude: g.longitude,
        placeId: g.placeId,
        enderecoFormatado: g.enderecoFormatado,
        edificacaoId: t.edificacaoId,
        mapaZoom: zoom,
        telhadoImagemData: d
          ? `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`
          : undefined,
        telhadoAreaM2: t.areaTelhadoM2,
        layoutModulos: posicionados,
        layoutSegmentos: t.segmentos.map((s) => ({
          indice: s.indice,
          azimuteGraus: s.azimuteGraus,
          inclinacaoGraus: s.inclinacaoGraus,
          areaM2: s.areaM2,
        })),
        layoutAjusteManual: !!manual,
        // Só grava a medida quando o editor a mudou: repetir o parâmetro em
        // toda proposta congelaria um valor que deveria seguir o cadastro.
        layoutModulo: manual?.modulo,
      });
    },
    // `onResultado` fora das deps: é o setState do pai hoje, mas se um dia
    // virar arrow inline a identidade mudaria a cada render e o efeito que
    // depende desta função entraria em laço.
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Desliga a auto-busca ao primeiro 503. Devolve true quando tratou o erro. */
  const marcarSeDesligado = (codigo?: string) => {
    if (codigo !== 'google_maps_desligado') return false;
    setAutoIndisponivel(true);
    showToast(
      'Busca por satélite indisponível',
      'info',
      'A chave do Google Maps não está configurada nesta instalação; a busca automática foi desligada.',
    );
    return true;
  };

  /** Trecho comum: coordenada -> telhado -> layout -> figura. */
  const analisar = async (g: EnderecoGeocodificado, origem: Origem, meuTurno: number) => {
    const atual = () => sequencia.current === meuTurno;
    setGeo(g);

    // Ponto aproximado e sem número informado: PARA AQUI.
    //
    // Não é economia de toast, é de fatura. RANGE_INTERPOLATED é um chute ao
    // longo da via e a Solar API responde 404 nele mesmo em cidade coberta.
    // Gasta uma chamada e poupa duas; o número chega, `consultaAuto` muda e a
    // rodada boa acontece sozinha.
    if (origem === 'auto' && !g.confiavel && !numeroEndereco.trim()) {
      setAvisoAuto('aproximado');
      return;
    }

    const resposta = await buscarTelhado(g.latitude, g.longitude);
    if (!atual()) return;

    const t = resposta.telhado;
    if (!resposta.ok || !t) {
      if (marcarSeDesligado(resposta.codigo)) return;
      if (origem === 'auto') {
        setAvisoAuto('sem_telhado');
        return;
      }
      // 404 aqui quase nunca é falta de cobertura: é o geocoding tendo caído
      // no meio da rua. A mensagem precisa dizer o que fazer.
      showToast(
        'Telhado não analisado',
        'error',
        g.confiavel
          ? resposta.erro
          : `${resposta.erro} O endereço foi localizado de forma aproximada (${g.precisao}); confira se está completo, com número.`,
      );
      return;
    }

    // Busca nova recomeça do automático: o ajuste manual era daquele telhado,
    // naquela coordenada. Mantê-lo aqui grudaria placas de um imóvel no outro.
    setLayoutManual(null);
    qtdBaseManual.current = 0;

    const r = recalcular(t, modulosQtd);
    const pontosContexto = [t.centro, ...t.segmentos.map((s) => s.centro)];
    const enq = enquadrar(r.modulos, pontosContexto);

    const img = await imagemTelhado(
      enq.centro.latitude,
      enq.centro.longitude,
      enq.zoom,
      enq.larguraPx,
      enq.alturaPx,
    );
    if (!atual()) {
      // Rodada perdida: ninguém vai adotar este object URL, e sem revogar ele
      // fica preso até a aba fechar.
      if (img.url) URL.revokeObjectURL(img.url);
      return;
    }

    trocarImagem(img.url ?? null);
    // Foto e quadro entram juntos, e `telhado` fecha o trio que o efeito de
    // `modulosQtd` espera para emitir o resultado à proposta.
    setEnquadramentoImagem(enq);
    setTelhado(t);

    if (!img.ok) {
      // A figura ainda vale sem o fundo: o consultor confere a disposição.
      showToast('Sem imagem de satélite', 'info', img.erro);
    }

    showToast(
      'Telhado analisado',
      r.couberam < r.solicitados ? 'info' : 'success',
      `${r.couberam} de ${r.solicitados} módulos posicionados.`,
    );
  };

  /** Do endereço em texto até a figura. TRÊS chamadas pagas. */
  const buscarPorEndereco = async (consulta: string, origem: Origem) => {
    const meuTurno = ++sequencia.current;
    ultimaBusca.current = `end:${consulta}`;
    setBuscando(true);
    setAvisoAuto(null);
    try {
      const busca = await geocodificar(consulta);
      if (sequencia.current !== meuTurno) return;

      const g = busca.endereco;
      if (!busca.ok || !g) {
        if (marcarSeDesligado(busca.codigo)) return;
        if (origem === 'auto') {
          setAvisoAuto('nao_localizado');
          return;
        }
        showToast('Endereço não localizado', 'error', busca.erro);
        return;
      }

      await analisar(g, origem, meuTurno);
    } finally {
      // Sem a checagem, uma rodada obsoleta apagaria o spinner da atual.
      if (sequencia.current === meuTurno) setBuscando(false);
    }
  };

  /**
   * Da coordenada já conhecida até a figura. DUAS chamadas: o geocoding é
   * pulado, e de quebra o ponto é melhor — ele já provou acertar o telhado
   * quando foi gravado no lead.
   */
  const buscarPorCoordenada = async (c: CoordenadaConhecida) => {
    const meuTurno = ++sequencia.current;
    setBuscando(true);
    setAvisoAuto(null);
    try {
      await analisar(
        {
          latitude: c.latitude,
          longitude: c.longitude,
          precisao: 'ROOFTOP',
          confiavel: true,
          enderecoFormatado: [endereco, cidade].filter(Boolean).join(', '),
          placeId: c.placeId ?? '',
          bairro: null,
          cidade: null,
          uf: null,
          cep: null,
        },
        'auto',
        meuTurno,
      );
    } finally {
      if (sequencia.current === meuTurno) setBuscando(false);
    }
  };

  /** Botão: parte do que estiver escrito no formulário, erros como toast. */
  const buscarManual = () => {
    const consulta = [endereco, cidade].filter(Boolean).join(', ');
    if (!consulta.trim()) {
      showToast('Endereço vazio', 'error', 'Preencha o endereço da instalação antes de buscar.');
      return;
    }
    void buscarPorEndereco(consulta, 'manual');
  };

  // O CEP (ou o número) mudou o alvo: o painel se vira sozinho.
  useEffect(() => {
    if (!consultaAuto || autoBloqueada) return;
    if (ultimaBusca.current === `end:${consultaAuto}`) return;
    const timer = setTimeout(() => void buscarPorEndereco(consultaAuto, 'auto'), ESPERA_AUTO_MS);
    return () => clearTimeout(timer);
    // Só o ALVO importa aqui. `buscarPorEndereco` é recriada a cada render e
    // nas deps dispararia a busca de novo a cada renderização do pai.
  }, [consultaAuto, autoBloqueada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lead com coordenada gravada: abre já localizado, sem geocodificar.
  useEffect(() => {
    if (!coordenadaConhecida || autoBloqueada) return;
    const chave = `coord:${coordenadaConhecida.latitude.toFixed(6)},${coordenadaConhecida.longitude.toFixed(6)}`;
    // O pai recria o objeto a cada render; sem a chave em texto isto buscaria
    // a cada renderização.
    if (ultimaBusca.current === chave) return;
    ultimaBusca.current = chave;
    void buscarPorCoordenada(coordenadaConhecida);
  }, [coordenadaConhecida, autoBloqueada]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * O kit mudou depois da busca: reposiciona SEM gastar chamada e REGRAVA o
   * resultado.
   *
   * A re-emissão é o ponto: antes o layout da tela se atualizava e o da
   * proposta ficava com a quantidade antiga de módulos, que era justamente o
   * que ia impresso. Este efeito também é o único emissor depois de uma busca
   * — o trio (telhado, geo, enquadramentoImagem) fica pronto junto e ele
   * dispara em seguida. NÃO criar um segundo emissor: é essa unicidade que
   * mantém a figura da tela e a da proposta iguais.
   *
   * Com ajuste manual em vigor o efeito muda de papel: em vez de reempacotar
   * tudo, aplica ao layout do consultor a MESMA variação que o kit sofreu.
   * Cresceu dois módulos, entram dois nas vagas automáticas livres; encolheu
   * um, sai um da água menos ensolarada. O que ele posicionou não se mexe.
   */
  useEffect(() => {
    if (!telhado || !geo || !enquadramentoImagem) return;

    // Roda sempre: além do layout automático, é daqui que sai a capacidade
    // máxima mostrada no card, que independe do ajuste manual.
    const auto = recalcular(telhado, modulosQtd);

    if (!layoutManual) {
      emitirResultado(geo, telhado, auto.modulos, enquadramentoImagem.zoom);
      return;
    }

    const delta = modulosQtd - qtdBaseManual.current;
    const alvo = Math.max(0, layoutManual.length + delta);

    if (delta === 0) {
      setModulos(layoutManual);
      emitirResultado(geo, telhado, layoutManual, enquadramentoImagem.zoom, {
        modulo: medidaSeDiferente(modulo, espacamentoM),
      });
      return;
    }

    const ctx = criarContexto({
      segmentos: telhado.segmentos,
      mascara: telhado.placasGoogle.map((p) => ({
        centro: p.centro,
        segmentoIndice: p.segmentoIndice,
      })),
      placaMascara: {
        alturaM: telhado.placaGoogle.alturaM,
        larguraM: telhado.placaGoogle.larguraM,
      },
      modulo,
      espacamentoM,
      modulos: layoutManual,
    });

    // Candidatos = capacidade cheia do telhado, não só os `modulosQtd`
    // primeiros: as vagas boas podem estar depois do corte quando o consultor
    // já ocupou as melhores à mão.
    //
    // As vagas saem no ângulo em que o consultor deixou cada água, não no do
    // Google: numa água girada 90° no editor, candidatas no ângulo original
    // entrariam deitadas no meio das placas em pé.
    const candidatos = calcularLayout({
      segmentos: segmentosOrientados(telhado.segmentos, layoutManual),
      mascara: telhado.placasGoogle.map((p) => ({
        centro: p.centro,
        segmentoIndice: p.segmentoIndice,
      })),
      placaMascara: {
        alturaM: telhado.placaGoogle.alturaM,
        larguraM: telhado.placaGoogle.larguraM,
      },
      modulo,
      espacamentoM,
      quantidade: Number.MAX_SAFE_INTEGER,
    }).modulos;

    const ajustado = ajustarQuantidade(ctx, layoutManual, candidatos, alvo);
    qtdBaseManual.current = modulosQtd;
    setLayoutManual(ajustado);
    setModulos(ajustado);
    emitirResultado(geo, telhado, ajustado, enquadramentoImagem.zoom, {
      modulo: medidaSeDiferente(modulo, espacamentoM),
    });
  }, [
    modulosQtd,
    telhado,
    geo,
    enquadramentoImagem,
    layoutManual,
    recalcular,
    emitirResultado,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Volta ao "Aplicar" do editor: adota o layout ajustado e regrava. */
  const aplicarEdicao = (
    novos: ModuloLayout[],
    dimNova: DimensoesModulo,
    espNovo: number,
  ) => {
    setEditorAberto(false);
    qtdBaseManual.current = modulosQtd;
    setDimEditor(dimNova);
    setEspEditor(espNovo);
    setLayoutManual(novos);
    setModulos(novos);
    if (geo && telhado && enquadramentoImagem) {
      emitirResultado(geo, telhado, novos, enquadramentoImagem.zoom, {
        modulo: medidaSeDiferente(dimNova, espNovo),
      });
    }
    showToast(
      'Layout ajustado',
      'success',
      `${novos.length} ${novos.length === 1 ? 'módulo posicionado' : 'módulos posicionados'} manualmente.`,
    );
  };

  /** Descarta o ajuste manual e devolve o telhado ao empacotamento automático. */
  const refazerAutomatico = () => {
    setLayoutManual(null);
    setDimEditor(null);
    setEspEditor(null);
    qtdBaseManual.current = 0;
    showToast('Layout automático', 'info', 'O ajuste manual foi descartado.');
  };

  const limpar = () => {
    // Invalida qualquer rodada em voo: sem isto, uma busca ainda a caminho
    // repovoaria o painel logo depois do clique.
    sequencia.current += 1;
    setBuscando(false);
    setGeo(null);
    setTelhado(null);
    setModulos([]);
    setEnquadramentoImagem(null);
    setCapacidade(0);
    setAvisoAuto(null);
    setLayoutManual(null);
    setDimEditor(null);
    setEspEditor(null);
    setEditorAberto(false);
    qtdBaseManual.current = 0;
    trocarImagem(null);
    onResultado(null);
  };

  const idade = telhado ? idadeImagemAnos(telhado) : null;
  const faltam = modulosQtd - modulos.length;
  const ajustadoManualmente = layoutManual !== null;
  const podeExpandir = !!telhado && !!chaveMaps;
  // O kit mudou o suficiente para o quadro ideal não ser mais o da foto.
  const enquadramentoDefasado =
    !!enquadramentoImagem &&
    modulos.length > 0 &&
    enquadrar(
      modulos,
      telhado ? [telhado.centro, ...telhado.segmentos.map((s) => s.centro)] : undefined,
    ).zoom !== enquadramentoImagem.zoom;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#004276]">
            <Satellite className="w-4 h-4" />
            LOCALIZAÇÃO E LAYOUT DO TELHADO
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Posiciona os módulos sobre a imagem de satélite do imóvel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {modulos.length > 0 && (
            <button
              type="button"
              onClick={limpar}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              REMOVER
            </button>
          )}
          {podeExpandir && (
            <button
              type="button"
              onClick={() => setEditorAberto(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#004276]/25 bg-[#004276]/5 text-[11px] font-bold text-[#004276] hover:bg-[#004276]/10 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              AJUSTAR PLACAS
            </button>
          )}
          {!recursoDesligado && (
            <button
              type="button"
              onClick={buscarManual}
              disabled={buscando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#004276] text-white text-[11px] font-bold hover:bg-[#003158] disabled:opacity-50 transition"
            >
              {buscando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPinned className="w-3.5 h-3.5" />
              )}
              {telhado ? 'BUSCAR NOVAMENTE' : 'BUSCAR POR SATÉLITE'}
            </button>
          )}
        </div>
      </div>

      {/* Avisos da busca automática: ficam FORA do bloco do telhado, senão uma
          falha não apareceria em lugar nenhum — que era o caso antes. */}
      <div className="space-y-2 empty:hidden">
        {avisoAuto === 'aproximado' && (
          <Aviso tom="alerta" resumo={`Localização aproximada (${geo?.precisao}) — informe o número`}>
            O ponto caiu sobre a via, não sobre a edificação.{' '}
            <strong>Informe o número do imóvel</strong> em Dados do cliente: a busca refaz
            sozinha.
          </Aviso>
        )}
        {avisoAuto === 'sem_telhado' && (
          <Aviso tom="alerta" resumo="Sem análise de telhado para este ponto">
            O Google não tem análise de telhado aqui. Confira o endereço — com número e
            bairro — ou use <strong>Buscar por satélite</strong> depois de ajustá-lo.
          </Aviso>
        )}
        {avisoAuto === 'nao_localizado' && (
          <Aviso tom="alerta" resumo="Endereço não localizado a partir do CEP">
            Complete o endereço da instalação e use <strong>Buscar por satélite</strong>.
          </Aviso>
        )}
        {recursoDesligado && (
          <Aviso tom="atencao" resumo="Busca por satélite desativada nesta instalação">
            A chave do Google Maps não está configurada. A proposta continua válida — só não
            sai com a página do telhado.
          </Aviso>
        )}
      </div>

      {!telhado && !buscando && !avisoAuto && !recursoDesligado && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
          Preencha o <strong>CEP</strong> e o <strong>número</strong> em Dados do cliente — a
          busca acontece sozinha. Quanto mais completo o endereço, maior a chance de o ponto
          cair sobre a edificação.
        </p>
      )}

      {!telhado && buscando && (
        <p className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Localizando o imóvel e analisando o telhado…
        </p>
      )}

      {telhado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          {/* A figura inteira vira o alvo de clique: é o gesto que as pessoas
              já tentam numa foto pequena. O botão do cabeçalho continua, para
              quem navega por teclado e para deixar a ação visível sem hover. */}
          <div className="relative group">
            <TelhadoSatelite
              modulos={modulos}
              imagemUrl={imagemUrl}
              enquadramento={enquadramentoImagem ?? undefined}
              legenda={legendaSatelite(telhado)}
            />
            {podeExpandir && (
              <button
                type="button"
                onClick={() => setEditorAberto(true)}
                aria-label="Abrir o telhado em tela cheia para ajustar as placas"
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100 focus-visible:bg-slate-950/45 focus-visible:opacity-100 focus:outline-none"
              >
                <span className="flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2 text-[11px] font-bold text-[#004276] shadow-lg">
                  <Maximize2 className="w-3.5 h-3.5" />
                  AMPLIAR E AJUSTAR
                </span>
              </button>
            )}
            {ajustadoManualmente && (
              <span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-[#004276] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                Ajustado manualmente
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Indicador
                titulo="Módulos posicionados"
                valor={`${modulos.length} de ${modulosQtd}`}
                destaque={faltam > 0 ? 'alerta' : 'ok'}
                progresso={modulosQtd > 0 ? modulos.length / modulosQtd : 0}
              />
              <Indicador titulo="Capacidade do telhado" valor={`${capacidade} módulos`} />
              <Indicador
                titulo="Área do telhado"
                valor={`${telhado.areaTelhadoM2.toFixed(0)} m²`}
              />
              <Indicador titulo="Águas identificadas" valor={`${telhado.segmentos.length}`} />
            </div>

            {ajustadoManualmente && (
              <div className="flex items-center gap-2 rounded-xl border border-[#004276]/20 bg-[#004276]/5 px-3 py-2 text-[11px] text-[#004276]">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Layout ajustado à mão.</span>
                <button
                  type="button"
                  onClick={refazerAutomatico}
                  className="ml-auto flex items-center gap-1 font-bold underline underline-offset-2 hover:text-[#003158]"
                >
                  <RotateCcw className="w-3 h-3" />
                  Refazer automático
                </button>
              </div>
            )}

            {faltam > 0 && (
              <Aviso
                tom="alerta"
                resumo={`Couberam ${modulos.length} dos ${modulosQtd} módulos dimensionados`}
              >
                O telhado comporta no máximo {capacidade}. Reveja o consumo, considere módulo
                de outra potência ou uma área adicional.
              </Aviso>
            )}

            {geo && !geo.confiavel && (
              <Aviso
                tom="alerta"
                resumo={`Endereço localizado de forma aproximada (${geo.precisao})`}
              >
                O ponto não caiu sobre a edificação. Confira se a figura corresponde ao
                imóvel do cliente — vale abrir em tela cheia para comparar.
              </Aviso>
            )}

            {/* Sem a chave de browser o botão de tela cheia simplesmente não
                aparece — e o consultor não tem como saber por quê. Este aviso
                é o que separa "recurso desligado nesta instalação" de "a tela
                está quebrada", que foi como pareceu na primeira vez. */}
            {!chaveMaps && !recursoDesligado && (
              <Aviso tom="atencao" resumo="Ajuste manual das placas indisponível aqui">
                O editor em tela cheia precisa da chave{' '}
                <strong>GOOGLE_MAPS_BROWSER_KEY</strong> (Maps JavaScript API) configurada na
                API. Sem ela vale o layout automático, e a proposta sai normalmente — só não
                dá para arrastar as placas.
              </Aviso>
            )}

            {enquadramentoDefasado && (
              <Aviso tom="atencao" resumo="O kit mudou de tamanho depois da busca">
                A figura mantém o enquadramento da foto original — use{' '}
                <strong>Buscar novamente</strong> se os módulos não couberem mais no quadro.
              </Aviso>
            )}

            {idade !== null && idade > IMAGEM_VELHA_ANOS && (
              <Aviso
                tom="atencao"
                resumo={`Levantamento de ${Math.floor(idade)} anos atrás`}
              >
                {descreverImagem(telhado)}. A foto ao lado é atualizada e em alta resolução,
                mas o levantamento de inclinação/águas foi feito na data de referência.
                Confira se a disposição dos módulos bate com o telhado visível na foto.
              </Aviso>
            )}

            <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
              <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase text-slate-500 marker:content-['']">
                <ChevronDown className="w-3.5 h-3.5 transition group-open:rotate-180" />
                Detalhes da análise
              </summary>
              <p className="px-3 pb-3 text-[10px] leading-relaxed text-slate-500">
                Endereço localizado: {geo?.enderecoFormatado}. {descreverImagem(telhado)}. Foto
                de satélite atualizada via Google Maps em alta resolução. O posicionamento usa
                o módulo de {modulo.larguraM.toFixed(2)} × {modulo.alturaM.toFixed(2)} m
                {dimEditor ? ' definido no editor' : ' cadastrado nos parâmetros'}, com{' '}
                {espacamentoM.toFixed(2)} m de espaçamento.
              </p>
            </details>
          </div>
        </div>
      )}

      {/* Monta só quando abre: fechado, o editor ficaria recalculando o
          contexto de edição (máscara do Google, que passa de mil pontos em
          telhado grande) a cada tecla digitada no campo de consumo. Montar na
          hora também garante que ele sempre parta do layout atual. */}
      {telhado && editorAberto && (
        <EditorTelhado
          aberto={editorAberto}
          onFechar={() => setEditorAberto(false)}
          telhado={telhado}
          modulos={modulos}
          modulosQtd={modulosQtd}
          modulo={modulo}
          espacamentoM={espacamentoM}
          chaveMaps={chaveMaps}
          enderecoFormatado={geo?.enderecoFormatado}
          onAplicar={aplicarEdicao}
        />
      )}
    </div>
  );
};

const Indicador: React.FC<{
  titulo: string;
  valor: string;
  destaque?: 'ok' | 'alerta';
  /** 0..1. Quando presente, desenha a barra sob o número. */
  progresso?: number;
}> = ({ titulo, valor, destaque, progresso }) => (
  <div
    className={`rounded-xl border p-3 ${
      destaque === 'alerta' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
    }`}
  >
    <p className="text-[10px] font-bold uppercase text-slate-500">{titulo}</p>
    <p
      className={`text-lg font-extrabold ${
        destaque === 'alerta' ? 'text-amber-700' : 'text-[#004276]'
      }`}
    >
      {valor}
    </p>
    {progresso !== undefined && (
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${
            destaque === 'alerta' ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progresso * 100))}%` }}
        />
      </div>
    )}
  </div>
);

/**
 * Aviso recolhido: o resumo aparece sempre, a explicação abre no clique.
 *
 * Antes cada aviso era um bloco âmbar de três linhas, e com dois ou três deles
 * ao mesmo tempo o card virava uma parede de alerta — o consultor passava por
 * cima sem ler nenhum. Recolhido, a mensagem curta continua visível e o
 * detalhe fica a um clique de quem quer agir sobre ele.
 */
const Aviso: React.FC<{
  tom: 'alerta' | 'atencao';
  resumo: string;
  children: React.ReactNode;
}> = ({ tom, resumo, children }) => (
  <details
    className={`group rounded-xl border text-[11px] leading-relaxed ${
      tom === 'alerta'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-600'
    }`}
  >
    <summary className="flex cursor-pointer items-center gap-2 p-2.5 font-semibold marker:content-['']">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{resumo}</span>
      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60 transition group-open:rotate-180" />
    </summary>
    <p className="px-2.5 pb-2.5 pl-8 font-normal">{children}</p>
  </details>
);
