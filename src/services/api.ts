// Camada de dados da aplicação — substitui o StorageService.
//
// A assinatura foi mantida de propósito (getLeads, saveLead, updateLeadStage…),
// só que agora tudo é assíncrono e devolve a lista já atualizada pelo servidor.
// É o que permite trocar o localStorage pelo PostgreSQL sem reescrever as telas.
//
// Onde o StorageService fazia `const lista = Storage.saveX(x); setX(lista)`,
// o App agora faz `const lista = await Api.saveX(x); setX(lista)`.

import {
  Agendamento, AuditEntry, Boleto, Contrato, Fornecedor, LancamentoFinanceiro,
  Lead, LeadStage, Obra, Produto, Proposta, User,
} from '../types';
import { definirTokens, http, limparTokens, obterRefreshToken, temSessaoSalva } from './http';
import {
  deAgendamento, deBoleto, deContrato, deFornecedor, deHomologacao, deLancamento,
  deLead, deObra, deProduto, deProposta, deUser,
  paraAgendamento, paraAuditEntry, paraBoleto, paraContrato, paraDocumento,
  paraFornecedor, paraHistorico, paraLancamento, paraLead, paraObra, paraProduto,
  paraProposta, paraUser, paraUserAutenticado,
} from './mappers';

/* ============================================================== SESSÃO === */

export const Auth = {
  async login(email: string, senha: string): Promise<User> {
    const r = await http.postPublico<any>('/api/auth/login', { email, senha });
    definirTokens(r.accessToken, r.refreshToken);
    return paraUserAutenticado(r.usuario);
  },

  /** Tenta reaproveitar a sessão salva no F5. Devolve null se não houver. */
  async restaurar(): Promise<User | null> {
    if (!temSessaoSalva()) return null;
    try {
      const r = await http.postPublico<any>('/api/auth/refresh', {
        refreshToken: obterRefreshToken(),
      });
      definirTokens(r.accessToken, r.refreshToken);
      const me = await http.get<any>('/api/auth/me');
      return paraUserAutenticado(me.usuario);
    } catch {
      limparTokens();
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await http.post('/api/auth/logout', { refreshToken: obterRefreshToken() });
    } catch {
      // Se o servidor não responder, encerra localmente do mesmo jeito.
    }
    limparTokens();
  },

  async trocarSenha(senhaAtual: string, senhaNova: string): Promise<void> {
    await http.patch('/api/usuarios/me/senha', {
      senha_atual: senhaAtual,
      senha_nova: senhaNova,
    });
  },
};

/* =============================================================== LEADS === */

async function listarLeads(): Promise<Lead[]> {
  const r = await http.get<any>('/api/leads?tamanho=200');
  return (r.leads ?? []).map((l: any) => paraLead(l));
}

/* ================================================================ API === */

