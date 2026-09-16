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
};
