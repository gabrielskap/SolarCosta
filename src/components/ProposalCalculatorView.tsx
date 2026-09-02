import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Check, FileText, Download, Sparkles, Loader2, MapPinned } from 'lucide-react';
import { Proposta, PropostaItem, Produto, Lead, User } from '../types';
import { maskCPFCNPJ, maskPhone, maskCEP, onlyDigits, docLabel, isValidCPFCNPJ } from '../utils/format';
import { fetchAddressByCep, buildEnderecoLine, buildCidadeUf } from '../services/cep';
import { paramNum, type ConfigApp } from '../services/api';
import { dimensionar, projetarEconomia } from '../utils/solar';

interface ProposalCalculatorViewProps {
  propostas: Proposta[];
  produtos: Produto[];
  leads: Lead[];
  currentLeadId?: string;
  /** Parâmetros e domínios vindos do banco (substituem os antigos literais). */
  config: ConfigApp | null;
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
  config,
  onSaveProposal,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  // Lead vinculado. Sem lead selecionado o formulário nasce em branco — antes
  // ele caía num lead fixo de demonstração ("Cristiano Duarte Almeida").
  const [leadIdSelecionado, setLeadIdSelecionado] = useState(currentLeadId || '');
  const linkedLead = leads.find(l => l.id === leadIdSelecionado);

  // Form states
  const [clienteNome, setClienteNome] = useState(linkedLead?.nome || '');
  const [cpfCnpj, setCpfCnpj] = useState(linkedLead?.cpfCnpj || '');
  const [telefone, setTelefone] = useState(linkedLead?.telefone || '');
  const [email, setEmail] = useState(linkedLead?.email || '');
  const [endereco, setEndereco] = useState(linkedLead?.endereco || '');
  const [cidade, setCidade] = useState(linkedLead?.cidade || '');
  const [concessionaria, setConcessionaria] = useState(linkedLead?.concessionaria || '');
  const [telhado, setTelhado] = useState(linkedLead?.telhado || '');
  const [cep, setCep] = useState(linkedLead?.cep || '');

  const [cepLoading, setCepLoading] = useState(false);

  // Integração CEP -> endereço (ViaCEP): preenche endereço e cidade/UF.
  const handleCepLookup = async (cepValue: string) => {
    if (onlyDigits(cepValue).length !== 8) return;
    setCepLoading(true);
    const result = await fetchAddressByCep(cepValue);
    setCepLoading(false);
    if (!result.ok || !result.endereco) {
      showToast('CEP não encontrado', 'error', result.erro || 'Verifique o CEP informado.');
      return;
    }
    const linha = buildEnderecoLine(result.endereco);
    if (linha) setEndereco(linha);
    const cidadeUf = buildCidadeUf(result.endereco);
    if (cidadeUf) setCidade(cidadeUf);
    showToast('Endereço preenchido', 'success', `${linha || cidadeUf} (via ViaCEP).`);
  };

  const cpfInvalido = !!cpfCnpj && !isValidCPFCNPJ(cpfCnpj);

  // Parâmetros de dimensionamento — vêm de SolarCosta_Parametros.
  // Os números abaixo do `??` são só rede de segurança para o caso de a
  // configuração ainda não ter chegado; a fonte da verdade é o banco.
  const [consumoKwh, setConsumoKwh] = useState(linkedLead?.consumoKwh || 0);
  const [tarifaKwh, setTarifaKwh] = useState(() => paramNum(config, 'proposta.tarifa_kwh_padrao', 1.19));
  const [hsp, setHsp] = useState(() => paramNum(config, 'proposta.hsp_padrao', 5.2));
  const [perdasPct, setPerdasPct] = useState(() => paramNum(config, 'proposta.perdas_pct_padrao', 24.5));
  const [moduloWp, setModuloWp] = useState(() => paramNum(config, 'proposta.modulo_wp_padrao', 710));

  // Kit vazio: o consultor monta a partir do catálogo real.
  const [kitItens, setKitItens] = useState<PropostaItem[]>([]);

