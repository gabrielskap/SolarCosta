import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, FileText, Loader2, Paperclip, Plus, ScrollText, Search, Send, Users, X,
} from 'lucide-react';
import { ErroApi } from '../../services/http';
import { WhatsApp, type ModeloMensagem } from '../../services/whatsapp';
import { formatCurrencyBRL, maskPhone, onlyDigits } from '../../utils/format';
import type { Contrato, Lead, Proposta } from '../../types';
import { BotoesMarcador, inserirMarcador, PreviaMensagem } from './PreviaMensagem';

/*
 * Compor uma mensagem e mandar.
 *
 * É a tela que o EnviarPorWhatsApp (aberto da lista de propostas) nunca foi:
 * ali o documento já estava escolhido e o destinatário era o do cadastro. Aqui
 * se parte da mensagem, escolhe-se o que anexar e para quem vai — inclusive
 * para um número que não está em cadastro nenhum.
 *
 * O QUE "ANEXAR" SIGNIFICA: o cliente recebe o PDF de verdade, como arquivo no
 * WhatsApp, com a mensagem de legenda. Quem imprime é o servidor — abre a
 * página pública do documento num Chromium e manda o resultado pelo
 * /send/media da uazapi (ver server/src/services/pdfDocumento.ts). O front não
 * monta nem vê o arquivo: só pede o envio e mostra o progresso.
 *
 * Por isso o envio de documento demora mais que o de texto, principalmente o
 * primeiro depois de um deploy: o navegador do servidor precisa subir. Daí o
 * contador "Enviando 1/3…" no botão, em vez de um spinner mudo.
 *
 * NÃO HÁ ROTA NOVA POR TRÁS DISTO. Cada destinatário é uma chamada ao mesmo
 * /enviar que a lista de propostas já usava, em série. Um lote transacional no
 * servidor pareceria mais limpo e seria pior: se o quinto número falhasse, os
 * quatro primeiros já teriam recebido, e desfazer a linha no banco não desfaz a
 * mensagem no celular de ninguém.
 */

interface Props {
  conectada: boolean;
  leads: Lead[];
  propostas: Proposta[];
  contratos: Contrato[];
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  /** Avisa o shell para a aba Histórico recarregar quando for aberta. */
  onEnviado: () => void;
}

type Modo = 'livre' | 'modelo';
type TipoAnexo = 'nenhum' | 'proposta' | 'contrato';
type ModoDestinatario = 'lead' | 'telefone';

interface Destinatario {
  /** Id do lead, ou os dígitos do telefone quando é avulso. */
  chave: string;
  nome: string;
  /** Como foi digitado/mascarado. Quem normaliza para DDI é o servidor. */
  telefone: string;
  leadId: string | null;
}

/** Item de lista do seletor de anexo, achatado a partir de Proposta/Contrato. */
interface Documento {
  id: string;
  numero: string;
  clienteNome: string;
  telefone: string;
  leadId: string;
  valorTotal: number;
  status: string;
}

/** Quantos leads/documentos mostrar sem busca. A lista pode ter milhares. */
const TETO_LISTA = 25;

/**
 * Teto de destinatários por envio.
 *
 * Não é limitação técnica: o WhatsApp restringe número que dispara em massa, e
 * a conta bloqueada é a da empresa. O sintoma chegaria como "o sistema parou de
 * mandar mensagem", com o motivo escondido no `ultimo_erro` da instância.
 */
const TETO_DESTINATARIOS = 20;

const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';
const ROTULO = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

