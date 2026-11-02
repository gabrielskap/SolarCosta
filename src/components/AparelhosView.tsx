import React, { useEffect, useState, useMemo } from 'react';
import { SlidersHorizontal, Search, Plus, Home, Zap, Flame, Trash2, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { ErroApi } from '../services/http';
import { excluirAparelho, listarAparelhos, salvarAparelho, type Aparelho } from '../services/aparelhos';
import { ModalCabecalho } from './comuns/ModalCabecalho';

const vazio = { ambiente: '', nome: '', potenciaW: '' };
const mensagem = (e: unknown) =>
  e instanceof ErroApi ? e.mensagemCompleta : e instanceof Error ? e.message : 'Não foi possível concluir a operação.';

const AMBIENTES_SUGERIDOS = [
  'Sala de estar',
  'Cozinha',
  'Quarto',
  'Escritório',
  'Banheiro',
  'Lavanderia',
  'Área externa / Varanda',
  'Oficina / Garagem',
];

export function AparelhosView() {
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [id, setId] = useState<string>();
  const [editando, setEditando] = useState(false);
  const [busca, setBusca] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [exclusao, setExclusao] = useState<Aparelho>();

  const carregar = async () => {
    setCarregando(true);
    try {
      setAparelhos(await listarAparelhos());
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const ambientes = useMemo(
    () => [...new Set(aparelhos.map((a) => a.ambiente))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [aparelhos]
  );

  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const visiveis = useMemo(() => {
    return aparelhos.filter((a) => {
      const bateAmbiente = !ambiente || a.ambiente === ambiente;
      const texto = `${a.nome} ${a.ambiente}`;
      const bateBusca = !busca.trim() || normalizar(texto).includes(normalizar(busca));
      return bateAmbiente && bateBusca;
    });
  }, [aparelhos, ambiente, busca]);

  // KPIs
  const totalAparelhos = aparelhos.length;
  const totalAmbientes = ambientes.length;
  const potenciaMedia = useMemo(
    () => (totalAparelhos ? Math.round(aparelhos.reduce((acc, a) => acc + (a.potenciaW || 0), 0) / totalAparelhos) : 0),
    [aparelhos, totalAparelhos]
  );
  const maiorConsumo = useMemo(
    () =>
      aparelhos.reduce<Aparelho | undefined>(
        (max, a) => (max === undefined || a.potenciaW > max.potenciaW ? a : max),
        undefined
      ),
    [aparelhos]
  );

  const rotulo = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
  const campo =
    'w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 ' +
    'placeholder:font-normal placeholder:text-slate-400 transition ' +
    'focus:outline-none focus:bg-white focus:border-[#004276] focus:ring-4 focus:ring-[#004276]/10';

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      await salvarAparelho(
        {
          ambiente: form.ambiente.trim(),
          nome: form.nome.trim(),
          potenciaW: Number(form.potenciaW),
        },
        id
      );
      setEditando(false);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  const handleExcluir = async () => {
    if (!exclusao) return;
    setOcupado(true);
    setErro('');
    try {
      await excluirAparelho(exclusao.id);
      setExclusao(undefined);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Parâmetros</span>
            <span>/</span>
            <span className="text-[#004276]">Aparelhos</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Cadastro de Aparelhos</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Aparelhos por ambiente e potência nominal em watts para simulação off-grid · {totalAparelhos} aparelhos cadastrados
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
              placeholder="Buscar aparelho ou ambiente..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004276] w-48 sm:w-64"
            />
          </div>

          <button
            disabled={ocupado}
            onClick={() => {
              setForm({ ...vazio });
              setId(undefined);
              setEditando(true);
              setExclusao(undefined);
              setErro('');
            }}
            className="px-3.5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Novo aparelho
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aparelhos</span>
            <SlidersHorizontal className="w-4 h-4 text-[#004276]" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1">{totalAparelhos}</h3>
          <p className="text-[10px] text-slate-500 font-medium">no catálogo off-grid</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ambientes</span>
            <Home className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1">{totalAmbientes}</h3>
          <p className="text-[10px] text-slate-500 font-medium">cômodos mapeados</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potência média</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-xl font-black text-[#004276] mt-1">
            {potenciaMedia > 0 ? `${potenciaMedia.toLocaleString('pt-BR')} W` : '–'}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">consumo médio</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maior consumo</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-1 truncate">
            {maiorConsumo ? `${maiorConsumo.potenciaW.toLocaleString('pt-BR')} W` : '–'}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium truncate" title={maiorConsumo?.nome}>
            {maiorConsumo ? `${maiorConsumo.nome}` : 'sem dados'}
          </p>
        </div>
      </div>

      {/* Filtro por Ambiente */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filtrar por ambiente:</span>
        </div>
        <div className="relative min-w-[220px]">
          <select
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 appearance-none pr-9 focus:outline-none focus:border-[#004276] cursor-pointer"
          >
            <option value="">Todos os ambientes ({totalAparelhos})</option>
            {ambientes.map((amb) => {
              const qtd = aparelhos.filter((a) => a.ambiente === amb).length;
              return (
                <option key={amb} value={amb}>
                  {amb} ({qtd})
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Tabela em Lista */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">AMBIENTE</th>
                <th className="p-3">APARELHO</th>
                <th className="p-3">POTÊNCIA NOMINAL</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    Carregando aparelhos…
                  </td>
                </tr>
              )}
              {!carregando && visiveis.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    Nenhum aparelho encontrado.
                  </td>
                </tr>
              )}
              {!carregando &&
                visiveis.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td data-label="AMBIENTE" className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                        <Home className="w-3.5 h-3.5 text-slate-400" />
                        {a.ambiente}
                      </span>
                    </td>

                    <td data-label="APARELHO" className="p-3 font-bold text-slate-900 text-[13px]">
                      {a.nome}
                    </td>

                    <td data-label="POTÊNCIA NOMINAL" className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 font-black px-2.5 py-1 rounded-lg text-xs">
                          {a.potenciaW.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} W
                        </span>
                        {a.potenciaW >= 1000 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            ({(a.potenciaW / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kW)
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="AÇÕES" className="p-3 text-right font-bold space-x-2 whitespace-nowrap">
                      <button
                        disabled={ocupado}
                        onClick={() => {
                          setForm({
                            ambiente: a.ambiente,
                            nome: a.nome,
                            potenciaW: String(a.potenciaW),
                          });
                          setId(a.id);
                          setEditando(true);
                          setExclusao(undefined);
                          setErro('');
                        }}
                        className="text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        disabled={ocupado}
                        onClick={() => {
                          setExclusao(a);
                          setEditando(false);
                          setErro('');
                        }}
                        className="text-rose-600 hover:underline disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro / Edição */}
      {editando && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <ModalCabecalho
              icone={SlidersHorizontal}
              titulo={id ? 'Editar aparelho' : 'Cadastrar aparelho'}
              subtitulo="Parâmetros de consumo para dimensionamento off-grid"
              onFechar={() => setEditando(false)}
            />

            <form onSubmit={handleSalvar} className="campos-modal flex-1 min-h-0 flex flex-col">
              <div className="modal-corpo campos-modal flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={rotulo}>
                    Ambiente / Cômodo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={80}
                    list="ambientes-aparelhos"
                    value={form.ambiente}
                    onChange={(e) => setForm({ ...form, ambiente: e.target.value })}
                    placeholder="Ex: Sala de estar, Cozinha, Quarto..."
                    className={campo}
                  />
                  <datalist id="ambientes-aparelhos">
                    {[...new Set([...AMBIENTES_SUGERIDOS, ...ambientes])].map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Digite um novo ambiente ou selecione uma das sugestões automáticas.
                  </p>
                </div>

                <div>
                  <label className={rotulo}>
                    Nome do aparelho <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={160}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Ar-condicionado Split 12.000 BTU Inverter"
                    className={campo}
                  />
                </div>

                <div>
                  <label className={rotulo}>
                    Potência nominal <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      value={form.potenciaW}
                      onChange={(e) => setForm({ ...form, potenciaW: e.target.value })}
                      placeholder="Ex: 1100"
                      className={`${campo} pr-10 font-bold`}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      W
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#004276]" />
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    A potência em watts (W) é utilizada no cálculo de autonomia das baterias e na capacidade necessária do inversor no simulador off-grid.
                  </p>
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
                  {ocupado ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar aparelho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {exclusao && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-md overflow-hidden">
            <ModalCabecalho
              icone={Trash2}
              tom="escuro"
              titulo="Confirmar exclusão"
              subtitulo="Aparelhos do catálogo off-grid"
              onFechar={() => setExclusao(undefined)}
            />

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed text-sm">
                Tem certeza de que deseja remover o aparelho <strong className="text-slate-900">{exclusao.nome}</strong>{' '}
                do ambiente <strong className="text-slate-900">{exclusao.ambiente}</strong> ({exclusao.potenciaW} W)?
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setExclusao(undefined)}
                  className="btn-modal-cancelar"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={handleExcluir}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow transition disabled:opacity-50"
                >
                  {ocupado ? 'Excluindo…' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
