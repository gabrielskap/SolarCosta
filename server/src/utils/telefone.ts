// Normalização de telefone brasileiro para o formato que o WhatsApp aceita.
//
// A mesma regra existe no front, em src/utils/contato.ts, onde nasceu para
// montar links `wa.me`. Ela é repetida aqui de propósito, e não importada:
// server/ é um pacote npm independente, com seu próprio tsconfig e seu próprio
// node_modules (ver server/package.json). Um import atravessando a fronteira
// quebraria o build do Docker, que copia os dois estágios separadamente.
//
// Se um dia a regra mudar — DDI diferente, nono dígito em outro lugar —, os
// dois arquivos precisam mudar juntos. Daí este comentário existir nos dois.

const DDI_BR = '55';

const somenteDigitos = (v: string | undefined | null): string =>
  (v ?? '').replace(/\D/g, '');

/**
 * Devolve o telefone só com dígitos e com DDI (5531986588456), ou `null`
 * quando o valor não dá para confiar.
 *
 * Aceita com e sem DDI. Fixo tem 10 dígitos com DDD, celular tem 11 — abaixo
 * disso falta o DDD, e sem DDD não existe número para o qual enviar.
 *
 * Por que recusar em vez de tentar: mandar mensagem para o número errado é
 * pior do que não mandar. Um número sem DDD completado com um DDD chutado
 * entrega a proposta de um cliente na mão de um estranho.
 */
export function telefoneInternacional(telefone: string | undefined | null): string | null {
  const d = somenteDigitos(telefone);
  if (d.length === 10 || d.length === 11) return DDI_BR + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith(DDI_BR)) return d;
  return null;
}

/**
 * Extrai o telefone de um chatid da uazapi.
 * `5531986588456@s.whatsapp.net` -> `5531986588456`.
 *
 * Grupo (`@g.us`) e canal (`@newsletter`) devolvem null: o identificador deles
 * não é um telefone e não deve ser tratado como um.
 */
export function telefoneDoChatid(chatid: string | undefined | null): string | null {
  const [usuario, servidor] = (chatid ?? '').split('@');
  if (!usuario || servidor !== 's.whatsapp.net') return null;
  const d = somenteDigitos(usuario);
  return d || null;
}

/** O chatid que a uazapi espera para uma pessoa. */
export function chatidDeTelefone(telefone: string): string {
  return `${telefone}@s.whatsapp.net`;
}

/**
 * Chave de comparação entre um telefone do WhatsApp e um telefone de cadastro:
 * DDD + os 8 últimos dígitos. `5531986588456` -> `3186588456`.
 *
 * O NONO DÍGITO FICA DE FORA DE PROPÓSITO. Cadastro antigo tem
 * "(31) 8658-8456" e o WhatsApp sempre devolve "5531986588456" — comparar os
 * dois inteiros nunca casaria, e o lead ficaria sem vínculo justamente nos
 * registros mais velhos, que são os que mais precisam de histórico.
 *
 * O preço é uma colisão teórica entre um fixo e um celular que terminem nos
 * mesmos 8 dígitos no mesmo DDD. Na prática isso quase não existe, e o vínculo
 * é corrigível à mão na tela — o que um lead sem histórico não é.
 *
 * Devolve `null` quando não dá para confiar no valor, pelo mesmo critério do
 * `telefoneInternacional` acima.
 */
export function chaveTelefone(telefone: string | undefined | null): string | null {
  let d = somenteDigitos(telefone);
  if ((d.length === 12 || d.length === 13) && d.startsWith(DDI_BR)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return d.slice(0, 2) + d.slice(-8);
}
