// Texto da procuração no modelo da Solar Costa.
//
// Transcrito de "Procuraçao modelo editavel.docx". Os dados que mudam de uma
// procuração para outra viraram MARCADORES entre chaves, resolvidos por
// src/procuracao/marcadores.ts. O resto é o texto do modelo, palavra por
// palavra, salvo estes acertos:
//   · a qualificação do outorgante e a dos outorgados são montadas dos dados,
//     concordadas com o gênero escolhido ("inscrita", "portador"), e o
//     "residente Rua …" sem preposição virou "residente … no endereço";
//   · vírgula depois do nome da concessionária, e "todas as unidades
//     consumidoras" no lugar de "todas unidades";
//   · vírgula entre o local e a data, no fecho.
// O nome, o CPF, o endereço e a data do .docx eram dados, que agora vêm do
// formulário.
//
// Convenções do texto: as do motor dividido com o contrato
// (src/documento/textoModelo.ts) — cada linha é um parágrafo, `**trecho**` sai
// em negrito.
//
// MUDAR ESTE TEXTO muda toda procuração que for reimpressa. Se a mudança for de
// conteúdo jurídico, suba MODELO_PROCURACAO_VERSAO e mantenha a versão anterior
// — a procuração assinada precisa continuar imprimindo o que foi assinado.

import type { ChaveSecaoProcuracao } from '../types';

export const MODELO_PROCURACAO_VERSAO = 1;

export const TITULO_PROCURACAO = 'PROCURAÇÃO';

export interface SecaoProcuracao {
  chave: ChaveSecaoProcuracao;
  /** Rótulo da coluna da esquerda no quadro ("OUTORGANTE:"); vazio fora dele. */
  titulo: string;
  /** Nome curto para a lista do editor. */
  rotulo: string;
  texto: string;
}

export const SECOES: SecaoProcuracao[] = [
  {
    chave: 'abertura',
    titulo: '',
    rotulo: 'Abertura',
    texto: 'Pelo presente instrumento particular de mandato.',
  },
  {
    chave: 'outorgante',
    titulo: 'OUTORGANTE:',
    rotulo: 'Outorgante — qualificação',
    texto: '{outorgante_qualificacao}',
  },
  {
    chave: 'outorgados',
    titulo: 'OUTORGADOS:',
    rotulo: 'Outorgados — qualificação',
    texto: '{outorgados_qualificacao}.',
  },
  {
    chave: 'poderes',
    titulo: 'PODERES CONFERIDOS:',
    rotulo: 'Poderes conferidos',
    texto: 'Representar o OUTORGANTE perante a Concessionária {concessionaria}, assinando toda a documentação necessária para o bom trâmite do processo de ligação nova e solicitação de acesso e efetiva conexão do sistema fotovoltaico, aumento de carga, encaminhando soluções de pendências e solicitando vistorias e informações, relativas a todas as unidades consumidoras em meu nome.',
  },
  {
    chave: 'vigencia',
    titulo: '',
    rotulo: 'Vigência',
    texto: 'O presente mandato vigorará até a finalização do processo de solicitação de acesso da microgeração em questão, que se dará com a substituição do medidor de energia, vedado o substabelecimento dos poderes outorgados.',
  },
  {
    chave: 'fecho',
    titulo: '',
    rotulo: 'Fecho — local e data',
    texto: '{local_data}',
  },
];

/** As seções do quadro de duas colunas, na ordem do .docx. */
export const SECOES_DO_QUADRO: ChaveSecaoProcuracao[] = ['outorgante', 'outorgados', 'poderes'];

export const CHAVES_SECOES: ChaveSecaoProcuracao[] = SECOES.map((s) => s.chave);

export function secaoDoModelo(chave: ChaveSecaoProcuracao): SecaoProcuracao {
  const secao = SECOES.find((s) => s.chave === chave);
  if (!secao) throw new Error(`Seção de procuração desconhecida: ${chave}`);
  return secao;
}

/** "OUTORGADOS:" vira "OUTORGADO:" quando há um só. */
export function tituloNoQuadro(chave: ChaveSecaoProcuracao, quantidadeOutorgados: number): string {
  const titulo = secaoDoModelo(chave).titulo;
  return chave === 'outorgados' && quantidadeOutorgados === 1 ? 'OUTORGADO:' : titulo;
}
