import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Calculator, Check, FileText, Download, Sparkles, Loader2,
  MapPinned, ArrowLeft, Boxes, User as UserIcon, Zap, Sun, CreditCard,
  Save, ShieldCheck, Info, CheckCircle2, Sliders, MapPin, X
} from 'lucide-react';
import { ModalCabecalho } from './comuns/ModalCabecalho';
import { Proposta, PropostaItem, Produto, Kit, Lead, User } from '../types';
import { maskCPFCNPJ, maskPhone, maskCEP, onlyDigits, docLabel, isValidCPFCNPJ } from '../utils/format';
import {
  fetchAddressByCep,
  buildEnderecoLine,
  buildEnderecoBusca,
  buildCidadeUf,
  type EnderecoViaCEP,
} from '../services/cep';
import { Api, paramNum, type ConfigApp } from '../services/api';
import { slugDoTipoProduto } from '../services/mappers';
import { parcelaFinanciamento } from '../utils/solar';
import { calcularProposta, entradaSolarZerada, type EntradaSolar } from '../../server/src/domain/propostaSolar';
import { PropostaPremissas } from './PropostaPremissas';
import { LevantamentoManual } from './mapa/LevantamentoManual';
import { PreviaLevantamento } from './mapa/PreviaLevantamento';
import { areaSuperficie, type LevantamentoTelhado } from '../utils/levantamentoTelhado';
import {
  PainelTelhado,
  type CoordenadaConhecida,
  type DadosTelhadoProposta,
} from './mapa/PainelTelhado';

interface ProposalCalculatorViewProps {
  propostas: Proposta[];
  produtos: Produto[];
  kits: Kit[];
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
  onSaveProposal: (proposta: Proposta) => Promise<Proposta | undefined>;
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
  kits,
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
  const propostaSalva = useRef(propostaExistente);
  const salvando = useRef(false);
  const [ultimaVersaoSalva, setUltimaVersaoSalva] = useState<Date | null>(null);
  const [salvamentoEmCurso, setSalvamentoEmCurso] = useState(false);
  const editando = !!propostaExistente;
  const [levantamentoTelhado, setLevantamentoTelhado] = useState<LevantamentoTelhado | undefined>(propostaExistente?.levantamentoTelhado);
  const [editorManualAberto, setEditorManualAberto] = useState(false);
  const manterEditorCaptura = useRef(false);
  const [salvarVistaPendente, setSalvarVistaPendente] = useState(false);

  // Lead vinculado. Sem lead selecionado o formulário nasce em branco — antes
  // ele caía num lead fixo de demonstração ("Cristiano Duarte Almeida").
  const [leadIdSelecionado, setLeadIdSelecionado] = useState(
    propostaExistente?.leadId || currentLeadId || '',
  );
  const linkedLead = leads.find(l => l.id === leadIdSelecionado);
  const [buscaLead, setBuscaLead] = useState('');
  const [listaLeadsAberta, setListaLeadsAberta] = useState(false);
  const [indiceLead, setIndiceLead] = useState(0);
  const rotuloLead = (lead: typeof leads[number]) => [lead.numero, lead.nome, lead.cidade].filter(Boolean).join(' · ');
  const normalizarBusca = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const leadsFiltrados = leads.filter(lead => normalizarBusca(rotuloLead(lead)).includes(normalizarBusca(buscaLead)));
  const escolherLead = (id: string) => { setLeadIdSelecionado(id); setListaLeadsAberta(false); setBuscaLead(''); };

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
  const localizacaoPronta = onlyDigits(cep).length === 8 && !!numeroEndereco.trim();
  const consultaAuto = localizacaoPronta && enderecoViaCep?.logradouro && onlyDigits(enderecoViaCep.cep) === onlyDigits(cep)
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
  const [consumoKwh, setConsumoKwh] = useState(propostaExistente?.consumoKwh ?? 0);
  const [tarifaKwh, setTarifaKwh] = useState(() => propostaExistente?.tarifaKwh ?? 0);
  const [hsp, setHsp] = useState(() => propostaExistente?.hsp ?? 0);
  const [perdasPct, setPerdasPct] = useState(() => propostaExistente?.perdasPct ?? 0);
  const [moduloWp, setModuloWp] = useState(() => propostaExistente?.moduloWp ?? 0);

  const legado = !!propostaExistente && !propostaExistente.calculoSolar;
  const [revisaoConfirmada, setRevisaoConfirmada] = useState(false);
  const [entradaSolar, setEntradaSolar] = useState<EntradaSolar>(() => propostaExistente?.calculoSolar?.entradas ?? {
    ...entradaSolarZerada(),
    ...(propostaExistente ? { ucs: [{ nome: 'UC 1', meses: Array(12).fill(propostaExistente.consumoKwh), adicionalKwh: 0, disponibilidadeKwh: 0 }], hspMensal: Array(12).fill(propostaExistente.hsp) } : {}),
  });
  const atualizarEntradaSolar = (e: EntradaSolar) => {
    setEntradaSolar(e);
    setConsumoKwh(e.ucs.reduce((s, u) => s + u.meses.reduce((a, b) => a + b, 0) / 12, 0));
    setHsp(e.hspMensal.reduce((a, b) => a + b, 0) / 12);
    setModuloWp(e.moduloWp); setPerdasPct(e.perdasPct);
    if (legado) setRevisaoConfirmada(false);
  };

  // Despesas fixas da conta — o que o cliente continua pagando mesmo gerando a
  // própria energia, e que a folha de despesas mensais do PDF imprime.
  // Começam em 0 e são semeadas pela concessionária no efeito mais abaixo.
  const [iluminacaoPublicaSemSfcr, setIluminacaoPublicaSemSfcr] = useState(propostaExistente?.iluminacaoPublicaSemSfcr ?? 0);
  const [custoDisponibilidade, setCustoDisponibilidade] = useState(propostaExistente?.custoDisponibilidade ?? 0);
  const [iluminacaoPublicaComSfcr, setIluminacaoPublicaComSfcr] = useState(propostaExistente?.iluminacaoPublicaComSfcr ?? 0);

  // Kit vazio: o consultor monta a partir do catálogo real. Retomando um
  // rascunho, vem o kit que já estava montado.
  const [kitItens, setKitItens] = useState<PropostaItem[]>(propostaExistente?.kitItens ?? []);

  // Valor negociado: null = não negociado, vale a soma dos itens. Não é 0 por
  // padrão porque 0 é um valor negociado legítimo (bonificação) e os dois
  // precisam ser distinguíveis até o banco.
  const [valorNegociado, setValorNegociado] = useState<number | null>(
    propostaExistente?.valorTotalAjustado ?? null,
  );

  // Payment Options
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'cartao' | 'financiamento'>(propostaExistente?.formaPagamento ?? 'avista');
  const [descontoAvistaPct, setDescontoAvistaPct] = useState(() => propostaExistente?.descontoAvistaPct ?? 0);
  const [parcelasCartao, setParcelasCartao] = useState(() => propostaExistente?.parcelasCartao ?? 0);
  const [taxaCartaoPct, setTaxaCartaoPct] = useState(() => propostaExistente?.taxaCartaoPct ?? 0);

