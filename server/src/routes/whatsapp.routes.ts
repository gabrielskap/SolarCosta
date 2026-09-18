// WhatsApp — conexão da instância.
//
// Substitui o wa.me de src/utils/contato.ts como canal de saída: lá o sistema
// abria o app do celular e perdia a mensagem de vista; aqui ele fala com a
// uazapi e guarda o que aconteceu.
//
// Este arquivo cobre a CONEXÃO (QR, status, desconectar), os modelos de
// mensagem e o envio a partir de um documento. Conversas, thread, mídia e
// resposta ficam em whatsappCaixa.routes.ts, montado no mesmo prefixo — a
// divisão é por tamanho, não por domínio: juntos os dois passariam de mil
// linhas e ninguém acharia nada.
//
// O recebimento entra por whatsappWebhook.routes.ts, que não exige login.
//
// REGRA QUE VALE PARA TODO ESTE ARQUIVO: o token da instância nunca sai daqui.
// Ele entra na resposta de nenhuma rota, nem para administrador — quem o tiver
// envia mensagem no nome da empresa sem passar por login, e o navegador é o
// lugar mais fácil de vazá-lo.

import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { consultar, consultarUm, emTransacao, type Cliente } from '../db.js';
import { asyncHandler, AppError, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';
import { cifrar, decifrar } from '../services/segredos.js';
import { obterOuCriarLink } from '../services/linksPublicos.js';
import { gerarPdfDocumento } from '../services/pdfDocumento.js';
import { telefoneInternacional } from '../utils/telefone.js';
import * as uazapi from '../services/uazapi.js';
import { enviarERegistrar } from '../services/envioWhatsapp.js';
import { registrarNaTimeline } from '../services/whatsappConversas.js';
import {
  carregarInstancia,
  comRegistroDeErro,
  exigirConectada,
  exigirToken,
  type LinhaInstancia,
} from '../services/whatsappInstancia.js';

export const whatsappRouter = Router();
whatsappRouter.use(exigirLogin);

/**
 * Conectar e desconectar ficam atrás de `gerenciar_usuarios`, não de
 * `usar_whatsapp`: trocar o número da empresa é ato de administração, e quem
 * atende cliente não precisa poder derrubar o canal de todo mundo.
 */
const exigirAdmin = exigirPermissao('gerenciar_usuarios');

/** Endereço que a uazapi vai chamar quando chegar mensagem. */
function urlWebhook(segredo: string): string {
  return `${config.APP_URL!.replace(/\/+$/, '')}/api/webhooks/whatsapp/${segredo}`;
}

/**
 * Grava o que a uazapi devolveu.
 *
 * `COALESCE($n, coluna)` em vez de atribuição direta: o /instance/status não
 * repete o token nem o número em toda resposta, e sobrescrever com null
 * desconectaria a instância a cada polling do QR.
 */
async function salvarEstado(
  cliente: Cliente,
  id: string,
  i: uazapi.InstanciaUazapi,
): Promise<void> {
  await cliente.query(
    `UPDATE "SolarCosta_WhatsAppInstancia" SET
        instancia_id     = COALESCE($2, instancia_id),
        token_cifrado    = COALESCE($3, token_cifrado),
        status           = $4,
        numero_conectado = COALESCE($5, numero_conectado),
        profile_name     = COALESCE($6, profile_name),
        ultimo_status_em = now(),
        -- Conectou: limpa o erro anterior e carimba a data, sem reescrevê-la
        -- a cada polling que já encontra a instância conectada.
        ultimo_erro      = CASE WHEN $4 = 'conectada' THEN NULL ELSE ultimo_erro END,
        conectado_em     = CASE WHEN $4 = 'conectada' THEN COALESCE(conectado_em, now()) ELSE conectado_em END
      WHERE id = $1`,
    [
      id,
      i.id,
      i.token ? cifrar(i.token) : null,
      i.status,
      i.numero,
      i.profileName,
    ],
  );
}

/** Resposta pública da instância — sem token, sempre. */
function paraApi(linha: LinhaInstancia, qrcode: string | null = null) {
  return {
    status: linha.status,
    numero: linha.numero_conectado,
    perfil: linha.profile_name,
    conectado_em: linha.conectado_em,
    ultimo_erro: linha.ultimo_erro,
    qrcode,
  };
}

/* ========================================================== INSTÂNCIA == */

whatsappRouter.get(
  '/instancia',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (_req, res) => {
    // Sem consultar a uazapi: esta rota é chamada a cada abertura da tela, e o
    // status no banco é mantido em dia pelo webhook `connection`. Pagar uma
    // ida à uazapi aqui só adicionaria latência e um ponto de falha.
    const linha = await carregarInstancia();
    res.json({ instancia: paraApi(linha), ativo: config.whatsappAtivo });
  }),
);

