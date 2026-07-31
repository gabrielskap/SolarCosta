import { 
  User, Lead, Fornecedor, Produto, Proposta, Contrato, Boleto, LancamentoFinanceiro, Agendamento 
} from '../types';

const USERS_KEY = 'solar_costa_users_v1';
const LEADS_KEY = 'solar_costa_leads_v1';
const FORNECEDORES_KEY = 'solar_costa_fornecedores_v1';
const PRODUTOS_KEY = 'solar_costa_produtos_v1';
const PROPOSTAS_KEY = 'solar_costa_propostas_v1';
const CONTRATOS_KEY = 'solar_costa_contratos_v1';
const BOLETOS_KEY = 'solar_costa_boletos_v1';
const LANCAMENTOS_KEY = 'solar_costa_lancamentos_v1';
const AGENDAMENTOS_KEY = 'solar_costa_agendamentos_v1';
const CURRENT_USER_KEY = 'solar_costa_current_user_v1';

// Initial Seed Data matching the mockups exactly
const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    nome: 'Carlos Eduardo Costa',
    email: 'carlos.costa@solarcosta.com.br',
    senha: '123',
    telefone: '(31) 99876-5432',
    perfil: 'Administrador',
    cargo: 'Administrador',
    situacao: 'Ativo',
    status: 'ativo',
    ultimoAcesso: 'Hoje 08:30',
    dataCriacao: '01/01/2026',
  },
  {
    id: 'u2',
    nome: 'Rafael Moura',
    email: 'rafael.moura@solarcosta.com.br',
    senha: '123',
    telefone: '(31) 98765-4321',
    perfil: 'Vendedor',
    cargo: 'Vendedor',
    situacao: 'Ativo',
    status: 'ativo',
    ultimoAcesso: 'Há 5 min',
    dataCriacao: '10/01/2026',
  },
  {
    id: 'u3',
    nome: 'Ana Beatriz Santos',
    email: 'ana.beatriz@solarcosta.com.br',
    senha: '123',
    telefone: '(31) 99123-8877',
    perfil: 'Financeiro',
    cargo: 'Financeiro',
    situacao: 'Ativo',
    status: 'ativo',
    ultimoAcesso: 'Há 2 horas',
    dataCriacao: '15/02/2026',
  },
  {
    id: 'u4',
    nome: 'Thiago Gonçalves Leal',
    email: 'thiago.leal@solarcosta.com.br',
    senha: '123',
    telefone: '(31) 99887-1122',
    perfil: 'Engenheiro',
    cargo: 'Engenheiro',
    situacao: 'Ativo',
    status: 'ativo',
    ultimoAcesso: 'Ontem',
    dataCriacao: '01/03/2026',
  },
  {
    id: 'u5',
    nome: 'Bruno Oliveira',
    email: 'bruno.oliveira@solarcosta.com.br',
    senha: '123',
    telefone: '(31) 98711-3344',
    perfil: 'Instalador',
    cargo: 'Instalador',
    situacao: 'Inativo',
    status: 'inativo',
    ultimoAcesso: '22/07/2026',
    dataCriacao: '20/04/2026',
  }
];

const INITIAL_FORNECEDORES: Fornecedor[] = [
  {
    id: 'f1',
    nome: 'Aldo Solar',
    cnpj: '05.804.313/0001-14',
    cidade: 'Maringá/PR',
    estado: 'PR',
    contato: 'Juliana Farias - (44)3220-1900',
    telefone: '(44) 3220-1900',
    prazoEntrega: '5 a 8 dias úteis',
    produtosQtd: 3
  },
  {
    id: 'f2',
    nome: 'Belenergy',
    cnpj: '11.475.628/0001-77',
    cidade: 'São Paulo/SP',
    estado: 'SP',
    contato: 'Marcos Tavares - (11) 4004-2288',
    telefone: '(11) 4004-2288',
    prazoEntrega: '7 a 12 dias úteis',
    produtosQtd: 2
  },
  {
    id: 'f3',
    nome: 'Soline',
    cnpj: '19.392.884/0001-05',
    cidade: 'Betim/MG',
    estado: 'MG',
    contato: 'Rafael Nunes - (31) 3512-4477',
    telefone: '(31) 3512-4477',
    prazoEntrega: '3 a 5 dias úteis',
    produtosQtd: 2
  },
  {
    id: 'f4',
    nome: 'Fortlev Solar',
    cnpj: '27.618.940/0001-32',
    cidade: 'Serra/ES',
    estado: 'ES',
    contato: 'Camila Souza - (27) 3396-8100',
    telefone: '(27) 3396-8100',
    prazoEntrega: '6 a 10 dias úteis',
    produtosQtd: 2
  },
  {
    id: 'f5',
    nome: 'Ecori',
    cnpj: '08.997.212/0001-60',
    cidade: 'Contagem/MG',
    estado: 'MG',
    contato: 'Diego Prado - (31) 3399-7712',
    telefone: '(31) 3399-7712',
    prazoEntrega: '2 a 4 dias úteis',
    produtosQtd: 3
  }
];

