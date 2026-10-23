import React, { useState } from 'react';
import type { LevantamentoTelhado } from '../../utils/levantamentoTelhado';
import { FiguraLevantamento } from './LevantamentoManual';
import { GoogleVistaImovel } from './GoogleVistaImovel';

const ignorar = () => {};

/** A prévia compartilha a geometria do editor, mas nunca altera o levantamento. */
export function PreviaLevantamento({ dados, chave, googleAtivo=true }: {
  dados: LevantamentoTelhado; chave?: string|null; googleAtivo?: boolean;
}) {
  const [falha, setFalha] = useState('');
  const local = dados.satelite ?? dados.localizacao ?? dados.vistaGoogle;
  const pode3d = !!chave && googleAtivo && !!local && !!dados.satelite;
  const mostrar3d = pode3d && !falha;
  return <div className="space-y-2">
    {mostrar3d&&local ? <div className="h-[360px] md:h-[420px]" aria-label="Prévia 3D do levantamento salvo">
      <GoogleVistaImovel chave={chave} latitude={local.latitude} longitude={local.longitude} modo="3d" somenteLeitura onIndisponivel={setFalha}
        onVoltar={()=>setFalha('3D indisponível')} onSalvarVista={ignorar} onSelecionarLocal={ignorar}
        edicao={{dados,rascunho:[],ferramenta:'navegar',onPonto:ignorar,onRemover:ignorar,onFechar:ignorar,onCamera:ignorar,onAviso:ignorar}}/>
    </div> : <>
      {falha&&<p role="status" className="text-xs text-slate-500">3D indisponível no momento. Exibindo o desenho em 2D.</p>}
      <FiguraLevantamento dados={dados}/>
    </>}
  </div>;
}
