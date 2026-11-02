// Texto do contrato (modelo ou personalizado) -> blocos prontos para desenhar.
//
// O motor é o de src/documento/textoModelo.ts, dividido com a procuração; aqui
// ele só ganha os marcadores e as seções do contrato. A marcação (linhas,
// `**negrito**`, numeração) está descrita lá. No contrato, o único marcador de
// bloco é `{tabela_garantias}`, sozinho numa linha: vira a tabela da 7.2.

import type { ChaveSecaoContrato } from '../types';
import {
  blocosDoTexto as blocosDoModelo,
  marcadoresDesconhecidos as desconhecidosDoModelo,
  textoPlanoTrechos,
  type BlocoModelo,
  type Trecho,
} from '../documento/textoModelo';
import { type DadosContrato, marcador } from './marcadores';
import { secaoDoModelo } from './modeloSolarCosta';

export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[]; item: boolean }
  | { tipo: 'tabela_garantias' };

const doContrato = (b: BlocoModelo): Bloco => (b.tipo === 'bloco' ? { tipo: 'tabela_garantias' } : b);

/** Texto efetivo da seção: o personalizado no contrato ou o do modelo. */
export function textoDaSecao(d: DadosContrato, chave: ChaveSecaoContrato): string {
  const personalizado = d.termos.textos?.[chave];
  return personalizado != null && personalizado.trim() !== '' ? personalizado : secaoDoModelo(chave).texto;
}

export function secaoPersonalizada(d: DadosContrato, chave: ChaveSecaoContrato): boolean {
  const t = d.termos.textos?.[chave];
  return t != null && t.trim() !== '';
}

export function blocosDoTexto(texto: string, d: DadosContrato): Bloco[] {
  return blocosDoModelo(texto, d, marcador).map(doContrato);
}

export function blocosDaSecao(d: DadosContrato, chave: ChaveSecaoContrato): Bloco[] {
  return blocosDoTexto(textoDaSecao(d, chave), d);
}

/** Marcadores do texto que não existem — o editor avisa antes de salvar. */
export function marcadoresDesconhecidos(texto: string): string[] {
  return desconhecidosDoModelo(texto, marcador);
}

/** Texto plano de um bloco (testes e acessibilidade). */
export function textoPlano(bloco: Bloco): string {
  if (bloco.tipo === 'tabela_garantias') return '[tabela de garantias]';
  return textoPlanoTrechos(bloco.trechos);
}
