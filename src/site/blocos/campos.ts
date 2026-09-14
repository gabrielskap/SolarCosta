// Que campos cada tipo de bloco mostra no editor.
//
// É a metade "administração" do catálogo — a metade "site" (tipo → componente)
// está em registro.tsx. Separados porque o bundle público não deve carregar
// rótulo de formulário, e porque são coisas que mudam por motivos diferentes.
//
// Existe para que a tela NÃO tenha um formulário escrito à mão por tipo de
// bloco. EditorBloco lê esta lista e desenha os controles; acrescentar um campo
// num bloco é acrescentar uma linha aqui, não mexer em JSX.

import type { TipoBloco } from './tipos';

export type TipoCampo =
  | 'texto'
  | 'texto_longo'
  | 'paragrafos'
  | 'booleano'
  | 'selecao'
  | 'icone'
  | 'imagem'
  | 'link'
  | 'lista';

export interface CampoEditor {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  ajuda?: string;
  /** Só para `selecao`. */
  opcoes?: { valor: string | number; rotulo: string }[];
  /** Só para `lista`: a forma de cada item e como nasce um item novo. */
  campos?: CampoEditor[];
  rotuloItem?: string;
  novoItem?: () => Record<string, unknown>;
}

/* ------------------------------------------------------- campos comuns --- */

const CORES_CHIP = [
  { valor: 'blue', rotulo: 'Azul' },
  { valor: 'emerald', rotulo: 'Verde' },
  { valor: 'amber', rotulo: 'Âmbar' },
  { valor: 'violet', rotulo: 'Violeta' },
];

const REGUAS = [
  { valor: 'from-amber-500 to-orange-400', rotulo: 'Laranja' },
  { valor: 'from-emerald-500 to-teal-400', rotulo: 'Verde' },
  { valor: 'from-blue-600 to-indigo-500', rotulo: 'Azul' },
  { valor: 'from-violet-500 to-fuchsia-400', rotulo: 'Violeta' },
];

const FUNDO_CLARO: CampoEditor = {
  chave: 'claro',
  rotulo: 'Fundo branco',
  tipo: 'booleano',
  ajuda: 'Alterna o fundo da seção entre branco e cinza, separando blocos vizinhos.',
};

const ROTULO: CampoEditor = {
  chave: 'rotulo',
  rotulo: 'Rótulo',
  tipo: 'texto',
  ajuda: 'Texto pequeno em caixa alta acima do título. Deixe vazio para esconder.',
};

