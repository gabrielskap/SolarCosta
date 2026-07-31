import React, { useState } from 'react';
import { FileCheck, Printer, Send, CheckCircle2, FileText, Search, Plus, Trash2 } from 'lucide-react';
import { Contrato, Lead, User } from '../types';

interface ContractsViewProps {
  contratos: Contrato[];
  leads: Lead[];
  onSaveContract: (contrato: Contrato) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contratos,
  leads,
  onSaveContract,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'novo' | 'lista'>('novo');

  // Form State
  const [clienteNome, setClienteNome] = useState('Cristiano Duarte Almeida');
  const [cpfCnpj, setCpfCnpj] = useState('042.318.776-90');
  const [rgInscricao, setRgInscricao] = useState('MG-14.882.301');
  const [endereco, setEndereco] = useState('Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG');
  const [cep, setCep] = useState('31.530-150');
  const [telefone, setTelefone] = useState('(31) 99412-7708');

  // System Specs
  const [potenciaKwp, setPotenciaKwp] = useState(8.52);
  const [modulosQtd, setModulosQtd] = useState(12);
  const [moduloModelo, setModuloModelo] = useState('TLC Tier 1 710 Wp');
  const [inversorModelo, setInversorModelo] = useState('3x Micro Solax X3-MIC');
  const [estrutura, setEstrutura] = useState('Laje');
  const [prazoExecucao, setPrazoExecucao] = useState('45 dias corridos');
  const [localInstalacao, setLocalInstalacao] = useState('Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG');

  // Values & Payment
  const [valorTotal, setValorTotal] = useState(22490.00);
  const [formaPagamento, setFormaPagamento] = useState('Financiamento bancário');
  const [entrada, setEntrada] = useState('R$ 2.249,00 (10%)');
  const [parcelasInfo, setParcelasInfo] = useState('60x R$ 486,60');
  const [bancoAgente, setBancoAgente] = useState('BV Financeira – linha solar');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('10/09/2026');
  const [multaAtraso, setMultaAtraso] = useState('2% + 1% a.m.');
  const [foroEleito, setForoEleito] = useState('Belo Horizonte/MG');

  // Warranties & Tech Resp
  const [garantiaModulos, setGarantiaModulos] = useState('12 anos (defeito)');
  const [garantiaInversores, setGarantiaInversores] = useState('10 anos');
  const [garantiaInstalacao, setGarantiaInstalacao] = useState('5 anos');
  const [garantiaHomologacao, setGarantiaHomologacao] = useState('até 60 dias após vistoria');
  const [responsavelTecnico, setResponsavelTecnico] = useState('Thiago Gonçalves Leal');
  const [crea, setCrea] = useState('MG0000023481D');

  // Included clauses checkboxes
  const [clausulas, setClausulas] = useState<string[]>([
    'Objeto e escopo do fornecimento',
    'Preço, forma de pagamento e reajuste',
    'Prazos de entrega, instalação e homologação',
    'Obrigações do contratante e do contratado',
    'Exclusões de escopo (obra civil, padrão de entrada)',
    'Garantias e assistência técnica',
    'Cessão de crédito ao agente financeiro',
    'Rescisão, multas e foro'
  ]);

  const toggleClausula = (clause: string) => {
    if (clausulas.includes(clause)) {
      setClausulas(clausulas.filter(c => c !== clause));
    } else {
      setClausulas([...clausulas, clause]);
    }
  };

  const currentContractObj: Contrato = {
    id: `cont-0184`,
    numero: '2026-0184',
    leadId: 'lead-184',
    clienteNome,
    cpfCnpj,
    rgInscricao,
    endereco,
    cep,
    telefone,
    potenciaKwp,
    modulosQtd,
    moduloModelo,
    inversorModelo,
    estrutura,
    prazoExecucao,
    localInstalacao,
    valorTotal,
    formaPagamento,
    entrada,
    parcelasInfo,
    bancoAgente,
    primeiroVencimento,
    multaAtraso,
    foroEleito,
    garantias: {
      modulos: garantiaModulos,
      inversores: garantiaInversores,
      instalacao: garantiaInstalacao,
      homologacao: garantiaHomologacao
    },
    responsavelTecnico,
    crea,
    clausulas,
    status: 'aguardando',
    dataEmissao: new Date().toLocaleDateString('pt-BR')
  };

  const handleSaveDraft = () => {
    onSaveContract(currentContractObj);
    showToast('Rascunho do contrato salvo', 'success', 'Contrato armazenado no sistema.');
  };