/** Par (ou trio) de pílulas — o mesmo desenho em modo, anexo e destinatário. */
function Alternador<T extends string>({
  valor,
  opcoes,
  onEscolher,
}: {
  valor: T;
  opcoes: { id: T; rotulo: string }[];
  onEscolher: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onEscolher(o.id)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition ${
            valor === o.id
              ? 'bg-white text-[#004276] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export const AbaEnviar: React.FC<Props> = ({
  conectada,
  leads,
  propostas,
  contratos,
  showToast,
  onEnviado,
}) => {
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(true);

  const [modo, setModo] = useState<Modo>('livre');
  const [modeloId, setModeloId] = useState('');
  const [textoLivre, setTextoLivre] = useState('');
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  const [tipoAnexo, setTipoAnexo] = useState<TipoAnexo>('nenhum');
  /**
   * O documento inteiro, não só o id: a lista é cortada em TETO_LISTA e
   * refiltrada a cada tecla, então o escolhido pode sair dela. Guardando só o
   * id, o anexo continuaria valendo no envio mas sumiria da tela — e quem
   * estivesse procurando outro acharia que tinha perdido a seleção.
   */
  const [doc, setDoc] = useState<Documento | null>(null);
  const [buscaDoc, setBuscaDoc] = useState('');

  const [modoDest, setModoDest] = useState<ModoDestinatario>('lead');
  const [buscaLead, setBuscaLead] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telefoneAvulso, setTelefoneAvulso] = useState('');
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [feitos, setFeitos] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        setModelos(await WhatsApp.modelos());
      } catch {
        // Sem modelos a tela continua útil: escreve-se a mensagem à mão.
      } finally {
        setCarregandoModelos(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------ anexo -- */

  /**
   * Propostas e contratos já estão na memória desde o login (carregarTudo), com
   * o registro inteiro — inclusive o telefone, que a listagem da API não traz.
   * Buscar de novo aqui seria ida ao servidor para um dado que está na aba ao
   * lado, e é o mesmo raciocínio do VincularLead.
   */
  const documentos = useMemo<Documento[]>(() => {
    if (tipoAnexo === 'nenhum') return [];

    const lista: Documento[] =
      tipoAnexo === 'proposta'
        ? propostas.map((p) => ({
            id: p.id,
            numero: p.numero,
            clienteNome: p.clienteNome,
            telefone: p.telefone,
            leadId: p.leadId,
            valorTotal: p.valorTotal,
            status: p.status,
          }))
        : contratos.map((c) => ({
            id: c.id,
            numero: c.numero,
            clienteNome: c.clienteNome,
            telefone: c.telefone,
            leadId: c.leadId,
            valorTotal: c.valorTotal,
            status: c.status,
          }));

    const termo = buscaDoc.trim().toLowerCase();
    const filtrados = termo
      ? lista.filter(
          (d) =>
            d.numero.toLowerCase().includes(termo) || d.clienteNome.toLowerCase().includes(termo),
        )
      : lista;

    return filtrados.slice(0, TETO_LISTA);
  }, [tipoAnexo, buscaDoc, propostas, contratos]);

  /**
   * TODOS os modelos ativos aparecem, agrupados por contexto.
   *
   * A primeira versão filtrava a lista pelo anexo escolhido — só modelos de
   * `proposta` com uma proposta anexada, e assim por diante. A intenção era
   * evitar texto sem sentido; o efeito foi esconder três dos quatro modelos e
   * fazer parecer que eles não tinham sido salvos.
   *
   * Esconder opção para prevenir erro é o tipo de ajuda que atrapalha: o
   * `<optgroup>` já deixa claro para que serve cada um, e o aviso mais abaixo
   * explica a consequência real quando a escolha não combina com o anexo —
   * sem tirar a escolha de quem está mandando a mensagem.
   */
  const gruposDeModelo = useMemo(() => {
    const ordem: { contexto: ModeloMensagem['contexto']; rotulo: string }[] = [
      { contexto: 'proposta', rotulo: 'Proposta' },
      { contexto: 'contrato', rotulo: 'Contrato' },
      { contexto: 'lead', rotulo: 'Lead' },
      { contexto: 'livre', rotulo: 'Livre' },
    ];
    return ordem
      .map((g) => ({ ...g, itens: modelos.filter((m) => m.contexto === g.contexto) }))
      .filter((g) => g.itens.length > 0);
  }, [modelos]);

  const trocarTipoAnexo = (tipo: TipoAnexo) => {
    setTipoAnexo(tipo);
    setDoc(null);
    setBuscaDoc('');
  };

  const escolherDocumento = (escolhido: Documento) => {
    setDoc(escolhido);
    if (!onlyDigits(escolhido.telefone)) return;

    // O cliente do documento é o destinatário provável. Entra sozinho, e sai
    // com um clique se quem manda quiser outro número — cadastro envelhece.
    setDestinatarios((atuais) => {
      const digitos = onlyDigits(escolhido.telefone);
      if (atuais.some((d) => onlyDigits(d.telefone) === digitos)) return atuais;
      if (atuais.length >= TETO_DESTINATARIOS) return atuais;
      return [
        ...atuais,
        {
          chave: escolhido.leadId || digitos,
          nome: escolhido.clienteNome,
          telefone: maskPhone(escolhido.telefone),
          leadId: escolhido.leadId || null,
        },
      ];
    });
  };

  /* ---------------------------------------------------- destinatários -- */

  const leadsFiltrados = useMemo(() => {
    const termo = buscaLead.trim().toLowerCase();
    const digitos = onlyDigits(buscaLead);
    if (!termo) return leads.slice(0, TETO_LISTA);
    return leads
      .filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          l.numero.toLowerCase().includes(termo) ||
          (digitos.length >= 4 && onlyDigits(l.telefone).includes(digitos)),
      )
      .slice(0, TETO_LISTA);
  }, [buscaLead, leads]);

  const adicionar = (novo: Destinatario): void => {
    if (!onlyDigits(novo.telefone)) {
      showToast('Sem telefone', 'error', `${novo.nome} não tem número de WhatsApp no cadastro.`);
      return;
    }
    if (destinatarios.length >= TETO_DESTINATARIOS) {
      showToast(
        'Limite de destinatários',
        'error',
        `São ${TETO_DESTINATARIOS} por envio. Acima disso o WhatsApp restringe o número da empresa.`,
      );
      return;
    }
    setDestinatarios((atuais) => {
      const digitos = onlyDigits(novo.telefone);
      if (atuais.some((d) => onlyDigits(d.telefone) === digitos)) return atuais;
      return [...atuais, novo];
    });
  };

  const adicionarAvulso = () => {
    if (!onlyDigits(telefoneAvulso)) {
      showToast('Informe o telefone', 'error', 'Com DDD — por exemplo (31) 98658-8456.');
      return;
    }
    adicionar({
      chave: onlyDigits(telefoneAvulso),
      nome: nomeAvulso.trim() || 'Sem nome',
      telefone: telefoneAvulso,
      leadId: null,
    });
    setNomeAvulso('');
    setTelefoneAvulso('');
  };

  /* ------------------------------------------------------------ envio -- */

  const modeloEscolhido = modelos.find((m) => m.id === modeloId) ?? null;
  const textoEfetivo = modo === 'modelo' ? (modeloEscolhido?.texto ?? '') : textoLivre;

  /** Modelo herdado da época do link, que agora deixaria a frase pela metade. */
  const modeloComLink = textoEfetivo.includes('{{link}}');

  /**
   * Modelo de documento escolhido sem o documento correspondente.
   *
   * Só `proposta` e `contrato` entram nesta conta: são os únicos que citam
   * {{numero}}, {{valor}}, {{validade}} e {{economia_mensal}}, que o servidor
   * só sabe preencher a partir do documento anexado. `lead` e `livre` usam
   * apenas nome, consultor e empresa, que existem em qualquer envio.
   */
  const modeloForaDoAnexo =
    modo === 'modelo' &&
    !!modeloEscolhido &&
    (modeloEscolhido.contexto === 'proposta' || modeloEscolhido.contexto === 'contrato') &&
    modeloEscolhido.contexto !== tipoAnexo;

  const temMensagem = modo === 'modelo' ? !!modeloId : textoLivre.trim().length > 0;
  const anexoPendente = tipoAnexo !== 'nenhum' && !doc;
  const podeEnviar =
    conectada && !enviando && temMensagem && !anexoPendente && destinatarios.length > 0;

  const motivoBloqueio = !conectada
    ? 'Conecte o número da empresa para poder enviar.'
    : anexoPendente
      ? `Escolha qual ${tipoAnexo} anexar, ou volte para "Sem anexo".`
      : !temMensagem
        ? 'Escreva a mensagem ou escolha um modelo.'
        : destinatarios.length === 0
          ? 'Adicione ao menos um destinatário.'
          : null;

  const enviar = async () => {
    if (
      destinatarios.length > 1 &&
      !window.confirm(
        `Enviar esta mensagem para ${destinatarios.length} destinatários? Cada um recebe uma mensagem separada.`,
      )
    ) {
      return;
    }

    setEnviando(true);
    setFeitos(0);

    const falhas: { chave: string; nome: string; motivo: string }[] = [];
    let enviadas = 0;

    // Em série, não em Promise.all: o servidor consulta a uazapi a cada envio
    // (o número tem WhatsApp? a instância respondeu?), e disparar tudo de uma
    // vez multiplica a chance de tomar o 429 de limite e perder o lote inteiro.
    for (const d of destinatarios) {
      try {
        await WhatsApp.enviar({
          telefone: d.telefone,
          texto: modo === 'livre' ? textoLivre : undefined,
          modeloId: modo === 'modelo' ? modeloId : undefined,
          referencia:
            doc && tipoAnexo !== 'nenhum' ? { tipo: tipoAnexo, id: doc.id } : undefined,
          leadId: d.leadId ?? undefined,
        });
        enviadas += 1;
      } catch (e) {
        falhas.push({
          chave: d.chave,
          nome: d.nome,
          motivo: e instanceof ErroApi ? e.mensagemCompleta : 'falhou',
        });
      }
      setFeitos((n) => n + 1);
    }

    setEnviando(false);

    if (falhas.length === 0) {
      showToast(
        enviadas === 1 ? 'Mensagem enviada' : `${enviadas} mensagens enviadas`,
        'success',
        doc
          ? `${doc.numero} foi anexado em PDF, com a mensagem de legenda.`
          : undefined,
      );
      // Limpa tudo: manter o documento selecionado depois de um envio bem
      // sucedido é o caminho mais curto para mandar a mesma proposta duas vezes.
      setDestinatarios([]);
      setTextoLivre('');
      setModeloId('');
      setDoc(null);
      setTipoAnexo('nenhum');
    } else {
      showToast(
        `${enviadas} de ${destinatarios.length} enviadas`,
        'error',
        falhas.map((f) => `${f.nome}: ${f.motivo}`).join(' · '),
      );
      // Quem falhou fica na lista para uma segunda tentativa; quem recebeu sai,
      // senão o reenvio duplicaria a mensagem dele. Filtra por `chave` e não
      // por nome: dois avulsos sem nome colidiriam, e o que recebeu ficaria na
      // lista pronto para receber de novo.
      const comFalha = new Set(falhas.map((f) => f.chave));
      setDestinatarios((atuais) => atuais.filter((d) => comFalha.has(d.chave)));
    }

    onEnviado();
  };

  /* ------------------------------------------------------------- tela -- */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* --------------------------------------------------- composição -- */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <Alternador<Modo>
          valor={modo}
          opcoes={[
            { id: 'livre', rotulo: 'Texto livre' },
            { id: 'modelo', rotulo: 'Usar modelo' },
          ]}
          onEscolher={setModo}
        />

        {modo === 'livre' ? (
          <div>
            <label className={ROTULO} htmlFor="wa-texto">
              Mensagem
            </label>
            <BotoesMarcador
              onInserir={(m) => inserirMarcador(campoTexto.current, textoLivre, m, setTextoLivre)}
            />
            <textarea
              id="wa-texto"
              ref={campoTexto}
              rows={6}
              value={textoLivre}
              onChange={(e) => setTextoLivre(e.target.value)}
              placeholder="Escreva a mensagem. Com um documento anexado, ela vira a legenda do arquivo."
              className={CAMPO}
            />
          </div>
        ) : (
          <div>
            <label className={ROTULO} htmlFor="wa-modelo">
              Modelo
            </label>
            {carregandoModelos ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando modelos…
              </div>
            ) : gruposDeModelo.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Nenhum modelo ativo. Crie um na aba Modelos, ou volte para texto livre.
              </p>
            ) : (
              <>
                <select
                  id="wa-modelo"
                  value={modeloId}
                  onChange={(e) => setModeloId(e.target.value)}
                  className={CAMPO}
                >
                  <option value="">Selecione…</option>
                  {gruposDeModelo.map((g) => (
                    <optgroup key={g.contexto} label={g.rotulo}>
                      {g.itens.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {/*
                  Aviso em vez de esconder da lista: o modelo continua
                  escolhível — às vezes é exatamente o texto que se quer —, mas
                  quem manda fica sabendo que os campos do documento vão sair
                  vazios.
                */}
                {modeloForaDoAnexo && modeloEscolhido && (
                  <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Este modelo é de {modeloEscolhido.contexto === 'proposta'
                      ? 'proposta'
                      : 'contrato'}
                    , e {tipoAnexo === 'nenhum'
                      ? 'não há documento anexado'
                      : `o anexo escolhido é ${tipoAnexo === 'proposta' ? 'uma proposta' : 'um contrato'}`}
                    . Campos como <code className="font-mono">{'{{numero}}'}</code> e{' '}
                    <code className="font-mono">{'{{valor}}'}</code> vão sair vazios.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ anexo -- */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className={ROTULO}>
            <Paperclip className="w-3 h-3 inline mr-1 -mt-0.5" />
            Anexar documento
          </span>
          <Alternador<TipoAnexo>
            valor={tipoAnexo}
            opcoes={[
              { id: 'nenhum', rotulo: 'Sem anexo' },
              { id: 'proposta', rotulo: 'Proposta' },
              { id: 'contrato', rotulo: 'Contrato' },
            ]}
            onEscolher={trocarTipoAnexo}
          />

          {tipoAnexo !== 'nenhum' && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={buscaDoc}
                  onChange={(e) => setBuscaDoc(e.target.value)}
                  placeholder="Buscar por número ou cliente…"
                  className={`${CAMPO} pl-9`}
                />
              </div>

              {doc && (
                <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  <span className="min-w-0 text-xs font-bold text-[#004276] truncate">
                    {tipoAnexo === 'proposta' ? 'Proposta' : 'Contrato'} {doc.numero} ·{' '}
                    {doc.clienteNome}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDoc(null)}
                    className="text-[#004276]/60 hover:text-rose-600 p-1 shrink-0"
                    aria-label="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {documentos.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    {tipoAnexo === 'proposta'
                      ? 'Nenhuma proposta encontrada.'
                      : 'Nenhum contrato encontrado.'}
                  </p>
                ) : (
                  documentos.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => escolherDocumento(d)}
                      className={`w-full text-left px-3 py-2.5 transition ${
                        doc?.id === d.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {tipoAnexo === 'proposta' ? (
                          <FileText className="w-3.5 h-3.5 text-[#004276] shrink-0" />
                        ) : (
                          <ScrollText className="w-3.5 h-3.5 text-[#004276] shrink-0" />
                        )}
                        <span className="truncate">
                          {d.numero} · {d.clienteNome}
                        </span>
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5 pl-6">
                        {formatCurrencyBRL(d.valorTotal)} · {d.status}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <Paperclip className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                O cliente recebe o PDF como arquivo no WhatsApp, com a sua mensagem de legenda.
                O documento é impresso na hora do envio, então sai sempre com os dados atuais.
              </p>

              {/*
                Modelo antigo citando {{link}} não quebra o envio — o servidor
                troca o marcador por vazio —, mas deixa uma frase pela metade no
                WhatsApp do cliente ("Você pode ver por aqui: "). Avisar aqui é
                mais barato do que descobrir pelo cliente.
              */}
              {modeloComLink && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Este modelo ainda cita <code className="font-mono">{'{{link}}'}</code>, que foi
                  aposentado quando o documento passou a ir anexado. O marcador some no envio e
                  pode deixar a frase cortada — vale ajustar o texto na aba Modelos.
                </p>
              )}
            </>
          )}
        </div>

        {/* ---------------------------------------------- destinatários -- */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className={ROTULO}>Adicionar destinatário</span>
          <Alternador<ModoDestinatario>
            valor={modoDest}
            opcoes={[
              { id: 'lead', rotulo: 'Lead cadastrado' },
              { id: 'telefone', rotulo: 'Telefone avulso' },
            ]}
            onEscolher={setModoDest}
          />

          {modoDest === 'lead' ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={buscaLead}
                  onChange={(e) => setBuscaLead(e.target.value)}
                  placeholder="Buscar por nome, número ou telefone…"
                  className={`${CAMPO} pl-9`}
                />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {leadsFiltrados.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhum lead encontrado.</p>
                ) : (
                  leadsFiltrados.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() =>
                        adicionar({
                          chave: l.id,
                          nome: l.nome,
                          telefone: maskPhone(l.telefone),
                          leadId: l.id,
                        })
                      }
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition"
                    >
                      <span className="block text-sm text-slate-800 truncate">
                        {l.numero} — {l.nome}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {maskPhone(l.telefone) || 'sem telefone'} · {l.etapa}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={nomeAvulso}
                  onChange={(e) => setNomeAvulso(e.target.value)}
                  placeholder="Nome (opcional)"
                  className={CAMPO}
                />
                <input
                  value={telefoneAvulso}
                  onChange={(e) => setTelefoneAvulso(maskPhone(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarAvulso();
                    }
                  }}
                  placeholder="(31) 98658-8456"
                  inputMode="tel"
                  className={CAMPO}
                />
              </div>
              <button
                type="button"
                onClick={adicionarAvulso}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004276] hover:bg-blue-50 px-2 py-1.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar à lista
              </button>
            </>
          )}
        </div>
      </section>

      {/* ---------------------------------------------- prévia e envio -- */}
      <div className="space-y-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className={ROTULO}>Pré-visualização</span>
          <PreviaMensagem texto={textoEfetivo} />
          <p className="text-[11px] text-slate-500 mt-2">
            Os campos destacados são trocados no envio, pelo servidor, com os dados reais do
            cliente e do documento — não vão assim para o WhatsApp.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#004276]" />
              Destinatários ({destinatarios.length})
            </span>
            {destinatarios.length > 0 && (
              <button
                type="button"
                onClick={() => setDestinatarios([])}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
              >
                Limpar
              </button>
            )}
          </div>

          {destinatarios.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Nenhum destinatário adicionado.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto">
              {destinatarios.map((d) => (
                <li
                  key={d.chave}
                  className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="min-w-0 text-sm text-slate-700 truncate">
                    {d.nome} <span className="text-slate-400">· {d.telefone}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDestinatarios((atuais) => atuais.filter((x) => x.chave !== d.chave))
                    }
                    className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                    aria-label={`Remover ${d.nome}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {motivoBloqueio && <p className="text-[11px] text-slate-500 mt-3">{motivoBloqueio}</p>}

          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!podeEnviar}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? `Enviando ${feitos}/${destinatarios.length}…` : 'Enviar'}
          </button>
        </section>
      </div>
    </div>
  );
};
