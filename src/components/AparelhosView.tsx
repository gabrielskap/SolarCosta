import React, { useEffect, useState } from 'react';
import { ErroApi } from '../services/http';
import { excluirAparelho, listarAparelhos, salvarAparelho, type Aparelho } from '../services/aparelhos';

const vazio = { ambiente: '', nome: '', potenciaW: '' };
const mensagem = (e: unknown) => e instanceof ErroApi ? e.mensagemCompleta : e instanceof Error ? e.message : 'Não foi possível concluir a operação.';

export function AparelhosView() {
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [id, setId] = useState<string>();
  const [editando, setEditando] = useState(false);
  const [busca, setBusca] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [exclusao, setExclusao] = useState<Aparelho>();
  const carregar = async () => {
    setCarregando(true);
    try { setAparelhos(await listarAparelhos()); }
    catch (e) { setErro(mensagem(e)); }
    finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); }, []);
  const ambientes = [...new Set(aparelhos.map(a => a.ambiente))].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const visiveis = aparelhos.filter(a => (!ambiente || a.ambiente === ambiente) && normalizar(`${a.nome} ${a.ambiente}`).includes(normalizar(busca)));
  const campo = 'block w-full border border-slate-300 rounded-lg px-3 py-2 mt-1';
  const botao = 'bg-[#004276] text-white rounded-lg px-4 py-2 disabled:opacity-50';
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">Aparelhos</h1><p className="text-sm text-slate-500">Parâmetros · Aparelhos por ambiente e potência em watts.</p></div>
      <button disabled={ocupado} className={botao} onClick={() => { setForm({...vazio}); setId(undefined); setEditando(true); setExclusao(undefined); setErro(''); }}>Novo aparelho</button>
    </div>
    {erro && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{erro}</p>}
    {editando && <form className="bg-white border rounded-xl p-5 space-y-4" onSubmit={async e => {
      e.preventDefault(); setOcupado(true); setErro('');
      try { await salvarAparelho({ ambiente: form.ambiente, nome: form.nome, potenciaW: Number(form.potenciaW) }, id); setEditando(false); await carregar(); }
      catch (e) { setErro(mensagem(e)); } finally { setOcupado(false); }
    }}>
      <h2 className="font-bold">{id ? 'Editar aparelho' : 'Cadastrar aparelho'}</h2>
      <fieldset disabled={ocupado} className="grid sm:grid-cols-3 gap-4">
        <label>Ambiente<input required maxLength={80} list="ambientes-aparelhos" className={campo} value={form.ambiente} onChange={e => setForm({...form, ambiente: e.target.value})}/></label>
        <datalist id="ambientes-aparelhos">{[...new Set(['Sala de estar', 'Cozinha', 'Escritório', 'Quarto', ...ambientes])].map(a => <option key={a} value={a}/>)}</datalist>
        <label>Aparelho<input required maxLength={160} className={campo} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}/></label>
        <label>Potência (W)<input required type="number" min="0.01" max="9999999999.99" step="0.01" className={campo} value={form.potenciaW} onChange={e => setForm({...form, potenciaW: e.target.value})}/></label>
      </fieldset>
      <div className="flex gap-3"><button disabled={ocupado} className={botao}>{ocupado ? 'Salvando…' : 'Salvar aparelho'}</button><button type="button" disabled={ocupado} onClick={() => setEditando(false)}>Cancelar</button></div>
    </form>}
    {exclusao && <div role="alert" className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
      <p>Excluir o aparelho <strong>{exclusao.nome}</strong> de {exclusao.ambiente}?</p>
      <div className="flex gap-3"><button disabled={ocupado} className="bg-red-700 text-white rounded-lg px-4 py-2 disabled:opacity-50" onClick={async () => {
        setOcupado(true); setErro('');
        try { await excluirAparelho(exclusao.id); setExclusao(undefined); await carregar(); }
        catch (e) { setErro(mensagem(e)); } finally { setOcupado(false); }
      }}>{ocupado ? 'Excluindo…' : 'Confirmar exclusão'}</button><button disabled={ocupado} onClick={() => setExclusao(undefined)}>Cancelar</button></div>
    </div>}
    <div className="grid sm:grid-cols-2 gap-4">
      <label>Buscar aparelho<input type="search" className={campo} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou ambiente"/></label>
      <label>Ambiente<select className={campo} value={ambiente} onChange={e => setAmbiente(e.target.value)}><option value="">Todos os ambientes</option>{ambientes.map(a => <option key={a}>{a}</option>)}</select></label>
    </div>
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-50"><tr>{['Ambiente', 'Aparelho', 'Potência (W)', 'Ações'].map(v => <th key={v} className="p-4">{v}</th>)}</tr></thead>
      <tbody>{!carregando && visiveis.map(a => <tr key={a.id} className="border-t"><td className="p-4">{a.ambiente}</td><td className="p-4">{a.nome}</td><td className="p-4">{a.potenciaW.toLocaleString('pt-BR', {maximumFractionDigits: 2})} W</td><td className="p-4"><div className="flex gap-4">
        <button disabled={ocupado} className="text-sky-800 underline" onClick={() => { setForm({ambiente: a.ambiente, nome: a.nome, potenciaW: String(a.potenciaW)}); setId(a.id); setEditando(true); setExclusao(undefined); setErro(''); }}>Editar</button>
        <button disabled={ocupado} className="text-red-700 underline" onClick={() => { setExclusao(a); setEditando(false); setErro(''); }}>Excluir</button>
      </div></td></tr>)}
      {(carregando || !visiveis.length) && <tr><td colSpan={4} className="p-6 text-slate-500">{carregando ? 'Carregando aparelhos…' : 'Nenhum aparelho encontrado.'}</td></tr>}</tbody>
    </table></div>
  </div>;
}
