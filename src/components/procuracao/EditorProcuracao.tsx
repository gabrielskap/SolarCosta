// Editor da procuração em módulos, com o documento ao lado.
//
// Espelho do EditorContrato: serve para a procuração nova e para a salva; a
// assinada abre aqui também, só que travada (o servidor já recusa o PUT com
// 409). A pré-visualização é o MESMO DocumentoProcuracao que vai para o
// cliente, então o que se vê aqui é o que sai no PDF.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Eye, FileText, Landmark, Loader2, Lock, Printer, Save, Send, User, Users,
} from 'lucide-react';
import type { ChaveSecaoProcuracao, Contrato, Procuracao, TermosProcuracao } from '../../types';
import type { ConfigApp } from '../../services/api';
import { SECOES } from '../../procuracao/modeloProcuracao';
import { MARCADORES } from '../../procuracao/marcadores';
import { marcadoresDesconhecidos } from '../../procuracao/renderizar';
import {
  aplicarContrato, pendenciasObrigatorias, rascunhoDeProcuracao, rascunhoDoContrato, rascunhoNovo,
} from '../../procuracao/rascunho';
import { EditorTextosModelo } from '../documento/EditorTextosModelo';
import { ConfirmarAssinatura } from '../documento/ConfirmarAssinatura';
import { DocumentoProcuracao } from './DocumentoProcuracao';
import { ModuloOutorgante } from './modulos/ModuloOutorgante';
import { ModuloOutorgados } from './modulos/ModuloOutorgados';
import { ModuloProcesso } from './modulos/ModuloProcesso';

type IdModulo = 'outorgante' | 'outorgados' | 'processo' | 'textos';

const MODULOS: { id: IdModulo; rotulo: string; icone: React.ElementType; secao: ChaveSecaoProcuracao | null }[] = [
  { id: 'outorgante', rotulo: 'Outorgante', icone: User, secao: 'outorgante' },
  { id: 'outorgados', rotulo: 'Outorgados', icone: Users, secao: 'outorgados' },
  { id: 'processo', rotulo: 'Concessionária, local e data', icone: Landmark, secao: 'poderes' },
  { id: 'textos', rotulo: 'Texto da procuração', icone: FileText, secao: null },
];

/** Largura de projeto da folha (max-w-4xl), a mesma do PDFModal. */
const LARGURA_FOLHA = 896;

/** Dica do "Enviar" desligado — o mesmo texto na lista e no editor. */
export const TITULO_ENVIO_DESLIGADO =
  'O banco ainda não aceita enviar procuração: rode database/05_habilitar_envio_procuracao.sql como superusuário.';

/** As pendências do outorgante são as que não falam de outorgado. */
const doOutorgante = (pendencia: string) => !pendencia.includes('outorgado');