  const [entradaFinanciamentoPct, setEntradaFinanciamentoPct] = useState(() => propostaExistente?.entradaFinanciamentoPct ?? 0);
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState(() => propostaExistente?.parcelasFinanciamento ?? 0);
  const [jurosFinanciamentoMesPct, setJurosFinanciamentoMesPct] = useState(() => propostaExistente?.jurosFinanciamentoMesPct ?? 0);
  const [bancoFinanciamento, setBancoFinanciamento] = useState(propostaExistente?.bancoFinanciamento ?? '');

  // Observações da proposta: em branco. Os textos prontos ficam em
  // SolarCosta_ObservacaoPresets e são inseridos com um clique.
  const [observacoes, setObservacoes] = useState<string>(propostaExistente?.observacoes ?? '');

  const [usuariosTecnicos, setUsuariosTecnicos] = useState<User[]>([]);
  const [erroUsuarios, setErroUsuarios] = useState(false);
  const [responsavelTecnicoId, setResponsavelTecnicoId] = useState(propostaExistente?.responsavelTecnicoId ?? '');
  const [responsavelTecnico, setResponsavelTecnico] = useState(propostaExistente?.responsavelTecnico ?? '');
  const [crea, setCrea] = useState(propostaExistente?.crea ?? '');
  const [conselhoProfissional, setConselhoProfissional] = useState<'CREA' | 'CRT'>(propostaExistente?.conselhoProfissional ?? 'CREA');
  useEffect(() => {
    let ativo = true;
    Api.getUsuarios().then(usuarios => { if (ativo) setUsuariosTecnicos(usuarios); }).catch(() => { if (ativo) setErroUsuarios(true); });
    return () => { ativo = false; };
  }, []);
  const selecionarResponsavel = (id: string) => {
    const usuario = usuariosTecnicos.find(u => u.id === id);
    setResponsavelTecnicoId(id);
    setResponsavelTecnico(usuario?.nome ?? '');
    setCrea((usuario?.tipoProfissional === 'tecnico' ? usuario.crt : usuario?.crea) ?? '');
    setConselhoProfissional(usuario?.tipoProfissional === 'tecnico' ? 'CRT' : 'CREA');
  };

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

  /*
   * Seleção do modal de adicionar item.
   *
   * Começa vazia de propósito. Inicializar com `produtos[0]?.id` parecia
   * conveniente, mas `produtos` chega por fetch: na primeira renderização a
   * lista está vazia, o estado congela em '' e o <select> mostrava o primeiro
   * produto sem que ele estivesse selecionado de fato. Com '' há uma opção
   * "Selecione…" explícita, e o handler simplesmente não acha nada se ninguém
   * escolheu.
   */
  const [abaCatalogo, setAbaCatalogo] = useState<'kit' | 'produto'>('kit');
  const [selectedCatalogKitId, setSelectedCatalogKitId] = useState('');
  const [selectedCatalogProdutoId, setSelectedCatalogProdutoId] = useState('');
  const [qtdAvulso, setQtdAvulso] = useState(0);
  const [valorAvulso, setValorAvulso] = useState(0);

  // Soma dos itens. Só o topo da lista entra: componente de kit tem valor 0,
  // porque o preço do kit está na linha-pai.
  const somaDosItens = kitItens.reduce((acc, item) => acc + item.total, 0);

  // O valor negociado, quando existe, SUBSTITUI a soma — e tudo o que vem
  // depois (payback, entrada, parcela, PDF) consome esta constante, então
  // manter o nome é o que faz o ajuste se propagar sem mais nenhuma mudança.
  const valorTotalInvestimento = valorNegociado ?? somaDosItens;

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

  const calculoSolar = calcularProposta({
    ...entradaSolar, moduloWp, perdasPct, tarifa: tarifaKwh,
    larguraM: levantamentoTelhado?.modulo.larguraM ?? entradaSolar.larguraM,
    alturaM: levantamentoTelhado?.modulo.alturaM ?? entradaSolar.alturaM,
    taxaSem: iluminacaoPublicaSemSfcr, disponibilidadeReais: custoDisponibilidade, taxaCom: iluminacaoPublicaComSfcr,
    investimento: valorTotalInvestimento, parcela: formaPagamento === 'financiamento' ? pmtParcelaFinanciamento : 0,
    parcelas: formaPagamento === 'financiamento' ? parcelasFinanciamento : 0,
    quantidadeInstalada: levantamentoTelhado ? levantamentoTelhado.placas.length : null
  });
  const preservarLegado = legado && !revisaoConfirmada;
  const potenciaKwpCalculada = preservarLegado ? propostaExistente.potenciaKwp : calculoSolar.potenciaKwp;
  const modulosQtdCalculada = preservarLegado ? propostaExistente.modulosQtd : calculoSolar.modulosQtd;
  const geracaoMediaKwh = preservarLegado ? propostaExistente.geracaoMediaKwh : calculoSolar.geracaoMediaKwh;
  const areaEstimadaM2 = preservarLegado ? propostaExistente.areaEstimadaM2 : calculoSolar.areaEstimadaM2;
  const coberturaPct = preservarLegado ? propostaExistente.coberturaPct : calculoSolar.coberturaPct;
  const economiaMensal = preservarLegado ? propostaExistente.economiaMensal : calculoSolar.economiaMensal;
  const economiaAnual = preservarLegado ? propostaExistente.economiaAnual : calculoSolar.economiaAnual;
  const economia25Anos = preservarLegado ? propostaExistente.economia25Anos : calculoSolar.economia25Anos;
  const paybackAnos = preservarLegado ? propostaExistente.paybackAnos : calculoSolar.paybackAnos;

  /*
   * Acompanha o dimensionamento: mudou a quantidade de placas, muda a
   * quantidade das linhas de módulo.
   *
   * O critério é o TIPO do produto, e não a posição na lista. Antes era
   * "índice 0", o que já estava errado (o próprio comentário admitia que a
   * primeira linha "nem sempre é o módulo") e piorou com os kits: a linha de
   * topo passou a poder ser um kit inteiro, e reescrever a quantidade dele com
   * a contagem de placas multiplicaria o preço fechado por 12.
   *
   * Componente de kit é deliberadamente intocado: a composição do kit é fixa,
   * foi ela que o preço fechado comprou.
   *
   * O primeiro disparo é sempre na montagem, e num rascunho retomado ele
   * reescreveria quantidades que o consultor já tinha ajustado à mão. Como na
   * proposta nova o kit começa vazio, pular a montagem não muda nada por lá.
   */
  const montagemDoKit = useRef(editando);

  const ehLinhaDeModulo = (item: PropostaItem) =>
    !item.kitId &&
    !!item.produtoId &&
    slugDoTipoProduto(produtos.find(p => p.id === item.produtoId)?.tipo) === 'modulo';

