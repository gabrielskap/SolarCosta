// Dashboard, relatórios, notificações, configuração e auditoria.
//
// Tudo aqui é leitura de view: os cálculos que o DashboardView e o ReportsView
// faziam em memória sobre os arrays mockados agora rodam em SQL.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

/* ============================================================ DASHBOARD == */

export const dashboardRouter = Router();
dashboardRouter.use(exigirLogin);

dashboardRouter.get(
  '/',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const [kpis, funil, faturamento, desempenho, estoque] = await Promise.all([
      consultarUm(`SELECT * FROM "SolarCosta_vw_DashboardKPIs"`),
      consultar(`SELECT * FROM "SolarCosta_vw_FunilLeads"`),
      consultar(`SELECT * FROM "SolarCosta_vw_FaturamentoMensal"`),
      consultar(`SELECT * FROM "SolarCosta_vw_DesempenhoVendedor"`),
      consultar(`SELECT id, codigo, nome, estoque, unidade, situacao_estoque
                   FROM "SolarCosta_vw_EstoqueCritico" LIMIT 10`),
    ]);

    // Quem não vê financeiro não recebe os números de caixa.
    if (!req.usuario.permissoes.ver_lancamentos_financeiro && kpis) {
      delete (kpis as Record<string, unknown>).faturamento_ano;
      delete (kpis as Record<string, unknown>).faturamento_mes;
      delete (kpis as Record<string, unknown>).a_receber;
      delete (kpis as Record<string, unknown>).a_pagar;
    }

    res.json({ kpis, funil, faturamento, desempenho, estoque_critico: estoque });
  }),
);

dashboardRouter.get(
  '/funil',
  asyncHandler(async (_req, res) => {
    res.json({ funil: await consultar(`SELECT * FROM "SolarCosta_vw_FunilLeads"`) });
  }),
);

dashboardRouter.get(
  '/faturamento',
  exigirPermissao('ver_lancamentos_financeiro'),
  asyncHandler(async (_req, res) => {
    res.json({ faturamento: await consultar(`SELECT * FROM "SolarCosta_vw_FaturamentoMensal"`) });
  }),
);

dashboardRouter.get(
  '/desempenho',
  asyncHandler(async (_req, res) => {
    res.json({ desempenho: await consultar(`SELECT * FROM "SolarCosta_vw_DesempenhoVendedor"`) });
  }),
);

/* ======================================================== NOTIFICAÇÕES == */

export const notificacoesRouter = Router();
notificacoesRouter.use(exigirLogin);

notificacoesRouter.get(
  '/',
  asyncHandler(async (req: RequestAutenticado, res) => {
    // A notificação é derivada (view); só o "já li" é persistido.
    const notificacoes = await consultar(
      `SELECT n.*, (l.lida_em IS NOT NULL) AS lida
         FROM "SolarCosta_vw_Notificacoes" n
         LEFT JOIN "SolarCosta_NotificacoesLidas" l
                ON l.notificacao_chave = n.chave AND l.usuario_id = $1
        ORDER BY n.peso, n.referencia`,
      [req.usuario.id],
    );

    const contagem = { total: 0, boleto_vencido: 0, lead_sem_contato: 0, visita_hoje: 0 };
    for (const n of notificacoes) {
      const categoria = String((n as Record<string, unknown>).categoria);
      if (categoria === 'boleto_vencido' || categoria === 'lead_sem_contato' || categoria === 'visita_hoje') {
        contagem[categoria] += 1;
      }
      contagem.total += 1;
    }

    res.json({ notificacoes, contagem });
  }),
);

notificacoesRouter.post(
  '/:chave/lida',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const chave = z.string().min(1).max(120).parse(req.params.chave);

    await emTransacao(async (cliente) => {
      await cliente.query(
        `INSERT INTO "SolarCosta_NotificacoesLidas" (usuario_id, notificacao_chave)
         VALUES ($1,$2) ON CONFLICT (usuario_id, notificacao_chave) DO NOTHING`,
        [req.usuario.id, chave],
      );
    });

    res.status(204).end();
  }),
);

/* ======================================================== CONFIGURAÇÃO == */

export const configRouter = Router();
configRouter.use(exigirLogin);

// Leitura liberada: o front precisa dos domínios para montar os selects.
configRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [empresa, parametros, concessionarias, origens, telhados, categorias, pastas, bancos, presets] =
      await Promise.all([
        consultarUm(`SELECT * FROM "SolarCosta_Empresa" LIMIT 1`),
        consultar(`SELECT chave, valor, tipo, grupo, descricao FROM "SolarCosta_Parametros" ORDER BY grupo, chave`),
        consultar(`SELECT id, nome, uf, tarifa_kwh, custo_disponibilidade, hsp_media
                     FROM "SolarCosta_Concessionarias" WHERE ativo ORDER BY ordem, nome`),
        consultar(`SELECT id, nome FROM "SolarCosta_OrigensLead" WHERE ativo ORDER BY ordem`),
        consultar(`SELECT id, nome, fator_area FROM "SolarCosta_TiposTelhado" WHERE ativo ORDER BY ordem`),
        consultar(`SELECT id, nome, escopo, cor FROM "SolarCosta_CategoriasFinanceiras" WHERE ativo ORDER BY ordem`),
        consultar(`SELECT id, nome FROM "SolarCosta_PastasDocumento" WHERE ativo ORDER BY ordem`),
        consultar(`SELECT id, nome, juros_mes_padrao, parcelas_max, entrada_min_pct
                     FROM "SolarCosta_BancosFinanciamento" WHERE ativo ORDER BY nome`),
        consultar(`SELECT id, contexto, label, texto FROM "SolarCosta_ObservacaoPresets"
                    WHERE ativo ORDER BY ordem`),
      ]);

    res.json({
      empresa, parametros, concessionarias, origens, telhados,
      categorias, pastas, bancos, presets,
    });
  }),
);