/**
 * Inicia o pareamento e devolve o QR code.
 *
 * Três passos, nesta ordem, e a ordem importa:
 *   1. cria a instância se ainda não existe (é o único momento em que a uazapi
 *      revela o token da instância — perdê-lo aqui obrigaria a recriar tudo);
 *   2. registra o webhook ANTES de conectar, para não existir janela em que o
 *      número já recebe mensagem e nós ainda não sabemos para onde ela vai;
 *   3. pede o QR.
 */
whatsappRouter.post(
  '/instancia/conectar',
  exigirAdmin,
  asyncHandler(async (req: RequestAutenticado, res) => {
    if (!config.whatsappAtivo) {
      throw new AppError(
        503,
        'Integração com WhatsApp desligada: UAZAPI_ADMIN_TOKEN não configurada no servidor.',
        'whatsapp_desligado',
      );
    }

    const linha = await carregarInstancia();

    // 1. Instância
    let token: string;
    if (linha.token_cifrado && linha.instancia_id) {
      token = decifrar(linha.token_cifrado);
    } else {
      const criada = await uazapi.criarInstancia(linha.nome_instancia);
      token = criada.token!;
      await emTransacao((cliente) => salvarEstado(cliente, linha.id, criada), ator(req));
    }

    // 2. Webhook
    await uazapi.configurarWebhook(token, urlWebhook(linha.webhook_segredo));

    // 3. QR
    const conectando = await uazapi.conectar(token, linha.nome_instancia);

    await emTransacao(async (cliente) => {
      await salvarEstado(cliente, linha.id, conectando);
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','WhatsApp',$1,NULL,$2)`,
        ['Instância de WhatsApp', 'Pareamento iniciado'],
      );
    }, ator(req));

    // `conectando.paircode` NÃO vai na resposta: `uazapi.conectar()` não manda
    // `phone`, e sem ele a uazapi sempre devolve QR, nunca código de
    // pareamento. O campo existe no contrato deles e continua lido pelo
    // normalizar() do uazapi.ts — devolvê-lo aqui só faria parecer que existe
    // um pareamento por código que ninguém implementou.
    const atualizada = await carregarInstancia();
    res.json({ instancia: paraApi(atualizada, conectando.qrcode) });
  }),
);

/**
 * QR renovado e status, para a tela consultar em laço durante o pareamento.
 *
 * Bate na uazapi de propósito — ao contrário de GET /instancia, aqui o dado
 * fresco é o produto. E é esta rota que renova o QR, não o /conectar: chamar
 * connect de novo reiniciaria o pareamento e invalidaria o código que a pessoa
 * está escaneando naquele instante.
 */
whatsappRouter.get(
  '/instancia/qr',
  exigirAdmin,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const linha = await carregarInstancia();
    const token = exigirToken(linha);

    const atual = await uazapi.statusInstancia(token);
    await emTransacao((cliente) => salvarEstado(cliente, linha.id, atual), ator(req));

    const atualizada = await carregarInstancia();
    res.json({ instancia: paraApi(atualizada, atual.qrcode) });
  }),
);

whatsappRouter.post(
  '/instancia/desconectar',
  exigirAdmin,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const linha = await carregarInstancia();
    const token = exigirToken(linha);

    await uazapi.desconectar(token);

    await emTransacao(async (cliente) => {
      // O token é PRESERVADO: a instância continua existindo no container, e
      // reconectar depois é só escanear um QR novo. Apagá-lo aqui obrigaria a
      // criar outra instância, o que em plano pago custa dinheiro.
      await cliente.query(
        `UPDATE "SolarCosta_WhatsAppInstancia" SET
            status = 'desconectada', numero_conectado = NULL, profile_name = NULL,
            conectado_em = NULL, ultimo_status_em = now()
          WHERE id = $1`,
        [linha.id],
      );
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','WhatsApp',$1,NULL,$2)`,
        ['Instância de WhatsApp', `Número ${linha.numero_conectado ?? '—'} desconectado`],
      );
    }, ator(req));

    res.json({ instancia: paraApi(await carregarInstancia()) });
  }),
);