const INITIAL_PRODUTOS: Produto[] = [
  { id: 'p1', codigo: 'CAB-MC4', nome: 'Conector MC4 – par macho/fêmea', tipo: 'Cabeamento', fornecedorId: 'f5', fornecedorNome: 'Ecori', preco: 18.50, estoque: 320, unidade: 'par' },
  { id: 'p2', codigo: 'PRO-DPS', nome: 'DPS CA 275 V 40 kA', tipo: 'Proteção', fornecedorId: 'f2', fornecedorNome: 'Belenergy', preco: 96.00, estoque: 74, unidade: 'un' },
  { id: 'p3', codigo: 'EST-PER', nome: 'Perfil de alumínio 4,70 m', tipo: 'Estrutura', fornecedorId: 'f4', fornecedorNome: 'Fortlev Solar', preco: 148.00, estoque: 96, unidade: 'un' },
  { id: 'p4', codigo: 'PRO-SBX', nome: 'String box CC 2E/1S 1000 V', tipo: 'Proteção', fornecedorId: 'f3', fornecedorNome: 'Soline', preco: 295.00, estoque: 26, unidade: 'un' },
  { id: 'p5', codigo: 'CAB-6MM', nome: 'Cabo solar 6 mm² preto – rolo 100 m', tipo: 'Cabeamento', fornecedorId: 'f5', fornecedorNome: 'Ecori', preco: 385.00, estoque: 18, unidade: 'rolo' },
  { id: 'p6', codigo: 'MOD-445', nome: 'Painel Trina Vertex S+ 445 Wp', tipo: 'Módulo fotovoltaico', fornecedorId: 'f2', fornecedorNome: 'Belenergy', preco: 412.00, estoque: 168, unidade: 'un', potenciaWp: 445 },
  { id: 'p7', codigo: 'MOD-710', nome: 'Painel TLC Tier 1 710 Wp', tipo: 'Módulo fotovoltaico', fornecedorId: 'f1', fornecedorNome: 'Aldo Solar', preco: 640.00, estoque: 240, unidade: 'un', potenciaWp: 710 },
  { id: 'p8', codigo: 'INV-SUN2', nome: 'Micro inversor Deye SUN2250', tipo: 'Inversor', fornecedorId: 'f5', fornecedorNome: 'Ecori', preco: 1870.00, estoque: 14, unidade: 'un' },
  { id: 'p9', codigo: 'EST-LAJ', nome: 'Estrutura para laje – kit 12 módulos', tipo: 'Estrutura', fornecedorId: 'f4', fornecedorNome: 'Fortlev Solar', preco: 1980.00, estoque: 7, unidade: 'kit' },
  { id: 'p10', codigo: 'INV-X3M', nome: 'Micro inversor Solax X3-MIC', tipo: 'Inversor', fornecedorId: 'f3', fornecedorNome: 'Soline', preco: 2150.00, estoque: 22, unidade: 'un' },
  { id: 'p11', codigo: 'EST-CER', nome: 'Estrutura telha cerâmica – kit 12 módulos', tipo: 'Estrutura', fornecedorId: 'f1', fornecedorNome: 'Aldo Solar', preco: 2240.00, estoque: 5, unidade: 'kit' },
  { id: 'p12', codigo: 'INV-GW8', nome: 'Inversor Growatt MIN 8000TL-X', tipo: 'Inversor', fornecedorId: 'f1', fornecedorNome: 'Aldo Solar', preco: 4380.00, estoque: 9, unidade: 'un' }
];

const INITIAL_PROPOSTA: Proposta = {
  id: 'prop-184',
  numero: '2026-0184',
  leadId: 'lead-184',
  clienteNome: 'Cristiano Duarte Almeida',
  cpfCnpj: '042.318.776-90',
  telefone: '(31) 99412-7708',
  email: 'cristiano.duarte@gmail.com',
  endereco: 'Rua dos Ipês, 512 – Santa Mônica',
  cidade: 'Belo Horizonte/MG',
  concessionaria: 'CEMIG',
  telhado: 'Laje',
  consumoKwh: 1000,
  tarifaKwh: 1.19,
  hsp: 5.2,
  perdasPct: 24.5,
  moduloWp: 710,
  potenciaKwp: 8.52,
  modulosQtd: 12,
  areaEstimadaM2: 69.96,
  geracaoMediaKwh: 1003,
  coberturaPct: 100.3,
  kitItens: [
    { id: 'i1', produtoId: 'p7', descricao: 'Painel TLC Tier 1 710 Wp', qtd: 12, valorUnit: 640.00, total: 7680.00 },
    { id: 'i2', produtoId: 'p10', descricao: 'Micro inversor Solax X3-MIC', qtd: 3, valorUnit: 2150.00, total: 6450.00 },
    { id: 'i3', produtoId: 'p9', descricao: 'Estrutura para laje – 12 módulos', qtd: 1, valorUnit: 1980.00, total: 1980.00 },
    { id: 'i4', descricao: 'Material, cabos e conexões', qtd: 1, valorUnit: 1480.00, total: 1480.00 },
    { id: 'i5', descricao: 'Instalação, projeto e homologação do SFCR', qtd: 1, valorUnit: 4900.00, total: 4900.00 }
  ],
  valorTotal: 22490.00,
  economiaMensal: 1194.15,
  economiaAnual: 14329.77,
  economia25Anos: 786196.08,
  paybackAnos: 1.6,
  formaPagamento: 'financiamento',
  entradaFinanciamentoValor: 2249.00,
  entradaFinanciamentoPct: 10,
  parcelasFinanciamento: 60,
  jurosFinanciamentoMesPct: 1.45,
  bancoFinanciamento: 'BV Financeira – linha solar',
  dataCriacao: '08/07/2026',
  status: 'enviada'
};

