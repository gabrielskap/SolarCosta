// Motor do texto dos documentos com modelo — contrato e procuração.
//
// Texto do modelo (ou personalizado) -> blocos prontos para desenhar. Sem
// React de propósito: o mesmo resultado alimenta o documento impresso, a
// pré-visualização do editor e os testes em scripts/test-modelo-*.ts.
//
// O motor não sabe o que é um contrato nem uma procuração: cada documento entra
// com a SUA lista de marcadores (`achar`) e o seu tipo de dados (`D`).
//
// A marcação é mínima, para quem personaliza uma seção não precisar aprender
// nada além do que vê no texto padrão:
//   · cada linha é um parágrafo (linhas vazias são ignoradas);
//   · `**trecho**` sai em negrito;
//   · numeração no começo da linha ("2.3.1", "(iv)", "a)") sai em negrito, e
//     os itens "(i)"/"a)" saem recuados, como no .docx;
//   · um marcador de bloco sozinho numa linha (`{tabela_garantias}`) vira um
//     bloco próprio, que o documento desenha.
//
// Valor de marcador NUNCA é interpretado: um `**` digitado no nome do cliente
// sai como `**`, não vira negrito. (E o React escapa o resto.)

/** Pedaço de texto já resolvido. `vazio` = dado não preenchido (sai como linha em branco). */
export interface Trecho {
  texto: string;
  negrito?: boolean;
  vazio?: boolean;
  /** Marcador que não existe na lista do documento. */
  desconhecido?: boolean;
}

export interface MarcadorModelo<D> {
  chave: string;
  rotulo: string;
  grupo: string;
  /** Ocupa a linha inteira e vira um bloco (a tabela de garantias do contrato). */
  bloco?: boolean;
  valor: (d: D) => string | Trecho[];
}

export type AcharMarcador<D> = (chave: string) => MarcadorModelo<D> | undefined;

export type BlocoModelo =
  | { tipo: 'paragrafo'; trechos: Trecho[]; item: boolean }
  | { tipo: 'bloco'; chave: string };

const NUMERACAO = /^((?:\d+(?:\.\d+)+\.?)|(?:\((?:[ivxlcdm]+|[IVXLCDM]+)\))|(?:[a-z]\)))\s+/;
const ITEM = /^(?:\([ivxlcdm]+\)|[a-z]\))$/;
const MARCADOR = /\{([a-z0-9_]+)\}/g;
const MARCADOR_SOZINHO = /^\{([a-z0-9_]+)\}$/;

/** Resolve marcadores dentro de um pedaço já sem `**`. */
function resolver<D>(pedaco: string, emNegrito: boolean, d: D, achar: AcharMarcador<D>): Trecho[] {
  const saida: Trecho[] = [];
  let ultimo = 0;
  for (const m of pedaco.matchAll(MARCADOR)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) saida.push({ texto: pedaco.slice(ultimo, inicio), negrito: emNegrito });
    const def = achar(m[1]);
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
function trechosDaLinha<D>(linha: string, d: D, achar: AcharMarcador<D>): Trecho[] {
  const partes = linha.split('**');
  return partes.flatMap((parte, i) => (parte ? resolver(parte, i % 2 === 1, d, achar) : []));
}

export function blocosDoTexto<D>(texto: string, d: D, achar: AcharMarcador<D>): BlocoModelo[] {
  const blocos: BlocoModelo[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const sozinho = linha.match(MARCADOR_SOZINHO);
    if (sozinho && achar(sozinho[1])?.bloco) {
      blocos.push({ tipo: 'bloco', chave: sozinho[1] });
      continue;
    }
    const num = linha.match(NUMERACAO);
    if (num) {
      blocos.push({
        tipo: 'paragrafo',
        item: ITEM.test(num[1]),
        trechos: [{ texto: `${num[1]} `, negrito: true }, ...trechosDaLinha(linha.slice(num[0].length), d, achar)],
      });
    } else {
      blocos.push({ tipo: 'paragrafo', item: false, trechos: trechosDaLinha(linha, d, achar) });
    }
  }
  return blocos;
}

/** Marcadores do texto que não existem — o editor avisa antes de salvar. */
export function marcadoresDesconhecidos<D>(texto: string, achar: AcharMarcador<D>): string[] {
  const vistos = new Set<string>();
  for (const m of texto.matchAll(MARCADOR)) {
    const def = achar(m[1]);
    const linhaInteira = def?.bloco;
    if (!def) vistos.add(m[0]);
    else if (linhaInteira && !new RegExp(`^\\s*\\{${m[1]}\\}\\s*$`, 'm').test(texto)) vistos.add(m[0]);
  }
  return [...vistos];
}

/** Texto plano de trechos resolvidos (testes e acessibilidade). */
export function textoPlanoTrechos(trechos: Trecho[]): string {
  return trechos.map((t) => (t.vazio ? '________' : t.texto)).join('');
}
