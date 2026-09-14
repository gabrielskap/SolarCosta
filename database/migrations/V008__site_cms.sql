-- =============================================================================
--  SOLAR COSTA · V008 — Conteúdo do site no banco (Configuração do Site)
--
--  Até aqui o site institucional era código: trocar o H1 do herói, o telefone
--  de um card ou a ordem de uma seção exigia editar .tsx, buildar e publicar.
--  O conteúdo editorial passa a morar aqui, e a tela /sistema/site edita.
--
--  O DESENHO EM UMA FRASE: cada página é uma lista ordenada de BLOCOS, e cada
--  bloco é um tipo (que mapeia para um componente React) mais um jsonb com os
--  textos daquele tipo.
--
--  Por que `tipo` é text e não ENUM nem CHECK:
--    o catálogo de blocos é de CÓDIGO, não de negócio — cada tipo existe
--    porque existe um componente que sabe desenhá-lo. Um ENUM exigiria
--    ALTER TYPE a cada bloco novo e um CHECK exigiria migration; a validação
--    real é o zod da API (server/src/routes/site.routes.ts), que é onde toda
--    validação deste projeto já mora. O renderizador ignora tipo desconhecido,
--    então um banco à frente do código nunca quebra o site.
--
--  Por que o conteúdo inicial vem NESTA migration e não num seed:
--    o Dockerfile roda `npm run migrate && npm start` e nunca toca em
--    database/seeds/ (ver migrate.ts). Se o conteúdo fosse seed, o primeiro
--    deploy subiria com o site em branco. Os INSERTs abaixo foram gerados de
--    src/site/conteudoPadrao.ts por scripts/gerar-seed-site.ts e reproduzem o
--    site exatamente como ele era antes desta migration.
-- =============================================================================

-- Fora da transação de propósito: o Postgres não deixa USAR um valor de ENUM
-- na mesma transação que o adiciona. Nada abaixo usa 'Site' — quem usa é a API,
-- em requisições posteriores. `IF NOT EXISTS` mantém a migration re-executável.
ALTER TYPE "SolarCosta_EntidadeAuditoria" ADD VALUE IF NOT EXISTS 'Site';

BEGIN;

-- =============================================================================
-- 1. PERMISSÃO
-- =============================================================================

-- Separada de `gerenciar_usuarios` para que o marketing edite o site sem
-- ganhar junto o cadastro de usuários e os parâmetros comerciais.
ALTER TABLE "SolarCosta_UsuarioPermissoes"
    ADD COLUMN IF NOT EXISTS gerenciar_site boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "SolarCosta_UsuarioPermissoes".gerenciar_site IS
    'Permite editar o conteúdo do site institucional em /sistema/site. '
    'O cargo Administrador recebe por definição, independentemente desta coluna.';


-- =============================================================================
-- 2. PÁGINAS
--    Cinco linhas fixas, espelhando as rotas de src/main.tsx. A UI não cria
--    nem exclui páginas: edita SEO e a lista de blocos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_SitePaginas" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           text NOT NULL UNIQUE,
    caminho        text NOT NULL UNIQUE,
    nome           text NOT NULL,
    titulo_seo     text NOT NULL,
    descricao_seo  text NOT NULL,
    publicada      boolean NOT NULL DEFAULT true,
    ordem          smallint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "SolarCosta_SitePaginas_slug_nao_vazio" CHECK (btrim(slug) <> '')
);

COMMENT ON TABLE "SolarCosta_SitePaginas" IS
    'Páginas do site institucional. Substitui os useSeo() chumbados em src/site/pages.';
COMMENT ON COLUMN "SolarCosta_SitePaginas".caminho IS
    'Rota do React Router ("/", "/servicos", ...). Deve casar com src/main.tsx.';
COMMENT ON COLUMN "SolarCosta_SitePaginas".publicada IS
    'false esconde a página do site; a rota continua existindo e cai no 404.';


-- =============================================================================
-- 3. BLOCOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_SiteBlocos" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pagina_id       uuid NOT NULL REFERENCES "SolarCosta_SitePaginas"(id) ON DELETE CASCADE,
    tipo            text NOT NULL,
    ordem           smallint NOT NULL DEFAULT 0,
    visivel         boolean NOT NULL DEFAULT true,
    conteudo        jsonb NOT NULL DEFAULT '{}'::jsonb,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    atualizado_por  uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    CONSTRAINT "SolarCosta_SiteBlocos_tipo_nao_vazio" CHECK (btrim(tipo) <> '')
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_SiteBlocos_pagina_ordem"
    ON "SolarCosta_SiteBlocos" (pagina_id, ordem);

