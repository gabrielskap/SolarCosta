-- =============================================================================
--  SOLAR COSTA · S002 — Carga dos dados de demonstração
--
--  Migra 1:1 o conteúdo hoje mockado em:
--      src/services/storage.ts  (INITIAL_USERS, INITIAL_FORNECEDORES,
--                                INITIAL_PRODUTOS, INITIAL_LEADS,
--                                INITIAL_PROPOSTA, INITIAL_CONTRATO,
--                                INITIAL_BOLETOS, INITIAL_LANCAMENTOS,
--                                INITIAL_AGENDAMENTOS, INITIAL_OBRAS)
--      src/services/audit.ts    (INITIAL_AUDIT)
--
--  OPCIONAL: rode apenas em ambiente de desenvolvimento/homologação.
--  Em produção, execute somente S001 e cadastre os dados reais pela aplicação.
--
--  Requer: V001..V004 + S001 já aplicados.
-- =============================================================================

BEGIN;

-- Guarda contra execução dupla: as tabelas-filhas (histórico, itens, cláusulas)
-- não têm chave natural e seriam duplicadas numa segunda rodada.
DO $guard$
BEGIN
    IF EXISTS (SELECT 1 FROM "SolarCosta_Leads" LIMIT 1) THEN
        RAISE EXCEPTION
          'Ja existem leads cadastrados. Rode rollback/R001 e recomece, ou pule este seed.';
    END IF;
END $guard$;

-- Identifica a origem das linhas na trilha de auditoria gerada pelos triggers.
SET LOCAL app.usuario_nome = 'Carga inicial';

-- Durante a carga, os triggers que geram histórico automático são desligados:
-- o histórico real vem do mock e seria duplicado (e, no caso dos leads,
-- zeraria o contador "dias sem contato" que alimenta as notificações).
ALTER TABLE "SolarCosta_Leads" DISABLE TRIGGER "SolarCosta_tg_lead_historico_inicial";
ALTER TABLE "SolarCosta_Obras" DISABLE TRIGGER "SolarCosta_tg_obra_cria_homologacao";

-- =============================================================================
-- 1. USUÁRIOS  (INITIAL_USERS)
--    Senha do mock era '123' em texto puro. Aqui todos recebem o mesmo hash
--    bcrypt temporário — TROQUE antes de qualquer uso real.
-- =============================================================================
INSERT INTO "SolarCosta_Usuarios" (nome, email, senha_hash, telefone, cargo, status, ultimo_acesso, criado_em, crea) VALUES
    ('Carlos Eduardo Costa',  'carlos.costa@solarcosta.com.br',   crypt('TrocarEsta@2026', gen_salt('bf', 12)), '(31) 99876-5432', 'Administrador', 'ativo',   now() - interval '2 hours', '2026-01-01', NULL),
    ('Rafael Moura',          'rafael.moura@solarcosta.com.br',   crypt('TrocarEsta@2026', gen_salt('bf', 12)), '(31) 98765-4321', 'Vendedor',      'ativo',   now() - interval '5 minutes','2026-01-10', NULL),
    ('Ana Beatriz Santos',    'ana.beatriz@solarcosta.com.br',    crypt('TrocarEsta@2026', gen_salt('bf', 12)), '(31) 99123-8877', 'Financeiro',    'ativo',   now() - interval '2 hours', '2026-02-15', NULL),
    ('Thiago Gonçalves Leal', 'thiago.leal@solarcosta.com.br',    crypt('TrocarEsta@2026', gen_salt('bf', 12)), '(31) 99887-1122', 'Engenheiro',    'ativo',   now() - interval '1 day',   '2026-03-01', 'MG0000023481D'),
    ('Bruno Oliveira',        'bruno.oliveira@solarcosta.com.br', crypt('TrocarEsta@2026', gen_salt('bf', 12)), '(31) 98711-3344', 'Instalador',    'inativo', '2026-07-22',               '2026-04-20', NULL)
ON CONFLICT (email) DO NOTHING;

-- Permissões por cargo (o mock nunca preenchia UserPermissions).
INSERT INTO "SolarCosta_UsuarioPermissoes"
    (usuario_id, criar_editar_leads, emitir_propostas, anexar_documentos, emitir_contratos,
     ver_lancamentos_financeiro, gerenciar_usuarios, gerenciar_obras, ver_auditoria)
SELECT u.id,
       u.cargo IN ('Administrador','Vendedor'),
       u.cargo IN ('Administrador','Vendedor'),
       u.cargo IN ('Administrador','Vendedor','Engenheiro'),
       u.cargo IN ('Administrador','Financeiro'),
       u.cargo IN ('Administrador','Financeiro'),
       u.cargo  = 'Administrador',
       u.cargo IN ('Administrador','Engenheiro','Instalador'),
       u.cargo  = 'Administrador'
  FROM "SolarCosta_Usuarios" u
 WHERE u.email LIKE '%@solarcosta.com.br'
ON CONFLICT (usuario_id) DO NOTHING;


-- =============================================================================
-- 2. FORNECEDORES  (INITIAL_FORNECEDORES)
-- =============================================================================
INSERT INTO "SolarCosta_Fornecedores" (nome, cnpj, cidade, uf, contato, telefone, prazo_entrega) VALUES
    ('Aldo Solar',    '05.804.313/0001-14', 'Maringá',        'PR', 'Juliana Farias', '(44) 3220-1900', '5 a 8 dias úteis'),
    ('Belenergy',     '11.475.628/0001-77', 'São Paulo',      'SP', 'Marcos Tavares', '(11) 4004-2288', '7 a 12 dias úteis'),
    ('Soline',        '19.392.884/0001-05', 'Betim',          'MG', 'Rafael Nunes',   '(31) 3512-4477', '3 a 5 dias úteis'),
    ('Fortlev Solar', '27.618.940/0001-32', 'Serra',          'ES', 'Camila Souza',   '(27) 3396-8100', '6 a 10 dias úteis'),
    ('Ecori',         '08.997.212/0001-60', 'Contagem',       'MG', 'Diego Prado',    '(31) 3399-7712', '2 a 4 dias úteis')
