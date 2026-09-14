// Conteúdo de fábrica do site — o estado em que o site nasceu.
//
// Serve a DOIS propósitos, e é por isso que ele existe em TypeScript em vez de
// viver só no banco:
//
//   1. FALLBACK. Se /api/publico/site falhar, o site renderiza a partir daqui.
//      A regra vem de contexto.tsx: um site institucional não pode ficar em
//      branco porque o banco caiu.
//   2. ORIGEM DO SEED. O INSERT inicial da migration V008 foi gerado a partir
//      deste arquivo por scripts/gerar-seed-site.mjs, o que garante que o site
//      logo após o primeiro `npm run migrate` é idêntico ao que existia antes
//      de o CMS existir.
//
// IMPORTANTE: este é um DEFAULT DE FÁBRICA CONGELADO, não um espelho do banco.
// Depois que o administrador editar o site em /sistema/site, as duas coisas
// divergem de propósito — aqui fica o que o site era no dia da migração, e é
// exatamente isso que se quer ver quando a API está fora do ar. Não há nada a
// "manter em sincronia": editar este arquivo só faz sentido para mudar o
// fallback, nunca para refletir uma edição feita na tela.

import type { ChaveMenu, ConteudoSite, ItemMenu, PaginaSite } from './blocos/tipos';

/* -------------------------------------------------------------- menus --- */

const item = (
  id: string,
  rotulo: string,
  destino: string,
  extra: Partial<ItemMenu> = {},
): ItemMenu => ({ id, rotulo, destino, novaAba: false, destaque: false, ...extra });

export const MENUS_PADRAO: Record<ChaveMenu, ItemMenu[]> = {
  principal: [
    item('menu-principal-inicio', 'Início', '/'),
    item('menu-principal-servicos', 'Serviços', '/servicos'),
    item('menu-principal-simulador', 'Simulador', '/simulador'),
    item('menu-principal-sobre', 'A empresa', '/sobre'),
    item('menu-principal-contato', 'Contato', '/contato'),
    item('menu-principal-cta', 'Simular economia', '/simulador', { destaque: true }),
  ],
  rodape_navegacao: [
    item('menu-rodape-inicio', 'Início', '/'),
    item('menu-rodape-servicos', 'Serviços', '/servicos'),
    item('menu-rodape-simulador', 'Simulador de economia', '/simulador'),
    item('menu-rodape-sobre', 'A empresa', '/sobre'),
    item('menu-rodape-contato', 'Fale com um consultor', '/contato'),
  ],
  rodape_servicos: [
    item('menu-servicos-residencial', 'Energia solar residencial', '/servicos'),
    item('menu-servicos-comercial', 'Energia solar comercial e rural', '/servicos'),
    item('menu-servicos-homologacao', 'Projeto e homologação na concessionária', '/servicos'),
    item('menu-servicos-manutencao', 'Manutenção e monitoramento', '/servicos'),
  ],
};

/* ------------------------------------------------ conteúdo reutilizado --- */

/** Os 4 serviços, na forma que o bloco `cards_servicos` consome. */
const SERVICOS = [
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
    icone: 'Home',
    cor: 'amber' as const,
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
    icone: 'Building2',
    cor: 'blue' as const,
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
    icone: 'FileCheck2',
    cor: 'violet' as const,
  },
  {
    id: 'manutencao',
    titulo: 'Manutenção e monitoramento',
    resumo: 'Painel sujo ou string desligada some da conta e ninguém percebe até o fim do ano.',
    detalhes: [
      'Limpeza técnica dos módulos e inspeção das conexões',
      'Leitura do inversor e comparação com a geração projetada',
      'Laudo termográfico sob demanda',
      'Atendimento a sistemas instalados por terceiros',
    ],
    icone: 'Wrench',
    cor: 'emerald' as const,
  },
];

