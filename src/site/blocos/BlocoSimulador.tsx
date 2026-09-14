// Simulador público de economia.
//
// Chama exatamente as mesmas funções que a calculadora de propostas do CRM
// (utils/solar.ts). O que muda é o que NÃO aparece aqui: investimento, payback
// e parcela dependem do kit montado no catálogo e são conversa de consultor.
// O simulador entrega dimensionamento e economia — o resto vem na proposta.
//
// Bloco com LÓGICA: o administrador edita títulos, avisos e a chamada do
// próximo passo. A CONTA — tarifa, horas de sol, perdas, potência do módulo —
// vem de SolarCosta_Parametros e da concessionária escolhida, e não é editável
// por aqui. Número que sai no site tem de ser o mesmo que sai na proposta.

import React, { useMemo, useState } from 'react';
import { Calculator, Sun, Zap, Ruler, Layers, TrendingUp, Info } from 'lucide-react';
import { Secao, TituloSecao, Cartao } from '../components/Secao';
import { FormularioLead } from '../components/FormularioLead';
import { useConfigPublica } from '../contexto';
import { param } from '../../services/publico';
import { dimensionar, projetarEconomia, consumoAPartirDaConta } from '../../utils/solar';
import { formatCurrencyBRL, maskCurrency, parseCurrencyBRL } from '../../utils/format';
import type { ConteudoSimulador } from './tipos';

type Modo = 'conta' | 'consumo';

const ROTULO_CAMPO = 'block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5';
const CAMPO =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-marca focus:ring-2 focus:ring-blue-100 transition';