ON CONFLICT (cnpj) DO NOTHING;


-- =============================================================================
-- 3. PRODUTOS  (INITIAL_PRODUTOS)
--    Entram com estoque 0; o saldo do mock é lançado como movimento de
--    ENTRADA logo abaixo, para que o livro-razão de estoque feche desde o
--    primeiro dia.
-- =============================================================================
INSERT INTO "SolarCosta_Produtos" (codigo, nome, tipo_codigo, fornecedor_id, preco, estoque, unidade, potencia_wp)
SELECT v.codigo, v.nome, v.tipo, f.id, v.preco, 0, v.unidade, v.potencia_wp
  FROM (VALUES
        ('CAB-MC4',  'Conector MC4 – par macho/fêmea',              'cabo',      'Ecori',         18.50,   'par',  NULL::integer),
        ('PRO-DPS',  'DPS CA 275 V 40 kA',                          'protecao',  'Belenergy',     96.00,   'un',   NULL),
        ('EST-PER',  'Perfil de alumínio 4,70 m',                   'estrutura', 'Fortlev Solar', 148.00,  'un',   NULL),
        ('PRO-SBX',  'String box CC 2E/1S 1000 V',                  'protecao',  'Soline',        295.00,  'un',   NULL),
        ('CAB-6MM',  'Cabo solar 6 mm² preto – rolo 100 m',         'cabo',      'Ecori',         385.00,  'rolo', NULL),
        ('MOD-445',  'Painel Trina Vertex S+ 445 Wp',               'modulo',    'Belenergy',     412.00,  'un',   445),
        ('MOD-710',  'Painel TLC Tier 1 710 Wp',                    'modulo',    'Aldo Solar',    640.00,  'un',   710),
        ('INV-SUN2', 'Micro inversor Deye SUN2250',                 'inversor',  'Ecori',         1870.00, 'un',   NULL),
        ('EST-LAJ',  'Estrutura para laje – kit 12 módulos',        'estrutura', 'Fortlev Solar', 1980.00, 'kit',  NULL),
        ('INV-X3M',  'Micro inversor Solax X3-MIC',                 'inversor',  'Soline',        2150.00, 'un',   NULL),
        ('EST-CER',  'Estrutura telha cerâmica – kit 12 módulos',   'estrutura', 'Aldo Solar',    2240.00, 'kit',  NULL),
        ('INV-GW8',  'Inversor Growatt MIN 8000TL-X',               'inversor',  'Aldo Solar',    4380.00, 'un',   NULL)
       ) AS v(codigo, nome, tipo, fornecedor, preco, unidade, potencia_wp)
  JOIN "SolarCosta_Fornecedores" f ON f.nome = v.fornecedor
ON CONFLICT (codigo) DO NOTHING;

-- Saldo inicial de estoque (o trigger atualiza SolarCosta_Produtos.estoque).
INSERT INTO "SolarCosta_MovimentacoesEstoque"
    (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, origem_tipo, observacao)
SELECT p.id, 'entrada', v.qtd, 0, 0, 'ajuste_manual', 'Saldo inicial (carga de dados)'
  FROM (VALUES
        ('CAB-MC4', 320), ('PRO-DPS', 74),  ('EST-PER', 96), ('PRO-SBX', 26),
        ('CAB-6MM', 18),  ('MOD-445', 168), ('MOD-710', 240), ('INV-SUN2', 14),
        ('EST-LAJ', 7),   ('INV-X3M', 22),  ('EST-CER', 5),   ('INV-GW8', 9)
       ) AS v(codigo, qtd)
  JOIN "SolarCosta_Produtos" p ON p.codigo = v.codigo
 WHERE NOT EXISTS (
        SELECT 1 FROM "SolarCosta_MovimentacoesEstoque" m
         WHERE m.produto_id = p.id AND m.observacao = 'Saldo inicial (carga de dados)');


-- =============================================================================
-- 4. LEADS  (INITIAL_LEADS — 13 registros)
-- =============================================================================
INSERT INTO "SolarCosta_Leads"
    (numero, nome, cpf_cnpj, rg_inscricao, telefone, email, cep, endereco, cidade, uf,
     consumo_kwh, concessionaria_id, tipo_telhado_id, origem_id, responsavel_id,
     etapa, valor_estimado, criado_em)