COMMENT ON TABLE "SolarCosta_SiteBlocos" IS
    'Seções de conteúdo de cada página, na ordem em que aparecem.';
COMMENT ON COLUMN "SolarCosta_SiteBlocos".tipo IS
    'Tipo do bloco, que mapeia para um componente React em src/site/blocos. '
    'Conhecidos nesta versão: heroi, selos, cabecalho_pagina, cards_servicos, '
    'passos, faq, cta, lista_itens, banner_conversao, dados_empresa, '
    'contato_canais, simulador, texto_rico, galeria. A lista autoritativa é '
    'TIPOS_BLOCO em src/site/blocos/tipos.ts, validada pelo zod da API.';
COMMENT ON COLUMN "SolarCosta_SiteBlocos".conteudo IS
    'Textos e opções do bloco. O formato depende de `tipo` — ver as interfaces '
    'Conteudo* em src/site/blocos/tipos.ts.';
COMMENT ON COLUMN "SolarCosta_SiteBlocos".visivel IS
    'false mantém o bloco salvo mas fora do ar — desligar sem perder o texto.';


-- =============================================================================
-- 4. MENUS
--    Três menus fixos. Antes desta migration os itens estavam duplicados em
--    SiteHeader.tsx e SiteFooter.tsx, e mudar o menu exigia editar os dois.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_SiteMenus" (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave      text NOT NULL UNIQUE,
    nome       text NOT NULL,
    descricao  text
);

CREATE TABLE IF NOT EXISTS "SolarCosta_SiteMenuItens" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id        uuid NOT NULL REFERENCES "SolarCosta_SiteMenus"(id) ON DELETE CASCADE,
    rotulo         text NOT NULL,
    destino        text NOT NULL,
    nova_aba       boolean NOT NULL DEFAULT false,
    destaque       boolean NOT NULL DEFAULT false,
    visivel        boolean NOT NULL DEFAULT true,
    ordem          smallint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "SolarCosta_SiteMenuItens_rotulo_nao_vazio" CHECK (btrim(rotulo) <> '')
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_SiteMenuItens_menu_ordem"
    ON "SolarCosta_SiteMenuItens" (menu_id, ordem);

COMMENT ON COLUMN "SolarCosta_SiteMenuItens".destino IS
    'Caminho interno ("/servicos") ou URL absoluta ("https://...").';
COMMENT ON COLUMN "SolarCosta_SiteMenuItens".destaque IS
    'true vira o botão amarelo de chamada no cabeçalho, em vez de link comum.';


-- =============================================================================
-- 5. MÍDIA
--    Os bytes ficam AQUI, não em disco. O deploy é um container sem volume
--    persistente (ver EASYPANEL.md): imagem em disco sumiria no próximo
--    redeploy, e o backup do Postgres já é rotina.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_SiteMidia" (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo       text NOT NULL,
    mime_type          text NOT NULL,
    tamanho_bytes      integer NOT NULL,
    largura            integer,
    altura             integer,
    texto_alternativo  text,
    hash_sha256        text NOT NULL UNIQUE,
    conteudo           bytea NOT NULL,
    enviado_por_id     uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    enviado_em         timestamptz NOT NULL DEFAULT now(),
    excluido_em        timestamptz,
    -- SVG está FORA da lista de propósito: é XML executável, e servido da
    -- própria origem um <script> embutido rodaria com o domínio do site. A CSP
    -- de server/src/app.ts não protege contra isso porque a origem é 'self'.
    CONSTRAINT "SolarCosta_SiteMidia_mime_suportado" CHECK (
        mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/avif')
    ),
    CONSTRAINT "SolarCosta_SiteMidia_tamanho_valido" CHECK (
        tamanho_bytes > 0 AND tamanho_bytes <= 5242880
    )
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_SiteMidia_enviado_em"
    ON "SolarCosta_SiteMidia" (enviado_em DESC) WHERE excluido_em IS NULL;

COMMENT ON TABLE "SolarCosta_SiteMidia" IS
    'Biblioteca de imagens do site. Servida por GET /api/publico/midia/:id.';
COMMENT ON COLUMN "SolarCosta_SiteMidia".conteudo IS
    'Bytes da imagem. NUNCA incluir em SELECT * nem em listagem: uma consulta '
    'descuidada devolve megabytes dentro de um JSON.';
