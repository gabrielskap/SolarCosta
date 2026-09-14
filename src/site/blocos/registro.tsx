// Catálogo de blocos: tipo → componente que sabe desenhá-lo.
//
// É a ponte entre o que o banco guarda (uma string em `tipo` e um jsonb em
// `conteudo`) e o que a página renderiza. Duas regras valem em todo lugar:
//
//   · Tipo que não está aqui é IGNORADO, não quebra. É o que permite o banco
//     andar à frente do bundle — um deploy parcial não derruba o site.
//   · `padrao()` devolve o conteúdo de um bloco recém-criado. Nunca objeto
//     vazio: o administrador que adiciona um bloco novo tem de ver alguma
//     coisa na tela para saber o que está editando.
//
// A metade "editor" do catálogo (quais campos cada tipo tem, com que rótulo)
// mora em campos.ts, separada para que o bundle do site não carregue
// metadados que só a tela de administração usa.

import React from 'react';
import {
  Image,
  LayoutList,
  MessageSquareQuote,
  Phone,
  Rows3,
  Sparkles,
  SquareStack,
  Building2,
  Calculator,
  FileText,
  HelpCircle,
  Megaphone,
  ShieldCheck,
  Type,
  type LucideIcon,
} from 'lucide-react';

import { Heroi } from '../components/Heroi';
import { SeloCredibilidade } from '../components/SeloCredibilidade';
import { ComoFunciona } from '../components/ComoFunciona';
import { PerguntasFrequentes } from '../components/PerguntasFrequentes';
import { CabecalhoBloco } from './CabecalhoBloco';
import { CardsServicos } from './CardsServicos';
import { Cta } from './Cta';
import { ListaItens } from './ListaItens';
import { BannerConversao } from './BannerConversao';
import { DadosEmpresa } from './DadosEmpresa';
import { ContatoCanais } from './ContatoCanais';
import { BlocoSimulador } from './BlocoSimulador';
import { TextoRico } from './TextoRico';
import { Galeria } from './Galeria';
import type { TipoBloco } from './tipos';

export interface DefinicaoBloco {
  rotulo: string;
  descricao: string;
  Icone: LucideIcon;
  Componente: React.FC<{ conteudo: any }>;
  padrao: () => Record<string, unknown>;
  /**
   * Bloco que depende de dados do sistema (cadastro da empresa, parâmetros de
   * dimensionamento) além do próprio texto. A tela avisa que parte do que
   * aparece no site não sai do editor.
   */
  usaDadosDoSistema?: boolean;
}

