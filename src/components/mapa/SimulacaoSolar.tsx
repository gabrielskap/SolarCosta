import React, {useEffect,useState} from 'react';
import type {LevantamentoTelhado} from '../../utils/levantamentoTelhado';
import {incidenciaDireta,posicaoSolar} from '../../utils/posicaoSolar';

export function SimulacaoSolar({dados,onChange}:{dados:LevantamentoTelhado;onChange:(patch:Partial<LevantamentoTelhado>)=>void}) {
  const [lat,setLat]=useState(String(dados.localizacao?.latitude??''));
  const [lng,setLng]=useState(String(dados.localizacao?.longitude??''));
  const [erro,setErro]=useState('');
  useEffect(()=>{setLat(String(dados.localizacao?.latitude??''));setLng(String(dados.localizacao?.longitude??''));},[dados.localizacao?.latitude,dados.localizacao?.longitude]);
  const s=dados.simulacao??{data:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),hora:12,fuso:-3,mostrarIncidencia:false,mostrarSombras:false};
  const ajustar=(patch:Partial<typeof s>)=>onChange({simulacao:{...s,...patch}});
  const loc=dados.localizacao;
  const sol=loc?posicaoSolar(s.data,s.hora,loc.latitude,loc.longitude,s.fuso):null;
  const caminho=loc?Array.from({length:97},(_,i)=>{const p=posicaoSolar(s.data,i/4,loc.latitude,loc.longitude,s.fuso);return `${i/96*360},${100-Math.max(0,p.elevacao)/90*90}`;}).join(' '):'';
  const hora=`${String(Math.floor(s.hora)).padStart(2,'0')}:${String(Math.round((s.hora%1)*60)).padStart(2,'0')}`;
  const campo='border rounded px-2 py-1.5 bg-white w-full';
  return <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3" aria-label="Simulação da luz solar">
    <h3 className="text-sm font-bold text-slate-900">Simulação da luz solar</h3>
    <div className="grid grid-cols-2 gap-2 text-xs"><label>Latitude<input className={campo} value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Longitude<input className={campo} value={lng} onChange={e=>setLng(e.target.value)}/></label></div>
    <button type="button" className="text-xs text-sky-800 underline" onClick={()=>{
      const a=Number(lat.replace(',','.')),b=Number(lng.replace(',','.'));
      if(!lat.trim()||!lng.trim()||!Number.isFinite(a)||Math.abs(a)>85||!Number.isFinite(b)||Math.abs(b)>180){setErro('Informe coordenadas válidas para a simulação.');return;}
      onChange({localizacao:{latitude:a,longitude:b,endereco:dados.localizacao?.endereco}});setErro('');
    }}>Usar coordenadas na simulação</button>
    <div className="grid grid-cols-2 gap-2 text-xs"><label>Data<input className={campo} type="date" value={s.data} onChange={e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))ajustar({data:e.target.value});}}/></label><label>Fuso (UTC)<select className={campo} value={s.fuso} onChange={e=>ajustar({fuso:Number(e.target.value)})}>{[-5,-4,-3,-2].map(v=><option key={v} value={v}>UTC{v}</option>)}</select></label></div>
    <label className="block text-xs">Horário local: <strong>{hora}</strong><input aria-label="Horário da simulação" className="block w-full accent-amber-600" type="range" min={0} max={23.75} step={0.25} value={s.hora} onChange={e=>ajustar({hora:Number(e.target.value)})}/></label>
    {sol?<>
      <div className="text-xs">Altura solar: {sol.elevacao.toFixed(1)}° · Azimute: {sol.azimute.toFixed(1)}° {sol.elevacao<=0&&<strong> · Sol abaixo do horizonte</strong>}</div>
      <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label="Trajetória diária: altura do Sol por horário"><line x1="0" y1="100" x2="360" y2="100" stroke="#94a3b8"/><polyline points={caminho} fill="none" stroke="#d97706" strokeWidth="2"/><line x1={s.hora/24*360} y1="0" x2={s.hora/24*360} y2="100" stroke="#004276" strokeDasharray="3 3"/>{[0,6,12,18,24].map(h=><text key={h} x={h/24*350} y="116" fontSize="11">{h}h</text>)}</svg>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={s.mostrarIncidencia} onChange={e=>ajustar({mostrarIncidencia:e.target.checked})}/>Colorir águas por incidência direta neste horário</label>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={s.mostrarSombras} onChange={e=>ajustar({mostrarSombras:e.target.checked})}/>Projetar sombras de obstáculos em águas planas</label>
      {s.mostrarIncidencia&&<div className="text-xs space-y-1">{dados.aguas.map(a=><div key={a.id}>{a.nome}: {(100*incidenciaDireta(sol.elevacao,sol.azimute,a.inclinacao,a.azimute)).toFixed(0)}% de incidência direta relativa</div>)}</div>}
    </>:<p className="text-xs text-slate-600">Busque o imóvel por satélite ou informe as coordenadas para simular o Sol.</p>}
    {erro&&<p role="alert" className="text-xs text-red-700">{erro}</p>}
    <p className="text-[11px] text-slate-600">Modelo geométrico aproximado (NOAA). As cores representam o ângulo da luz neste instante, sem nuvens ou perdas. Sombras usam as alturas informadas, no mesmo plano horizontal; águas inclinadas não recebem esta projeção. Esta visualização não altera a estimativa de geração por HSP.</p>
  </section>;
}