COMMENT ON COLUMN "SolarCosta_SiteMidia".hash_sha256 IS
    'SHA-256 do arquivo. UNIQUE faz dedupe (subir a mesma foto reaproveita a '
    'linha) e serve de ETag na rota pública.';
COMMENT ON COLUMN "SolarCosta_SiteMidia".excluido_em IS
    'Soft delete: um bloco pode continuar apontando para a mídia excluída.';

COMMIT;

-- =============================================================================
-- 6. CONTEÚDO INICIAL
--
--    GERADO por scripts/gerar-seed-site.ts a partir de
--    src/site/conteudoPadrao.ts. Não editar à mão: rode o script de novo.
--
--    Reproduz o site exatamente como ele era antes desta migration, para
--    que `npm run migrate` não deixe nenhuma página vazia. Todo INSERT é
--    idempotente e nunca sobrescreve conteúdo já editado pelo administrador.
-- =============================================================================

BEGIN;

-- Início (/)
INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
VALUES ('home', '/', 'Início', 'Energia solar em Belo Horizonte', 'Projeto, instalação e homologação de energia solar em Belo Horizonte e região. Simule sua economia e receba uma proposta com engenharia responsável.', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)
SELECT pg.id, b.tipo, b.ordem, b.conteudo
  FROM "SolarCosta_SitePaginas" pg
  CROSS JOIN (VALUES
      ('heroi', 1, '{"logo_legenda":"Energia Solar","titulo":"A energia da sua casa","titulo_destaque":"passa a ser sua.","subtitulo":"Projeto, instalação e homologação de sistemas fotovoltaicos com engenharia responsável. Você deixa de alugar energia da concessionária e passa a gerar a sua — com equipamentos, prazos e garantias por escrito.","cta_primario":{"rotulo":"Simular minha economia","destino":"/simulador"},"cta_secundario":{"rotulo":"Falar com um consultor","destino":"/contato"},"faixa_regiao":"e região metropolitana","faixa_credencial":"Projeto com ART e CREA","painel_rotulo":"Por que gerar a própria energia","painel_cta":{"rotulo":"Ver quanto eu economizaria","destino":"/simulador"},"destaques":[{"titulo":"A conta de luz vira investimento","texto":"O valor que hoje some todo mês passa a pagar um sistema que fica com você por mais de 25 anos."},{"titulo":"Proteção contra o reajuste","texto":"A tarifa sobe todo ano. Quem gera a própria energia sente muito menos cada bandeira vermelha."},{"titulo":"Imóvel mais valorizado","texto":"Sistema instalado e homologado é benfeitoria permanente, e pesa na hora de vender ou alugar."}]}'::jsonb),
      ('selos', 2, '{"rotulo":"Quem está por trás","descricao":"Energia solar é obra elétrica ligada à rede da concessionária. Antes de fechar com qualquer empresa, confira o CNPJ e o registro do responsável técnico. Os nossos estão aqui.","marca_legenda":"Energia Solar","itens":[{"icone":"FileCheck2","rotulo":"Empresa formalizada","nota":"","cor":"bg-blue-50 text-marca"},{"icone":"ShieldCheck","rotulo":"Responsável técnico","nota":"","cor":"bg-emerald-50 text-emerald-600"},{"icone":"MapPin","rotulo":"Onde atendemos","nota":"E toda a região metropolitana","cor":"bg-amber-50 text-amber-600"}]}'::jsonb),
      ('cards_servicos', 3, '{"rotulo":"O que fazemos","titulo":"Do telhado de casa ao galpão da empresa","descricao":"Cada projeto é dimensionado pela sua conta de luz e pelo seu telhado — não por um kit de catálogo.","centralizado":true,"completo":false,"claro":true,"link_rodape":{"rotulo":"Ver o que está incluído em cada serviço","destino":"/servicos"},"itens":[{"id":"residencial","titulo":"Energia solar residencial","resumo":"Sistema dimensionado para a sua conta de luz, não para um pacote pronto de prateleira.","detalhes":["Análise das últimas 12 contas para achar o consumo médio real","Projeto que respeita o tipo de telhado — colonial, laje, metálico, fibrocimento ou shingle","Instalação com equipe própria e material com nota fiscal","Homologação junto à concessionária até a troca do medidor"],"icone":"Home","cor":"amber"},{"id":"comercial","titulo":"Comercial e rural","resumo":"Para quem tem demanda contratada, turno de produção ou irrigação, a conta é outra — e o projeto também.","detalhes":["Estudo de viabilidade com o perfil de consumo do negócio","Sistemas em solo, estrutura metálica ou cobertura de galpão","Documentação para financiamento com bancos parceiros","Compensação de créditos entre unidades do mesmo titular"],"icone":"Building2","cor":"blue"},{"id":"homologacao","titulo":"Projeto e homologação","resumo":"A parte que ninguém mostra no orçamento: o sistema só vale quando a concessionária aprova.","detalhes":["ART emitida por engenheiro com registro no CREA","Projeto elétrico e memorial descritivo no padrão da concessionária","Acompanhamento do parecer de acesso e da vistoria","Solicitação da troca para o medidor bidirecional"],"icone":"FileCheck2","cor":"violet"},{"id":"manutencao","titulo":"Manutenção e monitoramento","resumo":"Painel sujo ou string desligada some da conta e ninguém percebe até o fim do ano.","detalhes":["Limpeza técnica dos módulos e inspeção das conexões","Leitura do inversor e comparação com a geração projetada","Laudo termográfico sob demanda","Atendimento a sistemas instalados por terceiros"],"icone":"Wrench","cor":"emerald"}]}'::jsonb),
      ('passos', 4, '{"rotulo":"Como funciona","titulo":"Da visita técnica ao medidor trocado","descricao":"Quatro etapas, com um responsável em cada uma delas. Você sabe sempre em que ponto está o seu projeto.","itens":[{"numero":"01","titulo":"Visita técnica","descricao":"Um consultor vai até o local, mede a área útil do telhado, confere o padrão de entrada e fotografa o quadro. Sem custo e sem compromisso.","icone":"ClipboardCheck"},{"numero":"02","titulo":"Projeto e proposta","descricao":"Dimensionamos o sistema pela sua média de consumo e apresentamos a proposta com equipamentos, geração estimada e formas de pagamento.","icone":"PencilRuler"},{"numero":"03","titulo":"Instalação e homologação","descricao":"Equipe própria instala, a engenharia emite a ART e cuidamos do processo junto à concessionária até a troca do medidor.","icone":"HardHat"},{"numero":"04","titulo":"Geração e acompanhamento","descricao":"O sistema entra em operação, você acompanha a geração pelo inversor e a gente segue disponível para manutenção e dúvidas.","icone":"Activity"}]}'::jsonb),
      ('banner_conversao', 5, '{"rotulo":"Comece pelo número","titulo":"Descubra em 30 segundos quanto a sua conta de luz pode cair.","texto":"O simulador usa exatamente a mesma fórmula de dimensionamento que os nossos consultores aplicam na proposta: a sua média de consumo, as horas de sol da região e as perdas reais do sistema. Sem número inflado para impressionar.","botao":{"rotulo":"Abrir o simulador","destino":"/simulador"},"formulario_titulo":"Prefere falar com gente?","formulario_descricao":"Deixe seu contato que um consultor retorna para agendar a visita técnica."}'::jsonb),
      ('faq', 6, '{"rotulo":"Dúvidas frequentes","titulo":"O que todo mundo pergunta antes de fechar","descricao":"As respostas honestas, inclusive as que não são a resposta que o vendedor gostaria de dar.","claro":true,"perguntas":[{"pergunta":"A conta de luz zera?","resposta":"Não zera por completo. Mesmo gerando toda a energia que consome, a concessionária cobra o custo de disponibilidade — uma taxa mínima equivalente a 30, 50 ou 100 kWh conforme o padrão de ligação (monofásico, bifásico ou trifásico), além da iluminação pública. O que some da conta é a maior parte: o consumo."},{"pergunta":"E nos dias nublados ou à noite?","resposta":"O sistema segue ligado à rede. Durante o dia, o excedente gerado vira crédito na concessionária; à noite e em dias fechados você consome esse crédito. Por isso o dimensionamento usa a média anual, não o melhor mês."},{"pergunta":"Quanto tempo leva do contrato à energia gerando?","resposta":"A instalação em si costuma levar poucos dias. O prazo maior está na homologação: a concessionária tem até 34 dias úteis para emitir o parecer de acesso e mais um período para a vistoria e a troca do medidor. Acompanhamos o processo do começo ao fim."},{"pergunta":"Qual a vida útil e a garantia do sistema?","resposta":"Os módulos têm garantia de eficiência de 25 anos dos fabricantes, e os inversores costumam ter entre 5 e 12 anos, com opção de extensão. A instalação tem garantia própria da Solar Costa. Os prazos exatos de cada equipamento vão descritos na proposta."}]}'::jsonb),
      ('cta', 7, '{"titulo":"A visita técnica é gratuita.","texto":"Um consultor vai até o local, mede o telhado, confere o padrão de entrada e só então monta a proposta. Se não fizer sentido para você, a gente diz.","regua":"from-amber-500 to-orange-400","botoes":[{"rotulo":"Agendar minha visita","destino":"/contato"}]}'::jsonb)
  ) AS b(tipo, ordem, conteudo)
 WHERE pg.slug = 'home'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);

