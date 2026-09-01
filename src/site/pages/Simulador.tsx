// Simulador público de economia.
//
// Chama exatamente as mesmas funções que a calculadora de propostas do CRM
// (utils/solar.ts). O que muda é o que NÃO aparece aqui: investimento, payback
// e parcela dependem do kit montado no catálogo e são conversa de consultor.
// O simulador entrega dimensionamento e economia — o resto vem na proposta.

import React, { useMemo, useState } from 'react';
import { Calculator, Sun, Zap, Ruler, Layers, TrendingUp, Info } from 'lucide-react';
import { useSeo } from '../seo';
import { Secao, TituloSecao, Cartao } from '../components/Secao';
import { FormularioLead } from '../components/FormularioLead';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { PerguntasFrequentes } from '../components/PerguntasFrequentes';
import { useConfigPublica } from '../contexto';
import { param } from '../../services/publico';
import { dimensionar, projetarEconomia, consumoAPartirDaConta } from '../../utils/solar';
import { formatCurrencyBRL, maskCurrency, parseCurrencyBRL } from '../../utils/format';
import { FAQ } from '../conteudo';

type Modo = 'conta' | 'consumo';

export const Simulador: React.FC = () => {
  useSeo({
    titulo: 'Simulador de economia com energia solar',
    descricao:
      'Informe o valor da sua conta de luz e veja a potência do sistema, a geração estimada e quanto você economiza em 25 anos com energia solar.',
  });

  const { config, carregando } = useConfigPublica();

  const [modo, setModo] = useState<Modo>('conta');
  const [valorConta, setValorConta] = useState('500,00');
  const [consumoDigitado, setConsumoDigitado] = useState(420);
  const [concessionariaNome, setConcessionariaNome] = useState('');

  const concessionarias = config?.concessionarias ?? [];
  const concessionaria =
    concessionarias.find((c) => c.nome === concessionariaNome) ?? concessionarias[0] ?? null;

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

  const rotuloCampo = 'block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5';
  const campo =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-marca focus:ring-2 focus:ring-blue-100 transition';

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
      <CabecalhoPagina
        rotulo="Simulador"
        Icone={Calculator}
        titulo="Quanto o sol pode tirar da sua conta de luz?"
        descricao="A mesma conta que os nossos consultores fazem na proposta, com as horas de sol da sua região e as perdas reais do sistema."
      />

      <Secao>
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* ------------------------------------------------ entrada --- */}
          <Cartao className="lg:col-span-2 lg:sticky lg:top-24" regua="from-amber-500 to-orange-400">
            <h2 className="text-lg font-black text-slate-900">Seus dados de consumo</h2>
            <p className="text-sm text-slate-500 mt-1">
              Use a média dos últimos meses — a conta varia bastante entre verão e inverno.
            </p>

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
                  <label className={rotuloCampo} htmlFor="sim-conta">
                    Quanto vem a sua conta por mês?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      id="sim-conta"
                      className={`${campo} pl-11`}
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
                  <label className={rotuloCampo} htmlFor="sim-consumo">
                    Consumo médio mensal (kWh)
                  </label>
                  <input
                    id="sim-consumo"
                    className={campo}
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
                  <label className={rotuloCampo} htmlFor="sim-concessionaria">
                    Concessionária
                  </label>
                  <select
                    id="sim-concessionaria"
                    className={campo}
                    value={concessionaria?.nome ?? ''}
                    onChange={(e) => setConcessionariaNome(e.target.value)}
                  >
                    {concessionarias.map((c) => (
                      <option key={c.nome} value={c.nome}>
                        {c.nome}
                        {c.uf ? ` — ${c.uf}` : ''}
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
                    {perdasPct.toLocaleString('pt-BR')}% de perdas e módulos de {moduloWp} Wp. É
                    uma estimativa: a visita técnica confirma telhado, sombreamento e padrão de
                    entrada.
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
                <p className="mt-4 font-bold text-slate-700">Informe seu consumo ao lado</p>
                <p className="text-sm text-slate-500 mt-1">
                  Com o valor da conta ou o consumo em kWh já conseguimos dimensionar o sistema.
                </p>
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
                      Sua economia estimada
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
                      A projeção de 25 anos considera reajuste de 6% ao ano na tarifa de energia —
                      é justamente por isso que a economia cresce com o tempo. O sistema cobriria
                      cerca de {sistema.coberturaPct.toLocaleString('pt-BR')}% do seu consumo
                      atual.
                    </p>
                  </div>
                </div>

                <Cartao className="p-5 bg-slate-50">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-800">Sobre o investimento:</strong> o valor do
                    sistema depende dos equipamentos escolhidos, da estrutura do seu telhado e da
                    forma de pagamento. Por isso ele não sai numa simulação automática — vem na
                    proposta, depois da visita técnica, com tudo detalhado.
                  </p>
                </Cartao>
              </>
            )}
          </div>
        </div>
      </Secao>

      <Secao claro>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <TituloSecao
              rotulo="Próximo passo"
              titulo="Leve esse número para uma proposta de verdade"
              descricao="Enviamos o seu contato junto com o consumo simulado, para o consultor já começar a conversa sabendo do que se trata."
            />
            <ul className="mt-8 space-y-3 text-sm text-slate-600">
              {[
                'Visita técnica sem custo, no dia que der para você',
                'Proposta com equipamentos, geração projetada e garantias',
                'Formas de pagamento à vista, cartão ou financiamento',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-solar shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <FormularioLead
            consumoInicial={temResultado ? consumoKwh : 0}
            titulo="Quero minha proposta"
            descricao="Preencha e um consultor entra em contato para agendar a visita."
          />
        </div>
      </Secao>

      <PerguntasFrequentes perguntas={FAQ.slice(0, 3)} />
    </>
  );
};