interface Props {
  /** null = procuração nova. */
  inicial: Procuracao | null;
  /** Procuração nova já preenchida com este contrato (ação "Procuração" da lista). */
  origem?: Contrato | null;
  contratos: Contrato[];
  config: ConfigApp | null;
  /** Permissão emitir_contratos. Sem ela o editor só mostra. */
  podeEditar: boolean;
  podeEnviar: boolean;
  /** Falso onde o banco ainda não aceita link/mensagem de procuração. */
  envioAtivo: boolean;
  /** Salva e devolve a procuração como o banco gravou (com id e número). */
  onSalvar: (p: Procuracao) => Promise<Procuracao>;
  /** `data` em AAAA-MM-DD. */
  onAssinar: (id: string, data: string) => Promise<void>;
  onAbrirPDF: (p: Procuracao) => void;
  onEnviar: (p: Procuracao) => void;
  onVoltar: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EditorProcuracao: React.FC<Props> = ({
  inicial, origem, contratos, config, podeEditar, podeEnviar, envioAtivo,
  onSalvar, onAssinar, onAbrirPDF, onEnviar, onVoltar, showToast,
}) => {
  const novo = () => (origem ? rascunhoDoContrato(origem, config) : rascunhoNovo(config));
  const [r, setR] = useState<Procuracao>(() => (inicial ? rascunhoDeProcuracao(inicial, config) : novo()));
  const [modulo, setModulo] = useState<IdModulo>('outorgante');
  const [secaoTexto, setSecaoTexto] = useState<ChaveSecaoProcuracao | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [assinando, setAssinando] = useState(false);

  // Procuração nova nasce antes de /api/config responder: quando ele chegar,
  // recomeça dos padrões do banco — desde que ninguém tenha digitado nada.
  useEffect(() => {
    if (!inicial && !alterado && config) setR(novo());
    // Só a chegada do config dispara: `alterado` e `inicial` são lidos no momento.
  }, [config]);

  const assinada = r.status === 'assinada';
  const somenteLeitura = assinada || !podeEditar;
  const pendencias = pendenciasObrigatorias(r);

  const mudar = (fn: (atual: Procuracao) => Procuracao) => {
    if (somenteLeitura) return;
    setR(fn);
    setAlterado(true);
  };
  const alterar = (parcial: Partial<Procuracao>) => mudar((a) => ({ ...a, ...parcial }));
  const alterarTermos = (parcial: Partial<TermosProcuracao>) => mudar((a) => ({ ...a, termos: { ...a.termos, ...parcial } }));

  const escolherContrato = (c: Contrato | null) => {
    if (!c) {
      mudar((a) => ({ ...a, contratoId: '', contratoNumero: '' }));
      return;
    }
    mudar((a) => aplicarContrato(a, c, config));
    showToast('Contrato aplicado', 'info', `Dados do contrato ${c.numero} copiados para a procuração.`);
  };

  /** Salva se preciso e devolve a procuração com id; null se não deu. */
  const garantirSalva = async (): Promise<Procuracao | null> => {
    if (r.id && !alterado) return r;
    if (somenteLeitura) return r.id ? r : null;
    if (pendencias.length) {
      setModulo(pendencias.some(doOutorgante) ? 'outorgante' : 'outorgados');
      showToast('Campos incompletos', 'error', pendencias[0]);
      return null;
    }
    setSalvando(true);
    try {
      const salva = await onSalvar(r);
      setR(rascunhoDeProcuracao(salva, config));
      setAlterado(false);
      return salva;
    } catch {
      // O App já mostrou o erro do servidor.
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    const salva = await garantirSalva();
    if (salva) showToast('Procuração salva', 'success', `Procuração nº ${salva.numero} — ${salva.clienteNome}.`);
  };

  const abrirPDF = async () => {
    const salva = await garantirSalva();
    if (salva) onAbrirPDF(salva);
  };

  const enviar = async () => {
    const salva = await garantirSalva();
    if (salva) onEnviar(salva);
  };

  const voltar = () => {
    if (alterado && !window.confirm('Há alterações não salvas nesta procuração. Sair mesmo assim?')) return;
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

  // Leva a pré-visualização até o trecho que o módulo aberto edita — um
  // quadro depois, pelo mesmo motivo do EditorContrato.
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
    () => <DocumentoProcuracao procuracao={r} config={config} destacar secaoEmFoco={secaoEmFoco} />,
    [r, config, secaoEmFoco],
  );

  /* ----------------------------------------------------------- tela --- */

  const props = { r, alterar, alterarTermos, somenteLeitura, config };
  const contrato = contratos.find((c) => c.id === r.contratoId);

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <button type="button" onClick={voltar} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para procurações
          </button>
          <h1 className="text-2xl font-extrabold text-[#004276]">
            {r.numero ? `Procuração nº ${r.numero}` : 'Nova procuração'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {r.clienteNome || 'Outorgante a definir'}
            {r.contratoNumero || contrato ? ` · do contrato nº ${r.contratoNumero || contrato?.numero}` : ''}
            {alterado ? ' · alterações não salvas' : r.id ? ' · salva' : ' · número gerado ao salvar'}
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
              disabled={salvando || !envioAtivo}
              title={envioAtivo ? undefined : TITULO_ENVIO_DESLIGADO}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          )}
          {!assinada && podeEditar && r.id && (
            <button
              type="button"
              onClick={() => (alterado ? showToast('Salve antes de assinar', 'info', 'A procuração assinada fica travada com o que estiver salvo.') : setAssinando(true))}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como assinada
            </button>
          )}
        </div>
      </div>

      {somenteLeitura && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            {assinada ? (
              <>
                <strong>Procuração assinada{r.dataAssinatura ? ` em ${r.dataAssinatura}` : ''} — somente leitura.</strong>{' '}
                Para mudar os poderes ou os outorgados, emita uma nova procuração.
              </>
            ) : (
              <strong>Você pode consultar esta procuração, mas não tem permissão para alterá-la.</strong>
            )}
          </p>
        </div>
      )}

      {/* Módulos */}
      <nav aria-label="Módulos da procuração" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {MODULOS.map((m) => {
          const Icone = m.icone;
          const ativo = m.id === modulo;
          const comPendencia =
            !somenteLeitura &&
            ((m.id === 'outorgante' && pendencias.some(doOutorgante)) ||
              (m.id === 'outorgados' && pendencias.some((p) => !doOutorgante(p))));
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
          {modulo === 'outorgante' && <ModuloOutorgante {...props} contratos={contratos} onEscolherContrato={escolherContrato} />}
          {modulo === 'outorgados' && <ModuloOutorgados {...props} />}
          {modulo === 'processo' && <ModuloProcesso {...props} />}
          {modulo === 'textos' && (
            <EditorTextosModelo<ChaveSecaoProcuracao>
              titulo="Texto da procuração"
              onde="Reescreva qualquer seção só nesta procuração. Os campos entre chaves continuam puxando os dados dos outros módulos."
              dicaRestaurar="Descarta o texto desta procuração e volta ao modelo"
              secoes={SECOES}
              marcadores={MARCADORES}
              textos={r.termos.textos ?? {}}
              onChange={(textos) => alterarTermos({ textos })}
              desconhecidos={marcadoresDesconhecidos}
              somenteLeitura={somenteLeitura}
              onFocarSecao={setSecaoTexto}
            />
          )}

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

      {assinando && (
        <ConfirmarAssinatura
          titulo="Marcar como assinada?"
          aviso="A procuração fica travada: nenhum dado ou texto poderá ser alterado depois."
          numero={r.numero}
          cliente={r.clienteNome}
          rotuloConfirmar="Sim, marcar como assinada"
          onConfirmar={async (data) => {
            await onAssinar(r.id, data);
            setAssinando(false);
          }}
          onCancelar={() => setAssinando(false)}
        />
      )}
    </div>
  );
};
