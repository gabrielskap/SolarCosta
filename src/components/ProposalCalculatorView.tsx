import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Calculator, Check, FileText, Download, Sparkles, Loader2, MapPinned, ArrowLeft } from 'lucide-react';
import { Proposta, PropostaItem, Produto, Lead, User } from '../types';
import { maskCPFCNPJ, maskPhone, maskCEP, onlyDigits, docLabel, isValidCPFCNPJ } from '../utils/format';
import {
  fetchAddressByCep,
  buildEnderecoLine,
  buildEnderecoBusca,
  buildCidadeUf,
  type EnderecoViaCEP,
} from '../services/cep';
import { paramNum, type ConfigApp } from '../services/api';
import { dimensionar, projetarEconomia, parcelaFinanciamento } from '../utils/solar';
import {
  PainelTelhado,
  type CoordenadaConhecida,
  type DadosTelhadoProposta,
} from './mapa/PainelTelhado';

interface ProposalCalculatorViewProps {
  propostas: Proposta[];
  produtos: Produto[];
  leads: Lead[];
  currentLeadId?: string;
  /**
   * Rascunho sendo retomado ("continuar preenchendo").
   *
   * Presente, muda duas coisas: o formulário nasce com o que já foi gravado em
   * vez dos padrões, e o salvamento ATUALIZA a proposta (PUT) em vez de criar
   * outra — é o id carregado aqui que o Api.saveProposta usa para decidir.
   */
  propostaExistente?: Proposta;
  /** Parâmetros e domínios vindos do banco (substituem os antigos literais). */
  config: ConfigApp | null;
  onSaveProposal: (proposta: Proposta) => void;
  onOpenPDF: (type: 'proposta' | 'contrato' | 'boleto', data: any) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  /** Quando presente, exibe um link de retorno para a listagem de propostas. */
  onBack?: () => void;
}

/** Rótulos dos passos do formulário no celular; a ordem espelha os selos 1-5 das seções. */
const PASSOS = ['Cliente', 'Sistema', 'Kit', 'Pagamento', 'Observações'] as const;

/**
 * Remonta o bloco do telhado a partir da proposta gravada.
 *
 * Sem isto, retomar um rascunho e salvar de novo APAGARIA o layout: o
 * PainelTelhado só emite resultado depois de uma busca, e o
 * `...(dadosTelhado ?? {})` do montarProposta iria vazio para o banco.
 *
 * Os `??` cobrem proposta antiga, gravada antes de alguma das colunas existir
 * — o que importa é latitude/longitude, sem elas não há telhado nenhum.
 */
function telhadoDaProposta(p?: Proposta): DadosTelhadoProposta | null {
  if (!p || p.latitude == null || p.longitude == null) return null;
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    placeId: p.placeId ?? '',
    enderecoFormatado: p.enderecoFormatado ?? '',
    edificacaoId: p.edificacaoId ?? '',
    mapaZoom: p.mapaZoom ?? 0,
    telhadoImagemData: p.telhadoImagemData,
    telhadoAreaM2: p.telhadoAreaM2 ?? 0,
    layoutModulos: p.layoutModulos ?? [],
    layoutSegmentos: p.layoutSegmentos ?? [],
    layoutAjusteManual: p.layoutAjusteManual ?? false,
    layoutModulo: p.layoutModulo,
  };
}

