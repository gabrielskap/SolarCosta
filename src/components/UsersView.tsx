import React, { useState } from 'react';
import { Users, UserPlus, Shield, CheckCircle2, XCircle, Edit2, Trash2, UserCog, KeyRound } from 'lucide-react';
import { CampoSenha } from './comuns/CampoSenha';
import { ModalCabecalho } from './comuns/ModalCabecalho';
import { User, UserPermissions, UserRole } from '../types';
import { Api } from '../services/api';
import { ErroApi } from '../services/http';
import { isValidEmail } from '../utils/format';

/**
 * As permissões granulares, na ordem em que fazem sentido para quem cadastra.
 * `usuarioAtivo` fica de fora: é derivada do status, não uma caixa de marcar.
 */
const PERMISSOES: { chave: keyof UserPermissions; rotulo: string; descricao: string }[] = [
  { chave: 'criarEditarLeads', rotulo: 'Leads', descricao: 'Cadastrar e editar leads.' },
  { chave: 'emitirPropostas', rotulo: 'Propostas', descricao: 'Montar e emitir orçamentos.' },
  { chave: 'anexarDocumentos', rotulo: 'Documentos', descricao: 'Anexar arquivos ao lead.' },
  { chave: 'emitirContratos', rotulo: 'Contratos', descricao: 'Gerar e assinar contratos.' },
  {
    chave: 'verLancamentosFinanceiro',
    rotulo: 'Financeiro',
    descricao: 'Ver caixa, boletos e faturamento.',
  },
  { chave: 'gerenciarObras', rotulo: 'Obras', descricao: 'Acompanhar instalação e estoque.' },
  { chave: 'gerenciarUsuarios', rotulo: 'Usuários', descricao: 'Cadastrar e editar usuários.' },
  { chave: 'verAuditoria', rotulo: 'Auditoria', descricao: 'Consultar a trilha de alterações.' },
  {
    chave: 'gerenciarSite',
    rotulo: 'Configuração do Site',
    descricao: 'Editar textos, imagens e menus do site.',
  },
  // Conectar e desconectar o número NÃO está aqui: isso exige "Usuários",
  // porque trocar o WhatsApp da empresa derruba o canal de todo mundo.
  {
    chave: 'usarWhatsapp',
    rotulo: 'WhatsApp',
    descricao: 'Atender clientes e enviar propostas pelo WhatsApp.',
  },
];

/**
 * Espelha `padraoPorCargo` de server/src/routes/usuarios.routes.ts: quem escolhe
 * o cargo vê logo as permissões que aquele cargo costuma ter, em vez de um
 * formulário todo desmarcado. O servidor continua sendo a autoridade.
 */
function padraoPorCargo(cargo: UserRole): UserPermissions {
  const vendas = cargo === 'Administrador' || cargo === 'Vendedor';
  const financeiro = cargo === 'Administrador' || cargo === 'Financeiro';
  const campo = cargo === 'Administrador' || cargo === 'Engenheiro' || cargo === 'Instalador';
  const admin = cargo === 'Administrador';

  return {
    criarEditarLeads: vendas,
    emitirPropostas: vendas,
    anexarDocumentos: vendas || campo,
    emitirContratos: financeiro,
    verLancamentosFinanceiro: financeiro,
    gerenciarUsuarios: admin,
    gerenciarObras: campo,
    verAuditoria: admin,
    gerenciarSite: admin,
    usarWhatsapp: vendas,
    usuarioAtivo: true,
  };
}

