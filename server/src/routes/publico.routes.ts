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

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler } from '../errors.js';
import { abrirLink, lerLink } from '../services/linksPublicos.js';
import { imagemSatelite } from '../services/googleSolar.js';
import { ehRenderInterno } from '../services/renderInterno.js';

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

// ----------------------------------------------------------------- SITE ---
// Conteúdo editorial do site (SolarCosta_SitePaginas / _SiteBlocos / _SiteMenus).
//
// Mesma regra do /config acima: whitelist explícita de colunas. Aqui ela
// também filtra o que está NO AR — `publicada` e `visivel` — para que um bloco
// desligado na tela não continue visível para quem ler a API direto.
publicoRouter.get(
  '/site',
  asyncHandler(async (_req, res) => {
    const [paginas, blocos, menus] = await Promise.all([
      consultar(
        `SELECT id, slug, caminho, titulo_seo, descricao_seo
           FROM "SolarCosta_SitePaginas"
          WHERE publicada ORDER BY ordem, nome`,
      ),
      consultar(
        `SELECT b.id, b.pagina_id, b.tipo, b.conteudo
           FROM "SolarCosta_SiteBlocos" b
           JOIN "SolarCosta_SitePaginas" p ON p.id = b.pagina_id
          WHERE b.visivel AND p.publicada
          ORDER BY b.pagina_id, b.ordem, b.criado_em`,
      ),
      consultar(
        `SELECT m.chave, i.id, i.rotulo, i.destino, i.nova_aba, i.destaque
           FROM "SolarCosta_SiteMenuItens" i
           JOIN "SolarCosta_SiteMenus" m ON m.id = i.menu_id
          WHERE i.visivel
          ORDER BY m.chave, i.ordem, i.criado_em`,
      ),
    ]);

    const porMenu: Record<string, unknown[]> = {};
    for (const it of menus as Record<string, unknown>[]) {
      const chave = String(it.chave);
      (porMenu[chave] ??= []).push({
        id: it.id,
        rotulo: it.rotulo,
        destino: it.destino,
        nova_aba: it.nova_aba,
        destaque: it.destaque,
      });
    }

    // Toda visita ao site baixa este payload. Um minuto de cache tira o banco
    // do caminho da maioria das visitas sem atrasar de forma perceptível uma
    // edição feita no CMS.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      paginas: (paginas as Record<string, unknown>[]).map((p) => ({
        slug: p.slug,
        caminho: p.caminho,
        titulo_seo: p.titulo_seo,
        descricao_seo: p.descricao_seo,
        blocos: (blocos as Record<string, unknown>[])
          .filter((b) => b.pagina_id === p.id)
          .map((b) => ({ id: b.id, tipo: b.tipo, conteudo: b.conteudo })),
      })),
      menus: porMenu,
    });
  }),
);

