import React, { useState } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Calendar, Download, Plus, Copy, CheckCircle2, Printer, Trash2, X, FileSpreadsheet, ChevronDown
} from 'lucide-react';
import { Boleto, LancamentoFinanceiro, User } from '../types';

interface FinancialViewProps {
  boletos: Boleto[];
  lancamentos: LancamentoFinanceiro[];
  onSaveBoleto: (boleto: Boleto) => void;
  onDeleteBoleto: (id: string) => void;
  onAddLancamento: (l: LancamentoFinanceiro) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  boletos,
  lancamentos,
  onSaveBoleto,
  onDeleteBoleto,
  onAddLancamento,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  const [filterLancamentos, setFilterLancamentos] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [filterBoletos, setFilterBoletos] = useState<'todos' | 'A receber' | 'A pagar' | 'em_aberto' | 'pago'>('todos');
  
  // Modals and Menus state
  const [isNovoLancamentoOpen, setIsNovoLancamentoOpen] = useState(false);
  const [isEmitirBoletoOpen, setIsEmitirBoletoOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // CSV Export Utilities
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const formatField = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = [
      headers.map(h => formatField(h)).join(';'),
      ...rows.map(row => row.map(cell => formatField(cell)).join(';'))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportLancamentos = () => {
    if (!filteredLancamentos || filteredLancamentos.length === 0) {
      showToast('Nenhum lançamento', 'info', 'Não há lançamentos no filtro atual.');
      return;
    }
    const headers = ['ID', 'Data', 'Descrição', 'Categoria', 'Obra / Ref', 'Tipo', 'Valor (R$)'];
    const rows = filteredLancamentos.map(l => [
      l.id,
      l.data,
      l.descricao,
      l.categoria,
      l.obraRef,
      l.tipo === 'receita' ? 'Receita / Entrada' : 'Despesa / Saída',
      l.valor.toFixed(2).replace('.', ',')
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCSV(`lancamentos_financeiros_${dateStr}.csv`, headers, rows);
    showToast('Exportação concluída', 'success', `${filteredLancamentos.length} lançamentos exportados em CSV para a contabilidade.`);
    setIsExportMenuOpen(false);
  };

  const handleExportBoletos = () => {
    if (!filteredBoletos || filteredBoletos.length === 0) {
      showToast('Nenhum boleto', 'info', 'Não há boletos ou contas no filtro atual.');
      return;
    }
    const headers = [
      'ID',
      'Cliente / Sacado',
      'CPF / CNPJ',
      'Tipo de Operação',
      'Categoria',
      'Obra / Ref',
      'Parcela',
      'Vencimento',
      'Valor (R$)',
      'Situação',
      'Data de Pagamento',
      'Linha Digitável / Código de Barras'
    ];
    const rows = filteredBoletos.map(b => [
      b.id,
      b.clienteNome,
      b.cpfCnpj || '',
      b.tipo,
      b.categoria,
      b.obraRef || '',
      b.parcela,
      b.vencimento,
      b.valor.toFixed(2).replace('.', ','),
      b.situacao === 'pago' ? 'Pago' : b.situacao === 'vencido' ? 'Vencido' : 'Em Aberto',
      b.dataPagamento || '',
      b.linhaDigitavel
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCSV(`contas_e_boletos_contabilidade_${dateStr}.csv`, headers, rows);
    showToast('Exportação concluída', 'success', `${filteredBoletos.length} títulos e boletos exportados em CSV.`);
    setIsExportMenuOpen(false);
  };

  const handleExportConsolidado = () => {
    const headers = [
      'Módulo / Origem',
      'ID',
      'Data / Vencimento',
      'Descrição / Sacado',
      'Tipo',
      'Categoria',
      'Obra / Ref',
      'Valor (R$)',
      'Situação / Status',
      'Detalhes / Linha Digitável'
    ];

    const rowsLancamentos = (lancamentos || []).map(l => [
      'Caixa / Lançamento',
      l.id,
      l.data,
      l.descricao,
      l.tipo === 'receita' ? 'Entrada' : 'Saída',
      l.categoria,
      l.obraRef,
      l.valor.toFixed(2).replace('.', ','),
      'Realizado',
      '-'
    ]);

    const rowsBoletos = (boletos || []).map(b => [
      'Boleto / Título BB',
      b.id,
      b.vencimento,
      `${b.clienteNome} (${b.cpfCnpj || 'Sem CPF'})`,
      b.tipo,
      b.categoria,
      b.obraRef || '',
      b.valor.toFixed(2).replace('.', ','),
      b.situacao === 'pago' ? 'Pago' : b.situacao === 'vencido' ? 'Vencido' : 'Em Aberto',
      `Parcela ${b.parcela} | ${b.linhaDigitavel}`
    ]);

    const allRows = [...rowsLancamentos, ...rowsBoletos];
    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCSV(`extrato_financeiro_consolidado_${dateStr}.csv`, headers, allRows);
    showToast('Extrato Consolidado Exportado', 'success', `${allRows.length} registros exportados com sucesso.`);
    setIsExportMenuOpen(false);
  };

  // New Lancamento Form
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Venda de sistema');
  const [obraRef, setObraRef] = useState('OBRA 0184');
  const [valorLancamento, setValorLancamento] = useState('');
  const [tipoLancamento, setTipoLancamento] = useState<'receita' | 'despesa'>('receita');

  // New Boleto Form
  const [boletoCliente, setBoletoCliente] = useState('Cristiano Duarte Almeida');
  const [boletoCpf, setBoletoCpf] = useState('042.318.776-90');
  const [boletoValor, setBoletoValor] = useState(2249.00);
  const [boletoParcela, setBoletoParcela] = useState('1/60 (Entrada)');
  const [boletoVencimento, setBoletoVencimento] = useState('10/08/2026');
  const [boletoTipo, setBoletoTipo] = useState<'A receber' | 'A pagar'>('A receber');
  const [boletoCategoria, setBoletoCategoria] = useState('Venda de sistema');
  const [boletoObraRef, setBoletoObraRef] = useState('OBRA 0184');

  // Monthly 12-Month Chart data (values in thousands R$)
  const monthlyStats = [
    { month: 'ago', rev: 85, exp: 35 },
    { month: 'set', rev: 92, exp: 40 },
    { month: 'out', rev: 110, exp: 45 },
    { month: 'nov', rev: 125, exp: 50 },
    { month: 'dez', rev: 140, exp: 55 },
    { month: 'jan', rev: 95, exp: 42 },
    { month: 'fev', rev: 115, exp: 48 },
    { month: 'mar', rev: 130, exp: 52 },
    { month: 'abr', rev: 145, exp: 58 },
    { month: 'mai', rev: 150, exp: 60 },
    { month: 'jun', rev: 142, exp: 56 },
    { month: 'jul', rev: 186.4, exp: 74.1, isCurrent: true }
  ];

  const handleCopyLinhaDigitavel = (linha: string) => {
    navigator.clipboard.writeText(linha);
    showToast('Linha digitável copiada', 'success', 'Código de barras copiado para a área de transferência.');
  };

  const handleDarBaixa = (bol: Boleto) => {
    const updated = {
      ...bol,
      situacao: 'pago' as const,
      dataPagamento: new Date().toLocaleDateString('pt-BR')
    };
    onSaveBoleto(updated);
    showToast('Boleto quitado', 'success', `Pagamento de R$ ${bol.valor.toLocaleString('pt-BR')} confirmado.`);
  };

  const handleFormLancamentoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valorLancamento) return;

    const val = Number(valorLancamento);
    onAddLancamento({
      id: `f-${Date.now()}`,
      data: new Date().toLocaleDateString('pt-BR').slice(0, 5),
      descricao,
      categoria,
      obraRef: obraRef || '–',
      valor: tipoLancamento === 'receita' ? Math.abs(val) : -Math.abs(val),
      tipo: tipoLancamento
    });

    setIsNovoLancamentoOpen(false);
    setDescricao('');
    setValorLancamento('');
    showToast('Lançamento registrado', 'success', `${tipoLancamento === 'receita' ? 'Entrada' : 'Saída'} adicionada com sucesso.`);
  };

  const handleFormEmitirBoletoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boletoCliente || !boletoValor) return;

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const newBoleto: Boleto = {
      id: `bol-${Date.now()}`,
      numeroDocumento: `00190.00009 01234.567894 12345.${randomSuffix} 1 95000002249000`,
      linhaDigitavel: `00190.00009 01234.567894 12345.${randomSuffix} 1 95000002249000`,
      clienteNome: boletoCliente,
      cpfCnpj: boletoCpf,
      valor: Number(boletoValor),
      parcela: boletoParcela,
      vencimento: boletoVencimento,
      situacao: 'em_aberto',
      tipo: boletoTipo,
      categoria: boletoCategoria,
      obraRef: boletoObraRef
    };

    onSaveBoleto(newBoleto);
    setIsEmitirBoletoOpen(false);
    showToast('Boleto emitido', 'success', `Boleto Banco do Brasil gerado para ${boletoCliente}.`);
  };

  const filteredLancamentos = lancamentos.filter(l => {
    if (filterLancamentos === 'receita') return l.tipo === 'receita';
    if (filterLancamentos === 'despesa') return l.tipo === 'despesa';
    return true;
  });

  const filteredBoletos = boletos.filter(b => {
    if (filterBoletos === 'A receber') return b.tipo === 'A receber';
    if (filterBoletos === 'A pagar') return b.tipo === 'A pagar';
    if (filterBoletos === 'em_aberto') return b.situacao === 'em_aberto';
    if (filterBoletos === 'pago') return b.situacao === 'pago';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Financeiro</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Competência julho de 2026 · último fechamento em 30/06/2026
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select className="bg-white border border-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl focus:outline-none">
            <option value="julho">Julho / 2026</option>
            <option value="junho">Junho / 2026</option>
            <option value="maio">Maio / 2026</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel / CSV</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 space-y-1 text-xs font-semibold text-slate-700">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Opções de Exportação Contábil
                </div>
                <button
                  onClick={handleExportConsolidado}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-900"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Extrato Consolidado Completo</p>
                    <p className="text-[10px] text-slate-400 font-normal">Lançamentos + Boletos e Títulos</p>
                  </div>
                </button>
                <button
                  onClick={handleExportLancamentos}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-900"
                >
                  <Download className="w-4 h-4 text-[#004276] shrink-0" />
                  <div>
                    <p className="font-bold">Apenas Lançamentos de Caixa</p>
                    <p className="text-[10px] text-slate-400 font-normal">Receitas e despesas do período</p>
                  </div>
                </button>
                <button
                  onClick={handleExportBoletos}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-900"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">Contas a Receber e A Pagar</p>
                    <p className="text-[10px] text-slate-400 font-normal">Boletos Banco do Brasil e baixas</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsNovoLancamentoOpen(true)}
            className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Novo lançamento</span>
          </button>
        </div>
      </div>

      {/* Top KPIs Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Entradas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ENTRADAS DO MÊS
          </span>
          <h2 className="text-2xl font-black text-emerald-600">
            R$ 186.420,00
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            12 lançamentos · <span className="text-emerald-600 font-bold">+12,4%</span> vs junho
          </p>
        </div>

        {/* Card 2: Saídas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            SAÍDAS DO MÊS
          </span>
          <h2 className="text-2xl font-black text-rose-600">
            R$ 74.185,30
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            19 lançamentos · <span className="text-rose-600 font-bold">+4,1%</span> vs junho
          </p>
        </div>

        {/* Card 3: Saldo Dark Blue Box */}
        <div className="bg-[#004276] text-white p-5 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
            SALDO DO MÊS
          </span>
          <h2 className="text-2xl font-black text-white">
            R$ 112.234,70
          </h2>
          <p className="text-[11px] text-blue-200 font-medium">
            margem de 60,2% sobre as entradas
          </p>
        </div>

        {/* Card 4: A receber em atraso */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
            A RECEBER EM ATRASO
          </span>
          <h2 className="text-2xl font-black text-rose-700">
            R$ 8.220,00
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            1 título · Auto Peças Ribeiro
          </p>
        </div>
      </div>

      {/* 12-Month Bar Chart Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Evolução mensal · últimos 12 meses</h3>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-slate-600">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400" />
              <span className="text-slate-600">Despesas</span>
            </div>
            <span className="text-slate-400 font-normal">valores em R$ mil</span>
          </div>
        </div>

        {/* Bar Chart Container */}
        <div className="h-44 pt-6 flex items-end justify-between gap-2 border-b border-slate-200 px-2">
          {monthlyStats.map((st) => {
            const maxVal = 200;
            const revHeight = (st.rev / maxVal) * 100;
            const expHeight = (st.exp / maxVal) * 100;

            return (
              <div key={st.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Hover Tooltip */}
                <div className="absolute -top-10 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] p-1.5 rounded shadow z-20 whitespace-nowrap">
                  <span>Rec: R$ {st.rev}k</span>
                  <span>Desp: R$ {st.exp}k</span>
                </div>

                <div className="flex items-end gap-1 w-full justify-center h-32">
                  <div
                    style={{ height: `${revHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-600"
                  />
                  <div
                    style={{ height: `${expHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-rose-400 rounded-t transition-all group-hover:bg-rose-500"
                  />
                </div>
                <span className={`text-[11px] font-bold ${st.isCurrent ? 'text-[#004276] text-xs' : 'text-slate-500'}`}>
                  {st.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Lançamentos (2/3) & Despesas por Categoria (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lançamentos de julho (2/3) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Lançamentos de julho</h3>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLancamentos}
                title="Exportar lançamentos de caixa em CSV"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterLancamentos('todos')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterLancamentos === 'todos' ? 'bg-[#004276] text-white' : 'text-slate-600'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterLancamentos('receita')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterLancamentos === 'receita' ? 'bg-[#004276] text-white' : 'text-slate-600'
                  }`}
                >
                  Receitas
                </button>
                <button
                  onClick={() => setFilterLancamentos('despesa')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterLancamentos === 'despesa' ? 'bg-[#004276] text-white' : 'text-slate-600'
                  }`}
                >
                  Despesas
                </button>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                  <th className="p-3">DATA</th>
                  <th className="p-3">DESCRIÇÃO</th>
                  <th className="p-3">CATEGORIA</th>
                  <th className="p-3">OBRA</th>
                  <th className="p-3 text-right">VALOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLancamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 font-mono">{item.data}</td>
                    <td className="p-3 font-semibold text-slate-900">{item.descricao}</td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">{item.obraRef}</td>
                    <td className={`p-3 text-right font-bold ${
                      item.valor > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {item.valor > 0 ? '+' : ''} R$ {Math.abs(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Despesas por categoria (1/3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Despesas por categoria</h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Equipamentos</span>
                <span className="font-bold text-slate-900">R$ 38.460,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#004276] rounded-full" style={{ width: '52%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Mão de obra</span>
                <span className="font-bold text-slate-900">R$ 14.800,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#004276] rounded-full" style={{ width: '20%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Impostos</span>
                <span className="font-bold text-slate-900">R$ 8.360,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#004276] rounded-full" style={{ width: '11%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Logística</span>
                <span className="font-bold text-slate-900">R$ 4.920,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#004276] rounded-full" style={{ width: '7%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Administrativo</span>
                <span className="font-bold text-slate-900">R$ 4.445,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#004276] rounded-full" style={{ width: '6%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Marketing</span>
                <span className="font-bold text-slate-900">R$ 3.200,00</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: '4%' }} />
              </div>
            </div>

            <div className="pt-4 border-t flex justify-between items-center text-sm font-bold">
              <span className="text-slate-600">Total de despesas</span>
              <span className="text-rose-600 text-base">R$ 74.185,30</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Contas a pagar e a receber (Boletos Banco do Brasil) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Contas a pagar e a receber (Boletos Banco do Brasil)</h3>
            <p className="text-xs text-slate-500">3 títulos vencem nos próximos 15 dias</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportBoletos}
              title="Exportar boletos e contas em CSV"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar CSV</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setFilterBoletos('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'todos' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterBoletos('A receber')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'A receber' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                A receber
              </button>
              <button
                onClick={() => setFilterBoletos('A pagar')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'A pagar' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                A pagar
              </button>
            </div>

            <button
              onClick={() => setIsEmitirBoletoOpen(true)}
              className="bg-[#004276] hover:bg-[#003159] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow"
            >
              + Emitir boleto BB
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">VENCIMENTO</th>
                <th className="p-3">DESCRIÇÃO / CLIENTE</th>
                <th className="p-3">TIPO</th>
                <th className="p-3">CATEGORIA</th>
                <th className="p-3 text-right">VALOR</th>
                <th className="p-3">SITUAÇÃO</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBoletos.map((bol) => (
                <tr key={bol.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-semibold text-slate-800">{bol.vencimento}</td>
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{bol.clienteNome}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Parcela {bol.parcela} ({bol.obraRef || 'Geral'})</p>
                  </td>
                  <td className="p-3 font-semibold">
                    <span className={bol.tipo === 'A receber' ? 'text-emerald-600' : 'text-rose-600'}>
                      {bol.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{bol.categoria}</td>
                  <td className="p-3 text-right font-bold text-slate-900">
                    R$ {bol.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      bol.situacao === 'pago'
                        ? 'bg-emerald-100 text-emerald-800'
                        : bol.situacao === 'vencido'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {bol.situacao === 'pago' ? 'Pago' : bol.situacao === 'vencido' ? 'Vencido' : 'Em aberto'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2 font-bold">
                    <button
                      onClick={() => handleCopyLinhaDigitavel(bol.linhaDigitavel)}
                      title="Copiar Linha Digitável"
                      className="text-slate-600 hover:text-[#004276]"
                    >
                      Copiar código
                    </button>
                    {bol.situacao !== 'pago' && (
                      <button
                        onClick={() => handleDarBaixa(bol)}
                        className="text-emerald-600 hover:underline"
                      >
                        Dar baixa
                      </button>
                    )}
                    <button
                      onClick={() => onOpenPDF('boleto', bol)}
                      className="text-blue-600 hover:underline"
                    >
                      Imprimir Boleto
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Lançamento */}
      {isNovoLancamentoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Novo Lançamento Financeiro</h3>
              <button onClick={() => setIsNovoLancamentoOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormLancamentoSubmit} className="p-5 space-y-4 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoLancamento('receita')}
                  className={`flex-1 py-2 font-bold rounded-xl border ${
                    tipoLancamento === 'receita' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50'
                  }`}
                >
                  Receita / Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setTipoLancamento('despesa')}
                  className={`flex-1 py-2 font-bold rounded-xl border ${
                    tipoLancamento === 'despesa' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50'
                  }`}
                >
                  Despesa / Saída
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1 uppercase">Descrição</label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Pagamento fornecedor Aldo Solar"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    <option value="Venda de sistema">Venda de sistema</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Mão de obra">Mão de obra</option>
                    <option value="Logística">Logística</option>
                    <option value="Impostos">Impostos</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valorLancamento}
                    onChange={(e) => setValorLancamento(e.target.value)}
                    placeholder="0,00"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNovoLancamentoOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Emitir Boleto Banco do Brasil */}
      {isEmitirBoletoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Emitir Boleto Banco do Brasil</h3>
              <button onClick={() => setIsEmitirBoletoOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormEmitirBoletoSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Cliente / Sacado</label>
                  <input
                    type="text"
                    required
                    value={boletoCliente}
                    onChange={(e) => setBoletoCliente(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={boletoCpf}
                    onChange={(e) => setBoletoCpf(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={boletoValor}
                    onChange={(e) => setBoletoValor(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Parcela</label>
                  <input
                    type="text"
                    value={boletoParcela}
                    onChange={(e) => setBoletoParcela(e.target.value)}
                    placeholder="1/60"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Vencimento</label>
                  <input
                    type="text"
                    value={boletoVencimento}
                    onChange={(e) => setBoletoVencimento(e.target.value)}
                    placeholder="10/08/2026"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmitirBoletoOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
                >
                  Gerar Boleto Banco do Brasil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
