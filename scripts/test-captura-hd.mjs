import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

const bundle=await build({entryPoints:['src/utils/capturarMapaHD.ts'],bundle:true,platform:'node',format:'cjs',write:false});
async function testar({instavel=false,abortar=false,negar=false}={}){
  const module={exports:{}},log=[],root={style:{zIndex:''}},oculto={style:{visibility:'visible'}};
  let fase='editor',limpos=0,handle,parou=false,restaurou=false;
  const camera={modo:'3d',latitude:-19,longitude:-43,distanciaM:180,inclinacao:45,azimute:0};
  class Evento{constructor(type,options){this.type=type;Object.assign(this,options);}preventDefault(){this.defaultPrevented=true;}}
  const target={dataset:{mapaPronto:'true'},style:{},getAttribute:()=>null,removeAttribute(){this.style={};},
    getBoundingClientRect:()=>({width:400,height:300,left:100,top:80}),closest:()=>root,querySelectorAll:()=>[oculto],append(){},
    dispatchEvent(e){e.preventDefault();e.detail.resolve({camera,fase:v=>{fase=v;log.push(v);if(v==='fundo')limpos++;},
      esperar:async()=>{if(abortar)throw new DOMException('Cancelado','AbortError');},restaurar:()=>{fase='editor';restaurou=true;}});}};
  const track={stop(){parou=true;},getSettings:()=>({displaySurface:'browser'}),getCaptureHandle:()=>({handle,origin:'http://localhost:3000'}),cropTo:async()=>{}};
  const recortes=[];
  const ctx={drawImage(...args){recortes.push(args.slice(1,5));},putImageData(){},getImageData(){
    const a=new Uint8ClampedArray(80*60*4).fill(instavel&&limpos%2===0?220:90);
    for(let i=3;i<a.length;i+=4)a[i]=255;
    if(fase==='contornos')a[(10*80+10)*4]=255;
    return {data:a};
  }};
  const video={videoWidth:256,videoHeight:144,play:async()=>{},pause(){},requestVideoFrameCallback:cb=>setTimeout(cb,0),cancelVideoFrameCallback:clearTimeout};
  const document={createElement(type){if(type==='video')return video;
    if(type==='div')return {style:{},addEventListener(){},remove(){}};
    return {width:0,height:0,getContext:()=>ctx,toBlob:cb=>cb(new Blob(['test'],{type:'image/png'}))};}};
  const window={innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},CropTarget:{fromElement:async()=>({})}};
  runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,Uint8ClampedArray,AbortController,AbortSignal,DOMException,Blob,
    setTimeout,clearTimeout,CustomEvent:Evento,ImageData:class{},crypto:{randomUUID:()=> 'capture-test'},location:{origin:'http://localhost:3000'},document,window,
    navigator:{mediaDevices:{setCaptureHandleConfig:v=>{if(v.handle)handle=v.handle;},getDisplayMedia:async()=>{
      if(negar)throw new DOMException('Negado','NotAllowedError');return {getVideoTracks:()=>[track],getTracks:()=>[track]};
    }}}});
  let result,erro;
  try{result=await module.exports.capturarMapaHD(target);}catch(e){erro=e;}
  if(instavel||abortar||negar){
    assert(erro,'o cenário deve interromper a captura');
    if(instavel)assert.match(erro.message,/mapa mudou/);
    if(abortar)assert.equal(erro.name,'AbortError');
    if(negar)assert.equal(erro.name,'NotAllowedError');
  }else{
    assert.ifError(erro);
    assert.equal(result.camera,camera);assert.equal(result.largura,80);assert.equal(result.altura,60);
    assert.deepEqual(log,['fundo','contornos','fundo']);
    assert.deepEqual(recortes,[[20,16,80,60],[20,16,80,60],[20,16,80,60]],'recorta somente o mapa, nunca a aba inteira');
    assert.equal(result.original.type,'image/png');
  }
  assert.equal(oculto.style.visibility,'visible','controles restaurados');
  assert.equal(root.style.zIndex,'','empilhamento restaurado');
  assert.deepEqual(target.style,{},'layout restaurado');
  if(!negar){assert(parou,'compartilhamento encerrado');assert(restaurou,'editor restaurado');}
}
await testar();await testar({instavel:true});await testar({abortar:true});await testar({negar:true});
console.log('OK: captura em camadas, câmera, proporção, repetição por instabilidade, abortamento, permissão e restauração.');
