import React, { useState } from 'react';
import {
  HardHat, Zap, MapPin, Plus, X, Trash2, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, ClipboardCheck, User as UserIcon, CalendarClock, Package
} from 'lucide-react';
import {
  Obra, ObraEtapa, HomologacaoChecklist, Contrato, Proposta, Produto,
  User, HistoricoItem, PropostaItem
} from '../types';
import { today, toISODateStr } from '../utils/dates';

interface ObrasViewProps {
  obras: Obra[];
  contratos: Contrato[];
  propostas: Proposta[];
  produtos: Produto[];
  users: User[];
  currentUser: User;
  onSaveObra: (obra: Obra) => void;
  onDeleteObra: (id: string) => void;
  /** Baixa manual do kit de uma obra já existente. */
  onBaixarEstoque: (obraId: string) => void | Promise<void>;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const ETAPAS: ObraEtapa[] = [
  'Aguardando compra',
  'Projeto / ART',
  'Homologação',
  'Instalação',
  'Vistoria / troca',
  'Concluída'
];

const ETAPA_PROGRESSO: Record<ObraEtapa, number> = {
  'Aguardando compra': 10,
  'Projeto / ART': 30,
  'Homologação': 50,
  'Instalação': 70,
  'Vistoria / troca': 90,
  'Concluída': 100
};

const ETAPA_COR: Record<ObraEtapa, string> = {
  'Aguardando compra': '#f59e0b',
  'Projeto / ART': '#8b5cf6',
  'Homologação': '#06b6d4',
  'Instalação': '#3b82f6',
  'Vistoria / troca': '#ec4899',
  'Concluída': '#10b981'
};

const HOMOLOGACAO_ITEMS: { key: keyof HomologacaoChecklist; label: string }[] = [
  { key: 'solicitacaoAcesso', label: 'Solicitação de acesso enviada à distribuidora' },
  { key: 'parecerAcesso', label: 'Parecer de acesso aprovado' },
  { key: 'vistoriaAgendada', label: 'Vistoria agendada' },
  { key: 'vistoriaAprovada', label: 'Vistoria aprovada' },
  { key: 'trocaMedidor', label: 'Troca do medidor bidirecional' },
  { key: 'relatorioConexao', label: 'Relatório de conexão / energização (TRC)' }
];

const emptyHomologacao = (): HomologacaoChecklist => ({
  solicitacaoAcesso: false,
  parecerAcesso: false,
  vistoriaAgendada: false,
  vistoriaAprovada: false,
  trocaMedidor: false,
  relatorioConexao: false
});

const hoje = () => toISODateStr(today());

const isAtrasada = (o: Obra): boolean =>
  o.status !== 'concluida' && !!o.previsaoConclusao && o.previsaoConclusao < hoje();

const homologacaoDone = (h: HomologacaoChecklist): number =>
  HOMOLOGACAO_ITEMS.reduce((acc, item) => acc + (h[item.key] ? 1 : 0), 0);

const formatDateBR = (iso?: string): string => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const ObrasView: React.FC<ObrasViewProps> = ({
  obras,
  contratos,
  propostas,
  produtos,
  users,
  currentUser,
  onSaveObra,
  onDeleteObra,
  onBaixarEstoque,
  showToast
}) => {
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [novaNota, setNovaNota] = useState('');

  // ---- New obra form state ----
  const [fContratoId, setFContratoId] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [fCidade, setFCidade] = useState('');
  const [fEndereco, setFEndereco] = useState('');
  const [fConcessionaria, setFConcessionaria] = useState('CEMIG');
  const [fPotencia, setFPotencia] = useState(0);
  const [fModulos, setFModulos] = useState(0);
  const [fModulo, setFModulo] = useState('');
  const [fInversor, setFInversor] = useState('');
  const [fResponsavel, setFResponsavel] = useState('');
  const [fEquipe, setFEquipe] = useState('');
  const [fValor, setFValor] = useState(0);
  const [fPrevisao, setFPrevisao] = useState('');

  const engenheiros = users.filter(u => u.cargo === 'Engenheiro' || u.cargo === 'Administrador');
  const instaladores = users.filter(u => u.cargo === 'Instalador' || u.cargo === 'Engenheiro');

  const nextNumero = (): string => {
    const nums = obras.map(o => parseInt(o.numero.match(/\d+/)?.[0] || '0', 10));
    const max = nums.length ? Math.max(...nums) : 183;
    return `OBRA ${String(max + 1).padStart(4, '0')}`;
  };

  // KPIs
  const emAndamento = obras.filter(o => o.status !== 'concluida').length;
  const atrasadas = obras.filter(isAtrasada).length;
  const concluidas = obras.filter(o => o.status === 'concluida').length;
  const potenciaInstalando = obras
    .filter(o => o.status !== 'concluida')
    .reduce((acc, o) => acc + (o.potenciaKwp || 0), 0);

  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return (name || '?').slice(0, 2).toUpperCase();
  };