SELECT v.numero, v.nome, v.cpf_cnpj, v.rg, v.telefone, v.email, v.cep, v.endereco, v.cidade, 'MG',
       v.consumo,
       (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = 'CEMIG'),
       (SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = v.telhado),
       (SELECT id FROM "SolarCosta_OrigensLead"     WHERE nome = v.origem),
       (SELECT id FROM "SolarCosta_Usuarios"        WHERE nome = v.responsavel),
       v.etapa::"SolarCosta_EtapaLead", v.valor, v.criado::timestamptz
  FROM (VALUES
    ('#187', 'Vanessa Prado',            '118.445.990-21',     NULL,             '(31) 99182-3344', 'vanessa.prado@hotmail.com',        NULL,        'Alameda dos Ipês, 45 – Vale do Sereno',                                  'Nova Lima',            620.0,  'Colonial',       'Google Ads',       'Rafael Moura',          'Novo lead',        15980.00, '2026-07-29'),
    ('#186', 'Mercearia São Bento',      '24.891.302/0001-88', NULL,             '(31) 3351-9000',  'contato@saobento.com.br',          NULL,        'Av. João César de Oliveira, 1420',                                       'Contagem',             1840.0, 'Metálico',       'Indicação',        'Ana Beatriz Santos',    'Novo lead',        41200.00, '2026-07-28'),
    ('#185', 'Eduardo Camargo',          '087.112.443-10',     NULL,             '(31) 98711-2299', 'eduardo.camargo@gmail.com',        NULL,        'Rua Borba Gato, 90 – Centro',                                            'Sabará',               480.0,  'Colonial',       'Instagram',        'Rafael Moura',          'Novo lead',        12400.00, '2026-07-27'),
    ('#183', 'Luciana Ferraz',           '091.223.881-54',     NULL,             '(31) 99812-7711', 'luciana.ferraz@yahoo.com.br',      NULL,        'Rua Alvarenga Peixoto, 880 – Lourdes',                                   'Belo Horizonte',       740.0,  'Laje',           'Site Solar Costa', 'Ana Beatriz Santos',    'Contato feito',    18600.00, '2026-07-25'),
    ('#182', 'Sítio Boa Vista',          '18.992.331/0001-02', NULL,             '(31) 98451-9922', 'contato@sitioboavista.com.br',     NULL,        'Estrada do Boqueirão, km 4',                                             'Lagoa Santa',          2100.0, 'Solo/Estrutura', 'Indicação',        'Rafael Moura',          'Contato feito',    47300.00, '2026-07-24'),
    ('#181', 'Padaria Trigo de Ouro',    '07.331.229/0001-99', NULL,             '(31) 3532-1100',  'trigodeouro@gmail.com',            NULL,        'Av. Juscelino Kubitschek, 310 – Centro',                                 'Betim',                1560.0, 'Metálico',       'Prospecção Ativa', 'Thiago Gonçalves Leal', 'Visita técnica',   36900.00, '2026-07-20'),
    ('#180', 'Marcos Vinícius Reis',     '055.881.332-19',     NULL,             '(31) 99122-0099', 'marcos.reis@uol.com.br',           NULL,        'Rua Floriano Peixoto, 412 – São João',                                   'Santa Luzia',          890.0,  'Colonial',       'Google Ads',       'Rafael Moura',          'Visita técnica',   21400.00, '2026-07-18'),
    ('#184', 'Cristiano Duarte Almeida', '042.318.776-90',     'MG-14.882.301',  '(31) 99412-7708', 'cristiano.duarte@gmail.com',       '31.530-150','Rua dos Ipês, 512 – Santa Mônica',                                       'Belo Horizonte',       1000.0, 'Laje',           'Indicação',        'Rafael Moura',          'Proposta enviada', 22490.00, '2026-07-08'),
    ('#179', 'Auto Peças Ribeiro',       '14.221.092/0001-33', NULL,             '(31) 3624-8800',  'financeiro@pecasribeiro.com.br',   NULL,        'Av. Denise Cristina, 1200',                                              'Ribeirão das Neves',   2480.0, 'Metálico',       'Prospecção Ativa', 'Ana Beatriz Santos',    'Proposta enviada', 54800.00, '2026-07-05'),
    ('#178', 'Helena Bastos',            '034.992.118-01',     NULL,             '(31) 99778-4433', 'helena.bastos@gmail.com',          NULL,        'Rua das Mangabeiras, 77 – Vila da Serra',                                'Nova Lima',            1320.0, 'Shingle',        'Indicação',        'Rafael Moura',          'Proposta enviada', 31200.00, '2026-07-02'),
    ('#177', 'Clinica Vida Plena',       '33.882.110/0001-66', NULL,             '(31) 3277-5050',  'administracao@vidaplena.med.br',   NULL,        'Av. Afonso Pena, 2500 – Funcionários',                                   'Belo Horizonte',       1750.0, 'Laje',           'Google Ads',       'Ana Beatriz Santos',    'Negociação',       39400.00, '2026-06-28'),
    ('#176', 'Roberto Siqueira',         '066.331.992-44',     NULL,             '(31) 98833-2211', 'roberto.siqueira@bol.com.br',      NULL,        'Rua das Oliveiras, 303 – Eldorado',                                      'Contagem',             1120.0, 'Colonial',       'Instagram',        'Rafael Moura',          'Negociação',       26800.00, '2026-06-25'),
    ('#175', 'Marcelo Ribeiro',          '081.772.331-09',     NULL,             '(31) 99221-5544', 'marcelo.ribeiro@gmail.com',        NULL,        'Rua Ceará, 1100 – Savassi',                                              'Belo Horizonte',       1400.0, 'Laje',           'Indicação',        'Ana Beatriz Santos',    'Fechado',          32900.00, '2026-06-15'),
    ('#174', 'Supermercado Costa Verde', '09.112.449/0001-20', NULL,             '(31) 3594-2200',  'diretoria@costaverde.com.br',      NULL,        'Av. Amazonas, 4500 – Jardim da Cidade',                                  'Betim',                3200.0, 'Metálico',       'Prospecção Ativa', 'Thiago Gonçalves Leal', 'Fechado',          71800.00, '2026-06-10')
  ) AS v(numero, nome, cpf_cnpj, rg, telefone, email, cep, endereco, cidade, consumo, telhado, origem, responsavel, etapa, valor, criado)
ON CONFLICT (numero) DO NOTHING;


