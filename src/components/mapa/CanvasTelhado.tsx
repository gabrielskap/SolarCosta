import React,{useEffect,useRef,useState} from 'react';
import {aproximarCamera,limitarCamera,type CameraTelhado} from '../../utils/cameraTelhado';
import type {PontoLocal} from '../../utils/levantamentoTelhado';

/** A câmera muda somente o viewBox. A geometria continua sempre em metros. */
export function CanvasTelhado({largura,altura,resetKey,children,onPonto,expandido=false,interacao}:{
  largura:number;altura:number;resetKey?:string;children:React.ReactNode;onPonto?:(p:PontoLocal)=>void;expandido?:boolean;interacao?:string;
}) {
  const inicial=():CameraTelhado=>({zoom:1,centro:{x:largura/2,y:altura/2}});
  const [camera,setCamera]=useState<CameraTelhado>(inicial);
  const [navegar,setNavegar]=useState(false);
  const [arrastando,setArrastando]=useState(false);
  const ref=useRef<SVGSVGElement>(null);
  const arrasto=useRef<{id:number;inicio:DOMPoint;camera:CameraTelhado;inversa:DOMMatrix;clientX:number;clientY:number}|null>(null);
  const ignorarClique=useRef(false);
  useEffect(()=>{setCamera(inicial());arrasto.current=null;setArrastando(false);},[largura,altura,resetKey]);
  useEffect(()=>{setNavegar(interacao?.startsWith('navegar')??false);ignorarClique.current=false;},[interacao]);
  useEffect(()=>{
    const svg=ref.current;if(!svg||!onPonto)return;
    const roda=(e:WheelEvent)=>{
      const matriz=svg.getScreenCTM();if(!matriz)return;
      e.preventDefault();
      const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matriz.inverse());
      const fator=Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*0.004);
      setCamera(c=>aproximarCamera(c,fator,p,largura,altura));
    };
    svg.addEventListener('wheel',roda,{passive:false});
    return ()=>svg.removeEventListener('wheel',roda);
  },[largura,altura,!!onPonto]);
  const c=limitarCamera(camera,largura,altura),w=largura/c.zoom,h=altura/c.zoom;
  const aproximar=(fator:number)=>setCamera(atual=>aproximarCamera(atual,fator,atual.centro,largura,altura));
  const encerrar=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(arrasto.current?.id!==e.pointerId)return;
    arrasto.current=null;setArrastando(false);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return <div className={`relative rounded-lg border border-slate-300 overflow-hidden bg-slate-100 ${expandido?'h-full min-h-0 flex flex-col':''}`}>
    {onPonto&&<div className="absolute bottom-8 left-2 max-w-[calc(100%-16px)] z-10 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 text-xs shadow-lg" aria-label="Controles de zoom do mapa">
      <button type="button" className="rounded border px-3 py-1.5 font-bold disabled:opacity-40" aria-label="Aproximar mapa" disabled={c.zoom>=12} onClick={()=>aproximar(1.5)}>+</button>
      <button type="button" className="rounded border px-3 py-1.5 font-bold disabled:opacity-40" aria-label="Afastar mapa" disabled={c.zoom<=1} onClick={()=>aproximar(1/1.5)}>−</button>
      <span aria-live="polite" aria-label="Nível de zoom">{Math.round(c.zoom*100)}%</span>
      <button type="button" className="rounded border px-3 py-1.5" onClick={()=>setCamera(inicial())}>Enquadrar imagem</button>
      {!interacao&&<button type="button" aria-pressed={navegar} className={`rounded border px-3 py-1.5 ${navegar?'bg-[#004276] text-white':'bg-white text-slate-700'}`} onClick={()=>setNavegar(v=>!v)}>Mover mapa</button>}

    </div>}
    <svg ref={ref} overflow="hidden" viewBox={`${c.centro.x-w/2} ${c.centro.y-h/2} ${w} ${h}`} role="img" aria-label="Planta do telhado em metros" className={expandido?'w-full flex-1 min-h-0':'w-full max-h-[560px]'} style={{aspectRatio:expandido?undefined:`${largura}/${altura}`,touchAction:onPonto?'none':undefined,maxHeight:expandido?undefined:onPonto?'48vh':undefined,cursor:onPonto?(arrastando?'grabbing':navegar?'grab':'crosshair'):undefined}}
      onPointerDown={e=>{
        if(!onPonto||!(navegar||e.button===1||e.shiftKey)||e.button===2)return;
        const matriz=e.currentTarget.getScreenCTM();if(!matriz)return;
        e.preventDefault();ignorarClique.current=false;
        const inversa=matriz.inverse();
        arrasto.current={id:e.pointerId,inicio:new DOMPoint(e.clientX,e.clientY).matrixTransform(inversa),camera:c,inversa,clientX:e.clientX,clientY:e.clientY};
        e.currentTarget.setPointerCapture(e.pointerId);setArrastando(true);
      }}
      onPointerMove={e=>{
        const a=arrasto.current;if(!a||a.id!==e.pointerId)return;
        if(Math.hypot(e.clientX-a.clientX,e.clientY-a.clientY)>3)ignorarClique.current=true;
        const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(a.inversa);
        setCamera(limitarCamera({...a.camera,centro:{x:a.camera.centro.x+a.inicio.x-p.x,y:a.camera.centro.y+a.inicio.y-p.y}},largura,altura));
      }}
      onPointerUp={encerrar} onPointerCancel={encerrar} onLostPointerCapture={()=>{arrasto.current=null;setArrastando(false);}}
      onClickCapture={e=>{if(navegar||ignorarClique.current||e.shiftKey){e.stopPropagation();ignorarClique.current=false;}}}
      onClick={e=>{
        if(!onPonto||!ref.current)return;
        const matriz=ref.current.getScreenCTM();if(!matriz)return;
        const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matriz.inverse());
        if(p.x>=0&&p.y>=0&&p.x<=largura&&p.y<=altura)onPonto({x:p.x,y:p.y});
      }}>{children}</svg>
  </div>;
}
