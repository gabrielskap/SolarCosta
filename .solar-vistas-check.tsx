import React from 'react';
import {createRoot} from 'react-dom/client';
import './src/index.css';
import {LevantamentoManual,novoLevantamento} from './src/components/mapa/LevantamentoManual';
const imagem='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#cbd5e1"/><path d="M100 100H540V540H100Z M100 100L540 540M540 100L100 540" fill="#94a3b8" stroke="#334155" stroke-width="5"/><text x="180" y="320" font-size="25">TELHADO DE TESTE</text></svg>');
class FakeMap { constructor(host,opts){this.host=host;this.opts=opts;host.innerHTML='<div style="height:100%;display:grid;place-items:center;background:#b9d6c5">SDK SIMULADO: SATELITE</div>';} setCenter(c){this.host.dataset.center=JSON.stringify(c);} setZoom(z){} }
class Fake3D extends HTMLElement {constructor(opts){super();this.opts=opts;this.dataset.options=JSON.stringify(opts);} connectedCallback(){this.textContent='SDK SIMULADO: VISTA 3D';this.style.background='#b9cddd';this.style.display='grid';this.style.placeItems='center';setTimeout(()=>{const e=new Event('gmp-steadychange');Object.assign(e,{isSteady:true});this.dispatchEvent(e);},30);}}
customElements.define('test-map-3d',Fake3D);
window.google={maps:{Map:FakeMap,event:{addListenerOnce:(m,n,cb)=>{setTimeout(cb,30);return {remove(){}};},clearInstanceListeners(){}},importLibrary:async name=>name==='maps3d'?{Map3DElement:Fake3D}:{ElevationService:class{async getElevationForLocations(){return {results:[{elevation:850}]};}}}}};
const d={...novoLevantamento(500),imagem,escalaConfirmada:true,localizacao:{latitude:-19.85,longitude:-43.97},aguas:[{id:crypto.randomUUID(),nome:'Agua preservada',pontos:[{x:5,y:5},{x:20,y:5},{x:20,y:15},{x:5,y:15}],inclinacao:20,azimute:0}]};
createRoot(document.getElementById('root')).render(<LevantamentoManual valor={d} potenciaWp={500} hsp={5} perdasPct={15} alvo={10} chaveMaps={new URLSearchParams(location.search).has('sem-chave')?null:'teste-sdk-simulado'} onAplicar={()=>{}} onCancelar={()=>{}}/>);
