import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileCheck,
  DollarSign, 
  Zap, 
  Target, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Calendar,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  Award
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Lead, Contrato, Proposta, LancamentoFinanceiro, User, Agendamento } from '../types';
import { parseBRDate, daysBetween } from '../utils/dates';

interface DashboardViewProps {
  leads: Lead[];
  contratos: Contrato[];
  propostas: Proposta[];
  lancamentos: LancamentoFinanceiro[];
  usuarios: User[];
  agendamentos?: Agendamento[];
  onSaveAgendamento?: (agendamento: Agendamento) => void;
  onDeleteAgendamento?: (id: string) => void;
  onSelectLead?: (leadId: string) => void;
  showToast?: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  leads = [],
  contratos = [],
  propostas = [],
  lancamentos = [],
  usuarios = [],
  agendamentos = [],
  onSaveAgendamento = () => {},
  onDeleteAgendamento = () => {},
  onSelectLead,
  showToast = () => {},
  onNavigateTab,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '6m' | 'year'>('year');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('pt-BR').format(val || 0);
  };

  // 1. Calculate KPI Metrics
  const totalLeads = leads.length;
  const leadsFechados = leads.filter(l => l.etapa === 'Fechado').length;
  const taxaConversao = totalLeads > 0 ? ((leadsFechados / totalLeads) * 100).toFixed(1) : '0';

  const valorTotalPipeline = leads.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  const valorTotalContratos = contratos.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
  const potenciaTotalKwp = contratos.reduce((acc, curr) => acc + (curr.potenciaKwp || 0), 0);

  // Receita de lançamentos financeiros
  const receitasLancamentos = lancamentos
    .filter(l => l.tipo === 'receita')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const faturamentoTotalRealizado = valorTotalContratos > 0 ? valorTotalContratos : receitasLancamentos;

  // Índice do mês (1-12) a partir de "DD/MM" ou "DD/MM/AAAA".
  const monthFromStr = (value?: string): number => {
    if (!value) return 0;
    const parts = value.split('/');
    return parts.length >= 2 ? parseInt(parts[1], 10) : 0;
  };

  // 2. Faturamento mensal (calculado a partir de lançamentos e propostas reais)
  const REF_MONTH = 7; // julho/2026 é o mês de referência do sistema
  const monthlyRevenueData = useMemo(() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const series = monthNames.map(m => ({ mes: m, faturamento: 0, propostas: 0 }));

    // Faturamento realizado = receitas lançadas no caixa, por mês.
    lancamentos.forEach(l => {
      if (l.tipo !== 'receita') return;
      const mm = monthFromStr(l.data);
      if (mm >= 1 && mm <= 12) series[mm - 1].faturamento += l.valor || 0;
    });

    // Volume de propostas geradas por mês (valor total proposto).
    propostas.forEach(p => {
      const mm = monthFromStr(p.dataCriacao);
      if (mm >= 1 && mm <= 12) series[mm - 1].propostas += p.valorTotal || 0;
    });

    // O seletor de período controla a janela exibida (funil até o mês de ref.).
    const janela = selectedPeriod === '6m' ? 6 : REF_MONTH;
    const inicio = Math.max(0, REF_MONTH - janela);
    return series.slice(inicio, REF_MONTH);
  }, [lancamentos, propostas, selectedPeriod]);

  // Variação do faturamento do mês corrente vs. mês anterior (quando há base).
  const receitaMesAtual = monthlyRevenueData.length ? monthlyRevenueData[monthlyRevenueData.length - 1].faturamento : 0;
  const receitaMesAnterior = monthlyRevenueData.length > 1 ? monthlyRevenueData[monthlyRevenueData.length - 2].faturamento : 0;
  const momDeltaPct = receitaMesAnterior > 0 ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100 : null;

  // 3. Data for "Leads por Etapa" Chart
  const stagesOrder = [
    'Novo lead',
    'Contato feito',
    'Visita técnica',
    'Proposta enviada',
    'Negociação',
    'Fechado'
  ];

  const stageColors: Record<string, string> = {
    'Novo lead': '#3b82f6',        // blue
    'Contato feito': '#06b6d4',     // cyan
    'Visita técnica': '#8b5cf6',    // purple
    'Proposta enviada': '#f59e0b',  // amber
    'Negociação': '#ec4899',        // pink
    'Fechado': '#10b981'           // emerald
  };

  const leadsByStageData = useMemo(() => {
    const counts: Record<string, { stage: string; qtd: number; valor: number }> = {};
    
    stagesOrder.forEach(stg => {
      counts[stg] = { stage: stg, qtd: 0, valor: 0 };
    });

    leads.forEach(l => {
      if (counts[l.etapa]) {
        counts[l.etapa].qtd += 1;
        counts[l.etapa].valor += l.valor || 0;
      }
    });

    return stagesOrder.map(stg => ({
      name: stg,
      quantidade: counts[stg].qtd,
      valor: counts[stg].valor,
      fill: stageColors[stg] || '#64748b'
    }));
  }, [leads]);

  // 4. Volume de vendas por responsável (calculado a partir dos leads)
  const salesVolumeData = useMemo(() => {
    const salesByRep: Record<string, { nome: string; propostasQtd: number; contratosQtd: number; valorVendas: number }> = {};

    leads.forEach(l => {
      const rep = l.responsavel || 'Não atribuído';
      if (!salesByRep[rep]) {
        salesByRep[rep] = { nome: rep.split(' ')[0] + ' ' + (rep.split(' ')[1]?.[0] || ''), propostasQtd: 0, contratosQtd: 0, valorVendas: 0 };
      }
      if (l.etapa === 'Fechado') {
        salesByRep[rep].contratosQtd += 1;
        salesByRep[rep].valorVendas += l.valor || 0;
      } else if (l.etapa === 'Proposta enviada' || l.etapa === 'Negociação') {
        salesByRep[rep].propostasQtd += 1;
      }
    });

    return Object.values(salesByRep)
      .filter(r => r.propostasQtd > 0 || r.contratosQtd > 0)
      .sort((a, b) => b.valorVendas - a.valorVendas);
  }, [leads]);

  // Ciclo médio de venda: dias entre a criação do lead e o seu fechamento
  // (aproximado pela data mais recente do histórico de leads fechados).
  const cicloMedioDias = useMemo(() => {
    const duracoes: number[] = [];
    leads.filter(l => l.etapa === 'Fechado').forEach(l => {
      const inicio = parseBRDate(l.dataCriacao);
      const datasHist = (l.historico || [])
        .map(h => parseBRDate(h.data))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime());
      const fim = datasHist[0];
      if (inicio && fim) {
        const d = daysBetween(inicio, fim);
        if (d >= 0) duracoes.push(d);
      }
    });
    if (!duracoes.length) return null;
    return Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length);
  }, [leads]);

  // Origem com maior taxa de conversão (fechados / total por origem).
  const origemMaiorConversao = useMemo(() => {
    const byOrigem: Record<string, { total: number; fechados: number }> = {};
    leads.forEach(l => {
      const o = l.origem || 'Outros';
      byOrigem[o] = byOrigem[o] || { total: 0, fechados: 0 };
      byOrigem[o].total += 1;
      if (l.etapa === 'Fechado') byOrigem[o].fechados += 1;
    });
    let best: { origem: string; pct: number } | null = null;
    Object.entries(byOrigem).forEach(([origem, v]) => {
      if (v.fechados <= 0) return;
      const pct = (v.fechados / v.total) * 100;
      if (!best || pct > best.pct) best = { origem, pct };
    });
    return best as { origem: string; pct: number } | null;
  }, [leads]);

  // Custom Recharts Tooltip Component for Currency Formatting
  const CustomTooltipCurrency = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-amber-400 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="flex items-center justify-between gap-4 text-slate-200 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-mono font-bold">
                {typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomTooltipCount = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-blue-300 mb-1">{label}</p>
          <p className="py-0.5 text-slate-200 flex justify-between gap-3">
            <span>Quantidade de Leads:</span>
            <strong className="font-mono text-amber-400">{data.quantidade} leads</strong>
          </p>
          <p className="py-0.5 text-slate-200 flex justify-between gap-3">
            <span>Valor em Potencial:</span>
            <strong className="font-mono text-emerald-400">{formatCurrency(data.valor)}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-[#004276] rounded-xl font-semibold text-xs flex items-center gap-1.5 border border-blue-100">
              <BarChart3 className="w-4 h-4 text-[#004276]" />
              Visão Geral
            </span>
            <span className="text-xs text-slate-400">• Atualizado hoje</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Dashboard de Desempenho</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Acompanhe o faturamento, evolução de leads e volume de vendas em tempo real.
          </p>
        </div>

        {/* Period Selector Filter */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedPeriod === 'year'
                ? 'bg-white text-[#004276] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ano Atual (2026)
          </button>
          <button
            onClick={() => setSelectedPeriod('6m')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedPeriod === '6m'
                ? 'bg-white text-[#004276] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Últimos 6 meses
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Faturamento Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturamento Acumulado</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {formatCurrency(faturamentoTotalRealizado)}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
              {momDeltaPct !== null ? (
                <>
                  {momDeltaPct >= 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    : <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
                  <span className={momDeltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {momDeltaPct >= 0 ? '+' : ''}{momDeltaPct.toFixed(1)}% vs mês anterior
                  </span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">{formatCurrency(receitaMesAtual)} realizados no mês</span>
                </>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        </div>

        {/* KPI 2: Total em Contratos Fechados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contratos Fechados</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {contratos.length}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({taxaConversao}% de conversão)
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{formatCurrency(valorTotalContratos)} em projetos</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-500" />
        </div>

        {/* KPI 3: Volume no Pipeline de Leads */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline de Leads</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {totalLeads}
              </span>
              <span className="text-xs font-semibold text-slate-500">leads em aberto</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatCurrency(valorTotalPipeline)} em oportunidades</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        </div>

        {/* KPI 4: Potência Total kWp */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Potência Vendida</span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {potenciaTotalKwp.toFixed(2)} <span className="text-base font-bold text-slate-500">kWp</span>
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-600 font-medium">
              <Award className="w-3.5 h-3.5" />
              <span>Média de {(potenciaTotalKwp / (contratos.length || 1)).toFixed(1)} kWp por projeto</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-500" />
        </div>

      </div>

      {/* Main Recharts Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. CHART: Faturamento Mensal (Occupies 2 columns on desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#004276]" />
                  Faturamento Mensal vs. Meta (R$)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evolução do faturamento bruto e volume de propostas geradas por mês
                </p>
              </div>
              <button 
                onClick={() => onNavigateTab('financeiro')}
                className="text-xs font-bold text-[#004276] hover:text-blue-900 flex items-center gap-1 hover:underline"
              >
                Ver Financeiro <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-72 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyRevenueData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004276" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#004276" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorPropostas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip content={<CustomTooltipCurrency />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                    formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="faturamento" 
                    name="Faturamento Realizado" 
                    stroke="#004276" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorFaturamento)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="propostas" 
                    name="Volume de Propostas" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1} 
                    fill="url(#colorPropostas)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Projeção de crescimento para o próximo trimestre: <strong className="text-emerald-600 font-bold">+15%</strong></span>
            <span className="font-semibold text-slate-700">Meta Anual: R$ 1.200.000,00</span>
          </div>
        </div>

        {/* 2. CHART: Leads por Etapa (Kanban Pipeline Distribution) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-amber-500" />
                  Leads por Etapa do Funil
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribuição de leads nas etapas do Kanban
                </p>
              </div>
              <button 
                onClick={() => onNavigateTab('leads')}
                className="text-xs font-bold text-[#004276] hover:text-blue-900 flex items-center gap-1 hover:underline"
              >
                Ver Kanban <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bar chart for Funnel Stages */}
            <div className="h-72 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={leadsByStageData}
                  margin={{ top: 5, right: 20, left: 25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fill: '#334155', fontSize: 10, fontWeight: 600 }}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltipCount />} />
                  <Bar dataKey="quantidade" radius={[0, 6, 6, 0]}>
                    {leadsByStageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Maior volume atual:</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Proposta enviada ({leads.filter(l => l.etapa === 'Proposta enviada').length})
            </span>
          </div>
        </div>

      </div>

      {/* 3. CHART: Volume de Vendas por Responsável / Vendedor */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Volume de Vendas & Desempenho da Equipe
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativo de propostas em andamento vs. contratos fechados por vendedor
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('contratos')}
            className="text-xs font-bold text-[#004276] hover:text-blue-900 flex items-center gap-1 hover:underline self-start sm:self-auto"
          >
            Ver Contratos <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          
          <div className="lg:col-span-2 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={salesVolumeData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="nome" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#004276" tick={{ fontSize: 11 }} />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#10b981" 
                  tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltipCurrency />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Bar yAxisId="left" dataKey="propostasQtd" name="Propostas Ativas (Qtd)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="contratosQtd" name="Contratos Fechados (Qtd)" fill="#004276" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="valorVendas" name="Valor em Vendas (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Side summary panel */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/70 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumo do Mês</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Ticket Médio por Projeto:</span>
                <strong className="text-slate-900 font-bold">
                  {formatCurrency(valorTotalContratos / (contratos.length || 1))}
                </strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Ciclo Médio de Venda:</span>
                <strong className="text-slate-900 font-bold">{cicloMedioDias !== null ? `${cicloMedioDias} dias` : '—'}</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Origem com Maior Conversão:</span>
                <strong className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                  {origemMaiorConversao ? `${origemMaiorConversao.origem} (${origemMaiorConversao.pct.toFixed(0)}%)` : '—'}
                </strong>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigateTab('propostas/nova')}
                className="w-full py-2 bg-[#004276] hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
              >
                <span>Criar Nova Proposta</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