/* ============================================================ MODELOS == */

const CONTEXTOS = ['proposta', 'contrato', 'lead', 'livre'] as const;

/** Colunas devolvidas em toda rota de modelo — a tela espera sempre as mesmas. */
const COLUNAS_MODELO = 'id, nome, contexto, texto, ordem, ativo';

interface LinhaModelo {
  id: string;
  nome: string;
  contexto: string;
  texto: string;
  ordem: number;
  ativo: boolean;
}

/**
 * `ordem` e `ativo` têm default aqui e não são opcionais na saída: o formulário
 * da tela sempre manda os dois, e um PUT que omitisse um deles apagaria o valor
 * guardado — o schema é o mesmo do POST de propósito, para que editar não seja
 * um caminho com regras próprias.
 */
const modeloSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do modelo.').max(80),
  contexto: z.enum(CONTEXTOS).default('livre'),
  texto: z.string().trim().min(1, 'A mensagem não pode ficar vazia.').max(4000),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  ativo: z.boolean().default(true),
});

whatsappRouter.get(
  '/modelos',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        contexto: z.enum(CONTEXTOS).optional(),
        /**
         * A aba de gestão precisa enxergar o que está desativado — senão não
         * há como reativar. Quem não manda o parâmetro (o seletor de envio e o
         * EnviarPorWhatsApp) continua recebendo só os ativos, como sempre.
         *
         * Lido como string em vez de z.coerce.boolean(): aquele converte por
         * Boolean(), e Boolean('0') é true — "?incluir_inativos=0" passaria a
         * significar o contrário do que está escrito.
         */
        incluir_inativos: z.string().max(5).optional(),
      })
      .parse(req.query);

    const incluirInativos = f.incluir_inativos === '1' || f.incluir_inativos === 'true';

    const params: unknown[] = [];
    const condicoes: string[] = [];
    if (!incluirInativos) condicoes.push('ativo');
    if (f.contexto) {
      params.push(f.contexto);
      condicoes.push(`contexto = $${params.length}`);
    }

    const modelos = await consultar<LinhaModelo>(
      `SELECT ${COLUNAS_MODELO}
         FROM "SolarCosta_WhatsAppModelos"
        ${condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''}
        ORDER BY contexto, ordem, nome`,
      params,
    );

    res.json({ modelos });
  }),
);

/*
 * Criar, editar e excluir modelo ficam em `usar_whatsapp`, não em
 * `gerenciar_usuarios`: quem já pode escrever um texto livre para o cliente não
 * fica mais perigoso por poder salvar esse texto como modelo. O V009 argumenta
 * explicitamente contra inflar a matriz de permissões, e `gerenciar_usuarios`
 * continua valendo só para trocar o número da empresa.
 *
 * Nome repetido não é conferido à mão: a UNIQUE da tabela levanta 23505 e o
 * tratarErros() já o traduz em 409. Conferir antes só criaria uma corrida entre
 * o SELECT e o INSERT.
 */
whatsappRouter.post(
  '/modelos',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = modeloSchema.parse(req.body);

    const modelo = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query<LinhaModelo>(
        `INSERT INTO "SolarCosta_WhatsAppModelos" (nome, contexto, texto, ordem, ativo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUNAS_MODELO}`,
        [d.nome, d.contexto, d.texto, d.ordem, d.ativo],
      );
      const linha = rows[0]!;
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','WhatsApp',$1,$2,$3)`,
        [`Modelo de mensagem ${linha.nome}`, linha.id, `Contexto ${linha.contexto}`],
      );
      return linha;
    }, ator(req));

    res.status(201).json({ modelo });
  }),
);

