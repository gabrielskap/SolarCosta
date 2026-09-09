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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MapPinned, Satellite, Trash2 } from 'lucide-react';
import { ModuloLayout, SegmentoLayout } from '../../types';
import { paramNum, type ConfigApp } from '../../services/api';
import {
  buscarTelhado,
  descreverImagem,
  geocodificar,
  idadeImagemAnos,
  imagemTelhado,
  type EnderecoGeocodificado,
  type TelhadoSolar,
} from '../../services/solar';
import { calcularLayout, enquadrar, type Enquadramento } from '../../utils/layoutModulos';
import { TelhadoSatelite } from './TelhadoSatelite';

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

  const modulo = {
    larguraM: paramNum(config, 'layout.modulo_largura_m', 2.38),
    alturaM: paramNum(config, 'layout.modulo_altura_m', 1.3),
  };
  const espacamentoM = paramNum(config, 'layout.espacamento_m', 0.02);

  /**
   * Recalcula o layout — na primeira busca e sempre que o kit muda de tamanho.
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
    // `modulo`/`espacamentoM` são derivados de `config` — depender dele evita
    // recriar o callback a cada render por causa dos objetos novos.
    [config], // eslint-disable-line react-hooks/exhaustive-deps
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
    (g: EnderecoGeocodificado, t: TelhadoSolar, posicionados: ModuloLayout[], zoom: number) => {
      const d = t.imagemData;
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

    const r = recalcular(t, modulosQtd);
    const enq = enquadrar(r.modulos);

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
   * dispara em seguida.
   */
  useEffect(() => {
    if (!telhado || !geo || !enquadramentoImagem) return;
    const r = recalcular(telhado, modulosQtd);
    emitirResultado(geo, telhado, r.modulos, enquadramentoImagem.zoom);
  }, [modulosQtd, telhado, geo, enquadramentoImagem, recalcular, emitirResultado]);

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
    trocarImagem(null);
    onResultado(null);
  };

  const idade = telhado ? idadeImagemAnos(telhado) : null;
  const faltam = modulosQtd - modulos.length;
  // O kit mudou o suficiente para o quadro ideal não ser mais o da foto.
  const enquadramentoDefasado =
    !!enquadramentoImagem &&
    modulos.length > 0 &&
    enquadrar(modulos).zoom !== enquadramentoImagem.zoom;

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
      <div className="space-y-3 empty:hidden">
        {avisoAuto === 'aproximado' && (
          <Aviso tom="alerta">
            Localização aproximada ({geo?.precisao}) — o ponto caiu sobre a via, não sobre a
            edificação. <strong>Informe o número do imóvel</strong> em Dados do cliente: a
            busca refaz sozinha.
          </Aviso>
        )}
        {avisoAuto === 'sem_telhado' && (
          <Aviso tom="alerta">
            O Google não tem análise de telhado para este ponto. Confira o endereço — com
            número e bairro — ou use <strong>Buscar por satélite</strong> depois de ajustá-lo.
          </Aviso>
        )}
        {avisoAuto === 'nao_localizado' && (
          <Aviso tom="alerta">
            Endereço não localizado a partir do CEP. Complete o endereço da instalação e use{' '}
            <strong>Buscar por satélite</strong>.
          </Aviso>
        )}
        {recursoDesligado && (
          <Aviso tom="atencao">
            Busca por satélite desativada nesta instalação (chave do Google Maps não
            configurada). A proposta continua válida — só não sai com a página do telhado.
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
          <TelhadoSatelite
            modulos={modulos}
            imagemUrl={imagemUrl}
            enquadramento={enquadramentoImagem ?? undefined}
            legenda={descreverImagem(telhado)}
          />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Indicador
                titulo="Módulos posicionados"
                valor={`${modulos.length} de ${modulosQtd}`}
                destaque={faltam > 0 ? 'alerta' : 'ok'}
              />
              <Indicador titulo="Capacidade do telhado" valor={`${capacidade} módulos`} />
              <Indicador
                titulo="Área do telhado"
                valor={`${telhado.areaTelhadoM2.toFixed(0)} m²`}
              />
              <Indicador titulo="Águas identificadas" valor={`${telhado.segmentos.length}`} />
            </div>

            {faltam > 0 && (
              <Aviso tom="alerta">
                Só couberam <strong>{modulos.length}</strong> dos {modulosQtd} módulos
                dimensionados. O telhado comporta no máximo {capacidade}. Reveja o
                consumo, considere módulo de outra potência ou uma área adicional.
              </Aviso>
            )}

            {geo && !geo.confiavel && (
              <Aviso tom="alerta">
                O endereço foi localizado de forma aproximada ({geo.precisao}), não sobre
                a edificação. Confira se a figura corresponde ao imóvel do cliente.
              </Aviso>
            )}

            {enquadramentoDefasado && (
              <Aviso tom="atencao">
                O kit mudou de tamanho depois da busca. A figura mantém o enquadramento da
                foto original — use <strong>Buscar novamente</strong> se os módulos não
                couberem mais no quadro.
              </Aviso>
            )}

            {idade !== null && idade > IMAGEM_VELHA_ANOS && (
              <Aviso tom="atencao">
                {descreverImagem(telhado)} — {Math.floor(idade)} anos atrás. A foto ao
                lado é atual, mas o levantamento das águas não: construções ou reformas
                posteriores a essa data não entraram na análise. Confira se a disposição
                bate com o telhado que aparece na foto.
              </Aviso>
            )}

            <p className="text-[10px] leading-relaxed text-slate-400">
              Endereço localizado: {geo?.enderecoFormatado}. Análise de telhado fornecida
              pela Solar API do Google; o posicionamento usa o módulo de{' '}
              {modulo.larguraM.toFixed(2)} × {modulo.alturaM.toFixed(2)} m cadastrado nos
              parâmetros.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Indicador: React.FC<{ titulo: string; valor: string; destaque?: 'ok' | 'alerta' }> = ({
  titulo,
  valor,
  destaque,
}) => (
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
  </div>
);

const Aviso: React.FC<{ tom: 'alerta' | 'atencao'; children: React.ReactNode }> = ({
  tom,
  children,
}) => (
  <div
    className={`flex gap-2 rounded-xl border p-3 text-[11px] leading-relaxed ${
      tom === 'alerta'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-600'
    }`}
  >
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
    <p>{children}</p>
  </div>
);
