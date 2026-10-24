-- =============================================================================
--  SOLAR COSTA · V024 — contrato no modelo oficial da Solar Costa
--
--  O contrato impresso pelo CRM era um esboço de duas seções (partes e objeto)
--  com razão social, CNPJ e endereço escritos no PDFModal. O documento que a
--  empresa de fato assina ("Modelo contrato Solar Costa.docx") tem preâmbulo
--  com representante legal, dez cláusulas, tabela de garantias, testemunhas e o
--  Anexo I de equipamentos — e quase todo número dele (prazos, multas, juros,
--  garantias) muda de um contrato para outro.
--
--  Três mudanças:
--
--  1. "SolarCosta_Empresa" ganha o REPRESENTANTE LEGAL. Não é o responsável
--     técnico (o engenheiro do CREA): é quem assina pela empresa. O UPDATE
--     abaixo preenche com os dados do modelo só o que estiver vazio, e troca
--     razão social/CNPJ/CEP só se ainda forem os do seed S001 — que vieram de
--     um literal do mock, não do contrato social. Quem já editou o cadastro
--     não é sobrescrito.
--
--  2. "SolarCosta_Contratos" ganha duas cópias congeladas, em jsonb:
--       contratada — empresa + representante no momento da emissão. Editar o
--                    cadastro depois não reescreve contrato já emitido, pelo
--                    mesmo motivo de responsavel_tecnico/crea (V017).
--       termos     — os dados variáveis do modelo (prazos, percentuais,
--                    garantias, testemunhas, Anexo I) e os textos de cláusula
--                    personalizados naquele contrato. É jsonb, e não trinta
--                    colunas, porque o formato acompanha o texto do modelo
--                    (modelo_versao) e é validado inteiro pelo zod da rota.
--     modelo_versao NULL marca o contrato LEGADO: o front continua imprimindo
--     o layout antigo para ele quando já está assinado, para não mudar um
--     documento que o cliente assinou.
--
--  3. "SolarCosta_Parametros" ganha os padrões do modelo no grupo 'contrato'.
--     Entram aqui, e não no seed, porque o seed não roda no deploy e o
--     PATCH /api/config/parametros só altera chave que já existe. As chaves
--     antigas (contrato.garantia_modulos etc.) ficam como estão.
--
--  Toca só tabelas da V001, de posse do solarcosta_migrator — nenhuma das
--  tabelas da V009 (dono `postgres`). Não cria tabela nem usa ALTER TYPE, então
--  `npm run migrate` dá conta sozinho. Em homologação, se aplicada à mão pelo
--  DBeaver, registrar depois:
--      INSERT INTO "SolarCosta_SchemaMigrations" (versao)
--      VALUES ('V024__contrato_modelo_solar_costa.sql');
-- =============================================================================

BEGIN;

-- ------------------------------------------------- 1. REPRESENTANTE LEGAL ---

ALTER TABLE "SolarCosta_Empresa"
    ADD COLUMN IF NOT EXISTS representante_nome          text,
    ADD COLUMN IF NOT EXISTS representante_nacionalidade text,
    ADD COLUMN IF NOT EXISTS representante_rg            text,
    ADD COLUMN IF NOT EXISTS representante_cpf           text;

COMMENT ON COLUMN "SolarCosta_Empresa".representante_nome IS
    'Quem assina o contrato pela empresa. Não confundir com responsavel_tecnico (engenheiro do CREA).';

UPDATE "SolarCosta_Empresa" SET
    representante_nome          = COALESCE(representante_nome, 'Giselle Alonso Costa'),
    representante_nacionalidade = COALESCE(representante_nacionalidade, 'brasileira'),
    representante_rg            = COALESCE(representante_rg, 'MG10513845'),
    representante_cpf           = COALESCE(representante_cpf, '012.091.516-26'),
    telefone                    = COALESCE(telefone, '(31) 98658-8456')
 WHERE registro_unico;

