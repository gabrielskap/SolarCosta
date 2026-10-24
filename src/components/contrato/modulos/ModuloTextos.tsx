// Texto das cláusulas, personalizado só neste contrato.
//
// O texto padrão (src/contrato/modeloSolarCosta.ts) aparece com os marcadores
// à mostra — `{prazo_execucao_dias}` — para que mudar o prazo no módulo de
// Prazos continue valendo dentro de uma cláusula reescrita. Só o que difere
// do modelo é gravado; voltar o texto ao padrão apaga a personalização.

import React, { useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, PencilLine, RotateCcw } from 'lucide-react';
import type { ChaveSecaoContrato } from '../../../types';
import { SECOES, secaoDoModelo } from '../../../contrato/modeloSolarCosta';
import { MARCADORES } from '../../../contrato/marcadores';
import { marcadoresDesconhecidos } from '../../../contrato/renderizar';
import { BOTAO_SECUNDARIO, CAMPO, CabecalhoModulo, type PropsModulo } from '../campos';

interface Props extends PropsModulo {
  onFocarSecao: (chave: ChaveSecaoContrato | null) => void;
}

const GRUPOS = Array.from(new Set(MARCADORES.map((m) => m.grupo)));

export const ModuloTextos: React.FC<Props> = ({ r, alterarTermos, somenteLeitura, onFocarSecao }) => {
  const [aberta, setAberta] = useState<ChaveSecaoContrato | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const textos = r.termos.textos ?? {};

  const textoEfetivo = (chave: ChaveSecaoContrato) => textos[chave] ?? secaoDoModelo(chave).texto;

  // Texto em branco fica guardado (quem apagou tudo quer reescrever do zero),
  // mas o documento segue o modelo enquanto ele estiver vazio.
  const gravar = (chave: ChaveSecaoContrato, valor: string) => {
    const novos = { ...textos };
    if (valor === secaoDoModelo(chave).texto) delete novos[chave];
    else novos[chave] = valor;
    alterarTermos({ textos: novos });
  };

  const restaurar = (chave: ChaveSecaoContrato) => {
    const novos = { ...textos };
    delete novos[chave];
    alterarTermos({ textos: novos });
  };

  const inserir = (chave: ChaveSecaoContrato, marcador: string, bloco: boolean) => {
    const area = areaRef.current;
    const atual = textoEfetivo(chave);
    const trecho = bloco ? `\n{${marcador}}\n` : `{${marcador}}`;
    const inicio = area?.selectionStart ?? atual.length;
    const fim = area?.selectionEnd ?? atual.length;
    gravar(chave, atual.slice(0, inicio) + trecho + atual.slice(fim));
    requestAnimationFrame(() => {
      if (!area) return;
      area.focus();
      area.selectionStart = area.selectionEnd = inicio + trecho.length;
    });
  };

  const alternar = (chave: ChaveSecaoContrato) => {
    const proxima = aberta === chave ? null : chave;
    setAberta(proxima);
    onFocarSecao(proxima);
  };

  return (
    <div>
      <CabecalhoModulo
        titulo="Texto das cláusulas"
        onde="Reescreva qualquer seção só neste contrato. Os campos entre chaves continuam puxando os dados dos outros módulos."
      />
      <ul className="space-y-2">
        {SECOES.map((s) => {
          const personalizada = (textos[s.chave] ?? '').trim() !== '';
          const estaAberta = aberta === s.chave;
          const desconhecidos = estaAberta ? marcadoresDesconhecidos(textoEfetivo(s.chave)) : [];
          return (
            <li key={s.chave} className={`border rounded-xl ${estaAberta ? 'border-[#004276]' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => alternar(s.chave)}
                  className="flex items-center gap-2 text-left text-sm font-semibold text-slate-800"
                  aria-expanded={estaAberta}
                >
                  {estaAberta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  {s.rotulo}
                  {personalizada && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">
                      Personalizada
                    </span>
                  )}
                </button>
                <div className="flex gap-2">
                  {!estaAberta && !somenteLeitura && (
                    <button type="button" className={BOTAO_SECUNDARIO} onClick={() => alternar(s.chave)}>
                      <PencilLine className="w-3.5 h-3.5" />
                      {personalizada ? 'Editar' : 'Personalizar'}
                    </button>
                  )}
                  {textos[s.chave] != null && !somenteLeitura && (
                    <button type="button" className={BOTAO_SECUNDARIO} onClick={() => restaurar(s.chave)} title="Descarta o texto deste contrato e volta ao modelo">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurar padrão
                    </button>
                  )}
                </div>
              </div>

              {estaAberta && (
                <div className="border-t border-slate-200 p-3 space-y-3">
                  <textarea
                    ref={areaRef}
                    aria-label={`Texto de ${s.rotulo}`}
                    value={textoEfetivo(s.chave)}
                    onChange={(e) => gravar(s.chave, e.target.value)}
                    disabled={somenteLeitura}
                    rows={14}
                    className={`${CAMPO} font-mono text-[12px] leading-relaxed resize-y`}
                  />
                  <p className="text-[11px] text-slate-500">
                    Cada linha é um parágrafo. <code>**texto**</code> sai em negrito; a numeração no começo da linha (2.3, (iv), a)) sai em negrito sozinha.
                  </p>
                  {desconhecidos.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs font-semibold text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Campo inexistente (vai sair impresso entre chaves): {desconhecidos.join(', ')}
                    </p>
                  )}
                  {!somenteLeitura && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-bold text-[#004276]">Inserir campo</summary>
                      <div className="mt-2 space-y-2">
                        {GRUPOS.map((grupo) => (
                          <div key={grupo}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{grupo}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {MARCADORES.filter((m) => m.grupo === grupo).map((m) => (
                                <button
                                  key={m.chave}
                                  type="button"
                                  onClick={() => inserir(s.chave, m.chave, !!m.bloco)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-[#004276] text-slate-700 font-semibold"
                                  title={`{${m.chave}}`}
                                >
                                  {m.rotulo}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
