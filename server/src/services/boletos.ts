// Regras de boleto compartilhadas entre a rota HTTP (financeiro.routes.ts) e o
// webhook do Banco do Brasil (bbWebhook.routes.ts) — ambos precisam dar baixa
// do mesmo jeito, e duplicar o UPDATE + auditoria nos dois lugares é como duas
// cópias divergem sem ninguém perceber.

import type { Cliente } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { registrarBoleto, type PagadorBB } from './bb/cobrancas.js';

interface DadosBaixa {
  data_pagamento?: string | null;
  valor_pago?: number | null;
  juros_multa?: number | null;
}

/**
 * Dá baixa num boleto em aberto. Devolve `null` (em vez de lançar) quando o
 * boleto não existe ou já está pago — a rota HTTP trata isso como 404, mas o
 * webhook do BB trata como reentrega/duplicata e só loga, porque o BB não
 * garante entrega única do evento.
 */
export async function darBaixaBoleto(
  cliente: Cliente,
  id: string,
  dados: DadosBaixa,
): Promise<{ id: string; cliente_nome: string; parcela_label: string | null } | null> {
  const { rows } = await cliente.query(
    `UPDATE "SolarCosta_Boletos" SET
        situacao       = 'pago',
        data_pagamento = COALESCE($2::date, CURRENT_DATE),
        valor_pago     = COALESCE($3, valor),
        juros_multa    = COALESCE($4, juros_multa)
      WHERE id = $1 AND excluido_em IS NULL AND situacao <> 'pago'
      RETURNING id, cliente_nome, parcela_label`,
    [id, dados.data_pagamento ?? null, dados.valor_pago ?? null, dados.juros_multa ?? null],
  );
  if (rows.length === 0) return null;

  await cliente.query(
    `SELECT "SolarCosta_fn_auditar"('editar','Boleto',$1,$2,'Baixa')`,
    [`Boleto ${rows[0].parcela_label ?? ''} — ${rows[0].cliente_nome}`, id],
  );

  return rows[0];
}

export async function buscarBoletoIdPorNossoNumero(cliente: Cliente, nossoNumero: string): Promise<string | null> {
  const { rows } = await cliente.query(
    `SELECT id FROM "SolarCosta_Boletos" WHERE nosso_numero = $1 AND excluido_em IS NULL`,
    [nossoNumero],
  );
  return rows[0]?.id ?? null;
}

/** "000" + convênio (7 dígitos) + sequencial (10 dígitos) — layout exigido para numeroTituloCliente. */
async function gerarNossoNumero(cliente: Cliente): Promise<string> {
  if (!config.BB_CONVENIO_COBRANCA) {
    throw new AppError(503, 'Integração com o Banco do Brasil indisponível: convênio não configurado.', 'bb_desligado');
  }
  const { rows } = await cliente.query(`SELECT nextval('"SolarCosta_seq_bb_nosso_numero"') AS seq`);
  const sequencial = String(rows[0].seq).padStart(10, '0');
  const convenio = config.BB_CONVENIO_COBRANCA.padStart(7, '0');
  return `000${convenio}${sequencial}`;
}

function paraPagador(clienteNome: string, cpfCnpj: string | null): PagadorBB {
  const digitos = (cpfCnpj ?? '').replace(/\D/g, '');
  return {
    tipoInscricao: digitos.length > 11 ? 2 : 1,
    numeroInscricao: digitos,
    nome: clienteNome,
  };
}

interface BoletoParaEmissao {
  id: string;
  cliente_nome: string;
  cpf_cnpj: string | null;
  valor: number;
  vencimento: string;
}

/**
 * Registra o boleto no BB e grava linha_digitavel/nosso_numero/Pix no banco.
 * Assume convênio tipo 4 (Cliente Numera, Emite e Expede) — o "nosso número" é
 * gerado por nós (gerarNossoNumero). Convênio tipo 3 exigiria NÃO enviar
 * numeroTituloCliente e usar o que o BB devolver; ajuste aqui se for o caso.
 */
export async function emitirBoletoNoBB(
  cliente: Cliente,
  boleto: BoletoParaEmissao,
  opcoes: { aceitarPix: boolean },
): Promise<void> {
  if (!boleto.cpf_cnpj) {
    throw new AppError(422, 'Informe o CPF/CNPJ do sacado antes de emitir pelo Banco do Brasil.', 'cpf_cnpj_obrigatorio');
  }

  const nossoNumero = await gerarNossoNumero(cliente);
  const numeroTituloBeneficiario = boleto.id.replace(/-/g, '').slice(0, 15).toUpperCase();

  const registro = await registrarBoleto({
    numeroTituloCliente: nossoNumero,
    numeroTituloBeneficiario,
    dataVencimento: boleto.vencimento,
    valorOriginal: boleto.valor,
    pagador: paraPagador(boleto.cliente_nome, boleto.cpf_cnpj),
    indicadorPix: opcoes.aceitarPix ? 'S' : 'N',
  });

  await cliente.query(
    `UPDATE "SolarCosta_Boletos" SET
        numero_documento      = $2,
        linha_digitavel       = $3,
        nosso_numero          = $4,
        pix_qrcode            = $5,
        pix_txid              = $6,
        bb_numero_convenio    = $7,
        codigo_barra_numerico = $8
      WHERE id = $1`,
    [
      boleto.id,
      numeroTituloBeneficiario,
      registro.linhaDigitavel,
      registro.nossoNumero,
      registro.pix?.qrcode ?? null,
      registro.pix?.txid ?? null,
      Number(config.BB_CONVENIO_COBRANCA),
      registro.codigoBarraNumerico,
    ],
  );

  await cliente.query(
    `SELECT "SolarCosta_fn_auditar"('editar','Boleto',$1,$2,'Emitido pelo Banco do Brasil')`,
    [`Boleto — ${boleto.cliente_nome}`, boleto.id],
  );
}
