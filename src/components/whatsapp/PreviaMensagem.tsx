import React from 'react';

/*
 * Marcadores, prévia e os botões que os inserem.
 *
 * Compartilhado pela aba Enviar e pelo editor de modelos: as duas telas mostram
 * exatamente a mesma coisa, e duas cópias divergiriam no dia em que a lista de
 * marcadores mudasse — deixando o editor prometendo um campo que o envio não
 * preenche.
 *
 * {{link}} NÃO ESTÁ MAIS AQUI: o documento vai como PDF anexo desde o V010, e
 * oferecer um marcador de endereço que o envio troca por vazio só produziria
 * frase cortada no WhatsApp do cliente.
 *
 * A LISTA TEM DE ACOMPANHAR `interpolar()` e `dadosDoDocumento()`, em
 * server/src/routes/whatsapp.routes.ts. Marcador que não existe lá some no
 * envio sem dar erro: `interpolar()` troca desconhecido por vazio de propósito,
 * porque "Olá, {{sobrenome}}!" é erro de digitação no modelo e o cliente não
 * precisa ver o erro.
 */

export const MARCADORES = [
  'primeiro_nome',
  'cliente',
  'numero',
  'valor',
  'economia_mensal',
  'validade',
  'consultor',
  'empresa',
] as const;

/**
 * A PRÉVIA MOSTRA O TEXTO COMO ELE É, com os marcadores à mostra.
 *
 * A primeira versão preenchia os marcadores com valores de exemplo — um nome
 * inventado, um número de proposta inventado — achando que ajudaria a julgar o
 * tom da mensagem. O efeito foi outro: quem abria a tela via "Marlon, que ótimo
 * ter você com a gente!" e concluía que havia um nome fixo dentro do modelo,
 * indo procurar onde apagá-lo. A prévia mentia sobre o próprio conteúdo que
 * dizia estar mostrando.
 *
 * Quem preenche é o SERVIDOR, no envio, com o cliente e o documento reais.
 * Então a prévia mostra o modelo, e destaca os marcadores para deixar claro
 * quais pedaços vão ser trocados. É a mesma escolha que o EnviarPorWhatsApp já
 * fazia desde o começo, e pelo mesmo motivo escrito lá: mentir sobre o
 * resultado é pior do que mostrar o modelo como ele é.
 */
export interface Pedaco {
  texto: string;
  marcador: boolean;
}

export function repartir(texto: string): Pedaco[] {
  const partes: Pedaco[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index), marcador: false });
    partes.push({ texto: m[0], marcador: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), marcador: false });
  return partes;
}

/**
 * Insere o marcador onde o cursor está, não no fim do texto.
 *
 * Quem escreve "Olá, ! Tudo bem?" e clica em `{{primeiro_nome}}` espera o nome
 * entre a vírgula e a exclamação. Colar no fim obrigaria a recortar e colar à
 * mão toda vez.
 */
export function inserirMarcador(
  campo: HTMLTextAreaElement | null,
  atual: string,
  marcador: string,
  definir: (valor: string) => void,
): void {
  const token = `{{${marcador}}}`;
  if (!campo) {
    definir(atual + token);
    return;
  }
  const inicio = campo.selectionStart ?? atual.length;
  const fim = campo.selectionEnd ?? atual.length;
  definir(atual.slice(0, inicio) + token + atual.slice(fim));
  // Depois do render, senão o React reescreve o valor e o cursor volta ao fim.
  requestAnimationFrame(() => {
    campo.focus();
    campo.selectionStart = campo.selectionEnd = inicio + token.length;
  });
}

export const BotoesMarcador: React.FC<{ onInserir: (marcador: string) => void }> = ({
  onInserir,
}) => (
  <div className="flex flex-wrap gap-1 mb-1.5">
    {MARCADORES.map((m) => (
      <button
        key={m}
        type="button"
        onClick={() => onInserir(m)}
        className="text-[10px] font-mono px-2 py-1 rounded-md bg-blue-50 text-[#004276] hover:bg-blue-100 transition"
      >
        {`{{${m}}}`}
      </button>
    ))}
  </div>
);

export const PreviaMensagem: React.FC<{ texto: string; vazio?: string }> = ({
  texto,
  vazio = 'A mensagem aparece aqui…',
}) => {
  const pedacos = repartir(texto || '');

  return (
    <div className="rounded-2xl bg-[#e5ddd5] p-4 min-h-[140px]">
      <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 text-sm text-slate-700 whitespace-pre-wrap break-words max-w-[92%]">
        {pedacos.length === 0
          ? vazio
          : pedacos.map((p, i) =>
              p.marcador ? (
                // `key` por índice é seguro aqui: a lista é derivada do texto e
                // recalculada inteira a cada tecla — não há reordenação nem
                // estado preso a um item.
                <span
                  key={i}
                  className="inline-block bg-blue-50 text-[#004276] font-mono text-[11px] rounded px-1 py-0.5 align-baseline"
                >
                  {p.texto}
                </span>
              ) : (
                <span key={i}>{p.texto}</span>
              ),
            )}
      </div>
    </div>
  );
};