export const REGISTRO_BLOCOS: Record<TipoBloco, DefinicaoBloco> = {
  heroi: {
    rotulo: 'Herói',
    descricao: 'Primeira dobra: logotipo, título grande, botões e painel de destaques.',
    Icone: Sparkles,
    Componente: Heroi,
    usaDadosDoSistema: true,
    padrao: () => ({
      logo_legenda: 'Energia Solar',
      titulo: 'Título principal',
      titulo_destaque: 'com destaque em amarelo.',
      subtitulo: 'Um parágrafo explicando o que a empresa faz.',
      cta_primario: { rotulo: 'Simular economia', destino: '/simulador' },
      cta_secundario: { rotulo: 'Falar com um consultor', destino: '/contato' },
      faixa_regiao: 'e região metropolitana',
      faixa_credencial: 'Projeto com ART e CREA',
      painel_rotulo: 'Por que gerar a própria energia',
      painel_cta: { rotulo: 'Ver quanto eu economizaria', destino: '/simulador' },
      destaques: [{ titulo: 'Primeiro motivo', texto: 'Explique em uma frase.' }],
    }),
  },

  selos: {
    rotulo: 'Selo de credibilidade',
    descricao: 'Marca ao lado de CNPJ, responsável técnico e cidade de atuação.',
    Icone: ShieldCheck,
    Componente: SeloCredibilidade,
    usaDadosDoSistema: true,
    padrao: () => ({
      rotulo: 'Quem está por trás',
      descricao: 'Texto curto convidando o visitante a conferir os registros.',
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
    }),
  },

  cabecalho_pagina: {
    rotulo: 'Cabeçalho da página',
    descricao: 'Faixa azul com rótulo, título e descrição que abre uma página interna.',
    Icone: Type,
    Componente: CabecalhoBloco,
    padrao: () => ({
      rotulo: 'Seção',
      titulo: 'Título da página',
      descricao: 'Um parágrafo de apresentação.',
      mostrar_marca: false,
    }),
  },

  cards_servicos: {
    rotulo: 'Cartões de serviço',
    descricao: 'Grade de serviços, compacta ou aberta com a lista de detalhes.',
    Icone: SquareStack,
    Componente: CardsServicos,
    padrao: () => ({
      rotulo: 'O que fazemos',
      titulo: 'Título da seção',
      descricao: '',
      centralizado: true,
      completo: false,
      claro: true,
      itens: [
        {
          id: 'servico-1',
          titulo: 'Nome do serviço',
          resumo: 'Uma frase sobre o serviço.',
          detalhes: ['Primeiro item incluso'],
          icone: 'Home',
          cor: 'amber',
        },
      ],
    }),
  },

  passos: {
    rotulo: 'Como funciona',
    descricao: 'Etapas numeradas, do primeiro contato à energia gerando.',
    Icone: Rows3,
    Componente: ComoFunciona,
    padrao: () => ({
      rotulo: 'Como funciona',
      titulo: 'Título da seção',
      descricao: '',
      itens: [
        { numero: '01', titulo: 'Primeira etapa', descricao: 'O que acontece aqui.', icone: 'ClipboardCheck' },
      ],
    }),
  },

  faq: {
    rotulo: 'Perguntas frequentes',
    descricao: 'Lista de pergunta e resposta que abre e fecha.',
    Icone: HelpCircle,
    Componente: PerguntasFrequentes,
    padrao: () => ({
      rotulo: 'Dúvidas frequentes',
      titulo: 'O que todo mundo pergunta antes de fechar',
      descricao: '',
      claro: false,
      perguntas: [{ pergunta: 'Escreva a pergunta', resposta: 'Escreva a resposta.' }],
    }),
  },

  cta: {
    rotulo: 'Chamada final',
    descricao: 'Cartão centralizado com título, texto e até dois botões.',
    Icone: Megaphone,
    Componente: Cta,
    padrao: () => ({
      titulo: 'Chamada para ação',
      texto: 'Um parágrafo curto convidando o visitante.',
      regua: 'from-amber-500 to-orange-400',
      botoes: [{ rotulo: 'Falar com um consultor', destino: '/contato' }],
    }),
  },

  lista_itens: {
    rotulo: 'Lista de cartões',
    descricao: 'Cartões com ícone, título e texto. Serve para qualquer lista.',
    Icone: LayoutList,
    Componente: ListaItens,
    padrao: () => ({
      rotulo: '',
      titulo: 'Título da seção',
      descricao: '',
      claro: false,
      centralizado: true,
      colunas: 3,
      itens: [
        { icone: 'CheckCircle2', titulo: 'Primeiro item', texto: 'Explique em uma frase.', cor: 'blue' },
      ],
    }),
  },

  banner_conversao: {
    rotulo: 'Faixa de conversão',
    descricao: 'Fundo azul com chamada de um lado e formulário de contato do outro.',
    Icone: MessageSquareQuote,
    Componente: BannerConversao,
    usaDadosDoSistema: true,
    padrao: () => ({
      rotulo: 'Comece pelo número',
      titulo: 'Título da chamada',
      texto: 'Um parágrafo explicando o convite.',
      botao: { rotulo: 'Abrir o simulador', destino: '/simulador' },
      formulario_titulo: 'Prefere falar com gente?',
      formulario_descricao: 'Deixe seu contato que um consultor retorna.',
    }),
  },

  dados_empresa: {
    rotulo: 'Dados cadastrais',
    descricao: 'Registro da empresa e endereço do escritório, vindos do cadastro.',
    Icone: Building2,
    Componente: DadosEmpresa,
    usaDadosDoSistema: true,
    padrao: () => ({
      rotulo_cadastro: 'Transparência',
      titulo_cadastro: 'Dados cadastrais',
      descricao_cadastro: 'Convide o visitante a conferir CNPJ e responsável técnico.',
      rotulo_escritorio: 'Onde estamos',
      titulo_escritorio: 'Atendimento e escritório',
      area_atendimento: 'Cidades atendidas.',
    }),
  },

  contato_canais: {
    rotulo: 'Canais de contato',
    descricao: 'Formulário de captação ao lado de WhatsApp, telefone, e-mail e endereço.',
    Icone: Phone,
    Componente: ContatoCanais,
    usaDadosDoSistema: true,
    padrao: () => ({
      formulario_titulo: 'Envie seus dados',
      formulario_descricao: 'Chega direto na equipe comercial.',
      mensagem_whatsapp: 'Olá! Vim pelo site e gostaria de um orçamento.',
      canais: [
        {
          tipo: 'whatsapp',
          icone: 'MessageCircle',
          rotulo: 'WhatsApp',
          nota: 'Resposta mais rápida no horário comercial',
          cor: 'bg-emerald-50 text-emerald-600',
        },
      ],
      horario_rotulo: 'Atendimento',
      horario_texto: 'Segunda a sexta, das 8h às 18h.',
    }),
  },

  simulador: {
    rotulo: 'Simulador de economia',
    descricao: 'A calculadora pública, com o convite de proposta logo abaixo.',
    Icone: Calculator,
    Componente: BlocoSimulador,
    usaDadosDoSistema: true,
    padrao: () => ({
      entrada_titulo: 'Seus dados de consumo',
      entrada_descricao: 'Use a média dos últimos meses.',
      vazio_titulo: 'Informe seu consumo ao lado',
      vazio_texto: 'Com o valor da conta já conseguimos dimensionar o sistema.',
      economia_rotulo: 'Sua economia estimada',
      nota_projecao: 'A projeção de 25 anos considera reajuste anual na tarifa de energia.',
      nota_investimento: 'o valor do sistema vem na proposta, depois da visita técnica.',
      proximo_rotulo: 'Próximo passo',
      proximo_titulo: 'Leve esse número para uma proposta de verdade',
      proximo_descricao: 'Enviamos o seu contato junto com o consumo simulado.',
      proximo_itens: ['Visita técnica sem custo'],
      formulario_titulo: 'Quero minha proposta',
      formulario_descricao: 'Preencha e um consultor entra em contato.',
    }),
  },

  texto_rico: {
    rotulo: 'Texto livre',
    descricao: 'Parágrafos soltos, com imagem opcional ao lado.',
    Icone: FileText,
    Componente: TextoRico,
    padrao: () => ({
      rotulo: '',
      titulo: 'Título do texto',
      claro: false,
      paragrafos: ['Escreva aqui o primeiro parágrafo.'],
      imagem_id: null,
    }),
  },

  galeria: {
    rotulo: 'Galeria de fotos',
    descricao: 'Grade de imagens da biblioteca, com legenda opcional.',
    Icone: Image,
    Componente: Galeria,
    padrao: () => ({
      rotulo: '',
      titulo: 'Nossos trabalhos',
      descricao: '',
      claro: false,
      imagens: [],
    }),
  },
};

/** Ordem em que os tipos aparecem no catálogo "Adicionar bloco". */
export const TIPOS_EM_ORDEM = Object.keys(REGISTRO_BLOCOS) as TipoBloco[];

export function definicao(tipo: string): DefinicaoBloco | undefined {
  return REGISTRO_BLOCOS[tipo as TipoBloco];
}
