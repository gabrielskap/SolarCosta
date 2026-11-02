// Texto da procuração (modelo ou personalizado) -> parágrafos prontos para
// desenhar. O motor é o de src/documento/textoModelo.ts, o mesmo do contrato;
// aqui ele só ganha as seções e os marcadores da procuração. A procuração não
// tem marcador de bloco, então tudo sai como parágrafo.

import type { ChaveSecaoProcuracao } from '../types';
import {
  blocosDoTexto, marcadoresDesconhecidos as desconhecidosDoModelo, textoPlanoTrechos, type Trecho,
} from '../documento/textoModelo';
import { type DadosProcuracao, marcador } from './marcadores';
import { secaoDoModelo } from './modeloProcuracao';

export interface Paragrafo {
  trechos: Trecho[];
  item: boolean;
}

/** Texto efetivo da seção: o personalizado na procuração ou o do modelo. */
export function textoDaSecao(d: DadosProcuracao, chave: ChaveSecaoProcuracao): string {
  const personalizado = d.termos.textos?.[chave];
  return personalizado != null && personalizado.trim() !== '' ? personalizado : secaoDoModelo(chave).texto;
}

export function secaoPersonalizada(d: DadosProcuracao, chave: ChaveSecaoProcuracao): boolean {
  const t = d.termos.textos?.[chave];
  return t != null && t.trim() !== '';
}

export function paragrafosDaSecao(d: DadosProcuracao, chave: ChaveSecaoProcuracao): Paragrafo[] {
  return blocosDoTexto(textoDaSecao(d, chave), d, marcador).flatMap((b) =>
    b.tipo === 'paragrafo' ? [{ trechos: b.trechos, item: b.item }] : [],
  );
}

/** Marcadores do texto que não existem — o editor avisa antes de salvar. */
export function marcadoresDesconhecidos(texto: string): string[] {
  return desconhecidosDoModelo(texto, marcador);
}

/** Texto plano de uma seção inteira (testes e acessibilidade). */
export function textoPlanoDaSecao(d: DadosProcuracao, chave: ChaveSecaoProcuracao): string {
  return paragrafosDaSecao(d, chave).map((p) => textoPlanoTrechos(p.trechos)).join('\n');
}
