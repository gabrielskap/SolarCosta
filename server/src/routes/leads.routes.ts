// Rotas de leads — o caminho crítico do CRM.
//
// Substitui StorageService.getLeads/saveLead/updateLeadStage.
// Repare no que NÃO está aqui: gerar número do lead, registrar histórico de
// cadastro e auditar mudança de etapa. Isso tudo é trigger no banco, então
// vale mesmo para quem escrever direto pelo DBeaver.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const leadsRouter = Router();
leadsRouter.use(exigirLogin);

const ETAPAS = [
  'Novo lead',
  'Contato feito',
  'Visita técnica',
  'Proposta enviada',
  'Negociação',
  'Fechado',
] as const;

// Aceita tanto o id da tabela de apoio quanto o nome — o front hoje trabalha
// com nomes ("CEMIG", "Laje", "Rafael Moura"), então os dois caminhos servem
// durante a migração das telas.
const leadBase = z.object({
  nome: z.string().min(1, 'Informe o nome.').max(200),
  cpf_cnpj: z.string().max(20).nullish(),
  rg_inscricao: z.string().max(40).nullish(),
  telefone: z.string().max(30).nullish(),
  email: z.string().email('E-mail inválido.').nullish().or(z.literal('')),
  cep: z.string().max(12).nullish(),
  endereco: z.string().max(300).nullish(),
  bairro: z.string().max(120).nullish(),
  cidade: z.string().max(120).nullish(),
  uf: z.string().length(2).nullish(),
  consumo_kwh: z.coerce.number().min(0).default(0),
  valor_estimado: z.coerce.number().min(0).default(0),
  observacoes: z.string().nullish(),

  concessionaria_id: z.coerce.number().int().nullish(),
  concessionaria: z.string().nullish(),
  tipo_telhado_id: z.coerce.number().int().nullish(),
  telhado: z.string().nullish(),
  origem_id: z.coerce.number().int().nullish(),
  origem: z.string().nullish(),
  responsavel_id: z.string().uuid().nullish(),
  responsavel: z.string().nullish(),

  etapa: z.enum(ETAPAS).default('Novo lead'),
});

const filtrosSchema = z.object({
  etapa: z.enum(ETAPAS).optional(),
  responsavel_id: z.string().uuid().optional(),
  origem_id: z.coerce.number().int().optional(),
  busca: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(200).default(100),
});

