// Harness temporário. APIs simuladas somente nesta página, sem credenciais ou consumo.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LevantamentoManual} from './components/mapa/LevantamentoManual';
import './index.css';
const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1280;
const ctx=canvas.getContext('2d')!;ctx.fillStyle='#cbd5c1';ctx.fillRect(0,0,1280,1280);ctx.fillStyle='#a5a398';ctx.fillRect(330,300,600,520);ctx.strokeStyle='#77756c';for(let i=300;i<820;i+=20){ctx.beginPath();ctx.moveTo(330,i);ctx.lineTo(930,i);ctx.stroke();}ctx.fillStyle='#fff';ctx.fillRect(0,1180,1280,100);ctx.fillStyle='#334155';ctx.font='30px sans-serif';ctx.fillText('IMAGEM DE TESTE — NÃO É SATÉLITE',30,1235);
const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
const original=window.fetch.bind(window);
window.fetch=async(input,init)=>{const url=String(input);if(url.includes('/api/solar/geocodificar'))return new Response(JSON.stringify({endereco:{latitude:-19.9,longitude:-43.9,enderecoFormatado:'Endereço de teste',placeId:'teste',confiavel:true,precisao:'ROOFTOP'}}),{headers:{'Content-Type':'application/json'}});if(url.includes('/api/solar/imagem'))return new Response(blob,{headers:{'Content-Type':'image/png'}});return original(input,init);};
createRoot(document.getElementById('root')!).render(<LevantamentoManual enderecoBusca="Endereço de teste" potenciaWp={710} hsp={5.2} perdasPct={24.5} alvo={20} onAplicar={l=>{document.title=`Aplicado: ${l.placas.length} módulos`;}} onCancelar={()=>{}}/>);
