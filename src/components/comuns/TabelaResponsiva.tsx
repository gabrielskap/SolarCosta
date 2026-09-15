import React, { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEhCelular } from './useEhCelular';

/*
 * Tabela que vira lista de cartões no celular.
 *
 * Existe ao lado da solução em CSS (`.tabela-mobile` em index.css), e a
 * diferença é o que cabe na tela: o CSS empilha TODAS as colunas, então uma
 * listagem de 8 colunas vira um cartão de 8 linhas e o celular mostra duas
 * propostas por vez. Aqui as colunas são classificadas — as `principal`
 * aparecem sempre, as `secundaria` só quando o usuário abre o cartão —, e a
 * mesma lista passa a mostrar seis.
 *
 * Por isso o CSS continua sendo o certo para as telas de gestão (fornecedores,
 * usuários, auditoria), onde ler tudo de uma vez é o comportamento esperado, e
 * este componente para as telas que o vendedor usa em campo.
 */

export interface ColunaTabela<T> {
  /** Identificador estável da coluna; usado como key do React. */
  chave: string;
  titulo: string;
  /**
   * `principal` (padrão) fica visível no cartão fechado.
   * `secundaria` só aparece quando o cartão é expandido.
   */
  prioridade?: 'principal' | 'secundaria';
  /** Alinhamento no cabeçalho e na célula, valendo só para o desktop. */
  alinhamento?: 'esquerda' | 'direita';
  /** Conteúdo da célula. Recebe o item inteiro. */
  celula: (item: T) => React.ReactNode;
}

interface TabelaResponsivaProps<T> {
  colunas: ColunaTabela<T>[];
  dados: T[];
  /** Chave estável de cada linha. */
  chaveDe: (item: T) => string;
  /** Mostrado no lugar da tabela quando não há dados. */
  vazio?: React.ReactNode;
}

function Cartao<T>({
  item,
  colunas,
}: {
  item: T;
  colunas: ColunaTabela<T>[];
}) {
  const [aberto, setAberto] = useState(false);
  const principais = colunas.filter((c) => c.prioridade !== 'secundaria');
  const secundarias = colunas.filter((c) => c.prioridade === 'secundaria');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      {principais.map((c) => (
        <div key={c.chave} className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
            {c.titulo}
          </span>
          <div className="text-right min-w-0">{c.celula(item)}</div>
        </div>
      ))}

      {secundarias.length > 0 && (
        <>
          {aberto && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {secundarias.map((c) => (
                <div key={c.chave} className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                    {c.titulo}
                  </span>
                  <div className="text-right min-w-0">{c.celula(item)}</div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="w-full pt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-[#004276]"
          >
            {aberto ? 'Menos detalhes' : `Mais ${secundarias.length} campos`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>
        </>
      )}
    </div>
  );
}

export function TabelaResponsiva<T>({
  colunas,
  dados,
  chaveDe,
  vazio = 'Nenhum registro encontrado.',
}: TabelaResponsivaProps<T>) {
  const ehCelular = useEhCelular();
  const alinhar = useCallback(
    (c: ColunaTabela<T>) => (c.alinhamento === 'direita' ? 'text-right' : 'text-left'),
    [],
  );

  if (dados.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-xs">{vazio}</div>;
  }

  if (ehCelular) {
    return (
      <div className="space-y-3">
        {dados.map((item) => (
          <Cartao key={chaveDe(item)} item={item} colunas={colunas} />
        ))}
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
            {colunas.map((c) => (
              <th key={c.chave} className={`p-3 ${alinhar(c)}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dados.map((item) => (
            <tr key={chaveDe(item)} className="hover:bg-slate-50">
              {colunas.map((c) => (
                <td key={c.chave} className={`p-3 ${alinhar(c)}`}>
                  {c.celula(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
