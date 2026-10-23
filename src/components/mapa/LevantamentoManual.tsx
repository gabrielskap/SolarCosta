import { listarPlacas, type PlacaSolar } from '../../services/placas';
import React, { useEffect, useId, useRef, useState } from 'react';
import { areaPoligono, areaSuperficie, distribuir, escalaSatelite, inserirPlaca, poligonoValido, type LevantamentoTelhado, type PontoLocal } from '../../utils/levantamentoTelhado';
import { AnaliseSolar } from './AnaliseSolar';
import { aplicarSegmento } from '../../utils/analiseSolar';
import { geocodificar, imagemTelhado, type TelhadoSolar } from '../../services/solar';
import { incidenciaDireta, posicaoSolar } from '../../utils/posicaoSolar';
import { SimulacaoSolar } from './SimulacaoSolar';
import { CanvasTelhado } from './CanvasTelhado';

export function FiguraLevantamento({ dados, onPonto, onRemover, rascunho=[], imagemUrl, tokenPublico, expandido=false, onFecharContorno, interacao, centroGoogle }: {
  centroGoogle?: {latitude:number;longitude:number};
  dados: LevantamentoTelhado; onPonto?: (p:PontoLocal)=>void; onRemover?:(id:string)=>void; rascunho?:PontoLocal[];imagemUrl?:string;tokenPublico?:string;expandido?:boolean;onFecharContorno?:()=>void;interacao?:string;
}) {
  const [fundo,setFundo]=useState<string>();
  const [falha,setFalha]=useState(false);
  const sat=dados.satelite;
  useEffect(()=>{
    setFundo(undefined);setFalha(false);
    if(!sat||imagemUrl)return;
    let ativo=true,url:string|undefined;
    if(tokenPublico){setFundo(`/api/publico/documento/${encodeURIComponent(tokenPublico)}/telhado.png`);return;}
    void imagemTelhado(sat.latitude,sat.longitude,sat.zoom,sat.larguraPx,sat.alturaPx).then(r=>{
      if(!ativo){if(r.url)URL.revokeObjectURL(r.url);return;}
      url=r.url;setFundo(url);setFalha(!r.ok);
    });
    return ()=>{ativo=false;if(url)URL.revokeObjectURL(url);};
  },[sat?.latitude,sat?.longitude,sat?.zoom,sat?.larguraPx,sat?.alturaPx,imagemUrl,tokenPublico]);
  const imagem=imagemUrl||fundo||dados.imagem;
  const idFigura=useId().replace(/:/g,'');
  const sim=dados.simulacao,loc=dados.localizacao;
  const sol=sim&&loc?posicaoSolar(sim.data,sim.hora,loc.latitude,loc.longitude,sim.fuso):null;
  const sombras=sol&&sol.elevacao>0&&sim?.mostrarSombras?dados.obstaculos.flatMap(o=>{
    const comprimento=o.alturaM/Math.tan(sol.elevacao*Math.PI/180),ang=(sol.azimute-dados.norte)*Math.PI/180;
    const dx=-comprimento*Math.sin(ang),dy=comprimento*Math.cos(ang);
    const topo=o.pontos.map(p=>({x:p.x+dx,y:p.y+dy}));
    return [topo,...o.pontos.map((p,i)=>[p,o.pontos[(i+1)%o.pontos.length],topo[(i+1)%topo.length],topo[i]])];
  }):[];
  const mercatorY=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  const marcador=sat&&centroGoogle?{
    x:dados.larguraM/2+(centroGoogle.longitude-sat.longitude)/360*256*2**sat.zoom*dados.larguraM/sat.larguraPx,
    y:dados.alturaM/2-(mercatorY(centroGoogle.latitude)-mercatorY(sat.latitude))/(2*Math.PI)*256*2**sat.zoom*dados.alturaM/sat.alturaPx,
  }:undefined;
  const pontos=(p:PontoLocal[])=>p.map(v=>`${v.x},${v.y}`).join(' ');
  return <CanvasTelhado interacao={interacao} expandido={expandido} largura={dados.larguraM} altura={dados.alturaM} resetKey={sat?`${sat.latitude},${sat.longitude},${sat.zoom}`:dados.imagem} onPonto={onPonto?p=>{if(p.y<=dados.alturaM*(sat?0.94:1))onPonto(p);}:undefined}>
    <defs><pattern id={`grade-${idFigura}`} width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#cbd5e1" strokeWidth="0.02"/></pattern></defs>
    {imagem&&<image href={imagem} width={dados.larguraM} height={dados.alturaM} preserveAspectRatio="none" onError={()=>setFalha(true)}/>}
    <rect width={dados.larguraM} height={dados.alturaM} fill={`url(#grade-${idFigura})`} pointerEvents="none"/>
    {dados.aguas.map(a=><g key={a.id}><polygon points={pontos(a.pontos)} fill={sim?.mostrarIncidencia&&sol?`hsl(${220*(1-incidenciaDireta(sol.elevacao,sol.azimute,a.inclinacao,a.azimute))} 85% 50% / 0.5)`:'#38bdf833'} stroke="#0284c7" strokeWidth={Math.max(0.06,dados.larguraM/600)}/><text x={a.pontos[0].x} y={a.pontos[0].y} fontSize={dados.larguraM/55} fill="#075985">{a.nome}</text></g>)}
    {dados.obstaculos.map(o=><polygon key={o.id} points={pontos(o.pontos)} fill="#ef444466" stroke="#b91c1c" strokeWidth="0.06"/>)}
    {dados.placas.map(p=><polygon key={p.id} points={pontos(p.pontos)} fill="#1e3a8a" stroke="#93c5fd" strokeWidth="0.025" style={{cursor:onRemover?'pointer':undefined}} onClick={e=>{if(onRemover){e.stopPropagation();onRemover(p.id);}}}/>)}
    {sombras.length>0&&dados.aguas.filter(a=>a.inclinacao===0).map(a=><g key={`sombra-${a.id}`} pointerEvents="none"><defs><clipPath id={`${idFigura}-${a.id}`}><polygon points={pontos(a.pontos)}/></clipPath></defs><g clipPath={`url(#${idFigura}-${a.id})`} fill="#0f172a" fillOpacity="0.35">{sombras.map((p,i)=><polygon key={i} points={pontos(p)}/>)}</g></g>)}
    {rascunho.length>0&&<polyline points={pontos(rascunho)} fill="#fbbf2433" stroke="#d97706" strokeWidth={dados.larguraM/500}/>}
    {rascunho.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={dados.larguraM/180} fill="#d97706"/>)}
    {rascunho.length>=3&&onFecharContorno&&<circle cx={rascunho[0].x} cy={rascunho[0].y} r={dados.larguraM/120} fill="#16a34a" role="button" aria-label="Fechar contorno no primeiro ponto" tabIndex={0} style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();onFecharContorno();}} onKeyDown={e=>{if(e.key==='Enter'){e.stopPropagation();onFecharContorno();}}}/>}
    {marcador&&<g pointerEvents="none"><circle cx={marcador.x} cy={marcador.y} r={dados.larguraM/70} fill="#fbbf24" stroke="#78350f" strokeWidth={dados.larguraM/500}/><text x={marcador.x} y={marcador.y} textAnchor="middle" dominantBaseline="central" fontSize={dados.larguraM/55} fill="#451a03">G</text></g>}
    {falha&&<text x="1" y="2" fontSize="0.7" fill="#b91c1c">Imagem indisponível; geometria preservada</text>}
  </CanvasTelhado>;
}