const INITIAL_LEADS: Lead[] = [
  // Novo lead (3)
  {
    id: 'l1',
    numero: '#187',
    nome: 'Vanessa Prado',
    cpfCnpj: '118.445.990-21',
    telefone: '(31) 99182-3344',
    email: 'vanessa.prado@hotmail.com',
    cidade: 'Nova Lima/MG',
    endereco: 'Alameda dos Ipês, 45 – Vale do Sereno',
    consumoKwh: 620,
    concessionaria: 'CEMIG',
    telhado: 'Colonial',
    origem: 'Google Ads',
    responsavel: 'Rafael Moura',
    etapa: 'Novo lead',
    valor: 15980.00,
    dataCriacao: '29/07/2026',
    documentos: [],
    historico: [
      { id: 'h1', data: '29/07/2026', descricao: 'Lead cadastrado via formulário web', usuario: 'Sistema' }
    ]
  },
  {
    id: 'l2',
    numero: '#186',
    nome: 'Mercearia São Bento',
    cpfCnpj: '24.891.302/0001-88',
    telefone: '(31) 3351-9000',
    email: 'contato@saobento.com.br',
    cidade: 'Contagem/MG',
    endereco: 'Av. João César de Oliveira, 1420',
    consumoKwh: 1840,
    concessionaria: 'CEMIG',
    telhado: 'Metálico',
    origem: 'Indicação',
    responsavel: 'Ana Beatriz Coelho',
    etapa: 'Novo lead',
    valor: 41200.00,
    dataCriacao: '28/07/2026',
    documentos: [],
    historico: [
      { id: 'h2', data: '28/07/2026', descricao: 'Lead cadastrado por Ana Beatriz', usuario: 'Ana Beatriz Coelho' }
    ]
  },
  {
    id: 'l3',
    numero: '#185',
    nome: 'Eduardo Camargo',
    cpfCnpj: '087.112.443-10',
    telefone: '(31) 98711-2299',
    email: 'eduardo.camargo@gmail.com',
    cidade: 'Sabará/MG',
    endereco: 'Rua Borba Gato, 90 – Centro',
    consumoKwh: 480,
    concessionaria: 'CEMIG',
    telhado: 'Colonial',
    origem: 'Instagram',
    responsavel: 'Rafael Moura',
    etapa: 'Novo lead',
    valor: 12400.00,
    dataCriacao: '27/07/2026',
    documentos: [],
    historico: [
      { id: 'h3', data: '27/07/2026', descricao: 'Solicitação de contato via Instagram', usuario: 'Rafael Moura' }
    ]
  },

  // Contato feito (2)
  {
    id: 'l4',
    numero: '#183',
    nome: 'Luciana Ferraz',
    cpfCnpj: '091.223.881-54',
    telefone: '(31) 99812-7711',
    email: 'luciana.ferraz@yahoo.com.br',
    cidade: 'Belo Horizonte/MG',
    endereco: 'Rua Alvarenga Peixoto, 880 – Lourdes',
    consumoKwh: 740,
    concessionaria: 'CEMIG',
    telhado: 'Laje',
    origem: 'Site Solar Costa',
    responsavel: 'Ana Beatriz Coelho',
    etapa: 'Contato feito',
    valor: 18600.00,
    dataCriacao: '25/07/2026',
    documentos: [],
    historico: [
      { id: 'h4', data: '26/07/2026', descricao: 'Primeiro contato por telefone realizado. Aguardando conta de energia.', usuario: 'Ana Beatriz Coelho' }
    ]
  },
  {
    id: 'l5',
    numero: '#182',
    nome: 'Sítio Boa Vista',
    cpfCnpj: '18.992.331/0001-02',
    telefone: '(31) 98451-9922',
    email: 'contato@sitioboavista.com.br',
    cidade: 'Lagoa Santa/MG',
    endereco: 'Estrada do Boqueirão, km 4',
    consumoKwh: 2100,
    concessionaria: 'CEMIG',
    telhado: 'Solo/Estrutura',
    origem: 'Indicação',
    responsavel: 'Rafael Moura',
    etapa: 'Contato feito',
    valor: 47300.00,
    dataCriacao: '24/07/2026',
    documentos: [],
    historico: [
      { id: 'h5', data: '25/07/2026', descricao: 'Reunião virtual realizada. Visita técnica a agendar.', usuario: 'Rafael Moura' }
    ]
  },

  // Visita técnica (2)
  {
    id: 'l6',
    numero: '#181',
    nome: 'Padaria Trigo de Ouro',
    cpfCnpj: '07.331.229/0001-99',
    telefone: '(31) 3532-1100',
    email: 'trigodeouro@gmail.com',
    cidade: 'Betim/MG',
    endereco: 'Av. Juscelino Kubitschek, 310 – Centro',
    consumoKwh: 1560,
    concessionaria: 'CEMIG',
    telhado: 'Metálico',
    origem: 'Prospecção Ativa',
    responsavel: 'Thiago Gonçalves Leal',
    etapa: 'Visita técnica',
    valor: 36900.00,
    dataCriacao: '20/07/2026',
    documentos: [],
    historico: [
      { id: 'h6', data: '28/07/2026', descricao: 'Visita técnica agendada para 02/08 com o técnico Thiago.', usuario: 'Thiago Gonçalves Leal' }
    ]
  },
  {
    id: 'l7',
    numero: '#180',
    nome: 'Marcos Vinícius Reis',
    cpfCnpj: '055.881.332-19',
    telefone: '(31) 99122-0099',
    email: 'marcos.reis@uol.com.br',
    cidade: 'Santa Luzia/MG',
    endereco: 'Rua Floriano Peixoto, 412 – São João',
    consumoKwh: 890,
    concessionaria: 'CEMIG',
    telhado: 'Colonial',
    origem: 'Google Ads',
    responsavel: 'Rafael Moura',
    etapa: 'Visita técnica',
    valor: 21400.00,
    dataCriacao: '18/07/2026',
    documentos: [],
    historico: [
      { id: 'h7', data: '24/07/2026', descricao: 'Vistoria de telhado e padrão de entrada concluída com sucesso.', usuario: 'Rafael Moura' }
    ]
  },

  // Proposta enviada (3)
  {
    id: 'lead-184',
    numero: '#184',
    nome: 'Cristiano Duarte Almeida',
    cpfCnpj: '042.318.776-90',
    rgInscricao: 'MG-14.882.301',
    telefone: '(31) 99412-7708',
    email: 'cristiano.duarte@gmail.com',
    cidade: 'Belo Horizonte/MG',
    endereco: 'Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG - 31.530-150',
    cep: '31.530-150',
    consumoKwh: 1000,
    concessionaria: 'CEMIG',
    telhado: 'Laje',
    origem: 'Indicação',
    responsavel: 'Rafael Moura',
    etapa: 'Proposta enviada',
    valor: 22490.00,
    propostaVinculadaId: 'prop-184',
    dataCriacao: '08/07/2026',
    documentos: [
      { id: 'doc1', nome: 'RG-Cristiano-frente-verso.pdf', pasta: 'Documentos pessoais', tipo: 'PDF', tamanho: '1,4 MB', enviadoPor: 'Rafael Moura', dataEnvio: '22/07/2026' },
      { id: 'doc2', nome: 'CPF-Cristiano.pdf', pasta: 'Documentos pessoais', tipo: 'PDF', tamanho: '340 KB', enviadoPor: 'Rafael Moura', dataEnvio: '22/07/2026' },
      { id: 'doc3', nome: 'Comprovante-residencia-junho.pdf', pasta: 'Documentos pessoais', tipo: 'PDF', tamanho: '820 KB', enviadoPor: 'Rafael Moura', dataEnvio: '20/07/2026' },
      { id: 'doc4', nome: 'Certidao-estado-civil.pdf', pasta: 'Documentos pessoais', tipo: 'PDF', tamanho: '610 KB', enviadoPor: 'Ana Beatriz', dataEnvio: '19/07/2026' }
    ],
    historico: [
      { id: 'h8', data: '28/07/2026', descricao: 'Proposta enviada por WhatsApp nº 2026-0184', usuario: 'Rafael Moura' },
      { id: 'h9', data: '12/07/2026', descricao: 'Visita técnica realizada no imóvel de Santa Mônica', usuario: 'Thiago Gonçalves' },
      { id: 'h10', data: '09/07/2026', descricao: 'Primeiro contato por telefone com o cliente', usuario: 'Rafael Moura' }
    ]
  },
  {
    id: 'l8',
    numero: '#179',
    nome: 'Auto Peças Ribeiro',
    cpfCnpj: '14.221.092/0001-33',
    telefone: '(31) 3624-8800',
    email: 'financeiro@pecasribeiro.com.br',
    cidade: 'Ribeirão das Neves/MG',
    endereco: 'Av. Denise Cristina, 1200',
    consumoKwh: 2480,
    concessionaria: 'CEMIG',
    telhado: 'Metálico',
    origem: 'Prospecção Ativa',
    responsavel: 'Ana Beatriz Coelho',
    etapa: 'Proposta enviada',
    valor: 54800.00,
    dataCriacao: '05/07/2026',
    documentos: [],
    historico: [
      { id: 'h11', data: '25/07/2026', descricao: 'Proposta enviada por e-mail (há 5 dias)', usuario: 'Ana Beatriz Coelho' }
    ]
  },
  {
    id: 'l9',
    numero: '#178',
    nome: 'Helena Bastos',
    cpfCnpj: '034.992.118-01',
    telefone: '(31) 99778-4433',
    email: 'helena.bastos@gmail.com',
    cidade: 'Nova Lima/MG',
    endereco: 'Rua das Mangabeiras, 77 – Vila da Serra',
    consumoKwh: 1320,
    concessionaria: 'CEMIG',
    telhado: 'Shingle',
    origem: 'Indicação',
    responsavel: 'Rafael Moura',
    etapa: 'Proposta enviada',
    valor: 31200.00,
    dataCriacao: '02/07/2026',
    documentos: [],
    historico: [
      { id: 'h12', data: '30/07/2026', descricao: 'Proposta enviada hoje', usuario: 'Rafael Moura' }
    ]
  },

  // Negociação (2)
  {
    id: 'l10',
    numero: '#177',
    nome: 'Clinica Vida Plena',
    cpfCnpj: '33.882.110/0001-66',
    telefone: '(31) 3277-5050',
    email: 'administracao@vidaplena.med.br',
    cidade: 'Belo Horizonte/MG',
    endereco: 'Av. Afonso Pena, 2500 – Funcionários',
    consumoKwh: 1750,
    concessionaria: 'CEMIG',
    telhado: 'Laje',
    origem: 'Google Ads',
    responsavel: 'Ana Beatriz Coelho',
    etapa: 'Negociação',
    valor: 39400.00,
    dataCriacao: '28/06/2026',
    documentos: [],
    historico: [
      { id: 'h13', data: '29/07/2026', descricao: 'Aguardando aprovação do crédito bancário no BV', usuario: 'Ana Beatriz Coelho' }
    ]
  },
  {
    id: 'l11',
    numero: '#176',
    nome: 'Roberto Siqueira',
    cpfCnpj: '066.331.992-44',
    telefone: '(31) 98833-2211',
    email: 'roberto.siqueira@bol.com.br',
    cidade: 'Contagem/MG',
    endereco: 'Rua das Oliveiras, 303 – Eldorado',
    consumoKwh: 1120,
    concessionaria: 'CEMIG',
    telhado: 'Colonial',
    origem: 'Instagram',
    responsavel: 'Rafael Moura',
    etapa: 'Negociação',
    valor: 26800.00,
    dataCriacao: '25/06/2026',
    documentos: [],
    historico: [
      { id: 'h14', data: '27/07/2026', descricao: 'Negociando percentual de entrada e desconto à vista', usuario: 'Rafael Moura' }
    ]
  },

  // Fechado (2)
  {
    id: 'l12',
    numero: '#175',
    nome: 'Marcelo Ribeiro',
    cpfCnpj: '081.772.331-09',
    telefone: '(31) 99221-5544',
    email: 'marcelo.ribeiro@gmail.com',
    cidade: 'Belo Horizonte/MG',
    endereco: 'Rua Ceará, 1100 – Savassi',
    consumoKwh: 1400,
    concessionaria: 'CEMIG',
    telhado: 'Laje',
    origem: 'Indicação',
    responsavel: 'Ana Beatriz Coelho',
    etapa: 'Fechado',
    valor: 32900.00,
    dataCriacao: '15/06/2026',
    documentos: [],
    historico: [
      { id: 'h15', data: '26/07/2026', descricao: 'Contrato assinado pelo cliente!', usuario: 'Ana Beatriz Coelho' }
    ]
  },
  {
    id: 'l13',
    numero: '#174',
    nome: 'Supermercado Costa Verde',
    cpfCnpj: '09.112.449/0001-20',
    telefone: '(31) 3594-2200',
    email: 'diretoria@costaverde.com.br',
    cidade: 'Betim/MG',
    endereco: 'Av. Amazonas, 4500 – Jardim da Cidade',
    consumoKwh: 3200,
    concessionaria: 'CEMIG',
    telhado: 'Metálico',
    origem: 'Prospecção Ativa',
    responsavel: 'Thiago Gonçalves Leal',
    etapa: 'Fechado',
    valor: 71800.00,
    dataCriacao: '10/06/2026',
    documentos: [],
    historico: [
      { id: 'h16', data: '21/07/2026', descricao: 'Contrato assinado e entrada de R$ 21.540,00 paga.', usuario: 'Thiago Gonçalves Leal' }
    ]
  }
];