-- Timeline dos leads (array `historico` do mock).
INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_id, usuario_nome, ocorrido_em)
SELECT l.id, v.descricao, v.tipo,
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.usuario),
       v.usuario, v.data::timestamptz
  FROM (VALUES
    ('#187', '2026-07-29', 'Lead cadastrado via formulário web',                                    'sistema', 'Sistema'),
    ('#186', '2026-07-28', 'Lead cadastrado por Ana Beatriz',                                       'sistema', 'Ana Beatriz Santos'),
    ('#185', '2026-07-27', 'Solicitação de contato via Instagram',                                  'nota',    'Rafael Moura'),
    ('#183', '2026-07-26', 'Primeiro contato por telefone realizado. Aguardando conta de energia.', 'ligacao', 'Ana Beatriz Santos'),
    ('#182', '2026-07-25', 'Reunião virtual realizada. Visita técnica a agendar.',                  'nota',    'Rafael Moura'),
    ('#181', '2026-07-28', 'Visita técnica agendada para 02/08 com o técnico Thiago.',              'visita',  'Thiago Gonçalves Leal'),
    ('#180', '2026-07-24', 'Vistoria de telhado e padrão de entrada concluída com sucesso.',        'visita',  'Rafael Moura'),
    ('#184', '2026-07-09', 'Primeiro contato por telefone com o cliente',                           'ligacao', 'Rafael Moura'),
    ('#184', '2026-07-12', 'Visita técnica realizada no imóvel de Santa Mônica',                    'visita',  'Thiago Gonçalves Leal'),
    ('#184', '2026-07-28', 'Proposta enviada por WhatsApp nº 2026-0184',                            'whatsapp','Rafael Moura'),
    ('#179', '2026-07-25', 'Proposta enviada por e-mail',                                           'email',   'Ana Beatriz Santos'),
    ('#178', '2026-07-30', 'Proposta enviada hoje',                                                 'email',   'Rafael Moura'),
    ('#177', '2026-07-29', 'Aguardando aprovação do crédito bancário no BV',                        'nota',    'Ana Beatriz Santos'),
    ('#176', '2026-07-27', 'Negociando percentual de entrada e desconto à vista',                   'nota',    'Rafael Moura'),
    ('#175', '2026-07-26', 'Contrato assinado pelo cliente!',                                       'nota',    'Ana Beatriz Santos'),
    ('#174', '2026-07-21', 'Contrato assinado e entrada de R$ 21.540,00 paga.',                     'nota',    'Thiago Gonçalves Leal')
  ) AS v(lead_numero, data, descricao, tipo, usuario)
  JOIN "SolarCosta_Leads" l ON l.numero = v.lead_numero;


-- Documentos do lead #184 (4 arquivos do mock).
INSERT INTO "SolarCosta_LeadDocumentos"
    (lead_id, pasta_id, nome_arquivo, mime_type, extensao, tamanho_bytes, storage_path, enviado_por_id, enviado_em)
SELECT l.id,
       (SELECT id FROM "SolarCosta_PastasDocumento" WHERE nome = 'Documentos pessoais'),
       v.arquivo, 'application/pdf', 'pdf', v.bytes,
       format('leads/%s/%s', l.id, v.arquivo),
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.usuario),
       v.data::timestamptz
  FROM (VALUES
    ('RG-Cristiano-frente-verso.pdf',        1468006, 'Rafael Moura',       '2026-07-22'),
    ('CPF-Cristiano.pdf',                     348160, 'Rafael Moura',       '2026-07-22'),
    ('Comprovante-residencia-junho.pdf',      839680, 'Rafael Moura',       '2026-07-20'),
    ('Certidao-estado-civil.pdf',             624640, 'Ana Beatriz Santos', '2026-07-19')
  ) AS v(arquivo, bytes, usuario, data)
  JOIN "SolarCosta_Leads" l ON l.numero = '#184';


-- =============================================================================
-- 5. PROPOSTA 2026-0184  (INITIAL_PROPOSTA)
-- =============================================================================
INSERT INTO "SolarCosta_Propostas"
    (numero, lead_id, cliente_nome, cpf_cnpj, telefone, email, endereco, cidade,
     concessionaria_id, tipo_telhado_id, consumo_kwh, tarifa_kwh, hsp, perdas_pct, modulo_wp,
     potencia_kwp, modulos_qtd, area_estimada_m2, geracao_media_kwh, cobertura_pct,
     valor_total, economia_mensal, economia_anual, economia_25_anos, payback_anos,
     forma_pagamento, entrada_financiamento_valor, entrada_financiamento_pct,
     parcelas_financiamento, juros_financiamento_mes_pct, banco_financiamento_id,
     status, consultor_id, criado_em, enviada_em)
SELECT '2026-0184', l.id,
       'Cristiano Duarte Almeida', '042.318.776-90', '(31) 99412-7708', 'cristiano.duarte@gmail.com',
       'Rua dos Ipês, 512 – Santa Mônica', 'Belo Horizonte/MG',
       (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = 'CEMIG'),
       (SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = 'Laje'),
       1000, 1.19, 5.2, 24.5, 710,
       8.52, 12, 69.96, 1003, 100.3,
       22490.00, 1194.15, 14329.77, 786196.08, 1.6,
       'financiamento', 2249.00, 10, 60, 1.45,
       (SELECT id FROM "SolarCosta_BancosFinanciamento" WHERE nome = 'BV Financeira – linha solar'),
       'enviada',
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = 'Rafael Moura'),
       '2026-07-08'::timestamptz, '2026-07-28'::timestamptz
  FROM "SolarCosta_Leads" l
 WHERE l.numero = '#184'
ON CONFLICT (numero) DO NOTHING;

-- Itens do kit (o trigger recalcula Propostas.valor_total a partir daqui).
INSERT INTO "SolarCosta_PropostaItens" (proposta_id, produto_id, descricao, qtd, valor_unit, ordem)
SELECT p.id,
       (SELECT id FROM "SolarCosta_Produtos" WHERE codigo = v.codigo),
       v.descricao, v.qtd, v.valor_unit, v.ordem
  FROM (VALUES
    ('MOD-710', 'Painel TLC Tier 1 710 Wp',                       12, 640.00,  1),
    ('INV-X3M', 'Micro inversor Solax X3-MIC',                     3, 2150.00, 2),
    ('EST-LAJ', 'Estrutura para laje – 12 módulos',                1, 1980.00, 3),
    (NULL,      'Material, cabos e conexões',                      1, 1480.00, 4),
    (NULL,      'Instalação, projeto e homologação do SFCR',       1, 4900.00, 5)
  ) AS v(codigo, descricao, qtd, valor_unit, ordem)
  CROSS JOIN "SolarCosta_Propostas" p
 WHERE p.numero = '2026-0184';


