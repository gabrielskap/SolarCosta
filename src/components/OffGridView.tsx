import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BatteryCharging,
  Sun,
  Zap,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Printer,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  ExternalLink,
  ShieldCheck,
  Info,
  Layers,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { listarAparelhos, type Aparelho } from '../services/aparelhos';
import {
  abrirSimulacaoOffGrid,
  listarSimulacoesOffGrid,
  salvarSimulacaoOffGrid,
  type DadosOffGrid,
  type ResumoOffGrid,
} from '../services/offGrid';
import { ErroApi } from '../services/http';
import { LeadAutocomplete, type LeadOpcao } from './LeadAutocomplete';
import {
  cargasOffGridPadrao,
  configOffGridPadrao,
  dimensionarSistema,
  type CargaOffGrid,
} from '../utils/offGrid';

const novo = (): DadosOffGrid => ({
  titulo: '',
  leadId: null,
  cliente: { nome: '', empresa: '', cnpj: '', telefone: '', email: '' },
  equipamentos: cargasOffGridPadrao().map((c) => ({ ...c, tensaoV: 220 })),
  config: { ...configOffGridPadrao },
});

const erroTexto = (e: unknown) =>
  e instanceof ErroApi ? e.mensagemCompleta : e instanceof Error ? e.message : 'Não foi possível concluir a operação.';

const numero = (v: number, casas = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });

const CARGAS_RAPIDAS = [
  { nome: 'Lâmpadas LED', potenciaW: 9, tensaoV: 220, quantidade: 8, horasDia: 5 },
  { nome: 'Geladeira Frost Free', potenciaW: 150, tensaoV: 220, quantidade: 1, horasDia: 12 },
  { nome: 'Smart TV 50"', potenciaW: 100, tensaoV: 220, quantidade: 1, horasDia: 5 },
  { nome: 'Roteador Wi-Fi', potenciaW: 15, tensaoV: 220, quantidade: 1, horasDia: 24 },
  { nome: 'Ar-Cond. 9.000 BTU Inverter', potenciaW: 800, tensaoV: 220, quantidade: 1, horasDia: 4 },
  { nome: 'Bomba d’água 1/2 CV', potenciaW: 370, tensaoV: 220, quantidade: 1, horasDia: 2 },
  { nome: 'Notebook / Computador', potenciaW: 65, tensaoV: 220, quantidade: 1, horasDia: 8 },
];

