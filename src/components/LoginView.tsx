import React, { useState } from 'react';
import { Sun, Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { User } from '../types';
import { Auth } from '../services/api';
import { ErroApi } from '../services/http';

interface LoginViewProps {
  onLoginSuccess?: (user: User) => void;
  onLogin?: (user: User) => void;
  showToast?: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onLogin, showToast }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [entrando, setEntrando] = useState(false);

  const handleSuccess = onLoginSuccess || onLogin;

  // A senha é conferida no servidor (bcrypt). O front não conhece nem a lista
  // de usuários nem os hashes — e a mensagem de erro é a mesma para e-mail
  // inexistente e senha errada, para não revelar quais contas existem.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando) return;

    setErrorMsg('');
    setEntrando(true);

    try {
      const user = await Auth.login(email.trim(), senha);
      if (handleSuccess) handleSuccess(user);
    } catch (erro) {
      const mensagem =
        erro instanceof ErroApi
          ? erro.status === 0
            ? 'Servidor indisponível. Verifique se a API está no ar.'
            : erro.mensagemCompleta
          : 'Não foi possível entrar. Tente de novo.';

      setErrorMsg(mensagem);
      if (showToast) showToast('Acesso negado', 'error', mensagem);
    } finally {
      setEntrando(false);
    }
  };

  const handleForgotPassword = () => {
    if (showToast) {
      showToast(
        'Recuperação de senha',
        'info',
        'Peça ao administrador do sistema para redefinir sua senha.'
      );
    }
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
              disabled={entrando || !email || !senha}
              className="w-full bg-[#004276] hover:bg-[#003159] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              {entrando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entrando…</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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