-- =============================================================================
-- 6. CONTRATO 2026-0184  (INITIAL_CONTRATO)
-- =============================================================================
INSERT INTO "SolarCosta_Contratos"
    (numero, lead_id, proposta_id, cliente_nome, cpf_cnpj, rg_inscricao, endereco, cep, telefone,
     potencia_kwp, modulos_qtd, modulo_modelo, inversor_modelo, estrutura, prazo_execucao,
     local_instalacao, valor_total, forma_pagamento, entrada, parcelas_info, banco_agente,
     primeiro_vencimento, multa_atraso, foro_eleito,
     garantia_modulos, garantia_inversores, garantia_instalacao, garantia_homologacao,
     responsavel_tecnico_id, responsavel_tecnico, crea, status, data_emissao, criado_por_id)
SELECT '2026-0184', l.id, p.id,
       'Cristiano Duarte Almeida', '042.318.776-90', 'MG-14.882.301',
       'Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG', '31.530-150', '(31) 99412-7708',
       8.52, 12, 'TLC Tier 1 710 Wp', '3x Micro Solax X3-MIC', 'Laje', '45 dias corridos',
       'Rua dos Ipês, 512 – Santa Mônica, Belo Horizonte/MG',
       22490.00, 'Financiamento bancário', 'R$ 2.249,00 (10%)', '60x R$ 486,60',
       'BV Financeira – linha solar', '2026-09-10', '2% + 1% a.m.', 'Belo Horizonte/MG',
       '12 anos (defeito)', '10 anos', '5 anos', 'até 60 dias após vistoria',
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = 'Thiago Gonçalves Leal'),
       'Thiago Gonçalves Leal', 'MG0000023481D',
       'aguardando', '2026-07-30',
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = 'Carlos Eduardo Costa')
  FROM "SolarCosta_Leads" l
  JOIN "SolarCosta_Propostas" p ON p.numero = '2026-0184'
 WHERE l.numero = '#184'
ON CONFLICT (numero) DO NOTHING;

-- Cláusulas do contrato, copiadas da biblioteca padrão.
INSERT INTO "SolarCosta_ContratoClausulas" (contrato_id, ordem, titulo, texto)
SELECT c.id, cp.ordem, cp.titulo, cp.texto
  FROM "SolarCosta_Contratos" c
  CROSS JOIN "SolarCosta_ClausulasPadrao" cp
 WHERE c.numero = '2026-0184' AND cp.padrao
ON CONFLICT (contrato_id, ordem) DO NOTHING;


-- =============================================================================
-- 7. OBRAS  (INITIAL_OBRAS — 5 registros)
-- =============================================================================
INSERT INTO "SolarCosta_Obras"
    (numero, contrato_id, lead_id, proposta_id, cliente_nome, cidade, endereco,
     concessionaria_id, potencia_kwp, modulos_qtd, modulo_modelo, inversor_modelo,
     responsavel_tecnico_id, equipe_instalacao, etapa, status, valor_obra,
     data_inicio, previsao_conclusao, data_conclusao, estoque_baixado, estoque_baixado_em, observacoes)
SELECT v.numero,
       (SELECT id FROM "SolarCosta_Contratos" WHERE numero = v.contrato),
       (SELECT id FROM "SolarCosta_Leads"     WHERE numero = v.lead),
       (SELECT id FROM "SolarCosta_Propostas" WHERE numero = v.proposta),
       v.cliente, v.cidade, v.endereco,
       (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = 'CEMIG'),
       v.kwp, v.modulos, v.modulo, v.inversor,
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.responsavel),
       v.equipe, v.etapa::"SolarCosta_EtapaObra", v.status::"SolarCosta_StatusObra", v.valor,
       v.inicio::date, v.previsao::date, v.conclusao::date,
       v.baixado, CASE WHEN v.baixado THEN v.inicio::timestamptz END, v.obs
  FROM (VALUES
    ('OBRA 0184', '2026-0184', '#184', '2026-0184', 'Cristiano Duarte Almeida', 'Belo Horizonte/MG', 'Rua dos Ipês, 512 – Santa Mônica',      8.52,  12, 'TLC Tier 1 710 Wp',            '3x Micro Solax X3-MIC',        'Thiago Gonçalves Leal', 'Bruno Oliveira',          'Projeto / ART',     'em_andamento', 22490.00, '2026-07-28', '2026-09-10', NULL,         true,  'Projeto elétrico em elaboração. ART a recolher junto ao CREA-MG.'),
    ('OBRA 0181', NULL,        '#174', NULL,        'Supermercado Costa Verde', 'Betim/MG',          'Av. Amazonas, 4500 – Jardim da Cidade', 27.30, 42, 'Trina Vertex S+ 445 Wp',       'Growatt MID 25KTL3-X',         'Thiago Gonçalves Leal', 'Equipe A – Bruno Oliveira','Instalação',        'em_andamento', 71800.00, '2026-07-10', '2026-08-15', NULL,         false, 'Instalação em telhado metálico. 2º dia de montagem das estruturas.'),
    ('OBRA 0179', NULL,        '#175', NULL,        'Marcelo Ribeiro',          'Belo Horizonte/MG', 'Rua Ceará, 1100 – Savassi',             11.90, 20, 'Trina Vertex S+ 445 Wp',       'Growatt MIN 8000TL-X',         'Thiago Gonçalves Leal', 'Equipe A – Bruno Oliveira','Vistoria / troca',  'em_andamento', 32900.00, '2026-06-20', '2026-08-02', NULL,         false, 'Vistoria aprovada. Aguardando troca do medidor bidirecional.'),
    ('OBRA 0176', NULL,        '#176', NULL,        'Roberto Siqueira',         'Contagem/MG',       'Rua das Oliveiras, 303 – Eldorado',      9.35, 16, 'Trina Vertex S+ 445 Wp',       'Solax X3-MIC',                 'Thiago Gonçalves Leal', 'Equipe B – Terceirizada', 'Concluída',         'concluida',    26800.00, '2026-05-15', '2026-06-30', '2026-06-28', false, 'Sistema energizado e gerando. Cliente orientado sobre monitoramento.'),
    ('OBRA 0182', NULL,        '#182', NULL,        'Sítio Boa Vista',          'Lagoa Santa/MG',    'Estrada do Boqueirão, km 4',            17.80, 40, 'TLC Tier 1 710 Wp',            '2x Growatt MIN 8000TL-X',      'Thiago Gonçalves Leal', 'A definir',               'Aguardando compra', 'em_andamento', 47300.00, '2026-07-25', '2026-09-20', NULL,         false, 'Pedido de compra do kit em cotação com fornecedores.')
  ) AS v(numero, contrato, lead, proposta, cliente, cidade, endereco, kwp, modulos, modulo, inversor, responsavel, equipe, etapa, status, valor, inicio, previsao, conclusao, baixado, obs)