const INITIAL_CONTRATO: Contrato = {
  id: 'cont-0184',
  numero: '2026-0184',
  leadId: 'lead-184',
  clienteNome: 'Cristiano Duarte Almeida',
  cpfCnpj: '042.318.776-90',
  rgInscricao: 'MG-14.882.301',
  endereco: 'Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG',
  cep: '31.530-150',
  telefone: '(31) 99412-7708',
  potenciaKwp: 8.52,
  modulosQtd: 12,
  moduloModelo: 'TLC Tier 1 710 Wp',
  inversorModelo: '3x Micro Solax X3-MIC',
  estrutura: 'Laje',
  prazoExecucao: '45 dias corridos',
  localInstalacao: 'Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG',
  valorTotal: 22490.00,
  formaPagamento: 'Financiamento bancário',
  entrada: 'R$ 2.249,00 (10%)',
  parcelasInfo: '60x R$ 486,60',
  bancoAgente: 'BV Financeira – linha solar',
  primeiroVencimento: '10/09/2026',
  multaAtraso: '2% + 1% a.m.',
  foroEleito: 'Belo Horizonte/MG',
  garantias: {
    modulos: '12 anos (defeito)',
    inversores: '10 anos',
    instalacao: '5 anos',
    homologacao: 'até 60 dias após vistoria'
  },
  responsavelTecnico: 'Thiago Gonçalves Leal',
  crea: 'MG0000023481D',
  clausulas: [
    'Objeto e escopo do fornecimento',
    'Preço, forma de pagamento e reajuste',
    'Prazos de entrega, instalação e homologação',
    'Obrigações do contratante e do contratado',
    'Exclusões de escopo (obra civil, padrão de entrada)',
    'Garantias e assistência técnica',
    'Cessão de crédito ao agente financeiro',
    'Rescisão, multas e foro'
  ],
  status: 'aguardando',
  dataEmissao: '30/07/2026'
};

