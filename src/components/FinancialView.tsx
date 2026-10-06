import React, { useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Calendar, Download, Plus, Copy, CheckCircle2, Printer, Trash2, X, FileSpreadsheet, ChevronDown,
  LayoutGrid, Landmark, Receipt
} from 'lucide-react';
import { Boleto, Contrato, LancamentoFinanceiro, User } from '../types';
import { maskCPFCNPJ, docLabel } from '../utils/format';

interface FinancialViewProps {
  boletos: Boleto[];
  lancamentos: LancamentoFinanceiro[];
  contratos: Contrato[];
  onSaveBoleto: (boleto: Boleto) => void;
  onDeleteBoleto: (id: string) => void;
  onAddLancamento: (l: LancamentoFinanceiro) => void;
  onEmitirBoletoBB: (boleto: Boleto, aceitarPix: boolean) => Promise<Boleto | null>;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

type FinanceiroTab = 'visao_geral' | 'boletos' | 'cobrancas';

const ABAS_FINANCEIRO: { key: FinanceiroTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'visao_geral', label: 'Visão Geral', Icon: LayoutGrid },
  { key: 'boletos', label: 'Boletos', Icon: Landmark },
  { key: 'cobrancas', label: 'Cobranças', Icon: Receipt },
];

/**
 * Resultado da emissão pela API do BB (linha digitável + Pix, se pedido).
 * Compartilhado entre o modal de boleto avulso e o de cobrança a partir de
 * contrato — é a mesma cópia exata em dois lugares, não abstração especulativa.
 */