ON CONFLICT (numero) DO NOTHING;

-- Checklist de homologação (o trigger de criação automática está desligado
-- durante a carga, então as linhas são inseridas aqui com o progresso real).
INSERT INTO "SolarCosta_ObraHomologacao"
    (obra_id, solicitacao_acesso, parecer_acesso, vistoria_agendada,
     vistoria_aprovada, troca_medidor, relatorio_conexao)
SELECT o.id, v.p1, v.p2, v.p3, v.p4, v.p5, v.p6
  FROM (VALUES
    ('OBRA 0184', true,  false, false, false, false, false),
    ('OBRA 0181', true,  true,  false, false, false, false),
    ('OBRA 0179', true,  true,  true,  true,  false, false),
    ('OBRA 0176', true,  true,  true,  true,  true,  true),
    ('OBRA 0182', false, false, false, false, false, false)
  ) AS v(numero, p1, p2, p3, p4, p5, p6)
  JOIN "SolarCosta_Obras" o ON o.numero = v.numero
ON CONFLICT (obra_id) DO NOTHING;

-- Kit consumido pela OBRA 0184.
-- NOTA: a baixa desta obra é HISTÓRICA (aconteceu antes da existência do banco),
-- por isso `estoque_baixado` já vem true e nenhum movimento é gerado — o saldo
-- inicial carregado no passo 3 já reflete o estoque pós-baixa.
INSERT INTO "SolarCosta_ObraKitItens" (obra_id, produto_id, descricao, qtd, valor_unit, ordem)
SELECT o.id,
       (SELECT id FROM "SolarCosta_Produtos" WHERE codigo = v.codigo),
       v.descricao, v.qtd, v.valor_unit, v.ordem
  FROM (VALUES
    ('MOD-710', 'Painel TLC Tier 1 710 Wp',        12, 640.00,  1),
    ('INV-X3M', 'Micro inversor Solax X3-MIC',      3, 2150.00, 2),
    ('EST-LAJ', 'Estrutura para laje – 12 módulos', 1, 1980.00, 3)
  ) AS v(codigo, descricao, qtd, valor_unit, ordem)
  CROSS JOIN "SolarCosta_Obras" o
 WHERE o.numero = 'OBRA 0184';

-- Histórico das obras (array `historico` do mock).
INSERT INTO "SolarCosta_ObraHistorico" (obra_id, descricao, usuario_id, usuario_nome, ocorrido_em)
SELECT o.id, v.descricao,
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.usuario),
       v.usuario, v.data::timestamptz
  FROM (VALUES
    ('OBRA 0184', '2026-07-28', 'Obra aberta a partir do contrato nº 2026-0184.',              'Ana Beatriz Santos'),
    ('OBRA 0184', '2026-07-29', 'Kit reservado no estoque. Solicitação de acesso à CEMIG.',    'Thiago Gonçalves Leal'),
    ('OBRA 0181', '2026-07-21', 'Parecer de acesso aprovado pela CEMIG.',                      'Thiago Gonçalves Leal'),
    ('OBRA 0181', '2026-07-30', 'Início da instalação física dos módulos.',                    'Bruno Oliveira'),
    ('OBRA 0179', '2026-07-18', 'Instalação concluída e comissionada.',                        'Bruno Oliveira'),
    ('OBRA 0179', '2026-07-26', 'Vistoria da CEMIG aprovada sem pendências.',                  'Thiago Gonçalves Leal'),
    ('OBRA 0176', '2026-06-28', 'Troca de medidor realizada e sistema energizado.',            'Thiago Gonçalves Leal'),
    ('OBRA 0182', '2026-07-25', 'Obra aberta. Kit em processo de cotação.',                    'Ana Beatriz Santos')
  ) AS v(numero, data, descricao, usuario)
  JOIN "SolarCosta_Obras" o ON o.numero = v.numero;


-- =============================================================================
-- 8. FINANCEIRO  (INITIAL_BOLETOS / INITIAL_LANCAMENTOS)
-- =============================================================================
INSERT INTO "SolarCosta_Boletos"
    (numero_documento, linha_digitavel, lead_id, obra_id, fornecedor_id, cliente_nome, cpf_cnpj,
     valor, parcela_numero, parcela_total, parcela_label, vencimento, situacao, tipo,
     categoria_id, data_pagamento, valor_pago)
