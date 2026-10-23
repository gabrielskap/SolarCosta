/** Captura a composição real do navegador, incluindo WebGL e atribuição Google.
 * Precisa ser chamada diretamente por um clique para abrir a seleção da aba.
 */
export async function capturarMapa(alvo: HTMLElement, signal?: AbortSignal): Promise<Blob> {
  if(alvo.dataset.mapaPronto==='false')throw new Error('Aguarde o mapa terminar de carregar antes de capturar.');
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Este navegador não oferece captura de aba. Use Chrome ou Edge em HTTPS ou localhost.');
  const media = navigator.mediaDevices as MediaDevices & {setCaptureHandleConfig?: (config:unknown)=>void};
  const identificador = crypto.randomUUID();
  let verificaHandle = false;
  try {
    if(media.setCaptureHandleConfig){media.setCaptureHandleConfig({handle:identificador,exposeOrigin:true,permittedOrigins:[location.origin]});verificaHandle=true;}
  } catch { /* Alguns navegadores permitem captura sem Capture Handle. */ }
  const video = document.createElement('video');
  let stream: MediaStream | undefined;
  const parar=()=>stream?.getTracks().forEach(track=>track.stop());
  signal?.addEventListener('abort',parar,{once:true});
  try {
    signal?.throwIfAborted();
    stream = await media.getDisplayMedia({video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include'} as DisplayMediaStreamOptions);
    signal?.throwIfAborted();
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & {getCaptureHandle?:()=>{handle:string;origin:string}|null;cropTo?:(target:unknown)=>Promise<void>};
    if (!track || track.getSettings().displaySurface !== 'browser') throw new Error('Selecione a aba atual do sistema, em vez de uma janela ou tela inteira.');
    let origemConfirmada=false;
    if(verificaHandle&&track.getCaptureHandle){const h=track.getCaptureHandle();if(h?.handle!==identificador||h?.origin!==location.origin)throw new Error('Selecione esta aba do Solar Costa para capturar o mapa correto.');origemConfirmada=true;}
    const crop = (window as any).CropTarget;
    let recortado = false;
    if(crop?.fromElement && track.cropTo){await track.cropTo(await crop.fromElement(alvo));recortado=true;origemConfirmada=true;}
    if(!origemConfirmada)throw new Error('Este navegador não permite confirmar a aba capturada. Use Chrome ou Edge atualizado para capturar o mapa.');
    video.muted=true;video.playsInline=true;video.srcObject=stream;
    await video.play();
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('A captura não recebeu uma imagem. Tente novamente.')),8000);
      const concluir=()=>{clearTimeout(timer);resolve();};
      if(typeof (video as any).requestVideoFrameCallback==='function')(video as any).requestVideoFrameCallback(concluir);
      else if(video.readyState>=2)concluir();else video.addEventListener('loadeddata',concluir,{once:true});
    });
    signal?.throwIfAborted();
    const rect=alvo.getBoundingClientRect();
    const sx=video.videoWidth/window.innerWidth,sy=video.videoHeight/window.innerHeight;
    if(!recortado&&Math.abs(sx-sy)/Math.max(sx,sy)>0.05)throw new Error('Não foi possível alinhar a captura. Selecione a aba atual do sistema.');
    if(!rect.width||!rect.height||rect.left<0||rect.top<0||rect.right>window.innerWidth+1||rect.bottom>window.innerHeight+1)throw new Error('Mantenha o mapa inteiro visível na aba antes de capturar.');
    const x=recortado?0:rect.left*sx,y=recortado?0:rect.top*sy,w=recortado?video.videoWidth:rect.width*sx,h=recortado?video.videoHeight:rect.height*sy;
    const fator=Math.min(1,2560/w,2560/h),canvas=document.createElement('canvas');
    canvas.width=Math.round(w*fator);canvas.height=Math.round(h*fator);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível criar a imagem da captura.');
    ctx.drawImage(video,x,y,w,h,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem.')),'image/png'));
    if(blob.size>10*1024*1024)throw new Error('Captura maior que 10 MB. Reduza o tamanho da janela e tente novamente.');
    return blob;
  } finally {
    signal?.removeEventListener('abort',parar);parar();video.pause();video.srcObject=null;
    if(verificaHandle)try{media.setCaptureHandleConfig?.({handle:'',exposeOrigin:false,permittedOrigins:[]});}catch{/* ignorado */}
  }
}
