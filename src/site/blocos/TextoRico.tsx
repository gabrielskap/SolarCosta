// Parágrafos livres, com imagem opcional ao lado. Não existia no site antes do
// CMS: é o bloco para o administrador escrever algo que os tipos fechados não
// comportam, sem precisar de código novo.

import React, { Suspense, lazy, useRef, useState } from 'react';
import { Secao, TituloSecao } from '../components/Secao';
import { Editavel } from '../editor/Editavel';
import { useEditor } from '../editor/contexto';
import { urlMidia, type ConteudoTextoRico } from './tipos';

const AlcasImagem = lazy(() => import('../editor/AlcasImagem'));

/** Abaixo disto a foto fica menor que o bloco de texto ao lado e desequilibra. */
const LARGURA_MIN = 30;

export const TextoRico: React.FC<{ conteudo: ConteudoTextoRico }> = ({ conteudo: c }) => {
  const { modoEditor } = useEditor();
  const coluna = useRef<HTMLDivElement | null>(null);
  // Largura durante o arrasto. Some no fim do gesto, quando o valor salvo
  // assume — é o que faz a imagem acompanhar o mouse.
  const [previa, setPrevia] = useState<number | null>(null);
  const imagem = urlMidia(c.imagem_id);

  // Sem ajuste manual, 100% — que é exatamente o `w-full` de antes. Conteúdo
  // salvo antes do editor visual não muda de aparência.
  const salva =
    typeof c.imagem_largura_pct === 'number' && Number.isFinite(c.imagem_largura_pct)
      ? Math.min(100, Math.max(LARGURA_MIN, c.imagem_largura_pct))
      : 100;
  const larguraPct = previa ?? salva;

  // No site, parágrafo em branco não vira um <p> vazio. No editor ele precisa
  // sobreviver, senão apagar uma linha inteira faz o campo sumir da tela e não
  // há mais onde clicar para reescrevê-la.
  const paragrafos = modoEditor ? (c.paragrafos ?? []) : (c.paragrafos ?? []).filter(Boolean);

  return (
    <Secao claro={!!c.claro}>
      <div className={imagem ? 'grid lg:grid-cols-2 gap-10 items-center' : 'max-w-3xl'}>
        <div>
          {(c.rotulo || c.titulo || modoEditor) && (
            <TituloSecao
              rotulo={c.rotulo}
              titulo={c.titulo}
              campoRotulo="rotulo"
              campoTitulo="titulo"
            />
          )}
          <div className="mt-6 space-y-4">
            {paragrafos.map((p, i) => (
              <Editavel
                key={i}
                como="p"
                campo={`paragrafos.${i}`}
                valor={p}
                multilinha
                placeholder="Escreva um parágrafo."
                className="text-base text-slate-600 leading-relaxed"
              />
            ))}
          </div>
        </div>

        {imagem && (
          // O container existe para dar referência à alça (`relative`) e para
          // que a largura percentual seja medida contra a coluna, não contra a
          // página — num grid lg:grid-cols-2 as duas são bem diferentes.
          <div ref={coluna} className="relative w-full">
            <img
              src={imagem}
              alt=""
              className="rounded-2xl border border-slate-200/80 shadow-xs"
              style={{ width: `${larguraPct}%` }}
              loading="lazy"
            />
            {modoEditor && (
              <Suspense fallback={null}>
                <AlcasImagem
                  campo="imagem_largura_pct"
                  valor={typeof c.imagem_largura_pct === 'number' ? salva : null}
                  min={LARGURA_MIN}
                  max={100}
                  eixo="largura"
                  medirAtual={() => salva}
                  medirContainer={() => coluna.current?.getBoundingClientRect().width ?? 0}
                  onPrevia={setPrevia}
                />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </Secao>
  );
};