  const handleGeneratePDF = () => {
    onSaveContract(currentContractObj);
    onOpenPDF('contrato', currentContractObj);
  };

  const handleSendElectronicSign = () => {
    onSaveContract(currentContractObj);
    showToast(
      'Enviado para assinatura',
      'success',
      `Link de assinatura eletrônica enviado via SMS/E-mail para ${clienteNome}.`
    );
  };

  const handleToggleStatus = (id: string) => {
    const updated = contratos.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: (c.status === 'assinado' ? 'aguardando' : 'assinado') as 'aguardando' | 'assinado'
        };
      }
      return c;
    });
    const c = updated.find(x => x.id === id);
    if (c) onSaveContract(c);
    showToast('Status alterado', 'info', 'Situação do contrato atualizada.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Contrato de prestação de serviço</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Gerado a partir da proposta nº 2026-0184 · Cristiano Duarte Almeida
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-200 p-1 rounded-xl flex gap-1 mr-2">
            <button
              onClick={() => setActiveSubTab('novo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'novo' ? 'bg-[#004276] text-white' : 'text-slate-700'
              }`}
            >
              Emitir contrato
            </button>
            <button
              onClick={() => setActiveSubTab('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'lista' ? 'bg-[#004276] text-white' : 'text-slate-700'
              }`}
            >
              Contratos emitidos ({contratos.length})
            </button>
          </div>

          {activeSubTab === 'novo' && (
            <>
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition"
              >
                Salvar rascunho
              </button>
              <button
                onClick={handleGeneratePDF}
                className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition"
              >
                Gerar PDF do contrato
              </button>
            </>
          )}
        </div>
      </div>

      {activeSubTab === 'novo' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT FORM (7/12 or 8/12) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            {/* 1. Contratante */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-slate-900 text-base">Contratante</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">NOME / RAZÃO SOCIAL</label>
                  <input
                    type="text"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">RG / INSCRIÇÃO</label>
                  <input
                    type="text"
                    value={rgInscricao}
                    onChange={(e) => setRgInscricao(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">ENDEREÇO COMPLETO</label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">CEP</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 2. Objeto do contrato */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">Objeto do contrato</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">preenchido pela proposta</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">POTÊNCIA (KWP)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={potenciaKwp}
                    onChange={(e) => setPotenciaKwp(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Nº DE MÓDULOS</label>
                  <input
                    type="number"
                    value={modulosQtd}
                    onChange={(e) => setModulosQtd(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">MÓDULO</label>
                  <input
                    type="text"
                    value={moduloModelo}
                    onChange={(e) => setModuloModelo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">INVERSOR</label>
                  <input
                    type="text"
                    value={inversorModelo}
                    onChange={(e) => setInversorModelo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">ESTRUTURA</label>
                  <select
                    value={estrutura}
                    onChange={(e) => setEstrutura(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="Laje">Laje</option>
                    <option value="Colonial">Colonial</option>
                    <option value="Metálico">Metálico</option>
                    <option value="Fibrocimento">Fibrocimento</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">PRAZO DE EXECUÇÃO</label>
                  <input
                    type="text"
                    value={prazoExecucao}
                    onChange={(e) => setPrazoExecucao(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">LOCAL DA INSTALAÇÃO</label>
                  <input
                    type="text"
                    value={localInstalacao}
                    onChange={(e) => setLocalInstalacao(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 3. Valores e forma de pagamento */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-slate-900 text-base">Valores e forma de pagamento</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">VALOR TOTAL</label>
                  <input
                    type="text"
                    value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    onChange={(e) => {
                      const num = Number(e.target.value.replace(/[^0-9]/g, '')) / 100;
                      if (!isNaN(num)) setValorTotal(num);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">FORMA DE PAGAMENTO</label>
                  <input
                    type="text"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">ENTRADA</label>
                  <input
                    type="text"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">PARCELAS</label>
                  <input
                    type="text"
                    value={parcelasInfo}
                    onChange={(e) => setParcelasInfo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">BANCO / AGENTE</label>
                  <input
                    type="text"
                    value={bancoAgente}
                    onChange={(e) => setBancoAgente(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">1º VENCIMENTO</label>
                  <input
                    type="text"
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">MULTA POR ATRASO</label>
                  <input
                    type="text"
                    value={multaAtraso}
                    onChange={(e) => setMultaAtraso(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">FORO ELEITO</label>
                  <input
                    type="text"
                    value={foroEleito}
                    onChange={(e) => setForoEleito(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 4. Garantias e responsável técnico */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#004276] text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h3 className="font-bold text-slate-900 text-base">Garantias e responsável técnico</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">MÓDULOS</label>
                  <input
                    type="text"
                    value={garantiaModulos}
                    onChange={(e) => setGarantiaModulos(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">INVERSORES</label>
                  <input
                    type="text"
                    value={garantiaInversores}
                    onChange={(e) => setGarantiaInversores(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">INSTALAÇÃO</label>
                  <input
                    type="text"
                    value={garantiaInstalacao}
                    onChange={(e) => setGarantiaInstalacao(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">HOMOLOGAÇÃO</label>
                  <input
                    type="text"
                    value={garantiaHomologacao}
                    onChange={(e) => setGarantiaHomologacao(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">RESPONSÁVEL TÉCNICO</label>
                  <input
                    type="text"
                    value={responsavelTecnico}
                    onChange={(e) => setResponsavelTecnico(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">CREA</label>
                  <input
                    type="text"
                    value={crea}
                    onChange={(e) => setCrea(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR (5/12 or 4/12) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            
            {/* Dark Blue Card CONTRATO Nº 2026-0184 */}
            <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-xl space-y-4">
              <span className="text-[10px] font-bold text-[#FFD100] uppercase tracking-widest block">
                CONTRATO Nº 2026-0184
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-200">Contratante</span>
                  <span className="font-extrabold text-white">{clienteNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Sistema</span>
                  <span className="font-extrabold text-white">{potenciaKwp} kWp - {modulosQtd} módulos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Forma</span>
                  <span className="font-extrabold text-white">{formaPagamento.split(' ')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Emissão</span>
                  <span className="font-extrabold text-white">30/07/2026</span>
                </div>
              </div>

              <div className="pt-3 border-t border-blue-900/60">
                <span className="text-[11px] text-blue-200">Valor do contrato</span>
                <h2 className="text-3xl font-black text-white mt-0.5">
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h2>
              </div>
            </div>

            {/* Cláusulas incluídas */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Cláusulas incluídas</h4>
              
              <div className="space-y-2 text-xs">
                {[
                  'Objeto e escopo do fornecimento',
                  'Preço, forma de pagamento e reajuste',
                  'Prazos de entrega, instalação e homologação',
                  'Obrigações do contratante e do contratado',
                  'Exclusões de escopo (obra civil, padrão de entrada)',
                  'Garantias e assistência técnica',
                  'Cessão de crédito ao agente financeiro',
                  'Rescisão, multas e foro'
                ].map((clause) => (
                  <label key={clause} className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={clausulas.includes(clause)}
                      onChange={() => toggleClausula(clause)}
                      className="mt-0.5 rounded text-[#004276] focus:ring-[#004276]"
                    />
                    <span>{clause}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Prévio do documento */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">Prévia do documento</h4>
              
              <div className="bg-slate-100 border border-slate-200 rounded-xl h-36 flex items-center justify-center text-xs text-slate-400 font-mono italic">
                prévia do contrato - 4 páginas
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleGeneratePDF}
                  className="w-full bg-[#004276] hover:bg-[#003159] text-white font-bold py-3 rounded-xl text-xs shadow transition flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Gerar PDF do contrato</span>
                </button>

                <button
                  onClick={handleSendElectronicSign}
                  className="w-full bg-white hover:bg-slate-50 text-[#004276] border border-slate-300 font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 text-blue-600" />
                  <span>Enviar para assinatura eletrônica</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LIST OF EMITTED CONTRACTS */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Contratos Emitidos</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                  <th className="p-3">Contrato</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Potência</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contratos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#004276]">Nº {c.numero}</td>
                    <td className="p-3 font-semibold text-slate-900">{c.clienteNome}</td>
                    <td className="p-3">{c.potenciaKwp} kWp</td>
                    <td className="p-3 font-bold text-slate-900">R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-slate-500">{c.dataEmissao}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleStatus(c.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'assinado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status === 'assinado' ? 'Assinado' : 'Aguardando assinatura'}
                      </button>
                    </td>
                    <td className="p-3 text-right font-bold space-x-2">
                      <button
                        onClick={() => onOpenPDF('contrato', c)}
                        className="text-blue-600 hover:underline"
                      >
                        Visualizar PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
