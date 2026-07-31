import React, { useMemo, useState } from 'react';
import {
  BarChart3, Users, Filter as FunnelIcon, FileBarChart, Printer, Sun, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { Lead, Contrato, Proposta, Boleto, LancamentoFinanceiro, User, LeadStage } from '../types';
import { formatCurrencyBRL } from '../utils/format';
import { REFERENCE_TODAY, formatBRDate } from '../utils/dates';

interface ReportsViewProps {
  leads: Lead[];
  contratos: Contrato[];
  propostas: Proposta[];
  boletos: Boleto[];
  lancamentos: LancamentoFinanceiro[];
  usuarios: User[];
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

type ReportKey = 'vendedores' | 'funil' | 'dre';

const STAGES_ORDER: LeadStage[] = [
  'Novo lead', 'Contato feito', 'Visita técnica', 'Proposta enviada', 'Negociação', 'Fechado',
];

const STAGE_COLORS: Record<string, string> = {
  'Novo lead': '#3b82f6',
  'Contato feito': '#06b6d4',
  'Visita técnica': '#8b5cf6',
  'Proposta enviada': '#f59e0b',
  'Negociação': '#ec4899',
  'Fechado': '#10b981',
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  leads,
  contratos,
  propostas,
  boletos,
  lancamentos,
  usuarios,
  currentUser,
  showToast,
}) => {
  const [report, setReport] = useState<ReportKey>('vendedores');

  const emissao = formatBRDate(REFERENCE_TODAY);

  /* ----------------------- Vendas por vendedor ----------------------- */
  const vendedores = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; leads: number; fechados: number; valorFechado: number; pipeline: number; propostas: number }
    >();
    leads.forEach((l) => {
      const rep = l.responsavel || 'Não atribuído';
      const row = map.get(rep) || { nome: rep, leads: 0, fechados: 0, valorFechado: 0, pipeline: 0, propostas: 0 };
      row.leads += 1;
      if (l.etapa === 'Fechado') {
        row.fechados += 1;
        row.valorFechado += l.valor || 0;
      } else {
        row.pipeline += l.valor || 0;
      }
      if (l.etapa === 'Proposta enviada' || l.etapa === 'Negociação') row.propostas += 1;
      map.set(rep, row);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, conversao: r.leads ? (r.fechados / r.leads) * 100 : 0 }))
      .sort((a, b) => b.valorFechado - a.valorFechado);
  }, [leads]);

  const vendTotals = useMemo(
    () =>
      vendedores.reduce(
        (acc, r) => ({
          leads: acc.leads + r.leads,
          fechados: acc.fechados + r.fechados,
          valorFechado: acc.valorFechado + r.valorFechado,
          pipeline: acc.pipeline + r.pipeline,
          propostas: acc.propostas + r.propostas,
        }),
        { leads: 0, fechados: 0, valorFechado: 0, pipeline: 0, propostas: 0 },
      ),
    [vendedores],
  );

  /* ------------------------------ Funil ------------------------------ */
  const funil = useMemo(() => {
    const counts: Record<string, { qtd: number; valor: number }> = {};
    STAGES_ORDER.forEach((s) => (counts[s] = { qtd: 0, valor: 0 }));
    leads.forEach((l) => {
      if (counts[l.etapa]) {
        counts[l.etapa].qtd += 1;
        counts[l.etapa].valor += l.valor || 0;
      }
    });
    const total = leads.length || 1;
    return STAGES_ORDER.map((s, i) => {
      const prev = i > 0 ? counts[STAGES_ORDER[i - 1]].qtd : counts[s].qtd;
      return {
        etapa: s,
        qtd: counts[s].qtd,
        valor: counts[s].valor,
        pctTotal: (counts[s].qtd / total) * 100,
        pctEtapaAnterior: prev ? (counts[s].qtd / prev) * 100 : 0,
        fill: STAGE_COLORS[s],
      };
    });
  }, [leads]);

  const funilTotalLeads = leads.length;
  const funilFechados = funil.find((f) => f.etapa === 'Fechado')?.qtd || 0;
  const funilConversaoGeral = funilTotalLeads ? (funilFechados / funilTotalLeads) * 100 : 0;

  /* --------------------------- DRE do mês ---------------------------- */
  const dre = useMemo(() => {
    const receitasCat = new Map<string, number>();
    const despesasCat = new Map<string, number>();
    let receitas = 0;
    let despesas = 0;
    lancamentos.forEach((l) => {
      if (l.tipo === 'receita' || l.valor > 0) {
        receitas += Math.abs(l.valor);
        receitasCat.set(l.categoria, (receitasCat.get(l.categoria) || 0) + Math.abs(l.valor));
      } else {
        despesas += Math.abs(l.valor);
        despesasCat.set(l.categoria, (despesasCat.get(l.categoria) || 0) + Math.abs(l.valor));
      }
    });
    const resultado = receitas - despesas;
    const toSorted = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor);
    return {
      receitas,
      despesas,
      resultado,
      margem: receitas ? (resultado / receitas) * 100 : 0,
      receitasCat: toSorted(receitasCat),
      despesasCat: toSorted(despesasCat),
    };
  }, [lancamentos]);

  const aReceberAberto = useMemo(
    () =>
      boletos
        .filter((b) => b.tipo === 'A receber' && b.situacao !== 'pago')
        .reduce((acc, b) => acc + b.valor, 0),
    [boletos],
  );

  /* ----------------------------- Impressão --------------------------- */
  const handlePrint = () => {
    document.body.classList.add('print-report');
    const cleanup = () => {
      document.body.classList.remove('print-report');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Fallback caso o navegador não dispare afterprint.
    setTimeout(cleanup, 1000);
    showToast('Relatório pronto para impressão', 'info', 'Use "Salvar como PDF" na janela de impressão.');
  };

  const reportTabs: { key: ReportKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'vendedores', label: 'Vendas por vendedor', Icon: Users },
    { key: 'funil', label: 'Funil de vendas', Icon: FunnelIcon },
    { key: 'dre', label: 'DRE do mês', Icon: FileBarChart },
  ];

  const reportTitle = reportTabs.find((t) => t.key === report)!.label;

  return (
    <div className="space-y-6">
      {/* Cabeçalho (não impresso) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276] flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Relatórios gerenciais
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Vendas por vendedor · funil · DRE — versão imprimível (PDF)
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-2 self-start"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Salvar PDF</span>
        </button>
      </div>

      {/* Seletor de relatório (não impresso) */}
      <div className="no-print flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        {reportTabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setReport(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              report === key ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Área imprimível */}
      <div id="report-root" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Cabeçalho do documento */}
        <div className="report-block flex items-start justify-between border-b-2 border-[#004276] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#FFD100] flex items-center justify-center shadow shrink-0">
              <Sun className="w-6 h-6 text-[#004276] fill-[#004276]" />
            </div>
            <div>
              <h2 className="font-black text-xl text-[#004276] tracking-wide leading-none">SOLAR COSTA</h2>
              <p className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">Energia Solar</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-[#004276] px-2.5 py-1 rounded">
              Relatório Gerencial
            </span>
            <h3 className="font-extrabold text-sm text-slate-800 mt-1">{reportTitle}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Competência julho/2026 · emitido em {emissao}
            </p>
            <p className="text-[10px] text-slate-400">por {currentUser.nome}</p>
          </div>
        </div>

        {/* ============================ VENDEDORES ============================ */}
        {report === 'vendedores' && (
          <div className="space-y-6">
            <div className="report-block grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile label="Contratos fechados" value={String(vendTotals.fechados)} tone="blue" />
              <KpiTile label="Valor fechado" value={formatCurrencyBRL(vendTotals.valorFechado)} tone="emerald" />
              <KpiTile label="Pipeline em aberto" value={formatCurrencyBRL(vendTotals.pipeline)} tone="amber" />
              <KpiTile
                label="Conversão média"
                value={`${vendTotals.leads ? ((vendTotals.fechados / vendTotals.leads) * 100).toFixed(1) : '0'}%`}
                tone="slate"
              />
            </div>

            <div className="report-block h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendedores.map((v) => ({ ...v, curto: v.nome.split(' ')[0] }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="curto" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip formatter={(v: any) => formatCurrencyBRL(Number(v))} />
                  <Bar dataKey="valorFechado" name="Valor fechado" fill="#004276" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="report-block border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#004276] text-white font-bold uppercase text-[10px]">
                    <th className="p-2.5">Vendedor</th>
                    <th className="p-2.5 text-center">Leads</th>
                    <th className="p-2.5 text-center">Propostas</th>
                    <th className="p-2.5 text-center">Fechados</th>
                    <th className="p-2.5 text-right">Valor fechado</th>
                    <th className="p-2.5 text-right">Pipeline</th>
                    <th className="p-2.5 text-center">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendedores.map((v) => (
                    <tr key={v.nome} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{v.nome}</td>
                      <td className="p-2.5 text-center text-slate-600">{v.leads}</td>
                      <td className="p-2.5 text-center text-slate-600">{v.propostas}</td>
                      <td className="p-2.5 text-center font-bold text-[#004276]">{v.fechados}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">{formatCurrencyBRL(v.valorFechado)}</td>
                      <td className="p-2.5 text-right text-slate-600">{formatCurrencyBRL(v.pipeline)}</td>
                      <td className="p-2.5 text-center font-bold text-slate-900">{v.conversao.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td className="p-2.5">TOTAL</td>
                    <td className="p-2.5 text-center">{vendTotals.leads}</td>
                    <td className="p-2.5 text-center">{vendTotals.propostas}</td>
                    <td className="p-2.5 text-center text-[#004276]">{vendTotals.fechados}</td>
                    <td className="p-2.5 text-right text-emerald-700">{formatCurrencyBRL(vendTotals.valorFechado)}</td>
                    <td className="p-2.5 text-right">{formatCurrencyBRL(vendTotals.pipeline)}</td>
                    <td className="p-2.5 text-center">
                      {vendTotals.leads ? ((vendTotals.fechados / vendTotals.leads) * 100).toFixed(0) : '0'}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ============================== FUNIL ============================== */}
        {report === 'funil' && (
          <div className="space-y-6">
            <div className="report-block grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile label="Total de leads" value={String(funilTotalLeads)} tone="blue" />
              <KpiTile label="Fechados" value={String(funilFechados)} tone="emerald" />
              <KpiTile label="Conversão geral" value={`${funilConversaoGeral.toFixed(1)}%`} tone="amber" />
              <KpiTile
                label="Valor no funil"
                value={formatCurrencyBRL(funil.reduce((a, f) => a + f.valor, 0))}
                tone="slate"
              />
            </div>

            <div className="report-block h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={funil} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis dataKey="etapa" type="category" width={100} tick={{ fontSize: 10, fill: '#334155' }} />
                  <Tooltip formatter={(v: any, n: any) => (n === 'qtd' ? `${v} leads` : v)} />
                  <Bar dataKey="qtd" name="qtd" radius={[0, 5, 5, 0]}>
                    {funil.map((f) => (
                      <Cell key={f.etapa} fill={f.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="report-block border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#004276] text-white font-bold uppercase text-[10px]">
                    <th className="p-2.5">Etapa</th>
                    <th className="p-2.5 text-center">Qtd.</th>
                    <th className="p-2.5 text-right">Valor</th>
                    <th className="p-2.5 text-center">% do total</th>
                    <th className="p-2.5 text-center">Passagem da etapa anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funil.map((f, i) => (
                    <tr key={f.etapa} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.fill }} />
                        {f.etapa}
                      </td>
                      <td className="p-2.5 text-center font-bold">{f.qtd}</td>
                      <td className="p-2.5 text-right text-slate-700">{formatCurrencyBRL(f.valor)}</td>
                      <td className="p-2.5 text-center text-slate-600">{f.pctTotal.toFixed(0)}%</td>
                      <td className="p-2.5 text-center text-slate-600">
                        {i === 0 ? '—' : `${f.pctEtapaAnterior.toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =============================== DRE =============================== */}
        {report === 'dre' && (
          <div className="space-y-6">
            <div className="report-block grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile label="Receitas" value={formatCurrencyBRL(dre.receitas)} tone="emerald" />
              <KpiTile label="Despesas" value={formatCurrencyBRL(dre.despesas)} tone="rose" />
              <KpiTile label="Resultado líquido" value={formatCurrencyBRL(dre.resultado)} tone="blue" />
              <KpiTile label="Margem líquida" value={`${dre.margem.toFixed(1)}%`} tone="slate" />
            </div>

            <div className="report-block grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receitas */}
              <div>
                <h4 className="font-bold text-emerald-700 text-sm mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Receitas por categoria
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {dre.receitasCat.map((r) => (
                        <tr key={r.categoria}>
                          <td className="p-2.5 text-slate-700">{r.categoria}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-700">{formatCurrencyBRL(r.valor)}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-50 font-black text-emerald-800">
                        <td className="p-2.5">Total de receitas</td>
                        <td className="p-2.5 text-right">{formatCurrencyBRL(dre.receitas)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Despesas */}
              <div>
                <h4 className="font-bold text-rose-700 text-sm mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Despesas por categoria
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {dre.despesasCat.map((d) => (
                        <tr key={d.categoria}>
                          <td className="p-2.5 text-slate-700">{d.categoria}</td>
                          <td className="p-2.5 text-right font-bold text-rose-700">{formatCurrencyBRL(d.valor)}</td>
                        </tr>
                      ))}
                      <tr className="bg-rose-50 font-black text-rose-800">
                        <td className="p-2.5">Total de despesas</td>
                        <td className="p-2.5 text-right">{formatCurrencyBRL(dre.despesas)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Apuração do resultado */}
            <div className="report-block bg-[#004276] text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-[#FFD100] uppercase tracking-widest block">
                  Resultado do período (regime de caixa)
                </span>
                <h3 className="text-3xl font-black mt-1">{formatCurrencyBRL(dre.resultado)}</h3>
                <p className="text-xs text-blue-200 mt-0.5">Margem líquida de {dre.margem.toFixed(1)}% sobre as receitas</p>
              </div>
              <div className="text-right text-xs bg-blue-900/60 rounded-xl p-3 border border-blue-800">
                <p className="text-blue-200">
                  Contas a receber em aberto:{' '}
                  <strong className="text-white">{formatCurrencyBRL(aReceberAberto)}</strong>
                </p>
                <p className="text-blue-200 mt-1">
                  Contratos ativos: <strong className="text-white">{contratos.length}</strong> · Propostas:{' '}
                  <strong className="text-white">{propostas.length}</strong>
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * Apuração pelo regime de caixa a partir dos lançamentos financeiros do período. Não substitui a
              contabilidade oficial.
            </p>
          </div>
        )}

        {/* Rodapé do documento */}
        <div className="report-block pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>Solar Costa Energia Solar · Rua Alzira Maria Ferreira, 241 – Belo Horizonte/MG</span>
          <span>Documento gerado pelo CRM em {emissao}</span>
        </div>
      </div>
    </div>
  );
};

/* Cartão compacto de indicador, reutilizado pelos três relatórios. */
const KpiTile: React.FC<{ label: string; value: string; tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' }> = ({
  label,
  value,
  tone,
}) => {
  const tones: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-[#004276]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">{label}</span>
      <p className="text-lg font-black mt-0.5 leading-tight">{value}</p>
    </div>
  );
};
