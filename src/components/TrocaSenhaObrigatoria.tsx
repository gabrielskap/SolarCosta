import React, { useState } from 'react';
import { CampoSenha } from './comuns/CampoSenha';
import { Auth } from '../services/api';
import { ErroApi } from '../services/http';

export function TrocaSenhaObrigatoria({ onSair }: { onSair: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== confirmacao) { setErro('As senhas não conferem.'); return; }
    setSalvando(true); setErro('');
    try {
      await Auth.trocarSenha(atual, nova);
      setAtual(''); setNova(''); setConfirmacao(''); setConcluido(true);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível alterar a senha. Tente novamente.');
    } finally { setSalvando(false); }
  }
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{concluido ? 'Senha alterada' : 'Troque sua senha'}</h1>
      {concluido ? <><p>Entre novamente com sua nova senha para continuar.</p><button className="btn-modal-salvar" onClick={onSair}>Ir para o login</button></> : <>
        <p className="text-sm text-slate-600">Sua senha foi redefinida. Cadastre uma nova senha para acessar o sistema.</p>
        <form onSubmit={salvar} className="space-y-4">
          <label className="block text-sm">Senha temporária<CampoSenha required autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
          <label className="block text-sm">Nova senha<CampoSenha required minLength={8} autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
          <p className="text-xs text-slate-500">Use pelo menos 8 caracteres e uma senha diferente da temporária.</p>
          <label className="block text-sm">Confirme a nova senha<CampoSenha required minLength={8} autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
          {erro && <p role="alert" className="text-sm text-rose-600">{erro}</p>}
          <div className="flex gap-3"><button disabled={salvando} type="button" onClick={onSair} className="btn-modal-cancelar">Sair</button><button disabled={salvando} className="btn-modal-salvar">{salvando ? 'Salvando...' : 'Salvar nova senha'}</button></div>
        </form>
      </>}
    </div>
  </div>;
}