const INITIAL_BOLETOS: Boleto[] = [
  {
    id: 'bol-1',
    numeroDocumento: '00190.00009 01234.567894 12345.678908 1 95000002249000',
    linhaDigitavel: '00190.00009 01234.567894 12345.678908 1 95000002249000',
    clienteNome: 'Cristiano Duarte Almeida',
    cpfCnpj: '042.318.776-90',
    valor: 2249.00,
    parcela: '1/60 (Entrada)',
    vencimento: '10/08/2026',
    situacao: 'em_aberto',
    tipo: 'A receber',
    categoria: 'Venda de sistema',
    obraRef: 'OBRA 0184'
  },
  {
    id: 'bol-2',
    numeroDocumento: '00190.00009 01234.567894 12345.678916 2 95000000486600',
    linhaDigitavel: '00190.00009 01234.567894 12345.678916 2 95000000486600',
    clienteNome: 'Cristiano Duarte Almeida',
    cpfCnpj: '042.318.776-90',
    valor: 486.60,
    parcela: '1/60',
    vencimento: '10/09/2026',
    situacao: 'em_aberto',
    tipo: 'A receber',
    categoria: 'Venda de sistema',
    obraRef: 'OBRA 0184'
  },
  {
    id: 'bol-3',
    numeroDocumento: '00190.00009 01234.567894 12345.678924 3 95000001124500',
    linhaDigitavel: '00190.00009 01234.567894 12345.678924 3 95000001124500',
    clienteNome: 'Supermercado Costa Verde',
    cpfCnpj: '09.112.449/0001-20',
    valor: 21540.00,
    parcela: '1/3 (Entrada)',
    vencimento: '21/07/2026',
    situacao: 'pago',
    dataPagamento: '21/07/2026',
    tipo: 'A receber',
    categoria: 'Venda de sistema',
    obraRef: 'OBRA 0181'
  },
  {
    id: 'bol-4',
    numeroDocumento: '00190.00009 01234.567894 12345.678932 4 95000000798000',
    linhaDigitavel: '00190.00009 01234.567894 12345.678932 4 95000000798000',
    clienteNome: 'Marcelo Ribeiro',
    cpfCnpj: '081.772.331-09',
    valor: 7980.00,
    parcela: '3/4',
    vencimento: '26/07/2026',
    situacao: 'pago',
    dataPagamento: '26/07/2026',
    tipo: 'A receber',
    categoria: 'Venda de sistema',
    obraRef: 'OBRA 0179'
  },
  {
    id: 'bol-5',
    numeroDocumento: '00190.00009 01234.567894 12345.678940 5 95000000822000',
    linhaDigitavel: '00190.00009 01234.567894 12345.678940 5 95000000822000',
    clienteNome: 'Auto Peças Ribeiro',
    cpfCnpj: '14.221.092/0001-33',
    valor: 8220.00,
    parcela: '1/1',
    vencimento: '15/07/2026',
    situacao: 'vencido',
    tipo: 'A receber',
    categoria: 'Venda de sistema',
    obraRef: 'OBRA 0179'
  },
  {
    id: 'bol-6',
    numeroDocumento: '00190.00009 01234.567894 12345.678957 6 95000001561000',
    linhaDigitavel: '00190.00009 01234.567894 12345.678957 6 95000001561000',
    clienteNome: 'Aldo Solar – NF 44120 (kit obra 0184)',
    cpfCnpj: '05.804.313/0001-14',
    valor: 15610.00,
    parcela: '1/1',
    vencimento: '31/07/2026',
    situacao: 'em_aberto',
    tipo: 'A pagar',
    categoria: 'Equipamentos',
    obraRef: 'OBRA 0184'
  }
];

