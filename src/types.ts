export type UserRole = 'Administrador' | 'Vendedor' | 'Financeiro' | 'Engenheiro' | 'Instalador';
export type UserStatus = 'ativo' | 'inativo' | 'Ativo' | 'Inativo';

export interface UserPermissions {
  criarEditarLeads: boolean;
  emitirPropostas: boolean;
  anexarDocumentos: boolean;
  emitirContratos: boolean;
  verLancamentosFinanceiro: boolean;
  gerenciarUsuarios: boolean;
  gerenciarObras: boolean;
  verAuditoria: boolean;
  gerenciarSite: boolean;
  usarWhatsapp: boolean;
  usuarioAtivo: boolean;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  telefone?: string;
  perfil?: UserRole;
  cargo: UserRole;
  status: 'ativo' | 'inativo';
  situacao?: UserStatus;
  ultimoAcesso: string;
  dataCriacao: string;
  permissoes?: UserPermissions;
}

/** Etapas do funil, na ordem em que acontecem (ver STAGES em LeadsKanbanView). */
export type LeadStage =
  | 'Novo lead'
  | 'Contato feito'
  | 'Proposta enviada'
  | 'Visita técnica'
  | 'Negociação'
  | 'Fechado';

export interface DocumentoItem {
  id: string;
  nome: string;
  pasta: string;
  /** Id da pasta no banco. A tela filtra por ele, e não pelo nome, para que duas pastas renomeadas não se confundam. */
  pastaId: number | null;
  tipo: string;
  /** Já formatado ("1,4 MB") — o banco guarda o número; ver tamanhoBytes. */
  tamanho: string;
  tamanhoBytes: number;
  enviadoPor: string;
  dataEnvio: string;
}

/** Uma pasta de documentos com a contagem REAL do lead (SolarCosta_vw_PastasDocumentos). */
export interface PastaDocumento {
  id: number;
  nome: string;
  qtdArquivos: number;
  /** Data do envio mais recente, ou undefined se a pasta estiver vazia. */
  ultimoEnvio?: string;
}

export interface HistoricoItem {
  id: string;
  data: string;
  descricao: string;
  usuario: string;
}

export interface Lead {
  id: string;
  numero: string;
  nome: string;
  cpfCnpj: string;
  rgInscricao?: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
  cep?: string;
  /** Coordenada do imóvel, reaproveitada ao gerar a proposta (V005). */
  latitude?: number;
  longitude?: number;
  placeId?: string;
  consumoKwh: number;
  concessionaria: string;
  telhado: string;
  origem: string;
  responsavel: string;
  etapa: LeadStage;
  valor: number;
  propostaVinculadaId?: string;
  dataCriacao: string;
  documentos: DocumentoItem[];
  historico: HistoricoItem[];
}

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  estado?: string;
  contato: string;
  telefone: string;
  email?: string;
  site?: string;
  prazoEntrega?: string;
  produtosQtd?: number;
  produtosCount?: number;
}

/**
 * O código do tipo, como gravado no banco — é o que `SolarCosta_TiposProduto`
 * usa como chave e o que a API aceita ao salvar (ver catalogo.routes.ts).
 */
export type TipoProdutoSlug =
  | 'modulo'
  | 'inversor'
  | 'estrutura'
  | 'cabo'
  | 'protecao'
  | 'acessorio'
  | 'outro';

/**
 * `Produto.tipo` carrega o RÓTULO ('Estrutura'), não o slug: é o que a tela
 * exibe, e `paraProduto`/`deProduto` (services/mappers.ts) fazem a tradução nas
 * duas pontas. Um formulário que alimenta um <select> de slugs precisa
 * converter antes — use `slugDoTipoProduto`.
 */
export type TipoProduto =
  | TipoProdutoSlug
  | 'Módulo fotovoltaico'
  | 'Inversor'
  | 'Estrutura'
  | 'Proteção'
  | 'Cabeamento'
  | 'Acessório'
  | 'Outro';

export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoProduto;
  fornecedorId: string;
  fornecedorNome: string;
  /**
   * Custo interno, opcional. NÃO é o preço de venda: quem precifica é o kit
   * (ver `Kit`), e produto avulso tem o valor digitado na própria proposta.
   * A coluna continua no banco, mas o cadastro não a pede mais.
   */
  preco?: number;
  estoque: number;
  unidade?: string;
  potencia?: string;
  potenciaWp?: number;
}