-- Serviços (/servicos)
INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
VALUES ('servicos', '/servicos', 'Serviços', 'Serviços', 'Energia solar residencial, comercial e rural, projeto e homologação na concessionária, manutenção e monitoramento em Belo Horizonte e região.', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)
SELECT pg.id, b.tipo, b.ordem, b.conteudo
  FROM "SolarCosta_SitePaginas" pg
  CROSS JOIN (VALUES
      ('cabecalho_pagina', 1, '{"rotulo":"Serviços","titulo":"Energia solar feita para o seu consumo, não para a média do mercado.","descricao":"Dimensionar por cima encarece o projeto; por baixo, deixa conta para pagar todo mês. A visita técnica existe para acertar esse número antes de qualquer proposta."}'::jsonb),
      ('cards_servicos', 2, '{"rotulo":"","titulo":"","descricao":"","centralizado":false,"completo":true,"claro":false,"itens":[{"id":"residencial","titulo":"Energia solar residencial","resumo":"Sistema dimensionado para a sua conta de luz, não para um pacote pronto de prateleira.","detalhes":["Análise das últimas 12 contas para achar o consumo médio real","Projeto que respeita o tipo de telhado — colonial, laje, metálico, fibrocimento ou shingle","Instalação com equipe própria e material com nota fiscal","Homologação junto à concessionária até a troca do medidor"],"icone":"Home","cor":"amber"},{"id":"comercial","titulo":"Comercial e rural","resumo":"Para quem tem demanda contratada, turno de produção ou irrigação, a conta é outra — e o projeto também.","detalhes":["Estudo de viabilidade com o perfil de consumo do negócio","Sistemas em solo, estrutura metálica ou cobertura de galpão","Documentação para financiamento com bancos parceiros","Compensação de créditos entre unidades do mesmo titular"],"icone":"Building2","cor":"blue"},{"id":"homologacao","titulo":"Projeto e homologação","resumo":"A parte que ninguém mostra no orçamento: o sistema só vale quando a concessionária aprova.","detalhes":["ART emitida por engenheiro com registro no CREA","Projeto elétrico e memorial descritivo no padrão da concessionária","Acompanhamento do parecer de acesso e da vistoria","Solicitação da troca para o medidor bidirecional"],"icone":"FileCheck2","cor":"violet"},{"id":"manutencao","titulo":"Manutenção e monitoramento","resumo":"Painel sujo ou string desligada some da conta e ninguém percebe até o fim do ano.","detalhes":["Limpeza técnica dos módulos e inspeção das conexões","Leitura do inversor e comparação com a geração projetada","Laudo termográfico sob demanda","Atendimento a sistemas instalados por terceiros"],"icone":"Wrench","cor":"emerald"}]}'::jsonb),
      ('lista_itens', 3, '{"rotulo":"Sempre incluso","titulo":"O que vai junto em todo projeto","descricao":"Itens que costumam aparecer como extra em orçamento concorrente e aqui fazem parte do serviço.","claro":true,"centralizado":true,"colunas":3,"itens":[{"icone":"FileSignature","titulo":"Engenharia e documentação","texto":"ART do responsável técnico, projeto elétrico, memorial descritivo e o processo completo de acesso junto à concessionária.","cor":"blue"},{"icone":"PackageCheck","titulo":"Equipamento com procedência","texto":"Módulos e inversores de fabricantes com representação no Brasil, nota fiscal em seu nome e garantia registrada.","cor":"blue"},{"icone":"Zap","titulo":"Instalação com equipe própria","texto":"Quem instala é a nossa equipe, com estrutura de fixação adequada ao seu telhado e proteções elétricas dimensionadas.","cor":"blue"}]}'::jsonb),
      ('passos', 4, '{"rotulo":"Como funciona","titulo":"Da visita técnica ao medidor trocado","descricao":"Quatro etapas, com um responsável em cada uma delas. Você sabe sempre em que ponto está o seu projeto.","itens":[{"numero":"01","titulo":"Visita técnica","descricao":"Um consultor vai até o local, mede a área útil do telhado, confere o padrão de entrada e fotografa o quadro. Sem custo e sem compromisso.","icone":"ClipboardCheck"},{"numero":"02","titulo":"Projeto e proposta","descricao":"Dimensionamos o sistema pela sua média de consumo e apresentamos a proposta com equipamentos, geração estimada e formas de pagamento.","icone":"PencilRuler"},{"numero":"03","titulo":"Instalação e homologação","descricao":"Equipe própria instala, a engenharia emite a ART e cuidamos do processo junto à concessionária até a troca do medidor.","icone":"HardHat"},{"numero":"04","titulo":"Geração e acompanhamento","descricao":"O sistema entra em operação, você acompanha a geração pelo inversor e a gente segue disponível para manutenção e dúvidas.","icone":"Activity"}]}'::jsonb),
      ('cta', 5, '{"titulo":"Não sabe qual se aplica ao seu caso?","texto":"Comece pelo simulador: com a sua conta de luz já dá para ver o porte do sistema. Depois um consultor confirma tudo na visita.","regua":"from-emerald-500 to-teal-400","botoes":[{"rotulo":"Simular economia","destino":"/simulador"},{"rotulo":"Falar com um consultor","destino":"/contato"}]}'::jsonb)
  ) AS b(tipo, ordem, conteudo)
 WHERE pg.slug = 'servicos'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);

