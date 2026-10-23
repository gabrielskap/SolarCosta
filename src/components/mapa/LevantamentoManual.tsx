import React, { useRef, useState } from 'react';
import { areaPoligono, areaSuperficie, distribuir, poligonoValido, type LevantamentoTelhado, type PontoLocal } from '../../utils/levantamentoTelhado';

export function FiguraLevantamento({ dados, onPonto, onRemover, rascunho=[] }: {
  dados: LevantamentoTelhado; onPonto?: (p:PontoLocal)=>void; onRemover?:(id:string)=>void; rascunho?:PontoLocal[];
}) {
  const ref=useRef<SVGSVGElement>(null);
  const pontos=(p:PontoLocal[])=>p.map(v=>`${v.x},${v.y}`).join(' ');
  return <svg ref={ref} viewBox={`0 0 ${dados.larguraM} ${dados.alturaM}`} role="img" aria-label="Planta do telhado em metros" className="w-full rounded-lg bg-slate-100 border border-slate-300 max-h-[560px]" style={{aspectRatio:`${dados.larguraM}/${dados.alturaM}`,touchAction:'manipulation'}} onClick={e=>{
    if(!onPonto||!ref.current) return;
    const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(ref.current.getScreenCTM()!.inverse());
    if(point.x>=0&&point.y>=0&&point.x<=dados.larguraM&&point.y<=dados.alturaM) onPonto({x:point.x,y:point.y});
  }}>
    <defs><pattern id="grade-telhado-manual" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#cbd5e1" strokeWidth="0.02"/></pattern></defs>
    {dados.imagem&&<image href={dados.imagem} width={dados.larguraM} height={dados.alturaM} preserveAspectRatio="none"/>}
    <rect width={dados.larguraM} height={dados.alturaM} fill="url(#grade-telhado-manual)" pointerEvents="none"/>
    {dados.aguas.map(a=><g key={a.id}><polygon points={pontos(a.pontos)} fill="#38bdf833" stroke="#0284c7" strokeWidth="0.06"/><text x={a.pontos[0].x} y={a.pontos[0].y} fontSize="0.55" fill="#075985">{a.nome}</text></g>)}
    {dados.obstaculos.map(o=><polygon key={o.id} points={pontos(o.pontos)} fill="#ef444466" stroke="#b91c1c" strokeWidth="0.06"/>)}
    {dados.placas.map(p=><polygon key={p.id} points={pontos(p.pontos)} fill="#1e3a8a" stroke="#93c5fd" strokeWidth="0.025" style={{cursor:onRemover?'pointer':undefined}} onClick={e=>{if(onRemover){e.stopPropagation();onRemover(p.id);}}}/>)}
    {rascunho.length>0&&<polyline points={pontos(rascunho)} fill="#fbbf2433" stroke="#d97706" strokeWidth="0.08"/>}
    {rascunho.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="0.12" fill="#d97706"/>)}
  </svg>;
}

const campo='border border-slate-300 rounded-lg px-2 py-1.5 w-full bg-white text-slate-900';
function Numero({label,value,onChange,min=0,max=500,step=0.01}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number}) {
  return <label className="text-xs text-slate-600">{label}<input className={campo} type="number" min={min} max={max} step={step} value={value} onChange={e=>{const v=e.target.valueAsNumber;if(Number.isFinite(v)&&v>=min&&v<=max)onChange(v);}}/></label>;
}

export function novoLevantamento(potenciaWp:number):LevantamentoTelhado {
  return {versao:1,origem:'manual',larguraM:30,alturaM:20,norte:0,tipologia:'Não informado',escalaConfirmada:false,aguas:[],obstaculos:[],modulo:{modelo:'Informado manualmente',larguraM:1.3,alturaM:2.38,potenciaWp},espacamentoM:0.03,recuoM:0.3,placas:[]};
}