/** Produto que compõe um kit, com a quantidade usada. */
export interface KitItem {
  id: string;
  produtoId: string;
  produtoNome: string;
  qtd: number;
  /** false quando o produto foi excluído do catálogo depois de entrar no kit. */
  produtoAtivo?: boolean;
}

/**
 * Kit de instalação vendável: um nome e UM preço fechado.
 *
 * O preço não é a soma dos componentes — embute serviço e margem —, por isso é
 * campo próprio e não cálculo.
 */
export interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  preco: number;
  itens: KitItem[];
  /** Soma de `potenciaWp * qtd` dos componentes, calculada pela view. */
  potenciaWpTotal?: number;
}

export interface PropostaItem {
  id: string;
  produtoId?: string;
  /** Preenchido quando a linha veio de um kit do catálogo. */
  kitId?: string;
  descricao: string;
  qtd: number;
  valorUnit: number;
  total: number;
  /**
   * Produtos que compõem o kit. Entram no PDF e na baixa de estoque da obra,
   * mas com `valorUnit` 0: o preço do kit está nesta linha-pai, então somar só
   * o topo da lista já dá o total da proposta.
   */
  componentes?: PropostaItem[];
  /**
   * Quantidade por unidade de kit, só no estado da tela. Mudar a qtd do kit
   * reescala os componentes a partir dela, sem acumular erro de arredondamento.
   */
  qtdUnitaria?: number;
}

export type FormaPagamentoType = 'avista' | 'cartao' | 'financiamento';

/** Ponto no mapa. Mesmo formato que a Solar API usa, para não converter à toa. */
export interface PontoGeo {
  latitude: number;
  longitude: number;
}

/**
 * Um módulo desenhado sobre o telhado. Congelado na proposta pelo mesmo motivo
 * que potenciaKwp e economiaMensal já são: a figura impressa não pode mudar
 * porque o kit foi reajustado ou o Google reprocessou a imagem depois.
 */
export interface ModuloLayout {
  /** Os 4 cantos em ordem horária. */
  cantos: PontoGeo[];
  centro: PontoGeo;
  /** Índice da água do telhado onde o módulo ficou. */
  segmento: number;
  azimuteGraus: number;
}

/** Medida física da placa usada para montar o layout. */
export interface MedidaModulo {
  larguraM: number;
  alturaM: number;
  espacamentoM: number;
}

/** Água do telhado identificada pela Solar API. */
export interface SegmentoLayout {
  indice: number;
  azimuteGraus: number;
  inclinacaoGraus: number;
  areaM2: number;
}

export interface Proposta {
  levantamentoTelhado?: import('./utils/levantamentoTelhado').LevantamentoTelhado;
  id: string;
  numero: string;
  leadId: string;
  clienteNome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  concessionaria: string;
  telhado: string;
  consumoKwh: number;
  tarifaKwh: number;
  hsp: number;
  perdasPct: number;
  moduloWp: number;
  /**
   * Despesas fixas da conta de energia (V014), em R$/mês — o que a geração NÃO
   * compensa. São elas que a folha de despesas mensais soma de cada lado:
   *
   *   sem SFCR → consumoKwh × tarifaKwh + iluminacaoPublicaSemSfcr
   *   com SFCR → custoDisponibilidade + iluminacaoPublicaComSfcr + prestação
   *
   * A CIP aparece duas vezes de propósito: é cobrada por faixa de consumo, e
   * com o sistema compensando o consumo faturado a faixa muda. Opcionais
   * porque proposta anterior à V014 não as tem — aí a folha sai zerada, que é
   * melhor do que imprimir um valor que ninguém negociou.
   */
  iluminacaoPublicaSemSfcr?: number;
  custoDisponibilidade?: number;
  iluminacaoPublicaComSfcr?: number;
  potenciaKwp: number;
  modulosQtd: number;
  areaEstimadaM2: number;
  geracaoMediaKwh: number;
  coberturaPct: number;
  kitItens: PropostaItem[];
  valorTotal: number;
  /**
   * Valor negociado, que SOBRESCREVE a soma dos itens em `valorTotal`.
   * `null`/ausente = não negociado, usa a soma. Quem aplica a regra é o
   * trigger do banco (V018), então `valorTotal` já chega resolvido da API.
   */
  valorTotalAjustado?: number | null;
  economiaMensal: number;
  economiaAnual: number;
  economia25Anos: number;
  paybackAnos: number;
  formaPagamento: FormaPagamentoType;
  descontoAvistaPct?: number;
  parcelasCartao?: number;
  taxaCartaoPct?: number;
  entradaFinanciamentoValor?: number;
  entradaFinanciamentoPct?: number;
  parcelasFinanciamento?: number;
  jurosFinanciamentoMesPct?: number;
  bancoFinanciamento?: string;
  dataCriacao: string;
  status: 'rascunho' | 'enviada' | 'aceita';
  observacoes?: string;
  customLogoUrl?: string;