  const addHistorico = (o: Obra, descricao: string): HistoricoItem[] => {
    const item: HistoricoItem = {
      id: `oh-${Date.now()}`,
      data: new Date().toLocaleDateString('pt-BR'),
      descricao,
      usuario: currentUser.nome
    };
    return [item, ...(o.historico || [])];
  };

  // ---- Drag & drop ----
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, targetEtapa: ObraEtapa) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    if (!id) return;
    const obra = obras.find(o => o.id === id);
    if (!obra || obra.etapa === targetEtapa) {
      setDraggedId(null);
      return;
    }
    const concluida = targetEtapa === 'Concluída';
    const updated: Obra = {
      ...obra,
      etapa: targetEtapa,
      status: concluida ? 'concluida' : 'em_andamento',
      dataConclusao: concluida ? hoje() : obra.dataConclusao,
      historico: addHistorico(obra, `Etapa alterada para "${targetEtapa}".`)
    };
    onSaveObra(updated);
    setDraggedId(null);
    showToast('Etapa atualizada', 'success', `${obra.numero} movida para "${targetEtapa}".`);
  };

  // ---- Homologação checklist toggle ----
  const toggleHomologacao = (obra: Obra, key: keyof HomologacaoChecklist) => {
    const novoValor = !obra.homologacao[key];
    const novaHomologacao = { ...obra.homologacao, [key]: novoValor };
    const label = HOMOLOGACAO_ITEMS.find(i => i.key === key)?.label || key;
    const updated: Obra = {
      ...obra,
      homologacao: novaHomologacao,
      historico: addHistorico(obra, `${novoValor ? '✓' : '✗'} Homologação: ${label}.`)
    };
    onSaveObra(updated);
    setSelectedObra(updated);
  };

  const handleAvancarEtapa = (obra: Obra) => {
    const idx = ETAPAS.indexOf(obra.etapa);
    if (idx >= ETAPAS.length - 1) {
      showToast('Etapa final', 'info', 'A obra já está concluída.');
      return;
    }
    const proxima = ETAPAS[idx + 1];
    const concluida = proxima === 'Concluída';
    const updated: Obra = {
      ...obra,
      etapa: proxima,
      status: concluida ? 'concluida' : 'em_andamento',
      dataConclusao: concluida ? hoje() : obra.dataConclusao,
      historico: addHistorico(obra, `Etapa avançada para "${proxima}".`)
    };
    onSaveObra(updated);
    setSelectedObra(updated);
    showToast('Etapa avançada', 'success', `${obra.numero} agora em "${proxima}".`);
  };

  const handleAddNota = (obra: Obra) => {
    if (!novaNota.trim()) return;
    const updated: Obra = { ...obra, historico: addHistorico(obra, novaNota.trim()) };
    onSaveObra(updated);
    setSelectedObra(updated);
    setNovaNota('');
    showToast('Anotação registrada', 'success', 'Nova ocorrência no histórico da obra.');
  };

  const handleDelete = (obra: Obra) => {
    onDeleteObra(obra.id);
    setSelectedObra(null);
    showToast('Obra removida', 'info', `${obra.numero} excluída.`);
  };

  // ---- New obra ----
  const prefillFromContrato = (contratoId: string) => {
    setFContratoId(contratoId);
    const c = contratos.find(x => x.id === contratoId);
    if (!c) return;
    setFCliente(c.clienteNome);
    setFCidade(c.endereco.split('–').pop()?.trim() || c.endereco);
    setFEndereco(c.localInstalacao || c.endereco);
    setFPotencia(c.potenciaKwp);
    setFModulos(c.modulosQtd);
    setFModulo(c.moduloModelo);
    setFInversor(c.inversorModelo);
    setFValor(c.valorTotal);
  };

  const openNew = () => {
    setFContratoId('');
    setFCliente('');
    setFCidade('');
    setFEndereco('');
    setFConcessionaria('CEMIG');
    setFPotencia(0);
    setFModulos(0);
    setFModulo('');
    setFInversor('');
    setFResponsavel(engenheiros[0]?.nome || '');
    setFEquipe(instaladores[0]?.nome || 'A definir');
    setFValor(0);
    setFPrevisao('');
    setIsNewOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fCliente.trim()) {
      showToast('Cliente obrigatório', 'error', 'Informe o cliente da obra.');
      return;
    }
    const contrato = contratos.find(c => c.id === fContratoId);
    const proposta = contrato
      ? propostas.find(p => p.leadId === contrato.leadId || p.id === contrato.leadId)
      : undefined;
    const kit = proposta?.kitItens?.filter(i => i.produtoId) || [];

    const obra: Obra = {
      id: `obra-${Date.now()}`,
      numero: nextNumero(),
      contratoId: contrato?.id,
      leadId: contrato?.leadId,
      propostaId: proposta?.id,
      clienteNome: fCliente.trim(),
      cidade: fCidade.trim(),
      endereco: fEndereco.trim(),
      concessionaria: fConcessionaria,
      potenciaKwp: Number(fPotencia) || 0,
      modulosQtd: Number(fModulos) || 0,
      moduloModelo: fModulo.trim(),
      inversorModelo: fInversor.trim(),
      responsavelTecnico: fResponsavel,
      equipeInstalacao: fEquipe,
      etapa: 'Aguardando compra',
      status: 'em_andamento',
      valorObra: Number(fValor) || 0,
      dataInicio: hoje(),
      previsaoConclusao: fPrevisao || '',
      homologacao: emptyHomologacao(),
      kitItens: kit.length ? kit : undefined,
      estoqueBaixado: false,
      observacoes: '',
      historico: [
        {
          id: `oh-${Date.now()}`,
          data: new Date().toLocaleDateString('pt-BR'),
          descricao: contrato
            ? `Obra aberta a partir do contrato nº ${contrato.numero}.`
            : 'Obra criada manualmente.',
          usuario: currentUser.nome
        }
      ]
    };

    // Baixa de estoque do kit vinculado.
    // A baixa em si acontece no servidor, na MESMA transação que cria a obra
    // (a obra precisa existir antes de consumir estoque em nome dela). Aqui só
    // sinalizamos a intenção com `estoqueBaixado`.
    if (kit.length) {
      obra.estoqueBaixado = true;
      obra.historico = [
        {
          id: `oh-${Date.now() + 1}`,
          data: new Date().toLocaleDateString('pt-BR'),
          descricao: `Kit reservado: baixa de ${kit.reduce((a, i) => a + i.qtd, 0)} itens no estoque.`,
          usuario: currentUser.nome
        },
        ...obra.historico
      ];
    }

    onSaveObra(obra);
    setIsNewOpen(false);
    showToast(
      'Obra aberta',
      'success',
      kit.length
        ? `${obra.numero} criada e kit baixado do estoque.`
        : `${obra.numero} criada com sucesso.`
    );
  };

  const statusBadge = (o: Obra) => {
    if (o.status === 'concluida') {
      return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> Concluída</span>;
    }
    if (isAtrasada(o)) {
      return <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-bold"><AlertTriangle className="w-3 h-3" /> Atrasada</span>;
    }
    return <span className="inline-flex items-center gap-1 bg-blue-100 text-[#004276] px-2 py-0.5 rounded-full text-[10px] font-bold"><Clock className="w-3 h-3" /> Em andamento</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276] flex items-center gap-2">
            <HardHat className="w-6 h-6" /> Obras &amp; Instalação
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Acompanhamento pós-venda: compra, projeto, homologação, instalação e vistoria
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-[#004276] hover:bg-[#003159] text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-md shrink-0 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nova obra</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em andamento</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><HardHat className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">{emAndamento}</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">obras ativas</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Atrasadas</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-black text-rose-700 mt-2">{atrasadas}</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">previsão vencida</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Concluídas</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-black text-emerald-700 mt-2">{concluidas}</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">energizadas</p>
        </div>
        <div className="bg-[#004276] text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Potência em obra</span>
            <div className="p-2 rounded-xl bg-blue-900/50 text-amber-400"><Zap className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-black text-white mt-2">{potenciaInstalando.toFixed(2)} <span className="text-sm font-bold text-blue-200">kWp</span></h2>
          <p className="text-[11px] text-blue-200 font-medium mt-0.5">instalando agora</p>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-6">
        {ETAPAS.map(etapa => {
          const etapaObras = obras.filter(o => o.etapa === etapa);
          const totalPot = etapaObras.reduce((a, o) => a + (o.potenciaKwp || 0), 0);
          return (
            <div
              key={etapa}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, etapa)}
              className="bg-slate-100/90 rounded-2xl p-3 flex flex-col gap-3 min-w-[240px] border border-slate-200/80"
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ETAPA_COR[etapa] }} />
                  <h3 className="font-bold text-xs text-slate-800 truncate">{etapa}</h3>
                </div>
                <span className="bg-white text-slate-600 font-bold px-2 py-0.5 rounded-full text-[11px] border border-slate-200">
                  {etapaObras.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold -mt-2">{totalPot.toFixed(1)} kWp</p>

              <div className="flex-1 space-y-3 min-h-[300px]">
                {etapaObras.map(o => {
                  const hDone = homologacaoDone(o.homologacao);
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, o.id)}
                      onClick={() => { setSelectedObra(o); setNovaNota(''); }}
                      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/90 hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">{o.numero}</span>
                        {isAtrasada(o) && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                        {o.status === 'concluida' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#004276] leading-snug">{o.clienteNome}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />{o.cidade}
                      </p>
                      <p className="text-xs font-bold text-[#004276] mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />{o.potenciaKwp} kWp · {o.modulosQtd} mód.
                      </p>

                      {/* Progresso da etapa */}
                      <div className="mt-2.5">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${ETAPA_PROGRESSO[o.etapa]}%`, backgroundColor: ETAPA_COR[o.etapa] }} />
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-[#004276] font-bold text-[9px] flex items-center justify-center shrink-0">
                            {getInitials(o.responsavelTecnico)}
                          </span>
                          <span className="truncate">{(o.responsavelTecnico || '').split(' ')[0]}</span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded" title="Itens de homologação concluídos">
                          <ClipboardCheck className="w-3 h-3" />{hDone}/6
                        </span>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={openNew}
                  className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-white text-slate-500 hover:text-[#004276] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /><span>+ Obra</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selectedObra && (() => {
        const o = selectedObra;
        const hDone = homologacaoDone(o.homologacao);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-[#004276] text-white p-5 flex items-start justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-200">{o.numero}</span>
                    {statusBadge(o)}
                  </div>
                  <h3 className="font-bold text-lg mt-0.5">{o.clienteNome}</h3>
                  <p className="text-xs text-blue-200 mt-0.5">{o.endereco} · {o.cidade}</p>
                </div>
                <button onClick={() => setSelectedObra(null)} className="text-slate-300 hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto">
                {/* Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: 'Potência', v: `${o.potenciaKwp} kWp`, icon: Zap },
                    { l: 'Módulos', v: `${o.modulosQtd} un`, icon: Package },
                    { l: 'Valor da obra', v: `R$ ${o.valorObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: null },
                    { l: 'Concessionária', v: o.concessionaria, icon: null }
                  ].map((s, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{s.l}</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{s.v}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600"><Package className="w-4 h-4 text-slate-400" /><span className="font-semibold">Módulo:</span> {o.moduloModelo || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><Package className="w-4 h-4 text-slate-400" /><span className="font-semibold">Inversor:</span> {o.inversorModelo || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><UserIcon className="w-4 h-4 text-slate-400" /><span className="font-semibold">Resp. técnico:</span> {o.responsavelTecnico || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><HardHat className="w-4 h-4 text-slate-400" /><span className="font-semibold">Equipe:</span> {o.equipeInstalacao || '—'}</div>
                  <div className="flex items-center gap-2 text-slate-600"><CalendarClock className="w-4 h-4 text-slate-400" /><span className="font-semibold">Início:</span> {formatDateBR(o.dataInicio)}</div>
                  <div className={`flex items-center gap-2 ${isAtrasada(o) ? 'text-rose-600' : 'text-slate-600'}`}><CalendarClock className="w-4 h-4" /><span className="font-semibold">Previsão:</span> {formatDateBR(o.previsaoConclusao)}</div>
                </div>

                {/* Etapa + avançar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Etapa atual</span>
                    <p className="font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ETAPA_COR[o.etapa] }} />
                      {o.etapa} <span className="text-slate-400 font-normal">({ETAPA_PROGRESSO[o.etapa]}%)</span>
                    </p>
                  </div>
                  {o.etapa !== 'Concluída' && (
                    <button
                      onClick={() => handleAvancarEtapa(o)}
                      className="bg-[#004276] hover:bg-[#003159] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
                    >
                      Avançar etapa <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Homologação checklist */}
                <div className="border border-cyan-200 bg-cyan-50/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-cyan-600" /> Homologação na distribuidora
                    </h4>
                    <span className="text-xs font-bold text-cyan-700">{hDone}/6 concluídos</span>
                  </div>
                  <div className="h-1.5 w-full bg-cyan-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${(hDone / 6) * 100}%` }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HOMOLOGACAO_ITEMS.map(item => {
                      const done = o.homologacao[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleHomologacao(o, item.key)}
                          className={`flex items-start gap-2 text-left p-2.5 rounded-lg border text-xs transition ${
                            done ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-300'
                          }`}
                        >
                          {done
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            : <span className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />}
                          <span className="font-medium leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Observações */}
                {o.observacoes && (
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                    <span className="font-bold uppercase text-[10px] block mb-1">Observações</span>
                    {o.observacoes}
                  </div>
                )}

                {/* Histórico */}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-2">Histórico da obra</h4>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddNota(o); }}
                      placeholder="Registrar ocorrência (ex.: entrega do kit, medição concluída)..."
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#004276]"
                    />
                    <button onClick={() => handleAddNota(o)} className="bg-[#004276] text-white font-bold px-3 rounded-xl text-xs shrink-0">Registrar</button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(o.historico || []).map(h => (
                      <div key={h.id} className="flex items-start gap-2.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-[#004276] mt-1.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-800 leading-tight">{h.descricao}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{h.data} · {h.usuario}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
                <button
                  onClick={() => handleDelete(o)}
                  className="text-rose-600 hover:bg-rose-50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir obra
                </button>
                <button onClick={() => setSelectedObra(null)} className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* New obra modal */}
      {isNewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[#004276] text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg">Abrir nova obra</h3>
              <button onClick={() => setIsNewOpen(false)} className="text-slate-300 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Origem contrato */}
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Gerar a partir do contrato (opcional)</label>
                <select
                  value={fContratoId}
                  onChange={(e) => e.target.value ? prefillFromContrato(e.target.value) : setFContratoId('')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="">— Preencher manualmente —</option>
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>Nº {c.numero} · {c.clienteNome} · {c.potenciaKwp} kWp</option>
                  ))}
                </select>
                {fContratoId && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> O kit vinculado à proposta terá baixa automática no estoque.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-600 uppercase mb-1">Cliente *</label>
                  <input type="text" required value={fCliente} onChange={(e) => setFCliente(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Cidade / UF</label>
                  <input type="text" value={fCidade} onChange={(e) => setFCidade(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Concessionária</label>
                  <select value={fConcessionaria} onChange={(e) => setFConcessionaria(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                    <option value="CEMIG">CEMIG</option>
                    <option value="ENEL">ENEL</option>
                    <option value="CPFL">CPFL</option>
                    <option value="LIGHT">LIGHT</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-600 uppercase mb-1">Endereço da instalação</label>
                  <input type="text" value={fEndereco} onChange={(e) => setFEndereco(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Potência (kWp)</label>
                  <input type="number" step="0.01" value={fPotencia} onChange={(e) => setFPotencia(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Nº de módulos</label>
                  <input type="number" value={fModulos} onChange={(e) => setFModulos(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Módulo</label>
                  <input type="text" value={fModulo} onChange={(e) => setFModulo(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Inversor</label>
                  <input type="text" value={fInversor} onChange={(e) => setFInversor(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Responsável técnico</label>
                  <select value={fResponsavel} onChange={(e) => setFResponsavel(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                    {engenheiros.length === 0 && <option value="">—</option>}
                    {engenheiros.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Equipe de instalação</label>
                  <select value={fEquipe} onChange={(e) => setFEquipe(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                    <option value="A definir">A definir</option>
                    {instaladores.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Valor da obra (R$)</label>
                  <input type="number" step="0.01" value={fValor} onChange={(e) => setFValor(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Previsão de conclusão</label>
                  <input type="date" value={fPrevisao} onChange={(e) => setFPrevisao(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsNewOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow">Abrir obra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
