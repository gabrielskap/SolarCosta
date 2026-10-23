import assert from 'node:assert/strict';
import sharp from '../server/node_modules/sharp/lib/index.js';
import { mascaraCaptura, fundoEstavel } from '../src/utils/camadasCaptura.ts';
import { chaveCaptura } from '../server/src/domain/capturaTelhado.ts';
import { comporCaptura, validarImagem } from '../server/src/services/imagemCaptura.ts';

const width=80,height=60;
const fundo=new Uint8ClampedArray(width*height*4).fill(90),original=new Uint8ClampedArray(fundo);
for(let i=3;i<fundo.length;i+=4){fundo[i]=original[i]=255;}
for(let y=10;y<30;y++){const i=(y*width+20)*4;original[i]=0;original[i+1]=180;original[i+2]=240;}
const mask=mascaraCaptura(fundo,original,width,height,10);
assert.equal(mask[(15*width+20)*4],255,'linha protegida');
assert.equal(mask[(15*width+22)*4],255,'borda de segurança protege antialiasing');
assert.equal(mask[(55*width+5)*4],255,'atribuição protegida');
assert.equal(mask[(5*width+5)*4],0,'fundo disponível para IA');
assert(fundoEstavel(fundo,fundo,width,height,10));
assert(!fundoEstavel(fundo,new Uint8ClampedArray(fundo.length).fill(200),width,height,10));
const png=async(data:Uint8ClampedArray)=>sharp(Buffer.from(data),{raw:{width,height,channels:4}}).png().toBuffer();
const orig=await png(original),mascara=await png(mask);
const enhanced=await sharp({create:{width:160,height:120,channels:3,background:'#e1e1e1'}}).webp({lossless:true}).toBuffer();
const result=await comporCaptura(orig,mascara,enhanced);
const {data,info}=await sharp(result).removeAlpha().raw().toBuffer({resolveWithObject:true});
const normal=await sharp(orig).resize(160,120,{kernel:'lanczos3'}).removeAlpha().raw().toBuffer();
assert.equal(info.width,160);assert.equal(info.height,120);
const line=(30*160+40)*3;
assert.deepEqual(data.subarray(line,line+3),normal.subarray(line,line+3),'pixels do desenho não passam pela IA');
assert.equal(data[(10*160+10)*3],225,'somente o fundo usa IA');
const credit=(110*160+10)*3;
assert.deepEqual(data.subarray(credit,credit+3),normal.subarray(credit,credit+3),'atribuição original preservada');
await assert.rejects(()=>validarImagem(Buffer.from('fake'),80,60));
await assert.rejects(()=>validarImagem(orig,81,60));
await assert.rejects(()=>validarImagem(Buffer.alloc(10*1024*1024+1),80,60));
const d:any={larguraM:30,alturaM:20,norte:0,aguas:[],placas:[],obstaculos:[],vistaGoogle:{modo:'3d',latitude:-19,longitude:-43}};
assert.equal(chaveCaptura(d),chaveCaptura(Object.fromEntries(Object.entries(d).reverse()) as any));
assert.notEqual(chaveCaptura(d),chaveCaptura({...d,aguas:[{id:'a',pontos:[{x:1,y:1}]}]}));
assert.notEqual(chaveCaptura(d),chaveCaptura({...d,vistaGoogle:{...d.vistaGoogle,azimute:90}}));
console.log('OK: máscara, estabilidade, composição, atribuição, limites e invalidação por geometria/câmera.');