const INITIAL_LANCAMENTOS: LancamentoFinanceiro[] = [
  { id: 'f-1', data: '28/07', descricao: 'Sinal 50% – obra Cristiano Duarte', categoria: 'Venda de sistema', obraRef: 'OBRA 0184', valor: 11245.00, tipo: 'receita' },
  { id: 'f-2', data: '27/07', descricao: 'Compra kit 8,52 kWp – Aldo Solar', categoria: 'Equipamentos', obraRef: 'OBRA 0184', valor: -15610.00, tipo: 'despesa' },
  { id: 'f-3', data: '26/07', descricao: 'Parcela 3/4 – obra Marcelo Ribeiro', categoria: 'Venda de sistema', obraRef: 'OBRA 0179', valor: 7980.00, tipo: 'receita' },
  { id: 'f-4', data: '24/07', descricao: 'Entrada – Supermercado Costa Verde', categoria: 'Venda de sistema', obraRef: 'OBRA 0181', valor: 21540.00, tipo: 'receita' },
  { id: 'f-5', data: '22/07', descricao: 'Equipe de instalação – 2 obras', categoria: 'Mão de obra', obraRef: '–', valor: -5400.00, tipo: 'despesa' },
  { id: 'f-6', data: '21/07', descricao: 'Combustível e pedágio', categoria: 'Logística', obraRef: '–', valor: -640.00, tipo: 'despesa' },
  { id: 'f-7', data: '20/07', descricao: 'Manutenção preventiva – Clínica Vida Plena', categoria: 'Serviços', obraRef: 'SERV 0042', valor: 1450.00, tipo: 'receita' },
  { id: 'f-8', data: '18/07', descricao: 'Simples Nacional – competência 06/2026', categoria: 'Impostos', obraRef: '–', valor: -4180.00, tipo: 'despesa' },
  { id: 'f-9', data: '15/07', descricao: 'Tráfego pago – Meta Ads', categoria: 'Marketing', obraRef: '–', valor: -1200.00, tipo: 'despesa' }
];

// Helper to initialize or retrieve storage
function getStorage<T>(key: string, initialData: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error loading key ${key}`, e);
    return initialData;
  }
}

function setStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing key ${key}`, e);
  }
}

