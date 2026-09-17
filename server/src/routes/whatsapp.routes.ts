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
import { obterOuCriarLink, urlPublica } from '../services/linksPublicos.js';
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

whatsappRouter.get(
  '/modelos',
  exigirPermissao('usar_whatsapp'),
  asyncHandler(async (req, res) => {
    const { contexto } = z
      .object({ contexto: z.enum(['proposta', 'contrato', 'lead', 'livre']).optional() })
      .parse(req.query);

    const params: unknown[] = [];
    let filtro = '';
    if (contexto) {
      params.push(contexto);
      filtro = `AND contexto = $${params.length}`;
    }

    const modelos = await consultar(
      `SELECT id, nome, contexto, texto, ordem
         FROM "SolarCosta_WhatsAppModelos"
        WHERE ativo ${filtro}
        ORDER BY contexto, ordem, nome`,
      params,
    );

    res.json({ modelos });
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

    // Tudo o que escreve acontece numa transação só: se o INSERT da mensagem
    // falhar, o link recém-criado não fica órfão na tabela.
    const resultado = await comRegistroDeErro(async () =>
      emTransacao(async (cliente) => {
        let link = '';
        if (d.referencia) {
          const tk = await obterOuCriarLink(
            cliente,
            d.referencia.tipo,
            d.referencia.id,
            req.usuario.id,
          );
          link = urlPublica(tk);
        }

        let texto = d.texto ?? '';
        if (d.modelo_id) {
          const { rows } = await cliente.query<{ texto: string }>(
            `SELECT texto FROM "SolarCosta_WhatsAppModelos" WHERE id = $1 AND ativo`,
            [d.modelo_id],
          );
          if (rows.length === 0) throw naoEncontrado('Modelo de mensagem');
          texto = rows[0]!.texto;
        }

        texto = interpolar(texto, {
          ...(doc?.valores ?? {}),
          link,
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

        return { conversaId: gravada.conversaId, link, texto };
      }, ator(req)),
    );

    res.status(201).json({
      conversa_id: resultado.conversaId,
      link: resultado.link || null,
      texto: resultado.texto,
    });
  }),
);


