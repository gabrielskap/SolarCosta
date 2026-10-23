import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarPlacas, salvarPlaca, type PlacaSolar } from '../services/placas';
import { http } from '../services/http';

const vazio = { produtoId: '', fabricante: '', modelo: '', potenciaWp: 550, larguraM: 1.134, alturaM: 2.278, pesoKg: 28, observacoes: '', ativo: true };
interface ProdutoOpcao { id: string; codigo: string; nome: string; potencia_wp: number | null }
const campos = [
 ['potenciaWp', 'Potência (Wp)', 1, 3000, 1], ['larguraM', 'Largura (m)', 0.2, 10, 0.001],
 ['alturaM', 'Comprimento (m)', 0.2, 10, 0.001], ['pesoKg', 'Peso (kg)', 0.01, 200, 0.01],
] as const;
export function PlacasView() {
 const [placas, setPlacas] = useState<PlacaSolar[]>([]);
 const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
 const [form, setForm] = useState({ ...vazio });
 const [id, setId] = useState<string>();
 const [editando, setEditando] = useState(false);
 const [erro, setErro] = useState('');
 const [ocupado, setOcupado] = useState(false);
 const [carregando, setCarregando] = useState(true);
 const carregar = async () => { setCarregando(true); try { const [p,r] = await Promise.all([listarPlacas(), http.get<{produtos:ProdutoOpcao[]}>('/api/catalogo/produtos?tipo=modulo')]); setPlacas(p); setProdutos(r.produtos); } catch(e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar placas.'); } finally { setCarregando(false); } };
 useEffect(() => { void carregar(); }, []);
 const campo = 'block w-full border border-slate-300 rounded-lg px-3 py-2 mt-1';
 return <div className="space-y-6">
  <div className="flex justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Placas solares</h1><p className="text-sm text-slate-500">Parâmetros · Modelos disponíveis para o levantamento do telhado.</p></div><button className="bg-[#004276] text-white rounded-lg px-4 py-2" onClick={() => { setId(undefined); setForm({...vazio}); setEditando(true); setErro(''); }}>Nova placa</button></div>
  {erro && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{erro}</p>}
  {editando && <form className="bg-white border rounded-xl p-5 space-y-4" onSubmit={async e => {
   e.preventDefault(); setOcupado(true); setErro('');
   try { await salvarPlaca(form,id); setEditando(false); await carregar(); } catch(e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { setOcupado(false); }
  }}>
   <h2 className="font-bold">{id ? 'Editar placa' : 'Cadastrar placa'}</h2>
   <label className="block">Produto vinculado<select required className={campo} value={form.produtoId} onChange={e => {
    const produto = produtos.find(p => p.id===e.target.value);
    setForm({...form,produtoId:e.target.value,...(produto ? {modelo:produto.nome.slice(0,160),potenciaWp:produto.potencia_wp??form.potenciaWp} : {})});
   }}><option value="">Selecione um produto do tipo Módulo</option>
   {form.produtoId&&!produtos.some(p=>p.id===form.produtoId)&&<option value={form.produtoId} disabled>Produto indisponível — selecione outro</option>}
   {produtos.filter(p=>p.id===form.produtoId||!placas.some(placa=>placa.id!==id&&placa.produtoId===p.id)).map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}</select></label>
   <p className="text-sm text-slate-500">Cadastre o produto como Módulo em <Link to="/sistema/parametros/produtos" className="text-sky-800 underline">Produtos</Link>. Cada produto pode ter um cadastro de placa.</p>
   <div className="grid sm:grid-cols-2 gap-4">
    <label>Fabricante<input required maxLength={120} className={campo} value={form.fabricante} onChange={e => setForm({...form,fabricante:e.target.value})}/></label>
    <label>Modelo<input required maxLength={160} className={campo} value={form.modelo} onChange={e => setForm({...form,modelo:e.target.value})}/></label>
    {campos.map(([key,label,min,max,step]) => <label key={key}>{label}<input required readOnly={key==='potenciaWp'&&!!produtos.find(p=>p.id===form.produtoId)?.potencia_wp} type="number" min={min} max={max} step={step} className={campo} value={Number.isFinite(form[key]) ? form[key] : ''} onChange={e => setForm({...form,[key]:e.target.valueAsNumber})}/></label>)}
   </div>
   <label className="block">Observações<textarea maxLength={5000} className={campo} value={form.observacoes} onChange={e => setForm({...form,observacoes:e.target.value})}/></label>
   <label className="flex gap-2"><input type="checkbox" checked={form.ativo} onChange={e => setForm({...form,ativo:e.target.checked})}/>Disponível para novas seleções</label>
   <div className="flex gap-3"><button disabled={ocupado} className="bg-[#004276] text-white rounded-lg px-4 py-2 disabled:opacity-50">{ocupado ? 'Salvando…' : 'Salvar placa'}</button><button type="button" disabled={ocupado} onClick={() => setEditando(false)}>Cancelar</button></div>
  </form>}
  <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr>{['Fabricante / modelo','Potência','Dimensões','Peso','Status',''].map((v,i) => <th key={i} className="p-4">{v}</th>)}</tr></thead><tbody>
   {placas.map(p => <tr key={p.id} className="border-t"><td className="p-4"><strong>{p.fabricante}</strong><br/>{p.modelo}<p className="text-xs text-slate-500">{p.produtoId ? `${p.produtoCodigo} · ${p.produtoNome}` : 'Vincule um produto para utilizar esta placa'}</p></td><td className="p-4">{p.potenciaWp} Wp</td><td className="p-4">{p.larguraM} × {p.alturaM} m</td><td className="p-4">{p.pesoKg} kg</td><td className="p-4">{p.ativo ? 'Ativa' : 'Inativa'}</td><td className="p-4"><button className="text-sky-800 underline" onClick={() => {setForm({...p,produtoId:p.produtoId??''});setId(p.id);setEditando(true);setErro('');}}>Editar</button></td></tr>)}
   {!placas.length && <tr><td colSpan={6} className="p-6 text-slate-500">{carregando ? 'Carregando placas…' : 'Nenhuma placa cadastrada.'}</td></tr>}
  </tbody></table></div>
 </div>;
}
