import type { LevantamentoTelhado } from './levantamentoTelhado';
import { fundoEstavel, mascaraCaptura } from './camadasCaptura';

export interface ControleCaptura {
  camera:NonNullable<LevantamentoTelhado['vistaGoogle']>;
  fase:(v:'fundo'|'contornos'|'editor')=>void;
  esperar:()=>Promise<void>;
  restaurar:()=>void;
}
export interface CapturaHD {original:Blob;fundo:Blob;mascara:Blob;largura:number;altura:number;camera:ControleCaptura['camera']}
const png=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem.')),'image/png'));

/** Compartilhamento solicitado antes do primeiro await, no gesto do usuário. */
export async function capturarMapaHD(alvo:HTMLElement,signal?:AbortSignal):Promise<CapturaHD> {
  if(alvo.dataset.mapaPronto==='false')throw new Error('Aguarde o mapa terminar de carregar antes de capturar.');
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Use Chrome ou Edge em HTTPS ou localhost para capturar a aba.');
  const local=new AbortController(),cancelar=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();local.abort();}};
  const combinado=signal?AbortSignal.any([signal,local.signal]):local.signal;
  const media=navigator.mediaDevices as MediaDevices&{setCaptureHandleConfig?:(v:unknown)=>void};
  const handle=crypto.randomUUID();let verifica=false;
  try{if(media.setCaptureHandleConfig){media.setCaptureHandleConfig({handle,exposeOrigin:true,permittedOrigins:[location.origin]});verifica=true;}}catch{}
  let stream:MediaStream|undefined,controle:ControleCaptura|undefined;
  const video=document.createElement('video'),styleOriginal=alvo.getAttribute('style');
  const raiz=alvo.closest<HTMLElement>('[data-captura-raiz]');
  const zOriginal=raiz?.style.zIndex;
  const bloqueador=document.createElement('div');
  const ocultos:Array<[HTMLElement,string]>=[];
  const parar=()=>stream?.getTracks().forEach(t=>t.stop());
  combinado.addEventListener('abort',parar);window.addEventListener('keydown',cancelar,true);
  try{
    stream=await media.getDisplayMedia({video:{displaySurface:'browser',width:{ideal:3840},height:{ideal:2160},frameRate:{ideal:15}},audio:false,
      preferCurrentTab:true,selfBrowserSurface:'include'} as DisplayMediaStreamOptions);
    combinado.throwIfAborted();
    const track=stream.getVideoTracks()[0] as MediaStreamTrack&{getCaptureHandle?:()=>{handle:string;origin:string}|null;cropTo?:(v:unknown)=>Promise<void>};
    if(!track||track.getSettings().displaySurface!=='browser')throw new Error('Selecione a aba atual do Solar Costa, em vez de uma janela ou tela inteira.');
    let confirmado=false;
    if(verifica&&track.getCaptureHandle){const h=track.getCaptureHandle();if(h?.handle!==handle||h?.origin!==location.origin)throw new Error('Selecione esta aba do Solar Costa.');confirmado=true;}
    controle=await new Promise<ControleCaptura>((resolve,reject)=>{
      const evento=new CustomEvent('solarcosta-preparar-captura',{detail:{resolve,reject,signal:combinado},cancelable:true});
      alvo.dispatchEvent(evento);if(!evento.defaultPrevented)reject(new Error('A captura HD está disponível na visualização 3D.'));
    });
    const r=alvo.getBoundingClientRect(),fator=Math.min((window.innerWidth-16)/r.width,(window.innerHeight-16)/r.height);
    const width=r.width*fator,height=r.height*fator;
    if(raiz)raiz.style.zIndex='10000';
    Object.assign(alvo.style,{position:'fixed',left:`${(window.innerWidth-width)/2}px`,top:`${(window.innerHeight-height)/2}px`,width:`${width}px`,height:`${height}px`,zIndex:'10000',background:'#f1f5f9',pointerEvents:'none'});
    Object.assign(bloqueador.style,{position:'absolute',inset:'0',zIndex:'99999',pointerEvents:'auto',cursor:'wait'});
    bloqueador.addEventListener('pointerdown',e=>e.stopPropagation());
    bloqueador.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
    alvo.append(bloqueador);
    alvo.querySelectorAll<HTMLElement>('[data-captura-ocultar]').forEach(el=>{ocultos.push([el,el.style.visibility]);el.style.visibility='hidden';});
    const crop=(window as any).CropTarget;
    if(crop?.fromElement&&track.cropTo){await track.cropTo(await crop.fromElement(alvo));confirmado=true;}
    if(!confirmado)throw new Error('Este navegador não permite confirmar a aba. Use Chrome ou Edge atualizado.');
    const recortado=!!(crop?.fromElement&&track.cropTo);
    video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
    const quadro=()=>new Promise<void>((resolve,reject)=>{
      let id:number;
      const terminar=(erro?:unknown)=>{clearTimeout(timer);combinado.removeEventListener('abort',abortar);if(id)video.cancelVideoFrameCallback?.(id);erro?reject(erro):resolve();};
      const abortar=()=>terminar(new DOMException('Captura cancelada','AbortError'));
      const timer=setTimeout(()=>terminar(new Error('A captura não recebeu uma imagem.')),8000);
      combinado.addEventListener('abort',abortar,{once:true});
      if(video.requestVideoFrameCallback)id=video.requestVideoFrameCallback(()=>terminar());else setTimeout(()=>terminar(),150);
    });
    const capturar=async()=>{
      await controle!.esperar();await quadro();await quadro();combinado.throwIfAborted();
      const rect=alvo.getBoundingClientRect(),sx=video.videoWidth/window.innerWidth,sy=video.videoHeight/window.innerHeight;
      if(!recortado&&Math.abs(sx-sy)/Math.max(sx,sy)>0.05)throw new Error('Não foi possível alinhar a aba capturada.');
      const w=recortado?video.videoWidth:rect.width*sx,h=recortado?video.videoHeight:rect.height*sy;
      if(!w||!h)throw new Error('Captura vazia.');
      const f=Math.min(1,3840/w,3840/h),canvas=document.createElement('canvas');
      canvas.width=Math.round(w*f);canvas.height=Math.round(h*f);
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(video,recortado?0:rect.left*sx,recortado?0:rect.top*sy,w,h,0,0,canvas.width,canvas.height);
      return {canvas,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};
    };
    for(let tentativa=0;tentativa<2;tentativa++){
      controle.fase('fundo');const fundo=await capturar();
      controle.fase('contornos');const original=await capturar();
      controle.fase('fundo');const depois=await capturar();
      const largura=fundo.canvas.width,altura=fundo.canvas.height;
      const rodape=Math.min(Math.ceil(64*altura/height),Math.floor(altura/3));
      if(original.canvas.width!==largura||original.canvas.height!==altura||depois.canvas.width!==largura||depois.canvas.height!==altura||
        !fundoEstavel(fundo.pixels,depois.pixels,largura,altura,rodape))continue;
      const mask=document.createElement('canvas');mask.width=largura;mask.height=altura;
      mask.getContext('2d')!.putImageData(new ImageData(mascaraCaptura(fundo.pixels,original.pixels,largura,altura,rodape),largura,altura),0,0);
      const blobs=await Promise.all([png(original.canvas),png(fundo.canvas),png(mask)]);
      if(blobs.some(b=>b.size>10*1024*1024))throw new Error('Uma camada excedeu 10 MB. Reduza o tamanho da janela e tente novamente.');
      return {original:blobs[0],fundo:blobs[1],mascara:blobs[2],largura,altura,camera:controle.camera};
    }
    throw new Error('O mapa mudou durante a captura. Aguarde carregar os detalhes e tente novamente.');
  }finally{
    bloqueador.remove();if(raiz)raiz.style.zIndex=zOriginal??'';
    controle?.restaurar();
    if(styleOriginal===null)alvo.removeAttribute('style');else alvo.setAttribute('style',styleOriginal);
    ocultos.forEach(([el,v])=>{el.style.visibility=v;});
    parar();video.pause();video.srcObject=null;
    combinado.removeEventListener('abort',parar);window.removeEventListener('keydown',cancelar,true);
    if(verifica)try{media.setCaptureHandleConfig?.({handle:'',exposeOrigin:false,permittedOrigins:[]});}catch{}
  }
}