  // Payment Options
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'cartao' | 'financiamento'>('avista');
  const [descontoAvistaPct, setDescontoAvistaPct] = useState(() => paramNum(config, 'proposta.desconto_avista_pct', 7));
  const [parcelasCartao, setParcelasCartao] = useState(() => paramNum(config, 'proposta.parcelas_cartao_padrao', 12));
  const [taxaCartaoPct, setTaxaCartaoPct] = useState(() => paramNum(config, 'proposta.taxa_cartao_pct', 4.5));

  const [entradaFinanciamentoPct, setEntradaFinanciamentoPct] = useState(() => paramNum(config, 'financiamento.entrada_pct_padrao', 10));
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState(() => paramNum(config, 'financiamento.parcelas_padrao', 60));
  const [jurosFinanciamentoMesPct, setJurosFinanciamentoMesPct] = useState(() => paramNum(config, 'financiamento.juros_mes_pct', 1.45));
  const [bancoFinanciamento, setBancoFinanciamento] = useState('');

  // Observações da proposta: em branco. Os textos prontos ficam em
  // SolarCosta_ObservacaoPresets e são inseridos com um clique.
  const [observacoes, setObservacoes] = useState<string>('');

  // A configuração chega uma vez, depois da carga inicial. Quando chega, os
  // defaults numéricos se ajustam ao que está cadastrado no banco.
  useEffect(() => {
    if (!config) return;
    setTarifaKwh(paramNum(config, 'proposta.tarifa_kwh_padrao', 1.19));
    setHsp(paramNum(config, 'proposta.hsp_padrao', 5.2));
    setPerdasPct(paramNum(config, 'proposta.perdas_pct_padrao', 24.5));
    setModuloWp(paramNum(config, 'proposta.modulo_wp_padrao', 710));
    setDescontoAvistaPct(paramNum(config, 'proposta.desconto_avista_pct', 7));
    setParcelasCartao(paramNum(config, 'proposta.parcelas_cartao_padrao', 12));
    setTaxaCartaoPct(paramNum(config, 'proposta.taxa_cartao_pct', 4.5));
    setEntradaFinanciamentoPct(paramNum(config, 'financiamento.entrada_pct_padrao', 10));
    setParcelasFinanciamento(paramNum(config, 'financiamento.parcelas_padrao', 60));
    setJurosFinanciamentoMesPct(paramNum(config, 'financiamento.juros_mes_pct', 1.45));
    if (config.bancos.length > 0) setBancoFinanciamento(config.bancos[0].nome);
  }, [config]);

  // Ao trocar de lead, o formulário reflete o cliente escolhido.
  useEffect(() => {
    const lead = leads.find(l => l.id === leadIdSelecionado);
    if (!lead) return;
    setClienteNome(lead.nome || '');
    setCpfCnpj(lead.cpfCnpj || '');
    setTelefone(lead.telefone || '');
    setEmail(lead.email || '');
    setEndereco(lead.endereco || '');
    setCidade(lead.cidade || '');
    setConcessionaria(lead.concessionaria || '');
    setTelhado(lead.telhado || '');
    setCep(lead.cep || '');
    if (lead.consumoKwh) setConsumoKwh(lead.consumoKwh);
  }, [leadIdSelecionado, leads]);

  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');

  // Modal to add catalog item
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [selectedCatalogProdutoId, setSelectedCatalogProdutoId] = useState(produtos[0]?.id || '');

  // Dimensionamento e economia moram em utils/solar.ts — o simulador público
  // do site chama exatamente as mesmas funções, então os dois nunca divergem.
  const {
    potenciaKwp: potenciaKwpCalculada,  // ~ 8.52 kWp
    modulosQtd: modulosQtdCalculada,    // ~ 12 un
    geracaoMediaKwh,                    // ~ 1003 kWh
    areaEstimadaM2,                     // ~ 69.96 m²
    coberturaPct,                       // ~ 100.3%
  } = dimensionar({ consumoKwh, hsp, perdasPct, moduloWp });