SELECT v.doc, v.doc,
       (SELECT id FROM "SolarCosta_Leads" WHERE numero = v.lead),
       (SELECT id FROM "SolarCosta_Obras" WHERE numero = v.obra),
       (SELECT id FROM "SolarCosta_Fornecedores" WHERE nome = v.fornecedor),
       v.cliente, v.cpf, v.valor, v.pnum, v.ptot, v.plabel, v.venc::date,
       v.situacao::"SolarCosta_SituacaoBoleto", v.tipo::"SolarCosta_TipoBoleto",
       (SELECT id FROM "SolarCosta_CategoriasFinanceiras" WHERE nome = v.categoria),
       v.pagamento::date,
       CASE WHEN v.pagamento IS NOT NULL THEN v.valor END
  FROM (VALUES
    ('00190.00009 01234.567894 12345.678908 1 95000002249000', '#184', 'OBRA 0184', NULL,           'Cristiano Duarte Almeida',              '042.318.776-90',     2249.00,  1, 60, '1/60 (Entrada)', '2026-08-10', 'em_aberto', 'a_receber', 'Venda de sistema', NULL),
    ('00190.00009 01234.567894 12345.678916 2 95000000486600', '#184', 'OBRA 0184', NULL,           'Cristiano Duarte Almeida',              '042.318.776-90',     486.60,   1, 60, '1/60',           '2026-09-10', 'em_aberto', 'a_receber', 'Venda de sistema', NULL),
    ('00190.00009 01234.567894 12345.678924 3 95000001124500', '#174', 'OBRA 0181', NULL,           'Supermercado Costa Verde',              '09.112.449/0001-20', 21540.00, 1, 3,  '1/3 (Entrada)',  '2026-07-21', 'pago',      'a_receber', 'Venda de sistema', '2026-07-21'),
    ('00190.00009 01234.567894 12345.678932 4 95000000798000', '#175', 'OBRA 0179', NULL,           'Marcelo Ribeiro',                       '081.772.331-09',     7980.00,  3, 4,  '3/4',            '2026-07-26', 'pago',      'a_receber', 'Venda de sistema', '2026-07-26'),
    ('00190.00009 01234.567894 12345.678940 5 95000000822000', '#179', 'OBRA 0179', NULL,           'Auto Peças Ribeiro',                    '14.221.092/0001-33', 8220.00,  1, 1,  '1/1',            '2026-07-15', 'vencido',   'a_receber', 'Venda de sistema', NULL),
    ('00190.00009 01234.567894 12345.678957 6 95000001561000', NULL,   'OBRA 0184', 'Aldo Solar',   'Aldo Solar – NF 44120 (kit obra 0184)', '05.804.313/0001-14', 15610.00, 1, 1,  '1/1',            '2026-07-31', 'em_aberto', 'a_pagar',   'Equipamentos',     NULL)
  ) AS v(doc, lead, obra, fornecedor, cliente, cpf, valor, pnum, ptot, plabel, venc, situacao, tipo, categoria, pagamento);


-- Lançamentos de caixa. No mock as despesas vinham com valor negativo;
-- aqui o valor é sempre positivo e o sinal vem da coluna `tipo`.
INSERT INTO "SolarCosta_LancamentosFinanceiros"
    (data, descricao, categoria_id, obra_id, tipo, valor, conciliado)
SELECT v.data::date, v.descricao,
       (SELECT id FROM "SolarCosta_CategoriasFinanceiras" WHERE nome = v.categoria),
       (SELECT id FROM "SolarCosta_Obras" WHERE numero = v.obra),
       v.tipo::"SolarCosta_TipoLancamento", v.valor, true
  FROM (VALUES
    ('2026-07-28', 'Sinal 50% – obra Cristiano Duarte',            'Venda de sistema', 'OBRA 0184', 'receita', 11245.00),
    ('2026-07-27', 'Compra kit 8,52 kWp – Aldo Solar',             'Equipamentos',     'OBRA 0184', 'despesa', 15610.00),
    ('2026-07-26', 'Parcela 3/4 – obra Marcelo Ribeiro',           'Venda de sistema', 'OBRA 0179', 'receita', 7980.00),
    ('2026-07-24', 'Entrada – Supermercado Costa Verde',           'Venda de sistema', 'OBRA 0181', 'receita', 21540.00),
    ('2026-07-22', 'Equipe de instalação – 2 obras',               'Mão de obra',      NULL,        'despesa', 5400.00),
    ('2026-07-21', 'Combustível e pedágio',                        'Logística',        NULL,        'despesa', 640.00),
    ('2026-07-20', 'Manutenção preventiva – Clínica Vida Plena',   'Serviços',         NULL,        'receita', 1450.00),
    ('2026-07-18', 'Simples Nacional – competência 06/2026',       'Impostos',         NULL,        'despesa', 4180.00),
    ('2026-07-15', 'Tráfego pago – Meta Ads',                      'Marketing',        NULL,        'despesa', 1200.00)
  ) AS v(data, descricao, categoria, obra, tipo, valor);


-- =============================================================================
-- 9. AGENDAMENTOS  (INITIAL_AGENDAMENTOS)
--    ag-102..105 apontavam para leads inexistentes (lead-185..188); aqui
--    lead_id fica NULL e o nome é preservado no snapshot `lead_nome`.
-- =============================================================================
INSERT INTO "SolarCosta_Agendamentos"
    (lead_id, lead_nome, tipo, titulo, data, horario_inicio, horario_fim,
     endereco, cidade, responsavel_id, status, observacoes, criado_em)
