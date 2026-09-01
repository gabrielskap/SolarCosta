// Formulário de captação do site.
//
// Grava direto em SolarCosta_Leads via POST /api/publico/leads, com origem
// "Site Solar Costa" e etapa "Novo lead": o consultor vê o cadastro no Kanban
// no mesmo instante, sem ninguém transcrever e-mail.
//
// O campo `website` é honeypot — fica fora da vista e do foco do teclado.
// Humano nunca preenche; bot preenche tudo que encontra.

import React, { useEffect, useState } from 'react';
import { Loader2, Send, CheckCircle2, AlertCircle, MessageCircle } from 'lucide-react';
import { Publico, linkWhatsApp } from '../../services/publico';
import { ErroApi } from '../../services/http';
import { maskPhone, onlyDigits, isValidEmail } from '../../utils/format';
import { useConfigPublica } from '../contexto';

interface Props {
  /** Preenchido pelo simulador quando o visitante vem de lá. */
  consumoInicial?: number;
  cidadeInicial?: string;
  titulo?: string;
  descricao?: string;
  /** Em fundo escuro o formulário inverte as cores dos rótulos. */
  tom?: 'claro' | 'escuro';
}

export const FormularioLead: React.FC<Props> = ({
  consumoInicial = 0,
  cidadeInicial = '',
  titulo = 'Peça uma proposta',
  descricao = 'Um consultor entra em contato para agendar a visita técnica. Sem custo e sem compromisso.',
  tom = 'claro',
}) => {
  const { config } = useConfigPublica();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cidade, setCidade] = useState(cidadeInicial);
  const [mensagem, setMensagem] = useState('');
  const [website, setWebsite] = useState(''); // honeypot

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  // O simulador pode calcular depois que o formulário já montou.
  useEffect(() => {
    if (cidadeInicial) setCidade(cidadeInicial);
  }, [cidadeInicial]);

  const escuro = tom === 'escuro';
  const emailInvalido = !!email && !isValidEmail(email);
  const telefoneCurto = onlyDigits(telefone).length > 0 && onlyDigits(telefone).length < 10;
  const podeEnviar =
    nome.trim().length >= 2 && onlyDigits(telefone).length >= 10 && !emailInvalido && !enviando;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;

    setErro('');
    setEnviando(true);
    try {
      await Publico.enviarLead({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        cidade: cidade.trim(),
        consumo_kwh: consumoInicial > 0 ? Math.round(consumoInicial) : 0,
        mensagem: mensagem.trim(),
        website,
      });
      setEnviado(true);
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.status === 0
            ? 'Não conseguimos falar com o servidor. Tente pelo WhatsApp.'
            : e.mensagemCompleta
          : 'Não foi possível enviar agora. Tente pelo WhatsApp.',
      );
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div
        className={`rounded-2xl border p-8 text-center ${
          escuro ? 'bg-blue-950/40 border-blue-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className={`text-xl font-black ${escuro ? 'text-white' : 'text-slate-900'}`}>
          Recebemos seu contato
        </h3>
        <p className={`text-sm mt-2 ${escuro ? 'text-blue-100' : 'text-slate-600'}`}>
          Um consultor da Solar Costa entra em contato pelo telefone informado. Se preferir
          adiantar, fale com a gente agora mesmo:
        </p>
        <a
          href={linkWhatsApp(
            config?.empresa ?? null,
            `Olá! Acabei de enviar meus dados pelo site. Meu nome é ${nome.trim()}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition"
        >
          <MessageCircle className="w-4 h-4" />
          Falar no WhatsApp
        </a>
      </div>
    );
  }

  const rotulo = `block text-xs font-bold uppercase tracking-wider mb-1.5 ${
    escuro ? 'text-blue-200' : 'text-slate-600'
  }`;
  const campo = `w-full px-4 py-3 rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
    escuro
      ? 'bg-blue-950/50 border border-blue-800 text-white placeholder:text-blue-300/50 focus:border-solar focus:ring-solar/20'
      : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-marca focus:ring-blue-100'
  }`;

  return (
    <div
      className={`rounded-2xl border p-6 md:p-8 ${
        escuro ? 'bg-blue-950/40 border-blue-800' : 'bg-white border-slate-200/80 shadow-xs'
      }`}
    >
      <h3 className={`text-xl font-black ${escuro ? 'text-white' : 'text-slate-900'}`}>{titulo}</h3>
      <p className={`text-sm mt-1.5 ${escuro ? 'text-blue-100' : 'text-slate-500'}`}>{descricao}</p>

      {consumoInicial > 0 && (
        <p
          className={`mt-4 text-xs font-semibold rounded-xl px-3.5 py-2.5 ${
            escuro
              ? 'bg-blue-900/60 text-blue-100 border border-blue-800'
              : 'bg-blue-50 text-marca border border-blue-100'
          }`}
        >
          Enviamos junto o consumo de{' '}
          {Math.round(consumoInicial).toLocaleString('pt-BR')} kWh/mês calculado no simulador.
        </p>
      )}

      {erro && (
        <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className={rotulo} htmlFor="lead-nome">
            Nome completo
          </label>
          <input
            id="lead-nome"
            className={campo}
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como podemos te chamar"
            autoComplete="name"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={rotulo} htmlFor="lead-telefone">
              WhatsApp / telefone
            </label>
            <input
              id="lead-telefone"
              className={campo}
              required
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              placeholder="(31) 90000-0000"
              autoComplete="tel"
            />
            {telefoneCurto && <p className="text-xs text-rose-500 mt-1 font-medium">Inclua o DDD.</p>}
          </div>
          <div>
            <label className={rotulo} htmlFor="lead-cidade">
              Cidade
            </label>
            <input
              id="lead-cidade"
              className={campo}
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Belo Horizonte"
              autoComplete="address-level2"
            />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="lead-email">
            E-mail <span className="font-normal normal-case opacity-70">(opcional)</span>
          </label>
          <input
            id="lead-email"
            className={campo}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
          />
          {emailInvalido && (
            <p className="text-xs text-rose-500 mt-1 font-medium">Confira o e-mail digitado.</p>
          )}
        </div>

        <div>
          <label className={rotulo} htmlFor="lead-mensagem">
            Como podemos ajudar?{' '}
            <span className="font-normal normal-case opacity-70">(opcional)</span>
          </label>
          <textarea
            id="lead-mensagem"
            className={`${campo} resize-none`}
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex.: minha conta vem uns R$ 600 e o telhado é de laje."
          />
        </div>

        {/* Honeypot — invisível para gente, irresistível para robô. */}
        <div aria-hidden="true" className="absolute w-px h-px -m-px overflow-hidden opacity-0">
          <label htmlFor="lead-website">Não preencha este campo</label>
          <input
            id="lead-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!podeEnviar}
          className="w-full bg-solar hover:bg-amber-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-marca font-extrabold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
        >
          {enviando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Quero falar com um consultor
            </>
          )}
        </button>

        <p className={`text-xs text-center ${escuro ? 'text-blue-300/70' : 'text-slate-400'}`}>
          Seus dados vão direto para a equipe comercial da Solar Costa e não são compartilhados com
          terceiros.
        </p>
      </form>
    </div>
  );
};