// ---------------------------------------------------------------- LISTAGEM ---
leadsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = filtrosSchema.parse(req.query);

    const condicoes: string[] = [];
    const params: unknown[] = [];

    if (f.etapa) {
      params.push(f.etapa);
      condicoes.push(`etapa = $${params.length}`);
    }
    if (f.responsavel_id) {
      params.push(f.responsavel_id);
      condicoes.push(`responsavel_id = $${params.length}`);
    }
    if (f.origem_id) {
      params.push(f.origem_id);
      condicoes.push(`origem = (SELECT nome FROM "SolarCosta_OrigensLead" WHERE id = $${params.length})`);
    }
    if (f.busca) {
      // Usa o índice trigram sem acento de SolarCosta_ix_Leads_nome_trgm.
      params.push(f.busca);
      condicoes.push(
        `("SolarCosta_fn_sem_acento"(nome) LIKE '%' || "SolarCosta_fn_sem_acento"($${params.length}) || '%'
          OR cpf_cnpj ILIKE '%' || $${params.length} || '%'
          OR numero    ILIKE '%' || $${params.length} || '%')`,
      );
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    params.push(f.tamanho, (f.pagina - 1) * f.tamanho);
    const linhas = await consultar(
      `SELECT * FROM "SolarCosta_vw_Leads"
       ${where}
       ORDER BY criado_em DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = await consultarUm<{ total: number }>(
      `SELECT count(*)::int AS total FROM "SolarCosta_vw_Leads" ${where}`,
      params.slice(0, params.length - 2),
    );

    res.json({ leads: linhas, total: total?.total ?? 0, pagina: f.pagina, tamanho: f.tamanho });
  }),
);

// ------------------------------------------------------------------ DETALHE ---
leadsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    const lead = await consultarUm(`SELECT * FROM "SolarCosta_vw_Leads" WHERE id = $1`, [id]);
    if (!lead) throw naoEncontrado('Lead');

    const [documentos, historico, propostas, contratos] = await Promise.all([
      consultar(
        `SELECT d.id, d.nome_arquivo, d.mime_type, d.tamanho_bytes, d.storage_path,
                d.enviado_em, p.nome AS pasta, u.nome AS enviado_por
           FROM "SolarCosta_LeadDocumentos" d
           LEFT JOIN "SolarCosta_PastasDocumento" p ON p.id = d.pasta_id
           LEFT JOIN "SolarCosta_Usuarios" u        ON u.id = d.enviado_por_id
          WHERE d.lead_id = $1 AND d.excluido_em IS NULL
          ORDER BY d.enviado_em DESC`,
        [id],
      ),
      consultar(
        `SELECT id, descricao, tipo, usuario_nome, ocorrido_em
           FROM "SolarCosta_LeadHistorico"
          WHERE lead_id = $1
          ORDER BY ocorrido_em DESC`,
        [id],
      ),
      consultar(
        `SELECT id, numero, status::text AS status, valor_total, potencia_kwp, criado_em
           FROM "SolarCosta_Propostas"
          WHERE lead_id = $1 AND excluido_em IS NULL
          ORDER BY criado_em DESC`,
        [id],
      ),
      consultar(
        `SELECT id, numero, status::text AS status, valor_total, data_emissao
           FROM "SolarCosta_Contratos"
          WHERE lead_id = $1 AND excluido_em IS NULL
          ORDER BY data_emissao DESC`,
        [id],
      ),
    ]);

    res.json({ lead, documentos, historico, propostas, contratos });
  }),
);

// ------------------------------------------------------------------- CRIAR ---
leadsRouter.post(
  '/',
  exigirPermissao('criar_editar_leads'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const dados = leadBase.parse(req.body);

    const lead = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Leads" (
            nome, cpf_cnpj, rg_inscricao, telefone, email, cep, endereco, bairro, cidade, uf,
            consumo_kwh, valor_estimado, observacoes, etapa,
            concessionaria_id, tipo_telhado_id, origem_id, responsavel_id
         ) VALUES (
            $1, $2, $3, $4, NULLIF($5,'')::citext, $6, $7, $8, $9, $10,
            $11, $12, $13, $14,
            COALESCE($15::int, (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $16)),
            COALESCE($17::int, (SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = $18)),
            COALESCE($19::int, (SELECT id FROM "SolarCosta_OrigensLead"     WHERE nome = $20)),
            COALESCE($21::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $22 AND excluido_em IS NULL))
         )
         RETURNING id`,
        [
          dados.nome, dados.cpf_cnpj ?? null, dados.rg_inscricao ?? null, dados.telefone ?? null,
          dados.email ?? null, dados.cep ?? null, dados.endereco ?? null, dados.bairro ?? null,
          dados.cidade ?? null, dados.uf ?? null, dados.consumo_kwh, dados.valor_estimado,
          dados.observacoes ?? null, dados.etapa,
          dados.concessionaria_id ?? null, dados.concessionaria ?? null,
          dados.tipo_telhado_id ?? null, dados.telhado ?? null,
          dados.origem_id ?? null, dados.origem ?? null,
          dados.responsavel_id ?? null, dados.responsavel ?? null,
        ],
      );

      const novoId = rows[0]!.id as string;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Lead', $1, $2, NULL)`,
        [dados.nome, novoId],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Leads" WHERE id = $1`,
        [novoId],
      );
      return view[0];
    }, ator(req));

    res.status(201).json({ lead });
  }),
);

