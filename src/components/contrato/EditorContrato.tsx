// Editor do contrato em módulos, com o documento ao lado.
//
// Serve para o contrato novo e para o salvo. O assinado abre aqui também, só
// que travado: o servidor já recusa o PUT de contrato assinado (409), e a
// tela não oferece o que o servidor vai recusar.
//
// Cada módulo edita um pedaço do rascunho; a pré-visualização é o MESMO
// DocumentoContrato que vai para o cliente, então o que se vê aqui é o que
// sai no PDF.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Building2, CalendarClock, CheckCircle2, Eye, FileText, FileX, Loader2, Lock, Package,
  PenLine, Printer, Save, Send, ShieldCheck, User, Wallet,
} from 'lucide-react';
import type {
  ChaveSecaoContrato, ContratadaContrato, Contrato, Lead, Proposta, TermosContrato,
} from '../../types';
import type { ConfigApp } from '../../services/api';
import {
  type RascunhoContrato, aplicarProposta, pendenciasObrigatorias, rascunhoDeContrato, rascunhoNovo,
} from '../../contrato/rascunho';
import { DocumentoContrato } from './DocumentoContrato';
import { ContratoLegado, usaLayoutLegado } from './ContratoLegado';
import { ModuloContratante } from './modulos/ModuloContratante';
import { ModuloContratada } from './modulos/ModuloContratada';
import { ModuloObjetoAnexo } from './modulos/ModuloObjetoAnexo';
import { ModuloPrazos } from './modulos/ModuloPrazos';
import { ModuloPagamento } from './modulos/ModuloPagamento';
import { ModuloGarantias } from './modulos/ModuloGarantias';
import { ModuloRescisao } from './modulos/ModuloRescisao';
import { ModuloAssinatura } from './modulos/ModuloAssinatura';
import { ModuloTextos } from './modulos/ModuloTextos';

type IdModulo =
  | 'contratante' | 'contratada' | 'objeto' | 'prazos' | 'pagamento'
  | 'garantias' | 'rescisao' | 'assinatura' | 'textos';

const MODULOS: { id: IdModulo; rotulo: string; icone: React.ElementType; secao: ChaveSecaoContrato | null }[] = [
  { id: 'contratante', rotulo: 'Contratante', icone: User, secao: 'preambulo' },
  { id: 'contratada', rotulo: 'Solar Costa', icone: Building2, secao: 'preambulo' },
  { id: 'objeto', rotulo: 'Objeto e Anexo I', icone: Package, secao: 'clausula_1' },
  { id: 'prazos', rotulo: 'Prazos', icone: CalendarClock, secao: 'clausula_2' },
  { id: 'pagamento', rotulo: 'Preço e pagamento', icone: Wallet, secao: 'clausula_3' },
  { id: 'garantias', rotulo: 'Garantias', icone: ShieldCheck, secao: 'clausula_7' },
  { id: 'rescisao', rotulo: 'Rescisão', icone: FileX, secao: 'clausula_9' },
  { id: 'assinatura', rotulo: 'Foro e assinaturas', icone: PenLine, secao: 'encerramento' },
  { id: 'textos', rotulo: 'Texto das cláusulas', icone: FileText, secao: null },
];

/** Largura de projeto da folha (max-w-4xl), a mesma do PDFModal. */
const LARGURA_FOLHA = 896;

