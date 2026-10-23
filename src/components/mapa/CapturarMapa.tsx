import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Api } from '../../services/api';
import { enviarCaptura, cancelarCaptura, listarCapturas, imagemCaptura, type CapturaTelhado } from '../../services/capturasTelhado';
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
  const [montado,setMontado]=useState(false),[destino,setDestino]=useState(false),[enviando,setEnviando]=useState(false);
  const [pendente,setPendente]=useState<Pendente>();
  const vivo=useRef(true),trava=useRef(false),cancelado=useRef(false),ac=useRef<AbortController|null>(null),atual=useRef<Pendente|undefined>(undefined);
  useEffect(()=>{setMontado(true);vivo.current=true;return()=>{vivo.current=false;ac.current?.abort();};},[]);
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
    if(trava.current||!alvo.current||!propostaId||!leadId||!podeAnexar)return;
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
      if(!repetir){setDestino(true);setMensagem('');return;}
      setEnviando(true);setMensagem('Armazenando o original e preparando a imagem…');
      const job=await enviarCaptura(p.propostaId,p.id,p.pastaId,p.ia,p.dados,p.pacote,()=>cancelado.current||!vivo.current);
      if(cancelado.current){await cancelarCaptura(p.propostaId,p.id);return;}
      if(vivo.current){setPendente(undefined);atual.current=undefined;setDestino(false);setJobs(js=>[job,...js.filter(j=>j.id!==job.id)]);setMensagem(job.mensagem??'Captura salva.');onSalva(p.dados);}
    }catch(e){if(vivo.current)setMensagem(cancelado.current||e instanceof DOMException&&['AbortError','NotAllowedError'].includes(e.name)
      ?'Captura cancelada. O original enviado, se houver, permanece em Documentos.':e instanceof Error?e.message:'Falha ao capturar a imagem.');}
    finally{trava.current=false;if(vivo.current){setOcupado(false);setEnviando(false);}}
  };
  const cancelar=()=>{
    cancelado.current=true;ac.current?.abort();
    const p=atual.current;if(p)void cancelarCaptura(p.propostaId,p.id).catch(()=>{});
    atual.current=undefined;setPendente(undefined);setDestino(false);setMensagem('Captura cancelada.');
  };
  const impedimento=!propostaId||!leadId?'Salve a proposta com um cliente vinculado antes de capturar.':!podeAnexar?'Sua conta precisa da permissão de anexar documentos.':modo!=='3d'?'Abra a visualização 3D para capturar em HD.':rascunho?'Conclua o contorno antes de capturar.':'';
  return <>
    {montado&&alvo.current&&createPortal(<div data-captura-ocultar className="absolute right-3 top-16 z-30 text-xs">
      <button type="button" title={impedimento||'Capturar somente o mapa'} disabled={ocupado||!!pendente||!!impedimento} className="rounded-lg border bg-white/95 px-3 py-2 font-semibold shadow disabled:opacity-50" onClick={()=>void executar()}> {ocupado?'Capturando…':'▣ Capturar HD'}</button>
      {ocupado&&!destino&&<button type="button" className="ml-1 rounded border bg-white p-2" onClick={cancelar}>Cancelar</button>}
    </div>,alvo.current)}
    {(jobs.some(j=>j.original_id)||mensagem)&&<div className="shrink-0 rounded-lg border bg-white p-2 text-xs" aria-label="Prévias capturadas">
      <div className="flex gap-2 overflow-x-auto">{jobs.filter(j=>j.original_id).map(j=><PreviaCaptura key={j.id} job={j} onErro={setMensagem}/>)}</div>
      {mensagem&&<p role="status" className="mt-1">{mensagem}</p>}
    </div>}
    {destino&&pendente&&createPortal(<div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/60 p-4" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&!ocupado)cancelar();}}>
      <section role="dialog" aria-modal="true" aria-label="Salvar imagem do mapa" className="w-full max-w-xl space-y-3 rounded-xl bg-white p-4 shadow-2xl text-sm">
        <h2 className="font-bold text-lg">Salvar imagem do mapa</h2>
        <ImagemBlob blob={pendente.pacote.original}/>
        <p className="text-xs text-slate-500">{pendente.pacote.largura} × {pendente.pacote.altura} px · Somente o mapa, sem controles.</p>
        <label className="block">Pasta em Documentos<select autoFocus className="mt-1 w-full rounded border p-2" value={pasta} disabled={ocupado} onChange={e=>{setPasta(e.target.value);setPendente(p=>p?{...p,id:crypto.randomUUID(),pastaId:Number(e.target.value)}:p);}}><option value="">Selecione a pasta</option>{pastas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ia} disabled={ocupado} onChange={e=>{setIA(e.target.checked);setPendente(p=>p?{...p,id:crypto.randomUUID(),ia:e.target.checked}:p);}}/>Melhorar com IA</label>
        <p className="text-xs text-slate-500">O original será preservado. A IA melhora o fundo após salvar, mantendo contornos e placas, e pode levar até 15 minutos.</p>
        {mensagem&&<p role="status">{mensagem}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="rounded border px-3 py-2" onClick={cancelar}>Cancelar</button><button type="button" disabled={ocupado||!pasta} className="rounded bg-sky-800 px-3 py-2 text-white disabled:opacity-40" onClick={()=>void executar(true)}>{enviando?'Salvando…':'Salvar imagem'}</button></div>
      </section>
    </div>,document.body)}
  </>;
}

function ImagemBlob({blob}:{blob:Blob}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const u=URL.createObjectURL(blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[blob]);
  return url?<img src={url} alt="Prévia da captura do mapa" className="max-h-[45vh] w-full rounded-lg object-contain bg-slate-100"/>:null;
}
function PreviaCaptura({job,onErro}:{job:CapturaTelhado;onErro:(m:string)=>void}){
  const [blob,setBlob]=useState<Blob>(),[aberta,setAberta]=useState(false);
  useEffect(()=>{let ativo=true;void imagemCaptura(job.proposta_id,job.id).then(b=>{if(ativo)setBlob(b);}).catch(()=>{});return()=>{ativo=false;};},[job.proposta_id,job.id,job.original_id,job.final_id]);
  const processando=['pendente','processando'].includes(job.estado);
  return <div className="w-32 shrink-0 space-y-1">
    <button type="button" className="block h-20 w-full overflow-hidden rounded border" onClick={()=>setAberta(true)} aria-label="Ampliar captura">{blob&&<ImagemBlob blob={blob}/>}</button>
    <p className="text-[10px]">{processando?'Melhorando com IA…':job.final_id?'Imagem melhorada':job.estado==='falhou'?'Original · IA falhou':job.estado==='cancelado'?'Original · IA cancelada':'Original'}</p>
    {processando&&<button type="button" className="underline text-[10px]" onClick={()=>void cancelarCaptura(job.proposta_id,job.id).catch(e=>onErro(e.message))}>Cancelar melhoria</button>}
    {aberta&&blob&&createPortal(<div role="dialog" aria-modal="true" aria-label="Prévia capturada" className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 p-4" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')setAberta(false);}}><div className="w-full max-w-5xl rounded-xl bg-white p-3"><button autoFocus type="button" className="mb-2 rounded border px-3 py-1" onClick={()=>setAberta(false)}>Fechar prévia</button><ImagemBlob blob={blob}/>{job.mensagem&&<p className="mt-2 text-xs">{job.mensagem}</p>}</div></div>,document.body)}
  </div>;
}