interface UsersViewProps {
  usuarios: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  usuarios,
  onSaveUser,
  onDeleteUser,
  currentUser,
  showToast
}) => {
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [redefinindo, setRedefinindo] = useState(false);
  const [redefinida, setRedefinida] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const podeGerenciar = currentUser.cargo === 'Administrador' || !!currentUser.permissoes?.gerenciarUsuarios;
  function gerarSenha() {
    const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
    function indice(limite: number) {
      const valor = new Uint32Array(1);
      const teto = Math.floor(0x100000000 / limite) * limite;
      do { crypto.getRandomValues(valor); } while (valor[0] >= teto);
      return valor[0] % limite;
    }
    const todos = grupos.join('');
    const caracteres = grupos.map(g => g[indice(g.length)]);
    while (caracteres.length < 20) caracteres.push(todos[indice(todos.length)]);
    for (let i = caracteres.length - 1; i > 0; i--) {
      const j = indice(i + 1); [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    setNovaSenha(caracteres.join('')); setCopiada(false);
  }
  async function redefinir() {
    if (!resetUser || !novaSenha || redefinindo) return;
    setRedefinindo(true);
    try {
      await Api.redefinirSenha(resetUser.id, novaSenha);
      setRedefinida(true);
      showToast('Senha redefinida', 'success', 'O usuário deverá trocar a senha no próximo login.');
    } catch (e) {
      showToast('Não foi possível redefinir a senha', 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Tente novamente.');
    } finally { setRedefinindo(false); }
  }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState<'Administrador' | 'Vendedor' | 'Financeiro' | 'Engenheiro' | 'Instalador'>('Vendedor');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [permissoes, setPermissoes] = useState<UserPermissions>(padraoPorCargo('Vendedor'));

  /** Trocar o cargo sugere as permissões daquele cargo — ainda dá para ajustar. */
  const handleTrocarCargo = (novo: UserRole) => {
    setCargo(novo);
    setPermissoes(padraoPorCargo(novo));
  };

  const handleOpenNew = () => {
    setEditingUser(null);
    setNome('');
    setEmail('');
    setSenha('');
    setCargo('Vendedor');
    setStatus('ativo');
    setPermissoes(padraoPorCargo('Vendedor'));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setNome(u.nome);
    setEmail(u.email);
    setSenha('');
    setCargo(u.cargo);
    setStatus(u.status);
    setPermissoes(u.permissoes ?? padraoPorCargo(u.cargo));
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email) return;
    if (!isValidEmail(email)) {
      showToast('E-mail inválido', 'error', 'Informe um e-mail no formato nome@dominio.com.');
      return;
    }

    const uObj: User = {
      id: editingUser ? editingUser.id : `novo-${Date.now()}`,
      nome,
      email,
      senha: editingUser ? undefined : senha,
      cargo,
      dataCriacao: editingUser ? editingUser.dataCriacao : new Date().toLocaleDateString('pt-BR'),
      ultimoAcesso: editingUser ? editingUser.ultimoAcesso : 'Agora mesmo',
      status,
      // Administrador recebe tudo no servidor (carregarUsuario), independente
      // do que for gravado aqui. Enviar o conjunto completo mantém a tabela
      // coerente com o cargo em vez de deixar linhas meio preenchidas.
      permissoes: cargo === 'Administrador' ? padraoPorCargo('Administrador') : permissoes,
    };

    onSaveUser(uObj);
    setIsModalOpen(false);
    showToast(
      editingUser ? 'Usuário atualizado' : 'Novo usuário criado',
      'success',
      `${nome} salvo com perfil de ${cargo}.`
    );
  };

  const handleToggleStatus = (u: User) => {
    const updated: User = {
      ...u,
      status: u.status === 'ativo' ? 'inativo' : 'ativo'
    };
    onSaveUser(updated);
    showToast(
      'Status alterado',
      'info',
      `Usuário ${u.nome} foi ${updated.status === 'ativo' ? 'ativado' : 'desativado'}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Usuários e permissões</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Gestão de acessos ao sistema Solar Costa · {usuarios.filter(u => u.status === 'ativo').length} usuários ativos
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Novo usuário</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="tabela-mobile w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                <th className="p-3">USUÁRIO</th>
                <th className="p-3">E-MAIL</th>
                <th className="p-3">CARGO / PERFIL</th>
                <th className="p-3">CRIAÇÃO</th>
                <th className="p-3">ÚLTIMO ACESSO</th>
                <th className="p-3">STATUS</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td data-label="USUÁRIO" className="p-3 font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-[#004276] font-bold flex items-center justify-center text-[11px]">
                      {u.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{u.nome}</span>
                  </td>
                  <td data-label="E-MAIL" className="p-3 text-slate-600 font-medium">{u.email}</td>
                  <td data-label="CARGO / PERFIL" className="p-3">
                    <span className="bg-blue-50 text-[#004276] font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                      {u.cargo}
                    </span>
                  </td>
                  <td data-label="CRIAÇÃO" className="p-3 text-slate-500">{u.dataCriacao}</td>
                  <td data-label="ÚLTIMO ACESSO" className="p-3 text-slate-500">{u.ultimoAcesso}</td>
                  <td data-label="STATUS" className="p-3">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td data-label="AÇÕES" className="p-3 text-right font-bold">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                    {podeGerenciar && <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors" onClick={() => { setResetUser(u); setNovaSenha(''); setRedefinida(false); setCopiada(false); }}><KeyRound size={14} />Redefinir senha</button>}
                    <button
                      onClick={() => handleOpenEdit(u)}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => {
                          onDeleteUser(u.id);
                          showToast('Usuário removido', 'info', `${u.nome} excluído.`);
                        }}
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resetUser && <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Redefinir senha" className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <ModalCabecalho icone={Shield} titulo="Redefinir senha" subtitulo={resetUser.nome + ' · ' + resetUser.email} onFechar={() => { if (!redefinindo) { setResetUser(null); setNovaSenha(''); } }} />
          <div className="p-5 space-y-4 text-sm">
            <p>{redefinida ? 'Senha redefinida. Copie a senha temporária para entregar ao usuário.' : 'Gere uma senha temporária forte. Ao confirmar, o usuário deverá trocar a senha no próximo login.'}</p>
            <label className="block">Nova senha temporária<CampoSenha readOnly value={novaSenha} className="w-full border rounded-xl p-3 mt-1 font-mono" placeholder="Clique em Gerar senha forte" /></label>
            <div className="flex gap-3 flex-wrap">
              {!redefinida && <button disabled={redefinindo} className="btn-modal-cancelar" onClick={gerarSenha}>Gerar senha forte</button>}
              <button disabled={!novaSenha} className="btn-modal-cancelar" onClick={async () => { try { await navigator.clipboard.writeText(novaSenha); setCopiada(true); } catch { showToast('Não foi possível copiar', 'error', 'Selecione a senha e copie manualmente.'); } }}>{copiada ? 'Senha copiada' : 'Copiar nova senha'}</button>
            </div>
            <div className="flex gap-3 justify-end">
              <button disabled={redefinindo} className="btn-modal-cancelar" onClick={() => { setResetUser(null); setNovaSenha(''); }}>{redefinida ? 'Fechar' : 'Cancelar'}</button>
              {!redefinida && <button disabled={!novaSenha || redefinindo} className="btn-modal-salvar" onClick={() => void redefinir()}>{redefinindo ? 'Redefinindo...' : 'Confirmar redefinição'}</button>}
            </div>
          </div>
        </div>
      </div>}
      {/* Modal Novo/Editar Usuário */}
      {isModalOpen && (
        <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel-rolante modal-entrada-painel bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <ModalCabecalho
              icone={UserCog}
              titulo={editingUser ? 'Editar usuário' : 'Novo usuário do sistema'}
              subtitulo={editingUser ? editingUser.email : 'Acesso ao CRM e permissões'}
              onFechar={() => setIsModalOpen(false)}
            />

            <form onSubmit={handleSubmit} className="campos-modal p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Rafael Moura"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">E-mail corporativo</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@solarcosta.com.br"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              {!editingUser && <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Senha de acesso</label>
                <input
                  type="password"
                  required={!editingUser}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={8}
                  placeholder="Mínimo de 8 caracteres"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cargo / Perfil</label>
                  <select
                    value={cargo}
                    onChange={(e: any) => handleTrocarCargo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Vendedor">Vendedor / Consultor</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Engenheiro">Engenheiro</option>
                    <option value="Instalador">Instalador / Campo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status de acesso</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo / Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-slate-600 uppercase">Permissões</label>
                  {cargo === 'Administrador' && (
                    <span className="text-[10px] font-bold text-emerald-600 normal-case">
                      Administrador tem acesso total
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PERMISSOES.map((p) => {
                    const admin = cargo === 'Administrador';
                    const marcado = admin || permissoes[p.chave];
                    return (
                      <label
                        key={p.chave}
                        title={p.descricao}
                        className={`flex items-start gap-2 p-2 rounded-xl border transition ${
                          admin
                            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70'
                            : marcado
                              ? 'bg-blue-50 border-[#004276]/30 cursor-pointer'
                              : 'bg-slate-50 border-slate-200 cursor-pointer hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={admin}
                          onChange={(e) =>
                            setPermissoes((prev) => ({ ...prev, [p.chave]: e.target.checked }))
                          }
                          className="mt-0.5 accent-[#004276]"
                        />
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-700">{p.rotulo}</span>
                          <span className="block text-[10px] text-slate-500 leading-snug">
                            {p.descricao}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rodape-modal barra-acoes">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-modal-cancelar"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-modal-salvar"
                >
                  Salvar usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