// Perfil de geração mensal usado no PDF da proposta.
configRouter.get(
  '/geracao-mensal/:concessionariaId',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.concessionariaId);
    const perfil = await consultar(
      `SELECT mes, fator FROM "SolarCosta_PerfilGeracaoMensal"
        WHERE concessionaria_id = $1 ORDER BY mes`,
      [id],
    );
    res.json({ perfil });
  }),
);

configRouter.patch(
  '/empresa',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = z
      .object({
        razao_social: z.string().min(1).max(200).optional(),
        nome_fantasia: z.string().min(1).max(200).optional(),
        cnpj: z.string().max(20).optional(),
        inscricao_estadual: z.string().max(40).nullish(),
        endereco: z.string().max(300).optional(),
        bairro: z.string().max(120).nullish(),
        cidade: z.string().max(120).optional(),
        uf: z.string().length(2).optional(),
        cep: z.string().max(12).nullish(),
        telefone: z.string().max(30).nullish(),
        whatsapp: z.string().max(30).nullish(),
        email: z.string().email('E-mail inválido.').nullish(),
        site: z.string().max(200).nullish(),
        logo_url: z.string().nullish(),
        responsavel_tecnico: z.string().max(200).nullish(),
        crea: z.string().max(40).nullish(),
        foro_padrao: z.string().max(120).nullish(),
      })
      .parse(req.body);

    const empresa = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Empresa" SET
            razao_social        = COALESCE($1, razao_social),
            nome_fantasia       = COALESCE($2, nome_fantasia),
            cnpj                = COALESCE($3, cnpj),
            inscricao_estadual  = COALESCE($4, inscricao_estadual),
            endereco            = COALESCE($5, endereco),
            bairro              = COALESCE($6, bairro),
            cidade              = COALESCE($7, cidade),
            uf                  = COALESCE($8, uf),
            cep                 = COALESCE($9, cep),
            telefone            = COALESCE($10, telefone),
            whatsapp            = COALESCE($11, whatsapp),
            email               = COALESCE($12::citext, email),
            site                = COALESCE($13, site),
            logo_url            = COALESCE($14, logo_url),
            responsavel_tecnico = COALESCE($15, responsavel_tecnico),
            crea                = COALESCE($16, crea),
            foro_padrao         = COALESCE($17, foro_padrao)
          WHERE registro_unico
          RETURNING *`,
        [
          d.razao_social ?? null, d.nome_fantasia ?? null, d.cnpj ?? null,
          d.inscricao_estadual ?? null, d.endereco ?? null, d.bairro ?? null,
          d.cidade ?? null, d.uf ?? null, d.cep ?? null, d.telefone ?? null,
          d.whatsapp ?? null, d.email ?? null, d.site ?? null, d.logo_url ?? null,
          d.responsavel_tecnico ?? null, d.crea ?? null, d.foro_padrao ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Cadastro da empresa');
      return rows[0];
    }, ator(req));

    res.json({ empresa });
  }),
);

configRouter.patch(
  '/parametros',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const alteracoes = z
      .array(z.object({ chave: z.string().min(1), valor: z.string() }))
      .min(1, 'Envie ao menos um parâmetro.')
      .parse(req.body?.parametros);

    const parametros = await emTransacao(async (cliente) => {
      for (const p of alteracoes) {
        const { rowCount } = await cliente.query(
          `UPDATE "SolarCosta_Parametros"
              SET valor = $2, atualizado_em = now(), atualizado_por = "SolarCosta_fn_usuario_atual"()
            WHERE chave = $1`,
          [p.chave, p.valor],
        );
        if (rowCount === 0) throw naoEncontrado(`Parâmetro "${p.chave}"`);
      }

      const { rows } = await cliente.query(
        `SELECT chave, valor, tipo, grupo, descricao FROM "SolarCosta_Parametros" ORDER BY grupo, chave`);
      return rows;
    }, ator(req));

    res.json({ parametros });
  }),
);

/* =========================================================== AUDITORIA == */

export const auditoriaRouter = Router();
auditoriaRouter.use(exigirLogin, exigirPermissao('ver_auditoria'));

auditoriaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        acao: z.enum(['criar', 'editar', 'excluir', 'mudanca_etapa', 'baixa', 'login', 'logout', 'exportar']).optional(),
        entidade: z.string().optional(),
        usuario_id: z.string().uuid().optional(),
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        tamanho: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);

    const cond: string[] = [];
    const params: unknown[] = [];
    if (f.acao) { params.push(f.acao); cond.push(`acao = $${params.length}`); }
    if (f.entidade) { params.push(f.entidade); cond.push(`entidade = $${params.length}`); }
    if (f.usuario_id) { params.push(f.usuario_id); cond.push(`usuario_id = $${params.length}`); }
    if (f.de) { params.push(f.de); cond.push(`ocorrido_em >= $${params.length}::date`); }
    if (f.ate) { params.push(f.ate); cond.push(`ocorrido_em < ($${params.length}::date + 1)`); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const total = await consultarUm<{ total: number }>(
      `SELECT count(*)::int AS total FROM "SolarCosta_vw_Auditoria" ${where}`, params);

    params.push(f.tamanho, (f.pagina - 1) * f.tamanho);
    const registros = await consultar(
      `SELECT * FROM "SolarCosta_vw_Auditoria" ${where}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ registros, total: total?.total ?? 0, pagina: f.pagina, tamanho: f.tamanho });
  }),
);