  const contarPaineis = (itens: PropostaItem[]): number => itens.reduce((total, item) => total + (
    item.componentes?.length
      ? contarPaineis(item.componentes)
      : item.produtoId && slugDoTipoProduto(produtos.find(p => p.id === item.produtoId)?.tipo) === 'modulo' ? item.qtd : 0
  ), 0);
  const modulosRecomendados = preservarLegado ? modulosQtdCalculada : Math.ceil(calculoSolar.quantidadeCalculada);
  const avisoPaineis = (itens: PropostaItem[]): string | null => {
    const quantidade = contarPaineis(itens);
    if (!itens.length || !(modulosRecomendados > quantidade)) return null;
    return `Painéis: ${quantidade.toLocaleString('pt-BR')}/${modulosRecomendados.toLocaleString('pt-BR')} recomendados.`;
  };
  const avisoPaineisAtual = avisoPaineis(kitItens);

  useEffect(() => {
    if (montagemDoKit.current) {
      montagemDoKit.current = false;
      return;
    }
    setKitItens(prev => prev.map(item => (
      ehLinhaDeModulo(item)
        ? { ...item, qtd: modulosQtdCalculada, total: modulosQtdCalculada * item.valorUnit }
        : item
    )));
  }, [modulosQtdCalculada]);