  /**
   * Responsável técnico impresso na folha de equipamentos (V017).
   *
   * Snapshot da proposta, não do cadastro: trocar o engenheiro aqui vale para
   * ESTA proposta e não mexe nas já emitidas — o contrário do que acontecia
   * quando o par vinha só de SolarCosta_Empresa, já que o PDF é remontado a
   * cada impressão. Ausente = imprime o responsável da empresa, que é como
   * toda proposta anterior à V017 continua saindo.
   */
  responsavelTecnico?: string;
  crea?: string;

  // Endereço de instalação em partes (V006). O CEP dispara a busca por
  // satélite e o número é o que a faz cair sobre a edificação — os dois
  // precisam sobreviver ao salvamento, ou reabrir a proposta recomeça pelo
  // ponto aproximado.
  cep?: string;
  /** Número do IMÓVEL. `numero` (acima) é o número da proposta. */
  numeroEndereco?: string;

  // Localização e layout do telhado (V005). Todos opcionais: proposta sem
  // busca por satélite continua válida, só não imprime a página do telhado.
  latitude?: number;
  longitude?: number;
  placeId?: string;
  enderecoFormatado?: string;
  edificacaoId?: string;
  mapaZoom?: number;
  /** Data da foto de satélite (ISO). Vai impressa: costuma ter anos. */
  telhadoImagemData?: string;
  /** Área real do telhado medida pelo Google — não confundir com areaEstimadaM2. */
  telhadoAreaM2?: number;
  layoutModulos?: ModuloLayout[];
  layoutSegmentos?: SegmentoLayout[];
  /**
   * As posições em layoutModulos saíram do editor de telhado, não do
   * empacotamento automático. Muda o que acontece quando o kit muda de
   * tamanho: em vez de refazer o layout, só a diferença é acertada.
   */
  layoutAjusteManual?: boolean;
  /** Medida da placa usada no layout, quando difere dos parâmetros do sistema. */
  layoutModulo?: MedidaModulo;
}

/*
 * Contrato no modelo oficial da Solar Costa (V024). O texto das cláusulas mora
 * em src/contrato/modeloSolarCosta.ts; aqui ficam só os DADOS que variam de um
 * contrato para outro. Os dois objetos vão para o banco como jsonb, em
 * camelCase, do jeito que estão — o zod de server/src/schemas/contrato.ts é o
 * espelho destas interfaces.
 */

/** Seções do modelo cujo texto pode ser personalizado em um contrato. */
export type ChaveSecaoContrato =
  | 'preambulo'
  | 'considerandos'
  | 'clausula_1'
  | 'clausula_2'
  | 'clausula_3'
  | 'clausula_4'
  | 'clausula_5'
  | 'clausula_6'
  | 'clausula_7'
  | 'clausula_8'
  | 'clausula_9'
  | 'clausula_10'
  | 'encerramento';

/** Cópia da empresa e do representante legal no momento da emissão. */
export interface ContratadaContrato {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  representanteNome: string;
  representanteNacionalidade: string;
  representanteRg: string;
  representanteCpf: string;
}

/** Uma linha da tabela da cláusula 7.2. */
export interface GarantiaContrato {
  equipamento: string;
  prazo: string;
  causa: string;
}

export interface TestemunhaContrato {
  nome: string;
  rg: string;
  cpf: string;
}

/** Uma linha do Anexo I. `qtd` é texto: o modelo imprime "08" e há itens sem quantidade. */
export interface ItemAnexoContrato {
  qtd: string;
  descricao: string;
}

