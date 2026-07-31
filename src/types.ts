export type UserRole = 'Administrador' | 'Vendedor' | 'Financeiro' | 'Engenheiro' | 'Instalador';
export type UserStatus = 'ativo' | 'inativo' | 'Ativo' | 'Inativo';

export interface UserPermissions {
  criarEditarLeads: boolean;
  emitirPropostas: boolean;
  anexarDocumentos: boolean;
  emitirContratos: boolean;
  verLancamentosFinanceiro: boolean;
  gerenciarUsuarios: boolean;
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

export type LeadStage = 
  | 'Novo lead' 
  | 'Contato feito' 
  | 'Visita técnica' 
  | 'Proposta enviada' 
  | 'Negociação' 
  | 'Fechado';

export interface DocumentoItem {
  id: string;
  nome: string;
  pasta: string;
  tipo: string;
  tamanho: string;
  enviadoPor: string;
  dataEnvio: string;
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

export type TipoProduto = 
  | 'modulo'
  | 'inversor'
  | 'estrutura'
  | 'cabo'
  | 'protecao'
  | 'acessorio'
  | 'Módulo fotovoltaico' 
  | 'Inversor' 
  | 'Estrutura' 
  | 'Proteção' 
  | 'Cabeamento' 
  | 'Outro';

export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoProduto;
  fornecedorId: string;
  fornecedorNome: string;
  preco: number;
  estoque: number;
  unidade?: string;
  potencia?: string;
  potenciaWp?: number;
}

export interface PropostaItem {
  id: string;
  produtoId?: string;
  descricao: string;
  qtd: number;
  valorUnit: number;
  total: number;
}

export type FormaPagamentoType = 'avista' | 'cartao' | 'financiamento';

export interface Proposta {
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
  potenciaKwp: number;
  modulosQtd: number;
  areaEstimadaM2: number;
  geracaoMediaKwh: number;
  coberturaPct: number;
  kitItens: PropostaItem[];
  valorTotal: number;
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
}

export interface Contrato {
  id: string;
  numero: string;
  leadId: string;
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
}

export interface Boleto {
  id: string;
  numeroDocumento: string;
  linhaDigitavel: string;
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