  const handleUpdateItemQtd = (id: string, newQtd: number) => {
    if (newQtd <= 0) return;
    setKitItens(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        qtd: newQtd,
        total: newQtd * item.valorUnit,
        // Dobrar a quantidade de kits dobra o que vai ser instalado — e é
        // disso que a baixa de estoque da obra depende. Reescala a partir da
        // quantidade unitária, e não do valor atual, para não acumular erro a
        // cada ajuste.
        componentes: item.componentes?.map(c => ({
          ...c,
          qtd: (c.qtdUnitaria ?? c.qtd) * newQtd,
        })),
      };
    }));
  };

  const handleUpdateItemValor = (id: string, novoValor: number) => {
    if (novoValor < 0) return;
    setKitItens(prev => prev.map(item => (
      item.id === id ? { ...item, valorUnit: novoValor, total: item.qtd * novoValor } : item
    )));
  };

  const handleRemoveItem = (id: string) => {
    setKitItens(prev => prev.filter(item => item.id !== id));
  };

  const handleAddCatalogKit = () => {
    const kit = kits.find(k => k.id === selectedCatalogKitId);
    if (!kit) return;

    const base = Date.now();
    const novoItem: PropostaItem = {
      id: `i-${base}`,
      kitId: kit.id,
      descricao: kit.nome,
      qtd: 1,
      valorUnit: kit.preco,
      total: kit.preco,
      // Os componentes entram com valor 0: o preço está na linha do kit. Eles
      // existem para o PDF listar o equipamento e para a obra baixar estoque.
      componentes: kit.itens.map((i, idx) => ({
        id: `i-${base}-${idx}`,
        produtoId: i.produtoId,
        kitId: kit.id,
        descricao: i.produtoNome,
        qtd: i.qtd,
        qtdUnitaria: i.qtd,
        valorUnit: 0,
        total: 0,
      })),
    };

    setKitItens(prev => [...prev, novoItem]);
    setIsAddItemOpen(false);
    setSelectedCatalogKitId('');
    const aviso = avisoPaineis([...kitItens, novoItem]);
    showToast(aviso ? 'Kit incluído com menos painéis que o recomendado' : 'Kit adicionado', aviso ? 'info' : 'success', aviso ?? `${kit.nome} incluído na proposta.`);
  };

  const handleAddCatalogItem = () => {
    const prod = produtos.find(p => p.id === selectedCatalogProdutoId);
    if (!prod) return;
    if (!(qtdAvulso > 0) || !Number.isFinite(qtdAvulso) || valorAvulso < 0 || !Number.isFinite(valorAvulso)) {
      showToast('Item incompleto', 'error', 'Informe quantidade maior que zero e valor unitário válido.');
      return;
    }

    const total = qtdAvulso * valorAvulso;
    const newItem: PropostaItem = {
      id: `i-${Date.now()}`,
      produtoId: prod.id,
      descricao: prod.nome,
      qtd: qtdAvulso,
      // Produto não tem mais preço de cadastro: o valor é o digitado aqui.
      valorUnit: valorAvulso,
      total,
    };

    setKitItens(prev => [...prev, newItem]);
    setIsAddItemOpen(false);
    // Zera a seleção: sem isso o próximo item abriria com a quantidade e o
    // valor do anterior já preenchidos, e é fácil salvar sem reparar.
    setSelectedCatalogProdutoId('');
    setQtdAvulso(0);
    setValorAvulso(0);
    const aviso = avisoPaineis([...kitItens, newItem]);
    showToast(aviso ? 'Item incluído; quantidade de painéis inferior à recomendada' : 'Item adicionado', aviso ? 'info' : 'success', aviso ?? `${prod.nome} incluído na proposta.`);
  };

  // Espelha os requisitos mínimos do backend (propostaSchema): sem isso, o
  // POST falha depois que o PDF já foi aberto/impresso com dados fictícios.
  const validarProposta = (rascunho = false, silencioso = false): boolean => {
    if (silencioso && (!clienteNome.trim() || cpfInvalido)) return false;
    if (!clienteNome.trim()) {
      showToast('Campos incompletos', 'error', 'Informe o nome do cliente.');
      return false;
    }
    if (cpfInvalido) {
      showToast('Documento inválido', 'error', `Verifique o ${docLabel(cpfCnpj)} informado.`);
      return false;
    }
    if (rascunho) return true;
    if (!preservarLegado && !calculoSolar.completo) {
      showToast('Pendente de preenchimento', 'error', calculoSolar.erros.join(' ')); return false;
    }
    if ((formaPagamento === 'financiamento' && parcelasFinanciamento <= 0) || (formaPagamento === 'cartao' && parcelasCartao <= 0)) {
      showToast('Prazo inválido', 'error', 'Informe o número de parcelas do financiamento.'); return false;
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
    if (!rascunho && kitItens.length === 0) {
      showToast('Kit vazio', 'error', 'Adicione pelo menos um item do catálogo antes de gerar a proposta.');
      return false;
    }
    if (!rascunho && levantamentoTelhado?.placas.length) {
      const contar = (itens: PropostaItem[]): number => itens.reduce((s, item) => s +
        (item.componentes?.length ? contar(item.componentes) :
          (item.produtoId && slugDoTipoProduto(produtos.find(p => p.id === item.produtoId)?.tipo) === 'modulo' ? item.qtd : 0)), 0);
      if (contar(kitItens) !== levantamentoTelhado.placas.length) {
        showToast('Equipamentos diferentes do layout', 'error', `O levantamento tem ${levantamentoTelhado.placas.length} módulos. Ajuste os itens/kit para a mesma quantidade antes de salvar.`);
        return false;
      }
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
    id: propostaSalva.current?.id ?? `prop-${Date.now()}`,
    numero: propostaSalva.current?.numero ?? '', // gerado pelo banco ao salvar
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
    valorTotalAjustado: valorNegociado,
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
    dataCriacao: propostaSalva.current?.dataCriacao ?? new Date().toLocaleDateString('pt-BR'),
    status,
    observacoes,
    customLogoUrl,
    // Vazio vira undefined de propósito: é o que diz ao PDF para usar o
    // responsável técnico do cadastro da empresa em vez de imprimir em branco.
    responsavelTecnicoId: responsavelTecnicoId || undefined,
    conselhoProfissional,
    responsavelTecnico: responsavelTecnico.trim() || undefined,
    crea: crea.trim() || undefined,
    // Endereço em partes: é o CEP que dispara a busca por satélite e o número
    // que a faz cair sobre a edificação. Sem persistir, reabrir a proposta
    // recomeçaria pelo ponto aproximado.
    cep,
    numeroEndereco,
    // Telhado por satélite: espalhado só quando a busca foi feita, para não
    // gravar um punhado de nulos em proposta que não usou o recurso.
    ...(dadosTelhado ?? {}),
    levantamentoTelhado,
    calculoSolar: preservarLegado ? undefined : calculoSolar,
  });

  const salvar = async (gerarPDF = false, automatico = false) => {
    if (automatico && legado) return false;
    if (salvando.current || !validarProposta(!gerarPDF, automatico)) return;
    salvando.current = true;
    setSalvamentoEmCurso(true);
    const proposta = montarProposta(
      gerarPDF ? 'enviada' : propostaSalva.current?.status ?? 'rascunho',
    );
    try {
      const salva = await onSaveProposal(proposta);
      if (!salva) return false;
      propostaSalva.current = salva;

      setUltimaVersaoSalva(new Date());
      if (gerarPDF) onOpenPDF('proposta', salva);
      return true;
    } finally {
      // A criação pode ter funcionado mesmo se a mudança de status falhou.
      // A API preserva o ID recebido para que a próxima tentativa seja PUT.
      if (!propostaSalva.current && !proposta.id.startsWith('prop-')) {
        propostaSalva.current = { ...proposta, status: 'rascunho' };
      }
      salvando.current = false;
      setSalvamentoEmCurso(false);
    }
  };
  useEffect(() => {
    if (!salvarVistaPendente) return;
    void salvar(false, false).then(ok => {
      if (ok) { if (!manterEditorCaptura.current) setEditorManualAberto(false); showToast('Vista e desenho salvos', 'success', 'Continue editando o levantamento.'); }
      else showToast('Vista ainda nao gravada', 'error', 'Confira os dados obrigatorios da proposta e tente novamente.');
    }).catch(() => showToast('Falha ao salvar a vista', 'error', 'O desenho permanece no editor. Tente novamente.')).finally(() => setSalvarVistaPendente(false));
  }, [salvarVistaPendente]);
  const salvarAutomaticamente = useRef(() => { void salvar(false, true); });
  salvarAutomaticamente.current = () => { void salvar(false, true); };
  useEffect(() => {
    const intervalo = window.setInterval(() => salvarAutomaticamente.current(), 30_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const handleSaveDraft = () => { void salvar(); };
  const handleGeneratePDF = () => { void salvar(true); };

  return (
      <div className="space-y-4">
        {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#004276] mb-1 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para propostas
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-[#004276]">
                  {editando ? 'Editar proposta' : 'Nova proposta'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#004276] border border-blue-200">
                  {editando ? `Nº ${propostaExistente!.numero || '—'}` : 'Rascunho'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  · criada em {editando ? propostaExistente!.dataCriacao : new Date().toLocaleDateString('pt-BR')}
                  · válida por {paramNum(config, 'proposta.validade_dias', 10)} dias
                </span>
              </div>
              {ultimaVersaoSalva && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5" role="status">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Última versão salva às {ultimaVersaoSalva.toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={salvamentoEmCurso}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {salvamentoEmCurso ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  ) : (
                    <Save className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{editando ? 'Salvar alterações' : 'Salvar rascunho'}</span>
                </button>
                <button
                  onClick={handleGeneratePDF}
                  disabled={salvamentoEmCurso}
                  className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>Gerar proposta em PDF</span>
                </button>
              </div>
            </div>

              {/* Main Form Layout (8/12 Form, 4/12 Sidebar Sticky) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                    {/* LEFT FORM (8/12) */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                      {/* Passos — no celular */}
                      <div className="md:hidden -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1">
                        {PASSOS.map((rotulo, i) => {
                          const numero = i + 1;
                          const ativo = numero === secaoVisivel;
                          return (
                            <button
                              key={rotulo}
                              type="button"
                              onClick={() => setSecaoVisivel(numero)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${ativo ? 'bg-[#004276] text-white border-[#004276] shadow-xs' : 'bg-white text-slate-600 border-slate-200'
                                }`}
                            >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                    {numero}
                  </span>
                  {rotulo}
                </button>
              );
            })}
          </div>
          
          {/* Section 1: Dados do cliente */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 ${secaoVisivel === 1 ? '' : 'hidden md:block'}`}>
                                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-[#004276] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                          <UserIcon className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                          <h3 className="font-bold text-slate-900 text-sm">Dados do Cliente</h3>
                                          <p className="text-[11px] text-slate-400">Identificação, contato e endereço de instalação</p>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {linkedLead ? `Lead ${linkedLead.numero}` : 'Sem lead vinculado'}
                                      </span>
                                    </div>

                                    {/* Lead Vinculado Combobox */}
                                    <div className="relative" onBlur={e => {
                                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setListaLeadsAberta(false);
                                    }}>
                                      <label htmlFor="lead-vinculado" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                        VINCULAR LEAD EXISTENTE (OPCIONAL)
                                      </label>
                                      <div className="relative">
                                        <input
                                          id="lead-vinculado" role="combobox" aria-autocomplete="list"
                                          aria-expanded={listaLeadsAberta} aria-controls="opcoes-lead"
                                          aria-activedescendant={listaLeadsAberta ? 'opcao-lead-' + indiceLead : undefined}
                                          autoComplete="off"
                                          value={listaLeadsAberta ? buscaLead : linkedLead ? rotuloLead(linkedLead) : ''}
                                          placeholder="Pesquise por nome, número do lead ou cidade..."
                                          onFocus={() => { setBuscaLead(''); setIndiceLead(0); setListaLeadsAberta(true); }}
                                          onChange={e => { setBuscaLead(e.target.value); setIndiceLead(0); setListaLeadsAberta(true); }}
                                          onKeyDown={e => {
                                            if (e.key === 'Escape') setListaLeadsAberta(false);
                                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                              e.preventDefault(); setListaLeadsAberta(true);
                                              setIndiceLead(i => Math.max(0, Math.min(leadsFiltrados.length, i + (e.key === 'ArrowDown' ? 1 : -1))));
                                            }
                                            if (e.key === 'Enter' && listaLeadsAberta) {
                                              e.preventDefault(); escolherLead(indiceLead === 0 ? '' : leadsFiltrados[indiceLead - 1]?.id ?? '');
                                            }
                                          }}
                                          className="w-full px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                                        />
                                        {linkedLead && !listaLeadsAberta && (
                                          <button
                                            type="button"
                                            onClick={() => escolherLead('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                            title="Desvincular lead"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      {listaLeadsAberta && (
                <div id="opcoes-lead" role="listbox" aria-label="Leads" className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {[null, ...leadsFiltrados].map((lead, indice) => (
                    <button key={lead?.id ?? 'nenhum'} id={'opcao-lead-' + indice} type="button" role="option"
                      aria-selected={lead ? lead.id === leadIdSelecionado : !leadIdSelecionado}
                      onMouseDown={e => e.preventDefault()} onMouseEnter={() => setIndiceLead(indice)}
                      onClick={() => escolherLead(lead?.id ?? '')}
                      className={'block w-full px-3 py-2 text-left text-xs transition ' + (indice === indiceLead ? 'bg-blue-50 text-[#004276] font-bold' : 'text-slate-700 hover:bg-slate-50')}
                    >{lead ? rotuloLead(lead) : 'Nenhum — preencher manualmente'}</button>
                  ))}
                  {leadsFiltrados.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Nenhum lead encontrado.</p>}
                </div>
              )}
            </div>

            {/* Grid dos Dados do Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  NOME / RAZÃO SOCIAL
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  {docLabel(cpfCnpj)}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(maskCPFCNPJ(e.target.value))}
                  className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-semibold focus:outline-none transition ${
                    cpfInvalido ? 'border-rose-300 focus:border-rose-500 bg-rose-50/40 text-rose-700' : 'border-slate-200 focus:border-[#004276]'
                  }`}
                />
                {cpfInvalido && <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{docLabel(cpfCnpj)} inválido</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  TELEFONE / WHATSAPP
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              {/* Endereço: CEP, Número, Logradouro */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
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
                    placeholder="00000-000"
                    className="w-full px-2.5 py-1.5 pr-7 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPinned className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  NÚMERO
                </label>
                <input
                  type="text"
                  value={numeroEndereco}
                  onChange={(e) => aoDigitarNumero(e.target.value)}
                  placeholder="512"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  ENDEREÇO DA INSTALAÇÃO (LOGRADOURO, BAIRRO, CIDADE/UF)
                </label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => {
                    setEndereco(e.target.value);
                    setEnderecoEditadoAMao(true);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              {/* Telhado & Concessionária */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  TIPO DE TELHADO
                </label>
                <select
                  value={telhado}
                  onChange={(e) => setTelhado(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#004276] transition"
                >
                  <option value="Laje">Laje</option>
                  <option value="Colonial">Colonial</option>
                  <option value="Metálico">Metálico</option>
                  <option value="Fibrocimento">Fibrocimento</option>
                  <option value="Solo/Estrutura">Solo/Estrutura</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  CONCESSIONÁRIA
                </label>
                <select
                  value={concessionaria}
                  onChange={(e) => setConcessionaria(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#004276] transition"
                >
                  <option value="CEMIG">CEMIG</option>
                  <option value="ENEL">ENEL</option>
                  <option value="CPFL">CPFL</option>
                  <option value="LIGHT">LIGHT</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Dimensionamento do sistema */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 ${secaoVisivel === 2 ? '' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#004276] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Dimensionamento do Sistema</h3>
                  <p className="text-[11px] text-slate-400">Consumo mensal, irradiação local e parâmetros de geração</p>
                </div>
              </div>
            </div>

            {/* Inputs Principais de Dimensionamento */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  CONSUMO MÉDIO <span className="text-slate-400 font-normal">(KWH)</span>
                </label>
                <input
                  type="number"
                  value={consumoKwh}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setConsumoKwh(v);
                    setEntradaSolar(prev => ({
                      ...prev,
                      ucs: [{ nome: 'UC 1', meses: Array(12).fill(v), adicionalKwh: 0, disponibilidadeKwh: 0 }],
                    }));
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  TARIFA <span className="text-slate-400 font-normal">(R$/KWH)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={tarifaKwh}
                  onChange={(e) => setTarifaKwh(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  HSP MÉDIA <span className="text-slate-400 font-normal">(H/DIA)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={hsp}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setHsp(v);
                    setEntradaSolar(prev => ({ ...prev, hspMensal: Array(12).fill(v) }));
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  PERDAS <span className="text-slate-400 font-normal">(%)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={perdasPct}
                  onChange={(e) => setPerdasPct(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004276] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  MÓDULO <span className="text-slate-400 font-normal">(WP)</span>
                </label>
                <input
                  type="number"
                  value={moduloWp}
                  disabled={!!levantamentoTelhado}
                  title={levantamentoTelhado ? 'Altere a potência do módulo no levantamento do telhado.' : undefined}
                  onChange={(e) => setModuloWp(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004276] transition disabled:opacity-60"
                />
              </div>
            </div>

            {/* Calculated sizing banner - Compact KPI Strip */}
            <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">POTÊNCIA</span>
                <p className="text-base sm:text-lg font-black text-[#004276]">{potenciaKwpCalculada} kWp</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">MÓDULOS</span>
                <p className="text-base sm:text-lg font-black text-slate-800">{modulosQtdCalculada} un</p>
                {calculoSolar.quantidadeCalculada > 0 && Number.isFinite(calculoSolar.quantidadeCalculada) && (
                  <p
                    className="mt-0.5 text-[10px] font-normal text-slate-500"
                    title="Quantidade calculada com os parâmetros atuais, antes do arredondamento para cima. Quando há levantamento do telhado, o total instalado segue os módulos do layout."
                  >
                    Calculado: {calculoSolar.quantidadeCalculada.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} un
                  </p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ÁREA ESTIMADA</span>
                <p className="text-base sm:text-lg font-black text-slate-800">{areaEstimadaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GERAÇÃO MÉDIA</span>
                <p className="text-base sm:text-lg font-black text-slate-800">{geracaoMediaKwh.toLocaleString('pt-BR')} kWh</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">COBERTURA</span>
                <p className="text-base sm:text-lg font-black text-emerald-700">{coberturaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</p>
              </div>
            </div>

            {/* Premissas & Configurações Avançadas */}
            <PropostaPremissas
              entrada={{ ...entradaSolar, moduloWp, perdasPct }}
              onChange={atualizarEntradaSolar}
              resultado={calculoSolar}
              legado={legado}
              confirmado={revisaoConfirmada}
              anterior={propostaExistente}
              onConfirmar={() => setRevisaoConfirmada(true)}
            />

            {/* Despesas Fixas da Conta */}
            <div>
              <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                DESPESAS FIXAS DA CONTA (R$/MÊS)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    TX. ILUM. PÚBLICA (HOJE)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={iluminacaoPublicaSemSfcr}
                    onChange={(e) => setIluminacaoPublicaSemSfcr(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    CUSTO DE DISPONIBILIDADE
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={custoDisponibilidade}
                    onChange={(e) => setCustoDisponibilidade(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    TX. ILUM. PÚBLICA (COM SISTEMA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={iluminacaoPublicaComSfcr}
                    onChange={(e) => setIluminacaoPublicaComSfcr(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#004276] transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Telhado por satélite */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 ${secaoVisivel === 2 ? '' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#004276]" />
                <h3 className="font-bold text-slate-900 text-sm">Levantamento do Telhado</h3>
              </div>
              {levantamentoTelhado && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {levantamentoTelhado.placas.length} módulos aplicados
                </span>
              )}
            </div>

            {editando && dadosTelhado && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 text-[11px] font-medium text-[#004276]">
                O layout de telhado gravado nesta proposta foi mantido e sai no PDF. Buscar novamente substitui o desenho atual.
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              Busque a imagem de satélite ou importe uma imagem própria para medir o telhado, simular a luz solar e distribuir os módulos.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="bg-[#004276] hover:bg-[#003159] text-white rounded-xl px-4 py-2 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                onClick={() => setEditorManualAberto(true)}
              >
                <MapPinned className="w-3.5 h-3.5" />
                {levantamentoTelhado ? 'Editar levantamento do telhado' : 'Abrir levantamento do telhado'}
              </button>

              {levantamentoTelhado && (
                <button
                  type="button"
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold underline px-2 py-1"
                  onClick={() => setLevantamentoTelhado(undefined)}
                >
                  Remover levantamento
                </button>
              )}
            </div>

            {levantamentoTelhado && (
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs">
                {!editorManualAberto && (
                  <PreviaLevantamento
                    key={JSON.stringify(levantamentoTelhado.vistaGoogle)}
                    dados={levantamentoTelhado}
                    propostaId={propostaSalva.current?.id}
                    chave={config?.google_maps_browser_key}
                    googleAtivo={config?.google_maps_ativo !== false}
                  />
                )}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                  <div>
                    <strong>{levantamentoTelhado.placas.length} módulos</strong> · {areaSuperficie(levantamentoTelhado).toFixed(1)} m² de superfície · {levantamentoTelhado.modulo.modelo} ({levantamentoTelhado.modulo.potenciaWp} Wp)
                  </div>
                  <span className="text-[10px] text-slate-400">Potência recalculada pela quantidade do levantamento</span>
                </div>
              </div>
            )}

            {editorManualAberto && (
              <LevantamentoManual
                valor={levantamentoTelhado}
                potenciaWp={moduloWp}
                hsp={hsp}
                perdasPct={perdasPct}
                alvo={modulosQtdCalculada}
                enderecoBusca={consultaAuto || [endereco, numeroEndereco, cidade].filter(Boolean).join(', ')}
                coordenadaInicial={coordenadaLead ?? undefined}
                leadId={linkedLead?.id}
                propostaId={propostaSalva.current?.id}
                podeAnexarCaptura={currentUser.cargo === 'Administrador' || (!!currentUser.permissoes?.anexarDocumentos && !!currentUser.permissoes?.emitirPropostas)}
                salvandoVista={salvamentoEmCurso || salvarVistaPendente}
                onSalvarVista={(l, manterAberto = true) => {
                  manterEditorCaptura.current = manterAberto;
                  setLevantamentoTelhado(l);
                  setModuloWp(l.modulo.potenciaWp);
                  if (l.placas.length) setDadosTelhado(null);
                  setSalvarVistaPendente(true);
                }}
                chaveMaps={config?.google_maps_browser_key}
                googleAtivo={config?.google_maps_ativo !== false}
                onCancelar={() => setEditorManualAberto(false)}
                onAplicar={l => {
                  setLevantamentoTelhado(l);
                  setModuloWp(l.modulo.potenciaWp);
                  setDadosTelhado(null);
                  setEditorManualAberto(false);
                  showToast('Levantamento aplicado', 'success', 'Potência e geração recalculadas. Confira os equipamentos do kit.');
                }}
              />
            )}
          </div>

          {/* Section 3: Kit de equipamentos e serviços */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 ${secaoVisivel === 3 ? '' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#004276] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Kit de Equipamentos e Serviços</h3>
                  <p className="text-[11px] text-slate-400">Composição do sistema, módulos, inversores e serviços inclusos</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAbaCatalogo(kits.length > 0 ? 'kit' : 'produto');
                  setIsAddItemOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#004276] text-xs font-bold rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar item</span>
              </button>
            </div>

            {/* Tabela do Kit */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="tabela-mobile w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3">DESCRIÇÃO</th>
                    <th className="py-2.5 px-3 text-center w-24">QTD.</th>
                    <th className="py-2.5 px-3 text-right w-32">VALOR UNIT.</th>
                    <th className="py-2.5 px-3 text-right w-32">TOTAL</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kitItens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                        Nenhum item adicionado à proposta. Clique em &quot;Adicionar item&quot; para selecionar um kit ou produto.
                      </td>
                    </tr>
                  ) : (
                    kitItens.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50/80 transition">
                          <td data-label="DESCRIÇÃO" className="py-2 px-3 font-semibold text-slate-900">
                            {item.kitId && (
                              <span className="bg-blue-50 text-[#004276] font-bold px-1.5 py-0.5 rounded text-[9px] mr-1.5 align-middle border border-blue-200">
                                KIT
                              </span>
                            )}
                            {item.descricao}
                            {avisoPaineisAtual && (item.kitId || contarPaineis([item]) > 0) && (
                              <p role="status" className="mt-0.5 text-[10px] font-medium text-red-600">
                                {avisoPaineisAtual}
                              </p>
                            )}
                          </td>
                          <td data-label="QTD." className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qtd}
                              onChange={(e) => handleUpdateItemQtd(item.id, Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs focus:outline-none focus:border-[#004276]"
                            />
                          </td>
                          <td data-label="VALOR UNIT." className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.valorUnit}
                              onChange={(e) => handleUpdateItemValor(item.id, Number(e.target.value))}
                              className="w-24 px-1.5 py-1 text-right bg-white border border-slate-200 rounded-lg font-bold text-xs focus:outline-none focus:border-[#004276]"
                            />
                          </td>
                          <td data-label="TOTAL" className="py-2 px-3 text-right font-bold text-slate-900">
                            R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td data-label="" className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Composição do kit */}
                        {(item.componentes ?? []).map((c) => (
                          <tr key={c.id} className="bg-slate-50/50 text-slate-500">
                            <td data-label="DESCRIÇÃO" className="py-1.5 px-3 pl-8 text-[11px]">↳ {c.descricao}</td>
                            <td data-label="QTD." className="py-1.5 px-3 text-center text-[11px] font-bold">
                              {c.qtd.toLocaleString('pt-BR')}
                            </td>
                            <td data-label="VALOR UNIT." className="py-1.5 px-3 text-right text-[11px] italic text-slate-400">incluso no kit</td>
                            <td data-label="TOTAL" className="py-1.5 px-3 text-right text-[11px] text-slate-400">—</td>
                            <td className="py-1.5 px-2"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>

              {/* Totalizadores e Negociação */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-500">Soma dos itens</span>
                  <span className="font-bold text-slate-700">
                    R$ {somaDosItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-600">Valor negociado (ajuste livre)</span>
                    <p className="text-[10px] text-slate-400">Quando informado, substitui o valor final.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorNegociado ?? ''}
                      placeholder={somaDosItens.toFixed(2)}
                      onChange={(e) => setValorNegociado(
                        e.target.value === '' ? null : Number(e.target.value),
                      )}
                      className="w-32 px-2.5 py-1 text-right bg-white border border-slate-300 rounded-lg font-bold text-xs focus:outline-none focus:border-[#004276]"
                    />
                    {valorNegociado !== null && (
                      <button
                        type="button"
                        onClick={() => setValorNegociado(null)}
                        className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline"
                      >
                        limpar
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    Total do investimento
                    {valorNegociado !== null && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                        NEGOCIADO
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-black text-[#004276]">
                    R$ {valorTotalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Forma de pagamento */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 ${secaoVisivel === 4 ? '' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#004276] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Modalidades de Pagamento</h3>
                  <p className="text-[11px] text-slate-400">Condições comerciais e prazos para simulação no PDF</p>
                </div>
              </div>
            </div>

            {/* Segmented Selector */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFormaPagamento('avista')}
                className={`py-2 rounded-lg font-bold text-xs transition ${
                  formaPagamento === 'avista'
                    ? 'bg-white text-[#004276] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                À vista (desconto)
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento('cartao')}
                className={`py-2 rounded-lg font-bold text-xs transition ${
                  formaPagamento === 'cartao'
                    ? 'bg-white text-[#004276] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cartão de crédito
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento('financiamento')}
                className={`py-2 rounded-lg font-bold text-xs transition ${
                  formaPagamento === 'financiamento'
                    ? 'bg-white text-[#004276] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Financiamento
              </button>
            </div>

            {/* Modo Financiamento */}
            {formaPagamento === 'financiamento' && (
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ENTRADA (%)</label>
                    <input
                      type="number"
                      value={entradaFinanciamentoPct}
                      onChange={(e) => setEntradaFinanciamentoPct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#004276]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PARCELAS</label>
                    <select
                      value={parcelasFinanciamento}
                      onChange={(e) => setParcelasFinanciamento(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#004276]"
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">JUROS MÊS (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={jurosFinanciamentoMesPct}
                      onChange={(e) => setJurosFinanciamentoMesPct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#004276]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">AGENTE / BANCO</label>
                    <input
                      type="text"
                      value={bancoFinanciamento}
                      onChange={(e) => setBancoFinanciamento(e.target.value)}
                      placeholder="Ex: Santander, BV"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-[#004276]"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200 grid grid-cols-3 gap-2 text-center font-bold">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">VALOR DA ENTRADA</span>
                    <span className="text-slate-800 text-xs sm:text-sm">R$ {entradaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">PARCELA ({parcelasFinanciamento}X)</span>
                    <span className="text-[#004276] text-xs sm:text-sm font-black">R$ {pmtParcelaFinanciamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">TOTAL DO FINANCIAMENTO</span>
                    <span className="text-slate-800 text-xs sm:text-sm">R$ {(entradaValor + pmtParcelaFinanciamento * parcelasFinanciamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modo À Vista */}
            {formaPagamento === 'avista' && (
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">DESCONTO (%)</label>
                    <input
                      type="number"
                      value={descontoAvistaPct}
                      onChange={(e) => setDescontoAvistaPct(Number(e.target.value))}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 w-28 text-center"
                    />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-slate-700">
                      Economia extra: <strong className="text-emerald-700">R$ {((valorTotalInvestimento * descontoAvistaPct) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </p>
                    <p className="text-sm font-black text-[#004276]">
                      Total com desconto: R$ {(valorTotalInvestimento * (1 - descontoAvistaPct / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formaPagamento === 'cartao' && (
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">PARCELAS CARTÃO</label>
                    <select
                      value={parcelasCartao}
                      onChange={(e) => setParcelasCartao(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                    >
                      <option value="0">Selecione o prazo</option>
                      <option value="6">6x</option>
                      <option value="10">10x</option>
                      <option value="12">12x</option>
                      <option value="18">18x</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">TAXA DO CARTÃO (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={taxaCartaoPct}
                      onChange={(e) => setTaxaCartaoPct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Observações & Personalização do PDF */}
          <div className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 ${secaoVisivel === 5 ? '' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#004276] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Observações & Responsável Técnico</h3>
                  <p className="text-[11px] text-slate-400">Assinatura técnica da proposta, cláusulas e logo customizada</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Observações */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500">
                  OBSERVAÇÕES / CLÁUSULAS DA PROPOSTA
                </label>
                <textarea
                  rows={4}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Escreva observações específicas sobre o projeto, vigência, desconto especial ou telhado..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#004276] leading-relaxed font-medium"
                />
              </div>

              {/* Responsável Técnico & Logo */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    RESPONSÁVEL TÉCNICO
                  </label>
                  <select
                    aria-label="Responsável técnico"
                    value={responsavelTecnicoId}
                    onChange={e => selecionarResponsavel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004276]"
                  >
                    <option value="">{responsavelTecnico && !responsavelTecnicoId ? responsavelTecnico + ' (salvo na proposta)' : 'Selecione um usuário'}</option>
                    {responsavelTecnicoId && !usuariosTecnicos.some(u => u.id === responsavelTecnicoId) && (
                      <option value={responsavelTecnicoId}>{responsavelTecnico} (indisponível)</option>
                    )}
                    {usuariosTecnicos.filter(u => u.status === 'ativo' || u.id === responsavelTecnicoId).map(u => (
                      <option key={u.id} value={u.id} disabled={u.status !== 'ativo' || !u.tipoProfissional || !(u.tipoProfissional === 'tecnico' ? u.crt : u.crea)?.trim()}>
                        {u.nome}{u.tipoProfissional ? ' — ' + (u.tipoProfissional === 'tecnico' ? 'CRT ' + (u.crt || 'não informado') : 'CREA ' + (u.crea || 'não informado')) : ' — sem registro'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    {conselhoProfissional} (REGISTRO)
                  </label>
                  <input
                    aria-label="Registro do responsável técnico"
                    readOnly
                    value={crea}
                    placeholder="Preenchido pelo usuário selecionado"
                    className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  />
                  {erroUsuarios && <p className="text-[10px] text-rose-600 mt-1">Não foi possível carregar os usuários.</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    URL LOGO CUSTOMIZADA (OPCIONAL)
                  </label>
                  <input
                    type="url"
                    value={customLogoUrl}
                    onChange={(e) => setCustomLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#004276]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Navegação Celular */}
          <div className="md:hidden flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSecaoVisivel((n) => Math.max(1, n - 1))}
              disabled={secaoVisivel === 1}
              className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setSecaoVisivel((n) => Math.min(PASSOS.length, n + 1))}
              disabled={secaoVisivel === PASSOS.length}
              className="flex-1 py-2 rounded-xl bg-[#004276] text-white font-bold text-xs disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR (STICKY ON DESKTOP) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-4 space-y-3.5 self-start">
          
          {/* Card Dark Blue "RESUMO DA PROPOSTA" */}
          <div className="bg-gradient-to-br from-[#004276] to-[#003159] text-white p-5 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#FFD100] uppercase tracking-wider">
                RESUMO DA PROPOSTA
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-blue-100">
                {coberturaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% cobertura
              </span>
            </div>

            <div>
              <span className="text-[10px] text-blue-200 font-medium uppercase tracking-wider">INVESTIMENTO TOTAL</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                R$ {valorTotalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/10 pt-3">
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-blue-200 text-[10px] block">Potência</span>
                <span className="font-extrabold text-white text-sm">{potenciaKwpCalculada} kWp</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-blue-200 text-[10px] block">Geração Média</span>
                <span className="font-extrabold text-white text-sm">{geracaoMediaKwh.toLocaleString('pt-BR')} kWh</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-blue-200 text-[10px] block">Área Estimada</span>
                <span className="font-extrabold text-white text-sm">{areaEstimadaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-blue-200 text-[10px] block">Perdas</span>
                <span className="font-extrabold text-white text-sm">{perdasPct}%</span>
              </div>
            </div>

            {!preservarLegado && !calculoSolar.completo && (
              <p role="status" className="text-[11px] text-amber-300 font-semibold bg-amber-500/20 p-2 rounded-lg">
                Pendente de preenchimento de parâmetros
              </p>
            )}
          </div>

          {/* Card "Economia estimada" */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Economia Estimada</h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Após parcelas / mês</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  R$ {economiaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Operacional / ano</span>
                <span className="font-bold text-slate-800">
                  R$ {economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Saldo em 25 anos</span>
                <span className="font-bold text-slate-800">
                  R$ {economia25Anos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-900 font-bold text-xs mt-2 flex justify-between items-center">
                <span className="text-[11px]">Payback estimado</span>
                <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                  {paybackAnos == null ? 'Sem retorno no período' : `${paybackAnos.toFixed(1)} anos`}
                </span>
              </div>
            </div>
          </div>

          {/* Card de Ações Rápidas no Sidebar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
            <button
              onClick={handleSaveDraft}
              disabled={salvamentoEmCurso}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {salvamentoEmCurso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-slate-500" />}
              <span>{editando ? 'Salvar alterações' : 'Salvar rascunho'}</span>
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={salvamentoEmCurso}
              className="w-full py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Gerar proposta em PDF</span>
            </button>
          </div>

          {/* Card "CONDIÇÕES COMERCIAIS" */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl text-[11px] space-y-1 text-amber-900">
            <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">CONDIÇÕES COMERCIAIS</h4>
            <p className="leading-relaxed text-amber-800">
              Válida por {paramNum(config, 'proposta.validade_dias', 10)} dias · despacho em até 30 dias · instalação agendada após a entrega dos equipamentos · crédito sujeito a aprovação.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Add Catalog Kit / Product */}
      {isAddItemOpen && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <ModalCabecalho
              icone={Boxes}
              titulo="Adicionar à proposta"
              subtitulo="Kit de instalação ou produto avulso"
              onFechar={() => setIsAddItemOpen(false)}
            />

            <div className="modal-corpo campos-modal p-5 space-y-4 text-xs">
              <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                <button
                  type="button"
                  onClick={() => setAbaCatalogo('kit')}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${
                    abaCatalogo === 'kit' ? 'bg-white text-[#004276] shadow' : 'text-slate-500'
                  }`}
                >
                  Kit de instalação
                </button>
                <button
                  type="button"
                  onClick={() => setAbaCatalogo('produto')}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${
                    abaCatalogo === 'produto' ? 'bg-white text-[#004276] shadow' : 'text-slate-500'
                  }`}
                >
                  Produto avulso
                </button>
              </div>

              {abaCatalogo === 'kit' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1.5">Selecione o kit</label>
                    <select
                      value={selectedCatalogKitId}
                      onChange={(e) => setSelectedCatalogKitId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="">Selecione…</option>
                      {kits.map(k => (
                        <option key={k.id} value={k.id}>
                          {k.nome} — R$ {k.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                    {kits.length === 0 && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2">
                        Nenhum kit cadastrado. Monte os kits em Parâmetros &gt; Kits.
                      </p>
                    )}
                  </div>

                  {/* Prévia da composição: o que vai ser listado no PDF e
                      baixado do estoque quando a obra for executada. */}
                  {(() => {
                    const kit = kits.find(k => k.id === selectedCatalogKitId);
                    if (!kit) return null;
                    return (
                      <div className="border border-slate-200 rounded-xl p-3 space-y-1 bg-slate-50">
                        <p className="font-bold text-slate-600 uppercase text-[10px]">Composição</p>
                        {kit.itens.map(i => (
                          <div key={i.id} className="flex justify-between text-slate-600">
                            <span className="truncate">{i.produtoNome}</span>
                            <span className="font-bold shrink-0 ml-2">{i.qtd.toLocaleString('pt-BR')} un</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="rodape-modal barra-acoes">
                    <button
                      type="button"
                      onClick={() => setIsAddItemOpen(false)}
                      className="btn-modal-cancelar"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!selectedCatalogKitId}
                      onClick={handleAddCatalogKit}
                      className="btn-modal-salvar"
                    >
                      Adicionar Kit
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1.5">Selecione o produto</label>
                    <select
                      value={selectedCatalogProdutoId}
                      onChange={(e) => setSelectedCatalogProdutoId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="">Selecione…</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.fornecedorNome})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1.5">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={qtdAvulso}
                        onChange={(e) => setQtdAvulso(Number(e.target.value))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1.5">Valor unitário (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorAvulso}
                        onChange={(e) => setValorAvulso(Number(e.target.value))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-right"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    O valor é digitado aqui: o cadastro de produto não guarda preço de venda.
                    Também dá para ajustar depois, na tabela.
                  </p>

                  <div className="rodape-modal barra-acoes">
                    <button
                      type="button"
                      onClick={() => setIsAddItemOpen(false)}
                      className="btn-modal-cancelar"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!selectedCatalogProdutoId || !(qtdAvulso > 0)}
                      onClick={handleAddCatalogItem}
                      className="btn-modal-salvar"
                    >
                      Adicionar Produto
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
