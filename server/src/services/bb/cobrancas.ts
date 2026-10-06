// Integração com a API de Cobranças do Banco do Brasil (registro, consulta e
// baixa de boletos). Terceira integração externa do projeto, no mesmo desenho
// de uazapi.ts e googleSolar.ts: `fetch` nativo, nada de acesso a banco aqui
// (quem persiste é financeiro.routes.ts / services/boletos.ts), erro traduzido
// para AppError antes de sair.
//
// Registro de boleto simples e bolepix (indicadorPix='S') testados de ponta a
// ponta contra o sandbox (api.hm.bb.com.br) em 2026-09-30 — os nomes de campo
// de `RespostaRegistro`, incluindo qrCode.txId/qrCode.emv, batem com a
// resposta real do BB. O scope do OAuth2 (`SCOPE` abaixo) também foi
// confirmado direto contra o /oauth/token; sem ele o BB rejeita com
// `invalid_scope` mesmo com client_id/client_secret corretos.

import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { obterToken } from './auth.js';

const TIMEOUT_MS = 15_000;

// Confirmado direto contra o /oauth/token de sandbox — sem isto o BB rejeita
// com `invalid_scope` (ver guia Segurança > Parâmetro scope), mesmo com
// client_id/client_secret corretos. Lista separada por espaço, exigida pelo BB.
const SCOPE = 'cobrancas.boletos-requisicao cobrancas.boletos-info';

function baseUrl(): string {
  return config.BB_AMBIENTE === 'producao'
    ? 'https://api.bb.com.br/cobrancas/v2'
    : 'https://api.hm.bb.com.br/cobrancas/v2';
}

function appKey(): string {
  if (!config.BB_APP_KEY) {
    throw new AppError(503, 'Integração com o Banco do Brasil indisponível: BB_APP_KEY não configurada.', 'bb_desligado');
  }
  return config.BB_APP_KEY;
}

function dadosConvenio() {
  if (
    !config.BB_CONVENIO_COBRANCA ||
    !config.BB_VARIACAO_CARTEIRA ||
    !config.BB_MODALIDADE ||
    !config.BB_AGENCIA ||
    !config.BB_CONTA
  ) {
    throw new AppError(
      503,
      'Integração com o Banco do Brasil indisponível: dados do convênio de cobrança não configurados.',
      'bb_desligado',
    );
  }
  return {
    convenio: config.BB_CONVENIO_COBRANCA,
    carteira: config.BB_CARTEIRA,
    variacaoCarteira: config.BB_VARIACAO_CARTEIRA,
    modalidade: config.BB_MODALIDADE,
    agencia: config.BB_AGENCIA,
    conta: config.BB_CONTA,
  };
}

