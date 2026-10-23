import React, { useEffect, useState } from 'react';
import type { LevantamentoTelhado } from '../../utils/levantamentoTelhado';
import { assinaturaCaptura, listarCapturas, imagemCaptura, type CapturaTelhado } from '../../services/capturasTelhado';
import { chaveCaptura } from '../../../server/src/domain/capturaTelhado';
import { FiguraLevantamento } from './LevantamentoManual';
import { GoogleVistaImovel } from './GoogleVistaImovel';

const ignorar = () => {};

/** A prévia compartilha a geometria do editor, mas nunca altera o levantamento. */
export function PreviaLevantamento({ dados, chave, propostaId, googleAtivo=true }: {
  dados: LevantamentoTelhado; propostaId?:string; chave?: string|null; googleAtivo?: boolean;
}) {
  const [falha, setFalha] = useState('');
  const [imagem,setImagem]=useState<{url:string;chave:string}>();
  const [resolvida,setResolvida]=useState('');
  const [job,setJob]=useState<CapturaTelhado>();
  const identidade=chaveCaptura(dados);
  useEffect(()=>{
    let ativo=true,url:string|undefined,ultimoDoc:string|undefined,timer:ReturnType<typeof setTimeout>;
    setImagem(undefined);setJob(undefined);
    const carregar=async()=>{
      try{
        if(!propostaId)return;
        const assinatura=await assinaturaCaptura(dados);
        const r=await listarCapturas(propostaId,assinatura);if(!ativo)return;
        const captura=r.capturas.find(c=>c.original_id);
        setJob(captura);
        const doc=captura?.final_id??captura?.original_id;
        if(captura&&doc!==ultimoDoc){
          const blob=await imagemCaptura(propostaId,captura.id);if(!ativo)return;
          if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);ultimoDoc=doc;
          setImagem({url,chave:identidade});
        }
        if(r.capturas.some(c=>c.estado==='pendente'||c.estado==='processando'))timer=setTimeout(()=>void carregar(),3000);
      }catch{if(ativo)timer=setTimeout(()=>void carregar(),15000);}finally{if(ativo)setResolvida(identidade);}
    };
    void carregar();return()=>{ativo=false;clearTimeout(timer);if(url)URL.revokeObjectURL(url);};
  },[propostaId,identidade]);
  const local = dados.satelite ?? dados.localizacao ?? dados.vistaGoogle;
  const pode3d = !!chave && googleAtivo && !!local && !!dados.satelite;
  const mostrar3d = pode3d && !falha;
  if(imagem?.chave===identidade)return <div className="space-y-2">
    <img src={imagem.url} alt="Imagem salva do levantamento do telhado" className="w-full rounded-lg border object-contain"/>
    {job&&['pendente','processando'].includes(job.estado)&&<p role="status" className="text-xs text-slate-500">{job.pronta?'Original salvo. Melhoria por IA em andamento…':'Original salvo. Finalizando envio da captura…'}</p>}
    {job?.estado==='falhou'&&<p role="status" className="text-xs text-slate-500">{job.mensagem}</p>}
  </div>;
  if(propostaId&&resolvida!==identidade)return <div role="status" className="flex h-[360px] items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">Carregando imagem do levantamento…</div>;
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
