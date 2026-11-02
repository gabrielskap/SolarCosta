import React, { useEffect, useId, useState } from 'react';
import { http } from '../services/http';
import { Search, UserCheck, X, Loader2 } from 'lucide-react';

export interface LeadOpcao {
  id: string;
  numero: string;
  nome: string;
  cpf_cnpj?: string;
  telefone?: string;
  email?: string;
  empresa?: string;
}

export function LeadAutocomplete({
  leadId,
  nome,
  onChange,
  onNomeChange,
  placeholder = 'Digite o nome do cliente ou busque por nome/CPF...',
  required = true,
}: {
  leadId: string | null;
  nome: string;
  onChange: (lead: LeadOpcao | null) => void;
  onNomeChange: (nome: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = useId();
  const [aberto, setAberto] = useState(false);
  const [leads, setLeads] = useState<LeadOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState(-1);

  useEffect(() => {
    if (!aberto || !nome.trim()) {
      setLeads([]);
      setCarregando(false);
      return;
    }
    let valido = true;
    setCarregando(true);
    setErro('');
    setAtivo(-1);

    const timer = setTimeout(() => {
      http
        .get<{ leads: LeadOpcao[] }>(
          `/api/leads?tamanho=20&busca=${encodeURIComponent(nome.trim())}`
        )
        .then((r) => {
          if (valido) setLeads(r.leads || []);
        })
        .catch((e) => {
          if (valido) setErro(e instanceof Error ? e.message : 'Falha ao buscar leads.');
        })
        .finally(() => {
          if (valido) setCarregando(false);
        });
    }, 250);

    return () => {
      valido = false;
      clearTimeout(timer);
    };
  }, [aberto, nome]);

  const selecionar = (lead: LeadOpcao) => {
    onChange(lead);
    setAberto(false);
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setAberto(false);
        }
      }}
    >
      <div className="relative">
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={aberto}
          aria-controls={listId}
          aria-activedescendant={aberto && ativo >= 0 ? `${listId}-${ativo}` : undefined}
          autoComplete="off"
          required={required}
          className={`w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white transition focus:outline-none focus:ring-1 focus:ring-[#004276] focus:border-[#004276] ${
            leadId ? 'border-sky-300 pr-24 bg-sky-50/20 font-medium' : 'border-slate-200 pr-8'
          }`}
          value={nome}
          placeholder={placeholder}
          onFocus={() => {
            if (nome.trim()) setAberto(true);
          }}
          onClick={() => {
            if (nome.trim()) setAberto(true);
          }}
          onChange={(e) => {
            onNomeChange(e.target.value);
            setAberto(true);
            setAtivo(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((i) => Math.min(i + 1, leads.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((i) => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter' && aberto && leads[ativo]) {
              e.preventDefault();
              selecionar(leads[ativo]);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setAberto(false);
            }
          }}
        />

        {/* Indicador de Lead Vinculado ou Ícone de Busca */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {leadId ? (
            <div className="flex items-center gap-1 bg-sky-100 text-sky-800 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-sky-200">
              <UserCheck className="w-3 h-3 text-sky-700" />
              <span>Lead</span>
              <button
                type="button"
                title="Desvincular lead (mantém o nome digitado)"
                className="hover:text-red-700 ml-0.5"
                onClick={() => onChange(null)}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : carregando ? (
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Menu Dropdown de Sugestões de Leads */}
      {aberto && (carregando || leads.length > 0 || erro) && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {carregando && (
            <div className="p-2.5 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#004276]" />
              <span>Buscando leads no sistema...</span>
            </div>
          )}
          {erro && <p role="alert" className="p-2.5 text-xs text-red-700">{erro}</p>}
          {!carregando && leads.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Leads sugeridos">
              <li className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                Leads cadastrados encontrados
              </li>
              {leads.map((lead, i) => (
                <li key={lead.id}>
                  <button
                    id={`${listId}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={ativo === i}
                    className={`w-full text-left px-2.5 py-2 hover:bg-sky-50 transition border-b border-slate-50 last:border-b-0 ${
                      ativo === i ? 'bg-sky-50' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => selecionar(lead)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-xs">
                        {lead.numero} · {lead.nome}
                      </span>
                      <span className="text-[10px] text-sky-700 font-medium bg-sky-50 px-1 rounded">
                        Vincular
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {[lead.cpf_cnpj, lead.telefone, lead.email].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
