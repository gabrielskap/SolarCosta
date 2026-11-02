import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Search, Plus, Edit2, AlertTriangle, Layers, Zap, Package, ChevronDown, Info, CheckCircle2 } from 'lucide-react';
import { listarPlacas, salvarPlaca, type PlacaSolar } from '../services/placas';
import { http } from '../services/http';
import { ModalCabecalho } from './comuns/ModalCabecalho';

const vazio = {
  produtoId: '',
  fabricante: '',
  modelo: '',
  potenciaWp: 550,
  larguraM: 1.134,
  alturaM: 2.278,
  pesoKg: 28,
  observacoes: '',
  ativo: true,
};

interface ProdutoOpcao {
  id: string;
  codigo: string;
  nome: string;
  potencia_wp: number | null;
}

const campos = [
  { key: 'potenciaWp', label: 'Potência (Wp)', min: 1, max: 3000, step: 1, sufixo: 'Wp' },
  { key: 'larguraM', label: 'Largura (m)', min: 0.2, max: 10, step: 0.001, sufixo: 'm' },
  { key: 'alturaM', label: 'Comprimento (m)', min: 0.2, max: 10, step: 0.001, sufixo: 'm' },
  { key: 'pesoKg', label: 'Peso (kg)', min: 0.01, max: 200, step: 0.01, sufixo: 'kg' },
] as const;