const CORES_GRAFICO = ['#004276', '#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

/** Componente de Autocomplete do Catálogo de Aparelhos */
function CatalogoAutocomplete({
  catalogo,
  carregando,
  catalogoErro,
  onAdicionar,
}: {
  catalogo: Aparelho[];
  carregando: boolean;
  catalogoErro: string;
  onAdicionar: (aparelho: Aparelho) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return catalogo.slice(0, 30);
    const termo = busca.toLowerCase();
    return catalogo.filter((a) => `${a.ambiente} ${a.nome}`.toLowerCase().includes(termo)).slice(0, 40);
  }, [catalogo, busca]);

  const selecionar = (aparelho: Aparelho) => {
    onAdicionar(aparelho);
    setBusca('');
    setAberto(false);
    setAtivo(-1);
  };

  return (
    <div
      ref={dropdownRef}
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setAberto(false);
        }
      }}
    >
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          role="combobox"
          aria-expanded={aberto}
          autoComplete="off"
          className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-16 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#004276] focus:border-[#004276] placeholder:text-slate-400"
          placeholder="Buscar no catálogo e adicionar aparelho..."
          value={busca}
          onFocus={() => setAberto(true)}
          onClick={() => setAberto(true)}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
            setAtivo(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((i) => Math.min(i + 1, filtrados.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((i) => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter' && aberto && filtrados[ativo]) {
              e.preventDefault();
              selecionar(filtrados[ativo]);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setAberto(false);
            }
          }}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {busca && (
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 p-0.5"
              onClick={() => {
                setBusca('');
                setAberto(false);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-0.5"
            onClick={() => setAberto((prev) => !prev)}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {carregando ? (
            <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#004276]" />
              <span>Carregando catálogo de aparelhos...</span>
            </div>
          ) : catalogoErro ? (
            <div className="p-3 text-xs text-red-600">{catalogoErro}</div>
          ) : !filtrados.length ? (
            <div className="p-3 text-xs text-slate-500 text-center space-y-1">
              <p>Nenhum aparelho encontrado para "{busca}".</p>
              <p className="text-[10px] text-slate-400">
                Cadastre em{' '}
                <Link className="underline text-sky-700" to="/sistema/parametros/aparelhos">
                  Parâmetros → Aparelhos
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul role="listbox" className="divide-y divide-slate-100">
              <li className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                {busca.trim() ? `Resultados da busca (${filtrados.length})` : `Aparelhos disponíveis (${catalogo.length})`}
              </li>
              {filtrados.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={ativo === i}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-sky-50 transition ${
                      ativo === i ? 'bg-sky-50' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => selecionar(item)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.ambiente && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {item.ambiente}
                        </span>
                      )}
                      <span className="font-medium text-slate-800 truncate">{item.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-mono font-semibold text-[#004276] text-xs">
                        {item.potenciaW} W
                      </span>
                      <span className="text-[10px] text-sky-700 font-semibold bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200">
                        + Incluir
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function OffGridView({ podeSalvar = true }: { podeSalvar?: boolean }) {
  const [dados, setDados] = useState<DadosOffGrid>(novo);
  const [id, setId] = useState<string>();
  const [catalogo, setCatalogo] = useState<Aparelho[]>([]);
  const [catalogoErro, setCatalogoErro] = useState('');
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [simulacoes, setSimulacoes] = useState<ResumoOffGrid[]>([]);
  const [editando, setEditando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [alterado, setAlterado] = useState(false);
  const [restaurar, setRestaurar] = useState(false);
  const [buscaLista, setBuscaLista] = useState('');
  const [abaConfig, setAbaConfig] = useState<'bateria' | 'solar'>('bateria');

  const atualizar = (patch: Partial<DadosOffGrid>) => {
    setDados((d) => ({ ...d, ...patch }));
    setAlterado(true);
    setAviso('');
  };

  useEffect(() => {
    listarAparelhos()
      .then(setCatalogo)
      .catch((e) => setCatalogoErro(erroTexto(e)))
      .finally(() => setCarregandoCatalogo(false));
    listarSimulacoesOffGrid()
      .then(setSimulacoes)
      .catch((e) => setErro(erroTexto(e)))
      .finally(() => setCarregandoLista(false));
  }, []);

  let resultado: ReturnType<typeof dimensionarSistema> | undefined;
  let erroCalculo = '';
  try {
    resultado = dimensionarSistema(dados.equipamentos, dados.config);
  } catch (e) {
    erroCalculo = erroTexto(e);
  }

  const editarCarga = (indice: number, key: string, value: string | number) => {
    atualizar({
      equipamentos: dados.equipamentos.map((c, i) => (i === indice ? { ...c, [key]: value } : c)),
    });
  };

  const adicionarCargaRapida = (carga: (typeof CARGAS_RAPIDAS)[0]) => {
    atualizar({
      equipamentos: [
        ...dados.equipamentos,
        {
          id: crypto.randomUUID(),
          nome: carga.nome,
          potenciaW: carga.potenciaW,
          tensaoV: carga.tensaoV,
          quantidade: carga.quantidade,
          horasDia: carga.horasDia,
        },
      ],
    });
  };

  const adicionarCargaCatalogo = (a: Aparelho) => {
    atualizar({
      equipamentos: [
        ...dados.equipamentos,
        {
          id: crypto.randomUUID(),
          nome: a.nome,
          potenciaW: a.potenciaW,
          quantidade: 1,
          horasDia: 2,
          tensaoV: 220,
        },
      ],
    });
  };

  const adicionarCargaEmBranco = () => {
    atualizar({
      equipamentos: [
        ...dados.equipamentos,
        {
          id: crypto.randomUUID(),
          nome: 'Novo Equipamento',
          potenciaW: 100,
          tensaoV: 220,
          quantidade: 1,
          horasDia: 4,
        },
      ],
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const dadosGrafico = useMemo(() => {
    if (!resultado || !resultado.cargas.length) return [];
    return resultado.cargas
      .filter((c) => c.consumoDiarioWh > 0)
      .map((c) => ({
        name: c.nome,
        value: Math.round(c.consumoDiarioWh),
      }))
      .sort((a, b) => b.value - a.value);
  }, [resultado]);

  const simulacoesFiltradas = useMemo(() => {
    if (!buscaLista.trim()) return simulacoes;
    const termo = buscaLista.toLowerCase();
    return simulacoes.filter((s) => s.titulo.toLowerCase().includes(termo));
  }, [simulacoes, buscaLista]);

  // ========================== VISTA 1: LISTAGEM DE SIMULAÇÕES ==========================
  if (!editando) {
    return (
      <div className="space-y-4">
        {/* Top Header compacto */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#004276] flex items-center justify-center shrink-0 border border-sky-100">
              <BatteryCharging className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dimensionamento OFF-Grid</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  LiFePO4 & Solar
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Levantamento de cargas críticas, banco de baterias de lítio e arranjo fotovoltaico isolado.
              </p>
            </div>
          </div>
          <button
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#004276] hover:bg-[#003159] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            disabled={ocupado || !podeSalvar}
            onClick={() => {
              setDados(novo());
              setId(undefined);
              setAlterado(false);
              setAviso('');
              setErro('');
              setRestaurar(false);
              setEditando(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Novo dimensionamento
          </button>
        </div>

        {erro && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Barra de busca e filtros compacta */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Filtrar por título..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#004276] focus:border-[#004276]"
              value={buscaLista}
              onChange={(e) => setBuscaLista(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center font-medium">
            {simulacoesFiltradas.length} {simulacoesFiltradas.length === 1 ? 'simulação cadastrada' : 'simulações cadastradas'}
          </div>
        </div>

        {/* Tabela de Simulações compacta e moderna */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Título da simulação</th>
                <th className="py-2.5 px-3">Vínculo</th>
                <th className="py-2.5 px-3">Última atualização</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {simulacoesFiltradas.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{s.titulo}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {s.leadId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-medium border border-sky-100">
                        Lead vinculado
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                    {new Date(s.atualizadoEm).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-[#004276] hover:text-[#002e5c] font-semibold text-xs py-1 px-2.5 rounded-md hover:bg-sky-50 transition"
                      disabled={ocupado}
                      onClick={async () => {
                        setOcupado(true);
                        setErro('');
                        try {
                          const simulacao = await abrirSimulacaoOffGrid(s.id);
                          setDados(simulacao.dados);
                          setId(simulacao.id);
                          setAlterado(false);
                          setAviso('');
                          setRestaurar(false);
                          setEditando(true);
                        } catch (e) {
                          setErro(erroTexto(e));
                        } finally {
                          setOcupado(false);
                        }
                      }}
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {!simulacoesFiltradas.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                    {carregandoLista ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#004276] border-t-transparent rounded-full animate-spin" />
                        <span>Carregando simulações...</span>
                      </div>
                    ) : erro ? (
                      'Não foi possível carregar as simulações.'
                    ) : buscaLista ? (
                      'Nenhuma simulação corresponde ao filtro de busca.'
                    ) : (
                      <div className="space-y-2">
                        <p className="text-slate-600 font-medium">Nenhuma simulação cadastrada.</p>
                        <p className="text-[11px] text-slate-400">Clique em "Novo dimensionamento" acima para iniciar.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ========================== VISTA 2: EDITOR COMPACTO DO DIMENSIONAMENTO ==========================
  return (
    <div className="space-y-3.5">
      {/* Barra Superior Compacta */}
      <div className="no-print bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition"
            onClick={() => {
              if (alterado && !window.confirm('Existem alterações não salvas. Deseja realmente voltar e descartar?')) return;
              setEditando(false);
              setErro('');
              setAviso('');
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 truncate">
                {id ? 'Editar Simulação' : 'Nova Simulação OFF-Grid'}
              </span>
              {alterado ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  Não salvo
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  Sincronizado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Imprimir relatório"
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            type="button"
            title="Restaurar valores padrão"
            onClick={() => setRestaurar(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Restaurar</span>
          </button>

          <button
            type="button"
            disabled={!podeSalvar || !resultado || !dados.equipamentos.length || ocupado}
            onClick={async (e) => {
              e.preventDefault();
              if (!resultado || ocupado) return;
              if (!dados.titulo.trim()) {
                setErro('Informe o título da simulação antes de salvar.');
                return;
              }
              setOcupado(true);
              setErro('');
              setAviso('');
              try {
                const s = await salvarSimulacaoOffGrid(dados, id);
                setId(s.id);
                setAlterado(false);
                setAviso('Simulação salva com sucesso!');
                setSimulacoes((lista) => [s, ...lista.filter((item) => item.id !== s.id)]);
              } catch (err) {
                setErro(erroTexto(err));
              } finally {
                setOcupado(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004276] hover:bg-[#003159] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {ocupado ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{id ? 'Salvar alterações' : 'Salvar simulação'}</span>
          </button>
        </div>
      </div>

      {/* Alertas Compactos */}
      {erro && (
        <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
          <button type="button" onClick={() => setErro('')} className="text-red-700 font-bold hover:underline text-xs">
            ✕
          </button>
        </div>
      )}

      {aviso && (
        <div role="status" className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{aviso}</span>
          </div>
          <button type="button" onClick={() => setAviso('')} className="text-emerald-700 font-bold hover:underline text-xs">
            ✕
          </button>
        </div>
      )}

      {restaurar && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Restaurar padrões da planilha?</span>
          </div>
          <p className="text-[11px] text-amber-800">
            As cargas e configurações técnicas serão redefinidas para os valores recomendados de fábrica. Os dados do cliente serão mantidos.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-md font-semibold text-[11px]"
              onClick={() => {
                atualizar({ equipamentos: novo().equipamentos, config: { ...configOffGridPadrao } });
                setRestaurar(false);
              }}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="px-2.5 py-1 border border-amber-300 hover:bg-amber-100 rounded-md text-[11px]"
              onClick={() => setRestaurar(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal: 7 colunas formulário / 5 colunas resultados em tempo real */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        {/* ================= COLUNA DA ESQUERDA: ENTRADA DE DADOS ================= */}
        <div className="xl:col-span-7 space-y-3.5">
          {/* Card 1: Identificação & Cliente */}
          <section className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#004276] text-white text-[10px] font-bold">
                  1
                </span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identificação & Cliente</h2>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Grid 2 colunas: Título e Nome do Cliente / Lead juntos */}
              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Título da simulação <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={200}
                    placeholder="Ex: Sítio São José - Sistema Isolado 48V"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#004276] focus:border-[#004276] focus:outline-none"
                    value={dados.titulo}
                    onChange={(e) => atualizar({ titulo: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cliente / Lead <span className="text-red-500">*</span>
                  </label>
                  <LeadAutocomplete
                    leadId={dados.leadId}
                    nome={dados.cliente.nome}
                    placeholder="Nome do cliente ou buscar lead..."
                    onNomeChange={(novoNome) => {
                      atualizar({
                        cliente: { ...dados.cliente, nome: novoNome },
                      });
                    }}
                    onChange={(lead: LeadOpcao | null) => {
                      atualizar({
                        leadId: lead?.id ?? null,
                        cliente: lead
                          ? {
                              ...dados.cliente,
                              nome: lead.nome,
                              cnpj: lead.cpf_cnpj ?? dados.cliente.cnpj,
                              telefone: lead.telefone ?? dados.cliente.telefone,
                              email: lead.email ?? dados.cliente.email,
                              empresa: lead.empresa ?? dados.cliente.empresa,
                            }
                          : dados.cliente,
                      });
                    }}
                  />
                </div>
              </div>

              {/* Linha com 4 campos secundários do cliente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Empresa</label>
                  <input
                    maxLength={200}
                    placeholder="Empresa"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-[#004276] focus:outline-none"
                    value={dados.cliente.empresa}
                    onChange={(e) => atualizar({ cliente: { ...dados.cliente, empresa: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">CPF / CNPJ</label>
                  <input
                    maxLength={20}
                    placeholder="000.000.000-00"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-[#004276] focus:outline-none"
                    value={dados.cliente.cnpj}
                    onChange={(e) => atualizar({ cliente: { ...dados.cliente, cnpj: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Telefone</label>
                  <input
                    maxLength={30}
                    placeholder="(00) 00000-0000"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-[#004276] focus:outline-none"
                    value={dados.cliente.telefone}
                    onChange={(e) => atualizar({ cliente: { ...dados.cliente, telefone: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">E-mail</label>
                  <input
                    type="email"
                    maxLength={200}
                    placeholder="cliente@email.com"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-[#004276] focus:outline-none"
                    value={dados.cliente.email}
                    onChange={(e) => atualizar({ cliente: { ...dados.cliente, email: e.target.value } })}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Levantamento de Cargas Críticas */}
          <section className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#004276] text-white text-[10px] font-bold">
                  2
                </span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cargas Críticas (Backup)</h2>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={adicionarCargaEmBranco}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004276] hover:bg-sky-50 px-2 py-1 rounded-md transition border border-sky-200"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar carga manual</span>
                </button>
              </div>
            </div>

            {/* Chips rápidos de aparelhos comuns */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Adicionar rápido com 1 clique:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CARGAS_RAPIDAS.map((item) => (
                  <button
                    key={item.nome}
                    type="button"
                    onClick={() => adicionarCargaRapida(item)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 transition flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5 text-sky-600" />
                    <span>{item.nome}</span>
                    <span className="text-[9px] text-slate-400">({item.potenciaW}W)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inclusão a partir do Catálogo: Autocomplete Unificado */}
            <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-sky-700" />
                  Buscar no catálogo de aparelhos
                </span>
                {!carregandoCatalogo && !catalogo.length && !catalogoErro && (
                  <Link className="text-[10px] underline text-sky-700" to="/sistema/parametros/aparelhos">
                    Cadastrar aparelhos
                  </Link>
                )}
              </div>
              <CatalogoAutocomplete
                catalogo={catalogo}
                carregando={carregandoCatalogo}
                catalogoErro={catalogoErro}
                onAdicionar={adicionarCargaCatalogo}
              />
            </div>

            {/* Tabela Compacta de Cargas */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-2 px-2.5">Equipamento</th>
                    <th className="py-2 px-2 w-20">Tensão (V)</th>
                    <th className="py-2 px-2 w-20">Potência (W)</th>
                    <th className="py-2 px-2 w-16">Qtd</th>
                    <th className="py-2 px-2 w-20">Horas/dia</th>
                    <th className="py-2 px-2 text-right">Demanda</th>
                    <th className="py-2 px-2 text-right">Consumo/dia</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {dados.equipamentos.map((c, i) => {
                    const cargaRes = resultado?.cargas[i];
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            required
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:ring-1 focus:ring-sky-500 font-medium"
                            value={c.nome}
                            onChange={(e) => editarCarga(i, 'nome', e.target.value)}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 text-center bg-white"
                            value={Number.isFinite(c.tensaoV) ? c.tensaoV : ''}
                            onChange={(e) => editarCarga(i, 'tensaoV', e.target.valueAsNumber)}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 text-center bg-white"
                            value={Number.isFinite(c.potenciaW) ? c.potenciaW : ''}
                            onChange={(e) => editarCarga(i, 'potenciaW', e.target.valueAsNumber)}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 text-center bg-white"
                            value={Number.isFinite(c.quantidade) ? c.quantidade : ''}
                            onChange={(e) => editarCarga(i, 'quantidade', e.target.valueAsNumber)}
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.1"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 text-center bg-white"
                            value={Number.isFinite(c.horasDia) ? c.horasDia : ''}
                            onChange={(e) => editarCarga(i, 'horasDia', e.target.valueAsNumber)}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                          {cargaRes ? `${numero(cargaRes.potenciaDemandadaW, 0)} W` : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold text-[#004276] whitespace-nowrap">
                          {cargaRes ? `${numero(cargaRes.consumoDiarioWh, 0)} Wh` : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            title="Remover carga"
                            className="text-slate-400 hover:text-red-600 transition p-1"
                            onClick={() => atualizar({ equipamentos: dados.equipamentos.filter((_, n) => n !== i) })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!dados.equipamentos.length && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                        Nenhuma carga adicionada. Utilize os atalhos rápidos acima ou o catálogo de busca.
                      </td>
                    </tr>
                  )}
                </tbody>
                {!!dados.equipamentos.length && resultado && (
                  <tfoot className="bg-slate-50 font-semibold text-slate-800 text-[11px] border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="py-2 px-2.5 text-right uppercase tracking-wider text-slate-500">
                        Totais Acumulados:
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900">
                        {numero(resultado.potenciaTotalW, 0)} W
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#004276]">
                        {numero(resultado.consumoDiarioKWh * 1000, 0)} Wh/dia
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {/* Card 3: Parâmetros Técnicos (Baterias & Módulos) */}
          <section className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#004276] text-white text-[10px] font-bold">
                  3
                </span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Parâmetros Técnicos</h2>
              </div>

              {/* Botões alternadores Bateria / Solar */}
              <div className="flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setAbaConfig('bateria')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[11px] transition ${
                    abaConfig === 'bateria' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BatteryCharging className="w-3 h-3" />
                  <span>Banco de Baterias</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAbaConfig('solar')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[11px] transition ${
                    abaConfig === 'solar' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>Arranjo Solar</span>
                </button>
              </div>
            </div>

            {abaConfig === 'bateria' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-50/60 p-2.5 rounded-lg border border-sky-100 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-700" />
                    <span className="font-semibold text-sky-950">Baterias Lítio LiFePO4</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Tensão nominal:</span>
                    {[12, 24, 48].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => atualizar({ config: { ...dados.config, tensaoBateria: v } })}
                        className={`px-2 py-0.5 rounded font-semibold transition ${
                          dados.config.tensaoBateria === v
                            ? 'bg-[#004276] text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {v}V
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Tensão do Banco (V)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.tensaoBateria}
                      onChange={(e) => atualizar({ config: { ...dados.config, tensaoBateria: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Capacidade Unitária (Ah)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.capacidadeBateriaAh}
                      onChange={(e) => atualizar({ config: { ...dados.config, capacidadeBateriaAh: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Prof. Descarga DoD (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.profundidadeDescarga}
                      onChange={(e) => atualizar({ config: { ...dados.config, profundidadeDescarga: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Eficiência Inversor (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.eficienciaInversor}
                      onChange={(e) => atualizar({ config: { ...dados.config, eficienciaInversor: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Eficiência Carga (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.eficienciaCarga}
                      onChange={(e) => atualizar({ config: { ...dados.config, eficienciaCarga: e.target.valueAsNumber } })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 text-xs">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold text-amber-950">Módulos & Radiação Solar</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Módulo Wp:</span>
                    {[550, 610, 650].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => atualizar({ config: { ...dados.config, potenciaModuloWp: w } })}
                        className={`px-2 py-0.5 rounded font-semibold transition ${
                          dados.config.potenciaModuloWp === w
                            ? 'bg-amber-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {w}Wp
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Potência Módulo (Wp)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.potenciaModuloWp}
                      onChange={(e) => atualizar({ config: { ...dados.config, potenciaModuloWp: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Irradiação HSP (h/dia)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.irradiacaoSolar}
                      onChange={(e) => atualizar({ config: { ...dados.config, irradiacaoSolar: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Perdas Sistema (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="99.99"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.perdasSistema}
                      onChange={(e) => atualizar({ config: { ...dados.config, perdasSistema: e.target.valueAsNumber } })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Fator Dias (D)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                      value={dados.config.fatorDias}
                      onChange={(e) => atualizar({ config: { ...dados.config, fatorDias: e.target.valueAsNumber } })}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ================= COLUNA DA DIREITA: RESULTADOS EM TEMPO REAL ================= */}
        <div className="xl:col-span-5 space-y-3.5">
          {/* Card de Métricas Principais (Hero KPIs Compactos) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dimensionamento Calculado</h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Tempo Real</span>
            </div>

            {erroCalculo ? (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                {erroCalculo}
              </div>
            ) : resultado ? (
              <div className="space-y-3">
                {/* 2 Big Cards em Destaque: Baterias e Módulos */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 border border-sky-100 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-sky-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Banco Baterias</span>
                      <BatteryCharging className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-[#004276]">
                      {resultado.quantidadeBaterias}{' '}
                      <span className="text-xs font-semibold text-sky-700">unid.</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {dados.config.tensaoBateria}V · {dados.config.capacidadeBateriaAh}Ah cada
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-100 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-amber-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Módulos Solares</span>
                      <Sun className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-amber-700">
                      {resultado.quantidadeModulos}{' '}
                      <span className="text-xs font-semibold text-amber-600">placas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {numero(resultado.potenciaSistemaKWp, 2)} kWp ({dados.config.potenciaModuloWp}Wp)
                    </p>
                  </div>
                </div>

                {/* Grid de 4 Cards Técnicos Secundários Compactos */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Inversor Recomendado (+30%)</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {numero(resultado.potenciaInversorRecomendadaW, 0)} W
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Consumo Corrigido</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {numero(resultado.consumoCorrigidoKWh, 2)} kWh/dia
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Capacidade Mínima Banco</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {numero(resultado.capacidadeMinimaAh, 1)} Ah
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Energia Nominal Banco</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {numero(resultado.energiaMinimaBancoKWh, 2)} kWh
                    </span>
                  </div>
                </div>

                {/* Alerta Powersafe quando mais de 10 baterias */}
                {resultado.consultarFabricante && (
                  <div role="alert" className="p-2.5 rounded-lg bg-amber-100 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                    <span className="font-semibold">
                      Consultar Powersafe: Quantidade calculada ({numero(resultado.quantidadeBateriasCalculada, 2)}) é superior a 10 unidades.
                    </span>
                  </div>
                )}

                {/* Gráfico Compacto de Distribuição de Consumo */}
                {dadosGrafico.length > 0 && (
                  <div className="pt-1 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <div className="flex items-center gap-1">
                        <PieChartIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Distribuição de Consumo (Wh/dia)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Total: {numero(resultado.consumoDiarioKWh * 1000, 0)} Wh/dia
                      </span>
                    </div>

                    <div className="h-36 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dadosGrafico}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={55}
                            paddingAngle={2}
                          >
                            {dadosGrafico.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`${numero(Number(value), 0)} Wh/dia`, 'Consumo']}
                            contentStyle={{ fontSize: '11px', borderRadius: '8px', padding: '4px 8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Top 3 cargas mais pesadas */}
                    <div className="space-y-1">
                      {dadosGrafico.slice(0, 3).map((item, idx) => {
                        const pct = resultado.consumoDiarioKWh > 0 ? (item.value / (resultado.consumoDiarioKWh * 1000)) * 100 : 0;
                        return (
                          <div key={item.name} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: CORES_GRAFICO[idx % CORES_GRAFICO.length] }}
                              />
                              <span className="text-slate-700 truncate">{item.name}</span>
                            </div>
                            <span className="text-slate-500 font-mono text-[10px] shrink-0 font-medium">
                              {pct.toFixed(0)}% ({numero(item.value, 0)} Wh)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Dica Técnica de Engenharia Compacta */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="w-3.5 h-3.5 text-sky-600" />
              <span>Critérios de Dimensionamento</span>
            </div>
            <p className="leading-relaxed">
              • Inversor sugerido com margem de +30%. Avalie correntes de pico de partida em motores e compressores.
              <br />
              • Banco de baterias dimensionado com base no consumo diário corrigido pela eficiência do inversor e profundidade de descarga DoD ({dados.config.profundidadeDescarga}%).
            </p>
          </div>
        </div>
      </div>

      {/* ================= RELATÓRIO EXECUTIVO EXCLUSIVO PARA IMPRESSÃO (PDF) ================= */}
      <div id="report-root" className="hidden print:block text-black p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h1 className="text-xl font-bold text-[#004276]">SolarCosta · Relatório de Dimensionamento OFF-Grid</h1>
            <p className="text-xs text-slate-500">Sistema Fotovoltaico Isolado com Armazenamento em Baterias de Lítio</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold">{dados.titulo || 'Simulação Sem Título'}</p>
            <p className="text-slate-500">Data: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Identificação do Cliente */}
        <div className="border rounded-lg p-3 text-xs grid grid-cols-2 gap-2 bg-slate-50">
          <div>
            <p><strong>Cliente:</strong> {dados.cliente.nome || '—'}</p>
            <p><strong>Empresa:</strong> {dados.cliente.empresa || '—'}</p>
            <p><strong>CPF/CNPJ:</strong> {dados.cliente.cnpj || '—'}</p>
          </div>
          <div>
            <p><strong>Telefone:</strong> {dados.cliente.telefone || '—'}</p>
            <p><strong>E-mail:</strong> {dados.cliente.email || '—'}</p>
          </div>
        </div>

        {/* Resumo dos Equipamentos Recomendados */}
        {resultado && (
          <div className="grid grid-cols-3 gap-3 border rounded-lg p-3 text-xs bg-slate-50 text-center">
            <div>
              <p className="text-slate-500 font-semibold uppercase">Banco de Baterias LiFePO4</p>
              <p className="text-lg font-bold text-[#004276]">
                {resultado.quantidadeBaterias} un. ({dados.config.tensaoBateria}V {dados.config.capacidadeBateriaAh}Ah)
              </p>
              <p className="text-[10px] text-slate-600">{numero(resultado.energiaMinimaBancoKWh, 2)} kWh nominal</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold uppercase">Arranjo Fotovoltaico</p>
              <p className="text-lg font-bold text-amber-700">
                {resultado.quantidadeModulos} placas ({dados.config.potenciaModuloWp}Wp)
              </p>
              <p className="text-[10px] text-slate-600">{numero(resultado.potenciaSistemaKWp, 2)} kWp instalados</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold uppercase">Inversor Recomendado (+30%)</p>
              <p className="text-lg font-bold text-slate-800">
                {numero(resultado.potenciaInversorRecomendadaW, 0)} W
              </p>
              <p className="text-[10px] text-slate-600">Demanda: {numero(resultado.potenciaTotalW, 0)} W</p>
            </div>
          </div>
        )}

        {/* Tabela de Cargas Levantadas */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-1">Levantamento de Cargas Críticas</h3>
          <table className="w-full text-[10px] text-left border divide-y">
            <thead className="bg-slate-100 font-semibold">
              <tr>
                <th className="p-1.5">Equipamento</th>
                <th className="p-1.5 text-center">Tensão</th>
                <th className="p-1.5 text-center">Potência</th>
                <th className="p-1.5 text-center">Qtd</th>
                <th className="p-1.5 text-center">Horas/dia</th>
                <th className="p-1.5 text-right">Demanda (W)</th>
                <th className="p-1.5 text-right">Consumo (Wh/dia)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dados.equipamentos.map((c, i) => {
                const item = resultado?.cargas[i];
                return (
                  <tr key={c.id}>
                    <td className="p-1.5 font-medium">{c.nome}</td>
                    <td className="p-1.5 text-center">{c.tensaoV}V</td>
                    <td className="p-1.5 text-center">{c.potenciaW}W</td>
                    <td className="p-1.5 text-center">{c.quantidade}</td>
                    <td className="p-1.5 text-center">{c.horasDia}h</td>
                    <td className="p-1.5 text-right">{item ? numero(item.potenciaDemandadaW, 0) : '—'} W</td>
                    <td className="p-1.5 text-right">{item ? numero(item.consumoDiarioWh, 0) : '—'} Wh</td>
                  </tr>
                );
              })}
            </tbody>
            {resultado && (
              <tfoot className="bg-slate-100 font-bold border-t">
                <tr>
                  <td colSpan={5} className="p-1.5 text-right uppercase">Totais:</td>
                  <td className="p-1.5 text-right">{numero(resultado.potenciaTotalW, 0)} W</td>
                  <td className="p-1.5 text-right">{numero(resultado.consumoDiarioKWh * 1000, 0)} Wh/dia</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Rodapé técnico */}
        <div className="text-[9px] text-slate-500 pt-3 border-t">
          <p>
            * Dimensionamento baseado nas premissas técnicas fornecidas: Eficiência do Inversor: {dados.config.eficienciaInversor}%, DoD: {dados.config.profundidadeDescarga}%, HSP: {dados.config.irradiacaoSolar} h/dia, Perdas: {dados.config.perdasSistema}%.
          </p>
          <p className="mt-1">SolarCosta Energia Solar · Engenharia e Sistemas Fotovoltaicos</p>
        </div>
      </div>
    </div>
  );
}