interface Props {
  /** null = contrato novo. */
  inicial: Contrato | null;
  propostas: Proposta[];
  leads: Lead[];
  config: ConfigApp | null;
  /** Permissão emitir_contratos. Sem ela o editor só mostra. */
  podeEditar: boolean;
  podeEnviar: boolean;
  /** Salva e devolve o contrato como o banco gravou (com id e número). */
  onSalvar: (c: Contrato) => Promise<Contrato>;
  onAssinar: (c: Contrato) => void;
  onAbrirPDF: (c: Contrato) => void;
  onEnviar: (c: Contrato) => void;
  onVoltar: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EditorContrato: React.FC<Props> = ({
  inicial, propostas, leads, config, podeEditar, podeEnviar,
  onSalvar, onAssinar, onAbrirPDF, onEnviar, onVoltar, showToast,
}) => {
  const [r, setR] = useState<RascunhoContrato>(() =>
    inicial ? rascunhoDeContrato(inicial, config) : rascunhoNovo(config),
  );
  const [modulo, setModulo] = useState<IdModulo>('contratante');
  const [secaoTexto, setSecaoTexto] = useState<ChaveSecaoContrato | null>(null);
  // Legado ainda não assinado abre convertido para o modelo, mas o banco
  // continua com o formato antigo até alguém salvar: conta como alteração,
  // senão ele pareceria "salvo" e poderia ser assinado sem a conversão.
  const [alterado, setAlterado] = useState(() => !!inicial && !inicial.termos && inicial.status !== 'assinado');
  const [salvando, setSalvando] = useState(false);

  // Contrato novo nasce antes de /api/config responder: quando ele chegar,
  // recomeça dos padrões do banco — desde que ninguém tenha digitado nada.
  useEffect(() => {
    if (!inicial && !alterado && config) setR(rascunhoNovo(config));
    // Só a chegada do config dispara: `alterado` e `inicial` são lidos no momento.
  }, [config]);

  const assinado = r.status === 'assinado';
  const somenteLeitura = assinado || !podeEditar;
  const legado = inicial ? usaLayoutLegado(inicial) : false;
  const proposta = propostas.find((p) => p.id === r.propostaId);
  const pendencias = pendenciasObrigatorias(r);

  const mudar = (fn: (atual: RascunhoContrato) => RascunhoContrato) => {
    if (somenteLeitura) return;
    setR(fn);
    setAlterado(true);
  };
  const alterar = (parcial: Partial<Contrato>) => mudar((a) => ({ ...a, ...parcial }));
  const alterarTermos = (parcial: Partial<TermosContrato>) => mudar((a) => ({ ...a, termos: { ...a.termos, ...parcial } }));
  const alterarContratada = (parcial: Partial<ContratadaContrato>) =>
    mudar((a) => ({ ...a, contratada: { ...a.contratada, ...parcial } }));

  const escolherProposta = (p: Proposta | null) => {
    if (!p) {
      mudar((a) => ({ ...a, propostaId: '' }));
      return;
    }
    mudar((a) => aplicarProposta(a, p, leads.find((l) => l.id === p.leadId)));
    showToast('Proposta aplicada', 'info', `Dados da proposta ${p.numero} copiados para o contrato.`);
  };

  /** Salva se preciso e devolve o contrato com id; null se não deu. */
  const garantirSalvo = async (): Promise<Contrato | null> => {
    if (r.id && !alterado) return r;
    if (somenteLeitura) return r.id ? r : null;
    if (pendencias.length) {
      setModulo('contratante');
      showToast('Campos incompletos', 'error', pendencias[0]);
      return null;
    }
    setSalvando(true);
    try {
      const salvo = await onSalvar(r);
      setR(rascunhoDeContrato(salvo, config));
      setAlterado(false);
      return salvo;
    } catch {
      // O App já mostrou o erro do servidor.
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    const salvo = await garantirSalvo();
    if (salvo) showToast('Contrato salvo', 'success', `Contrato nº ${salvo.numero} — ${salvo.clienteNome}.`);
  };

  const abrirPDF = async () => {
    const salvo = await garantirSalvo();
    if (salvo) onAbrirPDF(salvo);
  };

  const enviar = async () => {
    const salvo = await garantirSalvo();
    if (salvo) onEnviar(salvo);
  };

  const voltar = () => {
    if (alterado && !window.confirm('Há alterações não salvas neste contrato. Sair mesmo assim?')) return;
    onVoltar();
  };

  /* ---------------------------------------------- pré-visualização --- */

  const areaPreviaRef = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(0.5);

  useEffect(() => {
    const el = areaPreviaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => setEscala(Math.min(1, Math.max(0.2, (el.clientWidth - 24) / LARGURA_FOLHA)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const secaoEmFoco = modulo === 'textos' ? secaoTexto : MODULOS.find((m) => m.id === modulo)?.secao ?? null;

  // Leva a pré-visualização até o trecho que o módulo aberto edita.
  // Um quadro depois: o módulo novo ainda está montando, e a renderização que
  // vem logo em seguida cancelava a rolagem suave iniciada aqui mesmo.
  useEffect(() => {
    const area = areaPreviaRef.current;
    if (!area || !secaoEmFoco) return;
    const quadro = requestAnimationFrame(() => {
      const el = area.querySelector<HTMLElement>(`[data-secao="${secaoEmFoco}"]`);
      if (!el) return;
      const topo = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 16;
      area.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(quadro);
  }, [secaoEmFoco]);

  const documento = useMemo(
    () =>
      legado && inicial ? (
        <ContratoLegado contrato={inicial} />
      ) : (
        <DocumentoContrato contrato={r} config={config} destacar secaoEmFoco={secaoEmFoco} />
      ),
    [legado, inicial, r, config, secaoEmFoco],
  );

  /* ----------------------------------------------------------- tela --- */

  const props = { r, alterar, alterarTermos, alterarContratada, somenteLeitura, config };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <button type="button" onClick={voltar} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para contratos
          </button>
          <h1 className="text-2xl font-extrabold text-[#004276]">
            {r.numero ? `Contrato nº ${r.numero}` : 'Novo contrato'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {r.clienteNome || 'Contratante a definir'}
            {proposta ? ` · gerado da proposta nº ${proposta.numero}` : ''}
            {alterado ? ' · alterações não salvas' : r.id ? ' · salvo' : ' · número gerado ao salvar'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!somenteLeitura && (
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando || (!!r.id && !alterado)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          )}
          <button
            type="button"
            onClick={() => void abrirPDF()}
            disabled={salvando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {somenteLeitura ? 'Abrir PDF' : 'Salvar e gerar PDF'}
          </button>
          {podeEnviar && (
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          )}
          {!assinado && podeEditar && r.id && (
            <button
              type="button"
              onClick={() => (alterado ? showToast('Salve antes de assinar', 'info', 'O contrato assinado fica travado com o que estiver salvo.') : onAssinar(r))}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como assinado
            </button>
          )}
        </div>
      </div>

      {somenteLeitura && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            {assinado ? (
              <>
                <strong>Contrato assinado{r.dataAssinatura ? ` em ${r.dataAssinatura}` : ''} — somente leitura.</strong>{' '}
                Para mudar o que foi acordado, emita um aditivo ou um novo contrato.
                {legado && ' Este contrato é anterior ao modelo atual e continua impresso como foi assinado.'}
              </>
            ) : (
              <strong>Você pode consultar este contrato, mas não tem permissão para alterá-lo.</strong>
            )}
          </p>
        </div>
      )}

      {/* Módulos */}
      <nav aria-label="Módulos do contrato" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {MODULOS.map((m) => {
          const Icone = m.icone;
          const ativo = m.id === modulo;
          const comPendencia = m.id === 'contratante' && pendencias.length > 0 && !somenteLeitura;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setModulo(m.id)}
              aria-current={ativo ? 'page' : undefined}
              className={`relative shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                ativo
                  ? 'bg-[#004276] text-white border-[#004276] shadow'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#004276] hover:text-[#004276]'
              }`}
            >
              <Icone className="w-3.5 h-3.5" />
              {m.rotulo}
              {comPendencia && <span className="w-2 h-2 rounded-full bg-amber-400" aria-label="falta preencher" />}
            </button>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Formulário do módulo */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          {modulo === 'contratante' && <ModuloContratante {...props} propostas={propostas} onEscolherProposta={escolherProposta} />}
          {modulo === 'contratada' && <ModuloContratada {...props} />}
          {modulo === 'objeto' && <ModuloObjetoAnexo {...props} proposta={proposta} />}
          {modulo === 'prazos' && <ModuloPrazos {...props} />}
          {modulo === 'pagamento' && <ModuloPagamento {...props} proposta={proposta} />}
          {modulo === 'garantias' && <ModuloGarantias {...props} />}
          {modulo === 'rescisao' && <ModuloRescisao {...props} />}
          {modulo === 'assinatura' && <ModuloAssinatura {...props} />}
          {modulo === 'textos' && <ModuloTextos {...props} onFocarSecao={setSecaoTexto} />}

          {pendencias.length > 0 && !somenteLeitura && (
            <ul className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-800 list-disc list-inside">
              {pendencias.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>

        {/* Pré-visualização */}
        <div className="xl:sticky xl:top-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5" />
              Pré-visualização
            </h3>
            <span className="text-[11px] text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200 align-middle mr-1" />
              falta preencher
            </span>
          </div>
          <div
            ref={areaPreviaRef}
            className="bg-slate-200/80 rounded-2xl p-3 overflow-y-auto max-h-[70vh] xl:max-h-[calc(100vh-7rem)]"
          >
            <div style={{ zoom: escala }}>{documento}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