-- Simulador (/simulador)
INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
VALUES ('simulador', '/simulador', 'Simulador', 'Simulador de economia', 'Simule quanto a energia solar pode reduzir da sua conta de luz em Belo Horizonte e região, com as horas de sol da sua concessionária.', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)
SELECT pg.id, b.tipo, b.ordem, b.conteudo
  FROM "SolarCosta_SitePaginas" pg
  CROSS JOIN (VALUES
      ('cabecalho_pagina', 1, '{"rotulo":"Simulador","icone":"Calculator","titulo":"Quanto o sol pode tirar da sua conta de luz?","descricao":"A mesma conta que os nossos consultores fazem na proposta, com as horas de sol da sua região e as perdas reais do sistema."}'::jsonb),
      ('simulador', 2, '{"entrada_titulo":"Seus dados de consumo","entrada_descricao":"Use a média dos últimos meses — a conta varia bastante entre verão e inverno.","vazio_titulo":"Informe seu consumo ao lado","vazio_texto":"Com o valor da conta ou o consumo em kWh já conseguimos dimensionar o sistema.","economia_rotulo":"Sua economia estimada","nota_projecao":"A projeção de 25 anos considera reajuste de 6% ao ano na tarifa de energia — é justamente por isso que a economia cresce com o tempo.","nota_investimento":"o valor do sistema depende dos equipamentos escolhidos, da estrutura do seu telhado e da forma de pagamento. Por isso ele não sai numa simulação automática — vem na proposta, depois da visita técnica, com tudo detalhado.","proximo_rotulo":"Próximo passo","proximo_titulo":"Leve esse número para uma proposta de verdade","proximo_descricao":"Enviamos o seu contato junto com o consumo simulado, para o consultor já começar a conversa sabendo do que se trata.","proximo_itens":["Visita técnica sem custo, no dia que der para você","Proposta com equipamentos, geração projetada e garantias","Formas de pagamento à vista, cartão ou financiamento"],"formulario_titulo":"Quero minha proposta","formulario_descricao":"Preencha e um consultor entra em contato para agendar a visita."}'::jsonb),
      ('faq', 3, '{"rotulo":"Dúvidas frequentes","titulo":"O que todo mundo pergunta antes de fechar","descricao":"As respostas honestas, inclusive as que não são a resposta que o vendedor gostaria de dar.","claro":false,"perguntas":[{"pergunta":"A conta de luz zera?","resposta":"Não zera por completo. Mesmo gerando toda a energia que consome, a concessionária cobra o custo de disponibilidade — uma taxa mínima equivalente a 30, 50 ou 100 kWh conforme o padrão de ligação (monofásico, bifásico ou trifásico), além da iluminação pública. O que some da conta é a maior parte: o consumo."},{"pergunta":"E nos dias nublados ou à noite?","resposta":"O sistema segue ligado à rede. Durante o dia, o excedente gerado vira crédito na concessionária; à noite e em dias fechados você consome esse crédito. Por isso o dimensionamento usa a média anual, não o melhor mês."},{"pergunta":"Quanto tempo leva do contrato à energia gerando?","resposta":"A instalação em si costuma levar poucos dias. O prazo maior está na homologação: a concessionária tem até 34 dias úteis para emitir o parecer de acesso e mais um período para a vistoria e a troca do medidor. Acompanhamos o processo do começo ao fim."}]}'::jsonb)
  ) AS b(tipo, ordem, conteudo)
 WHERE pg.slug = 'simulador'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);