/**
 * Tudo o que o modelo deixa variar. Plano (sem objetos opcionais aninhados)
 * de propósito: o tsconfig da raiz não é strict e degrada a inferência do zod
 * em objetos aninhados.
 */
export interface TermosContrato {
  contratanteNacionalidade: string;
  contratanteEmail: string;
  /** Cláusula 2.1. */
  enderecoEntrega: string;
  /** Cláusulas 2.3 e 2.3.1. */
  prazoDespachoDias: number;
  /** Cláusula 2.4 (dias corridos). */
  prazoExecucaoDias: number;
  /** Vazio = calculado a partir do valor total. */
  valorExtenso: string;
  /** Cláusula 3.1, texto livre. */
  condicoesPagamento: string;
  jurosMoraMesPct: number;
  multaMoratoriaPct: number;
  garantias: GarantiaContrato[];
  /** Cláusula 7.3. */
  garantiaLegalDias: number;
  /** Cláusula 9.1 a. */
  forcaMaiorDias: number;
  /** Cláusula 9.1 b. */
  prazoCuraDias: number;
  multaRescisoriaContratantePct: number;
  multaRescisoriaContratadaPct: number;
  /** Cláusula 9.3 (dias úteis). */
  prazoPagamentoEstruturasDiasUteis: number;
  /** Cláusula 9.4. */
  concessionaria: string;
  /** Cláusula 10.8. */
  emailContratada: string;
  /** Cláusula 10.12 — comarca. */
  foro: string;
  /** "Belo Horizonte/MG" do fecho. */
  localAssinatura: string;
  /** AAAA-MM-DD; vazio imprime a data em branco. */
  dataDocumento: string;
  numeroVias: number;
  testemunhas: TestemunhaContrato[];
  anexoItens: ItemAnexoContrato[];
  /** Só as seções personalizadas neste contrato; o resto segue o modelo. */
  textos: Partial<Record<ChaveSecaoContrato, string>>;
}

export interface Contrato {
  id: string;
  numero: string;
  leadId: string;
  /** Proposta de origem; vazio quando o contrato foi preenchido à mão. */
  propostaId?: string;
  /** null = contrato legado, anterior ao modelo Solar Costa (V024). */
  modeloVersao?: number | null;
  contratada?: ContratadaContrato | null;
  termos?: TermosContrato | null;
  /** DD/MM/AAAA. */
  dataAssinatura?: string;
  clienteNome: string;
  cpfCnpj: string;
  rgInscricao: string;
  endereco: string;
  cep: string;
  telefone: string;
  potenciaKwp: number;
  modulosQtd: number;
  moduloModelo: string;
  inversorModelo: string;
  estrutura: string;
  prazoExecucao: string;
  localInstalacao: string;
  valorTotal: number;
  formaPagamento: string;
  entrada: string;
  parcelasInfo: string;
  bancoAgente: string;
  primeiroVencimento: string;
  multaAtraso: string;
  foroEleito: string;
  garantias: {
    modulos: string;
    inversores: string;
    instalacao: string;
    homologacao: string;
  };
  responsavelTecnico: string;
  crea: string;
  clausulas: string[];
  status: 'aguardando' | 'assinado';
  dataEmissao: string;
  /** Agregado a partir dos boletos a_receber vinculados. Null = nenhuma cobrança gerada ainda. */
  situacaoPagamento?: 'pago' | 'aguardando' | 'vencido' | null;
}

export interface Boleto {
  id: string;
  numeroDocumento: string;
  linhaDigitavel: string;
  /** "Nosso número" no Banco do Brasil. Vazio até a emissão pela API (ver onEmitirBoletoBB). */
  nossoNumero?: string;
  /** Copia-e-cola (EMV) do QR Pix vinculado ao boleto (bolepix), quando emitido com Pix. */
  pixQrcode?: string;
  /** Código de barras FEBRABAN (44 dígitos), p/ desenhar o barcode no PDF. Só existe após emissão pela API. */
  codigoBarraNumerico?: string;
  clienteNome: string;
  cpfCnpj?: string;
  valor: number;
  parcela: string;
  vencimento: string;
  situacao: 'pago' | 'em_aberto' | 'vencido';
  tipo: 'A receber' | 'A pagar';
  categoria: string;
  obraRef?: string;
  dataPagamento?: string;
  /** Contrato de origem, quando emitida pela aba "Cobranças". Ausente = boleto avulso. */
  contratoId?: string;
}