export const Api = {
  /* -------------------------------------------------------- usuários -- */

  getUsuarios: async (): Promise<User[]> => {
    const r = await http.get<any>('/api/usuarios');
    return (r.usuarios ?? []).map(paraUser);
  },
  getUsers: (): Promise<User[]> => Api.getUsuarios(),

  saveUsuario: async (user: User & { senha?: string }): Promise<User[]> => {
    const corpo = deUser(user);
    // Sem id significa cadastro novo; a API exige senha nesse caso.
    if (user.id && !user.id.startsWith('novo-')) {
      await http.patch(`/api/usuarios/${user.id}`, corpo);
    } else {
      await http.post('/api/usuarios', corpo);
    }
    return Api.getUsuarios();
  },

  deleteUsuario: async (id: string): Promise<User[]> => {
    await http.delete(`/api/usuarios/${id}`);
    return Api.getUsuarios();
  },

  /* ----------------------------------------------------------- leads -- */

  getLeads: listarLeads,

  /** Lead completo, com documentos e timeline — para o LeadDetailView. */
  getLeadDetalhe: async (id: string): Promise<Lead> => {
    const r = await http.get<any>(`/api/leads/${id}`);
    return paraLead(r.lead, { documentos: r.documentos, historico: r.historico });
  },

  saveLead: async (lead: Lead): Promise<Lead[]> => {
    const corpo = deLead(lead);
    if (lead.id && !lead.id.startsWith('lead-') && !lead.id.startsWith('novo-')) {
      await http.patch(`/api/leads/${lead.id}`, corpo);
    } else {
      await http.post('/api/leads', corpo);
    }
    return listarLeads();
  },

  updateLeadStage: async (leadId: string, etapa: LeadStage): Promise<Lead[]> => {
    await http.patch(`/api/leads/${leadId}/etapa`, { etapa });
    return listarLeads();
  },

  registrarInteracao: async (
    leadId: string,
    descricao: string,
    tipo: 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'visita' = 'nota',
  ): Promise<Lead> => {
    await http.post(`/api/leads/${leadId}/historico`, { descricao, tipo });
    return Api.getLeadDetalhe(leadId);
  },

  deleteLead: async (id: string): Promise<Lead[]> => {
    await http.delete(`/api/leads/${id}`);
    return listarLeads();
  },

  /* ---------------------------------------------------- fornecedores -- */

  getFornecedores: async (): Promise<Fornecedor[]> => {
    const r = await http.get<any>('/api/catalogo/fornecedores');
    return (r.fornecedores ?? []).map(paraFornecedor);
  },

  saveFornecedor: async (f: Fornecedor): Promise<Fornecedor[]> => {
    const corpo = deFornecedor(f);
    if (f.id && !f.id.startsWith('novo-')) {
      await http.patch(`/api/catalogo/fornecedores/${f.id}`, corpo);
    } else {
      await http.post('/api/catalogo/fornecedores', corpo);
    }
    return Api.getFornecedores();
  },

  deleteFornecedor: async (id: string): Promise<Fornecedor[]> => {
    await http.delete(`/api/catalogo/fornecedores/${id}`);
    return Api.getFornecedores();
  },

  /* -------------------------------------------------------- produtos -- */

  getProdutos: async (): Promise<Produto[]> => {
    const r = await http.get<any>('/api/catalogo/produtos');
    return (r.produtos ?? []).map(paraProduto);
  },

  saveProduto: async (p: Produto): Promise<Produto[]> => {
    const corpo = deProduto(p);
    if (p.id && !p.id.startsWith('novo-')) {
      // `estoque` não entra no PATCH: só muda por movimentação.
      delete (corpo as Record<string, unknown>).estoque;
      await http.patch(`/api/catalogo/produtos/${p.id}`, corpo);
    } else {
      await http.post('/api/catalogo/produtos', corpo);
    }
    return Api.getProdutos();
  },

  deleteProduto: async (id: string): Promise<Produto[]> => {
    await http.delete(`/api/catalogo/produtos/${id}`);
    return Api.getProdutos();
  },

  /** Entrada, saída ou ajuste manual de estoque. */
  movimentarEstoque: async (
    produtoId: string,
    tipo: 'entrada' | 'saida' | 'ajuste' | 'devolucao',
    quantidade: number,
    observacao?: string,
  ): Promise<Produto[]> => {
    await http.post('/api/catalogo/movimentacoes', {
      produto_id: produtoId,
      tipo,
      quantidade,
      observacao: observacao ?? null,
    });
    return Api.getProdutos();
  },

  /* -------------------------------------------------------- propostas -- */

  getPropostas: async (): Promise<Proposta[]> => {
    const r = await http.get<any>('/api/propostas');
    // A listagem é enxuta; o front espera o objeto completo com os itens.
    const completas = await Promise.all(
      (r.propostas ?? []).map((p: any) => http.get<any>(`/api/propostas/${p.id}`)),
    );
    return completas.map((c) => paraProposta(c.proposta));
  },

  getProposta: async (id: string): Promise<Proposta> => {
    const r = await http.get<any>(`/api/propostas/${id}`);
    return paraProposta(r.proposta);
  },

  saveProposta: async (p: Proposta): Promise<Proposta[]> => {
    const corpo = deProposta(p);
    if (p.id && !p.id.startsWith('prop-') && !p.id.startsWith('novo-')) {
      await http.put(`/api/propostas/${p.id}`, corpo);
      if (p.status) await http.patch(`/api/propostas/${p.id}/status`, { status: p.status });
    } else {
      const criada = await http.post<any>('/api/propostas', corpo);
      if (p.status && p.status !== 'rascunho') {
        await http.patch(`/api/propostas/${criada.proposta.id}/status`, { status: p.status });
      }
    }
    return Api.getPropostas();
  },

  /* -------------------------------------------------------- contratos -- */

  getContratos: async (): Promise<Contrato[]> => {
    const r = await http.get<any>('/api/contratos');
    const completos = await Promise.all(
      (r.contratos ?? []).map((c: any) => http.get<any>(`/api/contratos/${c.id}`)),
    );
    return completos.map((c) => paraContrato(c.contrato));
  },

  saveContrato: async (c: Contrato): Promise<Contrato[]> => {
    const corpo = deContrato(c);
    const existente = c.id && !c.id.startsWith('cont-') && !c.id.startsWith('novo-');

    if (existente) {
      await http.put(`/api/contratos/${c.id}`, corpo);
      if (c.status === 'assinado') {
        await http.post(`/api/contratos/${c.id}/assinar`, {});
      }
    } else {
      const criado = await http.post<any>('/api/contratos', corpo);
      if (c.status === 'assinado') {
        await http.post(`/api/contratos/${criado.contrato.id}/assinar`, {});
      }
    }
    return Api.getContratos();
  },

  deleteContrato: async (id: string): Promise<Contrato[]> => {
    await http.delete(`/api/contratos/${id}`);
    return Api.getContratos();
  },

  /* ------------------------------------------------------- financeiro -- */

  getBoletos: async (): Promise<Boleto[]> => {
    const r = await http.get<any>('/api/financeiro/boletos');
    return (r.boletos ?? []).map(paraBoleto);
  },

  saveBoleto: async (b: Boleto): Promise<Boleto[]> => {
    const existente = b.id && !b.id.startsWith('bol-') && !b.id.startsWith('novo-');

    if (existente) {
      // Marcar como pago é a rota de baixa: ela gera o lançamento de caixa.
      if (b.situacao === 'pago') {
        await http.patch(`/api/financeiro/boletos/${b.id}/baixa`, {
          data_pagamento: b.dataPagamento
            ? b.dataPagamento.split('/').reverse().join('-')
            : undefined,
        });
      } else {
        await http.patch(`/api/financeiro/boletos/${b.id}`, deBoleto(b));
      }
    } else {
      await http.post('/api/financeiro/boletos', deBoleto(b));
    }
    return Api.getBoletos();
  },

  deleteBoleto: async (id: string): Promise<Boleto[]> => {
    await http.delete(`/api/financeiro/boletos/${id}`);
    return Api.getBoletos();
  },

  getLancamentos: async (): Promise<LancamentoFinanceiro[]> => {
    const r = await http.get<any>('/api/financeiro/lancamentos');
    return (r.lancamentos ?? []).map(paraLancamento);
  },

  saveLancamento: async (l: LancamentoFinanceiro): Promise<LancamentoFinanceiro[]> => {
    await http.post('/api/financeiro/lancamentos', deLancamento(l));
    return Api.getLancamentos();
  },

  /* ----------------------------------------------------- agendamentos -- */

  getAgendamentos: async (): Promise<Agendamento[]> => {
    const r = await http.get<any>('/api/agenda');
    return (r.agendamentos ?? []).map(paraAgendamento);
  },

  saveAgendamento: async (a: Agendamento): Promise<Agendamento[]> => {
    const corpo = deAgendamento(a);
    if (a.id && !a.id.startsWith('ag-') && !a.id.startsWith('novo-')) {
      await http.put(`/api/agenda/${a.id}`, corpo);
    } else {
      await http.post('/api/agenda', corpo);
    }
    return Api.getAgendamentos();
  },

  deleteAgendamento: async (id: string): Promise<Agendamento[]> => {
    await http.delete(`/api/agenda/${id}`);
    return Api.getAgendamentos();
  },

  /* ------------------------------------------------------------ obras -- */

  getObras: async (): Promise<Obra[]> => {
    const r = await http.get<any>('/api/obras');
    const completas = await Promise.all(
      (r.obras ?? []).map((o: any) => http.get<any>(`/api/obras/${o.id}`)),
    );
    return completas.map((o) => paraObra(o.obra));
  },

  saveObra: async (o: Obra): Promise<Obra[]> => {
    const existente = o.id && !o.id.startsWith('obra-') && !o.id.startsWith('novo-');

    if (existente) {
      await http.patch(`/api/obras/${o.id}`, deObra(o));
      await http.patch(`/api/obras/${o.id}/etapa`, { etapa: o.etapa });
      await http.patch(`/api/obras/${o.id}/homologacao`, deHomologacao(o.homologacao));
    } else {
      await http.post('/api/obras', deObra(o));
    }
    return Api.getObras();
  },

  deleteObra: async (id: string): Promise<Obra[]> => {
    await http.delete(`/api/obras/${id}`);
    return Api.getObras();
  },

  /**
   * Baixa do kit da obra no estoque. A função no banco é idempotente:
   * chamar duas vezes não baixa duas vezes.
   */
  baixarEstoqueObra: async (obraId: string): Promise<{ produtos: Produto[]; itens: number }> => {
    const r = await http.post<any>(`/api/obras/${obraId}/baixar-estoque`, {});
    return { produtos: await Api.getProdutos(), itens: r.itens_baixados ?? 0 };
  },

  /* -------------------------------------------------------- auditoria -- */

  getAuditoria: async (): Promise<AuditEntry[]> => {
    const r = await http.get<any>('/api/auditoria?tamanho=300');
    return (r.registros ?? []).map(paraAuditEntry);
  },

  /* -------------------------------------------- dashboard e apoio ---- */

  getDashboard: async (): Promise<any> => http.get<any>('/api/dashboard'),

  getNotificacoes: async (): Promise<any> => http.get<any>('/api/notificacoes'),

  marcarNotificacaoLida: async (chave: string): Promise<void> => {
    await http.post(`/api/notificacoes/${encodeURIComponent(chave)}/lida`, {});
  },

  /** Empresa, parâmetros e domínios — substitui os literais dos componentes. */
  getConfig: async (): Promise<any> => http.get<any>('/api/config'),

  salvarParametros: async (parametros: { chave: string; valor: string }[]): Promise<any> =>
    http.patch<any>('/api/config/parametros', { parametros }),

  salvarEmpresa: async (empresa: Record<string, unknown>): Promise<any> =>
    http.patch<any>('/api/config/empresa', empresa),
};

