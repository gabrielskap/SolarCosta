// Cliente de /api/whatsapp.
//
// Fica fora de services/api.ts de propósito. Aquele arquivo existe para o que
// o App.tsx carrega de uma vez no login (carregarTudo), e a tela de WhatsApp
// não é isso: ela busca os próprios dados quando abre e consulta em laço
// enquanto está na frente do usuário — mesmo arranjo do services/site.ts para
// a Configuração do Site.

import { http } from './http';

export type StatusInstancia = 'desconectada' | 'conectando' | 'conectada' | 'hibernada';

export interface InstanciaWhatsApp {
  status: StatusInstancia;
  /** Número conectado, só dígitos com DDI. Null enquanto ninguém pareou. */
  numero: string | null;
  perfil: string | null;
  conectadoEm: string | null;
  /** Última recusa da uazapi ou do WhatsApp, para a tela explicar o que houve. */
  ultimoErro: string | null;
  /**
   * PNG em data URI, pronto para <img src>. A uazapi já devolve a imagem
   * montada, então não há biblioteca de QR no bundle. Só existe durante o
   * pareamento.
   */
  qrcode: string | null;
}

export interface EstadoWhatsApp {
  instancia: InstanciaWhatsApp;
  /** Falso quando o servidor está sem UAZAPI_ADMIN_TOKEN. */
  ativo: boolean;
}

export interface ModeloMensagem {
  id: string;
  nome: string;
  contexto: 'proposta' | 'contrato' | 'lead' | 'livre';
  texto: string;
  ordem: number;
}

/* ====================================================== CAIXA DE ENTRADA == */

export interface LeadDaConversa {
  id: string;
  numero: string;
  nome: string;
  etapa: string;
}

export interface Conversa {
  id: string;
  chatid: string;
  /** Só dígitos com DDI. Null em grupo — o identificador não é telefone. */
  telefone: string | null;
  /** Nome que o WhatsApp informa. Não é o nome do lead. */
  nomeExibicao: string | null;
  eGrupo: boolean;
  naoLidas: number;
  ultimaMensagemTexto: string | null;
  ultimaMensagemEm: string | null;
  arquivada: boolean;
  lead: LeadDaConversa | null;
}

export type TipoMensagem =
  | 'texto' | 'imagem' | 'video' | 'audio' | 'documento' | 'contato' | 'local' | 'outro';

export type StatusMensagem =
  | 'fila' | 'enviada' | 'entregue' | 'lida' | 'falhou' | 'cancelada';

export interface Mensagem {
  id: string;
  mensagemId: string | null;
  deMim: boolean;
  tipo: TipoMensagem;
  texto: string | null;
  /** Null enquanto o anexo não terminou de baixar, ou quando falhou. */
  midiaId: string | null;
  nomeArquivo: string | null;
  mimeType: string | null;
  /** Só significa algo quando `deMim` é verdadeiro. */
  status: StatusMensagem;
  erro: string | null;
  ocorridoEm: string;
  enviadaPorNome: string | null;
  referenciaTipo: 'proposta' | 'contrato' | null;
  referenciaId: string | null;
}

export interface PaginaConversas {
  conversas: Conversa[];
  naoLidasTotal: number;
  proximoCursor: string | null;
}

export interface PaginaMensagens {
  conversa: Conversa;
  /** Mais recentes primeiro, como a API devolve. A tela inverte para render. */
  mensagens: Mensagem[];
  temMais: boolean;
}

function paraConversa(b: any): Conversa {
  return {
    id: b.id,
    chatid: b.chatid,
    telefone: b.telefone ?? null,
    nomeExibicao: b.nome_exibicao ?? null,
    eGrupo: !!b.e_grupo,
    naoLidas: b.nao_lidas ?? 0,
    ultimaMensagemTexto: b.ultima_mensagem_texto ?? null,
    ultimaMensagemEm: b.ultima_mensagem_em ?? null,
    arquivada: !!b.arquivada,
    lead: b.lead
      ? { id: b.lead.id, numero: b.lead.numero, nome: b.lead.nome, etapa: b.lead.etapa }
      : null,
  };
}