-- A empresa (/sobre)
INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
VALUES ('sobre', '/sobre', 'A empresa', 'A empresa', 'Solar Costa Energia Solar: empresa de energia fotovoltaica em Belo Horizonte, com responsável técnico registrado no CREA e equipe própria de instalação.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)
SELECT pg.id, b.tipo, b.ordem, b.conteudo
  FROM "SolarCosta_SitePaginas" pg
  CROSS JOIN (VALUES
      ('cabecalho_pagina', 1, '{"rotulo":"A empresa","titulo":"Energia solar com engenharia por trás, não só com vendedor na frente.","descricao":"A Solar Costa projeta, instala e homologa sistemas fotovoltaicos em Belo Horizonte e na região metropolitana. Cada projeto sai com ART e responsável técnico registrado — o que garante que o sistema foi calculado por quem responde por ele.","mostrar_marca":true}'::jsonb),
      ('lista_itens', 2, '{"rotulo":"","titulo":"","descricao":"","claro":false,"centralizado":false,"colunas":3,"itens":[{"icone":"Eye","titulo":"Número que se sustenta","texto":"A geração projetada na proposta é a mesma que o simulador do site mostra, com as perdas reais embutidas. Prometer 100% de economia é fácil; entregar é outra história.","cor":"blue"},{"icone":"Handshake","titulo":"Uma empresa, um responsável","texto":"Projeto, instalação e homologação ficam com a gente. Não repassamos a obra para terceiros e depois some o telefone quando aparece um problema.","cor":"emerald"},{"icone":"Wrench","titulo":"Depois da instalação também","texto":"Sistema fotovoltaico dá pouca manutenção, mas não dá nenhuma. Seguimos disponíveis para limpeza, inspeção e dúvidas sobre a fatura.","cor":"amber"}]}'::jsonb),
      ('dados_empresa', 3, '{"rotulo_cadastro":"Transparência","titulo_cadastro":"Dados cadastrais","descricao_cadastro":"Antes de assinar qualquer contrato de energia solar, confira o CNPJ e o registro do responsável técnico da empresa. Aqui estão os nossos.","rotulo_escritorio":"Onde estamos","titulo_escritorio":"Atendimento e escritório","area_atendimento":"Belo Horizonte, Contagem, Betim, Nova Lima, Santa Luzia, Ribeirão das Neves, Sabará, Vespasiano e demais cidades da região metropolitana."}'::jsonb),
      ('cta', 4, '{"titulo":"Vamos conversar sobre o seu projeto?","texto":"Comece pelo simulador ou fale direto com um consultor. Nos dois caminhos, a visita técnica é gratuita.","regua":"from-blue-600 to-indigo-500","botoes":[{"rotulo":"Falar com um consultor","destino":"/contato"},{"rotulo":"Abrir o simulador","destino":"/simulador"}]}'::jsonb)
  ) AS b(tipo, ordem, conteudo)
 WHERE pg.slug = 'sobre'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);