export const ProposalCalculatorView: React.FC<ProposalCalculatorViewProps> = ({
  propostas,
  produtos,
  leads,
  currentLeadId,
  propostaExistente,
  config,
  onSaveProposal,
  onOpenPDF,
  currentUser,
  showToast,
  onBack
}) => {
  /*
   * Retomando um rascunho.
   *
   * Vale para a montagem inteira: a casca de rota troca de `key` quando a
   * proposta muda, então isto nunca vira de false para true com o formulário
   * já preenchido.
   */
  const editando = !!propostaExistente;

  // Lead vinculado. Sem lead selecionado o formulário nasce em branco — antes
  // ele caía num lead fixo de demonstração ("Cristiano Duarte Almeida").
  const [leadIdSelecionado, setLeadIdSelecionado] = useState(
    propostaExistente?.leadId || currentLeadId || '',
  );
  const linkedLead = leads.find(l => l.id === leadIdSelecionado);

  /*
   * Form states.
   *
   * A ordem do `??` é a regra toda: o que foi GRAVADO na proposta ganha do
   * lead. O consultor pode ter corrigido o telefone ou o endereço depois de
   * copiá-los do cadastro, e reabrir o rascunho não pode desfazer isso —
   * inclusive quando o valor gravado é vazio de propósito.
   */
  const [clienteNome, setClienteNome] = useState(propostaExistente?.clienteNome ?? linkedLead?.nome ?? '');
  const [cpfCnpj, setCpfCnpj] = useState(propostaExistente?.cpfCnpj ?? linkedLead?.cpfCnpj ?? '');
  const [telefone, setTelefone] = useState(propostaExistente?.telefone ?? linkedLead?.telefone ?? '');
  const [email, setEmail] = useState(propostaExistente?.email ?? linkedLead?.email ?? '');
  const [endereco, setEndereco] = useState(propostaExistente?.endereco ?? linkedLead?.endereco ?? '');
  const [cidade, setCidade] = useState(propostaExistente?.cidade ?? linkedLead?.cidade ?? '');
  const [concessionaria, setConcessionaria] = useState(propostaExistente?.concessionaria ?? linkedLead?.concessionaria ?? '');
  const [telhado, setTelhado] = useState(propostaExistente?.telhado ?? linkedLead?.telhado ?? '');
  const [cep, setCep] = useState(propostaExistente?.cep ?? linkedLead?.cep ?? '');

  const [cepLoading, setCepLoading] = useState(false);

  /**
   * Retorno bruto do ViaCEP.
   *
   * Guardado porque o número do imóvel chega DEPOIS: sem ele, acrescentar
   * "512" à linha de endereço exigiria uma segunda consulta ou um parse da
   * string já formatada com "–".
   */
  const [enderecoViaCep, setEnderecoViaCep] = useState<EnderecoViaCEP | null>(null);
  const [numeroEndereco, setNumeroEndereco] = useState(propostaExistente?.numeroEndereco ?? '');

  /**
   * O consultor mexeu na linha do endereço: a partir daí nem o CEP nem o
   * número a reescrevem. Ver um complemento digitado à mão sumir ao informar o
   * número seria a pior surpresa possível nesta tela.
   */
  const [enderecoEditadoAMao, setEnderecoEditadoAMao] = useState(false);

  /** Coordenada já gravada no lead (V005): dispensa o geocoding. */
  const [coordenadaLead, setCoordenadaLead] = useState<CoordenadaConhecida | null>(null);

  /**
   * Alvo da busca automática de telhado.
   *
   * DERIVADO, não estado: assim é impossível ficar defasado em relação a
   * `enderecoViaCep`/`numeroEndereco`, e como é string primitiva serve de
   * dependência estável do efeito lá dentro do PainelTelhado.
   *
   * Nulo quando o CEP não tem logradouro (CEP geral de cidade, tipo
   * 30000-000): esse endereço geocodifica no centro do município, a Solar API
   * responde 404 e as chamadas do Google saem da fatura à toa. Nesses casos o
   * consultor digita o endereço e usa o botão de busca manual.
   */
  const consultaAuto = enderecoViaCep?.logradouro
    ? buildEnderecoBusca(enderecoViaCep, numeroEndereco)
    : null;

  /**
   * Último CEP efetivamente consultado.
   *
   * O onChange dispara a cada tecla e a máscara pode reemitir o mesmo valor;
   * apagar e redigitar o último dígito também refaria a consulta — e agora
   * arrastaria a cadeia paga do Google atrás.
   */
  const ultimoCepConsultado = useRef('');

  // Integração CEP -> endereço (ViaCEP): preenche endereço e cidade/UF.
  const handleCepLookup = async (cepValue: string) => {
    const digitos = onlyDigits(cepValue);
    if (digitos.length !== 8 || digitos === ultimoCepConsultado.current) return;
    ultimoCepConsultado.current = digitos;

    setCepLoading(true);
    const result = await fetchAddressByCep(cepValue);
    setCepLoading(false);
    if (!result.ok || !result.endereco) {
      // Deixa reconsultar: o erro pode ter sido de rede, não do CEP.
      ultimoCepConsultado.current = '';
      showToast('CEP não encontrado', 'error', result.erro || 'Verifique o CEP informado.');
      return;
    }

    setEnderecoViaCep(result.endereco);
    // CEP novo = endereço novo: a linha volta a ser nossa para reescrever.
    setEnderecoEditadoAMao(false);
    // E invalida a coordenada herdada do lead — o imóvel agora é outro.
    setCoordenadaLead(null);

    const linha = buildEnderecoLine(result.endereco, numeroEndereco);
    if (linha) setEndereco(linha);
    const cidadeUf = buildCidadeUf(result.endereco);
    if (cidadeUf) setCidade(cidadeUf);
    showToast('Endereço preenchido', 'success', `${linha || cidadeUf} (via ViaCEP).`);
  };

  /**
   * Número do imóvel: remonta a linha do endereço só enquanto ela for nossa.
   *
   * Depois de uma edição manual o número continua entrando na CONSULTA (é ele
   * que faz o geocoding cair sobre a edificação), mas não na linha da tela.
   */
  const aoDigitarNumero = (valor: string) => {
    const limpo = valor.slice(0, 20);
    setNumeroEndereco(limpo);
    if (enderecoViaCep && !enderecoEditadoAMao) {
      setEndereco(buildEnderecoLine(enderecoViaCep, limpo));
    }
  };

  const cpfInvalido = !!cpfCnpj && !isValidCPFCNPJ(cpfCnpj);

  // Parâmetros de dimensionamento — vêm de SolarCosta_Parametros.
  // Os números abaixo do `??` são só rede de segurança para o caso de a
  // configuração ainda não ter chegado; a fonte da verdade é o banco.
  const [consumoKwh, setConsumoKwh] = useState(propostaExistente?.consumoKwh ?? linkedLead?.consumoKwh ?? 0);
  const [tarifaKwh, setTarifaKwh] = useState(() => propostaExistente?.tarifaKwh ?? paramNum(config, 'proposta.tarifa_kwh_padrao', 1.19));
  const [hsp, setHsp] = useState(() => propostaExistente?.hsp ?? paramNum(config, 'proposta.hsp_padrao', 5.2));
  const [perdasPct, setPerdasPct] = useState(() => propostaExistente?.perdasPct ?? paramNum(config, 'proposta.perdas_pct_padrao', 24.5));
  const [moduloWp, setModuloWp] = useState(() => propostaExistente?.moduloWp ?? paramNum(config, 'proposta.modulo_wp_padrao', 710));

  // Despesas fixas da conta — o que o cliente continua pagando mesmo gerando a
  // própria energia, e que a folha de despesas mensais do PDF imprime.
  // Começam em 0 e são semeadas pela concessionária no efeito mais abaixo.
  const [iluminacaoPublicaSemSfcr, setIluminacaoPublicaSemSfcr] = useState(propostaExistente?.iluminacaoPublicaSemSfcr ?? 0);
  const [custoDisponibilidade, setCustoDisponibilidade] = useState(propostaExistente?.custoDisponibilidade ?? 0);
  const [iluminacaoPublicaComSfcr, setIluminacaoPublicaComSfcr] = useState(propostaExistente?.iluminacaoPublicaComSfcr ?? 0);

  // Kit vazio: o consultor monta a partir do catálogo real. Retomando um
  // rascunho, vem o kit que já estava montado.
  const [kitItens, setKitItens] = useState<PropostaItem[]>(propostaExistente?.kitItens ?? []);

  // Payment Options
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'cartao' | 'financiamento'>(propostaExistente?.formaPagamento ?? 'avista');
  const [descontoAvistaPct, setDescontoAvistaPct] = useState(() => propostaExistente?.descontoAvistaPct ?? paramNum(config, 'proposta.desconto_avista_pct', 7));
  const [parcelasCartao, setParcelasCartao] = useState(() => propostaExistente?.parcelasCartao ?? paramNum(config, 'proposta.parcelas_cartao_padrao', 12));
  const [taxaCartaoPct, setTaxaCartaoPct] = useState(() => propostaExistente?.taxaCartaoPct ?? paramNum(config, 'proposta.taxa_cartao_pct', 4.5));

  const [entradaFinanciamentoPct, setEntradaFinanciamentoPct] = useState(() => propostaExistente?.entradaFinanciamentoPct ?? paramNum(config, 'financiamento.entrada_pct_padrao', 10));
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState(() => propostaExistente?.parcelasFinanciamento ?? paramNum(config, 'financiamento.parcelas_padrao', 60));
  const [jurosFinanciamentoMesPct, setJurosFinanciamentoMesPct] = useState(() => propostaExistente?.jurosFinanciamentoMesPct ?? paramNum(config, 'financiamento.juros_mes_pct', 1.45));
  const [bancoFinanciamento, setBancoFinanciamento] = useState(propostaExistente?.bancoFinanciamento ?? '');

  // Observações da proposta: em branco. Os textos prontos ficam em
  // SolarCosta_ObservacaoPresets e são inseridos com um clique.
  const [observacoes, setObservacoes] = useState<string>(propostaExistente?.observacoes ?? '');

  // A configuração chega uma vez, depois da carga inicial. Quando chega, os
  // defaults numéricos se ajustam ao que está cadastrado no banco.
  //
  // Retomando um rascunho isto não roda: os valores da proposta já foram
  // negociados com o cliente, e um parâmetro global alterado no meio do
  // caminho não pode reescrever o desconto que ele viu.
  useEffect(() => {
    if (!config || editando) return;
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
  }, [config, editando]);

  /*
   * Despesas fixas, semeadas pela concessionária escolhida.
   *
   * Efeito SEPARADO do de cima, e não mais uma linha dentro dele, porque este
   * precisa acompanhar `concessionaria`: trocar a distribuidora no formulário
   * tem que repuxar o custo de disponibilidade. Junto com os outros, a mesma
   * troca reverteria tarifa, HSP e desconto para o padrão global, apagando o
   * que o consultor acabou de digitar.
   *
   * `custo_disponibilidade` da concessionária é UM número que mistura taxa
   * mínima e iluminação pública (ver utils/solar.ts), então ele serve de ponto
   * de partida para os três campos — não de valor final. O consultor abre a
   * conta do cliente e separa; é por isso que os campos são editáveis.
   */
  useEffect(() => {
    if (!config || editando) return;
    const fixo = config.concessionarias.find((c) => c.nome === concessionaria)?.custo_disponibilidade;
    if (fixo == null) return;
    setIluminacaoPublicaSemSfcr(Number(fixo));
    setCustoDisponibilidade(Number(fixo));
    setIluminacaoPublicaComSfcr(Number(fixo));
  }, [config, concessionaria, editando]);

  /**
   * Só reaplica quando o LEAD muda de fato.
   *
   * `leads` é recriado pelo App a cada recarga — e salvar a proposta chama
   * getLeads(). Sem esta trava o formulário voltava sozinho para os dados do
   * lead logo depois de salvar, e agora ainda reinjetaria a coordenada,
   * disparando chamadas pagas do Google a cada save.
   *
   * Nasce com o lead da proposta retomada justamente para isso: sem ele, abrir
   * um rascunho sobrescreveria na hora os dados gravados com os do cadastro.
   */
  const leadAplicado = useRef<string | null>(propostaExistente?.leadId || null);

  // Ao trocar de lead, o formulário reflete o cliente escolhido.
  useEffect(() => {
    if (leadAplicado.current === leadIdSelecionado) return;
    const lead = leads.find(l => l.id === leadIdSelecionado);
    if (!lead) return;
    leadAplicado.current = leadIdSelecionado;
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

    // O endereço do lead veio pronto do banco: não há payload do ViaCEP para
    // remontar a linha, então a busca automática por endereço fica desligada
    // até o consultor mexer no CEP (a coordenada abaixo cobre o caso comum).
    setEnderecoViaCep(null);
    setNumeroEndereco('');
    setEnderecoEditadoAMao(false);
    // Zera a trava para que redigitar o próprio CEP do lead volte a consultar
    // o ViaCEP — é o caminho do consultor que quer a busca por satélite num
    // lead antigo, sem coordenada gravada.
    ultimoCepConsultado.current = '';

    // Coordenada gravada por uma proposta anterior deste lead: o painel abre
    // já localizado, pulando o geocoding.
    setCoordenadaLead(
      lead.latitude != null && lead.longitude != null
        ? { latitude: lead.latitude, longitude: lead.longitude, placeId: lead.placeId }
        : null,
    );
  }, [leadIdSelecionado, leads]);

  const [customLogoUrl, setCustomLogoUrl] = useState<string>(propostaExistente?.customLogoUrl ?? '');

  /*
   * Telhado por satélite. Fica nulo enquanto o consultor não buscar — a
   * proposta é válida sem isso, só não ganha a página do layout no PDF.
   *
   * Num rascunho retomado começa com o layout JÁ GRAVADO, e não com a
   * coordenada jogada no painel para ele buscar de novo: refazer a busca
   * gastaria as três chamadas do Google a cada reabertura e, pior, trocaria um
   * layout ajustado à mão pelo empacotamento automático. Quem quiser refazer
   * usa o botão de busca do painel.
   */
  const [dadosTelhado, setDadosTelhado] = useState<DadosTelhadoProposta | null>(
    () => telhadoDaProposta(propostaExistente),
  );

  // Modal to add catalog item
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  /*
   * Navegação por seção NO CELULAR.
   *
   * Não é um wizard: nenhuma seção é desmontada — as escondidas saem por CSS
   * (`hidden md:block`). Todo o estado dos ~35 campos continua vivo, os
   * cálculos seguem rodando e o salvamento enxerga o formulário inteiro.
   * A única coisa que muda é o que cabe na tela de uma vez.
   *
   * No desktop (md+) isto não existe: as cinco seções aparecem empilhadas
   * como sempre.
   */
  const [secaoVisivel, setSecaoVisivel] = useState(1);
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
  //
  // A fórmula mora em utils/solar.ts porque a folha de despesas mensais do PDF
  // reconstrói esta mesma parcela a partir dos campos persistidos — a parcela
  // em si nunca foi gravada. Duas cópias da conta divergiriam, e a divergência
  // apareceria no documento que vai para o cliente.
  const entradaValor = (valorTotalInvestimento * entradaFinanciamentoPct) / 100;
  const valorFinanciado = valorTotalInvestimento - entradaValor;
  const pmtParcelaFinanciamento = parcelaFinanciamento({
    valorFinanciado,
    jurosMesPct: jurosFinanciamentoMesPct,
    parcelas: parcelasFinanciamento,
  });

  /*
   * Sync kit item 1 (modulos) with sizing if modulosQtd changes.
   *
   * O primeiro disparo é sempre na montagem, e num rascunho retomado ele
   * reescreveria a quantidade do primeiro item do kit — que nem sempre é o
   * módulo — com a contagem de placas. Como na proposta nova o kit começa
   * vazio, pular a montagem não muda nada por lá.
   */
  const montagemDoKit = useRef(editando);

  useEffect(() => {
    if (montagemDoKit.current) {
      montagemDoKit.current = false;
      return;
    }
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

  /**
   * Monta o objeto da proposta a partir do formulário.
   *
   * Existe porque salvar rascunho e gerar PDF montavam o MESMO objeto de 40
   * campos, copiado duas vezes: qualquer campo novo tinha de ser lembrado nos
   * dois lugares, e esquecer um dava um bug que só aparecia num dos caminhos.
   */
  const montarProposta = (status: Proposta['status']): Proposta => ({
    // Retomando um rascunho, é este id que faz o Api.saveProposta mandar um PUT
    // em vez de um POST — ou seja, é o que impede cada salvamento de virar mais
    // uma proposta na lista.
    id: propostaExistente?.id ?? `prop-${Date.now()}`,
    numero: propostaExistente?.numero ?? '', // gerado pelo banco ao salvar
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
    iluminacaoPublicaSemSfcr,
    custoDisponibilidade,
    iluminacaoPublicaComSfcr,
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
    // A data de criação é do banco; aqui ela só não pode ser reinventada a
    // cada edição do rascunho.
    dataCriacao: propostaExistente?.dataCriacao ?? new Date().toLocaleDateString('pt-BR'),
    status,
    observacoes,
    customLogoUrl,
    // Endereço em partes: é o CEP que dispara a busca por satélite e o número
    // que a faz cair sobre a edificação. Sem persistir, reabrir a proposta
    // recomeçaria pelo ponto aproximado.
    cep,
    numeroEndereco,
    // Telhado por satélite: espalhado só quando a busca foi feita, para não
    // gravar um punhado de nulos em proposta que não usou o recurso.
    ...(dadosTelhado ?? {}),
  });

  const handleSaveDraft = () => {
    if (!validarProposta()) return;
    // Salvar não rebaixa o status: uma proposta já enviada que voltou para
    // ajuste continua enviada.
    onSaveProposal(montarProposta(propostaExistente?.status ?? 'rascunho'));
    showToast(
      editando ? 'Alterações salvas' : 'Rascunho salvo',
      'success',
      'Proposta de orçamento gravada com sucesso.',
    );
  };

  const handleGeneratePDF = () => {
    if (!validarProposta()) return;
    const prop = montarProposta('enviada');
    onSaveProposal(prop);
    onOpenPDF('proposta', prop);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#004276] mb-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para propostas
            </button>
          )}
          <h1 className="text-2xl font-extrabold text-[#004276]">
            {editando ? 'Continuar proposta' : 'Proposta de orçamento'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {/* O número é gerado pelo banco ao salvar; a validade vem dos parâmetros. */}
            {editando
              ? `Nº ${propostaExistente!.numero || '—'} · criada em ${propostaExistente!.dataCriacao}`
              : 'Nova proposta · nº gerado ao salvar'}
            {' · '}
            válida por {paramNum(config, 'proposta.validade_dias', 10)} dias
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 gap-y-2">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition"
          >
            {editando ? 'Salvar alterações' : 'Salvar rascunho'}
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
          {/* Passos — só no celular. Ver o comentário de `secaoVisivel`. */}
          <div className="md:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
            {PASSOS.map((rotulo, i) => {
              const numero = i + 1;
              const ativo = numero === secaoVisivel;
              return (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => setSecaoVisivel(numero)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    ativo ? 'bg-[#004276] text-white border-[#004276] shadow' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                      ativo ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {numero}
                  </span>
                  {rotulo}
                </button>
              );
            })}
          </div>
          
          {/* Section 1: Dados do cliente */}
          <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${secaoVisivel === 1 ? '' : 'hidden md:block'}`}>
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
                  autoComplete="name"
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
                        // Sem onBlur: o onChange já cobre digitação, colagem e
                        // autofill, e o par disparava duas consultas e dois
                        // toasts — agora também duas rodadas de busca.
                        if (onlyDigits(masked).length === 8) handleCepLookup(masked);
                      }}
                      placeholder="00000-000"
                      className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                      {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPinned className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    NÚMERO
                  </label>
                  {/* Sem máscara: número de imóvel no Brasil é 512, 512A, s/n, km 12. */}
                  <input
                    type="text"
                    value={numeroEndereco}
                    onChange={(e) => aoDigitarNumero(e.target.value)}
                    placeholder="512"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    ENDEREÇO DA INSTALAÇÃO
                  </label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => {
                      setEndereco(e.target.value);
                      // A partir daqui a linha é do consultor: nem o CEP nem o
                      // número voltam a reescrevê-la.
                      setEnderecoEditadoAMao(true);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
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
            </div>
          </div>

          {/* Section 2: Dimensionamento do sistema */}
          <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${secaoVisivel === 2 ? '' : 'hidden md:block'}`}>
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

            {/*
              Despesas fixas da conta — o que a geração não compensa e que a
              folha de despesas mensais do PDF imprime nas duas tabelas.
              Vêm pré-preenchidas da concessionária; o consultor confere contra
              a conta de energia do cliente e separa os valores.
            */}
            <div>
              <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-wide">
                DESPESAS FIXAS DA CONTA (R$/MÊS)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    TX. ILUM. PÚBLICA (HOJE)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={iluminacaoPublicaSemSfcr}
                    onChange={(e) => setIluminacaoPublicaSemSfcr(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    CUSTO DE DISPONIBILIDADE
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={custoDisponibilidade}
                    onChange={(e) => setCustoDisponibilidade(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    TX. ILUM. PÚBLICA (COM SISTEMA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={iluminacaoPublicaComSfcr}
                    onChange={(e) => setIluminacaoPublicaComSfcr(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#004276]"
                  />
                </div>
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

          {/* Telhado por satélite — depois do dimensionamento porque precisa
              da quantidade de módulos já calculada. */}
          <div className={secaoVisivel === 2 ? '' : 'hidden md:block'}>
          {/* O painel abre vazio mesmo com layout gravado — ver o comentário de
              `dadosTelhado`. Sem este aviso, o consultor acharia que perdeu. */}
          {editando && dadosTelhado && (
            <div className="mb-3 bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-[11px] font-semibold text-[#004276]">
              O layout de telhado gravado nesta proposta foi mantido e sai no PDF.
              Buscar de novo aqui embaixo substitui o que está guardado.
            </div>
          )}
          <PainelTelhado
            endereco={endereco}
            cidade={cidade}
            numeroEndereco={numeroEndereco}
            consultaAuto={consultaAuto}
            coordenadaConhecida={coordenadaLead}
            modulosQtd={modulosQtdCalculada}
            config={config}
            onResultado={setDadosTelhado}
            showToast={showToast}
          />
          </div>

          {/* Section 3: Kit de equipamentos e serviços */}
          <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${secaoVisivel === 3 ? '' : 'hidden md:block'}`}>
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
              <table className="tabela-mobile w-full text-left text-xs">
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
                      <td data-label="DESCRIÇÃO" className="p-3 font-semibold text-slate-900">{item.descricao}</td>
                      <td data-label="QTD." className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qtd}
                          onChange={(e) => handleUpdateItemQtd(item.id, Number(e.target.value))}
                          className="w-16 p-1 text-center bg-slate-50 border border-slate-200 rounded font-bold"
                        />
                      </td>
                      <td data-label="VALOR UNIT." className="p-3 text-right text-slate-600">
                        R$ {item.valorUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td data-label="TOTAL" className="p-3 text-right font-bold text-slate-900">
                        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td data-label="" className="p-3 text-center">
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
          <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${secaoVisivel === 4 ? '' : 'hidden md:block'}`}>
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
                    <span className="text-[10px] text-slate-400 block uppercase">VALOR DA PARCELA ({parcelasFinanciamento}x)</span>
                    <span className="text-[#004276] text-sm">R$ {pmtParcelaFinanciamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">TOTAL DO FINANCIAMENTO</span>
                    <span className="text-slate-900">R$ {(entradaValor + pmtParcelaFinanciamento * parcelasFinanciamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${secaoVisivel === 5 ? '' : 'hidden md:block'}`}>
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

          {/* Avanço entre seções no celular. */}
          <div className="md:hidden flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSecaoVisivel((n) => Math.max(1, n - 1))}
              disabled={secaoVisivel === 1}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setSecaoVisivel((n) => Math.min(PASSOS.length, n + 1))}
              disabled={secaoVisivel === PASSOS.length}
              className="flex-1 py-2.5 rounded-xl bg-[#004276] text-white font-bold text-sm disabled:opacity-40"
            >
              Próximo
            </button>
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
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Adicionar produto do catálogo</h3>
              <button onClick={() => setIsAddItemOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>
            <div className="modal-corpo p-5 space-y-4 text-xs">
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