// ------------------------------------------------------------------ EDITAR ---
leadsRouter.patch(
  '/:id',
  exigirPermissao('criar_editar_leads'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const dados = leadBase.partial().parse(req.body);

    const lead = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Leads" SET
            nome           = COALESCE($2, nome),
            cpf_cnpj       = COALESCE($3, cpf_cnpj),
            rg_inscricao   = COALESCE($4, rg_inscricao),
            telefone       = COALESCE($5, telefone),
            email          = COALESCE(NULLIF($6,'')::citext, email),
            cep            = COALESCE($7, cep),
            endereco       = COALESCE($8, endereco),
            bairro         = COALESCE($9, bairro),
            cidade         = COALESCE($10, cidade),
            uf             = COALESCE($11, uf),
            consumo_kwh    = COALESCE($12, consumo_kwh),
            valor_estimado = COALESCE($13, valor_estimado),
            observacoes    = COALESCE($14, observacoes),
            concessionaria_id = COALESCE($15::int,  (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $16), concessionaria_id),
            tipo_telhado_id   = COALESCE($17::int,  (SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = $18), tipo_telhado_id),
            origem_id         = COALESCE($19::int,  (SELECT id FROM "SolarCosta_OrigensLead"     WHERE nome = $20), origem_id),
            responsavel_id    = COALESCE($21::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $22 AND excluido_em IS NULL), responsavel_id)
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING id, nome`,
        [
          id, dados.nome ?? null, dados.cpf_cnpj ?? null, dados.rg_inscricao ?? null,
          dados.telefone ?? null, dados.email ?? null, dados.cep ?? null, dados.endereco ?? null,
          dados.bairro ?? null, dados.cidade ?? null, dados.uf ?? null,
          dados.consumo_kwh ?? null, dados.valor_estimado ?? null, dados.observacoes ?? null,
          dados.concessionaria_id ?? null, dados.concessionaria ?? null,
          dados.tipo_telhado_id ?? null, dados.telhado ?? null,
          dados.origem_id ?? null, dados.origem ?? null,
          dados.responsavel_id ?? null, dados.responsavel ?? null,
        ],
      );

      if (rows.length === 0) throw naoEncontrado('Lead');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Lead', $1, $2, NULL)`,
        [rows[0]!.nome, id],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Leads" WHERE id = $1`,
        [id],
      );
      return view[0];
    }, ator(req));

    res.json({ lead });
  }),
);

// ------------------------------------------------------------------- ETAPA ---
// O trigger SolarCosta_tg_lead_mudanca_etapa cuida de histórico e auditoria.
leadsRouter.patch(
  '/:id/etapa',
  exigirPermissao('criar_editar_leads'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { etapa } = z.object({ etapa: z.enum(ETAPAS) }).parse(req.body);

    const lead = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Leads" SET etapa = $2
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING id`,
        [id, etapa],
      );
      if (rows.length === 0) throw naoEncontrado('Lead');

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Leads" WHERE id = $1`,
        [id],
      );
      return view[0];
    }, ator(req));

    res.json({ lead });
  }),
);

// --------------------------------------------------------------- HISTÓRICO ---
leadsRouter.post(
  '/:id/historico',
  exigirPermissao('criar_editar_leads'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { descricao, tipo } = z
      .object({
        descricao: z.string().min(1, 'Descreva a interação.'),
        tipo: z.enum(['nota', 'ligacao', 'whatsapp', 'email', 'visita', 'sistema']).default('nota'),
      })
      .parse(req.body);

    const registro = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_id, usuario_nome)
         SELECT $1, $2, $3, "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"()
          WHERE EXISTS (SELECT 1 FROM "SolarCosta_Leads" WHERE id = $1 AND excluido_em IS NULL)
         RETURNING id, descricao, tipo, usuario_nome, ocorrido_em`,
        [id, descricao, tipo],
      );
      if (rows.length === 0) throw naoEncontrado('Lead');
      return rows[0];
    }, ator(req));

    res.status(201).json({ registro });
  }),
);

// ------------------------------------------------------------------ EXCLUIR ---
leadsRouter.delete(
  '/:id',
  exigirPermissao('criar_editar_leads'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Leads" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING nome`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Lead');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Lead', $1, $2, NULL)`,
        [rows[0]!.nome, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);
