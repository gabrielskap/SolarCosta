// Conteúdo editorial do site, num só lugar.
//
// Home e /servicos mostram a mesma lista de serviços; Home e /simulador
// repetem parte do FAQ. Centralizar evita que uma correção de texto seja feita
// em metade dos lugares.

import {
  Home as IconeCasa,
  Building2,
  FileCheck2,
  Wrench,
  ClipboardCheck,
  PencilRuler,
  HardHat,
  Activity,
} from 'lucide-react';

export interface Servico {
  id: string;
  titulo: string;
  resumo: string;
  detalhes: string[];
  Icone: typeof IconeCasa;
  cor: 'blue' | 'emerald' | 'amber' | 'violet';
}

export const SERVICOS: Servico[] = [
  {
    id: 'residencial',
    titulo: 'Energia solar residencial',
    resumo:
      'Sistema dimensionado para a sua conta de luz, não para um pacote pronto de prateleira.',
    detalhes: [
      'Análise das últimas 12 contas para achar o consumo médio real',
      'Projeto que respeita o tipo de telhado — colonial, laje, metálico, fibrocimento ou shingle',
      'Instalação com equipe própria e material com nota fiscal',
      'Homologação junto à concessionária até a troca do medidor',
    ],
    Icone: IconeCasa,
    cor: 'amber',
  },
  {
    id: 'comercial',
    titulo: 'Comercial e rural',
    resumo:
      'Para quem tem demanda contratada, turno de produção ou irrigação, a conta é outra — e o projeto também.',
    detalhes: [
      'Estudo de viabilidade com o perfil de consumo do negócio',
      'Sistemas em solo, estrutura metálica ou cobertura de galpão',
      'Documentação para financiamento com bancos parceiros',
      'Compensação de créditos entre unidades do mesmo titular',
    ],
    Icone: Building2,
    cor: 'blue',
  },
  {
    id: 'homologacao',
    titulo: 'Projeto e homologação',
    resumo:
      'A parte que ninguém mostra no orçamento: o sistema só vale quando a concessionária aprova.',
    detalhes: [
      'ART emitida por engenheiro com registro no CREA',
      'Projeto elétrico e memorial descritivo no padrão da concessionária',
      'Acompanhamento do parecer de acesso e da vistoria',
      'Solicitação da troca para o medidor bidirecional',
    ],
    Icone: FileCheck2,
    cor: 'violet',
  },
  {
    id: 'manutencao',
    titulo: 'Manutenção e monitoramento',
    resumo:
      'Painel sujo ou string desligada some da conta e ninguém percebe até o fim do ano.',
    detalhes: [
      'Limpeza técnica dos módulos e inspeção das conexões',
      'Leitura do inversor e comparação com a geração projetada',
      'Laudo termográfico sob demanda',
      'Atendimento a sistemas instalados por terceiros',
    ],
    Icone: Wrench,
    cor: 'emerald',
  },
];

export interface Etapa {
  numero: string;
  titulo: string;
  descricao: string;
  Icone: typeof IconeCasa;
}

/**
 * Os quatro passos são os mesmos estágios que o CRM operacionaliza em Leads,
 * Propostas, Contratos e Obras. O que o cliente lê aqui é o que a equipe
 * executa lá dentro.
 */
export const ETAPAS: Etapa[] = [
  {
    numero: '01',
    titulo: 'Visita técnica',
    descricao:
      'Um consultor vai até o local, mede a área útil do telhado, confere o padrão de entrada e fotografa o quadro. Sem custo e sem compromisso.',
    Icone: ClipboardCheck,
  },
  {
    numero: '02',
    titulo: 'Projeto e proposta',
    descricao:
      'Dimensionamos o sistema pela sua média de consumo e apresentamos a proposta com equipamentos, geração estimada e formas de pagamento.',
    Icone: PencilRuler,
  },
  {
    numero: '03',
    titulo: 'Instalação e homologação',
    descricao:
      'Equipe própria instala, a engenharia emite a ART e cuidamos do processo junto à concessionária até a troca do medidor.',
    Icone: HardHat,
  },
  {
    numero: '04',
    titulo: 'Geração e acompanhamento',
    descricao:
      'O sistema entra em operação, você acompanha a geração pelo inversor e a gente segue disponível para manutenção e dúvidas.',
    Icone: Activity,
  },
];

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export const FAQ: Pergunta[] = [
  {
    pergunta: 'A conta de luz zera?',
    resposta:
      'Não zera por completo. Mesmo gerando toda a energia que consome, a concessionária cobra o custo de disponibilidade — uma taxa mínima equivalente a 30, 50 ou 100 kWh conforme o padrão de ligação (monofásico, bifásico ou trifásico), além da iluminação pública. O que some da conta é a maior parte: o consumo.',
  },
  {
    pergunta: 'E nos dias nublados ou à noite?',
    resposta:
      'O sistema segue ligado à rede. Durante o dia, o excedente gerado vira crédito na concessionária; à noite e em dias fechados você consome esse crédito. Por isso o dimensionamento usa a média anual, não o melhor mês.',
  },
  {
    pergunta: 'Quanto tempo leva do contrato à energia gerando?',
    resposta:
      'A instalação em si costuma levar poucos dias. O prazo maior está na homologação: a concessionária tem até 34 dias úteis para emitir o parecer de acesso e mais um período para a vistoria e a troca do medidor. Acompanhamos o processo do começo ao fim.',
  },
  {
    pergunta: 'Qual a vida útil e a garantia do sistema?',
    resposta:
      'Os módulos têm garantia de eficiência de 25 anos dos fabricantes, e os inversores costumam ter entre 5 e 12 anos, com opção de extensão. A instalação tem garantia própria da Solar Costa. Os prazos exatos de cada equipamento vão descritos na proposta.',
  },
  {
    pergunta: 'Preciso reforçar o telhado?',
    resposta:
      'Na maioria dos casos não — o peso adicional fica em torno de 12 a 15 kg/m², dentro do que uma estrutura em bom estado suporta. A visita técnica existe justamente para verificar isso antes de qualquer proposta.',
  },
  {
    pergunta: 'Dá para financiar?',
    resposta:
      'Sim. Trabalhamos com linhas de financiamento específicas para energia solar, com entrada e prazos variados. Em muitos casos a parcela fica próxima do valor que você já paga de conta de luz. As condições vigentes são apresentadas na proposta.',
  },
];