// ---------------------------------------------------------------- MÍDIA ---
// Bytes das imagens da biblioteca. Única rota do projeto que responde binário
// sem exigir sessão — é o <img src> de um visitante anônimo.
publicoRouter.get(
  '/midia/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ erro: 'Imagem não encontrada.', codigo: 'nao_encontrado' });
      return;
    }

    const linha = await consultarUm<{
      mime_type: string;
      hash_sha256: string;
      conteudo: Buffer;
    }>(
      `SELECT mime_type, hash_sha256, conteudo FROM "SolarCosta_SiteMidia"
        WHERE id = $1 AND excluido_em IS NULL`,
      [id.data],
    );

    if (!linha) {
      res.status(404).json({ erro: 'Imagem não encontrada.', codigo: 'nao_encontrado' });
      return;
    }

    // `immutable` é seguro porque os bytes de um id nunca mudam: trocar a
    // imagem de um bloco grava outra linha, com outro id. O ETag é o próprio
    // hash do arquivo, então o 304 sai de graça.
    const etag = `"${linha.hash_sha256}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', linha.mime_type);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.send(linha.conteudo);
  }),
);

// ------------------------------------------------------------ DOCUMENTO ---
//
// A proposta e o contrato que o cliente abre pelo link do WhatsApp.
//
// É a rota mais delicada deste arquivo. As outras devolvem conteúdo que já é
// público por natureza — texto de site, tarifa de concessionária. Esta devolve
// o documento comercial de UMA pessoa, e a credencial é só o token da URL.
//
// Daí a whitelist abaixo ser mais estreita do que a do /api/propostas: fora
// dela ficam `consumo_kwh` e `tarifa_kwh` (entradas do cálculo, não resultado),
// o `consultor_id`, o `lead_id`, as datas internas de fluxo e qualquer coluna
// criada no futuro. O que entra é o que já está impresso na folha que o
// cliente receberia em mãos.

/**
 * 30 aberturas por IP a cada 15 minutos.
 *
 * Mais folgado que o formulário de leads (5) porque aqui o mesmo cliente
 * recarrega a página, compartilha com o cônjuge e volta dias depois; e o token
 * de 32 bytes já torna a força bruta inviável muito antes do rate limit. O
 * limite existe contra varredura, não contra o cliente.
 */
const limiteDocumento = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Mesma resposta para token inexistente, revogado e vencido — ver abrirLink. */
function documentoNaoEncontrado(res: Response): void {
  res.status(404).json({
    erro: 'Este link não está mais disponível. Peça um novo ao seu consultor.',
    codigo: 'link_invalido',
  });
}

publicoRouter.get(
  '/documento/:token',
  limiteDocumento,
  asyncHandler(async (req, res) => {
    // Quando quem abre é o nosso próprio Chromium gerando o PDF, a visita NÃO
    // conta: o número de aberturas existe para dizer se o CLIENTE olhou o
    // documento, e uma proposta enviada a três pessoas somaria três aberturas
    // antes de sair do servidor. Ver services/renderInterno.ts.
    const token = req.params.token ?? '';
    const link = ehRenderInterno(req) ? await lerLink(token) : await abrirLink(token);
    if (!link) {
      documentoNaoEncontrado(res);
      return;
    }

    const empresa = await consultarUm(
      `SELECT razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, uf, cep,
              telefone, whatsapp, email::text AS email, site, logo_url,
              responsavel_tecnico, crea
         FROM "SolarCosta_Empresa" LIMIT 1`,
    );

    if (link.tipo === 'proposta') {
      const proposta = await consultarUm(
        `SELECT p.id, p.numero, p.cliente_nome, p.cpf_cnpj, p.endereco, p.cidade, p.cep,
                p.potencia_kwp, p.modulos_qtd, p.modulo_wp, p.area_estimada_m2,
                p.geracao_media_kwh, p.cobertura_pct,
                p.economia_mensal, p.economia_anual, p.economia_25_anos, p.payback_anos,
                p.valor_total, p.forma_pagamento::text AS forma_pagamento,
                p.desconto_avista_pct, p.parcelas_cartao, p.taxa_cartao_pct,
                p.entrada_financiamento_valor, p.entrada_financiamento_pct,
                p.parcelas_financiamento, p.juros_financiamento_mes_pct,
                p.observacoes, p.logo_customizada_url, p.validade_dias, p.criado_em,
                p.latitude, p.longitude, p.mapa_zoom, p.telhado_area_m2,
                p.layout_modulos, p.layout_segmentos, p.layout_modulo,
                c.nome AS concessionaria, t.nome AS telhado,
                b.nome AS banco_financiamento, u.nome AS consultor
           FROM "SolarCosta_Propostas" p
           LEFT JOIN "SolarCosta_Concessionarias"     c ON c.id = p.concessionaria_id
           LEFT JOIN "SolarCosta_TiposTelhado"        t ON t.id = p.tipo_telhado_id
           LEFT JOIN "SolarCosta_BancosFinanciamento" b ON b.id = p.banco_financiamento_id
           LEFT JOIN "SolarCosta_Usuarios"            u ON u.id = p.consultor_id
          WHERE p.id = $1 AND p.excluido_em IS NULL`,
        [link.referencia_id],
      );

      if (!proposta) {
        documentoNaoEncontrado(res);
        return;
      }

      const itens = await consultar(
        `SELECT descricao, qtd, valor_unit, total
           FROM "SolarCosta_PropostaItens" WHERE proposta_id = $1 ORDER BY ordem`,
        [link.referencia_id],
      );

      // Sem cache: o contador de aberturas depende de a requisição chegar até
      // aqui, e um documento corrigido precisa aparecer corrigido no mesmo link.
      res.setHeader('Cache-Control', 'no-store');
      res.json({ tipo: 'proposta', documento: { ...proposta, itens }, empresa });
      return;
    }

    const contrato = await consultarUm(
      `SELECT id, numero, cliente_nome, cpf_cnpj, rg_inscricao, endereco, cep,
              potencia_kwp, modulos_qtd, modulo_modelo, inversor_modelo, estrutura,
              prazo_execucao, local_instalacao,
              valor_total, forma_pagamento, entrada, parcelas_info, banco_agente,
              primeiro_vencimento, multa_atraso, foro_eleito,
              garantia_modulos, garantia_inversores, garantia_instalacao,
              garantia_homologacao, responsavel_tecnico, crea,
              status::text AS status, data_emissao, data_assinatura, observacoes
         FROM "SolarCosta_Contratos" WHERE id = $1 AND excluido_em IS NULL`,
      [link.referencia_id],
    );

    if (!contrato) {
      documentoNaoEncontrado(res);
      return;
    }

    const clausulas = await consultar(
      `SELECT ordem, titulo, texto FROM "SolarCosta_ContratoClausulas"
        WHERE contrato_id = $1 ORDER BY ordem`,
      [link.referencia_id],
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ tipo: 'contrato', documento: { ...contrato, clausulas }, empresa });
  }),
);

/**
 * Recorte de satélite do telhado, para a página do documento.
 *
 * Existe porque GET /api/solar/imagem exige login: sem esta rota, a folha do
 * telhado abriria em branco no navegador do cliente.
 *
 * Usa `lerLink` em vez de `abrirLink` de propósito — a página busca a imagem
 * logo depois de carregar, e contar a abertura duas vezes por visita inflaria
 * justamente o número que o vendedor usa para decidir quando ligar.
 *
 * As coordenadas vêm do BANCO, nunca da query string. Aceitá-las do cliente
 * transformaria esta rota num proxy aberto para a API paga do Google, com a
 * nossa chave e a nossa fatura.
 */
publicoRouter.get(
  '/documento/:token/telhado.png',
  limiteDocumento,
  asyncHandler(async (req, res) => {
    const link = await lerLink(req.params.token ?? '');
    if (!link || link.tipo !== 'proposta') {
      documentoNaoEncontrado(res);
      return;
    }

    const p = await consultarUm<{ latitude: number | null; longitude: number | null; mapa_zoom: number | null }>(
      `SELECT latitude, longitude, mapa_zoom FROM "SolarCosta_Propostas"
        WHERE id = $1 AND excluido_em IS NULL`,
      [link.referencia_id],
    );

    if (!p?.latitude || !p.longitude) {
      documentoNaoEncontrado(res);
      return;
    }

    const { largura, altura } = z
      .object({
        largura: z.coerce.number().int().min(100).max(640).default(640),
        altura: z.coerce.number().int().min(100).max(640).default(640),
      })
      .parse(req.query);

    const imagem = await imagemSatelite(p.latitude, p.longitude, p.mapa_zoom ?? 20, largura, altura);

    // A imagem de um ponto fixo não muda; o ToS do Google permite cache
    // temporário e 24h é o mesmo teto que o googleSolar.ts já usa em memória.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Type', imagem.tipo);
    res.send(imagem.bytes);
  }),
);