/** 'AAAA-MM-DD' (nosso formato) -> 'DD.MM.AAAA' (formato exigido pela API do BB). */
function paraDataBB(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}.${mes}.${ano}`;
}

/** 'DD.MM.AAAA' (BB) -> 'AAAA-MM-DD' (nosso formato). */
function deDataBB(dataBB: string): string {
  const [dia, mes, ano] = dataBB.split('.');
  return `${ano}-${mes}-${dia}`;
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST' | 'PATCH'; corpo?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = await obterToken(SCOPE);
  const params = new URLSearchParams({ 'gw-dev-app-key': appKey(), ...opcoes.query });
  const url = `${baseUrl()}${caminho}?${params.toString()}`;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: opcoes.metodo ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      signal: controlador.signal,
    });
  } catch (erro) {
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new AppError(504, 'O Banco do Brasil não respondeu à cobrança a tempo.', 'bb_timeout');
    }
    throw new AppError(502, 'Não foi possível contatar a API de Cobranças do Banco do Brasil.', 'bb_indisponivel');
  } finally {
    clearTimeout(timeout);
  }

  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    // A API do BB devolve `erros: [{ codigo, mensagem, ... }]` nas respostas de
    // erro — repassar a primeira mensagem é mais útil do que um genérico.
    const mensagem = corpo?.erros?.[0]?.mensagem ?? corpo?.mensagem ?? `Erro ${resposta.status} na API do Banco do Brasil.`;
    console.error(`[bb/cobrancas] ${opcoes.metodo ?? 'GET'} ${caminho} -> ${resposta.status}`, corpo);
    throw new AppError(resposta.status >= 500 ? 502 : 422, mensagem, 'bb_recusado');
  }

  return corpo as T;
}

/* ============================================================== TIPOS == */

export interface PagadorBB {
  /** 1 = pessoa física, 2 = pessoa jurídica. */
  tipoInscricao: 1 | 2;
  /** CPF ou CNPJ sem pontuação e sem zeros à esquerda. */
  numeroInscricao: string;
  nome?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  bairro?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

export interface RegistrarBoletoEntrada {
  /** "Nosso número" já montado pelo chamador (ver services/boletos.ts). */
  numeroTituloCliente: string;
  /** "Seu número": até 15 caracteres alfanuméricos, geralmente o id interno do boleto. */
  numeroTituloBeneficiario: string;
  /** 'AAAA-MM-DD'. */
  dataVencimento: string;
  valorOriginal: number;
  pagador: PagadorBB;
  /** 'S' gera QR Code Pix vinculado (bolepix); omitido/‘N’ é só boleto. */
  indicadorPix?: 'S' | 'N';
}

export interface RegistroBoletoBB {
  linhaDigitavel: string;
  codigoBarraNumerico: string | null;
  nossoNumero: string;
  /** Presente só quando indicadorPix foi 'S'. */
  pix: { txid: string; qrcode: string } | null;
}

interface RespostaRegistro {
  numero?: string;
  linhaDigitavel?: string;
  codigoBarraNumerico?: string;
  numeroTituloCliente?: string;
  qrCode?: { txId?: string; emv?: string; url?: string };
}

/** Registra um boleto (com ou sem Pix vinculado). */
export async function registrarBoleto(dados: RegistrarBoletoEntrada): Promise<RegistroBoletoBB> {
  const convenio = dadosConvenio();
  const hoje = new Date().toISOString().slice(0, 10);

  const corpo = {
    numeroConvenio: Number(convenio.convenio),
    numeroCarteira: Number(convenio.carteira),
    numeroVariacaoCarteira: Number(convenio.variacaoCarteira),
    codigoModalidade: Number(convenio.modalidade),
    dataEmissao: paraDataBB(hoje),
    dataVencimento: paraDataBB(dados.dataVencimento),
    valorOriginal: dados.valorOriginal,
    codigoAceite: 'A',
    codigoTipoTitulo: 2, // Duplicata Mercantil por Indicação — o mais genérico p/ venda de serviço
    indicadorPermissaoRecebimentoParcial: 'N',
    numeroTituloBeneficiario: dados.numeroTituloBeneficiario,
    numeroTituloCliente: dados.numeroTituloCliente,
    pagador: {
      tipoInscricao: dados.pagador.tipoInscricao,
      numeroInscricao: dados.pagador.numeroInscricao,
      nome: dados.pagador.nome,
      endereco: dados.pagador.endereco,
      cep: dados.pagador.cep,
      cidade: dados.pagador.cidade,
      bairro: dados.pagador.bairro,
      uf: dados.pagador.uf,
      telefone: dados.pagador.telefone,
      email: dados.pagador.email,
    },
    ...(dados.indicadorPix ? { indicadorPix: dados.indicadorPix } : {}),
  };

  const resp = await chamar<RespostaRegistro>('/boletos', { metodo: 'POST', corpo });

  return {
    linhaDigitavel: resp.linhaDigitavel ?? '',
    codigoBarraNumerico: resp.codigoBarraNumerico ?? null,
    nossoNumero: resp.numeroTituloCliente ?? dados.numeroTituloCliente,
    pix: resp.qrCode?.emv && resp.qrCode?.txId ? { txid: resp.qrCode.txId, qrcode: resp.qrCode.emv } : null,
  };
}

export interface SituacaoBoletoBB {
  /** codigoEstadoTituloCobranca bruto — ver domínio na doc de Listagem de boletos. */
  codigoEstadoTituloCobranca: number;
  dataPagamento: string | null; // 'AAAA-MM-DD'
  valorPago: number | null;
}

interface RespostaDetalhamento {
  codigoEstadoTituloCobranca?: number;
  dataPagamento?: string;
  valorPago?: number;
}

/** Consulta a situação atual de um boleto já registrado, direto no BB. */
export async function consultarBoleto(nossoNumero: string): Promise<SituacaoBoletoBB> {
  const convenio = dadosConvenio();
  const resp = await chamar<RespostaDetalhamento>(`/boletos/${nossoNumero}`, {
    query: { numeroConvenio: convenio.convenio },
  });

  return {
    codigoEstadoTituloCobranca: resp.codigoEstadoTituloCobranca ?? 0,
    dataPagamento: resp.dataPagamento ? deDataBB(resp.dataPagamento.slice(0, 10)) : null,
    valorPago: resp.valorPago ?? null,
  };
}

/** Cancela (baixa) um boleto ainda em ser. Só aceito 30min+ depois do registro. */
export async function baixarBoleto(nossoNumero: string): Promise<void> {
  const convenio = dadosConvenio();
  await chamar(`/boletos/${nossoNumero}/baixar`, {
    metodo: 'POST',
    corpo: { numeroConvenio: Number(convenio.convenio) },
  });
}

export interface BaixaOperacional {
  /** = nosso_numero. */
  id: string;
  dataLiquidacao: string; // 'AAAA-MM-DD'
  valorPagoSacado: number;
  /** 1 = baixa pelo BB, 2 = baixa por outro banco, 10 = cancelamento de baixa. */
  codigoEstadoBaixaOperacional: number;
}

interface RespostaBaixaOperacional {
  numeroTituloCliente?: string;
  dataLiquidacao?: string;
  valorPagoSacado?: number;
  codigoEstadoBaixaOperacional?: number;
}

/**
 * Lista boletos pagos (em qualquer banco) no período informado — usada pelo
 * scheduler como rede de segurança para o que o webhook não capturar.
 * A consulta só alcança até 5 dias corridos (limite documentado pelo BB).
 */
export async function listarBaixaOperacional(dataInicio: string, dataFim: string): Promise<BaixaOperacional[]> {
  const convenio = dadosConvenio();
  const resp = await chamar<{ listaBoletos?: RespostaBaixaOperacional[] }>('/boletos-baixa-operacional', {
    query: {
      agencia: convenio.agencia,
      conta: convenio.conta,
      carteira: convenio.carteira,
      variacao: convenio.variacaoCarteira,
      dataInicioAgendamentoTitulo: paraDataBB(dataInicio),
      dataFimAgendamentoTitulo: paraDataBB(dataFim),
    },
  });

  return (resp.listaBoletos ?? [])
    .filter((b): b is Required<Pick<RespostaBaixaOperacional, 'numeroTituloCliente' | 'dataLiquidacao'>> & RespostaBaixaOperacional =>
      Boolean(b.numeroTituloCliente && b.dataLiquidacao),
    )
    .map((b) => ({
      id: b.numeroTituloCliente,
      dataLiquidacao: deDataBB(b.dataLiquidacao.slice(0, 10)),
      valorPagoSacado: b.valorPagoSacado ?? 0,
      codigoEstadoBaixaOperacional: b.codigoEstadoBaixaOperacional ?? 1,
    }));
}