-- Só troca o que ainda é o literal do seed S001.
UPDATE "SolarCosta_Empresa" SET
    razao_social = 'SOLAR COSTA LTDA',
    cnpj         = '43.630.879/0001-68',
    cep          = COALESCE(NULLIF(cep, ''), '31.530-150')
 WHERE registro_unico
   AND cnpj = '42.890.112/0001-90';


-- ------------------------------------------------------- 2. CONTRATOS ---

ALTER TABLE "SolarCosta_Contratos"
    ADD COLUMN IF NOT EXISTS modelo_versao smallint,
    ADD COLUMN IF NOT EXISTS contratada    jsonb,
    ADD COLUMN IF NOT EXISTS termos        jsonb;

COMMENT ON COLUMN "SolarCosta_Contratos".modelo_versao IS
    'Versão do texto do modelo (src/contrato/modeloSolarCosta.ts). NULL = contrato legado, anterior à V024.';
COMMENT ON COLUMN "SolarCosta_Contratos".contratada IS
    'Cópia de "SolarCosta_Empresa" + representante legal no momento da emissão.';
COMMENT ON COLUMN "SolarCosta_Contratos".termos IS
    'Dados variáveis do modelo (prazos, percentuais, garantias, testemunhas, Anexo I) e textos de cláusula personalizados.';


-- ------------------------------------------------------ 3. PARÂMETROS ---

INSERT INTO "SolarCosta_Parametros" (chave, valor, tipo, grupo, descricao) VALUES
    ('contrato.prazo_despacho_dias',                  '30',   'numero',     'contrato', 'Prazo de despacho do sistema pelo fornecedor (dias) — cláusula 2.3'),
    ('contrato.prazo_execucao_dias',                  '45',   'numero',     'contrato', 'Prazo total de entrega dos serviços (dias corridos) — cláusula 2.4'),
    ('contrato.juros_mora_mes_pct',                   '1',    'percentual', 'contrato', 'Juros de mora ao mês — cláusula 3.3'),
    ('contrato.multa_moratoria_pct',                  '5',    'percentual', 'contrato', 'Multa moratória sobre o saldo — cláusula 3.3'),
    ('contrato.garantia_legal_dias',                  '90',   'numero',     'contrato', 'Garantia legal prestada pela Solar Costa (dias) — cláusula 7.3'),
    ('contrato.forca_maior_dias',                     '60',   'numero',     'contrato', 'Caso fortuito/força maior que permite rescisão (dias) — cláusula 9.1 a'),
    ('contrato.prazo_cura_dias',                      '15',   'numero',     'contrato', 'Prazo para sanar descumprimento após notificação (dias) — cláusula 9.1 b'),
    ('contrato.multa_rescisoria_contratante_pct',     '15',   'percentual', 'contrato', 'Multa se o contratante desistir antes da entrega — cláusula 9.2'),
    ('contrato.multa_rescisoria_contratada_pct',      '15',   'percentual', 'contrato', 'Multa se a Solar Costa descumprir o prazo — cláusula 9.2.1'),
    ('contrato.prazo_pagamento_estruturas_dias_uteis','5',    'numero',     'contrato', 'Prazo para pagar estruturas específicas na rescisão (dias úteis) — cláusula 9.3'),
    ('contrato.numero_vias',                          '2',    'numero',     'contrato', 'Número de vias do contrato'),
    ('contrato.concessionaria',                       'Cemig','texto',      'contrato', 'Concessionária citada na cláusula 9.4'),
    ('contrato.garantias',
     '[{"equipamento":"Módulos","prazo":"15 anos","causa":"Defeitos de fabricação"},'
     '{"equipamento":"Módulos","prazo":"20 anos","causa":"Performance"},'
     '{"equipamento":"Inversor","prazo":"12 anos","causa":"Defeito de fabricação"},'
     '{"equipamento":"Instalação","prazo":"1 ano","causa":"Defeito de instalação e desconformidade com o projeto"}]',
     'json', 'contrato', 'Tabela de garantias dos fornecedores — cláusula 7.2')
ON CONFLICT (chave) DO NOTHING;

COMMIT;
