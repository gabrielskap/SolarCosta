// Gera o bloco de conteúdo inicial da migration V008 a partir de
// src/site/conteudoPadrao.ts.
//
// Por que existe: o mesmo conteúdo precisa estar em dois lugares — no banco
// (para o CMS ter o que editar no primeiro deploy) e em TypeScript (para o
// site não ficar em branco se a API cair). Transcrever centenas de linhas de
// copy à mão entre .ts e .sql erra; gerar não erra.
//
// Uso:
//   npx tsx scripts/gerar-seed-site.ts >> database/migrations/V008__site_cms.sql
//
// Rodar de novo só faz sentido se o FALLBACK mudar. O conteúdo já gravado no
// banco é do administrador e não deve ser sobrescrito — por isso todo INSERT
// abaixo é guardado por ON CONFLICT / NOT EXISTS.

import { MENUS_PADRAO, PAGINAS_PADRAO } from '../src/site/conteudoPadrao';
import type { ChaveMenu } from '../src/site/blocos/tipos';

/** Literal de texto para o Postgres (standard_conforming_strings ligado). */
function sql(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function jsonb(valor: unknown): string {
  return `${sql(JSON.stringify(valor))}::jsonb`;
}

const NOMES_MENU: Record<ChaveMenu, { nome: string; descricao: string }> = {
  principal: {
    nome: 'Menu principal',
    descricao: 'Navegação do cabeçalho, no desktop e no menu mobile.',
  },
  rodape_navegacao: {
    nome: 'Rodapé — navegação',
    descricao: 'Coluna "Navegação" do rodapé.',
  },
  rodape_servicos: {
    nome: 'Rodapé — serviços',
    descricao: 'Coluna "Serviços" do rodapé.',
  },
};

const linhas: string[] = [];
const p = (s = '') => linhas.push(s);

p();
p('-- =============================================================================');
p('-- 6. CONTEÚDO INICIAL');
p('--');
p('--    GERADO por scripts/gerar-seed-site.ts a partir de');
p('--    src/site/conteudoPadrao.ts. Não editar à mão: rode o script de novo.');
p('--');
p('--    Reproduz o site exatamente como ele era antes desta migration, para');
p('--    que `npm run migrate` não deixe nenhuma página vazia. Todo INSERT é');
p('--    idempotente e nunca sobrescreve conteúdo já editado pelo administrador.');
p('-- =============================================================================');
p();
p('BEGIN;');
p();

// ------------------------------------------------------------------ páginas --
PAGINAS_PADRAO.forEach((pagina, indice) => {
  p(`-- ${pagina.nome} (${pagina.caminho})`);
  p('INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)');
  p(
    `VALUES (${sql(pagina.slug)}, ${sql(pagina.caminho)}, ${sql(pagina.nome)}, ` +
      `${sql(pagina.tituloSeo)}, ${sql(pagina.descricaoSeo)}, ${indice + 1})`,
  );
  p('ON CONFLICT (slug) DO NOTHING;');
  p();

  // Todos os blocos da página num ÚNICO INSERT: a guarda "esta página já tem
  // blocos?" precisa ser avaliada uma vez só. Em statements separados, o
  // primeiro INSERT criaria um bloco e faria a guarda barrar todos os
  // seguintes — a página nasceria com uma seção só.
  p('INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)');
  p('SELECT pg.id, b.tipo, b.ordem, b.conteudo');
  p('  FROM "SolarCosta_SitePaginas" pg');
  p('  CROSS JOIN (VALUES');
  pagina.blocos.forEach((bloco, i) => {
    const virgula = i < pagina.blocos.length - 1 ? ',' : '';
    p(`      (${sql(bloco.tipo)}, ${i + 1}, ${jsonb(bloco.conteudo)})${virgula}`);
  });
  p('  ) AS b(tipo, ordem, conteudo)');
  p(` WHERE pg.slug = ${sql(pagina.slug)}`);
  p('   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);');
  p();
});

// -------------------------------------------------------------------- menus --
(Object.keys(MENUS_PADRAO) as ChaveMenu[]).forEach((chave) => {
  const meta = NOMES_MENU[chave];
  p(`-- ${meta.nome}`);
  p('INSERT INTO "SolarCosta_SiteMenus" (chave, nome, descricao)');
  p(`VALUES (${sql(chave)}, ${sql(meta.nome)}, ${sql(meta.descricao)})`);
  p('ON CONFLICT (chave) DO NOTHING;');
  p();

  // Mesma razão do INSERT de blocos: guarda avaliada uma vez, para o menu não
  // nascer com um item só.
  p('INSERT INTO "SolarCosta_SiteMenuItens" (menu_id, rotulo, destino, nova_aba, destaque, ordem)');
  p('SELECT m.id, i.rotulo, i.destino, i.nova_aba, i.destaque, i.ordem');
  p('  FROM "SolarCosta_SiteMenus" m');
  p('  CROSS JOIN (VALUES');
  MENUS_PADRAO[chave].forEach((it, i) => {
    const virgula = i < MENUS_PADRAO[chave].length - 1 ? ',' : '';
    p(
      `      (${sql(it.rotulo)}, ${sql(it.destino)}, ${it.novaAba}, ${it.destaque}, ${i + 1})${virgula}`,
    );
  });
  p('  ) AS i(rotulo, destino, nova_aba, destaque, ordem)');
  p(` WHERE m.chave = ${sql(chave)}`);
  p('   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteMenuItens" x WHERE x.menu_id = m.id);');
  p();
});

p('COMMIT;');

process.stdout.write(linhas.join('\n') + '\n');
