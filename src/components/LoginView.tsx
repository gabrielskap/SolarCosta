import React, { useState } from 'react';
import { Sun, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface LoginViewProps {
  users?: User[];
  usuarios?: User[];
  onLoginSuccess?: (user: User) => void;
  onLogin?: (user: User) => void;
  showToast?: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, usuarios, onLoginSuccess, onLogin, showToast }) => {
  const [email, setEmail] = useState('carlos.costa@solarcosta.com.br');
  const [senha, setSenha] = useState('123');
  const [showSenha, setShowSenha] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const userList = users || usuarios || [];
  const handleSuccess = onLoginSuccess || onLogin;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const user = userList.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      setErrorMsg('Usuário não encontrado. Verifique o e-mail informado.');
      if (showToast) showToast('Acesso negado', 'error', 'E-mail não cadastrado no sistema.');
      return;
    }

    if (user.status === 'inativo' || user.situacao === 'Inativo') {
      setErrorMsg('Usuário inativo. Entre em contato com o administrador.');
      if (showToast) showToast('Acesso negado', 'error', 'Conta desativada.');
      return;
    }

    // In demo environment, any password works or check 123
    if (showToast) showToast(`Bem-vindo, ${user.nome}!`, 'success', 'Login realizado com sucesso.');
    if (handleSuccess) handleSuccess(user);
  };

  const handleForgotPassword = () => {
    showToast(
      'Recuperação de senha',
      'info',
      'Entre em contato com o Administrador (thiago@solarcosta.com.br) para redefinir sua senha.'
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#f4f6fa] text-slate-800">
      {/* Left Blue Panel */}
      <div className="w-full md:w-1/2 bg-[#004276] text-white p-8 md:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Header Tag */}
        <div className="flex items-center justify-between z-10">
          <span className="font-mono text-xs text-blue-200 tracking-widest uppercase opacity-75">
            CRM • GESTÃO COMERCIAL
          </span>
          <span className="font-mono text-xs text-blue-200 opacity-60">v1.0</span>
        </div>

        {/* Center Logo & Text */}
        <div className="my-12 md:my-auto max-w-md z-10 space-y-6">
          <div className="w-24 h-24 rounded-full bg-[#FFD100] flex items-center justify-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#004276] flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-[#FFD100]" />
            </div>
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider uppercase text-white">
              SOLAR COSTA
            </h1>
            <p className="text-sm font-bold text-[#FFD100] tracking-widest uppercase mt-1">
              ENERGIA SOLAR
            </p>
          </div>

          <div className="w-12 h-1 bg-emerald-500 rounded-full" />

          <p className="text-lg text-blue-100 font-medium leading-relaxed">
            Poder de decisão para quem gera a própria energia. Propostas, leads, contratos e financeiro em um só lugar.
          </p>
        </div>

        {/* Footer info */}
        <div className="z-10 text-xs text-blue-200/80 space-y-1 font-mono pt-6 border-t border-blue-900/60">
          <p>Rua Alzira Maria Ferreira, 241 – Santa Mônica</p>
          <p>Belo Horizonte/MG • CEP 31.530-150</p>
          <p>(31) 98658-8456 • solarcostamg@gmail.com</p>
        </div>
      </div>

      {/* Right White Form Panel */}
      <div className="w-full md:w-1/2 bg-white p-8 md:p-16 flex items-center justify-center relative">
        <div className="w-full max-w-md space-y-8">
          <div>
            <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">
              BEM-VINDO DE VOLTA
            </span>
            <h2 className="text-3xl font-extrabold text-[#004276] mt-1">
              Acessar o sistema
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Entre com seu e-mail e senha de colaborador.
            </p>
          </div>

          {/* Quick User Selector (for convenience in demo) */}
          <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 text-xs">
            <p className="font-semibold text-[#004276] mb-1.5">Contas de acesso rápido para testes:</p>
            <div className="flex flex-wrap gap-2">
              {users.slice(0, 3).map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setEmail(u.email); setSenha('123'); setErrorMsg(''); }}
                  className="bg-white hover:bg-blue-100 text-slate-700 font-medium px-2.5 py-1 rounded border border-blue-200 transition"
                >
                  {u.nome.split(' ')[0]} ({u.perfil})
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                E-MAIL DE ACESSO
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.nome@solarcosta.com.br"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  SENHA
                </label>
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                >
                  {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <input
                type={showSenha ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={manterConectado}
                  onChange={(e) => setManterConectado(e.target.checked)}
                  className="rounded text-[#004276] focus:ring-[#004276]"
                />
                <span>Manter conectado</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-blue-600 hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-[#004276] hover:bg-[#003159] text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              <span>Entrar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Acesso restrito a colaboradores. Para liberar um novo usuário, fale com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
};
