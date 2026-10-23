import React, { useEffect, useRef, useState } from 'react';
import { Api } from '../../services/api';
import type { PastaDocumento } from '../../types';
import { capturarMapa } from '../../utils/capturarMapa';

export function CapturarMapa({ alvo, leadId, projeto, modo, podeAnexar, temPontos }: {
  alvo: React.RefObject<HTMLElement>; leadId?:string;projeto?:string;modo:string;podeAnexar:boolean;temPontos:boolean;
}) {
  const [pastas,setPastas]=useState<PastaDocumento[]>([]);
  const [pasta,setPasta]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [mensagem,setMensagem]=useState('');
  const [falha,setFalha]=useState(false);
  const [pendente,setPendente]=useState<{arquivo:File;leadId:string;pastaId:number}>();
  const vivo=useRef(true),trava=useRef(false);
  const capturaAtiva=useRef<AbortController|null>(null);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;capturaAtiva.current?.abort();};},[]);
  useEffect(()=>{
    setPastas([]);setPasta('');setPendente(undefined);setMensagem('');
    if(!leadId||!podeAnexar)return;
    let ativo=true;
    Api.getPastasLead(leadId).then(r=>{if(ativo){setPastas(r.pastas);const preferida=r.pastas.find(p=>/imagem|foto/i.test(p.nome));setPasta(preferida?String(preferida.id):'');}})
      .catch(e=>{if(ativo){setFalha(true);setMensagem(e instanceof Error?e.message:'Não foi possível carregar as pastas.');}});
    return()=>{ativo=false;};
  },[leadId,podeAnexar]);
  const executar=async(repetir=false)=>{
    if(trava.current||!alvo.current||!leadId||!pasta||!podeAnexar)return;
    trava.current=true;setOcupado(true);setMensagem('');setFalha(false);
    try{
      let captura=pendente;
      if(!repetir){
        const destino=leadId,pastaId=Number(pasta);
        const area=alvo.current.querySelector<HTMLElement>('[data-area-captura-mapa]')??alvo.current;
        capturaAtiva.current=new AbortController();
        const blob=await capturarMapa(area,capturaAtiva.current.signal);
        const nome=('levantamento-'+(projeto||'projeto')+'-'+modo+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-190);
        captura={arquivo:new File([blob],nome,{type:'image/png'}),leadId:destino,pastaId};
        if(vivo.current)setPendente(captura);
      }
      if(!captura||!vivo.current)return;
      await Api.enviarDocumento(captura.leadId,captura.pastaId,captura.arquivo);
      if(vivo.current){setPendente(undefined);setMensagem('Imagem armazenada em Documentos → '+(pastas.find(p=>p.id===captura!.pastaId)?.nome||'pasta selecionada')+'.');}
    }catch(e){if(vivo.current){setFalha(true);setMensagem(e instanceof DOMException&&e.name==='NotAllowedError'?'Captura cancelada. Para tentar novamente, selecione esta aba no diálogo do navegador.':e instanceof Error?e.message:'Falha ao capturar ou armazenar a imagem.');}}
    finally{trava.current=false;if(vivo.current)setOcupado(false);}
  };
  return <div className="text-xs flex flex-wrap items-center gap-2 border-b bg-white px-2 py-1.5" aria-label="Captura do levantamento">
    <label>Pasta das imagens <select className="border rounded p-1 max-w-60" aria-label="Pasta das imagens" value={pasta} disabled={ocupado||!leadId||!podeAnexar} onChange={e=>setPasta(e.target.value)}><option value="">Selecione a pasta</option>{pastas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <button type="button" disabled={ocupado||!leadId||!pasta||!podeAnexar||!temPontos} className="rounded bg-sky-800 text-white px-3 py-1.5 disabled:opacity-40" onClick={()=>void executar()}>{ocupado?'Capturando / armazenando…':'Capturar'}</button>
    {pendente&&falha&&<button type="button" disabled={ocupado} className="underline" onClick={()=>void executar(true)}>Tentar armazenar a captura novamente</button>}
    <span className="text-slate-500">{!leadId?'Vincule a proposta a um cliente para armazenar as imagens.':!podeAnexar?'Sua conta precisa da permissão de anexar documentos.':!temPontos?'Insira os pontos antes de capturar.':'No diálogo do navegador, selecione esta aba do sistema.'}</span>
    {mensagem&&<p role={falha?'alert':'status'} className={falha?'text-red-700':'text-emerald-800'}>{mensagem}</p>}
  </div>;
}
