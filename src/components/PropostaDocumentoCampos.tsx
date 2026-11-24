import React, { useId } from 'react';
import { FileText, Loader2, RotateCcw, Save, UserRound } from 'lucide-react';
import type { GarantiasProposta } from '../types';
import { GarantiasPropostaCampos } from './GarantiasPropostaCampos';

interface PropostaDocumentoCamposProps {
  garantias: GarantiasProposta;
  onGarantiasChange: (valor: GarantiasProposta) => void;
  observacoes: string;
  onObservacoesChange: (valor: string) => void;
  exclusoesEscopo: string;
  onExclusoesChange: (valor: string) => void;
  onDefinirPadrao: () => void;
  onRestaurarPadrao: () => void;
  salvandoPadrao: boolean;
  responsavelTecnico: string;
  onResponsavelChange: (valor: string) => void;
  conselho: 'CREA' | 'CRT';
  onConselhoChange: (valor: 'CREA' | 'CRT') => void;
  registro: string;
  onRegistroChange: (valor: string) => void;
  logoUrl: string;
  onLogoChange: (valor: string) => void;
}

const campo = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 transition focus:border-[#004276] focus:outline-none focus:ring-2 focus:ring-[#004276]/25';
const botaoFoco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004276] focus-visible:ring-offset-2';

/** Campos do documento separados da lógica de cálculo e de salvamento da proposta. */
export function PropostaDocumentoCampos(props: PropostaDocumentoCamposProps) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-titulo`} className="@container rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
      <header className="flex items-start gap-3 border-b border-slate-200 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004276] text-white" aria-hidden="true">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-base font-bold leading-snug text-[#004276]">Garantias, observações e responsável técnico</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">Revise os dados e os textos que serão apresentados no PDF da proposta.</p>
        </div>
      </header>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 @min-[40rem]:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <GarantiasPropostaCampos valor={props.garantias} onChange={props.onGarantiasChange} confortavel />
        </div>

        <fieldset className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <legend className="sr-only">Responsável técnico</legend>
          <div className="flex items-center gap-2 text-[#004276]">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <h4 className="text-sm font-bold">Responsável técnico</h4>
          </div>
          <p id={`${id}-tecnico-ajuda`} className="mt-1.5 text-xs leading-relaxed text-slate-600">Você pode informar apenas o nome, sem cadastrar um usuário. O registro é opcional.</p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-nome`} className="block text-sm font-semibold text-slate-700">Nome do técnico</label>
              <input id={`${id}-nome`} type="text" autoComplete="off" maxLength={200}
                aria-describedby={`${id}-tecnico-ajuda`} value={props.responsavelTecnico}
                onChange={e => props.onResponsavelChange(e.target.value)} placeholder="Digite o nome completo" className={campo} />
            </div>
            <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
              <div className="space-y-1.5">
                <label htmlFor={`${id}-conselho`} className="block text-sm font-semibold text-slate-700">Conselho</label>
                <select id={`${id}-conselho`} value={props.conselho}
                  onChange={e => props.onConselhoChange(e.target.value as 'CREA' | 'CRT')} className={campo}>
                  <option value="CREA">CREA</option>
                  <option value="CRT">CRT</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${id}-registro`} className="block text-sm font-semibold text-slate-700">Registro <span className="font-normal text-slate-600">(opcional)</span></label>
                <input id={`${id}-registro`} value={props.registro} onChange={e => props.onRegistroChange(e.target.value)}
                  maxLength={60} placeholder="Número do registro" className={campo} />
              </div>
            </div>
          </div>
        </fieldset>

        <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4 @min-[40rem]:col-span-2">
          <div>
            <label htmlFor={`${id}-observacoes`} className="block text-sm font-bold text-[#004276]">Observações e cláusulas da proposta</label>
            <p id={`${id}-observacoes-ajuda`} className="mt-1 text-xs leading-relaxed text-slate-600">Inclua condições e informações específicas deste projeto.</p>
          </div>
          <textarea id={`${id}-observacoes`} aria-describedby={`${id}-observacoes-ajuda`} rows={4}
            value={props.observacoes} onChange={e => props.onObservacoesChange(e.target.value)}
            placeholder="Ex.: condições de instalação, validade ou observações sobre o telhado."
            className={`${campo} block resize-y leading-relaxed`} />
        </div>

        <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4 @min-[40rem]:col-span-2">
          <div>
            <label htmlFor={`${id}-exclusoes`} className="block text-sm font-bold text-[#004276]">Itens fora do escopo de fornecimento</label>
            <p id={`${id}-exclusoes-ajuda`} className="mt-1 text-xs leading-relaxed text-slate-600">Edite ou remova os itens que não deseja citar. A primeira linha é o título; deixe o campo vazio para ocultar a seção no PDF.</p>
          </div>
          <textarea id={`${id}-exclusoes`} aria-describedby={`${id}-exclusoes-ajuda`} rows={8} maxLength={10000}
            value={props.exclusoesEscopo} onChange={e => props.onExclusoesChange(e.target.value)}
            className={`${campo} block resize-y leading-relaxed`} />
          <div className="flex flex-col items-stretch gap-2 border-t border-slate-200 pt-3 @min-[32rem]:flex-row @min-[32rem]:items-center">
            <button type="button" onClick={props.onDefinirPadrao} disabled={props.salvandoPadrao} aria-busy={props.salvandoPadrao}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#004276] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#003159] disabled:cursor-wait disabled:opacity-60 ${botaoFoco}`}>
              {props.salvandoPadrao ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {props.salvandoPadrao ? 'Salvando padrão...' : 'Definir texto como padrão'}
            </button>
            <button type="button" onClick={props.onRestaurarPadrao}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-[#004276] transition hover:bg-slate-50 ${botaoFoco}`}>
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" /> Restaurar texto padrão
            </button>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">O padrão será usado nas novas propostas. As propostas já salvas mantêm seu próprio texto.</p>
        </div>

        <div className="min-w-0 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 @min-[40rem]:col-span-2">
          <label htmlFor={`${id}-logo`} className="block text-sm font-semibold text-slate-700">Logo personalizada <span className="font-normal text-slate-600">(opcional)</span></label>
          <p id={`${id}-logo-ajuda`} className="text-xs leading-relaxed text-slate-600">Informe o endereço da imagem para personalizar o PDF.</p>
          <input id={`${id}-logo`} type="url" inputMode="url" aria-describedby={`${id}-logo-ajuda`}
            value={props.logoUrl} onChange={e => props.onLogoChange(e.target.value)}
            placeholder="https://exemplo.com/logo.png" className={campo} />
        </div>
      </div>
    </section>
  );
}