const campo='border border-slate-300 rounded-lg px-2 py-1.5 w-full bg-white text-slate-900';
function Numero({label,value,onChange,min=0,max=500,step=0.01}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number}) {
  return <label className="text-xs text-slate-600">{label}<input className={campo} type="number" min={min} max={max} step={step} value={value} onChange={e=>{const v=e.target.valueAsNumber;if(Number.isFinite(v)&&v>=min&&v<=max)onChange(v);}}/></label>;
}

export function novoLevantamento(potenciaWp:number):LevantamentoTelhado {
  return {versao:1,origem:'manual',larguraM:30,alturaM:20,norte:0,tipologia:'Não informado',escalaConfirmada:false,aguas:[],obstaculos:[],modulo:{modelo:'Informado manualmente',larguraM:1.3,alturaM:2.38,potenciaWp},espacamentoM:0.03,recuoM:0.3,placas:[]};
}

export function LevantamentoManual({valor,potenciaWp,hsp,perdasPct,alvo,onAplicar,onCancelar,enderecoBusca='',coordenadaInicial,googleAtivo=true}:{
  valor?:LevantamentoTelhado;potenciaWp:number;hsp:number;perdasPct:number;alvo:number;onAplicar:(l:LevantamentoTelhado)=>void;onCancelar:()=>void;enderecoBusca?:string;coordenadaInicial?:{latitude:number;longitude:number};googleAtivo?:boolean;
}) {
  const [d,setD]=useState<LevantamentoTelhado>(()=>structuredClone(valor??novoLevantamento(potenciaWp)));
  const chaveSolar=JSON.stringify([d.satelite,d.localizacao]);
  const [analise,setAnalise]=useState<{chave:string;telhado?:TelhadoSolar}>();
  const [catalogo,setCatalogo]=useState<PlacaSolar[]>([]);
  const [erroCatalogo,setErroCatalogo]=useState('');
  const [carregandoCatalogo,setCarregandoCatalogo]=useState(true);
  useEffect(()=>{let ativo=true;listarPlacas().then(p=>{if(ativo)setCatalogo(p);}).catch(e=>{if(ativo)setErroCatalogo(e instanceof Error?e.message:'Falha ao carregar placas.');}).finally(()=>{if(ativo)setCarregandoCatalogo(false);});return()=>{ativo=false;};},[]);
  const [consulta,setConsulta]=useState(valor?.localizacao?.endereco||enderecoBusca);
  const [latBusca,setLatBusca]=useState(String(valor?.localizacao?.latitude??coordenadaInicial?.latitude??''));
  const [lngBusca,setLngBusca]=useState(String(valor?.localizacao?.longitude??coordenadaInicial?.longitude??''));
  const [zoomBusca,setZoomBusca]=useState(valor?.satelite?.zoom??20);
  const [imagemSatelite,setImagemSatelite]=useState<string>();
  const [confirmarTroca,setConfirmarTroca]=useState(false);
  const imagemAtual=useRef<string | undefined>(undefined);
  const rodada=useRef(0);
  useEffect(()=>()=>{rodada.current++;if(imagemAtual.current)URL.revokeObjectURL(imagemAtual.current);},[]);
  const [ferramenta,setFerramenta]=useState<'agua'|'obstaculo'|'placa'|'remover'|'calibrar'>('agua');
  const [revisaoFerramenta,setRevisaoFerramenta]=useState(0);
  const [aba,setAba]=useState<'telhado'|'modulos'|'imagem'|'dados'>('telhado');
  const [aguaSelecionada,setAguaSelecionada]=useState('');
  const [obstaculoSelecionado,setObstaculoSelecionado]=useState('');
  const [solAberto,setSolAberto]=useState(false);
  const [rascunho,setRascunho]=useState<PontoLocal[]>([]);
  const [erro,setErro]=useState('');
  const [paisagem,setPaisagem]=useState(false);
  const [qtd,setQtd]=useState(alvo||20);
  const [distancia,setDistancia]=useState(10);
  const [carregando,setCarregando]=useState(false);
  const [historico,setHistorico]=useState<LevantamentoTelhado[]>([]);
  const atualizar=(patch:Partial<LevantamentoTelhado>,limpar=true)=>{setHistorico(h=>[...h.slice(-29),structuredClone(d)]);setD(atual=>({...atual,...patch,...(limpar?{placas:[]}: {})}));setErro('');setConfirmarTroca(false);};
  const buscarSatelite=async(porCoordenadas=false)=>{
    if(carregando)return;
    if(!googleAtivo){setErro('A integração Google está desativada. Use imagem própria ou configure a chave no servidor.');return;}
    if((d.aguas.length||d.obstaculos.length)&&!confirmarTroca){setConfirmarTroca(true);setErro('Trocar a imagem reinicia contornos e módulos. Clique novamente em Buscar Via Satélite para confirmar ou continue editando para manter o desenho.');return;}
    setCarregando(true);setErro('');const turno=++rodada.current;
    let url:string|undefined;
    try {
      let latitude:number,longitude:number,endereco=consulta;
      if(porCoordenadas){
        latitude=Number(latBusca.replace(',','.'));longitude=Number(lngBusca.replace(',','.'));
        if(!latBusca.trim()||!lngBusca.trim()||!Number.isFinite(latitude)||Math.abs(latitude)>85||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new Error('Informe latitude (-85 a 85) e longitude (-180 a 180) válidas.');
      }else{
        if(consulta.trim().length<5)throw new Error('Informe o endereço completo com número e cidade, ou busque pelas coordenadas.');
        const r=await geocodificar(consulta.trim());
        if(turno!==rodada.current)return;
        if(!r.ok||!r.endereco)throw new Error(r.erro||'Endereço não localizado.');
        latitude=r.endereco.latitude;longitude=r.endereco.longitude;endereco=r.endereco.enderecoFormatado;
        if(!r.endereco.confiavel)setErro('Localização aproximada. Confira se a imagem corresponde ao imóvel e ajuste as coordenadas se necessário.');
      }
      const img=await imagemTelhado(latitude,longitude,zoomBusca,640,640);url=img.url;
      if(turno!==rodada.current){if(url)URL.revokeObjectURL(url);return;}
      if(!img.ok||!url)throw new Error(img.erro||'Não foi possível carregar a imagem.');
      if(imagemAtual.current)URL.revokeObjectURL(imagemAtual.current);
      imagemAtual.current=url;setImagemSatelite(url);
      const escala=escalaSatelite(latitude,zoomBusca);
      setHistorico([]);setRascunho([]);setConfirmarTroca(false);
      setLatBusca(String(latitude));setLngBusca(String(longitude));
      setD({...d,...escala,norte:0,imagem:undefined,imagemNome:undefined,dataImagem:undefined,aguas:[],obstaculos:[],placas:[],escalaConfirmada:true,
        localizacao:{latitude,longitude,endereco},satelite:{latitude,longitude,zoom:zoomBusca,larguraPx:640,alturaPx:640}});
    }catch(e){if(turno===rodada.current)setErro(e instanceof Error?e.message:'Falha ao buscar a imagem.');}
    finally{if(turno===rodada.current)setCarregando(false);}
  };
  const fecharPoligono=()=>{
    if(!poligonoValido(rascunho)){setErro('Desenhe pelo menos três pontos, sem cruzar as bordas.');return;}
    const id=crypto.randomUUID();
    if(ferramenta==='agua'){atualizar({aguas:[...d.aguas,{id,nome:`Água ${d.aguas.length+1}`,pontos:rascunho,inclinacao:0,azimute:0}]});setAguaSelecionada(id);}
    if(ferramenta==='obstaculo'){atualizar({obstaculos:[...d.obstaculos,{id,pontos:rascunho,alturaM:1}]});setObstaculoSelecionado(id);}
    setAba('telhado');
    setRascunho([]);
  };
  const importar=async(file?:File)=>{
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setErro('Use JPG, PNG ou WebP de até 10 MB.');return;}
    setCarregando(true);
    try {
      const bitmap=await createImageBitmap(file);
      const canvas=document.createElement('canvas');const escala=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.round(bitmap.width*escala);canvas.height=Math.round(bitmap.height*escala);
      canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      let imagem=canvas.toDataURL('image/jpeg',0.75);
      if(imagem.length>450000)imagem=canvas.toDataURL('image/jpeg',0.4);
      if(imagem.length>450000)throw new Error('A imagem é muito detalhada. Reduza a resolução e tente novamente.');
      atualizar({imagem,imagemNome:file.name,satelite:undefined,alturaM:d.larguraM*canvas.height/canvas.width,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);setImagemSatelite(undefined);
      if(imagemAtual.current){URL.revokeObjectURL(imagemAtual.current);imagemAtual.current=undefined;}
    } catch(e){setErro(e instanceof Error?e.message:'Não foi possível abrir a imagem.');}
    finally{setCarregando(false);}
  };
  const calibrar=()=>{
    if(rascunho.length!==2||distancia<=0)return;
    const medido=Math.hypot(rascunho[0].x-rascunho[1].x,rascunho[0].y-rascunho[1].y);
    if(medido<0.01){setErro('Selecione dois pontos diferentes.');return;}
    const f=distancia/medido;
    if(d.larguraM*f>500||d.alturaM*f>500||d.larguraM*f<1||d.alturaM*f<1){setErro('A escala deve resultar em uma planta entre 1 e 500 metros.');return;}
    const escalar=(p:PontoLocal)=>({x:p.x*f,y:p.y*f});
    atualizar({larguraM:d.larguraM*f,alturaM:d.alturaM*f,aguas:d.aguas.map(a=>({...a,pontos:a.pontos.map(escalar)})),obstaculos:d.obstaculos.map(o=>({...o,pontos:o.pontos.map(escalar)})),escalaConfirmada:true});setRascunho([]);
  };
  const gerar=()=>{
    if(!d.modulo.produtoId&&!valor){setErro('Selecione uma placa cadastrada na aba Placas.');setAba('modulos');return;}
    if(!d.escalaConfirmada||!d.aguas.length){setErro('Confirme a escala e desenhe uma água antes de distribuir.');return;}
    const placas=distribuir(d,qtd,paisagem);atualizar({placas},false);
    if(placas.length<qtd)setErro(`Foram posicionados ${placas.length} dos ${qtd} módulos solicitados, respeitando contornos e recuos.`);
  };
  const potencia=d.placas.length*d.modulo.potenciaWp/1000;
  const mensal=potencia*hsp*30*(1-perdasPct/100);
  const agua=d.aguas.find(a=>a.id===aguaSelecionada)??d.aguas[0];
  const obstaculo=d.obstaculos.find(o=>o.id===obstaculoSelecionado)??d.obstaculos[0];
  const areaRascunho=rascunho.length>=3?areaPoligono(rascunho):0;
  const editarAgua=(patch:Partial<typeof agua>)=>{if(agua)atualizar({aguas:d.aguas.map(a=>a.id===agua.id?{...a,...patch}:a)});};
  const pontoNoMapa=(p:PontoLocal)=>{
    setConfirmarTroca(false);
    if(ferramenta==='placa'){
      if(!d.escalaConfirmada){setErro('Informe uma escala em metros na aba Dados ou busque a imagem por satélite.');setAba('dados');return;}
      const placa=inserirPlaca(d,p,paisagem);
      if(!placa){setErro('A placa precisa ficar inteira dentro de uma água, sem sobrepor outras placas, obstáculos ou recuos.');return;}
      atualizar({placas:[...d.placas,placa]},false);return;
    }
    if(ferramenta==='agua'||ferramenta==='obstaculo')setRascunho(r=>[...r,p]);
    if(ferramenta==='calibrar')setRascunho(r=>r.length>=2?[p]:[...r,p]);
  };
  const instrucao=ferramenta==='placa'?'Clique dentro de uma água para inserir um módulo.':ferramenta==='calibrar'?'Marque dois pontos de uma distância conhecida.':ferramenta==='remover'?'Clique na placa que deseja remover.':'Marque os vértices; feche pelo primeiro ponto verde ou pelo botão Concluir.';
  return <div className="fixed inset-0 z-[70] bg-slate-950/70 md:p-2" role="dialog" aria-modal="true" aria-label="Levantamento do telhado" onKeyDown={e=>{if(e.key==='Escape')onCancelar();}}>
    <div className="bg-white md:rounded-xl w-full h-[100dvh] md:h-[calc(100dvh-16px)] flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b">
        <div><h2 className="font-bold text-lg text-slate-900">Levantamento do telhado</h2><p className="text-xs text-slate-500">Medição, módulos e luz solar sobre a mesma imagem.</p></div>
        <button type="button" onClick={onCancelar} className="rounded-lg border px-3 py-2 text-sm">Fechar</button>
      </header>
      <div className="shrink-0 flex flex-wrap items-end gap-2 px-3 py-2 border-b bg-slate-50">
        <label className="flex-1 min-w-40 text-xs">Endereço do imóvel<input className={campo} value={consulta} maxLength={300} onChange={e=>{setConsulta(e.target.value);setConfirmarTroca(false);}} placeholder="Rua, número, bairro, cidade e UF"/></label>
        <label className="text-xs">Enquadramento<select className={campo} value={zoomBusca} onChange={e=>{setZoomBusca(Number(e.target.value));setConfirmarTroca(false);}}><option value={18}>Amplo</option><option value={19}>Intermediário</option><option value={20}>Detalhado</option></select></label>
        <button type="button" disabled={carregando} className="rounded-lg bg-[#004276] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-[#003159]" onClick={()=>void buscarSatelite()}>{carregando?'Carregando…':'Buscar Via Satélite'}</button>
      </div>
      <div className="flex-1 min-h-0 grid grid-rows-[minmax(180px,1fr)_minmax(0,30dvh)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-h-0 min-w-0 flex flex-col gap-2 p-2 bg-slate-50">
          <div className="shrink-0 flex flex-wrap gap-1.5 items-center">
            {(['agua','obstaculo','placa','remover','calibrar'] as const).map(t=><button type="button" key={t} aria-pressed={ferramenta===t} onClick={()=>{setFerramenta(t);setRevisaoFerramenta(v=>v+1);setRascunho([]);if(t==='placa')setAba('modulos');}} className={`px-2 py-1.5 rounded-lg text-xs font-bold ${ferramenta===t?'bg-sky-800 text-white':'bg-white border text-slate-700'}`}>{({agua:'Desenhar água',obstaculo:'Obstáculo',placa:'Inserir placa',remover:'Remover placa',calibrar:'Calibrar'})[t]}</button>)}
            {(ferramenta==='agua'||ferramenta==='obstaculo')&&<button type="button" className="border rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-40" onClick={fecharPoligono} disabled={rascunho.length<3}>Concluir contorno</button>}
            <button type="button" className="border rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-40" disabled={!historico.length} onClick={()=>{setD(historico[historico.length-1]);setHistorico(h=>h.slice(0,-1));setRascunho([]);}}>Desfazer</button>
            <button type="button" aria-pressed={solAberto} className={`border rounded-lg px-2 py-1.5 text-xs font-bold ${solAberto?'bg-amber-200':'bg-white'}`} onClick={()=>setSolAberto(v=>!v)}>Luz solar</button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <FiguraLevantamento centroGoogle={analise?.chave===chaveSolar?analise.telhado?.centro:undefined} expandido interacao={`${ferramenta}-${revisaoFerramenta}`} dados={d} imagemUrl={d.satelite?imagemSatelite:undefined} rascunho={rascunho} onPonto={pontoNoMapa} onFecharContorno={ferramenta==='agua'||ferramenta==='obstaculo'?fecharPoligono:undefined} onRemover={ferramenta==='remover'?id=>atualizar({placas:d.placas.filter(p=>p.id!==id)},false):undefined}/>
            {solAberto&&<div className="absolute bottom-2 right-2 z-10 w-[min(300px,calc(100%-16px))] max-h-[calc(100%-56px)] overflow-auto shadow-xl rounded-xl"><SimulacaoSolar compact dados={d} onChange={patch=>{setD(atual=>({...atual,...patch}));setConfirmarTroca(false);}}/></div>}
          </div>
          <div className="shrink-0 flex flex-wrap gap-2 items-center text-xs text-slate-600">
            <p className="flex-1 min-w-40">{instrucao}</p>
            {rascunho.length>0&&<><span>{rascunho.length} pontos · {areaRascunho.toFixed(2)} m² em desenho</span><button type="button" className="underline" onClick={()=>setRascunho(r=>r.slice(0,-1))}>Retirar ponto</button></>}
            {ferramenta==='calibrar'&&<><label>Distância (m)<input type="number" min={0.1} step={0.1} className="border rounded w-20 px-1" value={distancia} onChange={e=>{if(e.target.valueAsNumber>0)setDistancia(e.target.valueAsNumber);}}/></label><button type="button" className="bg-sky-100 rounded px-2 py-1 disabled:opacity-40" disabled={rascunho.length!==2} onClick={calibrar}>Aplicar escala</button></>}
          </div>
        </main>
        <aside className="min-h-0 flex flex-col border-t md:border-t-0 md:border-l bg-white">
          <div className="shrink-0 grid grid-cols-4 text-xs border-b" role="tablist" aria-label="Ajustes do levantamento">{(['telhado','modulos','imagem','dados'] as const).map(t=><button type="button" key={t} role="tab" aria-selected={aba===t} onClick={()=>setAba(t)} className={`px-1 py-3 font-bold ${aba===t?'text-[#004276] bg-sky-50 border-b-2 border-[#004276]':'text-slate-500'}`}>{({telhado:'Telhado',modulos:'Placas',imagem:'Imagem',dados:'Dados'})[t]}</button>)}</div>
          <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3 text-sm" role="tabpanel">
            <div hidden={aba!=='telhado'}>
              <AnaliseSolar key={chaveSolar} dados={d} agua={agua} ativo={googleAtivo} onResultado={telhado=>setAnalise({chave:chaveSolar,telhado})} onAplicar={segmento=>{if(agua)atualizar(aplicarSegmento(d,agua.id,segmento),false);}}/>
            </div>
            {aba==='telhado'&&<>
              <div className="bg-sky-50 rounded-lg p-3"><p className="text-xs text-slate-600">Área total de superfície</p><strong className="text-xl text-[#004276]">{areaSuperficie(d).toFixed(2)} m²</strong><p className="text-xs text-slate-500">Calculada ao fechar os pontos; corrigida pela inclinação informada.</p></div>
              {d.aguas.length?<><label className="block text-xs">Água selecionada<select className={campo} value={agua?.id??''} onChange={e=>setAguaSelecionada(e.target.value)}>{d.aguas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
                {agua&&<><div className="grid grid-cols-2 gap-2"><Numero label="Inclinação (°)" max={75} value={agua.inclinacao} onChange={v=>editarAgua({inclinacao:v})}/><Numero label="Azimute (0° norte)" max={359.99} value={agua.azimute} onChange={v=>editarAgua({azimute:v})}/></div><p className="text-xs text-slate-600">Em planta: {areaPoligono(agua.pontos).toFixed(2)} m² · {d.placas.filter(p=>p.aguaId===agua.id).length} placas</p><button type="button" className="text-xs text-red-700 underline" onClick={()=>atualizar({aguas:d.aguas.filter(a=>a.id!==agua.id)})}>Excluir água selecionada</button></>}
              </>:<p className="text-xs text-slate-600">Escolha Desenhar água, marque os vértices e conclua o contorno. A escala do mapa será usada automaticamente.</p>}
              {obstaculo&&<><label className="block text-xs">Obstáculo<select className={campo} value={obstaculo.id} onChange={e=>setObstaculoSelecionado(e.target.value)}>{d.obstaculos.map((o,i)=><option key={o.id} value={o.id}>Obstáculo {i+1}</option>)}</select></label><Numero label="Altura acima do telhado (m)" max={100} value={obstaculo.alturaM} onChange={v=>atualizar({obstaculos:d.obstaculos.map(o=>o.id===obstaculo.id?{...o,alturaM:v}:o)},false)}/><button type="button" className="text-xs text-red-700 underline" onClick={()=>atualizar({obstaculos:d.obstaculos.filter(o=>o.id!==obstaculo.id)})}>Excluir obstáculo</button></>}
            </>}
            {aba==='modulos'&&<>
              <label className="block text-xs">Placa cadastrada<select className={campo} value={d.modulo.placaId??d.modulo.produtoId??''} disabled={carregandoCatalogo} onChange={e=>{const p=catalogo.find(p=>p.id===e.target.value&&p.ativo&&p.disponivel!==false);if(!p)return;atualizar({modulo:{placaId:p.id,produtoId:p.produtoId??undefined,modelo:(p.fabricante+' '+p.modelo).slice(0,200),larguraM:p.larguraM,alturaM:p.alturaM,potenciaWp:p.potenciaWp,pesoKg:p.pesoKg}});}}>
                <option value="" disabled>{carregandoCatalogo?'Carregando placas…':'Selecione uma placa'}</option>
                {d.modulo.produtoId&&!catalogo.some(p=>p.id===(d.modulo.placaId??d.modulo.produtoId)&&p.ativo&&p.disponivel!==false)&&<option value={d.modulo.placaId??d.modulo.produtoId}>{d.modulo.modelo} (dados salvos)</option>}
                {catalogo.filter(p=>p.ativo&&p.disponivel!==false).map(p=><option key={p.id} value={p.id}>{p.fabricante} {p.modelo} · {p.potenciaWp} Wp</option>)}
              </select></label>
              {erroCatalogo&&<p role="alert" className="text-xs text-red-700">{erroCatalogo}</p>}
              {!carregandoCatalogo&&!erroCatalogo&&!catalogo.some(p=>p.ativo&&p.disponivel!==false)&&<p className="text-xs text-amber-700">Cadastre uma placa ativa em Parâmetros → Placas.</p>}
              <p className="text-xs text-slate-600">{d.modulo.produtoId||valor ? <>{d.modulo.modelo} · {d.modulo.potenciaWp} Wp · {d.modulo.larguraM} × {d.modulo.alturaM} m · {d.modulo.pesoKg??'—'} kg</> : 'Selecione o modelo para preencher as informações técnicas.'}</p>
              {valor&&!d.modulo.produtoId&&<p className="text-xs text-amber-700">Dados anteriores preservados. Selecione uma placa cadastrada para substituir.</p>}
              <div className="grid grid-cols-2 gap-2"><Numero label="Recuo (m)" max={10} value={d.recuoM} onChange={v=>atualizar({recuoM:v})}/><Numero label="Entre placas (m)" max={5} value={d.espacamentoM} onChange={v=>atualizar({espacamentoM:v})}/></div>
              <p className="text-xs text-slate-500">Trocar a placa remove a distribuição atual. Redistribua os módulos após selecionar outro modelo.</p>
              <Numero label="Quantidade para distribuir" min={1} max={2000} step={1} value={qtd} onChange={v=>setQtd(Math.floor(v))}/>
              <label className="flex gap-2 text-xs"><input type="checkbox" checked={paisagem} onChange={e=>setPaisagem(e.target.checked)}/>Orientação paisagem</label>
              <div className="grid grid-cols-2 gap-2"><button type="button" className="bg-[#004276] text-white rounded-lg p-2 font-bold text-xs" onClick={()=>{if(!d.modulo.produtoId&&!valor){setErro('Selecione uma placa cadastrada na aba Placas.');return;}setFerramenta('placa');setRevisaoFerramenta(v=>v+1);setRascunho([]);}}>Inserir por clique</button><button type="button" className="bg-slate-800 text-white rounded-lg p-2 font-bold text-xs" onClick={gerar}>Distribuir placas</button></div>
              <p className="text-xs text-slate-500">Dimensões do datasheet. Inclusão respeita contornos, obstáculos e recuos; a distribuição substitui as placas atuais.</p>
            </>}
            {aba==='imagem'&&<>
              <label className="block text-xs">Imagem própria (até 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full mt-1" disabled={carregando} onChange={e=>{void importar(e.target.files?.[0]);e.target.value='';}}/></label>
              <p className="text-xs text-slate-500">{d.satelite?'Google Static Maps, até 1280 × 1280 px. Ampliar com zoom não acrescenta detalhes à imagem.':d.imagemNome||'Imagem própria ou planta em metros.'}</p>
              <label className="block text-xs">Latitude<input className={campo} value={latBusca} onChange={e=>{setLatBusca(e.target.value);setConfirmarTroca(false);}}/></label><label className="block text-xs">Longitude<input className={campo} value={lngBusca} onChange={e=>{setLngBusca(e.target.value);setConfirmarTroca(false);}}/></label>
              <button type="button" disabled={carregando} className="w-full bg-sky-100 rounded-lg p-2 text-xs font-bold" onClick={()=>void buscarSatelite(true)}>Carregar coordenadas</button>
              <p className="text-xs text-slate-500">Consultas Google podem gerar consumo. Trocar a imagem reinicia o desenho; a data de captura só é conhecida quando informada.</p>
            </>}
            {aba==='dados'&&<>
              <div className="grid grid-cols-2 gap-2"><Numero label="Largura da planta (m)" value={d.larguraM} min={1} onChange={v=>{atualizar({larguraM:v,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);}}/><Numero label="Altura da planta (m)" value={d.alturaM} min={1} onChange={v=>{atualizar({alturaM:v,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);}}/></div>
              {d.satelite&&d.escalaConfirmada?<p className="text-xs bg-sky-50 p-2 rounded text-sky-900">Escala automática da projeção do mapa. Medidas aproximadas ao nível do solo; calibre com uma distância conhecida para conferir.</p>:<label className="flex gap-2 text-xs"><input type="checkbox" checked={d.escalaConfirmada} onChange={e=>atualizar({escalaConfirmada:e.target.checked},false)}/>Usar estas dimensões como escala em metros</label>}
              <Numero label="Norte: graus desde o topo" value={d.norte} max={359.99} onChange={v=>atualizar({norte:v})}/>
              <label className="block text-xs">Tipologia<select className={campo} value={d.tipologia} onChange={e=>atualizar({tipologia:e.target.value},false)}>{['Não informado','Plano','Meia água','Duas águas','Quatro águas','Outro'].map(t=><option key={t}>{t}</option>)}</select></label>
              <label className="block text-xs">Ano de construção<input className={campo} type="number" min="1500" max={new Date().getFullYear()} value={d.anoConstrucao??''} onChange={e=>atualizar({anoConstrucao:e.target.value?Number(e.target.value):undefined},false)}/></label>
              <label className="block text-xs">Data de captura conhecida<input className={campo} type="date" value={d.dataImagem??''} onChange={e=>atualizar({dataImagem:e.target.value||undefined},false)}/></label>
            </>}
          </div>
        </aside>
      </div>
      {erro&&<div role="alert" className="shrink-0 text-xs text-amber-900 bg-amber-50 px-3 py-2 border-t">{erro}{confirmarTroca&&<button type="button" className="ml-2 underline" onClick={()=>{setConfirmarTroca(false);setErro('');}}>Manter desenho atual</button>}</div>}
      <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 bg-white">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700"><strong>{d.placas.length} placas · {potencia.toFixed(2)} kWp</strong><span>{areaSuperficie(d).toFixed(2)} m² de telhado</span><span>{Math.round(mensal)} kWh/mês (HSP)</span></div>
        <button type="button" disabled={carregando||!d.escalaConfirmada||!d.aguas.length||!d.placas.length} className="bg-[#004276] disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-bold" onClick={()=>{if(!d.modulo.produtoId&&!valor){setErro('Selecione uma placa cadastrada na aba Placas.');setAba('modulos');return;}onAplicar(d);}}>Aplicar levantamento</button>
      </footer>
    </div>
  </div>;
}