whatsappRouter.put(
  '/modelos/:id',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = modeloSchema.parse(req.body);

    const modelo = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query<LinhaModelo>(
        `UPDATE "SolarCosta_WhatsAppModelos"
            SET nome = $2, contexto = $3, texto = $4, ordem = $5, ativo = $6
          WHERE id = $1
      RETURNING ${COLUNAS_MODELO}`,
        [id, d.nome, d.contexto, d.texto, d.ordem, d.ativo],
      );
      const linha = rows[0];
      if (!linha) throw naoEncontrado('Modelo de mensagem');
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','WhatsApp',$1,$2,$3)`,
        [`Modelo de mensagem ${linha.nome}`, linha.id, `Contexto ${linha.contexto}`],
      );
      return linha;
    }, ator(req));

    res.json({ modelo });
  }),
);

/** Só o liga-desliga do card. Editar o resto é o PUT. */
whatsappRouter.patch(
  '/modelos/:id',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { ativo } = z.object({ ativo: z.boolean() }).parse(req.body);

    const modelo = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query<LinhaModelo>(
        `UPDATE "SolarCosta_WhatsAppModelos" SET ativo = $2 WHERE id = $1
      RETURNING ${COLUNAS_MODELO}`,
        [id, ativo],
      );
      const linha = rows[0];
      if (!linha) throw naoEncontrado('Modelo de mensagem');
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','WhatsApp',$1,$2,$3)`,
        [
          `Modelo de mensagem ${linha.nome}`,
          linha.id,
          ativo ? 'Modelo reativado' : 'Modelo desativado',
        ],
      );
      return linha;
    }, ator(req));

    res.json({ modelo });
  }),
);

/*
 * DELETE de verdade, não soft delete: nenhuma tabela aponta para modelos por FK
 * — SolarCosta_WhatsAppMensagens guarda o TEXTO já interpolado, não o modelo —,
 * então apagar não deixa mensagem órfã nem muda histórico nenhum. Quem só quer
 * tirar o modelo de circulação usa o PATCH.
 */
whatsappRouter.delete(
  '/modelos/:id',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string }>(
        `DELETE FROM "SolarCosta_WhatsAppModelos" WHERE id = $1 RETURNING nome`,
        [id],
      );
      const linha = rows[0];
      if (!linha) throw naoEncontrado('Modelo de mensagem');
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','WhatsApp',$1,$2,$3)`,
        [`Modelo de mensagem ${linha.nome}`, id, null],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

/* ============================================================= ENVIO == */

/** R$ 1.234,56 — o mesmo formato que a proposta impressa usa. */
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 15/09/2026 */
function dataBR(valor: Date | string | null): string {
  if (!valor) return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Troca os {{marcadores}} pelos valores reais.
 *
 * A interpolação é NOSSA, e não a da uazapi. Ela também aceita {{name}} e
 * afins, mas resolve contra o CRM dela — que não conhece a nossa proposta, o
 * nosso consultor nem o nosso link. Deixar passar para lá entregaria a
 * mensagem com os marcadores intactos no WhatsApp do cliente.
 *
 * Marcador desconhecido some em vez de aparecer cru: "Olá, {{sobrenome}}!" é
 * erro de digitação no modelo, e o cliente não precisa ver o erro.
 */
function interpolar(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => valores[chave] ?? '');
}

interface DadosDocumento {
  telefone: string | null;
  leadId: string | null;
  valores: Record<string, string>;
}

