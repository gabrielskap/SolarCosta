import React, { useEffect, useId, useState } from 'react';
import { http } from '../services/http';

export interface LeadOpcao { id: string; numero: string; nome: string; cpf_cnpj?: string; telefone?: string; email?: string }

export function LeadAutocomplete({leadId, nome, onChange}: {
  leadId: string | null; nome: string; onChange: (lead: LeadOpcao | null) => void;
}) {
  const listId = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [leads, setLeads] = useState<LeadOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState(-1);
  useEffect(() => {
    if (!aberto) return;
    let valido = true;
    setCarregando(true); setErro(''); setLeads([]); setAtivo(-1);
    const timer = setTimeout(() => {
      http.get<{leads: LeadOpcao[]}>(`/api/leads?tamanho=50${busca.trim() ? `&busca=${encodeURIComponent(busca.trim())}` : ''}`)
        .then(r => { if (valido) setLeads(r.leads); })
        .catch(e => { if (valido) setErro(e instanceof Error ? e.message : 'Falha ao buscar leads.'); })
        .finally(() => { if (valido) setCarregando(false); });
    }, 300);
    return () => { valido = false; clearTimeout(timer); };
  }, [aberto, busca]);
  const selecionar = (lead: LeadOpcao) => { onChange(lead); setAberto(false); setBusca(''); };
  return <div className="relative" onBlur={e => {if(!e.currentTarget.contains(e.relatedTarget as Node)) setAberto(false);}}>
    <label htmlFor={`${listId}-input`} className="block">Buscar lead</label>
    <div className="flex gap-2">
      <input id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-expanded={aberto} aria-controls={listId}
        aria-activedescendant={aberto && ativo >= 0 ? `${listId}-${ativo}` : undefined}
        autoComplete="off" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
        value={aberto ? busca : leadId ? nome : ''} placeholder="Selecione ou busque por nome, CPF/CNPJ ou número"
        onFocus={() => {setBusca('');setAberto(true);}} onClick={() => setAberto(true)}
        onChange={e => {setBusca(e.target.value);setAberto(true);setAtivo(-1);}}
        onKeyDown={e => {
          if(e.key==='ArrowDown'){e.preventDefault();setAberto(true);setAtivo(i=>Math.min(i+1,leads.length-1));}
          if(e.key==='ArrowUp'){e.preventDefault();setAtivo(i=>Math.max(i-1,0));}
          if(e.key==='Enter'&&aberto){e.preventDefault();if(leads[ativo])selecionar(leads[ativo]);}
          if(e.key==='Escape'){e.preventDefault();setAberto(false);}
        }}/>
      {leadId && <button type="button" className="text-sm text-red-700 underline" onClick={() => {onChange(null);setBusca('');setAberto(false);}}>Desvincular</button>}
    </div>
    {aberto && <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto">
      {carregando && <p role="status" className="p-3 text-sm text-slate-500">Buscando leads…</p>}
      {erro && <p role="alert" className="p-3 text-sm text-red-700">{erro}</p>}
      {!carregando&&!erro&&!leads.length&&<p role="status" className="p-3 text-sm text-slate-500">Nenhum lead encontrado.</p>}
      <ul id={listId} role="listbox" aria-label="Leads encontrados">{leads.map((lead,i)=><li key={lead.id}>
        <button id={`${listId}-${i}`} type="button" role="option" aria-selected={ativo===i} className={`w-full text-left p-3 hover:bg-sky-50 ${ativo===i?'bg-sky-50':''}`}
          onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setAtivo(i)} onClick={()=>selecionar(lead)}>
          <span className="block font-medium">{lead.numero} · {lead.nome}</span><span className="text-xs text-slate-500">{[lead.cpf_cnpj,lead.telefone].filter(Boolean).join(' · ')}</span>
        </button>
      </li>)}</ul>
    </div>}
  </div>;
}
