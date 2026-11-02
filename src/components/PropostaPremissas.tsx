import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Sliders, Plus, Trash2, Download, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { entradaSolarZerada, type EntradaSolar, type CalculoSolar } from '../../server/src/domain/propostaSolar';
import { listarSimulacoesOffGrid, abrirSimulacaoOffGrid, type ResumoOffGrid, type SimulacaoOffGrid } from '../services/offGrid';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function PropostaPremissas({
  entrada,
  onChange,
  resultado,
  legado,
  confirmado,
  onConfirmar,
  anterior,
  dimensoesFixas = false,
}: {
  entrada: EntradaSolar;
  onChange: (e: EntradaSolar) => void;
  resultado: CalculoSolar;
  legado: boolean;
  confirmado: boolean;
  onConfirmar: () => void;
  anterior?: { economiaMensal: number; potenciaKwp: number };
  dimensoesFixas?: boolean;
}) {
  const [expandido, setExpandido] = useState(legado && !confirmado);
  const [abaAtiva, setAbaAtiva] = useState<'ucs' | 'hsp' | 'parametros' | 'offgrid'>('ucs');
  const [simulacoes, setSimulacoes] = useState<ResumoOffGrid[]>([]);
  const [previa, setPrevia] = useState<SimulacaoOffGrid | null>(null);
  const [erro, setErro] = useState('');
  const [carregandoSimulacoes, setCarregandoSimulacoes] = useState(false);
  const [buscouSimulacoes, setBuscouSimulacoes] = useState(false);
  const carregarSimulacoes = useCallback(async () => {
    setErro('');
    setCarregandoSimulacoes(true);
    try { setSimulacoes(await listarSimulacoesOffGrid()); }
    catch { setErro('Não foi possível carregar as simulações. Tente atualizar a lista.'); }
    finally { setBuscouSimulacoes(true); setCarregandoSimulacoes(false); }
  }, []);
  useEffect(() => {
    if (expandido && abaAtiva === 'offgrid') void carregarSimulacoes();
  }, [expandido, abaAtiva, carregarSimulacoes]);

  const numero = (label: string, key: keyof EntradaSolar, unidade?: string, step = 'any') => (
    <div key={key}>
      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
        {label} {unidade && <span className="text-slate-400 font-normal">({unidade})</span>}
      </label>
      <input
        aria-label={label}
        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#004276]"
        type="number"
        min="0"
        step={step}
        value={(entrada[key] as number) ?? 0}
        disabled={dimensoesFixas && (key === 'larguraM' || key === 'alturaM')}
        title={dimensoesFixas && (key === 'larguraM' || key === 'alturaM') ? 'Altere as dimensões no levantamento do telhado.' : undefined}
        onChange={(ev) => onChange({ ...entrada, [key]: Number(ev.target.value) })}
      />
    </div>
  );

  const consumoImportado =
    previa?.dados.equipamentos.reduce((s, c) => s + (c.potenciaW * c.quantidade * c.horasDia) / 1000, 0) ?? 0;

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50/80 overflow-hidden text-xs transition-all">
      {/* Header do Accordion */}
      <div
        onClick={() => setExpandido(!expandido)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandido(!expandido); } }}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-xs shrink-0">
            <Sliders className="w-3.5 h-3.5 text-[#004276]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">Premissas e Parâmetros Avançados</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#004276] border border-blue-200">
                {entrada.modo === 'tecnico' ? 'Por equipamentos instalados' : 'Por demanda de consumo'}
              </span>
              {entrada.ucs.length > 1 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                  {entrada.ucs.length} UCs
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {resultado.completo
                ? `Cálculo completo · Projeção ${entrada.anoInicial}–${entrada.anoInicial + 24}`
                : 'Pendente de preenchimento de parâmetros'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {legado && !confirmado && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              <ShieldAlert className="w-3 h-3" /> Revisão necessária
            </span>
          )}
          <span className="text-slate-400">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button type="button" onClick={() => { setExpandido(true); setAbaAtiva('offgrid'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#004276] hover:bg-blue-50">
          <Plus className="w-3.5 h-3.5" /> Incluir dimensionamento off-grid
        </button>
      </div>
      {/* Conteúdo Expansível */}
      {expandido && (
        <div className="p-4 pt-1 border-t border-slate-200 bg-white space-y-4">
          {/* Alerta de legado */}
          {legado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Proposta de versão anterior (legada)</span>
              </div>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                Os resultados salvos serão preservados até que você confirme a revisão abaixo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-amber-100/60 p-2.5 rounded-lg text-[11px] font-semibold text-amber-900">
                <div>Potência: {anterior?.potenciaKwp ?? 0} kWp → {resultado.potenciaKwp.toFixed(2)} kWp</div>
                <div>Economia: R$ {(anterior?.economiaMensal ?? 0).toFixed(2)} → R$ {resultado.economiaMensal.toFixed(2)}/mês</div>
              </div>
              <button
                type="button"
                disabled={confirmado}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${confirmado
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  }`}
                onClick={onConfirmar}
              >
                {confirmado ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Revisão confirmada; use Salvar para aplicar
                  </>
                ) : (
                  'Confirmar revisão dos cálculos'
                )}
              </button>
            </div>
          )}

          {/* Abas internas do painel de premissas */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setAbaAtiva('ucs')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${abaAtiva === 'ucs' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Consumo & UCs ({entrada.ucs.length})
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva('hsp')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${abaAtiva === 'hsp' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                HSP Mensal
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva('parametros')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${abaAtiva === 'parametros' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Parâmetros do Sistema
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva('offgrid')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${abaAtiva === 'offgrid' ? 'bg-white text-[#004276] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Off-Grid
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
                Modo:
                <select
                  aria-label="Modo de cálculo"
                  className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#004276]"
                  value={entrada.modo}
                  onChange={(ev) => onChange({ ...entrada, modo: ev.target.value as EntradaSolar['modo'] })}
                >
                  <option value="tecnico">Por equipamentos instalados</option>
                  <option value="excel">Por demanda de consumo</option>
                </select>
              </label>
            </div>
          </div>

          {/* Aba UCs */}
          {abaAtiva === 'ucs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Histórico de consumo mensal em kWh. O campo de consumo médio geral preenche os 12 meses; ajuste fino individual abaixo:
                </p>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-bold text-[#004276] bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition"
                  onClick={() =>
                    onChange({
                      ...entrada,
                      ucs: [...entrada.ucs, { ...entradaSolarZerada().ucs[0], nome: `UC ${entrada.ucs.length + 1}` }],
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar UC
                </button>
              </div>

              {entrada.ucs.map((uc, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Nome UC ${i + 1}`}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-48 focus:outline-none focus:border-[#004276]"
                      value={uc.nome}
                      onChange={(ev) =>
                        onChange({
                          ...entrada,
                          ucs: entrada.ucs.map((u, j) => (j === i ? { ...u, nome: ev.target.value } : u)),
                        })
                      }
                    />
                    <div className="text-[11px] text-slate-500 font-medium ml-1">
                      Média:{' '}
                      <strong className="text-slate-800">
                        {Math.round(uc.meses.reduce((a, b) => a + b, 0) / 12)} kWh/mês
                      </strong>
                    </div>
                    {entrada.ucs.length > 1 && (
                      <button
                        type="button"
                        className="ml-auto text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Remover UC"
                        onClick={() => onChange({ ...entrada, ucs: entrada.ucs.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                    {MESES.map((m, j) => (
                      <div key={m} className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">{m}</span>
                        <input
                          aria-label={`${uc.nome} ${m}`}
                          className="w-full text-center text-xs font-bold text-slate-800 focus:outline-none"
                          type="number"
                          min="0"
                          value={uc.meses[j]}
                          onChange={(ev) =>
                            onChange({
                              ...entrada,
                              ucs: entrada.ucs.map((u, k) =>
                                k === i
                                  ? { ...u, meses: u.meses.map((v, n) => (n === j ? Number(ev.target.value) : v)) }
                                  : u,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    {(['adicionalKwh', 'disponibilidadeKwh'] as const).map((k) => (
                      <label key={k} className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>{k === 'adicionalKwh' ? 'Adicional (kWh/mês)' : 'Disponibilidade (kWh/mês)'}</span>
                        <input
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-right"
                          type="number"
                          min="0"
                          value={uc[k]}
                          onChange={(ev) =>
                            onChange({
                              ...entrada,
                              ucs: entrada.ucs.map((u, j) => (j === i ? { ...u, [k]: Number(ev.target.value) } : u)),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aba HSP */}
          {abaAtiva === 'hsp' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Horas de Sol Pleno (HSP) mensais (h/dia). O campo geral acima preenche a média uniforme; customize os meses conforme irradiação solar local:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                {MESES.map((m, j) => (
                  <div key={m} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">{m}</span>
                    <input
                      aria-label={`HSP ${m}`}
                      className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded mt-1 p-1 focus:outline-none focus:border-[#004276]"
                      type="number"
                      min="0"
                      step="0.01"
                      value={entrada.hspMensal[j]}
                      onChange={(ev) =>
                        onChange({
                          ...entrada,
                          hspMensal: entrada.hspMensal.map((v, n) => (n === j ? Number(ev.target.value) : v)),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aba Parâmetros Técnicos & Financeiros */}
          {abaAtiva === 'parametros' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {numero('Largura do módulo', 'larguraM', 'm', '0.01')}
                {numero('Altura do módulo', 'alturaM', 'm', '0.01')}
                {numero('Potência nominal inversor', 'inversorKw', 'kW', '0.1')}
                {numero('Oversizing', 'oversizingPct', '%', '0.5')}
                {numero('Reajuste tarifa', 'reajustePct', '% a.a.', '0.1')}
                {numero('Degradação 1ª transição', 'degradacaoInicialPct', '%', '0.1')}
                {numero('Degradação demais anos', 'degradacaoAnualPct', '% a.a.', '0.05')}
                {numero('Manutenção anual', 'manutencaoAnual', 'R$', '10')}
                {numero('Reajuste manutenção', 'reajusteManutencaoPct', '% a.a.', '0.1')}
                {numero('Ano troca inversor', 'trocaInversorAno', '1–25; 0=desat.', '1')}
                {numero('Valor troca inversor', 'trocaInversorValor', 'R$', '100')}
                {numero('Poupança (comparativo)', 'poupancaMesPct', '% a.m.', '0.05')}
                {entrada.modo === 'excel' && numero('Geração inicial projeção', 'geracaoAnualExcel', 'kWh/ano', '10')}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Projeção considerada: ciclo de 25 anos ({entrada.anoInicial}–{entrada.anoInicial + 24}).
              </p>
            </div>
          )}

          {/* Aba Off-Grid */}
          {abaAtiva === 'offgrid' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={carregandoSimulacoes}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
                  onClick={() => void carregarSimulacoes()}
                >
                  <Download className="w-3.5 h-3.5" />
                  {carregandoSimulacoes ? 'Carregando...' : 'Atualizar simulações'}
                </button>

                <a href="/sistema/dimensionamento-off-grid" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#004276] underline">Criar dimensionamento off-grid</a>

                {simulacoes.length > 0 && (
                  <select
                    aria-label="Simulação off-grid"
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    defaultValue=""
                    onChange={async (ev) => {
                      if (!ev.target.value) return;
                      try {
                        setPrevia(await abrirSimulacaoOffGrid(ev.target.value));
                      } catch {
                        setErro('Não foi possível abrir a simulação.');
                      }
                    }}
                  >
                    <option value="">Selecione uma simulação...</option>
                    {simulacoes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titulo}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {buscouSimulacoes && !carregandoSimulacoes && !erro && simulacoes.length === 0 && (
                <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">Nenhum dimensionamento off-grid salvo. Crie e salve um dimensionamento pelo link acima e depois clique em Atualizar simulações.</p>
              )}
              {previa && (
                <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-3 text-xs space-y-2">
                  <p className="font-bold text-[#004276]">
                    {previa.titulo}: {consumoImportado.toFixed(2)} kWh/dia → {(consumoImportado * 30).toFixed(2)} kWh/mês; HSP {previa.dados.config.irradiacaoSolar}; módulo {previa.dados.config.potenciaModuloWp} Wp; perdas {previa.dados.config.perdasSistema}%.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Aplicar substitui o histórico de UCs e o HSP mensal pelos dados desta simulação.
                  </p>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-lg text-xs transition"
                    onClick={() => {
                      onChange({
                        ...entrada,
                        ucs: [
                          {
                            nome: 'UC importada',
                            meses: Array(12).fill(consumoImportado * 30),
                            adicionalKwh: 0,
                            disponibilidadeKwh: 0,
                          },
                        ],
                        hspMensal: Array(12).fill(previa.dados.config.irradiacaoSolar),
                        moduloWp: previa.dados.config.potenciaModuloWp,
                        perdasPct: previa.dados.config.perdasSistema,
                        origemOffGrid: {
                          id: previa.id,
                          titulo: previa.titulo,
                          importadoEm: new Date().toISOString(),
                        },
                      });
                      setPrevia(null);
                    }}
                  >
                    Aplicar dados da simulação
                  </button>
                </div>
              )}

              {entrada.origemOffGrid && (
                <p className="text-[11px] text-slate-500">
                  Origem vinculada: <strong className="text-slate-700">{entrada.origemOffGrid.titulo}</strong> ({new Date(entrada.origemOffGrid.importadoEm).toLocaleDateString('pt-BR')})
                </p>
              )}
              {erro && <p role="alert" className="text-xs text-rose-600 font-semibold">{erro}</p>}
            </div>
          )}

          {/* Resumo ou Avisos de validação */}
          {!resultado.completo && (
            <div role="status" className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 space-y-1">
              <strong className="flex items-center gap-1 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5" /> Pendente de preenchimento
              </strong>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                {resultado.erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {resultado.completo && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Sem solar</span>
                <span className="font-bold text-slate-800">R$ {resultado.contaSemSolar.toFixed(2)}/mês</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Com solar (sem parcelas)</span>
                <span className="font-bold text-slate-800">R$ {resultado.contaComSolar.toFixed(2)}/mês</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Economia operacional</span>
                <span className="font-bold text-emerald-700">R$ {resultado.economiaOperacional.toFixed(2)}/mês</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Economia após parcelas</span>
                <span className="font-bold text-emerald-700">R$ {resultado.economiaMensal.toFixed(2)}/mês</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Valor da geração</span>
                <span className="font-bold text-slate-800">R$ {resultado.valorGeracaoMensal.toFixed(2)}/mês</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Módulos exatos calc.</span>
                <span className="font-bold text-slate-800">{resultado.quantidadeCalculada.toFixed(3)} un</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