SELECT (SELECT id FROM "SolarCosta_Leads" WHERE numero = v.lead),
       v.lead_nome, v.tipo::"SolarCosta_TipoAgendamento", v.titulo,
       v.data::date, v.inicio::time, v.fim::time, v.endereco, v.cidade,
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.responsavel),
       'agendado', v.obs, v.criado::timestamptz
  FROM (VALUES
    ('#184', 'Cristiano Duarte Almeida',       'visita_tecnica', 'Vistoria Técnica de Dimensionamento e Telhado',    '2026-07-31', '09:00', '10:30', 'Rua das Palmeiras, 450, Savassi',        'Belo Horizonte', 'Thiago Gonçalves Leal', 'Avaliar inclinação do telhado colonial, espaço para inversor e quadro elétrico padrão 220V.', '2026-07-28'),
    (NULL,   'Maria Oliveira',                 'reuniao',        'Apresentação Comercial e Fechamento da Proposta',  '2026-07-31', '14:30', '15:30', 'Av. Afonso Pena, 1200 - Centro',         'Belo Horizonte', 'Rafael Moura',          'Apresentar simulação de financiamento pelo Banco do Brasil com carência de 90 dias.',         '2026-07-29'),
    (NULL,   'Roberto Ferreira',               'visita_tecnica', 'Análise de Sombreamento e Padrão da CEMIG',        '2026-08-01', '10:00', '11:30', 'Rua Paraíba, 880, Funcionários',         'Belo Horizonte', 'Thiago Gonçalves Leal', 'Verificar transformador da rua e fiação trifásica.',                                          '2026-07-30'),
    (NULL,   'Luciana Duarte',                 'reuniao',        'Reunião de Alinhamento do Contrato Solar',         '2026-08-03', '11:00', '12:00', 'Rua Cláudio Manoel, 320, Lourdinho',     'Nova Lima',      'Carlos Eduardo Costa',  'Discutir cronograma de homologação e entrega dos módulos Jinko.',                             '2026-07-30'),
    (NULL,   'Padaria e Confeitaria Central',  'vistoria',       'Vistoria Pré-Instalação dos Inversores Growatt',   '2026-08-05', '08:30', '10:00', 'Rua Principal, 50, Centro',              'Contagem',       'Bruno Oliveira',        'Instalação comercial de grande porte (25 kWp). Checar estrutura metálica.',                   '2026-07-31')
  ) AS v(lead, lead_nome, tipo, titulo, data, inicio, fim, endereco, cidade, responsavel, obs, criado);


-- =============================================================================
-- 10. AUDITORIA  (INITIAL_AUDIT de services/audit.ts)
-- =============================================================================
-- Nota: o Postgres não aceita sub-SELECT dentro de uma lista VALUES usada em
-- FROM. As referências vão como chave textual e são resolvidas no SELECT.
INSERT INTO "SolarCosta_Auditoria"
    (ocorrido_em, usuario_id, usuario_nome, acao, entidade, entidade_id, alvo, detalhes)
SELECT v.ts::timestamptz,
       (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = v.usuario),
       v.usuario,
       v.acao::"SolarCosta_AcaoAuditoria",
       v.entidade::"SolarCosta_EntidadeAuditoria",
       CASE v.entidade
         WHEN 'Proposta' THEN (SELECT id FROM "SolarCosta_Propostas" WHERE numero        = v.ref)
         WHEN 'Contrato' THEN (SELECT id FROM "SolarCosta_Contratos" WHERE numero        = v.ref)
         WHEN 'Boleto'   THEN (SELECT id FROM "SolarCosta_Boletos"   WHERE parcela_label = v.ref)
         WHEN 'Lead'     THEN (SELECT id FROM "SolarCosta_Leads"     WHERE numero        = v.ref)
       END,
       v.alvo, v.detalhes
  FROM (VALUES
    ('2026-07-30 18:12', 'Rafael Moura',          'editar',        'Proposta', '2026-0184', 'Proposta 2026-0184 — Cristiano Duarte Almeida', 'Status alterado para "enviada".'),
    ('2026-07-30 09:40', 'Carlos Eduardo Costa',  'criar',         'Contrato', '2026-0184', 'Contrato 2026-0184 — Cristiano Duarte Almeida', NULL),
    ('2026-07-26 14:05', 'Ana Beatriz Santos',    'baixa',         'Boleto',   '3/4',       'Boleto 3/4 — Marcelo Ribeiro',                  'Baixa registrada (R$ 7.980,00).'),
    ('2026-07-21 11:20', 'Thiago Gonçalves Leal', 'mudanca_etapa', 'Lead',     '#174',      'Supermercado Costa Verde',                      'Negociação → Fechado.')
  ) AS v(ts, usuario, acao, entidade, ref, alvo, detalhes);


-- Religa os triggers desativados no início da carga.
ALTER TABLE "SolarCosta_Leads" ENABLE TRIGGER "SolarCosta_tg_lead_historico_inicial";
ALTER TABLE "SolarCosta_Obras" ENABLE TRIGGER "SolarCosta_tg_obra_cria_homologacao";

COMMIT;

-- =============================================================================
-- VERIFICAÇÃO PÓS-CARGA
-- =============================================================================
-- SELECT 'Usuários', count(*) FROM "SolarCosta_Usuarios"
-- UNION ALL SELECT 'Leads',        count(*) FROM "SolarCosta_Leads"
-- UNION ALL SELECT 'Fornecedores', count(*) FROM "SolarCosta_Fornecedores"
-- UNION ALL SELECT 'Produtos',     count(*) FROM "SolarCosta_Produtos"
-- UNION ALL SELECT 'Propostas',    count(*) FROM "SolarCosta_Propostas"
-- UNION ALL SELECT 'Contratos',    count(*) FROM "SolarCosta_Contratos"
-- UNION ALL SELECT 'Obras',        count(*) FROM "SolarCosta_Obras"
-- UNION ALL SELECT 'Boletos',      count(*) FROM "SolarCosta_Boletos"
-- UNION ALL SELECT 'Lançamentos',  count(*) FROM "SolarCosta_LancamentosFinanceiros"
-- UNION ALL SELECT 'Agendamentos', count(*) FROM "SolarCosta_Agendamentos";