-- Contato (/contato)
INSERT INTO "SolarCosta_SitePaginas" (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
VALUES ('contato', '/contato', 'Contato', 'Contato', 'Fale com a Solar Costa: agende uma visita técnica gratuita para energia solar em Belo Horizonte e região. Telefone, WhatsApp, e-mail e endereço.', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo)
SELECT pg.id, b.tipo, b.ordem, b.conteudo
  FROM "SolarCosta_SitePaginas" pg
  CROSS JOIN (VALUES
      ('cabecalho_pagina', 1, '{"rotulo":"Contato","titulo":"A visita técnica é gratuita. Vamos marcar?","descricao":"Escolha o canal que preferir. Se puder, tenha em mãos uma conta de luz recente — é com ela que o consultor começa o dimensionamento."}'::jsonb),
      ('contato_canais', 2, '{"formulario_titulo":"Envie seus dados","formulario_descricao":"Chega direto na equipe comercial. Retornamos pelo telefone que você informar.","mensagem_whatsapp":"Olá! Vim pelo site da Solar Costa e gostaria de um orçamento.","canais":[{"tipo":"whatsapp","icone":"MessageCircle","rotulo":"WhatsApp","nota":"Resposta mais rápida no horário comercial","cor":"bg-emerald-50 text-emerald-600"},{"tipo":"telefone","icone":"Phone","rotulo":"Telefone","nota":"Segunda a sexta","cor":"bg-blue-50 text-marca"},{"tipo":"email","icone":"Mail","rotulo":"E-mail","nota":"Para envio de contas e documentos","cor":"bg-violet-50 text-violet-600"}],"horario_rotulo":"Atendimento","horario_texto":"Segunda a sexta, das 8h às 18h. Visitas técnicas também podem ser agendadas aos sábados pela manhã."}'::jsonb)
  ) AS b(tipo, ordem, conteudo)
 WHERE pg.slug = 'contato'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteBlocos" x WHERE x.pagina_id = pg.id);

-- Menu principal
INSERT INTO "SolarCosta_SiteMenus" (chave, nome, descricao)
VALUES ('principal', 'Menu principal', 'Navegação do cabeçalho, no desktop e no menu mobile.')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO "SolarCosta_SiteMenuItens" (menu_id, rotulo, destino, nova_aba, destaque, ordem)
SELECT m.id, i.rotulo, i.destino, i.nova_aba, i.destaque, i.ordem
  FROM "SolarCosta_SiteMenus" m
  CROSS JOIN (VALUES
      ('Início', '/', false, false, 1),
      ('Serviços', '/servicos', false, false, 2),
      ('Simulador', '/simulador', false, false, 3),
      ('A empresa', '/sobre', false, false, 4),
      ('Contato', '/contato', false, false, 5),
      ('Simular economia', '/simulador', false, true, 6)
  ) AS i(rotulo, destino, nova_aba, destaque, ordem)
 WHERE m.chave = 'principal'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteMenuItens" x WHERE x.menu_id = m.id);

-- Rodapé — navegação
INSERT INTO "SolarCosta_SiteMenus" (chave, nome, descricao)
VALUES ('rodape_navegacao', 'Rodapé — navegação', 'Coluna "Navegação" do rodapé.')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO "SolarCosta_SiteMenuItens" (menu_id, rotulo, destino, nova_aba, destaque, ordem)
SELECT m.id, i.rotulo, i.destino, i.nova_aba, i.destaque, i.ordem
  FROM "SolarCosta_SiteMenus" m
  CROSS JOIN (VALUES
      ('Início', '/', false, false, 1),
      ('Serviços', '/servicos', false, false, 2),
      ('Simulador de economia', '/simulador', false, false, 3),
      ('A empresa', '/sobre', false, false, 4),
      ('Fale com um consultor', '/contato', false, false, 5)
  ) AS i(rotulo, destino, nova_aba, destaque, ordem)
 WHERE m.chave = 'rodape_navegacao'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteMenuItens" x WHERE x.menu_id = m.id);

-- Rodapé — serviços
INSERT INTO "SolarCosta_SiteMenus" (chave, nome, descricao)
VALUES ('rodape_servicos', 'Rodapé — serviços', 'Coluna "Serviços" do rodapé.')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO "SolarCosta_SiteMenuItens" (menu_id, rotulo, destino, nova_aba, destaque, ordem)
SELECT m.id, i.rotulo, i.destino, i.nova_aba, i.destaque, i.ordem
  FROM "SolarCosta_SiteMenus" m
  CROSS JOIN (VALUES
      ('Energia solar residencial', '/servicos', false, false, 1),
      ('Energia solar comercial e rural', '/servicos', false, false, 2),
      ('Projeto e homologação na concessionária', '/servicos', false, false, 3),
      ('Manutenção e monitoramento', '/servicos', false, false, 4)
  ) AS i(rotulo, destino, nova_aba, destaque, ordem)
 WHERE m.chave = 'rodape_servicos'
   AND NOT EXISTS (SELECT 1 FROM "SolarCosta_SiteMenuItens" x WHERE x.menu_id = m.id);

COMMIT;
