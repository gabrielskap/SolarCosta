import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Check, FileText, Download, Sparkles } from 'lucide-react';
import { Proposta, PropostaItem, Produto, Lead, User } from '../types';

interface ProposalCalculatorViewProps {
  propostas: Proposta[];
  produtos: Produto[];
  leads: Lead[];
  currentLeadId?: string;
  onSaveProposal: (proposta: Proposta) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const ProposalCalculatorView: React.FC<ProposalCalculatorViewProps> = ({
  propostas,
  produtos,
  leads,
  currentLeadId,
  onSaveProposal,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  // Find lead if passed
  const linkedLead = leads.find(l => l.id === currentLeadId) || leads.find(l => l.id === 'lead-184') || leads[0];

  // Form states
  const [clienteNome, setClienteNome] = useState(linkedLead?.nome || 'Cristiano Duarte Almeida');
  const [cpfCnpj, setCpfCnpj] = useState(linkedLead?.cpfCnpj || '042.318.776-90');
  const [telefone, setTelefone] = useState(linkedLead?.telefone || '(31) 99412-7708');
  const [email, setEmail] = useState(linkedLead?.email || 'cristiano.duarte@gmail.com');
  const [endereco, setEndereco] = useState(linkedLead?.endereco || 'Rua dos Ipês, 512 – Santa Mônica');
  const [cidade, setCidade] = useState(linkedLead?.cidade || 'Belo Horizonte/MG');
  const [concessionaria, setConcessionaria] = useState(linkedLead?.concessionaria || 'CEMIG');
  const [telhado, setTelhado] = useState(linkedLead?.telhado || 'Laje');

  // Sizing inputs
  const [consumoKwh, setConsumoKwh] = useState(1000);
  const [tarifaKwh, setTarifaKwh] = useState(1.19);
  const [hsp, setHsp] = useState(5.2);
  const [perdasPct, setPerdasPct] = useState(24.5);
  const [moduloWp, setModuloWp] = useState(710);

  // Kit Items State
  const [kitItens, setKitItens] = useState<PropostaItem[]>([
    { id: 'i1', produtoId: 'p7', descricao: 'Painel TLC Tier 1 710 Wp', qtd: 12, valorUnit: 640.00, total: 7680.00 },
    { id: 'i2', produtoId: 'p10', descricao: 'Micro inversor Solax X3-MIC', qtd: 3, valorUnit: 2150.00, total: 6450.00 },
    { id: 'i3', produtoId: 'p9', descricao: 'Estrutura para laje – 12 módulos', qtd: 1, valorUnit: 1980.00, total: 1980.00 },
    { id: 'i4', descricao: 'Material, cabos e conexões', qtd: 1, valorUnit: 1480.00, total: 1480.00 },
    { id: 'i5', descricao: 'Instalação, projeto e homologação do SFCR', qtd: 1, valorUnit: 4900.00, total: 4900.00 }
  ]);

  // Payment Options
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'cartao' | 'financiamento'>('financiamento');
  const [descontoAvistaPct, setDescontoAvistaPct] = useState(7);
  const [parcelasCartao, setParcelasCartao] = useState(12);
  const [taxaCartaoPct, setTaxaCartaoPct] = useState(4.5);
  
  const [entradaFinanciamentoPct, setEntradaFinanciamentoPct] = useState(10);
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState(60);
  const [jurosFinanciamentoMesPct, setJurosFinanciamentoMesPct] = useState(1.45);
  const [bancoFinanciamento, setBancoFinanciamento] = useState('BV Financeira – linha solar');

  // Proposal PDF Customization Inputs
  const [observacoes, setObservacoes] = useState<string>(
    '📍 Validade da proposta: 10 dias corridos a partir desta data.\n⚡ Incluso projeto elétrico, ART, instalação e homologação técnica na CEMIG.\n🏠 Estrutura para telhado colonial com proteção contra intempéries.\n💳 Desconto especial de 5% concedido para pagamento à vista via PIX.'
  );
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');

  // Modal to add catalog item
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [selectedCatalogProdutoId, setSelectedCatalogProdutoId] = useState(produtos[0]?.id || '');

  // Automatic sizing calculations
  // Formula: Potência kWp = Consumo kWh / (30 * HSP * (1 - Perdas/100))
  const geracaoPorKwp = 30 * hsp * (1 - perdasPct / 100); // ~ 117.7 kWh/kWp
  const potenciaKwpCalculada = Number((consumoKwh / geracaoPorKwp).toFixed(2)); // ~ 8.52 kWp
  const modulosQtdCalculada = Math.ceil((potenciaKwpCalculada * 1000) / moduloWp); // ~ 12 un
  const geracaoMediaKwh = Math.round(potenciaKwpCalculada * geracaoPorKwp); // ~ 1003 kWh
  const areaEstimadaM2 = Number((modulosQtdCalculada * 2.58 * 2.25).toFixed(2)); // ~ 69.96 m²
  const coberturaPct = Number(((geracaoMediaKwh / consumoKwh) * 100).toFixed(1)); // ~ 100.3%

  // Total investment from items
  const valorTotalInvestimento = kitItens.reduce((acc, item) => acc + item.total, 0);

  // Financial ROI calculations
  const economiaMensal = Number((geracaoMediaKwh * tarifaKwh).toFixed(2)); // ~ R$ 1.194,15
  const economiaAnual = Number((economiaMensal * 12).toFixed(2)); // ~ R$ 14.329,77
  // Compound savings with 6% annual tariff increase over 25 years
  let economia25Anos = 0;
  let currentYearSavings = economiaAnual;
  for (let y = 1; y <= 25; y++) {
    economia25Anos += currentYearSavings;
    currentYearSavings *= 1.06;
  }
  const paybackAnos = Number((valorTotalInvestimento / economiaAnual).toFixed(1));

  // PMT Price Formula for Financiamento:
  // PV = Total - Entrada
  const entradaValor = (valorTotalInvestimento * entradaFinanciamentoPct) / 100;
  const valorFinanciado = valorTotalInvestimento - entradaValor;
  const i = jurosFinanciamentoMesPct / 100;
  const n = parcelasFinanciamento;
  const pmtParcelaFinanciamento = i > 0 
    ? (valorFinanciado * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1)
    : valorFinanciado / n;

  // Sync kit item 1 (modulos) with sizing if modulosQtd changes
  useEffect(() => {
    setKitItens(prev => prev.map((item, idx) => {
      if (idx === 0) {
        return {
          ...item,
          qtd: modulosQtdCalculada,
          total: modulosQtdCalculada * item.valorUnit
        };
      }
      return item;
    }));
  }, [modulosQtdCalculada]);

  const handleUpdateItemQtd = (id: string, newQtd: number) => {
    if (newQtd <= 0) return;
    setKitItens(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          qtd: newQtd,
          total: newQtd * item.valorUnit
        };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setKitItens(prev => prev.filter(item => item.id !== id));
  };

  const handleAddCatalogItem = () => {
    const prod = produtos.find(p => p.id === selectedCatalogProdutoId);
    if (!prod) return;

    const newItem: PropostaItem = {
      id: `i-${Date.now()}`,
      produtoId: prod.id,
      descricao: prod.nome,
      qtd: 1,
      valorUnit: prod.preco,
      total: prod.preco
    };

    setKitItens(prev => [...prev, newItem]);
    setIsAddItemOpen(false);
    showToast('Item adicionado', 'success', `${prod.nome} incluído no kit.`);
  };

  const handleSaveDraft = () => {
    const prop: Proposta = {
      id: `prop-${Date.now()}`,
      numero: '2026-0184',
      leadId: linkedLead?.id || 'lead-184',
      clienteNome,
      cpfCnpj,
      telefone,
      email,
      endereco,
      cidade,
      concessionaria,
      telhado,
      consumoKwh,
      tarifaKwh,
      hsp,
      perdasPct,
      moduloWp,
      potenciaKwp: potenciaKwpCalculada,
      modulosQtd: modulosQtdCalculada,
      areaEstimadaM2,
      geracaoMediaKwh,
      coberturaPct,
      kitItens,
      valorTotal: valorTotalInvestimento,
      economiaMensal,
      economiaAnual,
      economia25Anos,
      paybackAnos,
      formaPagamento,
      descontoAvistaPct,
      parcelasCartao,
      taxaCartaoPct,
      entradaFinanciamentoValor: entradaValor,
      entradaFinanciamentoPct,
      parcelasFinanciamento,
      jurosFinanciamentoMesPct,
      bancoFinanciamento,
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      status: 'rascunho',
      observacoes,
      customLogoUrl
    };

    onSaveProposal(prop);
    showToast('Rascunho salvo', 'success', 'Proposta de orçamento gravada com sucesso.');
  };

  const handleGeneratePDF = () => {
    const prop: Proposta = {
      id: `prop-${Date.now()}`,
      numero: '2026-0184',
      leadId: linkedLead?.id || 'lead-184',
      clienteNome,
      cpfCnpj,
      telefone,
      email,
      endereco,
      cidade,
      concessionaria,
      telhado,
      consumoKwh,
      tarifaKwh,
      hsp,
      perdasPct,
      moduloWp,
      potenciaKwp: potenciaKwpCalculada,
      modulosQtd: modulosQtdCalculada,
      areaEstimadaM2,
      geracaoMediaKwh,
      coberturaPct,
      kitItens,
      valorTotal: valorTotalInvestimento,
      economiaMensal,
      economiaAnual,
      economia25Anos,
      paybackAnos,
      formaPagamento,
      descontoAvistaPct,
      parcelasCartao,
      taxaCartaoPct,
      entradaFinanciamentoValor: entradaValor,
      entradaFinanciamentoPct,
      parcelasFinanciamento,
      jurosFinanciamentoMesPct,
      bancoFinanciamento,
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      status: 'enviada',
      observacoes,
      customLogoUrl
    };

    onSaveProposal(prop);
    onOpenPDF('proposta', prop);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Proposta de orçamento</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Nova proposta · nº 2026-0184 · válida por 5 dias
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition"
          >
            Salvar rascunho
          </button>
          <button
            onClick={handleGeneratePDF}
            className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Gerar proposta em PDF</span>
          </button>
        </div>
      </div>

      {/* Main Form Layout (7/12 Form, 5/12 Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT FORM (7/12 or 8/12) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* Section 1: Dados do cliente */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="font-bold text-slate-900 text-base">Dados do cliente</h3>
              <span className="text-xs text-slate-400 font-medium ml-auto">
                vinculado ao lead #{linkedLead?.numero || '184'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  NOME / RAZÃO SOCIAL
                </label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  CPF / CNPJ
                </label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  TELEFONE
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    ENDEREÇO DA INSTALAÇÃO
                  </label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    CONCESSIONÁRIA
                  </label>
                  <select
                    value={concessionaria}
                    onChange={(e) => setConcessionaria(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  >
                    <option value="CEMIG">CEMIG</option>
                    <option value="ENEL">ENEL</option>
                    <option value="CPFL">CPFL</option>
                    <option value="LIGHT">LIGHT</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    TIPO DE TELHADO
                  </label>
                  <select
                    value={telhado}
                    onChange={(e) => setTelhado(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  >
                    <option value="Laje">Laje</option>
                    <option value="Colonial">Colonial</option>
                    <option value="Metálico">Metálico</option>
                    <option value="Fibrocimento">Fibrocimento</option>
                    <option value="Solo/Estrutura">Solo/Estrutura</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Dimensionamento do sistema */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="font-bold text-slate-900 text-base">Dimensionamento do sistema</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  CONSUMO KWH/MÊS
                </label>
                <input
                  type="number"
                  value={consumoKwh}
                  onChange={(e) => setConsumoKwh(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  TARIFA R$/KWH
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={tarifaKwh}
                  onChange={(e) => setTarifaKwh(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  HSP DA CIDADE
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={hsp}
                  onChange={(e) => setHsp(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  PERDAS %
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={perdasPct}
                  onChange={(e) => setPerdasPct(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  MÓDULO WP
                </label>
                <input
                  type="number"
                  value={moduloWp}
                  onChange={(e) => setModuloWp(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>
            </div>

            {/* Calculated sizing banner */}
            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">POTÊNCIA</span>
                <p className="text-xl font-black text-[#004276]">{potenciaKwpCalculada} kWp</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">MÓDULOS</span>
                <p className="text-xl font-black text-slate-900">{modulosQtdCalculada} un</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">ÁREA ESTIMADA</span>
                <p className="text-xl font-black text-slate-900">{areaEstimadaM2} m²</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">GERAÇÃO MÉDIA</span>
                <p className="text-xl font-black text-slate-900">{geracaoMediaKwh.toLocaleString('pt-BR')} kWh</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">COBERTURA</span>
                <p className="text-xl font-black text-emerald-700">{coberturaPct}%</p>
              </div>
            </div>
          </div>

          {/* Section 3: Kit de equipamentos e serviços */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-slate-900 text-base">Kit de equipamentos e serviços</h3>
              </div>

              <button
                type="button"
                onClick={() => setIsAddItemOpen(true)}
                className="text-xs font-bold text-[#004276] hover:underline flex items-center gap-1"
              >
                + Adicionar item do catálogo
              </button>
            </div>

            {/* Kit Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                    <th className="p-3">DESCRIÇÃO</th>
                    <th className="p-3 text-center">QTD.</th>
                    <th className="p-3 text-right">VALOR UNIT.</th>
                    <th className="p-3 text-right">TOTAL</th>
                    <th className="p-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kitItens.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{item.descricao}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qtd}
                          onChange={(e) => handleUpdateItemQtd(item.id, Number(e.target.value))}
                          className="w-16 p-1 text-center bg-slate-50 border border-slate-200 rounded font-bold"
                        />
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        R$ {item.valorUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Total do investimento</span>
                <span className="text-xl font-extrabold text-[#004276]">
                  R$ {valorTotalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Forma de pagamento */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Modalidades de pagamento</h3>

            {/* Selector Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormaPagamento('avista')}
                className={`py-2.5 rounded-xl font-bold text-xs transition border ${
                  formaPagamento === 'avista'
                    ? 'bg-[#004276] text-white border-[#004276]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                À vista (com desconto)
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento('cartao')}
                className={`py-2.5 rounded-xl font-bold text-xs transition border ${
                  formaPagamento === 'cartao'
                    ? 'bg-[#004276] text-white border-[#004276]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Cartão de crédito
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento('financiamento')}
                className={`py-2.5 rounded-xl font-bold text-xs transition border ${
                  formaPagamento === 'financiamento'
                    ? 'bg-[#004276] text-white border-[#004276]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Financiamento bancário
              </button>
            </div>

            {/* Payment Details Form based on selected mode */}
            {formaPagamento === 'financiamento' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">ENTRADA (%)</label>
                    <input
                      type="number"
                      value={entradaFinanciamentoPct}
                      onChange={(e) => setEntradaFinanciamentoPct(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">PARCELAS</label>
                    <select
                      value={parcelasFinanciamento}
                      onChange={(e) => setParcelasFinanciamento(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                    >
                      <option value="12">12x</option>
                      <option value="24">24x</option>
                      <option value="36">36x</option>
                      <option value="48">48x</option>
                      <option value="60">60x</option>
                      <option value="72">72x</option>
                      <option value="120">120x</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">JUROS MÊS (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={jurosFinanciamentoMesPct}
                      onChange={(e) => setJurosFinanciamentoMesPct(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">AGENTE / BANCO</label>
                    <input
                      type="text"
                      value={bancoFinanciamento}
                      onChange={(e) => setBancoFinanciamento(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-3 gap-2 text-center font-bold">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">VALOR DA ENTRADA</span>
                    <span className="text-slate-900">R$ {entradaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">VALOR DA PARCELA ({n}x)</span>
                    <span className="text-[#004276] text-sm">R$ {pmtParcelaFinanciamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">TOTAL DO FINANCIAMENTO</span>
                    <span className="text-slate-900">R$ {(entradaValor + pmtParcelaFinanciamento * n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {formaPagamento === 'avista' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">PERCENTUAL DE DESCONTO (%)</label>
                    <input
                      type="number"
                      value={descontoAvistaPct}
                      onChange={(e) => setDescontoAvistaPct(Number(e.target.value))}
                      className="p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 w-32"
                    />
                  </div>
                  <div className="pt-5">
                    <p className="font-bold text-slate-800">
                      Economia extra à vista: <span className="text-emerald-600">R$ {((valorTotalInvestimento * descontoAvistaPct) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </p>
                    <p className="text-xs text-slate-600 font-extrabold">
                      Total com desconto: R$ {(valorTotalInvestimento * (1 - descontoAvistaPct / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formaPagamento === 'cartao' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">PARCELAS CARTÃO</label>
                    <select
                      value={parcelasCartao}
                      onChange={(e) => setParcelasCartao(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                    >
                      <option value="6">6x</option>
                      <option value="10">10x</option>
                      <option value="12">12x</option>
                      <option value="18">18x</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">TAXA DO CARTÃO (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={taxaCartaoPct}
                      onChange={(e) => setTaxaCartaoPct(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Observações & Personalização do PDF */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                5
              </span>
              <h3 className="font-bold text-slate-900 text-base">Observações & Customização do PDF</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  OBSERVAÇÕES ESPECÍFICAS / CLÁUSULAS DA PROPOSTA
                </label>
                <textarea
                  rows={4}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Escreva observações específicas sobre o projeto, vigência, desconto especial ou telhado..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004276] leading-relaxed font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  URL DE LOGO CUSTOMIZADA (OPCIONAL)
                </label>
                <input
                  type="url"
                  value={customLogoUrl}
                  onChange={(e) => setCustomLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo-solar-costa.png"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Caso permaneça em branco, a proposta utilizará a marca e o logotipo oficial da Solar Costa Energia.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (5/12 or 4/12) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Card Dark Blue "RESUMO DA PROPOSTA" */}
          <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-xl space-y-5">
            <span className="text-[10px] font-bold text-[#FFD100] uppercase tracking-widest block">
              RESUMO DA PROPOSTA
            </span>

            <div className="space-y-2 text-xs border-b border-blue-900/60 pb-4">
              <div className="flex justify-between">
                <span className="text-blue-200">Potência instalada</span>
                <span className="font-extrabold text-white">{potenciaKwpCalculada} kWp</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Geração média/mês</span>
                <span className="font-extrabold text-white">{geracaoMediaKwh.toLocaleString('pt-BR')} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Área do sistema</span>
                <span className="font-extrabold text-white">{areaEstimadaM2} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Perdas consideradas</span>
                <span className="font-extrabold text-white">{perdasPct}%</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-blue-200 font-medium">Investimento total</span>
              <h2 className="text-3xl font-black text-white mt-0.5">
                R$ {valorTotalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>

          {/* Card "Economia estimada" */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">Economia estimada</h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Por mês</span>
                <span className="font-bold text-emerald-600 text-base">
                  R$ {economiaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Por ano</span>
                <span className="font-bold text-slate-900">
                  R$ {economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-slate-500 font-medium">Em 25 anos (reajuste 6% a.a.)</span>
                <span className="font-bold text-slate-900">
                  R$ {economia25Anos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center text-emerald-900 font-bold text-xs mt-2 flex justify-between items-center">
                <span>Retorno do investimento</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-black">
                  {paybackAnos} anos
                </span>
              </div>
            </div>
          </div>

          {/* Card "CONDIÇÕES COMERCIAIS" */}
          <div className="bg-amber-50/60 border border-amber-200/80 p-5 rounded-2xl text-xs space-y-2 text-amber-900">
            <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">CONDIÇÕES COMERCIAIS</h4>
            <p className="leading-relaxed">
              Proposta válida por 5 dias · despacho em até 30 dias · instalação agendada após a entrega dos equipamentos · crédito sujeito a aprovação.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Add Catalog Product */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Adicionar produto do catálogo</h3>
              <button onClick={() => setIsAddItemOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">Selecione o produto</label>
                <select
                  value={selectedCatalogProdutoId}
                  onChange={(e) => setSelectedCatalogProdutoId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {produtos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {p.preco.toLocaleString('pt-BR')} ({p.fornecedorNome})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddCatalogItem}
                  className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
                >
                  Adicionar ao Kit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