export const BlocoSimulador: React.FC<{ conteudo: ConteudoSimulador }> = ({ conteudo: c }) => {
  const { config, carregando } = useConfigPublica();

  const [modo, setModo] = useState<Modo>('conta');
  const [valorConta, setValorConta] = useState('500,00');
  const [consumoDigitado, setConsumoDigitado] = useState(420);
  const [concessionariaNome, setConcessionariaNome] = useState('');

  const concessionarias = config?.concessionarias ?? [];
  const concessionaria =
    concessionarias.find((x) => x.nome === concessionariaNome) ?? concessionarias[0] ?? null;

  // Parâmetros: a concessionária escolhida tem prioridade sobre o padrão geral,
  // porque tarifa e horas de sol variam por região.
  const tarifaKwh = concessionaria?.tarifa_kwh || param(config, 'proposta.tarifa_kwh_padrao', 1.19);
  const hsp = concessionaria?.hsp_media || param(config, 'proposta.hsp_padrao', 5.2);
  const perdasPct = param(config, 'proposta.perdas_pct_padrao', 24.5);
  const moduloWp = param(config, 'proposta.modulo_wp_padrao', 710);
  const custoDisponibilidade = concessionaria?.custo_disponibilidade ?? 0;

  const consumoKwh = useMemo(() => {
    if (modo === 'consumo') return consumoDigitado;
    return consumoAPartirDaConta(parseCurrencyBRL(valorConta), tarifaKwh, custoDisponibilidade);
  }, [modo, consumoDigitado, valorConta, tarifaKwh, custoDisponibilidade]);

  const sistema = useMemo(
    () => dimensionar({ consumoKwh, hsp, perdasPct, moduloWp }),
    [consumoKwh, hsp, perdasPct, moduloWp],
  );

  const economia = useMemo(
    () => projetarEconomia({ geracaoMediaKwh: sistema.geracaoMediaKwh, tarifaKwh }),
    [sistema.geracaoMediaKwh, tarifaKwh],
  );

  const temResultado = consumoKwh > 0 && sistema.potenciaKwp > 0;

  const resultados = [
    {
      Icone: Zap,
      rotulo: 'Potência do sistema',
      valor: `${sistema.potenciaKwp.toLocaleString('pt-BR')} kWp`,
      cor: 'text-marca',
    },
    {
      Icone: Layers,
      rotulo: 'Módulos estimados',
      valor: `${sistema.modulosQtd} un`,
      cor: 'text-slate-900',
    },
    {
      Icone: Sun,
      rotulo: 'Geração média',
      valor: `${sistema.geracaoMediaKwh.toLocaleString('pt-BR')} kWh/mês`,
      cor: 'text-slate-900',
    },
    {
      Icone: Ruler,
      rotulo: 'Área de telhado',
      valor: `${sistema.areaEstimadaM2.toLocaleString('pt-BR')} m²`,
      cor: 'text-slate-900',
    },
  ];

  return (
    <>
      <Secao>
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* ------------------------------------------------ entrada --- */}
          <Cartao className="lg:col-span-2 lg:sticky lg:top-24" regua="from-amber-500 to-orange-400">
            <h2 className="text-lg font-black text-slate-900">{c.entrada_titulo}</h2>
            <p className="text-sm text-slate-500 mt-1">{c.entrada_descricao}</p>

            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                {(
                  [
                    { id: 'conta', rotulo: 'Valor da conta' },
                    { id: 'consumo', rotulo: 'Consumo em kWh' },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setModo(op.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${
                      modo === op.id
                        ? 'bg-white text-marca shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {op.rotulo}
                  </button>
                ))}
              </div>

              {modo === 'conta' ? (
                <div>
                  <label className={ROTULO_CAMPO} htmlFor="sim-conta">
                    Quanto vem a sua conta por mês?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      id="sim-conta"
                      className={`${CAMPO} pl-11`}
                      inputMode="numeric"
                      value={valorConta}
                      onChange={(e) => setValorConta(maskCurrency(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Equivale a cerca de{' '}
                    <strong className="text-slate-700">
                      {consumoKwh.toLocaleString('pt-BR')} kWh/mês
                    </strong>{' '}
                    na tarifa de {formatCurrencyBRL(tarifaKwh)}/kWh.
                  </p>
                </div>
              ) : (
                <div>
                  <label className={ROTULO_CAMPO} htmlFor="sim-consumo">
                    Consumo médio mensal (kWh)
                  </label>
                  <input
                    id="sim-consumo"
                    className={CAMPO}
                    type="number"
                    min={0}
                    step={10}
                    value={consumoDigitado || ''}
                    onChange={(e) => setConsumoDigitado(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Está impresso na sua fatura, no histórico de consumo.
                  </p>
                </div>
              )}

              {concessionarias.length > 0 && (
                <div>
                  <label className={ROTULO_CAMPO} htmlFor="sim-concessionaria">
                    Concessionária
                  </label>
                  <select
                    id="sim-concessionaria"
                    className={CAMPO}
                    value={concessionaria?.nome ?? ''}
                    onChange={(e) => setConcessionariaNome(e.target.value)}
                  >
                    {concessionarias.map((x) => (
                      <option key={x.nome} value={x.nome}>
                        {x.nome}
                        {x.uf ? ` — ${x.uf}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-xs text-marca leading-relaxed">
                <p className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Cálculo com {hsp.toLocaleString('pt-BR')} horas de sol pleno por dia,{' '}
                    {perdasPct.toLocaleString('pt-BR')}% de perdas e módulos de {moduloWp} Wp. É uma
                    estimativa: a visita técnica confirma telhado, sombreamento e padrão de entrada.
                  </span>
                </p>
              </div>

              {carregando && (
                <p className="text-xs text-slate-400">Carregando parâmetros atualizados…</p>
              )}
            </div>
          </Cartao>

          {/* ---------------------------------------------- resultado --- */}
          <div className="lg:col-span-3 space-y-6">
            {!temResultado ? (
              <Cartao className="p-10 text-center">
                <Calculator className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="mt-4 font-bold text-slate-700">{c.vazio_titulo}</p>
                <p className="text-sm text-slate-500 mt-1">{c.vazio_texto}</p>
              </Cartao>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  {resultados.map((r) => (
                    <Cartao key={r.rotulo} className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {r.rotulo}
                        </span>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                          <r.Icone className="w-4 h-4" />
                        </div>
                      </div>
                      <p className={`mt-3 text-2xl font-black tracking-tight ${r.cor}`}>{r.valor}</p>
                    </Cartao>
                  ))}
                </div>

                {/* Painel escuro: o número que o visitante veio buscar. */}
                <div className="rounded-2xl bg-marca text-white p-7 md:p-8 relative overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 85% 15%, rgba(255,209,0,.2), transparent 45%)',
                    }}
                  />
                  <div className="relative">
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-solar tracking-widest uppercase">
                      <TrendingUp className="w-4 h-4" />
                      {c.economia_rotulo}
                    </span>

                    <div className="mt-6 grid sm:grid-cols-3 gap-6">
                      {[
                        { rotulo: 'Por mês', valor: economia.economiaMensal },
                        { rotulo: 'Por ano', valor: economia.economiaAnual },
                        { rotulo: 'Em 25 anos', valor: economia.economiaAcumulada, destaque: true },
                      ].map((e) => (
                        <div key={e.rotulo}>
                          <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
                            {e.rotulo}
                          </p>
                          <p
                            className={`mt-1.5 font-black tracking-tight ${
                              e.destaque ? 'text-2xl md:text-3xl text-solar' : 'text-xl text-white'
                            }`}
                          >
                            {formatCurrencyBRL(e.valor)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-6 pt-5 border-t border-blue-800/60 text-xs text-blue-200/80 leading-relaxed">
                      {c.nota_projecao} O sistema cobriria cerca de{' '}
                      {sistema.coberturaPct.toLocaleString('pt-BR')}% do seu consumo atual.
                    </p>
                  </div>
                </div>

                {c.nota_investimento && (
                  <Cartao className="p-5 bg-slate-50">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong className="text-slate-800">Sobre o investimento:</strong>{' '}
                      {c.nota_investimento}
                    </p>
                  </Cartao>
                )}
              </>
            )}
          </div>
        </div>
      </Secao>

      <Secao claro>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <TituloSecao
              rotulo={c.proximo_rotulo}
              titulo={c.proximo_titulo}
              descricao={c.proximo_descricao}
            />
            <ul className="mt-8 space-y-3 text-sm text-slate-600">
              {(c.proximo_itens ?? []).map((t, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-solar shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* O consumo simulado viaja junto: o consultor já abre o lead
              sabendo do que se trata. */}
          <FormularioLead
            consumoInicial={temResultado ? consumoKwh : 0}
            titulo={c.formulario_titulo}
            descricao={c.formulario_descricao}
          />
        </div>
      </Secao>
    </>
  );
};