  // Total investment from items
  const valorTotalInvestimento = kitItens.reduce((acc, item) => acc + item.total, 0);

  // Financial ROI calculations
  const {
    economiaMensal,                        // ~ R$ 1.194,15
    economiaAnual,                         // ~ R$ 14.329,77
    economiaAcumulada: economia25Anos,     // 25 anos, tarifa +6% a.a.
  } = projetarEconomia({ geracaoMediaKwh, tarifaKwh });

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

  // Espelha os requisitos mínimos do backend (propostaSchema): sem isso, o
  // POST falha depois que o PDF já foi aberto/impresso com dados fictícios.
  const validarProposta = (): boolean => {
    if (!clienteNome.trim()) {
      showToast('Campos incompletos', 'error', 'Informe o nome do cliente.');
      return false;
    }
    if (cpfInvalido) {
      showToast('Documento inválido', 'error', `Verifique o ${docLabel(cpfCnpj)} informado.`);
      return false;
    }
    if (consumoKwh <= 0) {
      showToast('Campos incompletos', 'error', 'Informe um consumo médio (kWh/mês) maior que zero.');
      return false;
    }
    if (tarifaKwh <= 0) {
      showToast('Campos incompletos', 'error', 'Informe uma tarifa de energia válida.');
      return false;
    }
    if (hsp <= 0) {
      showToast('Campos incompletos', 'error', 'Informe o HSP (horas de sol pleno) da cidade.');
      return false;
    }
    if (kitItens.length === 0) {
      showToast('Kit vazio', 'error', 'Adicione pelo menos um item do catálogo antes de gerar a proposta.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = () => {
    if (!validarProposta()) return;
    const prop: Proposta = {
      id: `prop-${Date.now()}`,
      numero: '', // gerado pelo banco ao salvar
      leadId: linkedLead?.id || '',
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
    if (!validarProposta()) return;
    const prop: Proposta = {
      id: `prop-${Date.now()}`,
      numero: '', // gerado pelo banco ao salvar
      leadId: linkedLead?.id || '',
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
            {/* O número é gerado pelo banco ao salvar; a validade vem dos parâmetros. */}
            Nova proposta · nº gerado ao salvar · válida por {paramNum(config, 'proposta.validade_dias', 10)} dias
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
                {linkedLead ? `vinculado ao lead ${linkedLead.numero}` : 'sem lead vinculado'}
              </span>
            </div>

            {/* Seletor de lead: preenche os campos com o cliente escolhido. */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                LEAD VINCULADO
              </label>
              <select
                value={leadIdSelecionado}
                onChange={(e) => setLeadIdSelecionado(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
              >
                <option value="">Nenhum — preencher manualmente</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero} · {l.nome} {l.cidade ? `· ${l.cidade}` : ''}
                  </option>
                ))}
              </select>
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
                  {docLabel(cpfCnpj)}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(maskCPFCNPJ(e.target.value))}
                  className={`w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none ${
                    cpfInvalido ? 'border-rose-300 focus:border-rose-500 bg-rose-50/40' : 'border-slate-200 focus:border-[#004276]'
                  }`}
                />
                {cpfInvalido && <p className="text-[10px] text-rose-600 font-semibold mt-1">{docLabel(cpfCnpj)} inválido</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  TELEFONE
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                />
              </div>

              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    CEP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cep}
                      onChange={(e) => {
                        const masked = maskCEP(e.target.value);
                        setCep(masked);
                        if (onlyDigits(masked).length === 8) handleCepLookup(masked);
                      }}
                      onBlur={() => handleCepLookup(cep)}
                      placeholder="00000-000"
                      className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                      {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPinned className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </div>

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
              Proposta válida por {paramNum(config, 'proposta.validade_dias', 10)} dias · despacho em até 30 dias · instalação agendada após a entrega dos equipamentos · crédito sujeito a aprovação.
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