/** As quatro etapas do "Como funciona". */
const ETAPAS = [
  {
    numero: '01',
    titulo: 'Visita técnica',
    descricao:
      'Um consultor vai até o local, mede a área útil do telhado, confere o padrão de entrada e fotografa o quadro. Sem custo e sem compromisso.',
    icone: 'ClipboardCheck',
  },
  {
    numero: '02',
    titulo: 'Projeto e proposta',
    descricao:
      'Dimensionamos o sistema pela sua média de consumo e apresentamos a proposta com equipamentos, geração estimada e formas de pagamento.',
    icone: 'PencilRuler',
  },
  {
    numero: '03',
    titulo: 'Instalação e homologação',
    descricao:
      'Equipe própria instala, a engenharia emite a ART e cuidamos do processo junto à concessionária até a troca do medidor.',
    icone: 'HardHat',
  },
  {
    numero: '04',
    titulo: 'Geração e acompanhamento',
    descricao:
      'O sistema entra em operação, você acompanha a geração pelo inversor e a gente segue disponível para manutenção e dúvidas.',
    icone: 'Activity',
  },
];

const FAQ = [
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

const TITULO_FAQ = {
  rotulo: 'Dúvidas frequentes',
  titulo: 'O que todo mundo pergunta antes de fechar',
  descricao:
    'As respostas honestas, inclusive as que não são a resposta que o vendedor gostaria de dar.',
};

const PASSOS = {
  rotulo: 'Como funciona',
  titulo: 'Da visita técnica ao medidor trocado',
  descricao:
    'Quatro etapas, com um responsável em cada uma delas. Você sabe sempre em que ponto está o seu projeto.',
  itens: ETAPAS,
};

const SELOS = {
  rotulo: 'Quem está por trás',
  descricao:
    'Energia solar é obra elétrica ligada à rede da concessionária. Antes de fechar com qualquer empresa, confira o CNPJ e o registro do responsável técnico. Os nossos estão aqui.',
  marca_legenda: 'Energia Solar',
  itens: [
    { icone: 'FileCheck2', rotulo: 'Empresa formalizada', nota: '', cor: 'bg-blue-50 text-marca' },
    {
      icone: 'ShieldCheck',
      rotulo: 'Responsável técnico',
      nota: '',
      cor: 'bg-emerald-50 text-emerald-600',
    },
    {
      icone: 'MapPin',
      rotulo: 'Onde atendemos',
      nota: 'E toda a região metropolitana',
      cor: 'bg-amber-50 text-amber-600',
    },
  ],
};

/* ------------------------------------------------------------ páginas --- */

export const PAGINAS_PADRAO: PaginaSite[] = [
  {
    slug: 'home',
    caminho: '/',
    nome: 'Início',
    tituloSeo: 'Energia solar em Belo Horizonte',
    descricaoSeo:
      'Projeto, instalação e homologação de energia solar em Belo Horizonte e região. Simule sua economia e receba uma proposta com engenharia responsável.',
    blocos: [
      {
        id: 'home-heroi',
        tipo: 'heroi',
        conteudo: {
          logo_legenda: 'Energia Solar',
          titulo: 'A energia da sua casa',
          titulo_destaque: 'passa a ser sua.',
          subtitulo:
            'Projeto, instalação e homologação de sistemas fotovoltaicos com engenharia responsável. Você deixa de alugar energia da concessionária e passa a gerar a sua — com equipamentos, prazos e garantias por escrito.',
          cta_primario: { rotulo: 'Simular minha economia', destino: '/simulador' },
          cta_secundario: { rotulo: 'Falar com um consultor', destino: '/contato' },
          faixa_regiao: 'e região metropolitana',
          faixa_credencial: 'Projeto com ART e CREA',
          painel_rotulo: 'Por que gerar a própria energia',
          painel_cta: { rotulo: 'Ver quanto eu economizaria', destino: '/simulador' },
          destaques: [
            {
              titulo: 'A conta de luz vira investimento',
              texto:
                'O valor que hoje some todo mês passa a pagar um sistema que fica com você por mais de 25 anos.',
            },
            {
              titulo: 'Proteção contra o reajuste',
              texto:
                'A tarifa sobe todo ano. Quem gera a própria energia sente muito menos cada bandeira vermelha.',
            },
            {
              titulo: 'Imóvel mais valorizado',
              texto:
                'Sistema instalado e homologado é benfeitoria permanente, e pesa na hora de vender ou alugar.',
            },
          ],
        },
      },
      { id: 'home-selos', tipo: 'selos', conteudo: SELOS },
      {
        id: 'home-servicos',
        tipo: 'cards_servicos',
        conteudo: {
          rotulo: 'O que fazemos',
          titulo: 'Do telhado de casa ao galpão da empresa',
          descricao:
            'Cada projeto é dimensionado pela sua conta de luz e pelo seu telhado — não por um kit de catálogo.',
          centralizado: true,
          completo: false,
          claro: true,
          link_rodape: { rotulo: 'Ver o que está incluído em cada serviço', destino: '/servicos' },
          itens: SERVICOS,
        },
      },
      { id: 'home-passos', tipo: 'passos', conteudo: PASSOS },
      {
        id: 'home-conversao',
        tipo: 'banner_conversao',
        conteudo: {
          rotulo: 'Comece pelo número',
          titulo: 'Descubra em 30 segundos quanto a sua conta de luz pode cair.',
          texto:
            'O simulador usa exatamente a mesma fórmula de dimensionamento que os nossos consultores aplicam na proposta: a sua média de consumo, as horas de sol da região e as perdas reais do sistema. Sem número inflado para impressionar.',
          botao: { rotulo: 'Abrir o simulador', destino: '/simulador' },
          formulario_titulo: 'Prefere falar com gente?',
          formulario_descricao:
            'Deixe seu contato que um consultor retorna para agendar a visita técnica.',
        },
      },
      {
        id: 'home-faq',
        tipo: 'faq',
        conteudo: { ...TITULO_FAQ, claro: true, perguntas: FAQ.slice(0, 4) },
      },
      {
        id: 'home-cta',
        tipo: 'cta',
        conteudo: {
          titulo: 'A visita técnica é gratuita.',
          texto:
            'Um consultor vai até o local, mede o telhado, confere o padrão de entrada e só então monta a proposta. Se não fizer sentido para você, a gente diz.',
          regua: 'from-amber-500 to-orange-400',
          botoes: [{ rotulo: 'Agendar minha visita', destino: '/contato' }],
        },
      },
    ],
  },

  {
    slug: 'servicos',
    caminho: '/servicos',
    nome: 'Serviços',
    tituloSeo: 'Serviços',
    descricaoSeo:
      'Energia solar residencial, comercial e rural, projeto e homologação na concessionária, manutenção e monitoramento em Belo Horizonte e região.',
    blocos: [
      {
        id: 'servicos-cabecalho',
        tipo: 'cabecalho_pagina',
        conteudo: {
          rotulo: 'Serviços',
          titulo: 'Energia solar feita para o seu consumo, não para a média do mercado.',
          descricao:
            'Dimensionar por cima encarece o projeto; por baixo, deixa conta para pagar todo mês. A visita técnica existe para acertar esse número antes de qualquer proposta.',
        },
      },
      {
        id: 'servicos-lista',
        tipo: 'cards_servicos',
        conteudo: {
          rotulo: '',
          titulo: '',
          descricao: '',
          centralizado: false,
          completo: true,
          claro: false,
          itens: SERVICOS,
        },
      },
      {
        id: 'servicos-incluso',
        tipo: 'lista_itens',
        conteudo: {
          rotulo: 'Sempre incluso',
          titulo: 'O que vai junto em todo projeto',
          descricao:
            'Itens que costumam aparecer como extra em orçamento concorrente e aqui fazem parte do serviço.',
          claro: true,
          centralizado: true,
          colunas: 3,
          itens: [
            {
              icone: 'FileSignature',
              titulo: 'Engenharia e documentação',
              texto:
                'ART do responsável técnico, projeto elétrico, memorial descritivo e o processo completo de acesso junto à concessionária.',
              cor: 'blue',
            },
            {
              icone: 'PackageCheck',
              titulo: 'Equipamento com procedência',
              texto:
                'Módulos e inversores de fabricantes com representação no Brasil, nota fiscal em seu nome e garantia registrada.',
              cor: 'blue',
            },
            {
              icone: 'Zap',
              titulo: 'Instalação com equipe própria',
              texto:
                'Quem instala é a nossa equipe, com estrutura de fixação adequada ao seu telhado e proteções elétricas dimensionadas.',
              cor: 'blue',
            },
          ],
        },
      },
      { id: 'servicos-passos', tipo: 'passos', conteudo: PASSOS },
      {
        id: 'servicos-cta',
        tipo: 'cta',
        conteudo: {
          titulo: 'Não sabe qual se aplica ao seu caso?',
          texto:
            'Comece pelo simulador: com a sua conta de luz já dá para ver o porte do sistema. Depois um consultor confirma tudo na visita.',
          regua: 'from-emerald-500 to-teal-400',
          botoes: [
            { rotulo: 'Simular economia', destino: '/simulador' },
            { rotulo: 'Falar com um consultor', destino: '/contato' },
          ],
        },
      },
    ],
  },

  {
    slug: 'simulador',
    caminho: '/simulador',
    nome: 'Simulador',
    tituloSeo: 'Simulador de economia',
    descricaoSeo:
      'Simule quanto a energia solar pode reduzir da sua conta de luz em Belo Horizonte e região, com as horas de sol da sua concessionária.',
    blocos: [
      {
        id: 'simulador-cabecalho',
        tipo: 'cabecalho_pagina',
        conteudo: {
          rotulo: 'Simulador',
          icone: 'Calculator',
          titulo: 'Quanto o sol pode tirar da sua conta de luz?',
          descricao:
            'A mesma conta que os nossos consultores fazem na proposta, com as horas de sol da sua região e as perdas reais do sistema.',
        },
      },
      {
        id: 'simulador-calculadora',
        tipo: 'simulador',
        conteudo: {
          entrada_titulo: 'Seus dados de consumo',
          entrada_descricao:
            'Use a média dos últimos meses — a conta varia bastante entre verão e inverno.',
          vazio_titulo: 'Informe seu consumo ao lado',
          vazio_texto:
            'Com o valor da conta ou o consumo em kWh já conseguimos dimensionar o sistema.',
          economia_rotulo: 'Sua economia estimada',
          nota_projecao:
            'A projeção de 25 anos considera reajuste de 6% ao ano na tarifa de energia — é justamente por isso que a economia cresce com o tempo.',
          nota_investimento:
            'o valor do sistema depende dos equipamentos escolhidos, da estrutura do seu telhado e da forma de pagamento. Por isso ele não sai numa simulação automática — vem na proposta, depois da visita técnica, com tudo detalhado.',
          proximo_rotulo: 'Próximo passo',
          proximo_titulo: 'Leve esse número para uma proposta de verdade',
          proximo_descricao:
            'Enviamos o seu contato junto com o consumo simulado, para o consultor já começar a conversa sabendo do que se trata.',
          proximo_itens: [
            'Visita técnica sem custo, no dia que der para você',
            'Proposta com equipamentos, geração projetada e garantias',
            'Formas de pagamento à vista, cartão ou financiamento',
          ],
          formulario_titulo: 'Quero minha proposta',
          formulario_descricao: 'Preencha e um consultor entra em contato para agendar a visita.',
        },
      },
      {
        id: 'simulador-faq',
        tipo: 'faq',
        conteudo: { ...TITULO_FAQ, claro: false, perguntas: FAQ.slice(0, 3) },
      },
    ],
  },

  {
    slug: 'sobre',
    caminho: '/sobre',
    nome: 'A empresa',
    tituloSeo: 'A empresa',
    descricaoSeo:
      'Solar Costa Energia Solar: empresa de energia fotovoltaica em Belo Horizonte, com responsável técnico registrado no CREA e equipe própria de instalação.',
    blocos: [
      {
        id: 'sobre-cabecalho',
        tipo: 'cabecalho_pagina',
        conteudo: {
          rotulo: 'A empresa',
          titulo: 'Energia solar com engenharia por trás, não só com vendedor na frente.',
          descricao:
            'A Solar Costa projeta, instala e homologa sistemas fotovoltaicos em Belo Horizonte e na região metropolitana. Cada projeto sai com ART e responsável técnico registrado — o que garante que o sistema foi calculado por quem responde por ele.',
          mostrar_marca: true,
        },
      },
      {
        id: 'sobre-principios',
        tipo: 'lista_itens',
        conteudo: {
          rotulo: '',
          titulo: '',
          descricao: '',
          claro: false,
          centralizado: false,
          colunas: 3,
          itens: [
            {
              icone: 'Eye',
              titulo: 'Número que se sustenta',
              texto:
                'A geração projetada na proposta é a mesma que o simulador do site mostra, com as perdas reais embutidas. Prometer 100% de economia é fácil; entregar é outra história.',
              cor: 'blue',
            },
            {
              icone: 'Handshake',
              titulo: 'Uma empresa, um responsável',
              texto:
                'Projeto, instalação e homologação ficam com a gente. Não repassamos a obra para terceiros e depois some o telefone quando aparece um problema.',
              cor: 'emerald',
            },
            {
              icone: 'Wrench',
              titulo: 'Depois da instalação também',
              texto:
                'Sistema fotovoltaico dá pouca manutenção, mas não dá nenhuma. Seguimos disponíveis para limpeza, inspeção e dúvidas sobre a fatura.',
              cor: 'amber',
            },
          ],
        },
      },
      {
        id: 'sobre-dados',
        tipo: 'dados_empresa',
        conteudo: {
          rotulo_cadastro: 'Transparência',
          titulo_cadastro: 'Dados cadastrais',
          descricao_cadastro:
            'Antes de assinar qualquer contrato de energia solar, confira o CNPJ e o registro do responsável técnico da empresa. Aqui estão os nossos.',
          rotulo_escritorio: 'Onde estamos',
          titulo_escritorio: 'Atendimento e escritório',
          area_atendimento:
            'Belo Horizonte, Contagem, Betim, Nova Lima, Santa Luzia, Ribeirão das Neves, Sabará, Vespasiano e demais cidades da região metropolitana.',
        },
      },
      {
        id: 'sobre-cta',
        tipo: 'cta',
        conteudo: {
          titulo: 'Vamos conversar sobre o seu projeto?',
          texto:
            'Comece pelo simulador ou fale direto com um consultor. Nos dois caminhos, a visita técnica é gratuita.',
          regua: 'from-blue-600 to-indigo-500',
          botoes: [
            { rotulo: 'Falar com um consultor', destino: '/contato' },
            { rotulo: 'Abrir o simulador', destino: '/simulador' },
          ],
        },
      },
    ],
  },

  {
    slug: 'contato',
    caminho: '/contato',
    nome: 'Contato',
    tituloSeo: 'Contato',
    descricaoSeo:
      'Fale com a Solar Costa: agende uma visita técnica gratuita para energia solar em Belo Horizonte e região. Telefone, WhatsApp, e-mail e endereço.',
    blocos: [
      {
        id: 'contato-cabecalho',
        tipo: 'cabecalho_pagina',
        conteudo: {
          rotulo: 'Contato',
          titulo: 'A visita técnica é gratuita. Vamos marcar?',
          descricao:
            'Escolha o canal que preferir. Se puder, tenha em mãos uma conta de luz recente — é com ela que o consultor começa o dimensionamento.',
        },
      },
      {
        id: 'contato-canais',
        tipo: 'contato_canais',
        conteudo: {
          formulario_titulo: 'Envie seus dados',
          formulario_descricao:
            'Chega direto na equipe comercial. Retornamos pelo telefone que você informar.',
          mensagem_whatsapp: 'Olá! Vim pelo site da Solar Costa e gostaria de um orçamento.',
          canais: [
            {
              tipo: 'whatsapp',
              icone: 'MessageCircle',
              rotulo: 'WhatsApp',
              nota: 'Resposta mais rápida no horário comercial',
              cor: 'bg-emerald-50 text-emerald-600',
            },
            {
              tipo: 'telefone',
              icone: 'Phone',
              rotulo: 'Telefone',
              nota: 'Segunda a sexta',
              cor: 'bg-blue-50 text-marca',
            },
            {
              tipo: 'email',
              icone: 'Mail',
              rotulo: 'E-mail',
              nota: 'Para envio de contas e documentos',
              cor: 'bg-violet-50 text-violet-600',
            },
          ],
          horario_rotulo: 'Atendimento',
          horario_texto:
            'Segunda a sexta, das 8h às 18h. Visitas técnicas também podem ser agendadas aos sábados pela manhã.',
        },
      },
    ],
  },
];

export const CONTEUDO_PADRAO: ConteudoSite = {
  paginas: PAGINAS_PADRAO,
  menus: MENUS_PADRAO,
};

/** Página de fábrica por slug — usada quando a API não respondeu. */
export function paginaPadrao(slug: string): PaginaSite | undefined {
  return PAGINAS_PADRAO.find((p) => p.slug === slug);
}