/** Reúne o que os modelos de mensagem sabem citar sobre o documento. */
async function dadosDoDocumento(
  tipo: 'proposta' | 'contrato',
  id: string,
): Promise<DadosDocumento> {
  const empresa = await consultarUm<{ nome_fantasia: string }>(
    `SELECT nome_fantasia FROM "SolarCosta_Empresa" LIMIT 1`,
  );
  const nomeEmpresa = empresa?.nome_fantasia ?? 'Solar Costa';

  if (tipo === 'proposta') {
    const p = await consultarUm<{
      numero: string;
      cliente_nome: string;
      telefone: string | null;
      lead_id: string | null;
      valor_total: number;
      economia_mensal: number | null;
      validade_dias: number;
      criado_em: string;
    }>(
      `SELECT numero, cliente_nome, telefone, lead_id, valor_total,
              economia_mensal, validade_dias, criado_em
         FROM "SolarCosta_Propostas" WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    if (!p) throw naoEncontrado('Proposta');

    const validade = new Date(p.criado_em);
    validade.setDate(validade.getDate() + p.validade_dias);

    return {
      telefone: p.telefone,
      leadId: p.lead_id,
      valores: {
        cliente: p.cliente_nome,
        primeiro_nome: primeiroNome(p.cliente_nome),
        numero: p.numero,
        valor: moeda.format(p.valor_total ?? 0),
        economia_mensal: p.economia_mensal != null ? moeda.format(p.economia_mensal) : '—',
        validade: dataBR(validade),
        empresa: nomeEmpresa,
      },
    };
  }

  const c = await consultarUm<{
    numero: string;
    cliente_nome: string;
    telefone: string | null;
    lead_id: string | null;
    valor_total: number;
  }>(
    `SELECT numero, cliente_nome, telefone, lead_id, valor_total
       FROM "SolarCosta_Contratos" WHERE id = $1 AND excluido_em IS NULL`,
    [id],
  );
  if (!c) throw naoEncontrado('Contrato');

  return {
    telefone: c.telefone,
    leadId: c.lead_id,
    valores: {
      cliente: c.cliente_nome,
      primeiro_nome: primeiroNome(c.cliente_nome),
      numero: c.numero,
      valor: moeda.format(c.valor_total ?? 0),
      economia_mensal: '—',
      validade: '—',
      empresa: nomeEmpresa,
    },
  };
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

const envioSchema = z
  .object({
    /** Livre quando não há documento; havendo, o padrão é o telefone dele. */
    telefone: z.string().max(30).optional(),
    /** Texto pronto. Ignorado quando `modelo_id` vem junto. */
    texto: z.string().max(4000).optional(),
    modelo_id: z.string().uuid().optional(),
    referencia: z
      .object({
        tipo: z.enum(['proposta', 'contrato']),
        id: z.string().uuid(),
      })
      .optional(),
    lead_id: z.string().uuid().optional(),
  })
  .refine((d) => d.texto || d.modelo_id, {
    message: 'Escreva a mensagem ou escolha um modelo.',
  });

whatsappRouter.post(
  '/enviar',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = envioSchema.parse(req.body);

    const instancia = await carregarInstancia();
    const token = exigirToken(instancia);
    exigirConectada(instancia);

    const doc = d.referencia ? await dadosDoDocumento(d.referencia.tipo, d.referencia.id) : null;

    // O telefone informado vence o do documento: o cadastro pode estar velho,
    // e quem está enviando tem o cliente na frente.
    const telefone = telefoneInternacional(d.telefone ?? doc?.telefone);
    if (!telefone) {
      throw new AppError(
        422,
        'Telefone inválido. Informe com DDD — por exemplo (31) 98658-8456.',
        'telefone_invalido',
      );
    }

    if (!(await uazapi.numeroExiste(token, telefone))) {
      throw new AppError(
        422,
        'Esse número não tem WhatsApp. Confira o telefone com o cliente.',
        'numero_sem_whatsapp',
      );
    }

    const leadId = d.lead_id ?? doc?.leadId ?? null;

    /*
     * O PDF é gerado ANTES e FORA da transação de envio.
     *
     * Imprimir leva alguns segundos — abrir a página num Chromium, esperar as
     * fontes, montar o arquivo. Fazer isso com uma transação aberta seguraria
     * uma conexão do pool por todo esse tempo, e três vendedores enviando ao
     * mesmo tempo esgotariam o pool enquanto ninguém escreve nada.
     *
     * O token do link continua sendo criado: ele não vai mais para o cliente,
     * mas é por ele que o renderizador alcança o documento sem login. Se o
     * envio falhar depois, a linha em SolarCosta_LinksPublicos fica — e não é
     * problema: obterOuCriarLink reaproveita link vivo, então a próxima
     * tentativa usa o mesmo.
     */
    let pdf: { bytes: Buffer; nomeArquivo: string } | null = null;
    if (d.referencia) {
      const tk = await emTransacao(
        (cliente) =>
          obterOuCriarLink(cliente, d.referencia!.tipo, d.referencia!.id, req.usuario.id),
        ator(req),
      );
      pdf = await gerarPdfDocumento(
        d.referencia.tipo,
        d.referencia.id,
        doc?.valores.numero ?? '',
        tk,
      );
    }

    const resultado = await comRegistroDeErro(async () =>
      emTransacao(async (cliente) => {
        let texto = d.texto ?? '';
        if (d.modelo_id) {
          const { rows } = await cliente.query<{ texto: string }>(
            `SELECT texto FROM "SolarCosta_WhatsAppModelos" WHERE id = $1 AND ativo`,
            [d.modelo_id],
          );
          if (rows.length === 0) throw naoEncontrado('Modelo de mensagem');
          texto = rows[0]!.texto;
        }

        // `link` não entra mais: o documento vai como ANEXO, e o marcador
        // {{link}} — que sobrou em modelos antigos — cai na regra do
        // interpolar() e some, em vez de deixar uma URL quebrada na mensagem.
        texto = interpolar(texto, {
          ...(doc?.valores ?? {}),
          consultor: req.usuario.nome,
        }).trim();

        const gravada = await enviarERegistrar(cliente, {
          token,
          telefone,
          texto,
          leadId,
          autor: { id: req.usuario.id, nome: req.usuario.nome },
          referenciaTipo: d.referencia?.tipo ?? null,
          referenciaId: d.referencia?.id ?? null,
          descricaoAuditoria: d.referencia
            ? `${d.referencia.tipo} ${doc?.valores.numero ?? ''}`.trim()
            : null,
          documentoBase64: pdf ? pdf.bytes.toString('base64') : null,
          documentoNome: pdf ? pdf.nomeArquivo : null,
        });

        // A timeline do lead é onde o vendedor olha antes de ligar. Sem esta
        // linha o WhatsApp viraria um histórico paralelo — que é exatamente o
        // problema que o CRM veio resolver.
        //
        // Envio de DOCUMENTO é marco e entra sempre, sem a janela de 12 h que
        // segura a conversa miúda: uma proposta enviada tem de aparecer na
        // timeline mesmo que o vendedor tenha trocado mensagens dez minutos
        // antes.
        if (leadId) {
          if (d.referencia) {
            await cliente.query(
              `INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_id, usuario_nome)
               VALUES ($1, $2, 'whatsapp', $3, $4)`,
              [
                leadId,
                `${d.referencia.tipo === 'proposta' ? 'Proposta' : 'Contrato'} ${doc?.valores.numero ?? ''} enviado por WhatsApp.`.replace(
                  /\s+/g,
                  ' ',
                ),
                req.usuario.id,
                req.usuario.nome,
              ],
            );
          } else {
            await registrarNaTimeline(
              cliente,
              leadId,
              `Conversa no WhatsApp: ${texto.slice(0, 120)}`,
              { id: req.usuario.id, nome: req.usuario.nome },
            );
          }
        }

        return { conversaId: gravada.conversaId, texto };
      }, ator(req)),
    );

    res.status(201).json({
      conversa_id: resultado.conversaId,
      texto: resultado.texto,
      // Nome e tamanho do anexo, para a tela poder dizer o que saiu. Os bytes
      // não voltam: o cliente já os recebeu, e devolvê-los só engordaria a
      // resposta em um terço a mais (base64) sem ninguém usar.
      documento: pdf
        ? { nome: pdf.nomeArquivo, tamanho_bytes: pdf.bytes.length }
        : null,
    });
  }),
);

/* ========================================================== HISTÓRICO == */

/*
 * O que saiu, na ordem em que saiu.
 *
 * Não há tabela de "fila de notificações" e não precisa haver: toda mensagem
 * enviada já grava uma linha em SolarCosta_WhatsAppMensagens com de_mim = true,
 * o status traduzido da uazapi, o erro quando falhou, quem clicou em enviar e
 * qual documento aquele envio entregou. Esta rota só lê isso de lado, sem
 * passar pela conversa — o vendedor quer ver "o que eu mandei hoje", não abrir
 * dez threads para descobrir.
 *
 * As recebidas ficam de fora (`m.de_mim`): elas têm a caixa de entrada.
 */

const STATUS_MENSAGEM = ['fila', 'enviada', 'entregue', 'lida', 'falhou', 'cancelada'] as const;

const enviadasSchema = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
  /** Cursor de timestamp, igual ao de /conversas: pega o que for mais antigo. */
  antes_de: z.string().datetime({ offset: true }).optional(),
  status: z.enum(STATUS_MENSAGEM).optional(),
  referencia_tipo: z.enum(['proposta', 'contrato']).optional(),
});

interface LinhaEnviada {
  id: string;
  ocorrido_em: string;
  texto: string | null;
  status: string;
  erro: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  referencia_numero: string | null;
  conversa_id: string;
  telefone: string | null;
  nome_exibicao: string | null;
  lead_id: string | null;
  lead_numero: string | null;
  lead_nome: string | null;
  enviada_por_nome: string | null;
}

whatsappRouter.get(
  '/enviadas',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req, res) => {
    const f = enviadasSchema.parse(req.query);

    const params: unknown[] = [];
    const condicoes = ['m.de_mim'];

    if (f.antes_de) {
      params.push(f.antes_de);
      condicoes.push(`m.ocorrido_em < $${params.length}`);
    }
    if (f.status) {
      params.push(f.status);
      condicoes.push(`m.status = $${params.length}`);
    }
    if (f.referencia_tipo) {
      params.push(f.referencia_tipo);
      condicoes.push(`m.referencia_tipo = $${params.length}`);
    }

    // Uma a mais do que o pedido, só para saber se existe próxima página sem
    // pagar um COUNT(*) na tabela inteira a cada abertura da aba.
    params.push(f.limite + 1);

    const linhas = await consultar<LinhaEnviada>(
      // Lista fechada de colunas, nunca SELECT *: a regra do V009 sobre o bytea
      // de SolarCosta_WhatsAppMidia vale em qualquer consulta que um dia possa
      // ganhar um JOIN com ela.
      //
      // Os dois LEFT JOIN de documento são condicionados pelo referencia_tipo
      // porque referencia_id aponta para duas tabelas diferentes e não tem FK.
      // O COALESCE devolve o número de qualquer um dos dois.
      `SELECT m.id, m.ocorrido_em, m.texto, m.status, m.erro,
              m.referencia_tipo, m.referencia_id,
              COALESCE(p.numero, ct.numero) AS referencia_numero,
              c.id AS conversa_id, c.telefone, c.nome_exibicao,
              l.id AS lead_id, l.numero AS lead_numero, l.nome AS lead_nome,
              u.nome AS enviada_por_nome
         FROM "SolarCosta_WhatsAppMensagens" m
         JOIN "SolarCosta_WhatsAppConversas" c ON c.id = m.conversa_id
         LEFT JOIN "SolarCosta_Leads" l
                ON l.id = c.lead_id AND l.excluido_em IS NULL
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = m.enviada_por_id
         LEFT JOIN "SolarCosta_Propostas" p
                ON m.referencia_tipo = 'proposta' AND p.id = m.referencia_id
         LEFT JOIN "SolarCosta_Contratos" ct
                ON m.referencia_tipo = 'contrato' AND ct.id = m.referencia_id
        WHERE ${condicoes.join(' AND ')}
        ORDER BY m.ocorrido_em DESC
        LIMIT $${params.length}`,
      params,
    );

    const temMais = linhas.length > f.limite;
    const pagina = temMais ? linhas.slice(0, f.limite) : linhas;

    res.json({
      enviadas: pagina.map((m) => ({
        id: m.id,
        ocorrido_em: m.ocorrido_em,
        texto: m.texto,
        status: m.status,
        erro: m.erro,
        referencia_tipo: m.referencia_tipo,
        referencia_id: m.referencia_id,
        referencia_numero: m.referencia_numero,
        conversa_id: m.conversa_id,
        telefone: m.telefone,
        nome_exibicao: m.nome_exibicao,
        lead: m.lead_id ? { id: m.lead_id, numero: m.lead_numero, nome: m.lead_nome } : null,
        enviada_por_nome: m.enviada_por_nome,
      })),
      proximo_cursor: temMais ? (pagina[pagina.length - 1]?.ocorrido_em ?? null) : null,
    });
  }),
);
