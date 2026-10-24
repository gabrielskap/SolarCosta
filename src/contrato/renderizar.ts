// Texto do modelo (ou personalizado) -> blocos prontos para desenhar.
//
// Sem React de propósito: o mesmo resultado alimenta o documento impresso, a
// pré-visualização do editor e os testes em scripts/test-modelo-contrato.ts.
//
// A marcação é mínima, para quem personaliza uma cláusula não precisar
// aprender nada além do que vê no texto padrão:
//   · cada linha é um parágrafo (linhas vazias são ignoradas);
//   · `**trecho**` sai em negrito;
//   · numeração no começo da linha ("2.3.1", "(iv)", "a)") sai em negrito, e
//     os itens "(i)"/"a)" saem recuados, como no .docx;
//   · `{tabela_garantias}` sozinho numa linha vira a tabela da cláusula 7.2.
//
// Valor de marcador NUNCA é interpretado: um `**` digitado no nome do
// cliente sai como `**`, não vira negrito. (E o React escapa o resto.)

import type { ChaveSecaoContrato } from '../types';
import { type DadosContrato, type Trecho, marcador } from './marcadores';
import { secaoDoModelo } from './modeloSolarCosta';

export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[]; item: boolean }
  | { tipo: 'tabela_garantias' };

const NUMERACAO = /^((?:\d+(?:\.\d+)+\.?)|(?:\((?:[ivxlcdm]+|[IVXLCDM]+)\))|(?:[a-z]\)))\s+/;
const ITEM = /^(?:\([ivxlcdm]+\)|[a-z]\))$/;
const MARCADOR = /\{([a-z0-9_]+)\}/g;

/** Texto efetivo da seção: o personalizado no contrato ou o do modelo. */
export function textoDaSecao(d: DadosContrato, chave: ChaveSecaoContrato): string {
  const personalizado = d.termos.textos?.[chave];
  return personalizado != null && personalizado.trim() !== '' ? personalizado : secaoDoModelo(chave).texto;
}

export function secaoPersonalizada(d: DadosContrato, chave: ChaveSecaoContrato): boolean {
  const t = d.termos.textos?.[chave];
  return t != null && t.trim() !== '';
}

/** Resolve marcadores dentro de um pedaço já sem `**`. */
function resolver(pedaco: string, emNegrito: boolean, d: DadosContrato): Trecho[] {
  const saida: Trecho[] = [];
  let ultimo = 0;
  for (const m of pedaco.matchAll(MARCADOR)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) saida.push({ texto: pedaco.slice(ultimo, inicio), negrito: emNegrito });
    const def = marcador(m[1]);
    if (!def || def.bloco) {
      saida.push({ texto: m[0], negrito: emNegrito, desconhecido: true });
    } else {
      const valor = def.valor(d);
      if (typeof valor === 'string') {
        saida.push(valor ? { texto: valor, negrito: emNegrito } : { texto: '', vazio: true, negrito: emNegrito });
      } else {
        for (const t of valor) saida.push({ ...t, negrito: t.negrito || emNegrito });
      }
    }
    ultimo = inicio + m[0].length;
  }
  if (ultimo < pedaco.length) saida.push({ texto: pedaco.slice(ultimo), negrito: emNegrito });
  return saida;
}

/** Uma linha -> trechos, alternando negrito a cada `**`. */
function trechosDaLinha(linha: string, d: DadosContrato): Trecho[] {
  const partes = linha.split('**');
  return partes.flatMap((parte, i) => (parte ? resolver(parte, i % 2 === 1, d) : []));
}

export function blocosDoTexto(texto: string, d: DadosContrato): Bloco[] {
  const blocos: Bloco[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (linha === '{tabela_garantias}') {
      blocos.push({ tipo: 'tabela_garantias' });
      continue;
    }
    const num = linha.match(NUMERACAO);
    if (num) {
      blocos.push({
        tipo: 'paragrafo',
        item: ITEM.test(num[1]),
        trechos: [{ texto: `${num[1]} `, negrito: true }, ...trechosDaLinha(linha.slice(num[0].length), d)],
      });
    } else {
      blocos.push({ tipo: 'paragrafo', item: false, trechos: trechosDaLinha(linha, d) });
    }
  }
  return blocos;
}

export function blocosDaSecao(d: DadosContrato, chave: ChaveSecaoContrato): Bloco[] {
  return blocosDoTexto(textoDaSecao(d, chave), d);
}

/** Marcadores do texto que não existem — o editor avisa antes de salvar. */
export function marcadoresDesconhecidos(texto: string): string[] {
  const vistos = new Set<string>();
  for (const m of texto.matchAll(MARCADOR)) {
    const def = marcador(m[1]);
    const linhaInteira = def?.bloco;
    if (!def) vistos.add(m[0]);
    else if (linhaInteira && !new RegExp(`^\\s*\\{${m[1]}\\}\\s*$`, 'm').test(texto)) vistos.add(m[0]);
  }
  return [...vistos];
}

/** Texto plano de um bloco (testes e acessibilidade). */
export function textoPlano(bloco: Bloco): string {
  if (bloco.tipo === 'tabela_garantias') return '[tabela de garantias]';
  return bloco.trechos.map((t) => (t.vazio ? '________' : t.texto)).join('');
}
