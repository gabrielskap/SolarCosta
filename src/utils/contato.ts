// Links de contato e rota para o cliente.
//
// Nasceu do trabalho de mobile: o CRM não tinha NENHUM `tel:`, `wa.me`,
// `mailto:` ou link de mapa — um telefone era texto para copiar à mão. No
// escritório isso passa; na porta do cliente, com o celular na mão, é o atrito
// principal do vendedor.
//
// Não confundir com os helpers de mesmo nome em services/publico.ts: aqueles
// montam o contato DA EMPRESA para o visitante do site. Aqui é o contrário —
// do vendedor para o cliente.

import { onlyDigits } from './format';

const DDI_BR = '55';

/**
 * Normaliza um telefone brasileiro para o formato internacional só com
 * dígitos (5531986588456), ou `null` se não der para confiar no valor.
 *
 * Aceita com e sem DDI. Fixo tem 10 dígitos com DDD, celular tem 11 — abaixo
 * disso falta o DDD, e sem DDD não há link que funcione.
 *
 * ATENÇÃO: esta mesma regra está repetida em server/src/utils/telefone.ts,
 * porque server/ é um pacote npm independente e um import atravessando a
 * fronteira quebraria o build do Docker. Mudou aqui, muda lá.
 */
export function telefoneInternacional(telefone: string | undefined | null): string | null {
  const d = onlyDigits(telefone);
  if (d.length === 10 || d.length === 11) return DDI_BR + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith(DDI_BR)) return d;
  return null;
}

/** `tel:` para abrir o discador. `null` quando o número não serve. */
export function linkTelefone(telefone: string | undefined | null): string | null {
  const n = telefoneInternacional(telefone);
  return n ? `tel:+${n}` : null;
}

/**
 * Conversa no WhatsApp com o cliente, opcionalmente já com a mensagem
 * escrita. `wa.me` resolve sozinho entre app e web.
 */
export function linkWhatsApp(
  telefone: string | undefined | null,
  mensagem?: string,
): string | null {
  const n = telefoneInternacional(telefone);
  if (!n) return null;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${n}${texto}`;
}

/** `mailto:`, ou `null` se o e-mail estiver vazio. */
export function linkEmail(email: string | undefined | null): string | null {
  const e = (email ?? '').trim();
  return e ? `mailto:${e}` : null;
}

/**
 * Rota até o endereço. Usa a busca universal do Google Maps em https, que o
 * Android e o iOS abrem no aplicativo instalado — diferente de um esquema
 * `geo:`/`maps:`, que quebra no navegador desktop.
 */
export function linkMapa(...partes: (string | undefined | null)[]): string | null {
  const destino = partes
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');
  if (!destino) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
}

/**
 * Formato legível de um número internacional só com dígitos.
 * `5531986588456` -> `+55 (31) 98658-8456`.
 *
 * É o caminho inverso de `telefoneInternacional`: aquele prepara o número para
 * a máquina, este para a tela. Usado onde o número vem do WhatsApp, que só
 * devolve dígitos — o cadastro do lead já guarda o telefone formatado.
 *
 * Número fora do padrão brasileiro sai como `+<dígitos>`, sem inventar
 * agrupamento: um DDD errado inventado é pior que um número sem máscara.
 */
export function formatarTelefoneInternacional(numero: string | undefined | null): string {
  const d = onlyDigits(numero);
  if (!d) return '—';
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
}