/* ====================================================== CONFIGURAÇÃO === */

export interface ParametroApp {
  chave: string;
  valor: string;
  tipo: string;
  grupo: string;
  descricao?: string;
}

export interface ConfigApp {
  empresa: Record<string, any> | null;
  parametros: ParametroApp[];
  concessionarias: { id: number; nome: string; tarifa_kwh?: number; hsp_media?: number }[];
  origens: { id: number; nome: string }[];
  telhados: { id: number; nome: string }[];
  categorias: { id: number; nome: string; escopo: string }[];
  pastas: { id: number; nome: string }[];
  bancos: { id: number; nome: string; juros_mes_padrao?: number; parcelas_max?: number }[];
  presets: { id: number; contexto: string; label: string; texto: string }[];
  clausulas: { id: number; titulo: string; texto: string | null; padrao: boolean; ordem: number }[];
}

/** Lê um parâmetro do banco como texto. */
export function param(config: ConfigApp | null, chave: string, padrao = ''): string {
  return config?.parametros.find((p) => p.chave === chave)?.valor ?? padrao;
}

/** Lê um parâmetro do banco como número. */
export function paramNum(config: ConfigApp | null, chave: string, padrao: number): number {
  const bruto = config?.parametros.find((p) => p.chave === chave)?.valor;
  if (bruto == null || bruto === '') return padrao;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : padrao;
}

/** Carrega tudo que o App precisa na entrada, em paralelo. */
export async function carregarTudo() {
  const [
    leads, propostas, contratos, boletos, lancamentos,
    agendamentos, produtos, fornecedores, usuarios, obras, config,
  ] = await Promise.all([
    Api.getLeads(),
    Api.getPropostas(),
    Api.getContratos(),
    Api.getBoletos(),
    Api.getLancamentos(),
    Api.getAgendamentos(),
    Api.getProdutos(),
    Api.getFornecedores(),
    Api.getUsuarios(),
    Api.getObras(),
    Api.getConfig(),
  ]);

  // A auditoria depende de permissão; falha nela não pode derrubar a tela.
  let auditoria: AuditEntry[] = [];
  try {
    auditoria = await Api.getAuditoria();
  } catch {
    auditoria = [];
  }

  return {
    leads, propostas, contratos, boletos, lancamentos,
    agendamentos, produtos, fornecedores, usuarios, obras, auditoria, config,
  };
}

export { ErroApi } from './http';
export { paraDocumento, paraHistorico };
