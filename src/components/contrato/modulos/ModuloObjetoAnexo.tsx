import React from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ItemAnexoContrato, Proposta } from '../../../types';
import { anexoDaProposta, anexoDoSistema } from '../../../contrato/padroes';
import { BOTAO_SECUNDARIO, CAMPO, CabecalhoModulo, Campo, CampoNumero, Grade, ROTULO, type PropsModulo } from '../campos';

interface Props extends PropsModulo {
  proposta?: Proposta;
}

export const ModuloObjetoAnexo: React.FC<Props> = ({ r, alterar, alterarTermos, somenteLeitura, config, proposta }) => {
  const itens = r.termos.anexoItens;
  const setItens = (anexoItens: ItemAnexoContrato[]) => alterarTermos({ anexoItens });
  const mudarItem = (i: number, parcial: Partial<ItemAnexoContrato>) =>
    setItens(itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)));
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= itens.length) return;
    const nova = [...itens];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setItens(nova);
  };

  // Os tipos de telhado cadastrados, mais o valor atual caso seja livre.
  const estruturas = Array.from(new Set([...(config?.telhados ?? []).map((t) => t.nome), r.estrutura].filter(Boolean)));
  const itensDaProposta = proposta ? anexoDaProposta(proposta) : [];

  return (
    <div>
      <CabecalhoModulo titulo="Objeto e Anexo I" onde="Cláusulas 1 e 2.1 e o ANEXO 1, que lista o que vai no sistema." />
      <Grade>
        <CampoNumero rotulo="Potência" valor={r.potenciaKwp} onChange={(n) => alterar({ potenciaKwp: n })} somenteLeitura={somenteLeitura} sufixo="kWp" />
        <CampoNumero rotulo="Quantidade de módulos" valor={r.modulosQtd} onChange={(n) => alterar({ modulosQtd: n })} somenteLeitura={somenteLeitura} inteiro />
        <Campo rotulo="Módulo (modelo)" valor={r.moduloModelo} onChange={(v) => alterar({ moduloModelo: v })} somenteLeitura={somenteLeitura} placeholder="monocristalino 705 W" />
        <Campo rotulo="Inversor" valor={r.inversorModelo} onChange={(v) => alterar({ inversorModelo: v })} somenteLeitura={somenteLeitura} placeholder="Micro inversor Hoymiles 2 kW 220 V" />
        <div>
          <label htmlFor="contrato-estrutura" className={ROTULO}>Estrutura / telhado</label>
          <select
            id="contrato-estrutura"
            value={r.estrutura}
            onChange={(e) => alterar({ estrutura: e.target.value })}
            disabled={somenteLeitura}
            className={CAMPO}
          >
            <option value="">—</option>
            {estruturas.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>
        <div className="hidden sm:block" />
        <Campo
          rotulo="Endereço de entrega e instalação"
          valor={r.termos.enderecoEntrega}
          onChange={(v) => alterarTermos({ enderecoEntrega: v })}
          somenteLeitura={somenteLeitura}
          larga
          dica={
            !somenteLeitura && r.endereco && r.termos.enderecoEntrega !== r.endereco ? (
              <button type="button" className="font-bold text-[#004276] hover:underline" onClick={() => alterarTermos({ enderecoEntrega: r.endereco })}>
                Usar o endereço do contratante
              </button>
            ) : (
              'Cláusula 2.1.'
            )
          }
        />
        <Campo rotulo="Responsável técnico" valor={r.responsavelTecnico} onChange={(v) => alterar({ responsavelTecnico: v })} somenteLeitura={somenteLeitura} dica="Fica no cadastro do contrato; o modelo não o imprime." />
        <Campo rotulo="CREA" valor={r.crea} onChange={(v) => alterar({ crea: v })} somenteLeitura={somenteLeitura} />
      </Grade>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-3">
        <h4 className="font-bold text-slate-800 text-sm">Anexo I — equipamentos</h4>
        {!somenteLeitura && (
          <div className="flex flex-wrap gap-2">
            {itensDaProposta.length > 0 && (
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setItens(itensDaProposta)}>
                <RotateCcw className="w-3.5 h-3.5" />
                Itens da proposta
              </button>
            )}
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setItens(anexoDoSistema(r))} title="Monta a lista com módulos, inversor e estrutura acima">
              <RotateCcw className="w-3.5 h-3.5" />
              Gerar do sistema
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {itens.length === 0 && <p className="text-xs text-slate-500 italic">Nenhum equipamento no Anexo I.</p>}
        {itens.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`Quantidade do item ${i + 1}`}
              value={item.qtd}
              onChange={(e) => mudarItem(i, { qtd: e.target.value })}
              disabled={somenteLeitura}
              placeholder="Qtd"
              className={`${CAMPO.replace('w-full', 'w-20')} shrink-0 text-center`}
            />
            <input
              aria-label={`Descrição do item ${i + 1}`}
              value={item.descricao}
              onChange={(e) => mudarItem(i, { descricao: e.target.value })}
              disabled={somenteLeitura}
              placeholder="Descrição do equipamento"
              className={CAMPO}
            />
            {!somenteLeitura && (
              <div className="flex shrink-0">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Subir item">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Descer item">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="p-1.5 text-rose-500 hover:text-rose-700" aria-label="Remover item">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        {!somenteLeitura && (
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setItens([...itens, { qtd: '', descricao: '' }])}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar equipamento
          </button>
        )}
      </div>
    </div>
  );
};