export function LevantamentoManual({valor,potenciaWp,hsp,perdasPct,alvo,onAplicar,onCancelar,painelSatelite}:{
  valor?:LevantamentoTelhado;potenciaWp:number;hsp:number;perdasPct:number;alvo:number;onAplicar:(l:LevantamentoTelhado)=>void;onCancelar:()=>void;painelSatelite?:React.ReactNode;
}) {
  const [modoSatelite,setModoSatelite]=useState(false);
  const [d,setD]=useState<LevantamentoTelhado>(()=>structuredClone(valor??novoLevantamento(potenciaWp)));
  const [ferramenta,setFerramenta]=useState<'agua'|'obstaculo'|'remover'|'calibrar'>('agua');
  const [rascunho,setRascunho]=useState<PontoLocal[]>([]);
  const [erro,setErro]=useState('');
  const [paisagem,setPaisagem]=useState(false);
  const [qtd,setQtd]=useState(alvo||20);
  const [distancia,setDistancia]=useState(10);
  const [carregando,setCarregando]=useState(false);
  const [historico,setHistorico]=useState<LevantamentoTelhado[]>([]);
  const atualizar=(patch:Partial<LevantamentoTelhado>,limpar=true)=>{setHistorico(h=>[...h.slice(-29),structuredClone(d)]);setD({...d,...patch,...(limpar?{placas:[]}: {})});setErro('');};
  const fecharPoligono=()=>{
    if(!poligonoValido(rascunho)){setErro('Desenhe pelo menos três pontos, sem cruzar as bordas.');return;}
    if(ferramenta==='agua') atualizar({aguas:[...d.aguas,{id:crypto.randomUUID(),nome:`Água ${d.aguas.length+1}`,pontos:rascunho,inclinacao:0,azimute:0}]});
    if(ferramenta==='obstaculo') atualizar({obstaculos:[...d.obstaculos,{id:crypto.randomUUID(),pontos:rascunho,alturaM:1}]});
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
      atualizar({imagem,imagemNome:file.name,alturaM:d.larguraM*canvas.height/canvas.width,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);
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
    if(!d.escalaConfirmada||!d.aguas.length){setErro('Confirme a escala e desenhe uma água antes de distribuir.');return;}
    const placas=distribuir(d,qtd,paisagem);atualizar({placas},false);
    if(placas.length<qtd)setErro(`Foram posicionados ${placas.length} dos ${qtd} módulos solicitados, respeitando contornos e recuos.`);
  };
  const potencia=d.placas.length*d.modulo.potenciaWp/1000;
  const mensal=potencia*hsp*30*(1-perdasPct/100);
  return <div className="fixed inset-0 z-[70] bg-slate-950/70 flex items-center justify-center p-2 md:p-6" role="dialog" aria-modal="true" aria-label="Levantamento do telhado" onKeyDown={e=>{if(e.key==='Escape')onCancelar();}}>
    <div className="bg-white rounded-2xl w-full max-w-7xl max-h-full overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex justify-between gap-4"><div><h2 className="font-bold text-lg text-slate-900">Levantamento do telhado</h2><p className="text-xs text-slate-600">Use imagem aérea/ortofoto autorizada, desenhe sobre a grade ou escolha a integração Google.</p></div><button type="button" onClick={onCancelar} className="font-bold">Cancelar</button></div>
      {painelSatelite&&<button type="button" className="inline-flex items-center justify-center rounded-lg bg-[#004276] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#003159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004276]" onClick={()=>setModoSatelite(v=>!v)}>{modoSatelite?'Voltar ao desenho':'Buscar Via Satélite'}</button>}
      {modoSatelite&&<section aria-label="Busca via satélite" className="space-y-3">{painelSatelite}<div className="flex justify-end"><button type="button" className="rounded-lg bg-[#004276] text-white px-4 py-2 font-bold" onClick={onCancelar}>Concluir e voltar à proposta</button></div></section>}
      <div className={modoSatelite?'hidden':'grid lg:grid-cols-[1fr_320px] gap-5'}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{(['agua','obstaculo','remover','calibrar'] as const).map(t=><button type="button" key={t} onClick={()=>{setFerramenta(t);setRascunho([]);}} className={`px-3 py-2 rounded-lg text-xs font-bold ${ferramenta===t?'bg-sky-800 text-white':'bg-slate-100 text-slate-700'}`}>{({agua:'Desenhar água',obstaculo:'Obstáculo',remover:'Remover módulo',calibrar:'Calibrar escala'})[t]}</button>)}</div>
          <FiguraLevantamento dados={d} rascunho={rascunho} onPonto={p=>{if(ferramenta==='agua'||ferramenta==='obstaculo')setRascunho(r=>[...r,p]);if(ferramenta==='calibrar')setRascunho(r=>r.length>=2?[p]:[...r,p]);}} onRemover={ferramenta==='remover'?id=>atualizar({placas:d.placas.filter(p=>p.id!==id)},false):undefined}/>
          <p className="text-xs text-slate-600">{ferramenta==='calibrar'?'Marque dois pontos de uma distância conhecida.':ferramenta==='remover'?'Clique no módulo que deseja retirar.':'Clique nos vértices do contorno e conclua o polígono.'} Grade: 1 m. Norte informado: {d.norte}° em relação ao topo da imagem.</p>
          <div className="flex flex-wrap gap-2 items-end">
            {ferramenta==='calibrar'?<><Numero label="Distância conhecida (m)" value={distancia} onChange={setDistancia} min={0.1}/><button type="button" className="bg-sky-100 p-2 rounded" disabled={rascunho.length!==2} onClick={calibrar}>Aplicar escala</button></>:<button type="button" className="bg-sky-100 p-2 rounded text-sm" onClick={fecharPoligono} disabled={rascunho.length<3}>Concluir contorno</button>}
            <button type="button" className="p-2 text-sm" onClick={()=>setRascunho(r=>r.slice(0,-1))}>Retirar último ponto</button>
            <button type="button" className="p-2 text-sm" disabled={!historico.length} onClick={()=>{setD(historico[historico.length-1]);setHistorico(h=>h.slice(0,-1));setRascunho([]);}}>Desfazer alteração</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-slate-50 rounded-lg p-3"><span>{d.placas.length} módulos</span><span>{potencia.toFixed(2)} kWp</span><span>{Math.round(mensal)} kWh/mês</span><span>{Math.round(mensal*12)} kWh/ano</span></div>
          <p className="text-xs text-slate-500">Estimativa por HSP {hsp} e perdas {perdasPct}%. Orientação e sombras não estão incorporadas nesta estimativa. Área de superfície: {areaSuperficie(d).toFixed(2)} m². Peso dos módulos: {d.modulo.pesoKg?`${(d.modulo.pesoKg*d.placas.length).toFixed(1)} kg`:'não informado'}.</p>
          {erro&&<p role="alert" className="text-sm text-amber-900 bg-amber-50 p-3 rounded">{erro}</p>}
        </div>
        <div className="space-y-4 text-sm">
          <label className="block text-xs">Imagem própria (até 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full mt-1" disabled={carregando} onChange={e=>{void importar(e.target.files?.[0]);e.target.value='';}}/></label>
          {d.imagemNome&&<p className="text-xs text-slate-500">{d.imagemNome} · prévia comprimida salva com a proposta. Importar outra imagem reinicia os contornos.</p>}
          <div className="grid grid-cols-2 gap-2"><Numero label="Largura da planta (m)" value={d.larguraM} min={1} onChange={v=>{atualizar({larguraM:v,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);}}/><Numero label="Altura da planta (m)" value={d.alturaM} min={1} onChange={v=>{atualizar({alturaM:v,aguas:[],obstaculos:[],escalaConfirmada:false});setRascunho([]);}}/></div>
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={d.escalaConfirmada} onChange={e=>atualizar({escalaConfirmada:e.target.checked})}/>Confirmo as dimensões/escala com medida conhecida</label>
          <Numero label="Norte: graus horários desde o topo" value={d.norte} max={359.99} onChange={v=>atualizar({norte:v})}/>
          <label className="block text-xs">Tipologia<select className={campo} value={d.tipologia} onChange={e=>atualizar({tipologia:e.target.value},false)}>{['Não informado','Plano','Meia água','Duas águas','Quatro águas','Outro'].map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="block text-xs">Ano da construção (informado)<input className={campo} type="number" min="1500" max={new Date().getFullYear()} value={d.anoConstrucao??''} onChange={e=>atualizar({anoConstrucao:e.target.value?Number(e.target.value):undefined},false)}/></label>
          <label className="block text-xs">Data de captura conhecida<input className={campo} type="date" value={d.dataImagem??''} onChange={e=>atualizar({dataImagem:e.target.value||undefined},false)}/></label>
          <label className="block text-xs">Modelo do módulo<input className={campo} maxLength={200} value={d.modulo.modelo} onChange={e=>atualizar({modulo:{...d.modulo,modelo:e.target.value}},false)}/></label>
          <p className="text-xs text-amber-800">Confira dimensões e potência no datasheet antes de aplicar.</p>
          <div className="grid grid-cols-2 gap-2"><Numero label="Largura módulo (m)" min={0.2} max={10} value={d.modulo.larguraM} onChange={v=>atualizar({modulo:{...d.modulo,larguraM:v}})}/><Numero label="Comprimento (m)" min={0.2} max={10} value={d.modulo.alturaM} onChange={v=>atualizar({modulo:{...d.modulo,alturaM:v}})}/><Numero label="Potência (Wp)" min={1} max={3000} step={1} value={d.modulo.potenciaWp} onChange={v=>atualizar({modulo:{...d.modulo,potenciaWp:v}},false)}/><Numero label="Peso módulo (kg)" min={0} max={200} value={d.modulo.pesoKg??0} onChange={v=>atualizar({modulo:{...d.modulo,pesoKg:v}},false)}/><Numero label="Recuo / obstáculos (m)" max={10} value={d.recuoM} onChange={v=>atualizar({recuoM:v})}/><Numero label="Entre módulos (m)" max={5} value={d.espacamentoM} onChange={v=>atualizar({espacamentoM:v})}/></div>
          {d.aguas.map((a,i)=><div key={a.id} className="border rounded-lg p-2 space-y-2"><div className="flex justify-between"><strong>{a.nome} · {areaPoligono(a.pontos).toFixed(1)} m² em planta</strong><button type="button" aria-label={`Excluir ${a.nome}`} onClick={()=>atualizar({aguas:d.aguas.filter(x=>x.id!==a.id)})}>Excluir</button></div><div className="grid grid-cols-2 gap-2"><Numero label="Inclinação (°)" max={75} value={a.inclinacao} onChange={v=>atualizar({aguas:d.aguas.map((x,j)=>j===i?{...x,inclinacao:v}:x)})}/><Numero label="Azimute (0° norte)" max={359.99} value={a.azimute} onChange={v=>atualizar({aguas:d.aguas.map((x,j)=>j===i?{...x,azimute:v}:x)})}/></div></div>)}
          {d.obstaculos.map((o,i)=><div key={o.id} className="flex justify-between text-xs"><span>Obstáculo {i+1} · excluído do layout</span><button type="button" onClick={()=>atualizar({obstaculos:d.obstaculos.filter(x=>x.id!==o.id)})}>Excluir</button></div>)}
          <Numero label="Quantidade desejada" min={1} max={2000} step={1} value={qtd} onChange={v=>setQtd(Math.floor(v))}/>
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={paisagem} onChange={e=>setPaisagem(e.target.checked)}/>Módulos em paisagem</label>
          <button type="button" className="w-full bg-slate-800 text-white rounded-lg p-3 font-bold" onClick={gerar}>Distribuir módulos</button>
          <p className="text-xs text-slate-500">Alterações de geometria removem os módulos para nova distribuição. Fotos oblíquas precisam de retificação. O desenho não verifica capacidade estrutural.</p>
        </div>
      </div>
      {!modoSatelite&&<div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onCancelar}>Cancelar</button><button type="button" disabled={carregando||!d.escalaConfirmada||!d.aguas.length||!d.placas.length} className="bg-sky-800 disabled:opacity-40 text-white rounded-lg px-5 py-3 font-bold" onClick={()=>onAplicar(d)}>Aplicar levantamento à proposta</button></div>}
    </div>
  </div>;
}
