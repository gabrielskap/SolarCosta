import React, { useState, useEffect } from 'react';
import { FileCheck, Printer, Send, CheckCircle2, FileText, Search, Plus, Trash2 } from 'lucide-react';
import { Contrato, Lead, Proposta, User } from '../types';
import { param, type ConfigApp } from '../services/api';

interface ContractsViewProps {
  contratos: Contrato[];
  leads: Lead[];
  /** Propostas disponíveis para gerar o contrato a partir do dimensionamento. */
  propostas?: Proposta[];
  /** Empresa, parâmetros e cláusulas padrão vindos do banco. */
  config: ConfigApp | null;
  onSaveContract: (contrato: Contrato) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contratos,
  leads,
  propostas = [],
  config,
  onSaveContract,
  onOpenPDF,
  currentUser,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'novo' | 'lista'>('novo');

  // Origem do contrato: escolher uma proposta preenche o formulário inteiro.
  // Antes, o formulário nascia com um cliente fixo de demonstração.
  const [propostaOrigemId, setPropostaOrigemId] = useState('');

  // Form State
  const [clienteNome, setClienteNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [rgInscricao, setRgInscricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [telefone, setTelefone] = useState('');

  // System Specs
  const [potenciaKwp, setPotenciaKwp] = useState(0);
  const [modulosQtd, setModulosQtd] = useState(0);
  const [moduloModelo, setModuloModelo] = useState('');
  const [inversorModelo, setInversorModelo] = useState('');
  const [estrutura, setEstrutura] = useState('');
  const [prazoExecucao, setPrazoExecucao] = useState('');
  const [localInstalacao, setLocalInstalacao] = useState('');

  // Values & Payment
  const [valorTotal, setValorTotal] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [entrada, setEntrada] = useState('');
  const [parcelasInfo, setParcelasInfo] = useState('');
  const [bancoAgente, setBancoAgente] = useState('');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');
  const [multaAtraso, setMultaAtraso] = useState('');
  const [foroEleito, setForoEleito] = useState('');

  // Warranties & Tech Resp
  const [garantiaModulos, setGarantiaModulos] = useState('');
  const [garantiaInversores, setGarantiaInversores] = useState('');
  const [garantiaInstalacao, setGarantiaInstalacao] = useState('');
  const [garantiaHomologacao, setGarantiaHomologacao] = useState('');
  const [responsavelTecnico, setResponsavelTecnico] = useState('');
  const [crea, setCrea] = useState('');

  // Cláusulas selecionadas (títulos). A biblioteca vem de SolarCosta_ClausulasPadrao.
  const [clausulas, setClausulas] = useState<string[]>([]);

  // Prazo, multa, garantias, foro, responsável técnico e CREA saem dos
  // parâmetros e do cadastro da empresa — não mais de literais no componente.
  useEffect(() => {
    if (!config) return;
    setPrazoExecucao(param(config, 'contrato.prazo_execucao', ''));
    setMultaAtraso(param(config, 'contrato.multa_atraso', ''));
    setGarantiaModulos(param(config, 'contrato.garantia_modulos', ''));
    setGarantiaInversores(param(config, 'contrato.garantia_inversores', ''));
    setGarantiaInstalacao(param(config, 'contrato.garantia_instalacao', ''));
    setGarantiaHomologacao(param(config, 'contrato.garantia_homologacao', ''));
    setForoEleito(config.empresa?.foro_padrao ?? '');
    setResponsavelTecnico(config.empresa?.responsavel_tecnico ?? '');
    setCrea(config.empresa?.crea ?? '');
  }, [config]);

  // Escolher a proposta traz cliente, dimensionamento e condições comerciais.
  useEffect(() => {
    const p = propostas.find((x) => x.id === propostaOrigemId);
    if (!p) return;
    const lead = leads.find((l) => l.id === p.leadId);

    setClienteNome(p.clienteNome || '');
    setCpfCnpj(p.cpfCnpj || '');
    setRgInscricao(lead?.rgInscricao || '');
    setEndereco(p.endereco || '');
    setCep(lead?.cep || '');
    setTelefone(p.telefone || '');

    setPotenciaKwp(p.potenciaKwp || 0);
    setModulosQtd(p.modulosQtd || 0);
    setEstrutura(p.telhado || '');
    setLocalInstalacao(p.endereco || '');

    setValorTotal(p.valorTotal || 0);
    setFormaPagamento(
      p.formaPagamento === 'financiamento'
        ? 'Financiamento bancário'
        : p.formaPagamento === 'cartao'
          ? 'Cartão de crédito'
          : 'À vista',
    );
    if (p.entradaFinanciamentoValor) {
      setEntrada(
        `${p.entradaFinanciamentoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` +
          (p.entradaFinanciamentoPct ? ` (${p.entradaFinanciamentoPct}%)` : ''),
      );
    }
    if (p.parcelasFinanciamento) setParcelasInfo(`${p.parcelasFinanciamento}x`);
    setBancoAgente(p.bancoFinanciamento || '');
  }, [propostaOrigemId, propostas, leads]);

  // Biblioteca de cláusulas cadastrada no banco; as marcadas como `padrao`
  // já vêm selecionadas.
  const clausulasDisponiveis = config?.clausulas ?? [];

  useEffect(() => {
    if (!config || clausulas.length > 0) return;
    setClausulas(config.clausulas.filter((c) => c.padrao).map((c) => c.titulo));
  }, [config, clausulas.length]);

  const toggleClausula = (clause: string) => {
    if (clausulas.includes(clause)) {
      setClausulas(clausulas.filter(c => c !== clause));
    } else {
      setClausulas([...clausulas, clause]);
    }
  };

  const propostaOrigem = propostas.find((p) => p.id === propostaOrigemId);

  const currentContractObj: Contrato = {
    // Sem id: a API entende como contrato novo e o banco gera o número.
    id: '',
    numero: '',
    leadId: propostaOrigem?.leadId ?? '',
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
            {propostaOrigem
              ? `Gerado a partir da proposta nº ${propostaOrigem.numero} · ${propostaOrigem.clienteNome}`
              : 'Novo contrato · número gerado ao emitir'}
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

              {/* Escolher a proposta preenche cliente, sistema e condições. */}
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1 text-xs">
                  GERAR A PARTIR DA PROPOSTA
                </label>
                <select
                  value={propostaOrigemId}
                  onChange={(e) => setPropostaOrigemId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                >
                  <option value="">Nenhuma — preencher manualmente</option>
                  {propostas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero} · {p.clienteNome} · {p.potenciaKwp} kWp
                    </option>
                  ))}
                </select>
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
            
            {/* Resumo do contrato em edição */}
            <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-xl space-y-4">
              <span className="text-[10px] font-bold text-[#FFD100] uppercase tracking-widest block">
                CONTRATO A EMITIR
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
                {clausulasDisponiveis.length === 0 && (
                  <p className="text-slate-400 italic">
                    Nenhuma cláusula cadastrada. Configure em SolarCosta_ClausulasPadrao.
                  </p>
                )}
                {clausulasDisponiveis.map(({ titulo }) => (
                  <label key={titulo} className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={clausulas.includes(titulo)}
                      onChange={() => toggleClausula(titulo)}
                      className="mt-0.5 rounded text-[#004276] focus:ring-[#004276]"
                    />
                    <span>{titulo}</span>
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