export interface LancamentoFinanceiro {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  obraRef: string;
  valor: number;
  tipo: 'receita' | 'despesa';
}

export type TipoAgendamento = 'visita_tecnica' | 'reuniao' | 'vistoria';
export type StatusAgendamento = 'agendado' | 'realizado' | 'cancelado';

export interface Agendamento {
  id: string;
  leadId: string;
  leadNome: string;
  tipo: TipoAgendamento;
  titulo: string;
  data: string; // YYYY-MM-DD
  horarioInicio: string; // HH:MM
  horarioFim: string; // HH:MM
  endereco: string;
  cidade: string;
  responsavel: string;
  status: StatusAgendamento;
  observacoes?: string;
  dataCriacao?: string;
}

// ===== Obras / Instalação (pós-venda) =====
export type ObraEtapa =
  | 'Aguardando compra'
  | 'Projeto / ART'
  | 'Homologação'
  | 'Instalação'
  | 'Vistoria / troca'
  | 'Concluída';

export type ObraStatus = 'em_andamento' | 'concluida' | 'atrasada' | 'pausada';

// Checklist do processo de homologação de geração distribuída (Brasil)
export interface HomologacaoChecklist {
  solicitacaoAcesso: boolean;   // documentação enviada à distribuidora
  parecerAcesso: boolean;       // parecer de acesso aprovado
  vistoriaAgendada: boolean;    // vistoria agendada
  vistoriaAprovada: boolean;    // vistoria aprovada
  trocaMedidor: boolean;        // troca do medidor bidirecional
  relatorioConexao: boolean;    // TRC / energização do sistema
}

export interface Obra {
  id: string;
  numero: string;               // ex.: OBRA 0184
  contratoId?: string;
  leadId?: string;
  propostaId?: string;
  clienteNome: string;
  cidade: string;
  endereco: string;
  concessionaria: string;
  potenciaKwp: number;
  modulosQtd: number;
  moduloModelo: string;
  inversorModelo: string;
  responsavelTecnico: string;   // engenheiro
  equipeInstalacao: string;     // instalador / equipe de campo
  etapa: ObraEtapa;
  status: ObraStatus;
  valorObra: number;
  dataInicio: string;           // YYYY-MM-DD
  previsaoConclusao: string;    // YYYY-MM-DD
  dataConclusao?: string;       // YYYY-MM-DD
  homologacao: HomologacaoChecklist;
  kitItens?: PropostaItem[];    // snapshot do kit consumido do estoque
  estoqueBaixado?: boolean;     // guarda de idempotência da baixa de estoque
  observacoes?: string;
  historico: HistoricoItem[];
}

/* ============================ AUDITORIA ============================ */

export type AuditAction =
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'mudanca_etapa'
  | 'baixa'
  | 'login'
  | 'logout'
  | 'exportar';

/** Tipo de entidade afetada por uma ação registrada na trilha de auditoria. */
export type AuditEntity =
  | 'Lead'
  | 'Proposta'
  | 'Contrato'
  | 'Boleto'
  | 'Lançamento'
  | 'Usuário'
  | 'Fornecedor'
  | 'Produto'
  | 'Agendamento'
  | 'Obra'
  | 'Sessão';

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO 8601
  usuario: string;
  usuarioId?: string;
  acao: AuditAction;
  entidade: AuditEntity;
  entidadeId?: string;
  /** Rótulo legível do que foi alterado (ex.: nome do cliente / nº do documento). */
  alvo: string;
  /** Descrição livre e opcional com o antes/depois relevante. */
  detalhes?: string;
}

/* =========================== NOTIFICAÇÕES =========================== */

export type NotificationCategory =
  | 'boleto_vencido'
  | 'lead_sem_contato'
  | 'visita_hoje';

export type NotificationPriority = 'alta' | 'media' | 'baixa';

export interface AppNotification {
  id: string;
  categoria: NotificationCategory;
  prioridade: NotificationPriority;
  titulo: string;
  descricao: string;
  /** Texto curto de tempo/estado (ex.: "vencido há 16 dias", "09:00–10:30"). */
  meta?: string;
  /** Aba de destino ao clicar. */
  destinoTab?: string;
  /** Id do lead a abrir (quando aplicável). */
  leadId?: string;
}
