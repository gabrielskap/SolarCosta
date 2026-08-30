// Tradução entre o formato da API (snake_case, datas ISO) e os tipos que os
// componentes já usam (camelCase, datas DD/MM/AAAA).
//
// É esta camada que permite trocar o localStorage pelo PostgreSQL sem tocar
// nas 20 telas. Quando o front for modernizado, o caminho é ir apagando
// mapeador por mapeador — não reescrevendo tudo de uma vez.

import {
  Agendamento, AuditEntry, Boleto, Contrato, DocumentoItem, Fornecedor,
  HistoricoItem, LancamentoFinanceiro, Lead, Obra, Produto, Proposta,
  PropostaItem, User,
} from '../types';

/* ============================================================== DATAS === */

/** '2026-07-29' ou ISO completo -> '29/07/2026'. */
export function paraDataBR(valor?: string | null): string {
  if (!valor) return '';
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** '29/07/2026' -> '2026-07-29'. Devolve null se não reconhecer. */
export function paraDataISO(valor?: string | null): string | null {
  if (!valor) return null;
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

/** ISO -> '29/07/2026 14:05'. */
export function paraDataHoraBR(valor?: string | null): string {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 'HH:MM:SS' -> 'HH:MM'. */
function paraHoraCurta(valor?: string | null): string {
  return valor ? valor.slice(0, 5) : '';
}

/** Junta cidade e UF como o front espera: 'Belo Horizonte/MG'. */
function cidadeComUf(cidade?: string | null, uf?: string | null): string {
  if (!cidade) return '';
  return uf ? `${cidade}/${uf}` : cidade;
}

/** Desmonta 'Belo Horizonte/MG' de volta em cidade + uf para enviar à API. */
export function separarCidadeUf(valor?: string | null): { cidade: string | null; uf: string | null } {
  if (!valor) return { cidade: null, uf: null };
  const m = valor.match(/^(.*?)[/-]\s*([A-Za-z]{2})$/);
  if (m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: valor.trim(), uf: null };
}

/** Converte bytes em '1,4 MB' — o mock guardava esse texto pronto. */
function formatarTamanho(bytes?: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const txt = (v: unknown): string => (v == null ? '' : String(v));

/* ============================================================ USUÁRIO === */

export function paraUser(linha: any): User {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    telefone: linha.telefone ?? undefined,
    perfil: linha.cargo,
    cargo: linha.cargo,
    status: linha.status,
    situacao: linha.status === 'ativo' ? 'Ativo' : 'Inativo',
    ultimoAcesso: linha.ultimo_acesso ? paraDataHoraBR(linha.ultimo_acesso) : 'Nunca',
    dataCriacao: paraDataBR(linha.criado_em),
    permissoes: {
      criarEditarLeads: !!linha.criar_editar_leads,
      emitirPropostas: !!linha.emitir_propostas,
      anexarDocumentos: !!linha.anexar_documentos,
      emitirContratos: !!linha.emitir_contratos,
      verLancamentosFinanceiro: !!linha.ver_lancamentos_financeiro,
      gerenciarUsuarios: !!linha.gerenciar_usuarios,
      usuarioAtivo: linha.status === 'ativo',
    },
  };
}

/** O /auth/me devolve permissões aninhadas; aqui achatamos para paraUser. */
export function paraUserAutenticado(u: any): User {
  return paraUser({ ...u, ...(u.permissoes ?? {}) });
}

export function deUser(u: Partial<User> & { senha?: string }): Record<string, unknown> {
  const corpo: Record<string, unknown> = {
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? null,
    cargo: u.cargo ?? u.perfil,
    status: u.status ?? (u.situacao === 'Ativo' ? 'ativo' : 'inativo'),
  };
  if (u.senha) corpo.senha = u.senha;
  if (u.permissoes) {
    corpo.permissoes = {
      criar_editar_leads: u.permissoes.criarEditarLeads,
      emitir_propostas: u.permissoes.emitirPropostas,
      anexar_documentos: u.permissoes.anexarDocumentos,
      emitir_contratos: u.permissoes.emitirContratos,
      ver_lancamentos_financeiro: u.permissoes.verLancamentosFinanceiro,
      gerenciar_usuarios: u.permissoes.gerenciarUsuarios,
    };
  }
  return corpo;
}

/* ================================================================ LEAD === */

export function paraDocumento(linha: any): DocumentoItem {
  return {
    id: linha.id,
    nome: linha.nome_arquivo,
    pasta: linha.pasta ?? 'Outros',
    tipo: (linha.extensao ?? 'PDF').toUpperCase(),
    tamanho: formatarTamanho(linha.tamanho_bytes),
    enviadoPor: linha.enviado_por ?? 'Sistema',
    dataEnvio: paraDataBR(linha.enviado_em),
  };
}

export function paraHistorico(linha: any): HistoricoItem {
  return {
    id: linha.id,
    data: paraDataBR(linha.ocorrido_em),
    descricao: linha.descricao,
    usuario: linha.usuario_nome ?? 'Sistema',
  };
}

export function paraLead(linha: any, extras?: { documentos?: any[]; historico?: any[] }): Lead {
  return {
    id: linha.id,
    numero: linha.numero,
    nome: linha.nome,
    cpfCnpj: txt(linha.cpf_cnpj),
    rgInscricao: linha.rg_inscricao ?? undefined,
    telefone: txt(linha.telefone),
    email: txt(linha.email),
    cidade: cidadeComUf(linha.cidade, linha.uf),
    endereco: txt(linha.endereco),
    cep: linha.cep ?? undefined,
    consumoKwh: num(linha.consumo_kwh),
    concessionaria: txt(linha.concessionaria),
    telhado: txt(linha.telhado),
    origem: txt(linha.origem),
    responsavel: txt(linha.responsavel),
    etapa: linha.etapa,
    valor: num(linha.valor_estimado),
    propostaVinculadaId: linha.proposta_vinculada_id ?? undefined,
    dataCriacao: paraDataBR(linha.criado_em),
    documentos: (extras?.documentos ?? []).map(paraDocumento),
    historico: (extras?.historico ?? []).map(paraHistorico),
  };
}

export function deLead(l: Partial<Lead>): Record<string, unknown> {
  const { cidade, uf } = separarCidadeUf(l.cidade);
  return {
    nome: l.nome,
    cpf_cnpj: l.cpfCnpj || null,
    rg_inscricao: l.rgInscricao || null,
    telefone: l.telefone || null,
    email: l.email || null,
    cep: l.cep || null,
    endereco: l.endereco || null,
    cidade,
    uf,
    consumo_kwh: l.consumoKwh ?? 0,
    valor_estimado: l.valor ?? 0,
    // A API aceita nome e resolve para o id da tabela de apoio.
    concessionaria: l.concessionaria || null,
    telhado: l.telhado || null,
    origem: l.origem || null,
    responsavel: l.responsavel || null,
    ...(l.etapa ? { etapa: l.etapa } : {}),
  };
}

/* ========================================================= FORNECEDOR === */

export function paraFornecedor(linha: any): Fornecedor {
  return {
    id: linha.id,
    nome: linha.nome,
    cnpj: txt(linha.cnpj),
    cidade: cidadeComUf(linha.cidade, linha.uf),
    estado: linha.uf ?? undefined,
    contato: txt(linha.contato),
    telefone: txt(linha.telefone),
    email: linha.email ?? undefined,
    site: linha.site ?? undefined,
    prazoEntrega: linha.prazo_entrega ?? undefined,
    produtosQtd: num(linha.produtos_qtd),
    produtosCount: num(linha.produtos_qtd),
  };
}

export function deFornecedor(f: Partial<Fornecedor>): Record<string, unknown> {
  const { cidade, uf } = separarCidadeUf(f.cidade);
  return {
    nome: f.nome,
    cnpj: f.cnpj || null,
    cidade,
    uf: f.estado ?? uf,
    contato: f.contato || null,
    telefone: f.telefone || null,
    email: f.email || null,
    site: f.site || null,
    prazo_entrega: f.prazoEntrega || null,
  };
}

/* ============================================================ PRODUTO === */

export function paraProduto(linha: any): Produto {
  return {
    id: linha.id,
    codigo: linha.codigo,
    nome: linha.nome,
    // O front usa tanto o slug quanto o rótulo; entregamos o rótulo, que é o
    // que aparece na tela, e o slug fica disponível via `tipoCodigo`.
    tipo: linha.tipo_label ?? linha.tipo_codigo,
    fornecedorId: linha.fornecedor_id ?? '',
    fornecedorNome: txt(linha.fornecedor_nome),
    preco: num(linha.preco),
    estoque: num(linha.estoque),
    unidade: linha.unidade ?? undefined,
    potencia: linha.potencia_wp ? `${linha.potencia_wp} Wp` : undefined,
    potenciaWp: linha.potencia_wp ?? undefined,
  };
}

/** Mapa rótulo -> slug, para o caminho inverso. */
const SLUG_POR_ROTULO: Record<string, string> = {
  'Módulo fotovoltaico': 'modulo',
  Inversor: 'inversor',
  Estrutura: 'estrutura',
  Cabeamento: 'cabo',
  Proteção: 'protecao',
  Acessório: 'acessorio',
  Outro: 'outro',
};

export function deProduto(p: Partial<Produto> & { estoque?: number }): Record<string, unknown> {
  const tipo = txt(p.tipo);
  return {
    codigo: p.codigo,
    nome: p.nome,
    tipo_codigo: SLUG_POR_ROTULO[tipo] ?? tipo,
    fornecedor_id: p.fornecedorId || null,
    preco: p.preco ?? 0,
    unidade: p.unidade ?? 'un',
    potencia_wp: p.potenciaWp ?? null,
    ...(p.estoque !== undefined ? { estoque: p.estoque } : {}),
  };
}

/* =========================================================== PROPOSTA === */

function paraPropostaItem(linha: any): PropostaItem {
  return {
    id: linha.id,
    produtoId: linha.produto_id ?? undefined,
    descricao: linha.descricao,
    qtd: num(linha.qtd),
    valorUnit: num(linha.valor_unit),
    total: num(linha.total),
  };
}

export function paraProposta(linha: any): Proposta {
  return {
    id: linha.id,
    numero: linha.numero,
    leadId: linha.lead_id ?? '',
    clienteNome: linha.cliente_nome,
    cpfCnpj: txt(linha.cpf_cnpj),
    telefone: txt(linha.telefone),
    email: txt(linha.email),
    endereco: txt(linha.endereco),
    cidade: txt(linha.cidade),
    concessionaria: txt(linha.concessionaria),
    telhado: txt(linha.telhado),
    consumoKwh: num(linha.consumo_kwh),
    tarifaKwh: num(linha.tarifa_kwh),
    hsp: num(linha.hsp),
    perdasPct: num(linha.perdas_pct),
    moduloWp: num(linha.modulo_wp),
    potenciaKwp: num(linha.potencia_kwp),
    modulosQtd: num(linha.modulos_qtd),
    areaEstimadaM2: num(linha.area_estimada_m2),
    geracaoMediaKwh: num(linha.geracao_media_kwh),
    coberturaPct: num(linha.cobertura_pct),
    kitItens: (linha.itens ?? []).map(paraPropostaItem),
    valorTotal: num(linha.valor_total),
    economiaMensal: num(linha.economia_mensal),
    economiaAnual: num(linha.economia_anual),
    economia25Anos: num(linha.economia_25_anos),
    paybackAnos: num(linha.payback_anos),
    formaPagamento: linha.forma_pagamento,
    descontoAvistaPct: linha.desconto_avista_pct ?? undefined,
    parcelasCartao: linha.parcelas_cartao ?? undefined,
    taxaCartaoPct: linha.taxa_cartao_pct ?? undefined,
    entradaFinanciamentoValor: linha.entrada_financiamento_valor ?? undefined,
    entradaFinanciamentoPct: linha.entrada_financiamento_pct ?? undefined,
    parcelasFinanciamento: linha.parcelas_financiamento ?? undefined,
    jurosFinanciamentoMesPct: linha.juros_financiamento_mes_pct ?? undefined,
    bancoFinanciamento: linha.banco_financiamento ?? undefined,
    dataCriacao: paraDataBR(linha.criado_em),
    status: linha.status === 'recusada' || linha.status === 'expirada' ? 'enviada' : linha.status,
    observacoes: linha.observacoes ?? undefined,
    customLogoUrl: linha.logo_customizada_url ?? undefined,
  };
}

export function deProposta(p: Proposta): Record<string, unknown> {
  return {
    lead_id: p.leadId || null,
    cliente_nome: p.clienteNome,
    cpf_cnpj: p.cpfCnpj || null,
    telefone: p.telefone || null,
    email: p.email || null,
    endereco: p.endereco || null,
    cidade: p.cidade || null,
    concessionaria: p.concessionaria || null,
    telhado: p.telhado || null,
    consumo_kwh: p.consumoKwh,
    tarifa_kwh: p.tarifaKwh,
    hsp: p.hsp,
    perdas_pct: p.perdasPct,
    modulo_wp: p.moduloWp,
    potencia_kwp: p.potenciaKwp,
    modulos_qtd: p.modulosQtd,
    area_estimada_m2: p.areaEstimadaM2,
    geracao_media_kwh: p.geracaoMediaKwh,
    cobertura_pct: p.coberturaPct,
    economia_mensal: p.economiaMensal,
    economia_anual: p.economiaAnual,
    economia_25_anos: p.economia25Anos,
    payback_anos: p.paybackAnos,
    forma_pagamento: p.formaPagamento,
    desconto_avista_pct: p.descontoAvistaPct ?? null,
    parcelas_cartao: p.parcelasCartao ?? null,
    taxa_cartao_pct: p.taxaCartaoPct ?? null,
    entrada_financiamento_valor: p.entradaFinanciamentoValor ?? null,
    entrada_financiamento_pct: p.entradaFinanciamentoPct ?? null,
    parcelas_financiamento: p.parcelasFinanciamento ?? null,
    juros_financiamento_mes_pct: p.jurosFinanciamentoMesPct ?? null,
    observacoes: p.observacoes ?? null,
    logo_customizada_url: p.customLogoUrl ?? null,
    itens: p.kitItens.map((i) => ({
      produto_id: i.produtoId ?? null,
      descricao: i.descricao,
      qtd: i.qtd,
      valor_unit: i.valorUnit,
    })),
  };
}

/* =========================================================== CONTRATO === */

export function paraContrato(linha: any): Contrato {
  return {
    id: linha.id,
    numero: linha.numero,
    leadId: linha.lead_id ?? '',
    clienteNome: linha.cliente_nome,
    cpfCnpj: txt(linha.cpf_cnpj),
    rgInscricao: txt(linha.rg_inscricao),
    endereco: txt(linha.endereco),
    cep: txt(linha.cep),
    telefone: txt(linha.telefone),
    potenciaKwp: num(linha.potencia_kwp),
    modulosQtd: num(linha.modulos_qtd),
    moduloModelo: txt(linha.modulo_modelo),
    inversorModelo: txt(linha.inversor_modelo),
    estrutura: txt(linha.estrutura),
    prazoExecucao: txt(linha.prazo_execucao),
    localInstalacao: txt(linha.local_instalacao),
    valorTotal: num(linha.valor_total),
    formaPagamento: txt(linha.forma_pagamento),
    entrada: txt(linha.entrada),
    parcelasInfo: txt(linha.parcelas_info),
    bancoAgente: txt(linha.banco_agente),
    primeiroVencimento: paraDataBR(linha.primeiro_vencimento),
    multaAtraso: txt(linha.multa_atraso),
    foroEleito: txt(linha.foro_eleito),
    garantias: {
      modulos: txt(linha.garantia_modulos),
      inversores: txt(linha.garantia_inversores),
      instalacao: txt(linha.garantia_instalacao),
      homologacao: txt(linha.garantia_homologacao),
    },
    responsavelTecnico: txt(linha.responsavel_tecnico),
    crea: txt(linha.crea),
    clausulas: (linha.clausulas ?? []).map((c: any) => c.titulo),
    status: linha.status === 'cancelado' ? 'aguardando' : linha.status,
    dataEmissao: paraDataBR(linha.data_emissao),
  };
}

export function deContrato(c: Contrato): Record<string, unknown> {
  return {
    lead_id: c.leadId || null,
    cliente_nome: c.clienteNome,
    cpf_cnpj: c.cpfCnpj,
    rg_inscricao: c.rgInscricao || null,
    endereco: c.endereco,
    cep: c.cep || null,
    telefone: c.telefone || null,
    potencia_kwp: c.potenciaKwp,
    modulos_qtd: c.modulosQtd,
    modulo_modelo: c.moduloModelo || null,
    inversor_modelo: c.inversorModelo || null,
    estrutura: c.estrutura || null,
    prazo_execucao: c.prazoExecucao || null,
    local_instalacao: c.localInstalacao || null,
    valor_total: c.valorTotal,
    forma_pagamento: c.formaPagamento || null,
    entrada: c.entrada || null,
    parcelas_info: c.parcelasInfo || null,
    banco_agente: c.bancoAgente || null,
    primeiro_vencimento: paraDataISO(c.primeiroVencimento),
    multa_atraso: c.multaAtraso || null,
    foro_eleito: c.foroEleito || null,
    garantia_modulos: c.garantias?.modulos || null,
    garantia_inversores: c.garantias?.inversores || null,
    garantia_instalacao: c.garantias?.instalacao || null,
    garantia_homologacao: c.garantias?.homologacao || null,
    responsavel_tecnico: c.responsavelTecnico || null,
    crea: c.crea || null,
    clausulas: c.clausulas ?? [],
  };
}

/* ========================================================= FINANCEIRO === */

export function paraBoleto(linha: any): Boleto {
  return {
    id: linha.id,
    numeroDocumento: txt(linha.numero_documento),
    linhaDigitavel: txt(linha.linha_digitavel),
    clienteNome: linha.cliente_nome,
    cpfCnpj: linha.cpf_cnpj ?? undefined,
    valor: num(linha.valor),
    parcela: txt(linha.parcela_label),
    vencimento: paraDataBR(linha.vencimento),
    situacao: linha.situacao === 'cancelado' ? 'em_aberto' : linha.situacao,
    tipo: linha.tipo === 'a_receber' ? 'A receber' : 'A pagar',
    categoria: txt(linha.categoria),
    obraRef: linha.obra_ref ?? undefined,
    dataPagamento: linha.data_pagamento ? paraDataBR(linha.data_pagamento) : undefined,
  };
}

export function deBoleto(b: Boleto): Record<string, unknown> {
  return {
    numero_documento: b.numeroDocumento || null,
    linha_digitavel: b.linhaDigitavel || null,
    cliente_nome: b.clienteNome,
    cpf_cnpj: b.cpfCnpj || null,
    valor: b.valor,
    parcela_label: b.parcela || null,
    vencimento: paraDataISO(b.vencimento),
    tipo: b.tipo === 'A receber' ? 'a_receber' : 'a_pagar',
    categoria: b.categoria || null,
  };
}

export function paraLancamento(linha: any): LancamentoFinanceiro {
  return {
    id: linha.id,
    data: paraDataBR(linha.data),
    descricao: linha.descricao,
    categoria: txt(linha.categoria),
    obraRef: linha.obra_ref ?? '–',
    // O front espera despesa negativa; o banco guarda sempre positivo.
    valor: num(linha.valor_com_sinal ?? linha.valor),
    tipo: linha.tipo,
  };
}

export function deLancamento(l: LancamentoFinanceiro): Record<string, unknown> {
  return {
    data: paraDataISO(l.data) ?? new Date().toISOString().slice(0, 10),
    descricao: l.descricao,
    categoria: l.categoria || null,
    tipo: l.tipo,
    valor: Math.abs(l.valor),
  };
}

/* ========================================================= AGENDAMENTO === */

export function paraAgendamento(linha: any): Agendamento {
  return {
    id: linha.id,
    leadId: linha.lead_id ?? '',
    leadNome: linha.lead_nome,
    tipo: linha.tipo,
    titulo: linha.titulo,
    data: txt(linha.data),
    horarioInicio: paraHoraCurta(linha.horario_inicio),
    horarioFim: paraHoraCurta(linha.horario_fim),
    endereco: txt(linha.endereco),
    cidade: txt(linha.cidade),
    responsavel: txt(linha.responsavel),
    status: linha.status,
    observacoes: linha.observacoes ?? undefined,
    dataCriacao: linha.criado_em ? paraDataBR(linha.criado_em) : undefined,
  };
}

export function deAgendamento(a: Agendamento): Record<string, unknown> {
  return {
    lead_id: a.leadId || null,
    lead_nome: a.leadNome,
    tipo: a.tipo,
    titulo: a.titulo,
    data: a.data,
    horario_inicio: a.horarioInicio,
    horario_fim: a.horarioFim,
    endereco: a.endereco || null,
    cidade: a.cidade || null,
    responsavel: a.responsavel || null,
    status: a.status,
    observacoes: a.observacoes ?? null,
  };
}

/* =============================================================== OBRA === */

export function paraObra(linha: any): Obra {
  const h = linha.homologacao ?? {};
  return {
    id: linha.id,
    numero: linha.numero,
    contratoId: linha.contrato_id ?? undefined,
    leadId: linha.lead_id ?? undefined,
    propostaId: linha.proposta_id ?? undefined,
    clienteNome: linha.cliente_nome,
    cidade: txt(linha.cidade),
    endereco: txt(linha.endereco),
    concessionaria: txt(linha.concessionaria),
    potenciaKwp: num(linha.potencia_kwp),
    modulosQtd: num(linha.modulos_qtd),
    moduloModelo: txt(linha.modulo_modelo),
    inversorModelo: txt(linha.inversor_modelo),
    responsavelTecnico: txt(linha.responsavel_tecnico),
    equipeInstalacao: txt(linha.equipe_instalacao),
    etapa: linha.etapa,
    status: linha.status,
    valorObra: num(linha.valor_obra),
    dataInicio: txt(linha.data_inicio),
    previsaoConclusao: txt(linha.previsao_conclusao),
    dataConclusao: linha.data_conclusao ?? undefined,
    homologacao: {
      solicitacaoAcesso: !!h.solicitacao_acesso,
      parecerAcesso: !!h.parecer_acesso,
      vistoriaAgendada: !!h.vistoria_agendada,
      vistoriaAprovada: !!h.vistoria_aprovada,
      trocaMedidor: !!h.troca_medidor,
      relatorioConexao: !!h.relatorio_conexao,
    },
    kitItens: (linha.kit ?? []).map(paraPropostaItem),
    estoqueBaixado: !!linha.estoque_baixado,
    observacoes: linha.observacoes ?? undefined,
    historico: (linha.historico ?? []).map(paraHistorico),
  };
}

export function deObra(o: Obra): Record<string, unknown> {
  return {
    contrato_id: o.contratoId || null,
    lead_id: o.leadId || null,
    proposta_id: o.propostaId || null,
    cliente_nome: o.clienteNome,
    cidade: o.cidade || null,
    endereco: o.endereco || null,
    concessionaria: o.concessionaria || null,
    potencia_kwp: o.potenciaKwp,
    modulos_qtd: o.modulosQtd,
    modulo_modelo: o.moduloModelo || null,
    inversor_modelo: o.inversorModelo || null,
    responsavel_tecnico: o.responsavelTecnico || null,
    equipe_instalacao: o.equipeInstalacao || null,
    etapa: o.etapa,
    valor_obra: o.valorObra,
    data_inicio: o.dataInicio || null,
    previsao_conclusao: o.previsaoConclusao || null,
    observacoes: o.observacoes ?? null,
    kit: (o.kitItens ?? []).map((i) => ({
      produto_id: i.produtoId ?? null,
      descricao: i.descricao,
      qtd: i.qtd,
      valor_unit: i.valorUnit,
    })),
    // Pede ao servidor para baixar o kit na mesma transação da criação.
    // Sem isso a obra teria de existir primeiro, e uma falha no meio deixaria
    // estoque consumido sem obra (ou obra sem baixa).
    baixar_estoque: o.estoqueBaixado === true,
  };
}

/** Checklist do front -> corpo do PATCH /obras/:id/homologacao. */
export function deHomologacao(h: Obra['homologacao']): Record<string, unknown> {
  return {
    solicitacao_acesso: h.solicitacaoAcesso,
    parecer_acesso: h.parecerAcesso,
    vistoria_agendada: h.vistoriaAgendada,
    vistoria_aprovada: h.vistoriaAprovada,
    troca_medidor: h.trocaMedidor,
    relatorio_conexao: h.relatorioConexao,
  };
}

/* ========================================================== AUDITORIA === */

export function paraAuditEntry(linha: any): AuditEntry {
  return {
    id: String(linha.id),
    timestamp: linha.ocorrido_em,
    usuario: linha.usuario_nome,
    usuarioId: linha.usuario_id ?? undefined,
    acao: linha.acao,
    entidade: linha.entidade,
    entidadeId: linha.entidade_id ?? undefined,
    alvo: linha.alvo,
    detalhes: linha.detalhes ?? undefined,
  };
}