export function PlacasView() {
  const [placas, setPlacas] = useState<PlacaSolar[]>([]);
  const [inativos, setInativos] = useState(false);
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [id, setId] = useState<string>();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [p, r] = await Promise.all([
        listarPlacas(),
        http.get<{ produtos: ProdutoOpcao[] }>('/api/catalogo/produtos?tipo=modulo'),
      ]);
      setPlacas(p);
      setProdutos(r.produtos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar placas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  // Normalização de busca
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const visiveis = useMemo(() => {
    return placas.filter((p) => {
      const bateStatus = inativos ? !p.ativo : p.ativo;
      const texto = `${p.fabricante} ${p.modelo} ${p.produtoNome || ''} ${p.produtoCodigo || ''}`;
      const bateBusca = !busca.trim() || normalizar(texto).includes(normalizar(busca));
      return bateStatus && bateBusca;
    });
  }, [placas, inativos, busca]);

  // KPIs
  const placasAtivasCount = useMemo(() => placas.filter((p) => p.ativo).length, [placas]);
  const placasInativasCount = useMemo(() => placas.filter((p) => !p.ativo).length, [placas]);
  const totalFabricantes = useMemo(
    () => new Set(placas.map((p) => p.fabricante.trim().toLowerCase()).filter(Boolean)).size,
    [placas]
  );
  const maiorPotencia = useMemo(
    () => placas.reduce((max, p) => (p.potenciaWp > max ? p.potenciaWp : max), 0),
    [placas]
  );
  const totalVinculadas = useMemo(() => placas.filter((p) => p.produtoId).length, [placas]);

  const rotulo = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
  const campo =
    'w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 ' +
    'placeholder:font-normal placeholder:text-slate-400 transition ' +
    'focus:outline-none focus:bg-white focus:border-[#004276] focus:ring-4 focus:ring-[#004276]/10';
  const campoSelect = `${campo} appearance-none pr-10 cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      await salvarPlaca(form, id);
      setEditando(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a placa.');
    } finally {
      setOcupado(false);
    }
  };

  const produtoSelecionado = produtos.find((p) => p.id === form.produtoId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Parâmetros</span>
            <span>/</span>
            <span className="text-[#004276]">Placas</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Cadastro de Placas Solares</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Modelos fotovoltaicos homologados e especificações físicas · {placas.length} modelos cadastrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar modelo ou fabricante..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004276] w-48 sm:w-64"
            />
          </div>

          <button
            onClick={() => {
              setId(undefined);
              setForm({ ...vazio });
              setEditando(true);
              setErro('');
            }}
            className="px-3.5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nova placa
          </button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{erro}</span>
        </div>
      )}

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelos ativos</span>
            <Sun className="w-4 h-4 text-[#004276]" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1">{placasAtivasCount}</h3>
          <p className="text-[10px] text-slate-500 font-medium">disponíveis no telhado</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fabricantes</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1">{totalFabricantes}</h3>
          <p className="text-[10px] text-slate-500 font-medium">marcas homologadas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maior potência</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-xl font-black text-[#004276] mt-1">
            {maiorPotencia > 0 ? `${maiorPotencia} Wp` : '–'}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">módulo de maior pico</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vínculo com catálogo</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1">
            {totalVinculadas} <span className="text-xs font-normal text-slate-400">/ {placas.length}</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">ligadas a produtos</p>
        </div>
      </div>

      {/* Tabs de Status */}
      <div role="tablist" aria-label="Status das placas" className="flex gap-2">
        {[false, true].map((inativo) => (
          <button
            key={String(inativo)}
            role="tab"
            aria-selected={inativos === inativo}
            onClick={() => setInativos(inativo)}
            className={
              inativos === inativo
                ? 'px-4 py-2 rounded-xl bg-[#004276] text-white text-sm font-bold'
                : 'px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold'
            }
          >
            {inativo ? 'Inativas' : 'Ativas'} ({inativo ? placasInativasCount : placasAtivasCount})
          </button>
        ))}
      </div>

      {/* Tabela em Lista */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">FABRICANTE / MODELO</th>
                <th className="p-3">PRODUTO VINCULADO</th>
                <th className="p-3">POTÊNCIA</th>
                <th className="p-3">DIMENSÕES</th>
                <th className="p-3">PESO</th>
                <th className="p-3">STATUS</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Carregando placas solares…
                  </td>
                </tr>
              )}
              {!carregando && visiveis.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nenhuma placa solar encontrada nesta aba.
                  </td>
                </tr>
              )}
              {!carregando &&
                visiveis.map((p) => {
                  const areaM2 = (p.larguraM * p.alturaM).toFixed(2);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td data-label="FABRICANTE / MODELO" className="p-3">
                        <div className="font-bold text-slate-900 text-[13px]">{p.fabricante}</div>
                        <div className="text-slate-600 font-medium text-xs">{p.modelo}</div>
                      </td>

                      <td data-label="PRODUTO VINCULADO" className="p-3">
                        {p.produtoId ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#004276] text-[11px] font-semibold border border-blue-100">
                            <span className="font-mono font-bold text-slate-700">{p.produtoCodigo}</span>
                            <span className="text-slate-300">·</span>
                            <span className="truncate max-w-[170px]">{p.produtoNome}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Não vinculado
                          </span>
                        )}
                      </td>

                      <td data-label="POTÊNCIA" className="p-3">
                        <span className="bg-blue-50 text-[#004276] font-bold px-2 py-0.5 rounded text-[10px]">
                          {p.potenciaWp} Wp
                        </span>
                      </td>

                      <td data-label="DIMENSÕES" className="p-3">
                        <span className="font-bold text-slate-800">
                          {p.larguraM} × {p.alturaM} m
                        </span>
                        <span className="block text-[10px] text-slate-400 font-medium">{areaM2} m²</span>
                      </td>

                      <td data-label="PESO" className="p-3 font-semibold text-slate-700">
                        {p.pesoKg} kg
                      </td>

                      <td data-label="STATUS" className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            p.ativo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {p.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>

                      <td data-label="AÇÕES" className="p-3 text-right font-bold space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setForm({ ...p, produtoId: p.produtoId ?? '' });
                            setId(p.id);
                            setEditando(true);
                            setErro('');
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova / Editar Placa */}
      {editando && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <ModalCabecalho
              icone={Sun}
              titulo={id ? 'Editar placa solar' : 'Cadastrar placa solar'}
              subtitulo="Especificações técnicas e dimensões para o levantamento do telhado"
              onFechar={() => setEditando(false)}
            />

            <form onSubmit={handleSubmit} className="campos-modal flex-1 min-h-0 flex flex-col">
              <div className="modal-corpo campos-modal flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={rotulo}>Produto vinculado no catálogo</label>
                  <div className="relative">
                    <select
                      className={campoSelect}
                      value={form.produtoId}
                      onChange={(e) => {
                        const selecionado = produtos.find((p) => p.id === e.target.value);
                        setForm({
                          ...form,
                          produtoId: e.target.value,
                          ...(selecionado
                            ? {
                                modelo: selecionado.nome.slice(0, 160),
                                potenciaWp: selecionado.potencia_wp ?? form.potenciaWp,
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Selecione um produto do tipo Módulo (opcional)</option>
                      {form.produtoId && !produtos.some((p) => p.id === form.produtoId) && (
                        <option value={form.produtoId} disabled>
                          Produto indisponível — selecione outro
                        </option>
                      )}
                      {produtos
                        .filter(
                          (p) =>
                            p.id === form.produtoId ||
                            !placas.some((placa) => placa.id !== id && placa.produtoId === p.id)
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo} · {p.nome} {p.potencia_wp ? `(${p.potencia_wp} Wp)` : ''}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cadastre novos módulos em{' '}
                    <Link to="/sistema/parametros/produtos" className="text-blue-600 hover:underline font-semibold">
                      Parâmetros / Produtos
                    </Link>
                    . Cada produto do catálogo pode ter uma ficha técnica associada.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>
                      Fabricante <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      maxLength={120}
                      value={form.fabricante}
                      onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                      placeholder="Ex: Canadian Solar, Risen, Jinko"
                      className={campo}
                    />
                  </div>
                  <div>
                    <label className={rotulo}>
                      Modelo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      maxLength={160}
                      value={form.modelo}
                      onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                      placeholder="Ex: CS7N-660MS Bifacial"
                      className={campo}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {campos.map(({ key, label, min, max, step, sufixo }) => {
                    const isPotenciaTravada = key === 'potenciaWp' && !!produtoSelecionado?.potencia_wp;
                    return (
                      <div key={key}>
                        <label className={rotulo}>
                          {label} <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            required
                            readOnly={isPotenciaTravada}
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            value={Number.isFinite(form[key]) ? form[key] : ''}
                            onChange={(e) => setForm({ ...form, [key]: e.target.valueAsNumber })}
                            className={`${campo} pr-8 ${isPotenciaTravada ? 'bg-slate-100 text-slate-500' : ''}`}
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            {sufixo}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className={rotulo}>Observações adicionais</label>
                  <textarea
                    rows={2}
                    maxLength={5000}
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Eficiência, garantia, tecnologia das células (N-Type, TopCon, Half-cell)..."
                    className={campo}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      className="w-4 h-4 rounded text-[#004276] focus:ring-[#004276]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Disponível para novas seleções no telhado
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Ao desmarcar, a placa fica inativa e não aparece mais para novos levantamentos.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="barra-acoes bg-white border-t border-slate-100 px-5 py-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setEditando(false)}
                  className="btn-modal-cancelar"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={ocupado} className="btn-modal-salvar">
                  {ocupado ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar placa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