export const StorageService = {
  getUsers: (): User[] => getStorage(USERS_KEY, INITIAL_USERS),
  getUsuarios: (): User[] => getStorage(USERS_KEY, INITIAL_USERS),
  saveUsers: (users: User[]) => setStorage(USERS_KEY, users),
  saveUsuarios: (users: User[]) => setStorage(USERS_KEY, users),
  saveUsuario: (user: User): User[] => {
    const users = getStorage<User[]>(USERS_KEY, INITIAL_USERS);
    const existingIndex = users.findIndex(u => u.id === user.id);
    let updated: User[];
    if (existingIndex >= 0) {
      updated = [...users];
      updated[existingIndex] = user;
    } else {
      updated = [user, ...users];
    }
    setStorage(USERS_KEY, updated);
    return updated;
  },
  deleteUsuario: (id: string): User[] => {
    const users = getStorage<User[]>(USERS_KEY, INITIAL_USERS);
    const updated = users.filter(u => u.id !== id);
    setStorage(USERS_KEY, updated);
    return updated;
  },

  getCurrentUser: (): User => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // fallback
      }
    }
    const defaultUser = INITIAL_USERS[0];
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
    return defaultUser;
  },
  setCurrentUser: (user: User | null) => {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      setStorage(CURRENT_USER_KEY, user);
    }
  },

  getLeads: (): Lead[] => getStorage(LEADS_KEY, INITIAL_LEADS),
  saveLeads: (leads: Lead[]) => setStorage(LEADS_KEY, leads),
  saveLead: (lead: Lead): Lead[] => {
    const leads = getStorage<Lead[]>(LEADS_KEY, INITIAL_LEADS);
    const existingIndex = leads.findIndex(l => l.id === lead.id);
    let updated: Lead[];
    if (existingIndex >= 0) {
      updated = [...leads];
      updated[existingIndex] = lead;
    } else {
      updated = [lead, ...leads];
    }
    setStorage(LEADS_KEY, updated);
    return updated;
  },
  updateLeadStage: (leadId: string, stage: any): Lead[] => {
    const leads = getStorage<Lead[]>(LEADS_KEY, INITIAL_LEADS);
    const updated = leads.map(l => l.id === leadId ? { ...l, etapa: stage } : l);
    setStorage(LEADS_KEY, updated);
    return updated;
  },

  getFornecedores: (): Fornecedor[] => getStorage(FORNECEDORES_KEY, INITIAL_FORNECEDORES),
  saveFornecedores: (fornecedores: Fornecedor[]) => setStorage(FORNECEDORES_KEY, fornecedores),
  saveFornecedor: (f: Fornecedor): Fornecedor[] => {
    const list = getStorage<Fornecedor[]>(FORNECEDORES_KEY, INITIAL_FORNECEDORES);
    const idx = list.findIndex(item => item.id === f.id);
    let updated: Fornecedor[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = f;
    } else {
      updated = [f, ...list];
    }
    setStorage(FORNECEDORES_KEY, updated);
    return updated;
  },
  deleteFornecedor: (id: string): Fornecedor[] => {
    const list = getStorage<Fornecedor[]>(FORNECEDORES_KEY, INITIAL_FORNECEDORES);
    const updated = list.filter(item => item.id !== id);
    setStorage(FORNECEDORES_KEY, updated);
    return updated;
  },

  getProdutos: (): Produto[] => getStorage(PRODUTOS_KEY, INITIAL_PRODUTOS),
  saveProdutos: (produtos: Produto[]) => setStorage(PRODUTOS_KEY, produtos),
  saveProduto: (p: Produto): Produto[] => {
    const list = getStorage<Produto[]>(PRODUTOS_KEY, INITIAL_PRODUTOS);
    const idx = list.findIndex(item => item.id === p.id);
    let updated: Produto[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = p;
    } else {
      updated = [p, ...list];
    }
    setStorage(PRODUTOS_KEY, updated);
    return updated;
  },
  deleteProduto: (id: string): Produto[] => {
    const list = getStorage<Produto[]>(PRODUTOS_KEY, INITIAL_PRODUTOS);
    const updated = list.filter(item => item.id !== id);
    setStorage(PRODUTOS_KEY, updated);
    return updated;
  },

  getPropostas: (): Proposta[] => getStorage(PROPOSTAS_KEY, [INITIAL_PROPOSTA]),
  savePropostas: (propostas: Proposta[]) => setStorage(PROPOSTAS_KEY, propostas),
  saveProposta: (p: Proposta): Proposta[] => {
    const list = getStorage<Proposta[]>(PROPOSTAS_KEY, [INITIAL_PROPOSTA]);
    const idx = list.findIndex(item => item.id === p.id);
    let updated: Proposta[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = p;
    } else {
      updated = [p, ...list];
    }
    setStorage(PROPOSTAS_KEY, updated);
    return updated;
  },

  getContratos: (): Contrato[] => getStorage(CONTRATOS_KEY, [INITIAL_CONTRATO]),
  saveContratos: (contratos: Contrato[]) => setStorage(CONTRATOS_KEY, contratos),
  saveContrato: (c: Contrato): Contrato[] => {
    const list = getStorage<Contrato[]>(CONTRATOS_KEY, [INITIAL_CONTRATO]);
    const idx = list.findIndex(item => item.id === c.id);
    let updated: Contrato[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = c;
    } else {
      updated = [c, ...list];
    }
    setStorage(CONTRATOS_KEY, updated);
    return updated;
  },

  getBoletos: (): Boleto[] => getStorage(BOLETOS_KEY, INITIAL_BOLETOS),
  saveBoletos: (boletos: Boleto[]) => setStorage(BOLETOS_KEY, boletos),
  saveBoleto: (b: Boleto): Boleto[] => {
    const list = getStorage<Boleto[]>(BOLETOS_KEY, INITIAL_BOLETOS);
    const idx = list.findIndex(item => item.id === b.id);
    let updated: Boleto[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = b;
    } else {
      updated = [b, ...list];
    }
    setStorage(BOLETOS_KEY, updated);
    return updated;
  },
  deleteBoleto: (id: string): Boleto[] => {
    const list = getStorage<Boleto[]>(BOLETOS_KEY, INITIAL_BOLETOS);
    const updated = list.filter(item => item.id !== id);
    setStorage(BOLETOS_KEY, updated);
    return updated;
  },

  getLancamentos: (): LancamentoFinanceiro[] => getStorage(LANCAMENTOS_KEY, INITIAL_LANCAMENTOS),
  saveLancamentos: (l: LancamentoFinanceiro[]) => setStorage(LANCAMENTOS_KEY, l),
  saveLancamento: (l: LancamentoFinanceiro): LancamentoFinanceiro[] => {
    const list = getStorage<LancamentoFinanceiro[]>(LANCAMENTOS_KEY, INITIAL_LANCAMENTOS);
    const updated = [l, ...list];
    setStorage(LANCAMENTOS_KEY, updated);
    return updated;
  },

  getAgendamentos: (): Agendamento[] => getStorage(AGENDAMENTOS_KEY, INITIAL_AGENDAMENTOS),
  saveAgendamentos: (agendamentos: Agendamento[]) => setStorage(AGENDAMENTOS_KEY, agendamentos),
  saveAgendamento: (a: Agendamento): Agendamento[] => {
    const list = getStorage<Agendamento[]>(AGENDAMENTOS_KEY, INITIAL_AGENDAMENTOS);
    const idx = list.findIndex(item => item.id === a.id);
    let updated: Agendamento[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = a;
    } else {
      updated = [a, ...list];
    }
    setStorage(AGENDAMENTOS_KEY, updated);
    return updated;
  },
  deleteAgendamento: (id: string): Agendamento[] => {
    const list = getStorage<Agendamento[]>(AGENDAMENTOS_KEY, INITIAL_AGENDAMENTOS);
    const updated = list.filter(item => item.id !== id);
    setStorage(AGENDAMENTOS_KEY, updated);
    return updated;
  },

  resetAll: () => {
    localStorage.clear();
    setStorage(USERS_KEY, INITIAL_USERS);
    setStorage(FORNECEDORES_KEY, INITIAL_FORNECEDORES);
    setStorage(PRODUTOS_KEY, INITIAL_PRODUTOS);
    setStorage(PROPOSTAS_KEY, [INITIAL_PROPOSTA]);
    setStorage(LEADS_KEY, INITIAL_LEADS);
    setStorage(CONTRATOS_KEY, [INITIAL_CONTRATO]);
    setStorage(BOLETOS_KEY, INITIAL_BOLETOS);
    setStorage(LANCAMENTOS_KEY, INITIAL_LANCAMENTOS);
    setStorage(AGENDAMENTOS_KEY, INITIAL_AGENDAMENTOS);
    setStorage(CURRENT_USER_KEY, INITIAL_USERS[0]);
  }
};

