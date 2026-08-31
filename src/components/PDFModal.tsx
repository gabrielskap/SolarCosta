import React, { useState } from 'react';
import { 
  X, Printer, Download, CheckCircle2, ChevronLeft, ChevronRight, Award, DollarSign,
  TrendingUp, Zap, Calendar, ShieldCheck, Phone, Mail, MapPin, SlidersHorizontal, Image as ImageIcon,
  Upload, FileText, Check, RotateCcw, Sparkles, Layers, Eye, EyeOff, Palette, MessageSquare, User
} from 'lucide-react';
import { Proposta, Contrato, Boleto } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import logoFull from '../assets/logo-full.png';
import logoIcon from '../assets/logo-icon.png';

interface PDFModalProps {
  type: 'proposta' | 'contrato' | 'boleto';
  data: Proposta | Contrato | Boleto | null;
  onClose: () => void;
}

export const PDFModal: React.FC<PDFModalProps> = ({ type, data, onClose }) => {
  const [activePage, setActivePage] = useState<number>(0); // 0 = all pages, 1..8 = page 1..8
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);

  // Default observations and parameters if proposal
  const prop = type === 'proposta' ? (data as Proposta) : null;

  const defaultObservacoes = prop?.observacoes || 
    `📍 Validade da proposta: 10 dias corridos a partir da data de emissão.\n⚡ Incluso projeto elétrico, ART, instalação e homologação técnica na CEMIG.\n🏠 Estrutura de fixação para telhado colonial/laje com certificação de resistência aos ventos.\n💳 Condição especial: 5% de desconto adicional para pagamento à vista via PIX/Transferência.`;

  // Customization States
  const [logoStyle, setLogoStyle] = useState<'standard' | 'dark' | 'minimal' | 'custom'>('standard');
  const [customLogoUrl, setCustomLogoUrl] = useState<string>(prop?.customLogoUrl || '');
  const [showLogo, setShowLogo] = useState<boolean>(true);

  const [observacoesEspecificas, setObservacoesEspecificas] = useState<string>(defaultObservacoes);

  const [consultorNome, setConsultorNome] = useState<string>('Giselle Alonso');
  const [consultorCargo, setConsultorCargo] = useState<string>('Consultora Especialista em Soluções Fotovoltaicas');
  const [consultorTelefone, setConsultorTelefone] = useState<string>('(31) 98658-8456');
  const [consultorEmail, setConsultorEmail] = useState<string>('solarcostamg@gmail.com');

  const [themeColor, setThemeColor] = useState<'blue' | 'emerald' | 'amber' | 'slate'>('blue');

  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomLogoUrl(reader.result as string);
        setLogoStyle('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const observationPresets = [
    { label: '📌 Validade 10 dias', text: '📍 Proposta comercial válida por 10 dias corridos a partir desta data.' },
    { label: '⚡ Homologação CEMIG', text: '⚡ Incluso elaboração do projeto elétrico, emissão de ART/CREA e trâmite completo de homologação na CEMIG.' },
    { label: '🏠 Telhado Colonial', text: '🏠 Estrutura de fixação em alumínio anodizado e aço inox própria para telhado colonial.' },
    { label: '💳 Desconto PIX 5%', text: '💳 Desconto especial de 5% concedido para pagamento à vista via PIX ou Transferência Bancária.' },
    { label: '📱 Monitoramento App', text: '📱 Inversor/Microinversor com conectividade Wi-Fi para acompanhamento da geração em tempo real via celular.' },
    { label: '🛡️ Garantias Oficiais', text: '🛡️ 25 anos de garantia de eficiência dos módulos, 12 anos para inversores e 1 ano para os serviços de instalação.' }
  ];

  const handleAddPreset = (textToAdd: string) => {
    if (observacoesEspecificas.includes(textToAdd)) return;
    setObservacoesEspecificas(prev => prev ? `${prev}\n${textToAdd}` : textToAdd);
  };

  // Helper to render Logo dynamically
  const renderLogo = () => {
    if (!showLogo) return null;

    if (logoStyle === 'custom' && customLogoUrl) {
      return (
        <div className="flex items-center gap-3">
          <img 
            src={customLogoUrl} 
            alt="Logo Solar Costa Customizada" 
            className="h-12 max-w-[200px] object-contain rounded" 
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="hidden sm:block">
            <span className="font-black text-lg text-[#004276] tracking-wider block leading-none">SOLAR COSTA</span>
            <span className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">ENERGIA SOLAR</span>
          </div>
        </div>
      );
    }

    if (logoStyle === 'dark') {
      return (
        <div className="flex items-center gap-3 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-sm">
          <img src={logoIcon} alt="Solar Costa" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="font-black text-lg tracking-wider text-[#FFD100] leading-none">SOLAR COSTA</h1>
            <p className="text-[10px] font-bold text-slate-300 tracking-widest mt-0.5 uppercase">SOLUÇÕES ENERGÉTICAS</p>
          </div>
        </div>
      );
    }

    if (logoStyle === 'minimal') {
      return (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border-2 border-slate-900 flex items-center justify-center bg-white">
            <img src={logoIcon} alt="Solar Costa" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight text-slate-900 leading-none">SOLAR COSTA</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ENERGIA FOTOVOLTAICA</p>
          </div>
        </div>
      );
    }

    // Standard Solar Costa Yellow & Blue Logo
    return (
      <div className="flex items-center gap-3">
        <img src={logoFull} alt="Solar Costa" className="h-12 w-auto" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* TOP BAR CONTROLS (Hidden during print) */}
        <div className="no-print bg-[#004276] text-white px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 border-b border-blue-900">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="Solar Costa" className="w-8 h-8 object-contain shrink-0" />
            <div>
              <span className="bg-[#FFD100] text-[#004276] font-black px-2 py-0.5 rounded text-[10px] uppercase tracking-wider inline-block">
                Documento Oficial PDF
              </span>
              <h3 className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                {type === 'proposta' && `Proposta Comercial Solar nº ${(data as Proposta).numero || '2026-0184'}`}
                {type === 'contrato' && `Contrato de Prestação nº ${(data as Contrato).numero || '2026-0184'}`}
                {type === 'boleto' && `Boleto Bancário nº ${(data as Boleto).parcela}`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            {type === 'proposta' && (
              <>
                <button
                  onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isCustomizeOpen 
                      ? 'bg-[#FFD100] text-[#004276] shadow-md ring-2 ring-amber-300' 
                      : 'bg-blue-900/90 hover:bg-blue-800 text-white border border-blue-700/80'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>Customizar Layout PDF</span>
                </button>

                <div className="flex items-center bg-blue-950/80 rounded-lg p-1 border border-blue-800/80 text-xs font-semibold">
                  <button
                    onClick={() => setActivePage(0)}
                    className={`px-2.5 py-1 rounded transition ${activePage === 0 ? 'bg-[#FFD100] text-[#004276] font-bold' : 'text-slate-300 hover:text-white'}`}
                  >
                    Todas (8 Págs)
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                    <button
                      key={p}
                      onClick={() => setActivePage(p)}
                      className={`w-7 h-7 rounded flex items-center justify-center transition ${activePage === p ? 'bg-[#FFD100] text-[#004276] font-extrabold' : 'text-slate-300 hover:text-white'}`}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-[#FFD100] hover:bg-amber-300 text-[#004276] px-3.5 py-1.5 rounded-lg text-xs font-black shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1.5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA (PDF View + Customization Panel) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* MAIN DOCUMENT VIEWPORT */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-200/80 print:bg-white print:p-0">
            
            {/* PROPOSTA DE ORÇAMENTO COMPLETA (8 PÁGINAS) */}
            {type === 'proposta' && (() => {
              const consumo = prop?.consumoKwh || 1000;
              const tarifa = prop?.tarifaKwh || 1.19;
              const potencia = prop?.potenciaKwp || 8.52;
              const valorInvestimento = prop?.valorTotal || 22490;
              const parcelas12 = Number((valorInvestimento / 12 * 1.14).toFixed(2));

              // Perfil mensal de geração.
              //
              // Os fatores abaixo são a sazonalidade da região (1,0 = média
              // anual) e espelham a tabela SolarCosta_PerfilGeracaoMensal.
              // A geração de cada mês é a média MENSAL DESTE SISTEMA vezes o
              // fator do mês — antes eram valores absolutos fixos (~1.000 kWh),
              // o que fazia o gráfico de um sistema de 27 kWp mostrar a mesma
              // geração de um de 8 kWp, contradizendo a cobertura da proposta.
              const FATOR_SAZONAL: [string, number][] = [
                ['JANEIRO', 1.03713], ['FEVEREIRO', 1.03713], ['MARÇO', 1.03713],
                ['ABRIL', 1.03713],   ['MAIO', 1.01793],      ['JUNHO', 0.99488],
                ['JULHO', 0.94110],   ['AGOSTO', 0.94110],    ['SETEMBRO', 0.94110],
                ['OUTUBRO', 1.01793], ['NOVEMBRO', 0.99872],  ['DEZEMBRO', 0.99872],
              ];

              const geracaoMediaMensal = prop?.geracaoMediaKwh || consumo;

              const monthlyData = FATOR_SAZONAL.map(([mes, fator]) => ({
                mes,
                geracao: Number((geracaoMediaMensal * fator).toFixed(2)),
                consumo: consumo,
              }));

              // 25 Years Expenses without solar
              const projection25Years = [];
              let currentTariff = tarifa;
              let currentMonthlyCost = (consumo * currentTariff) + 33.73;
              let accumulatedNoSolar = 0;

              for (let yr = 2026; yr <= 2050; yr++) {
                const annualNoSolar = currentMonthlyCost * 12;
                accumulatedNoSolar += annualNoSolar;

                const yearDegradation = Math.pow(0.993, yr - 2026);
                const geracaoAnoKwh = Math.round(11012 * yearDegradation);
                const geracaoValorRs = Math.round(geracaoAnoKwh * currentTariff);
                const custoManutencaoAno = (yr === 2040) ? 3000 : Math.round(200 * Math.pow(1.05, yr - 2026));
                
                const economiaAno = geracaoValorRs - custoManutencaoAno;
                const acumuladoSemPoup = Math.round((yr === 2026 ? -valorInvestimento : 0) + (economiaAno * (yr - 2025)));
                const acumuladoComPoup = Math.round(acumuladoSemPoup * 1.003);

                projection25Years.push({
                  ano: yr,
                  txKwh: Number(currentTariff.toFixed(2)),
                  valorMensal: Number(currentMonthlyCost.toFixed(2)),
                  valorAnual: Number(annualNoSolar.toFixed(2)),
                  geracaoKwh: geracaoAnoKwh,
                  geracaoValorRs,
                  custos: custoManutencaoAno,
                  acumuladoSemPoup,
                  acumuladoComPoup
                });

                currentTariff *= 1.06;
                currentMonthlyCost = (consumo * currentTariff) + 33.73;
              }

              // Reusable Page Shell Component
              const PageWrapper = ({ pageNum, title, children }: { pageNum: number; title?: string; children: React.ReactNode }) => {
                if (activePage !== 0 && activePage !== pageNum) return null;
                return (
                  <div className="bg-white text-slate-900 rounded-none shadow-xl print:shadow-none p-6 sm:p-10 mb-8 last:mb-0 border border-slate-200 print:border-none max-w-4xl mx-auto flex flex-col justify-between min-h-[1050px] relative overflow-hidden print:min-h-screen print:p-8 print:break-after-page">
                    
                    {/* Top Solar Costa Header Banner */}
                    <div className="border-b-2 border-[#004276] pb-4 mb-6 flex items-center justify-between">
                      {renderLogo()}
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-[#004276] px-2.5 py-1 rounded">
                          PÁGINA {pageNum} DE 8
                        </span>
                        {title && <p className="text-xs font-bold text-slate-500 mt-1">{title}</p>}
                      </div>
                    </div>

                    {/* Page Body Content */}
                    <div className="flex-1 space-y-6">
                      {children}
                    </div>

                    {/* Page Footer */}
                    <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                      <p>Rua Alzira Maria Ferreira, 241 – Santa Mônica - Belo Horizonte/MG - CEP 31.530-150</p>
                      <p>Telefone: {consultorTelefone} • E-mail: {consultorEmail}</p>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-8">
                  
                  {/* PÁGINA 1: CAPA E RESUMO TÉCNICO */}
                  <PageWrapper pageNum={1} title="Apresentação & Dimensionamento">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="md:col-span-2 space-y-3">
                          <h2 className="text-xl sm:text-2xl font-black text-[#004276] leading-tight">
                            Proposta Técnica e Comercial para Fornecimento de Sistema Solar Fotovoltaico Conectado à Rede Elétrica
                          </h2>
                          <div className="text-xs font-bold text-slate-600 space-y-0.5 pt-1">
                            <p>Belo Horizonte, 30 de Julho de 2026</p>
                            <p className="text-[#004276]">Att: {prop?.clienteNome || 'Cristiano'} — {prop?.cidade || 'Belo Horizonte / BH'}</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-[#004276] to-blue-900 text-white p-4 rounded-2xl shadow-md border border-blue-800 text-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-[#FFD100] mx-auto flex items-center justify-center">
                            <Zap className="w-6 h-6 text-[#004276]" />
                          </div>
                          <h3 className="text-sm font-extrabold text-[#FFD100]">SOLAR COSTA ENERGIA</h3>
                          <p className="text-[11px] text-slate-200">Geração Limpa & Economia Sustentável</p>
                        </div>
                      </div>

                      {/* Mission Intro Text */}
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-3">
                        <p>
                          A <strong>Solar Costa</strong> é uma empresa com foco exclusivo em energia solar fotovoltaica. Escolhemos trabalhar nesse setor por verificarmos o aumento da demanda por sistemas e a busca por autonomia energética.
                        </p>
                        <p>
                          A Solar Costa escolheu um <strong>PROPÓSITO</strong> em que todos os colaboradores e parceiros acreditassem. Buscamos entender o que nos motiva a trabalhar pelo crescimento da energia solar fotovoltaica no Brasil e no Mundo.
                        </p>
                        <p>
                          Acreditamos que podemos dar <strong>Poder de Decisão</strong> aos nossos clientes, tornando-os cada vez menos dependentes de um modelo tarifário ultrapassado em que não haviam opções.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-extrabold text-[#004276] text-sm uppercase tracking-wider mb-2 border-l-4 border-[#FFD100] pl-3">
                          SISTEMA SOLAR CONECTADO À REDE (SFCR)
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          O dimensionamento do sistema fotovoltaico no empreendimento foi feito conforme os dados fornecidos à Solar Costa, levando-se em consideração o perfil de consumo energético e a radiação local.
                        </p>
                      </div>

                      {/* BIG HIGHLIGHTS BANNER */}
                      <div className="bg-slate-100 border-2 border-[#004276] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center shadow-sm">
                        <div className="space-y-3 md:col-span-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-amber-600 text-sm">Potência:</span>
                            <span className="text-2xl font-black text-[#004276]">{potencia} kWp</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-amber-600 text-sm">Área do Sistema Estimada:</span>
                            <span className="text-xl font-extrabold text-slate-900">{prop?.areaEstimadaM2 || 70} m²</span>
                          </div>
                          <div className="flex items-center gap-3 pt-2 border-t border-slate-300">
                            <span className="font-bold text-amber-600 text-sm">Valor do Investimento:</span>
                            <div>
                              <span className="text-2xl font-black text-emerald-700">R$ {valorInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <span className="text-xs font-bold text-slate-600 ml-2">à vista</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#004276] text-white p-5 rounded-xl text-center space-y-2 border border-blue-900">
                          <span className="text-[11px] font-bold text-[#FFD100] uppercase tracking-wider block">OPÇÃO PARCELADA</span>
                          <h4 className="text-2xl font-black text-[#FFD100]">12x R$ {parcelas12.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                          <p className="text-[10px] text-slate-300">Entrada facilitada ou cartão de crédito</p>
                        </div>
                      </div>

                      {/* OBSERVAÇÕES ESPECÍFICAS DA PROPOSTA (SE PREENCHIDO) */}
                      {observacoesEspecificas.trim() && (
                        <div className="bg-[#004276]/5 border-l-4 border-amber-500 p-4 rounded-r-2xl space-y-1.5 my-4 border border-slate-200">
                          <div className="flex items-center gap-2 text-[#004276]">
                            <FileText className="w-4 h-4 text-amber-600" />
                            <h4 className="font-extrabold text-xs uppercase tracking-wider">
                              OBSERVAÇÕES ESPECÍFICAS & CONDIÇÕES PARTICULARES DO PROJETO
                            </h4>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium">
                            {observacoesEspecificas}
                          </p>
                        </div>
                      )}
                    </div>
                  </PageWrapper>

                  {/* PÁGINA 2: VANTAGENS */}
                  <PageWrapper pageNum={2} title="Vantagens do Sistema Proposto">
                    <div className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-[#004276] uppercase tracking-wider">VANTAGENS</h2>
                        <p className="text-xs font-bold text-slate-600 max-w-xl mx-auto">
                          Estima-se que o sistema solar fotovoltaico proposto neste relatório é capaz de gerar em sua cidade uma média de:
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                        <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-lg border border-blue-900 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                          <div className="w-12 h-12 rounded-full bg-blue-900/80 border border-[#FFD100] flex items-center justify-center text-[#FFD100]">
                            <Zap className="w-7 h-7" />
                          </div>
                          <h3 className="text-3xl font-black text-white">1011 KW</h3>
                          <p className="text-xs font-bold text-[#FFD100] uppercase tracking-wider">
                            POR MÊS DE GERAÇÃO
                          </p>
                        </div>

                        <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-lg border border-blue-900 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                          <div className="w-12 h-12 rounded-full bg-blue-900/80 border border-emerald-400 flex items-center justify-center text-emerald-400">
                            <DollarSign className="w-7 h-7" />
                          </div>
                          <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">ECONOMIA:</h3>
                          <p className="text-2xl font-black text-white">R$ 1.203,60 POR MÊS</p>
                        </div>

                        <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-lg border border-blue-900 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                          <div className="w-12 h-12 rounded-full bg-blue-900/80 border border-blue-300 flex items-center justify-center text-blue-300">
                            <TrendingUp className="w-7 h-7" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-300 uppercase">EQUIVALENTE A</h3>
                          <p className="text-3xl font-black text-[#FFD100]">101,14%</p>
                          <p className="text-xs font-extrabold text-slate-200">DA MÉDIA MENSAL DE 1.000 KW</p>
                        </div>

                        <div className="bg-[#004276] text-white p-6 rounded-2xl shadow-lg border border-blue-900 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                          <div className="w-12 h-12 rounded-full bg-blue-900/80 border border-amber-400 flex items-center justify-center text-amber-400">
                            <Calendar className="w-7 h-7" />
                          </div>
                          <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">RETORNO DO INVESTIMENTO</h3>
                          <p className="text-2xl font-black text-white">EM ATÉ 2 ANOS</p>
                        </div>
                      </div>
                    </div>
                  </PageWrapper>

                  {/* PÁGINA 3: PRODUÇÃO ESTIMADA */}
                  <PageWrapper pageNum={3} title="Produção Mensal & Irradiação">
                    <div className="space-y-6">
                      <h2 className="text-xl font-extrabold text-[#004276] uppercase border-l-4 border-[#FFD100] pl-3">
                        PRODUÇÃO ESTIMADA DO SISTEMA
                      </h2>

                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <h4 className="text-xs font-bold text-slate-600 mb-3 text-center">
                          Geração Estimada (kWh) vs Consumo Atual Mensal (kWh)
                        </h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={45} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value: any) => [`${value} kWh`, '']} />
                              <Legend wrapperStyle={{ fontSize: '11px', pt: '10px' }} />
                              <Bar dataKey="geracao" name="Geração (kWh)" fill="#004276" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="consumo" name="Consumo (kWh)" fill="#f97316" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-center text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-[#004276] text-white font-bold">
                              <th className="p-2 text-left">Mês</th>
                              {monthlyData.map(m => (
                                <th key={m.mes} className="p-1 border-r border-blue-800">{m.mes.slice(0, 3)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                            <tr className="bg-blue-50/60">
                              <td className="p-2 font-bold text-[#004276] text-left">Geração (kWh)</td>
                              {monthlyData.map((m, idx) => (
                                <td key={idx} className="p-1 border-r border-slate-200">{m.geracao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                              ))}
                            </tr>
                            <tr className="bg-amber-50/60">
                              <td className="p-2 font-bold text-amber-800 text-left">Consumo (kWh)</td>
                              {monthlyData.map((m, idx) => (
                                <td key={idx} className="p-1 border-r border-slate-200">{m.consumo}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </PageWrapper>

                  {/* PÁGINA 4: EQUIPAMENTOS E CONDIÇÕES */}
                  <PageWrapper pageNum={4} title="Lista de Equipamentos e Serviços">
                    <div className="space-y-6">
                      <h2 className="text-xl font-extrabold text-[#004276] uppercase border-l-4 border-[#FFD100] pl-3">
                        Descrição dos Equipamentos
                      </h2>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[#004276] text-white font-bold">
                              <th className="p-3">Descrição</th>
                              <th className="p-3 text-center w-28">Quantidade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium text-slate-900">
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">PAINEL TLC tier 1 710 w</td>
                              <td className="p-3 text-center font-bold">12</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">Micro inversor Solax</td>
                              <td className="p-3 text-center font-bold">3</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">Estrutura laje</td>
                              <td className="p-3 text-center font-bold">1</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">Área sistema</td>
                              <td className="p-3 text-center font-bold">70,00 m²</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">Material, cabos e conexões</td>
                              <td className="p-3 text-center font-bold">1</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3">Instalação, projeto e Homologação do SFCR</td>
                              <td className="p-3 text-center font-bold">1</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>CREA RESPONSÁVEL: MG00000023481D MG Thiago Gonçalves Leal</span>
                      </div>
                    </div>
                  </PageWrapper>

                  {/* PÁGINA 8: GARANTIAS E CONTATOS DO CONSULTOR */}
                  <PageWrapper pageNum={8} title="Garantias & Contatos do Consultor">
                    <div className="space-y-6">
                      <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-[#004276] uppercase tracking-wider">CONDIÇÕES GERAIS</h2>
                        <p className="text-lg font-black text-amber-600 uppercase">GARANTIAS OFICIAIS</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50 border-2 border-[#004276] p-4 rounded-2xl text-center flex flex-col justify-between space-y-2">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-[#004276] mx-auto flex items-center justify-center font-black">
                            <Zap className="w-5 h-5" />
                          </div>
                          <h4 className="font-extrabold text-[#004276] text-xs uppercase">MÓDULOS</h4>
                          <p className="text-[10px] font-bold text-slate-700 leading-tight">
                            25 ANOS DE PERFORMANCE
                          </p>
                        </div>

                        <div className="bg-slate-50 border-2 border-[#004276] p-4 rounded-2xl text-center flex flex-col justify-between space-y-2">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 mx-auto flex items-center justify-center font-black">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="font-extrabold text-[#004276] text-xs uppercase">INVERSORES</h4>
                          <div className="py-2">
                            <span className="text-2xl font-black text-[#004276]">12</span>
                            <span className="block text-[11px] font-bold text-slate-700">ANOS</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 border-2 border-[#004276] p-4 rounded-2xl text-center flex flex-col justify-between space-y-2">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center font-black">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <h4 className="font-extrabold text-[#004276] text-xs uppercase">INSTALAÇÃO</h4>
                          <div className="py-2">
                            <span className="text-2xl font-black text-[#004276]">1</span>
                            <span className="block text-[11px] font-bold text-slate-700">ANO</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 border-2 border-[#004276] p-4 rounded-2xl text-center flex flex-col justify-between space-y-2">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-[#004276] mx-auto flex items-center justify-center font-black">
                            <Award className="w-5 h-5" />
                          </div>
                          <h4 className="font-extrabold text-[#004276] text-xs uppercase">ESTRUTURA</h4>
                          <div className="py-2">
                            <span className="text-2xl font-black text-[#004276]">10</span>
                            <span className="block text-[11px] font-bold text-slate-700">ANOS</span>
                          </div>
                        </div>
                      </div>

                      {/* OBSERVAÇÕES ESPECÍFICAS DA PROPOSTA EM DESTAQUE */}
                      {observacoesEspecificas.trim() && (
                        <div className="bg-amber-50/80 border-2 border-amber-300 p-5 rounded-2xl space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-amber-950 font-black uppercase tracking-wider text-xs border-b border-amber-200 pb-2">
                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                            <span>OBSERVAÇÕES E TERMOS PARTICULARES DA PROPOSTA</span>
                          </div>
                          <p className="text-amber-900 font-medium whitespace-pre-line leading-relaxed">
                            {observacoesEspecificas}
                          </p>
                        </div>
                      )}

                      {/* CONTACT CONSULTANT CARD */}
                      <div className="bg-[#004276] text-white p-6 rounded-2xl border border-blue-900 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 mt-8">
                        <div>
                          <span className="text-[10px] font-bold text-[#FFD100] uppercase tracking-widest block">CONTATO DO CONSULTOR</span>
                          <h3 className="text-2xl font-black text-white mt-1">{consultorNome}</h3>
                          <p className="text-xs text-slate-200 mt-0.5">{consultorCargo}</p>
                        </div>

                        <div className="space-y-2 text-xs font-bold bg-blue-900/80 p-4 rounded-xl border border-blue-800 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[#FFD100]" />
                            <span>{consultorTelefone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-[#FFD100]" />
                            <span>{consultorEmail}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>Belo Horizonte / MG</span>
                          </div>
                        </div>
                      </div>

                      {/* SIGNATURE SECTION */}
                      <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                        <div className="border-t border-slate-400 pt-2">
                          <p className="font-bold text-slate-900">SOLAR COSTA ENERGIA SOLAR</p>
                          <p className="text-slate-500">Engenharia & Comercial</p>
                        </div>
                        <div className="border-t border-slate-400 pt-2">
                          <p className="font-bold text-slate-900">{prop?.clienteNome}</p>
                          <p className="text-slate-500">Aceite da Proposta Comercial</p>
                        </div>
                      </div>

                    </div>
                  </PageWrapper>

                </div>
              );
            })()}

            {/* CONTRATO DE PRESTAÇÃO DE SERVIÇOS VIEW */}
            {type === 'contrato' && (() => {
              const cont = data as Contrato;
              return (
                <div className="bg-white rounded-2xl shadow-xl print:shadow-none p-8 max-w-3xl mx-auto border border-slate-200 space-y-6 text-slate-800 text-xs leading-relaxed">
                  <div className="text-center border-b pb-4">
                    <h2 className="font-extrabold text-xl text-[#004276] uppercase">
                      CONTRATO DE FORNECIMENTO E INSTALAÇÃO DE SISTEMA FOTOVOLTAICO
                    </h2>
                    <p className="font-bold text-slate-600">CONTRATO Nº {cont.numero}</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#004276] mb-1">1. DAS PARTES</h3>
                    <p className="text-justify">
                      <strong>CONTRATADA:</strong> SOLAR COSTA ENERGIA SOLAR LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 42.890.112/0001-90, com sede na Rua Alzira Maria Ferreira, 241 – Santa Mônica, Belo Horizonte/MG.
                    </p>
                    <p className="text-justify mt-1">
                      <strong>CONTRATANTE:</strong> <strong>{cont.clienteNome}</strong>, inscrito no CPF/CNPJ sob o nº {cont.cpfCnpj}, RG/IE nº {cont.rgInscricao}, residente e domiciliado na {cont.endereco}, CEP {cont.cep}, telefone {cont.telefone}.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#004276] mb-1">2. DO OBJETO DO CONTRATO</h3>
                    <p className="text-justify">
                      O presente contrato tem por objeto o fornecimento, projeto, instalação e homologação de um Sistema Gerador Fotovoltaico com potência nominal de <strong>{cont.potenciaKwp} kWp</strong>, composto por <strong>{cont.modulosQtd} módulos fotovoltaicos {cont.moduloModelo}</strong>, inversor(es) <strong>{cont.inversorModelo}</strong> e estrutura de fixação do tipo <strong>{cont.estrutura}</strong>, no local indicado: {cont.localInstalacao}.
                    </p>
                  </div>

                  <div className="pt-8 grid grid-cols-2 gap-8 text-center">
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-bold text-slate-900">SOLAR COSTA ENERGIA SOLAR</p>
                      <p className="text-slate-500">Contratada</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-bold text-slate-900">{cont.clienteNome}</p>
                      <p className="text-slate-500">Contratante</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* BOLETO BANCO DO BRASIL VIEW */}
            {type === 'boleto' && (() => {
              const bol = data as Boleto;
              return (
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl mx-auto border-2 border-slate-800 space-y-4 font-mono text-xs text-slate-900">
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-[#FFD100] text-[#004276] font-black px-2 py-1 text-sm border border-slate-800">
                        BANCO DO BRASIL
                      </div>
                      <span className="font-bold text-base px-2 border-r-2 border-l-2 border-slate-800">
                        001-9
                      </span>
                    </div>
                    <div className="font-bold text-sm tracking-widest text-right">
                      {bol.linhaDigitavel}
                    </div>
                  </div>

                  <div className="border-b border-slate-400 pb-2 text-[11px]">
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Pagador</span>
                    <strong>{bol.clienteNome}</strong> {bol.cpfCnpj && `- CPF/CNPJ: ${bol.cpfCnpj}`}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* CUSTOMIZATION DRAWER / SIDEBAR (no-print) */}
          {isCustomizeOpen && type === 'proposta' && (
            <div className="no-print w-full md:w-96 bg-slate-900 text-slate-100 border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between shrink-0 shadow-2xl z-20">
              <div className="space-y-6">
                
                {/* Drawer Title & Close */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-[#FFD100]">
                    <SlidersHorizontal className="w-5 h-5" />
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">Customizar Layout PDF</h3>
                  </div>
                  <button
                    onClick={() => setIsCustomizeOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* SECTION 1: LOGO E CABEÇALHO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      Logo da Solar Costa
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="rounded accent-amber-400"
                      />
                      Exibir no PDF
                    </label>
                  </div>

                  {showLogo && (
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setLogoStyle('standard')}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition ${logoStyle === 'standard' ? 'bg-[#FFD100] text-[#004276]' : 'text-slate-300 hover:text-white'}`}
                        >
                          ☀️ Padrão
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoStyle('dark')}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition ${logoStyle === 'dark' ? 'bg-[#FFD100] text-[#004276]' : 'text-slate-300 hover:text-white'}`}
                        >
                          🌙 Escura
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoStyle('minimal')}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition ${logoStyle === 'minimal' ? 'bg-[#FFD100] text-[#004276]' : 'text-slate-300 hover:text-white'}`}
                        >
                          📄 Minimalista
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoStyle('custom')}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition ${logoStyle === 'custom' ? 'bg-[#FFD100] text-[#004276]' : 'text-slate-300 hover:text-white'}`}
                        >
                          🖼️ Customizada
                        </button>
                      </div>

                      {logoStyle === 'custom' && (
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Upload de Imagem da Logo</label>
                            <label className="flex items-center justify-center gap-2 p-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-amber-400 cursor-pointer border border-dashed border-slate-500 transition">
                              <Upload className="w-4 h-4" />
                              <span>Carregar Arquivo de Imagem</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ou Cole a URL da Imagem</label>
                            <input
                              type="url"
                              value={customLogoUrl}
                              onChange={(e) => setCustomLogoUrl(e.target.value)}
                              placeholder="https://exemplo.com/logo-solar-costa.png"
                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 2: OBSERVAÇÕES ESPECÍFICAS DA PROPOSTA */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    Observações Específicas do PDF
                  </label>
                  
                  <textarea
                    rows={5}
                    value={observacoesEspecificas}
                    onChange={(e) => setObservacoesEspecificas(e.target.value)}
                    placeholder="Escreva observações especiais, condições comerciais e notas para o cliente..."
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 leading-relaxed focus:outline-none focus:border-amber-400"
                  />

                  {/* Quick Cláusulas / Presets */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Inserir Cláusulas Rápidas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {observationPresets.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddPreset(p.text)}
                          className="text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-2 py-1 rounded-lg transition"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION 3: DADOS DO CONSULTOR */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <User className="w-4 h-4 text-amber-400" />
                    Dados do Consultor Comercial
                  </label>
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      value={consultorNome}
                      onChange={(e) => setConsultorNome(e.target.value)}
                      placeholder="Nome do consultor"
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                    <input
                      type="text"
                      value={consultorCargo}
                      onChange={(e) => setConsultorCargo(e.target.value)}
                      placeholder="Cargo / Especialidade"
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={consultorTelefone}
                        onChange={(e) => setConsultorTelefone(e.target.value)}
                        placeholder="Telefone"
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
                      />
                      <input
                        type="email"
                        value={consultorEmail}
                        onChange={(e) => setConsultorEmail(e.target.value)}
                        placeholder="E-mail"
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-6 border-t border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setLogoStyle('standard');
                    setShowLogo(true);
                    setObservacoesEspecificas(defaultObservacoes);
                    setThemeColor('blue');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomizeOpen(false)}
                  className="w-full py-2.5 bg-[#FFD100] hover:bg-amber-300 text-[#004276] rounded-xl text-xs font-black shadow transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Aplicar & Fechar Painel</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