function paraMensagem(b: any): Mensagem {
  return {
    id: b.id,
    mensagemId: b.mensagem_id ?? null,
    deMim: !!b.de_mim,
    tipo: b.tipo,
    texto: b.texto ?? null,
    midiaId: b.midia_id ?? null,
    nomeArquivo: b.nome_arquivo ?? null,
    mimeType: b.mime_type ?? null,
    status: b.status,
    erro: b.erro ?? null,
    ocorridoEm: b.ocorrido_em,
    enviadaPorNome: b.enviada_por_nome ?? null,
    referenciaTipo: b.referencia_tipo ?? null,
    referenciaId: b.referencia_id ?? null,
  };
}

/** snake_case da API → camelCase, como o resto do front espera. */
function paraInstancia(bruta: any): InstanciaWhatsApp {
  return {
    status: bruta.status,
    numero: bruta.numero ?? null,
    perfil: bruta.perfil ?? null,
    conectadoEm: bruta.conectado_em ?? null,
    ultimoErro: bruta.ultimo_erro ?? null,
    qrcode: bruta.qrcode ?? null,
  };
}

export const WhatsApp = {
  /** Estado guardado no banco, sem ida à uazapi. Barato: pode abrir a tela com ele. */
  async estado(): Promise<EstadoWhatsApp> {
    const r = await http.get<any>('/api/whatsapp/instancia');
    return { instancia: paraInstancia(r.instancia), ativo: !!r.ativo };
  },

  /** Inicia o pareamento. Devolve a instância já com o primeiro QR code. */
  async conectar(): Promise<InstanciaWhatsApp> {
    const r = await http.post<any>('/api/whatsapp/instancia/conectar');
    return paraInstancia(r.instancia);
  },

  /**
   * QR renovado e status atual — é esta que a tela chama em laço durante o
   * pareamento, NÃO a conectar(): chamar conectar de novo reinicia o
   * pareamento e invalida o código que a pessoa está escaneando.
   */
  async qr(): Promise<InstanciaWhatsApp> {
    const r = await http.get<any>('/api/whatsapp/instancia/qr');
    return paraInstancia(r.instancia);
  },

  async desconectar(): Promise<InstanciaWhatsApp> {
    const r = await http.post<any>('/api/whatsapp/instancia/desconectar');
    return paraInstancia(r.instancia);
  },

  /**
   * Manda a mensagem. Quando há `referencia`, o servidor gera (ou reaproveita)
   * o link público do documento e o injeta no {{link}} do modelo — o front
   * nunca monta esse endereço, porque quem sabe o domínio público é a API.
   */
  async enviar(dados: {
    telefone?: string;
    texto?: string;
    modeloId?: string;
    referencia?: { tipo: 'proposta' | 'contrato'; id: string };
    leadId?: string;
  }): Promise<{ conversaId: string; link: string | null; texto: string }> {
    const r = await http.post<any>('/api/whatsapp/enviar', {
      telefone: dados.telefone,
      texto: dados.texto,
      modelo_id: dados.modeloId,
      referencia: dados.referencia,
      lead_id: dados.leadId,
    });
    return { conversaId: r.conversa_id, link: r.link ?? null, texto: r.texto };
  },

  async modelos(contexto?: ModeloMensagem['contexto']): Promise<ModeloMensagem[]> {
    const q = contexto ? `?contexto=${contexto}` : '';
    const r = await http.get<any>(`/api/whatsapp/modelos${q}`);
    return r.modelos ?? [];
  },

  /* -------------------------------------------------- caixa de entrada -- */

  /**
   * Lista de conversas, mais recentes primeiro.
   *
   * `antesDe` é cursor de timestamp, não página: a lista se reordena a cada
   * mensagem que chega, e paginar por número repetiria ou pularia conversas
   * conforme o topo se movesse.
   */
  async conversas(opcoes: {
    busca?: string;
    arquivadas?: 'nao' | 'sim' | 'todas';
    antesDe?: string;
    limite?: number;
  } = {}): Promise<PaginaConversas> {
    const q = new URLSearchParams();
    if (opcoes.busca) q.set('busca', opcoes.busca);
    if (opcoes.arquivadas) q.set('arquivadas', opcoes.arquivadas);
    if (opcoes.antesDe) q.set('antes_de', opcoes.antesDe);
    if (opcoes.limite) q.set('limite', String(opcoes.limite));

    const r = await http.get<any>(`/api/whatsapp/conversas?${q.toString()}`);
    return {
      conversas: (r.conversas ?? []).map(paraConversa),
      naoLidasTotal: r.nao_lidas_total ?? 0,
      proximoCursor: r.proximo_cursor ?? null,
    };
  },

  /**
   * Mensagens de uma conversa.
   *
   * `antesDe` busca a página mais antiga (rolar para cima); `depoisDe` busca só
   * o que chegou depois — é o delta que o polling usa, para não rebaixar a
   * thread inteira a cada 8 segundos.
   */
  async mensagens(
    conversaId: string,
    opcoes: { antesDe?: string; depoisDe?: string; limite?: number } = {},
  ): Promise<PaginaMensagens> {
    const q = new URLSearchParams();
    if (opcoes.antesDe) q.set('antes_de', opcoes.antesDe);
    if (opcoes.depoisDe) q.set('depois_de', opcoes.depoisDe);
    if (opcoes.limite) q.set('limite', String(opcoes.limite));

    const r = await http.get<any>(`/api/whatsapp/conversas/${conversaId}/mensagens?${q.toString()}`);
    return {
      conversa: paraConversa(r.conversa),
      mensagens: (r.mensagens ?? []).map(paraMensagem),
      temMais: !!r.tem_mais,
    };
  },

  async marcarLida(conversaId: string): Promise<Conversa> {
    const r = await http.post<any>(`/api/whatsapp/conversas/${conversaId}/ler`);
    return paraConversa(r.conversa);
  },

  async arquivar(conversaId: string, arquivada: boolean): Promise<Conversa> {
    const r = await http.post<any>(`/api/whatsapp/conversas/${conversaId}/arquivar`, { arquivada });
    return paraConversa(r.conversa);
  },

  /** `leadId` nulo desvincula. */
  async vincularLead(conversaId: string, leadId: string | null): Promise<Conversa> {
    const r = await http.patch<any>(`/api/whatsapp/conversas/${conversaId}/lead`, {
      lead_id: leadId,
    });
    return paraConversa(r.conversa);
  },

  async responder(
    conversaId: string,
    texto: string,
  ): Promise<{ mensagem: Mensagem; conversa: Conversa }> {
    const r = await http.post<any>(`/api/whatsapp/conversas/${conversaId}/responder`, { texto });
    return { mensagem: paraMensagem(r.mensagem), conversa: paraConversa(r.conversa) };
  },

  /**
   * Bytes de um anexo, como object URL.
   *
   * TEM de passar por aqui, e não por `<img src="/api/whatsapp/midia/…">`: a
   * sessão é Bearer token em header, não cookie, então a tag iria sem
   * `Authorization` e tomaria 401. Mesmo arranjo da imagem de satélite em
   * services/solar.ts. O `blob:` já está liberado no img-src da CSP.
   *
   * Quem chama é responsável por `URL.revokeObjectURL` — sem isso, rolar uma
   * conversa com muitas fotos vaza memória até a aba travar.
   */
  async midia(midiaId: string): Promise<string> {
    const blob = await http.getBlob(`/api/whatsapp/midia/${midiaId}`);
    return URL.createObjectURL(blob);
  },
};
