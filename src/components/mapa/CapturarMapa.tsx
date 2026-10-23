import React, { useEffect, useRef, useState } from 'react';
import { Api } from '../../services/api';
import { enviarCaptura, cancelarCaptura, listarCapturas, type CapturaTelhado } from '../../services/capturasTelhado';
import type { PastaDocumento } from '../../types';
import type { LevantamentoTelhado } from '../../utils/levantamentoTelhado';
import { capturarMapaHD, type CapturaHD } from '../../utils/capturarMapaHD';

interface Pendente {id:string;propostaId:string;pastaId:number;ia:boolean;dados:LevantamentoTelhado;pacote:CapturaHD}
export function CapturarMapa({ alvo, leadId, propostaId, modo, podeAnexar, dados, rascunho, onSalva }: {
  alvo:React.RefObject<HTMLElement>;leadId?:string;propostaId?:string;modo:string;podeAnexar:boolean;
  dados:LevantamentoTelhado;rascunho:boolean;onSalva:(d:LevantamentoTelhado)=>void;
}) {
  const [pastas,setPastas]=useState<PastaDocumento[]>([]),[pasta,setPasta]=useState('');
  const [ia,setIA]=useState(false),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState('');
  const [jobs,setJobs]=useState<CapturaTelhado[]>([]);
  const [pendente,setPendente]=useState<Pendente>();
  const vivo=useRef(true),trava=useRef(false),cancelado=useRef(false),ac=useRef<AbortController|null>(null),atual=useRef<Pendente|undefined>(undefined);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;ac.current?.abort();};},[]);
  useEffect(()=>{
    let ativo=true;setPastas([]);setPasta('');setPendente(undefined);atual.current=undefined;
    if(leadId&&podeAnexar)Api.getPastasLead(leadId).then(r=>{if(ativo){setPastas(r.pastas);const foto=r.pastas.find(p=>/imagem|foto/i.test(p.nome));setPasta(foto?String(foto.id):'');}})
      .catch(()=>{if(ativo)setMensagem('Não foi possível carregar as pastas de Documentos.');});
    return()=>{ativo=false;};
  },[leadId,podeAnexar,propostaId]);
  useEffect(()=>{
    if(!propostaId)return;let ativo=true,timer:ReturnType<typeof setTimeout>;
    const atualizar=async()=>{try{const r=await listarCapturas(propostaId);if(ativo)setJobs(r.capturas);}catch{}finally{if(ativo)timer=setTimeout(()=>void atualizar(),5000);}};
    void atualizar();return()=>{ativo=false;clearTimeout(timer);};
  },[propostaId]);
  const executar=async(repetir=false)=>{
    if(trava.current||!alvo.current||!propostaId||!leadId||!pasta||!podeAnexar)return;
    trava.current=true;cancelado.current=false;setOcupado(true);setMensagem('Selecione esta aba do sistema. Escape cancela a captura.');
    try{
      let p=repetir?pendente:undefined;
      if(!p){
        ac.current=new AbortController();
        const area=alvo.current.querySelector<HTMLElement>('[data-area-captura-mapa]');
        if(!area)throw new Error('Abra o mapa 3D para capturar.');
        const pacote=await capturarMapaHD(area,ac.current.signal);
        p={id:crypto.randomUUID(),propostaId,pastaId:Number(pasta),ia,dados:{...structuredClone(dados),vistaGoogle:pacote.camera},pacote};
        atual.current=p;if(vivo.current)setPendente(p);
      }
      if(!vivo.current||cancelado.current)return;
      setMensagem('Armazenando o original e preparando a imagem…');
      const job=await enviarCaptura(p.propostaId,p.id,p.pastaId,p.ia,p.dados,p.pacote,()=>cancelado.current||!vivo.current);
      if(cancelado.current){await cancelarCaptura(p.propostaId,p.id);return;}
      if(vivo.current){setPendente(undefined);setMensagem(job.mensagem??'Captura salva.');onSalva(p.dados);}
    }catch(e){if(vivo.current)setMensagem(cancelado.current||e instanceof DOMException&&['AbortError','NotAllowedError'].includes(e.name)
      ?'Captura cancelada. O original enviado, se houver, permanece em Documentos.':e instanceof Error?e.message:'Falha ao capturar a imagem.');}
    finally{trava.current=false;if(vivo.current)setOcupado(false);}
  };
  const cancelar=()=>{
    cancelado.current=true;ac.current?.abort();
    const p=atual.current;if(p)void cancelarCaptura(p.propostaId,p.id).catch(()=>{});
    setPendente(undefined);setMensagem('Cancelando…');
  };
  const impedimento=!propostaId||!leadId?'Salve a proposta com um cliente vinculado antes de capturar.':!podeAnexar?'Sua conta precisa da permissão de anexar documentos.':modo!=='3d'?'Abra a visualização 3D para capturar em HD.':rascunho?'Conclua o contorno antes de capturar.':'';
  return <div className="space-y-3 bg-white p-3 text-xs" aria-label="Captura HD do levantamento">
    <label className="block">Pasta em Documentos<select className="mt-1 w-full rounded border p-1.5" value={pasta} disabled={ocupado||!!impedimento} onChange={e=>setPasta(e.target.value)}><option value="">Selecione a pasta</option>{pastas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={ia} disabled={ocupado} onChange={e=>setIA(e.target.checked)}/>Melhorar com IA</label>
    <p className="text-slate-500">Original preservado. Contornos e placas ficam fora da IA. A resolução da captura depende da tela; a melhoria pode levar até 15 minutos.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={ocupado||!!pendente||!!impedimento||!pasta} className="rounded bg-sky-800 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={()=>void executar()}>{ocupado?'Preparando imagem…':'Capturar em HD'}</button>
      {(ocupado||pendente)&&<button type="button" className="rounded border px-3 py-2" onClick={cancelar}>Cancelar</button>}
      {pendente&&!ocupado&&<button type="button" className="underline" onClick={()=>void executar(true)}>Tentar armazenar novamente</button>}
    </div>
    {impedimento&&<p className="text-slate-500">{impedimento}</p>}
    {jobs.filter(j=>['pendente','processando'].includes(j.estado)).map(j=><div key={j.id} className="rounded border p-2"><p role="status">{!j.pronta?'Aguardando envio':j.estado==='pendente'?'Aguardando IA':'Melhorando imagem'} — original preservado</p><button type="button" className="mt-1 underline" onClick={()=>void cancelarCaptura(j.proposta_id,j.id).then(()=>setJobs(js=>js.filter(v=>v.id!==j.id))).catch(e=>setMensagem(e.message))}>Cancelar melhoria</button></div>)}
    {mensagem&&<p role="status">{mensagem}</p>}
  </div>;
}
