// Rotas abertas, consumidas pelo site institucional (src/site).
//
// É o ÚNICO router sem `exigirLogin`. Duas consequências que guiam tudo aqui:
//
//   1. Toda resposta é montada por whitelist explícita de colunas. O
//      /api/config autenticado devolve margem, taxa de cartão, juros e
//      cláusulas contratuais — nada disso pode vazar para a internet, e um
//      `SELECT *` faria exatamente isso no dia em que alguém criar a coluna.
//
//   2. Toda escrita tem rate limit, honeypot e schema estreito. O corpo do
//      POST vem de um formulário público: assumir que é hostil é o padrão.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler } from '../errors.js';

export const publicoRouter = Router();

/** Origem cadastrada em SolarCosta_OrigensLead (seed S001). */
const ORIGEM_SITE = 'Site Solar Costa';

/** Parâmetros de dimensionamento que o simulador do site pode conhecer. */
const PARAMETROS_PUBLICOS = [
  'proposta.tarifa_kwh_padrao',
  'proposta.hsp_padrao',
  'proposta.perdas_pct_padrao',
  'proposta.modulo_wp_padrao',
] as const;

// --------------------------------------------------------------- CONFIG ---
// Dados institucionais + insumos do simulador. Leitura pura, sem sessão.
publicoRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const [empresa, concessionarias, parametros] = await Promise.all([
      consultarUm(
        `SELECT razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, uf, cep,
                telefone, whatsapp, email::text AS email, responsavel_tecnico, crea
           FROM "SolarCosta_Empresa" LIMIT 1`,
      ),
      consultar(
        `SELECT nome, uf, tarifa_kwh, custo_disponibilidade, hsp_media
           FROM "SolarCosta_Concessionarias"
          WHERE ativo ORDER BY ordem, nome`,
      ),
      consultar<{ chave: string; valor: string }>(
        `SELECT chave, valor FROM "SolarCosta_Parametros"
          WHERE chave = ANY($1::text[])`,
        [PARAMETROS_PUBLICOS],
      ),
    ]);

    // O parâmetro é texto no banco; o simulador quer número.
    const numericos: Record<string, number> = {};
    for (const p of parametros) {
      const n = Number(p.valor);
      if (Number.isFinite(n)) numericos[p.chave] = n;
    }

    res.json({ empresa, concessionarias, parametros: numericos });
  }),
);

// ---------------------------------------------------------------- LEADS ---

// Formulário público: 5 envios por IP a cada 15 minutos. `trust proxy` já está
// ligado no app.ts, então o IP contado é o do visitante, não o do Nginx.
const limiteFormulario = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    erro: 'Recebemos vários envios deste dispositivo. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.',
    codigo: 'excesso_envios',
  },
});

/**
 * Schema deliberadamente estreito. Sem `etapa`, `origem`, `responsavel_id` ou
 * `valor_estimado`: aceitá-los deixaria um visitante criar lead já em
 * "Fechado", atribuído a um vendedor, com valor inventado.
 */
const leadDoSite = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(200),
  telefone: z.string().trim().min(8, 'Informe um telefone com DDD.').max(30),
  email: z.string().trim().email('E-mail inválido.').max(200).optional().or(z.literal('')),
  cidade: z.string().trim().max(120).optional().or(z.literal('')),
  consumo_kwh: z.coerce.number().min(0).max(1_000_000).default(0),
  mensagem: z.string().trim().max(2000).optional().or(z.literal('')),
  /** Honeypot: campo escondido no formulário. Humano nunca preenche. */
  website: z.string().max(200).optional(),
});

/** Monta a observação que o consultor lê no CRM. */
function montarObservacoes(d: z.infer<typeof leadDoSite>): string {
  const linhas = ['Lead recebido pelo formulário do site.'];
  if (d.consumo_kwh > 0) linhas.push(`Consumo informado no simulador: ${d.consumo_kwh} kWh/mês.`);
  if (d.mensagem) linhas.push('', `Mensagem: ${d.mensagem}`);
  return linhas.join('\n');
}

publicoRouter.post(
  '/leads',
  limiteFormulario,
  asyncHandler(async (req, res) => {
    const dados = leadDoSite.parse(req.body);

    // Honeypot preenchido: responde como se tivesse gravado. O bot não
    // aprende que foi barrado e não volta variando o payload.
    if (dados.website) {
      res.status(201).json({ ok: true });
      return;
    }

    const telefoneDigitos = dados.telefone.replace(/\D+/g, '');
    const email = dados.email || null;

    // Sem `ator`: a trilha registra "Sistema", que é a verdade — não houve
    // usuário logado. SolarCosta_Auditoria.usuario_id é nullable e
    // SolarCosta_fn_usuario_atual_nome() já cai em 'Sistema'.
    await emTransacao(async (cliente) => {
      // Mesma pessoa insistindo no formulário não vira lead duplicado: anexa
      // à timeline do cadastro que já existe e o consultor vê o reforço.
      const { rows: existentes } = await cliente.query(
        `SELECT id FROM "SolarCosta_Leads"
          WHERE excluido_em IS NULL
            AND criado_em > now() - interval '24 hours'
            AND ( ($1 <> '' AND regexp_replace(COALESCE(telefone,''), '\D', '', 'g') = $1)
               OR ($2::citext IS NOT NULL AND email = $2::citext) )
          ORDER BY criado_em DESC
          LIMIT 1`,
        [telefoneDigitos, email],
      );

      if (existentes.length > 0) {
        await cliente.query(
          `INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_nome)
           VALUES ($1, $2, 'sistema', 'Site')`,
          [existentes[0]!.id, `Novo contato pelo site. ${montarObservacoes(dados)}`],
        );
        return;
      }

      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Leads" (
            nome, telefone, email, cidade, consumo_kwh, observacoes, etapa, origem_id
         ) VALUES (
            $1, $2, NULLIF($3,'')::citext, NULLIF($4,''), $5, $6, 'Novo lead',
            (SELECT id FROM "SolarCosta_OrigensLead" WHERE nome = $7)
         )
         RETURNING id`,
        [
          dados.nome,
          dados.telefone,
          email ?? '',
          dados.cidade ?? '',
          dados.consumo_kwh,
          montarObservacoes(dados),
          ORIGEM_SITE,
        ],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Lead', $1, $2, 'Cadastro automático pelo site')`,
        [dados.nome, rows[0]!.id],
      );
    });

    // Resposta mínima de propósito: devolver id ou número do lead entregaria
    // identificador interno e o volume de cadastros a quem sondar o endpoint.
    res.status(201).json({ ok: true });
  }),
);