const ResultadoEmissaoBB: React.FC<{
  boleto: Boleto;
  onCopyLinha: (linha: string) => void;
  onCopyPix: (codigo: string) => void;
  onConcluir: () => void;
}> = ({ boleto, onCopyLinha, onCopyPix, onConcluir }) => (
  <div className="modal-corpo p-5 space-y-4 text-xs">
    <div className="flex items-center gap-2 text-emerald-700 font-bold">
      <CheckCircle2 className="w-5 h-5" />
      Boleto emitido no Banco do Brasil
    </div>

    <div>
      <label className="block font-bold text-slate-600 mb-1 uppercase">Linha digitável</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={boleto.linhaDigitavel}
          className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono"
        />
        <button
          type="button"
          onClick={() => onCopyLinha(boleto.linhaDigitavel)}
          className="px-3 bg-slate-100 hover:bg-slate-200 rounded-xl"
          title="Copiar linha digitável"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>

    {boleto.pixQrcode && (
      <div>
        <label className="block font-bold text-slate-600 mb-1 uppercase">Pix copia e cola</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={boleto.pixQrcode}
            className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono truncate"
          />
          <button
            type="button"
            onClick={() => onCopyPix(boleto.pixQrcode!)}
            className="px-3 bg-slate-100 hover:bg-slate-200 rounded-xl"
            title="Copiar código Pix"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}

    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={onConcluir}
        className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
      >
        Concluir
      </button>
    </div>
  </div>
);

export const FinancialView: React.FC<FinancialViewProps> = ({
  boletos,
  lancamentos,
  contratos,
  onSaveBoleto,
  onDeleteBoleto,
  onAddLancamento,
  onEmitirBoletoBB,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  const [tab, setTab] = useState<FinanceiroTab>('visao_geral');
  const [filterLancamentos, setFilterLancamentos] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [filterBoletos, setFilterBoletos] = useState<'todos' | 'A receber' | 'A pagar' | 'em_aberto' | 'pago'>('todos');

  // Modals and Menus state
  const [isNovoLancamentoOpen, setIsNovoLancamentoOpen] = useState(false);
  const [isEmitirBoletoOpen, setIsEmitirBoletoOpen] = useState(false);
  const [isEmitirCobrancaOpen, setIsEmitirCobrancaOpen] = useState(false);
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
  const [obraRef, setObraRef] = useState('');
  const [valorLancamento, setValorLancamento] = useState('');
  const [tipoLancamento, setTipoLancamento] = useState<'receita' | 'despesa'>('receita');

  // New Boleto Form
  const [boletoCliente, setBoletoCliente] = useState('');
  const [boletoCpf, setBoletoCpf] = useState('');
  const [boletoValor, setBoletoValor] = useState(0);
  const [boletoParcela, setBoletoParcela] = useState('');
  const [boletoVencimento, setBoletoVencimento] = useState('');
  const [boletoTipo, setBoletoTipo] = useState<'A receber' | 'A pagar'>('A receber');
  const [boletoCategoria, setBoletoCategoria] = useState('Venda de sistema');
  const [boletoObraRef, setBoletoObraRef] = useState('');
  const [boletoAceitarPix, setBoletoAceitarPix] = useState(true);
  const [emitindoBoleto, setEmitindoBoleto] = useState(false);
  // Preenchido só depois da API do BB responder — é o que a tela mostra em
  // vez de fechar o modal na hora, porque é aqui que aparecem linha
  // digitável e Pix que o vendedor precisa copiar para o cliente.
  const [boletoEmitido, setBoletoEmitido] = useState<Boleto | null>(null);

  // Emitir Cobrança (a partir de um contrato assinado)
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState('');
  const [cobrancaValor, setCobrancaValor] = useState(0);
  const [cobrancaParcela, setCobrancaParcela] = useState('');
  const [cobrancaVencimento, setCobrancaVencimento] = useState('');
  const [cobrancaFormaPagamento, setCobrancaFormaPagamento] = useState<'boleto' | 'bolepix'>('bolepix');
  const [emitindoCobranca, setEmitindoCobranca] = useState(false);
  const [cobrancaEmitida, setCobrancaEmitida] = useState<Boleto | null>(null);

  // Índice do mês (1-12) a partir de "DD/MM" ou "DD/MM/AAAA".
  const monthFromStr = (value?: string): number => {
    if (!value) return 0;
    const parts = value.split('/');
    return parts.length >= 2 ? parseInt(parts[1], 10) : 0;
  };

  // ---- Indicadores calculados a partir dos dados ----
  const entradasMes = lancamentos.filter(l => l.tipo === 'receita').reduce((a, l) => a + (l.valor || 0), 0);
  const saidasMes = lancamentos.filter(l => l.tipo === 'despesa').reduce((a, l) => a + Math.abs(l.valor || 0), 0);
  const saldoMes = entradasMes - saidasMes;
  const margemPct = entradasMes > 0 ? (saldoMes / entradasMes) * 100 : 0;
  const qtdEntradas = lancamentos.filter(l => l.tipo === 'receita').length;
  const qtdSaidas = lancamentos.filter(l => l.tipo === 'despesa').length;

  const boletosAtraso = boletos.filter(b => b.tipo === 'A receber' && b.situacao === 'vencido');
  const totalAtraso = boletosAtraso.reduce((a, b) => a + (b.valor || 0), 0);

  // Vencem nos próximos 15 dias (título "Boletos", hoje até hoje+15).
  const paraData = (br: string): Date | null => {
    const [d, m, a] = (br || '').split('/').map(Number);
    return d && m && a ? new Date(a, m - 1, d) : null;
  };
  const boletosProximos15Dias = boletos.filter((b) => {
    if (b.situacao === 'pago') return false;
    const venc = paraData(b.vencimento);
    if (!venc) return false;
    const dias = (venc.getTime() - Date.now()) / 86_400_000;
    return dias >= 0 && dias <= 15;
  });

  // Cobranças (aba "Cobranças"): contratos já assinados, e boletos emitidos a partir de um contrato.
  const contratosAssinados = contratos.filter((c) => c.status === 'assinado');
  const cobrancasEmitidas = boletos.filter((b) => !!b.contratoId);
  const contratoSelecionado = contratos.find((c) => c.id === contratoSelecionadoId) || null;

  // Evolução mensal (R$ mil): realizado (lançamentos) + contas a vencer (boletos em aberto).
  const monthlyStats = (() => {
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const s = nomes.map(m => ({ month: m, rev: 0, exp: 0, isCurrent: m === 'jul' }));
    lancamentos.forEach(l => {
      const mm = monthFromStr(l.data);
      if (mm < 1 || mm > 12) return;
      if (l.tipo === 'receita') s[mm - 1].rev += (l.valor || 0) / 1000;
      else s[mm - 1].exp += Math.abs(l.valor || 0) / 1000;
    });
    boletos.forEach(b => {
      if (b.situacao === 'pago') return; // já refletido no caixa via lançamento
      const mm = monthFromStr(b.vencimento);
      if (mm < 1 || mm > 12) return;
      if (b.tipo === 'A receber') s[mm - 1].rev += (b.valor || 0) / 1000;
      else s[mm - 1].exp += (b.valor || 0) / 1000;
    });
    return s.slice(4, 9); // mai → set: realizado + próximo horizonte de vencimentos
  })();
  const maxMensal = Math.max(1, ...monthlyStats.map(s => Math.max(s.rev, s.exp)));

  // Despesas por categoria (calculado dos lançamentos de saída).
  const despesasPorCategoria = (() => {
    const map: Record<string, number> = {};
    lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
      const cat = l.categoria || 'Outros';
      map[cat] = (map[cat] || 0) + Math.abs(l.valor || 0);
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .map(([categoria, valor]) => ({ categoria, valor, pct: (valor / total) * 100 }))
      .sort((a, b) => b.valor - a.valor);
  })();
  const totalDespesas = despesasPorCategoria.reduce((a, c) => a + c.valor, 0);

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

  const handleFormEmitirBoletoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boletoCliente || !boletoValor || emitindoBoleto) return;

    const novoBoleto: Boleto = {
      id: '',
      numeroDocumento: '',
      linhaDigitavel: '',
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

    setEmitindoBoleto(true);
    const emitido = await onEmitirBoletoBB(novoBoleto, boletoAceitarPix);
    setEmitindoBoleto(false);

    // Em erro, o toast já saiu de onEmitirBoletoBB — o modal fica aberto para
    // o vendedor corrigir e tentar de novo, em vez de fechar sobre uma falha.
    if (emitido) setBoletoEmitido(emitido);
  };

  const handleFecharModalEmitirBoleto = () => {
    setIsEmitirBoletoOpen(false);
    setBoletoEmitido(null);
    setBoletoCliente('');
    setBoletoCpf('');
    setBoletoValor(0);
    setBoletoParcela('');
    setBoletoVencimento('');
    setBoletoObraRef('');
    setBoletoAceitarPix(true);
  };

  const handleCopyPix = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    showToast('Código Pix copiado', 'success', 'Copia e cola copiado para a área de transferência.');
  };

  const handleSelecionarContrato = (id: string) => {
    setContratoSelecionadoId(id);
    const c = contratos.find((x) => x.id === id);
    if (c) setCobrancaValor(c.valorTotal);
  };

  const handleAbrirCobrancaParaContrato = (c: Contrato) => {
    setContratoSelecionadoId(c.id);
    setCobrancaValor(c.valorTotal);
    setIsEmitirCobrancaOpen(true);
  };

  const handleFormEmitirCobrancaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoSelecionado || !cobrancaValor || !cobrancaVencimento || emitindoCobranca) return;

    const novaCobranca: Boleto = {
      id: '',
      numeroDocumento: '',
      linhaDigitavel: '',
      clienteNome: contratoSelecionado.clienteNome,
      cpfCnpj: contratoSelecionado.cpfCnpj,
      valor: Number(cobrancaValor),
      parcela: cobrancaParcela,
      vencimento: cobrancaVencimento,
      situacao: 'em_aberto',
      tipo: 'A receber',
      categoria: 'Venda de sistema',
      contratoId: contratoSelecionado.id,
    };

    setEmitindoCobranca(true);
    const emitido = await onEmitirBoletoBB(novaCobranca, cobrancaFormaPagamento === 'bolepix');
    setEmitindoCobranca(false);

    if (emitido) setCobrancaEmitida(emitido);
  };

  const handleFecharModalCobranca = () => {
    setIsEmitirCobrancaOpen(false);
    setCobrancaEmitida(null);
    setContratoSelecionadoId('');
    setCobrancaValor(0);
    setCobrancaParcela('');
    setCobrancaVencimento('');
    setCobrancaFormaPagamento('bolepix');
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

      {/* Abas */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {ABAS_FINANCEIRO.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === key ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'visao_geral' && (
      <>
      {/* Top KPIs Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Entradas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ENTRADAS DO MÊS
          </span>
          <h2 className="text-2xl font-black text-emerald-600">
            R$ {entradasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {qtdEntradas} {qtdEntradas === 1 ? 'lançamento de entrada' : 'lançamentos de entrada'}
          </p>
        </div>

        {/* Card 2: Saídas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            SAÍDAS DO MÊS
          </span>
          <h2 className="text-2xl font-black text-rose-600">
            R$ {saidasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {qtdSaidas} {qtdSaidas === 1 ? 'lançamento de saída' : 'lançamentos de saída'}
          </p>
        </div>

        {/* Card 3: Saldo Dark Blue Box */}
        <div className="bg-[#004276] text-white p-5 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
            SALDO DO MÊS
          </span>
          <h2 className="text-2xl font-black text-white">
            R$ {saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-[11px] text-blue-200 font-medium">
            margem de {margemPct.toFixed(1)}% sobre as entradas
          </p>
        </div>

        {/* Card 4: A receber em atraso */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
            A RECEBER EM ATRASO
          </span>
          <h2 className="text-2xl font-black text-rose-700">
            R$ {totalAtraso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {boletosAtraso.length} {boletosAtraso.length === 1 ? 'título' : 'títulos'}
            {boletosAtraso.length > 0 ? ` · ${boletosAtraso[0].clienteNome}` : ''}
          </p>
        </div>
      </div>

      {/* 12-Month Bar Chart Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <h3 className="font-bold text-slate-900 text-sm">Evolução mensal · realizado e a vencer</h3>
          <div className="flex flex-wrap items-center gap-4 gap-y-1 text-xs font-semibold">
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
            const maxVal = maxMensal;
            const revHeight = (st.rev / maxVal) * 100;
            const expHeight = (st.exp / maxVal) * 100;

            return (
              <div key={st.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Hover Tooltip */}
                <div className="absolute -top-10 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] p-1.5 rounded shadow z-20 whitespace-nowrap">
                  <span>Rec: R$ {st.rev.toFixed(1)}k</span>
                  <span>Desp: R$ {st.exp.toFixed(1)}k</span>
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
          <div className="flex flex-wrap items-center justify-between gap-y-3">
            <h3 className="font-bold text-slate-900 text-base">Lançamentos de julho</h3>

            <div className="flex flex-wrap items-center gap-2 gap-y-2">
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
            <table className="tabela-mobile w-full text-left text-xs">
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
                    <td data-label="DATA" className="p-3 text-slate-500 font-mono">{item.data}</td>
                    <td data-label="DESCRIÇÃO" className="p-3 font-semibold text-slate-900">{item.descricao}</td>
                    <td data-label="CATEGORIA" className="p-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {item.categoria}
                      </span>
                    </td>
                    <td data-label="OBRA" className="p-3 font-mono text-slate-500">{item.obraRef}</td>
                    <td data-label="VALOR" className={`p-3 text-right font-bold ${
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
            {despesasPorCategoria.length === 0 && (
              <p className="text-slate-400 italic py-4 text-center">Nenhuma despesa lançada no período.</p>
            )}
            {despesasPorCategoria.map((c, i) => (
              <div key={c.categoria}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-700">{c.categoria}</span>
                  <span className="font-bold text-slate-900">R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${i === 0 ? 'bg-[#004276]' : i === despesasPorCategoria.length - 1 ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(2, c.pct)}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t flex justify-between items-center text-sm font-bold">
              <span className="text-slate-600">Total de despesas</span>
              <span className="text-rose-600 text-base">R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {tab === 'boletos' && (
      <>
      {/* BOTTOM SECTION: Contas a pagar e a receber (Boletos Banco do Brasil) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Contas a pagar e a receber (Boletos Banco do Brasil)</h3>
            <p className="text-xs text-slate-500">
              {boletosProximos15Dias.length === 0
                ? 'Nenhum título vence nos próximos 15 dias'
                : `${boletosProximos15Dias.length} ${boletosProximos15Dias.length === 1 ? 'título vence' : 'títulos vencem'} nos próximos 15 dias`}
            </p>
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

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
              <button
                onClick={() => setFilterBoletos('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'todos' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterBoletos('em_aberto')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'em_aberto' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                Em aberto
              </button>
              <button
                onClick={() => setFilterBoletos('pago')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterBoletos === 'pago' ? 'bg-[#004276] text-white' : 'text-slate-600'
                }`}
              >
                Pago
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
          <table className="tabela-mobile w-full text-left text-xs">
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
                  <td data-label="VENCIMENTO" className="p-3 font-mono font-semibold text-slate-800">{bol.vencimento}</td>
                  <td data-label="DESCRIÇÃO / CLIENTE" className="p-3">
                    <p className="font-bold text-slate-900">{bol.clienteNome}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Parcela {bol.parcela} ({bol.obraRef || 'Geral'})</p>
                  </td>
                  <td data-label="TIPO" className="p-3 font-semibold">
                    <span className={bol.tipo === 'A receber' ? 'text-emerald-600' : 'text-rose-600'}>
                      {bol.tipo}
                    </span>
                  </td>
                  <td data-label="CATEGORIA" className="p-3 text-slate-600">{bol.categoria}</td>
                  <td data-label="VALOR" className="p-3 text-right font-bold text-slate-900">
                    R$ {bol.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td data-label="SITUAÇÃO" className="p-3">
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
                  <td data-label="AÇÕES" className="p-3 text-right space-x-2 font-bold">
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
      </>
      )}

      {tab === 'cobrancas' && (
      <>
      {/* Contratos assinados — ponto de partida para emitir uma cobrança */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Contratos assinados</h3>
            <p className="text-xs text-slate-500">Emita uma cobrança (boleto ou boleto + Pix) a partir de um contrato já assinado.</p>
          </div>
          <button
            onClick={() => { setContratoSelecionadoId(''); setIsEmitirCobrancaOpen(true); }}
            className="bg-[#004276] hover:bg-[#003159] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow"
          >
            + Nova cobrança
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">Contrato</th>
                <th className="p-3">Cliente</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Pagamento</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contratosAssinados.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                    Nenhum contrato assinado ainda.
                  </td>
                </tr>
              )}
              {contratosAssinados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td data-label="Contrato" className="p-3 font-bold text-[#004276]">Nº {c.numero}</td>
                  <td data-label="Cliente" className="p-3 font-semibold text-slate-900">{c.clienteNome}</td>
                  <td data-label="Valor" className="p-3 text-right font-bold text-slate-900">
                    R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td data-label="Pagamento" className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      c.situacaoPagamento === 'pago'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.situacaoPagamento === 'vencido'
                        ? 'bg-red-100 text-red-800'
                        : c.situacaoPagamento === 'aguardando'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.situacaoPagamento === 'pago'
                        ? 'Pago'
                        : c.situacaoPagamento === 'vencido'
                        ? 'Pagamento vencido'
                        : c.situacaoPagamento === 'aguardando'
                        ? 'Aguardando pagamento'
                        : 'Sem cobrança'}
                    </span>
                  </td>
                  <td data-label="Ações" className="p-3 text-right">
                    <button
                      onClick={() => handleAbrirCobrancaParaContrato(c)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Emitir cobrança
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cobranças já emitidas (boletos vinculados a um contrato) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Cobranças emitidas</h3>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">Vencimento</th>
                <th className="p-3">Contrato</th>
                <th className="p-3">Cliente</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cobrancasEmitidas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                    Nenhuma cobrança emitida ainda.
                  </td>
                </tr>
              )}
              {cobrancasEmitidas.map((bol) => {
                const contrato = contratos.find((c) => c.id === bol.contratoId);
                return (
                  <tr key={bol.id} className="hover:bg-slate-50">
                    <td data-label="Vencimento" className="p-3 font-mono font-semibold text-slate-800">{bol.vencimento}</td>
                    <td data-label="Contrato" className="p-3 font-bold text-[#004276]">
                      {contrato ? `Nº ${contrato.numero}` : '—'}
                    </td>
                    <td data-label="Cliente" className="p-3 font-semibold text-slate-900">{bol.clienteNome}</td>
                    <td data-label="Valor" className="p-3 text-right font-bold text-slate-900">
                      R$ {bol.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td data-label="Situação" className="p-3">
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
                    <td data-label="Ações" className="p-3 text-right space-x-2 font-bold">
                      <button
                        onClick={() => handleCopyLinhaDigitavel(bol.linhaDigitavel)}
                        className="text-slate-600 hover:text-[#004276]"
                      >
                        Copiar código
                      </button>
                      {bol.situacao !== 'pago' && (
                        <button onClick={() => handleDarBaixa(bol)} className="text-emerald-600 hover:underline">
                          Dar baixa
                        </button>
                      )}
                      <button onClick={() => onOpenPDF('boleto', bol)} className="text-blue-600 hover:underline">
                        Baixar PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Modal Novo Lançamento */}
      {isNovoLancamentoOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Novo Lançamento Financeiro</h3>
              <button onClick={() => setIsNovoLancamentoOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormLancamentoSubmit} className="modal-corpo p-5 space-y-4 text-xs">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Emitir Boleto Banco do Brasil</h3>
              <button onClick={handleFecharModalEmitirBoleto} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {boletoEmitido ? (
              <ResultadoEmissaoBB
                boleto={boletoEmitido}
                onCopyLinha={handleCopyLinhaDigitavel}
                onCopyPix={handleCopyPix}
                onConcluir={handleFecharModalEmitirBoleto}
              />
            ) : (
              <form onSubmit={handleFormEmitirBoletoSubmit} className="modal-corpo p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-1 sm:col-span-2">
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
                    <label className="block font-bold text-slate-600 mb-1 uppercase">{docLabel(boletoCpf)}</label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      value={boletoCpf}
                      onChange={(e) => setBoletoCpf(maskCPFCNPJ(e.target.value))}
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
                      required
                      value={boletoVencimento}
                      onChange={(e) => setBoletoVencimento(e.target.value)}
                      placeholder="10/08/2026"
                      className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="boleto-aceitar-pix"
                      checked={boletoAceitarPix}
                      onChange={(e) => setBoletoAceitarPix(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="boleto-aceitar-pix" className="font-semibold text-slate-600">
                      Aceitar pagamento via Pix (bolepix)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleFecharModalEmitirBoleto}
                    disabled={emitindoBoleto}
                    className="px-4 py-2 border rounded-xl font-bold disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={emitindoBoleto}
                    className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow disabled:opacity-50"
                  >
                    {emitindoBoleto ? 'Emitindo...' : 'Gerar Boleto Banco do Brasil'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Emitir Cobrança (a partir de um contrato assinado) */}
      {isEmitirCobrancaOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Emitir Cobrança</h3>
              <button onClick={handleFecharModalCobranca} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {cobrancaEmitida ? (
              <ResultadoEmissaoBB
                boleto={cobrancaEmitida}
                onCopyLinha={handleCopyLinhaDigitavel}
                onCopyPix={handleCopyPix}
                onConcluir={handleFecharModalCobranca}
              />
            ) : (
              <form onSubmit={handleFormEmitirCobrancaSubmit} className="modal-corpo p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Contrato</label>
                  <select
                    required
                    value={contratoSelecionadoId}
                    onChange={(e) => handleSelecionarContrato(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    <option value="" disabled>Selecione um contrato assinado</option>
                    {contratosAssinados.map((c) => (
                      <option key={c.id} value={c.id}>
                        Nº {c.numero} — {c.clienteNome} — R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </div>

                {contratoSelecionado && (
                  <p className="text-slate-500 bg-slate-50 border rounded-xl p-2.5">
                    <strong className="text-slate-800">{contratoSelecionado.clienteNome}</strong>
                    {contratoSelecionado.cpfCnpj && ` — ${docLabel(contratoSelecionado.cpfCnpj)}: ${contratoSelecionado.cpfCnpj}`}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1 uppercase">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cobrancaValor}
                      onChange={(e) => setCobrancaValor(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1 uppercase">Parcela</label>
                    <input
                      type="text"
                      value={cobrancaParcela}
                      onChange={(e) => setCobrancaParcela(e.target.value)}
                      placeholder="1/60"
                      className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block font-bold text-slate-600 mb-1 uppercase">Vencimento</label>
                    <input
                      type="text"
                      required
                      value={cobrancaVencimento}
                      onChange={(e) => setCobrancaVencimento(e.target.value)}
                      placeholder="10/08/2026"
                      className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Forma de pagamento</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCobrancaFormaPagamento('boleto')}
                      className={`flex-1 py-2 font-bold rounded-xl border ${
                        cobrancaFormaPagamento === 'boleto' ? 'bg-[#004276] text-white border-[#004276]' : 'bg-slate-50'
                      }`}
                    >
                      Boleto simples
                    </button>
                    <button
                      type="button"
                      onClick={() => setCobrancaFormaPagamento('bolepix')}
                      className={`flex-1 py-2 font-bold rounded-xl border ${
                        cobrancaFormaPagamento === 'bolepix' ? 'bg-[#004276] text-white border-[#004276]' : 'bg-slate-50'
                      }`}
                    >
                      Boleto + Pix
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleFecharModalCobranca}
                    disabled={emitindoCobranca}
                    className="px-4 py-2 border rounded-xl font-bold disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={emitindoCobranca || !contratoSelecionadoId}
                    className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow disabled:opacity-50"
                  >
                    {emitindoCobranca ? 'Emitindo...' : 'Emitir cobrança'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
