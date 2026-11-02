interface Props { inativos: boolean; onChange: (valor: boolean) => void }
export function AbasAtividade({ inativos, onChange }: Props) {
 return <div className="flex gap-2" role="group" aria-label="Status dos registros">{[false,true].map(valor => <button key={String(valor)} type="button" aria-pressed={inativos === valor} onClick={() => onChange(valor)} className={inativos === valor ? 'px-4 py-2 rounded-lg bg-[#004276] text-white font-bold text-sm' : 'px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm'}>{valor ? 'Inativos' : 'Ativos'}</button>)}</div>;
}