const INITIAL_AGENDAMENTOS: Agendamento[] = [
  {
    id: 'ag-101',
    leadId: 'lead-184',
    leadNome: 'Cristiano',
    tipo: 'visita_tecnica',
    titulo: 'Vistoria Técnica de Dimensionamento e Telhado',
    data: '2026-07-31',
    horarioInicio: '09:00',
    horarioFim: '10:30',
    endereco: 'Rua das Palmeiras, 450, Savassi',
    cidade: 'Belo Horizonte',
    responsavel: 'Thiago Gonçalves Leal',
    status: 'agendado',
    observacoes: 'Avaliar inclinação do telhado colonial, espaço para inversor e quadro elétrico padrão 220V.',
    dataCriacao: '2026-07-28'
  },
  {
    id: 'ag-102',
    leadId: 'lead-185',
    leadNome: 'Maria Oliveira',
    tipo: 'reuniao',
    titulo: 'Apresentação Comercial e Fechamento da Proposta',
    data: '2026-07-31',
    horarioInicio: '14:30',
    horarioFim: '15:30',
    endereco: 'Av. Afonso Pena, 1200 - Centro',
    cidade: 'Belo Horizonte',
    responsavel: 'Rafael Moura',
    status: 'agendado',
    observacoes: 'Apresentar simulação de financiamento pelo Banco do Brasil com carência de 90 dias.',
    dataCriacao: '2026-07-29'
  },
  {
    id: 'ag-103',
    leadId: 'lead-186',
    leadNome: 'Roberto Ferreira',
    tipo: 'visita_tecnica',
    titulo: 'Análise de Sombreamento e Padrão da CEMIG',
    data: '2026-08-01',
    horarioInicio: '10:00',
    horarioFim: '11:30',
    endereco: 'Rua Paraíba, 880, Funcionários',
    cidade: 'Belo Horizonte',
    responsavel: 'Thiago Gonçalves Leal',
    status: 'agendado',
    observacoes: 'Verificar transformador da rua e fiação trifásica.',
    dataCriacao: '2026-07-30'
  },
  {
    id: 'ag-104',
    leadId: 'lead-187',
    leadNome: 'Luciana Duarte',
    tipo: 'reuniao',
    titulo: 'Reunião de Alinhamento do Contrato Solar',
    data: '2026-08-03',
    horarioInicio: '11:00',
    horarioFim: '12:00',
    endereco: 'Rua Cláudio Manoel, 320, Bairro Lourdinho',
    cidade: 'Nova Lima',
    responsavel: 'Carlos Eduardo Costa',
    status: 'agendado',
    observacoes: 'Discutir cronograma de homologação e entrega dos módulos Jinko.',
    dataCriacao: '2026-07-30'
  },
  {
    id: 'ag-105',
    leadId: 'lead-188',
    leadNome: 'Padaria e Confeitaria Central',
    tipo: 'vistoria',
    titulo: 'Vistoria Pré-Instalação dos Inversores Growatt',
    data: '2026-08-05',
    horarioInicio: '08:30',
    horarioFim: '10:00',
    endereco: 'Rua Principal, 50, Centro',
    cidade: 'Contagem',
    responsavel: 'Bruno Oliveira',
    status: 'agendado',
    observacoes: 'Instalação comercial de grande porte (25 kWp). Checar estrutura metálica.',
    dataCriacao: '2026-07-31'
  }
];