const TITULO: CampoEditor = { chave: 'titulo', rotulo: 'Título', tipo: 'texto' };
const DESCRICAO: CampoEditor = { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto_longo' };

/* ------------------------------------------------------------ catálogo --- */

export const CAMPOS_BLOCO: Record<TipoBloco, CampoEditor[]> = {
  heroi: [
    { chave: 'logo_legenda', rotulo: 'Legenda sob o logotipo', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título (primeira linha)', tipo: 'texto' },
    {
      chave: 'titulo_destaque',
      rotulo: 'Título (segunda linha, em amarelo)',
      tipo: 'texto',
      ajuda: 'Deixe vazio para um título de uma linha só.',
    },
    { chave: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto_longo' },
    { chave: 'cta_primario', rotulo: 'Botão principal', tipo: 'link' },
    { chave: 'cta_secundario', rotulo: 'Botão secundário', tipo: 'link' },
    {
      chave: 'faixa_regiao',
      rotulo: 'Complemento da região',
      tipo: 'texto',
      ajuda: 'Vem depois da cidade/UF do cadastro. Ex.: "e região metropolitana".',
    },
    {
      chave: 'faixa_credencial',
      rotulo: 'Texto da credencial',
      tipo: 'texto',
      ajuda: 'O número do CREA é acrescentado automaticamente a partir do cadastro.',
    },
    { chave: 'painel_rotulo', rotulo: 'Rótulo do painel lateral', tipo: 'texto' },
    {
      chave: 'destaques',
      rotulo: 'Destaques do painel',
      tipo: 'lista',
      rotuloItem: 'Destaque',
      campos: [
        { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
        { chave: 'texto', rotulo: 'Texto', tipo: 'texto_longo' },
      ],
      novoItem: () => ({ titulo: '', texto: '' }),
    },
    { chave: 'painel_cta', rotulo: 'Link no rodapé do painel', tipo: 'link' },
  ],

  selos: [
    ROTULO,
    DESCRICAO,
    { chave: 'marca_legenda', rotulo: 'Legenda sob a marca', tipo: 'texto' },
    {
      chave: 'itens',
      rotulo: 'Credenciais',
      tipo: 'lista',
      rotuloItem: 'Credencial',
      ajuda:
        'Os VALORES (CNPJ, responsável técnico, cidade) vêm do cadastro da empresa, nesta ordem. Aqui você edita só os rótulos.',
      campos: [
        { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
        { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
        {
          chave: 'nota',
          rotulo: 'Nota',
          tipo: 'texto',
          ajuda: 'Usada só quando o cadastro não tem um complemento para este item.',
        },
        { chave: 'cor', rotulo: 'Cor do ícone (classes)', tipo: 'texto' },
      ],
      novoItem: () => ({ icone: 'ShieldCheck', rotulo: '', nota: '', cor: 'bg-blue-50 text-marca' }),
    },
  ],

  cabecalho_pagina: [
    ROTULO,
    TITULO,
    DESCRICAO,
    { chave: 'icone', rotulo: 'Ícone ao lado do rótulo', tipo: 'icone' },
    {
      chave: 'mostrar_marca',
      rotulo: 'Mostrar logotipo e razão social',
      tipo: 'booleano',
      ajuda: 'Acrescenta a faixa institucional abaixo do título.',
    },
  ],

  cards_servicos: [
    ROTULO,
    TITULO,
    DESCRICAO,
    { chave: 'centralizado', rotulo: 'Título centralizado', tipo: 'booleano' },
    {
      chave: 'completo',
      rotulo: 'Mostrar a lista de detalhes',
      tipo: 'booleano',
      ajuda: 'Ligado, cada cartão abre os itens inclusos e a grade vira de duas colunas.',
    },
    FUNDO_CLARO,
    { chave: 'link_rodape', rotulo: 'Link abaixo da grade', tipo: 'link' },
    {
      chave: 'itens',
      rotulo: 'Serviços',
      tipo: 'lista',
      rotuloItem: 'Serviço',
      campos: [
        { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
        { chave: 'resumo', rotulo: 'Resumo', tipo: 'texto_longo' },
        { chave: 'detalhes', rotulo: 'Itens inclusos', tipo: 'paragrafos' },
        { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
        { chave: 'cor', rotulo: 'Cor', tipo: 'selecao', opcoes: CORES_CHIP },
      ],
      novoItem: () => ({
        id: `servico-${Date.now()}`,
        titulo: '',
        resumo: '',
        detalhes: [],
        icone: 'Home',
        cor: 'blue',
      }),
    },
  ],

  passos: [
    ROTULO,
    TITULO,
    DESCRICAO,
    {
      chave: 'itens',
      rotulo: 'Etapas',
      tipo: 'lista',
      rotuloItem: 'Etapa',
      campos: [
        { chave: 'numero', rotulo: 'Número', tipo: 'texto' },
        { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto_longo' },
        { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
      ],
      novoItem: () => ({ numero: '', titulo: '', descricao: '', icone: 'ClipboardCheck' }),
    },
  ],

  faq: [
    ROTULO,
    TITULO,
    DESCRICAO,
    FUNDO_CLARO,
    {
      chave: 'perguntas',
      rotulo: 'Perguntas',
      tipo: 'lista',
      rotuloItem: 'Pergunta',
      campos: [
        { chave: 'pergunta', rotulo: 'Pergunta', tipo: 'texto' },
        { chave: 'resposta', rotulo: 'Resposta', tipo: 'texto_longo' },
      ],
      novoItem: () => ({ pergunta: '', resposta: '' }),
    },
  ],

  cta: [
    TITULO,
    { chave: 'texto', rotulo: 'Texto', tipo: 'texto_longo' },
    { chave: 'regua', rotulo: 'Cor da régua', tipo: 'selecao', opcoes: REGUAS },
    {
      chave: 'botoes',
      rotulo: 'Botões',
      tipo: 'lista',
      rotuloItem: 'Botão',
      ajuda: 'O primeiro botão sai cheio; o segundo, de contorno.',
      campos: [
        { chave: 'rotulo', rotulo: 'Texto do botão', tipo: 'texto' },
        { chave: 'destino', rotulo: 'Destino', tipo: 'texto' },
      ],
      novoItem: () => ({ rotulo: '', destino: '/contato' }),
    },
  ],

  lista_itens: [
    ROTULO,
    TITULO,
    DESCRICAO,
    FUNDO_CLARO,
    { chave: 'centralizado', rotulo: 'Título centralizado', tipo: 'booleano' },
    {
      chave: 'colunas',
      rotulo: 'Colunas',
      tipo: 'selecao',
      opcoes: [
        { valor: 2, rotulo: '2 colunas' },
        { valor: 3, rotulo: '3 colunas' },
        { valor: 4, rotulo: '4 colunas' },
      ],
    },
    {
      chave: 'itens',
      rotulo: 'Itens',
      tipo: 'lista',
      rotuloItem: 'Item',
      campos: [
        { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
        { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
        { chave: 'texto', rotulo: 'Texto', tipo: 'texto_longo' },
        { chave: 'cor', rotulo: 'Cor', tipo: 'selecao', opcoes: CORES_CHIP },
      ],
      novoItem: () => ({ icone: 'CheckCircle2', titulo: '', texto: '', cor: 'blue' }),
    },
  ],

  banner_conversao: [
    ROTULO,
    TITULO,
    { chave: 'texto', rotulo: 'Texto', tipo: 'texto_longo' },
    { chave: 'botao', rotulo: 'Botão', tipo: 'link' },
    { chave: 'formulario_titulo', rotulo: 'Título do formulário', tipo: 'texto' },
    { chave: 'formulario_descricao', rotulo: 'Descrição do formulário', tipo: 'texto_longo' },
  ],

  dados_empresa: [
    { chave: 'rotulo_cadastro', rotulo: 'Rótulo — coluna do cadastro', tipo: 'texto' },
    { chave: 'titulo_cadastro', rotulo: 'Título — coluna do cadastro', tipo: 'texto' },
    { chave: 'descricao_cadastro', rotulo: 'Descrição — coluna do cadastro', tipo: 'texto_longo' },
    { chave: 'rotulo_escritorio', rotulo: 'Rótulo — coluna do escritório', tipo: 'texto' },
    { chave: 'titulo_escritorio', rotulo: 'Título — coluna do escritório', tipo: 'texto' },
    {
      chave: 'area_atendimento',
      rotulo: 'Área de atendimento',
      tipo: 'texto_longo',
      ajuda: 'Endereço, telefone e e-mail vêm do cadastro da empresa.',
    },
  ],

  contato_canais: [
    { chave: 'formulario_titulo', rotulo: 'Título do formulário', tipo: 'texto' },
    { chave: 'formulario_descricao', rotulo: 'Descrição do formulário', tipo: 'texto_longo' },
    {
      chave: 'mensagem_whatsapp',
      rotulo: 'Mensagem que abre no WhatsApp',
      tipo: 'texto_longo',
    },
    {
      chave: 'canais',
      rotulo: 'Canais',
      tipo: 'lista',
      rotuloItem: 'Canal',
      ajuda: 'O número e o e-mail vêm do cadastro da empresa, conforme o tipo escolhido.',
      campos: [
        {
          chave: 'tipo',
          rotulo: 'Tipo',
          tipo: 'selecao',
          opcoes: [
            { valor: 'whatsapp', rotulo: 'WhatsApp' },
            { valor: 'telefone', rotulo: 'Telefone' },
            { valor: 'email', rotulo: 'E-mail' },
          ],
        },
        { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
        { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
        { chave: 'nota', rotulo: 'Nota', tipo: 'texto' },
        { chave: 'cor', rotulo: 'Cor do ícone (classes)', tipo: 'texto' },
      ],
      novoItem: () => ({
        tipo: 'telefone',
        icone: 'Phone',
        rotulo: '',
        nota: '',
        cor: 'bg-blue-50 text-marca',
      }),
    },
    { chave: 'horario_rotulo', rotulo: 'Rótulo do horário', tipo: 'texto' },
    { chave: 'horario_texto', rotulo: 'Horário de atendimento', tipo: 'texto_longo' },
  ],

  simulador: [
    { chave: 'entrada_titulo', rotulo: 'Título do formulário de consumo', tipo: 'texto' },
    { chave: 'entrada_descricao', rotulo: 'Descrição do formulário', tipo: 'texto_longo' },
    { chave: 'vazio_titulo', rotulo: 'Título quando não há resultado', tipo: 'texto' },
    { chave: 'vazio_texto', rotulo: 'Texto quando não há resultado', tipo: 'texto_longo' },
    { chave: 'economia_rotulo', rotulo: 'Rótulo do painel de economia', tipo: 'texto' },
    {
      chave: 'nota_projecao',
      rotulo: 'Nota sobre a projeção de 25 anos',
      tipo: 'texto_longo',
      ajuda: 'A frase sobre a cobertura do consumo é acrescentada automaticamente.',
    },
    { chave: 'nota_investimento', rotulo: 'Nota sobre o investimento', tipo: 'texto_longo' },
    { chave: 'proximo_rotulo', rotulo: 'Rótulo — próximo passo', tipo: 'texto' },
    { chave: 'proximo_titulo', rotulo: 'Título — próximo passo', tipo: 'texto' },
    { chave: 'proximo_descricao', rotulo: 'Descrição — próximo passo', tipo: 'texto_longo' },
    { chave: 'proximo_itens', rotulo: 'Itens do próximo passo', tipo: 'paragrafos' },
    { chave: 'formulario_titulo', rotulo: 'Título do formulário', tipo: 'texto' },
    { chave: 'formulario_descricao', rotulo: 'Descrição do formulário', tipo: 'texto_longo' },
  ],

  texto_rico: [
    ROTULO,
    TITULO,
    FUNDO_CLARO,
    { chave: 'paragrafos', rotulo: 'Parágrafos', tipo: 'paragrafos' },
    { chave: 'imagem_id', rotulo: 'Imagem ao lado', tipo: 'imagem' },
  ],

  galeria: [
    ROTULO,
    TITULO,
    DESCRICAO,
    FUNDO_CLARO,
    {
      chave: 'imagens',
      rotulo: 'Imagens',
      tipo: 'lista',
      rotuloItem: 'Imagem',
      campos: [
        { chave: 'midia_id', rotulo: 'Imagem', tipo: 'imagem' },
        { chave: 'legenda', rotulo: 'Legenda', tipo: 'texto' },
      ],
      novoItem: () => ({ midia_id: '', legenda: '' }),
    },
  ],
};

export function camposDe(tipo: string): CampoEditor[] {
  return CAMPOS_BLOCO[tipo as TipoBloco] ?? [];
}
