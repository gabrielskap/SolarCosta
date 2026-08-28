-- =============================================================================
--  SOLAR COSTA · S001 — Configuração base (OBRIGATÓRIO em qualquer ambiente)
--
--  Tudo aqui era literal no código-fonte. Cada bloco cita a origem.
--  Idempotente: pode ser reexecutado (ON CONFLICT DO NOTHING/UPDATE).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EMPRESA  (origem: src/components/PDFModal.tsx, linhas 300 e 677)
-- =============================================================================
INSERT INTO "SolarCosta_Empresa"
    (razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, uf, cep,
     email, responsavel_tecnico, crea, foro_padrao)
VALUES
    ('SOLAR COSTA ENERGIA SOLAR LTDA',
     'Solar Costa Energia',
     '42.890.112/0001-90',
     'Rua Alzira Maria Ferreira, 241',
     'Santa Mônica',
     'Belo Horizonte',
     'MG',
     '31.530-150',
     'solarcostamg@gmail.com',
     'Thiago Gonçalves Leal',
     'MG0000023481D',
     'Belo Horizonte/MG')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 2. PARÂMETROS DO SISTEMA
--    Números mágicos que hoje estão espalhados por 6 componentes React.
-- =============================================================================
INSERT INTO "SolarCosta_Parametros" (chave, valor, tipo, grupo, descricao) VALUES
    -- Dimensionamento (ProposalCalculatorView.tsx, linhas 63-67 e 103-107)
    ('proposta.tarifa_kwh_padrao',        '1.19',    'numero',     'dimensionamento', 'Tarifa R$/kWh sugerida no cálculo'),
    ('proposta.hsp_padrao',               '5.2',     'numero',     'dimensionamento', 'Horas de sol pleno padrão'),
    ('proposta.perdas_pct_padrao',        '24.5',    'percentual', 'dimensionamento', 'Perdas do sistema (%)'),
    ('proposta.modulo_wp_padrao',         '710',     'numero',     'dimensionamento', 'Potência do módulo padrão (Wp)'),
    ('proposta.area_por_modulo_m2',       '5.805',   'numero',     'dimensionamento', 'Área por módulo (2,58 x 2,25 m)'),
    ('proposta.reajuste_tarifario_pct',   '6',       'percentual', 'dimensionamento', 'Reajuste anual da tarifa na projeção de 25 anos'),
    ('proposta.horizonte_anos',           '25',      'numero',     'dimensionamento', 'Horizonte da projeção de economia'),

    -- Condições comerciais (ProposalCalculatorView.tsx, linhas 80-88)
    ('proposta.validade_dias',            '10',      'numero',     'comercial', 'Validade padrão da proposta'),
    ('proposta.desconto_avista_pct',      '7',       'percentual', 'comercial', 'Desconto padrão à vista'),
    ('proposta.parcelas_cartao_padrao',   '12',      'numero',     'comercial', 'Parcelas padrão no cartão'),
    ('proposta.taxa_cartao_pct',          '4.5',     'percentual', 'comercial', 'Taxa da maquininha'),
    ('financiamento.entrada_pct_padrao',  '10',      'percentual', 'comercial', 'Entrada padrão no financiamento'),
    ('financiamento.parcelas_padrao',     '60',      'numero',     'comercial', 'Parcelas padrão no financiamento'),
    ('financiamento.juros_mes_pct',       '1.45',    'percentual', 'comercial', 'Juros ao mês padrão'),

    -- Contrato (ContractsView.tsx, linhas 38-55)
    ('contrato.prazo_execucao',           '45 dias corridos',            'texto', 'contrato', 'Prazo de execução padrão'),
    ('contrato.multa_atraso',             '2% + 1% a.m.',                'texto', 'contrato', 'Multa por atraso'),
    ('contrato.garantia_modulos',         '12 anos (defeito)',           'texto', 'contrato', 'Garantia dos módulos'),
    ('contrato.garantia_inversores',      '10 anos',                     'texto', 'contrato', 'Garantia dos inversores'),
    ('contrato.garantia_instalacao',      '5 anos',                      'texto', 'contrato', 'Garantia da instalação'),
    ('contrato.garantia_homologacao',     'até 60 dias após vistoria',   'texto', 'contrato', 'Prazo de homologação'),

    -- Operação
    ('meta.faturamento_anual',            '1200000', 'moeda',      'metas',     'Meta anual (DashboardView.tsx, linha 504)'),
    ('lead.dias_sem_contato',             '7',       'numero',     'alertas',   'Limiar do alerta (utils/notifications.ts, SEM_CONTATO_DIAS)'),
    ('estoque.critico',                   '10',      'numero',     'alertas',   'ESTOQUE_CRITICO de SuppliersProductsView.tsx'),
    ('estoque.baixo',                     '25',      'numero',     'alertas',   'ESTOQUE_BAIXO de SuppliersProductsView.tsx'),
    ('auditoria.retencao_dias',           '730',     'numero',     'sistema',   'Retenção da trilha de auditoria'),
    ('consultor.email_padrao',            'solarcostamg@gmail.com', 'texto', 'sistema', 'E-mail exibido no rodapé da proposta')
ON CONFLICT (chave) DO UPDATE
    SET descricao = EXCLUDED.descricao, tipo = EXCLUDED.tipo, grupo = EXCLUDED.grupo;


-- =============================================================================
-- 3. SEQUÊNCIAS DE NUMERAÇÃO
--    Continuam de onde os dados atuais pararam (#187, 2026-0184, OBRA 0184).
-- =============================================================================
INSERT INTO "SolarCosta_Sequencias" (chave, prefixo, usa_ano, ano, ultimo_numero, largura) VALUES
    ('lead',     '#',      false, NULL, 187, 3),
    ('proposta', '',       true,  2026, 184, 4),
    ('contrato', '',       true,  2026, 184, 4),
    ('obra',     'OBRA ',  false, NULL, 184, 4)
ON CONFLICT (chave) DO NOTHING;


-- =============================================================================
-- 4. CONCESSIONÁRIAS  (origem: valor fixo 'CEMIG' em todo o front)
-- =============================================================================
INSERT INTO "SolarCosta_Concessionarias" (nome, uf, tarifa_kwh, custo_disponibilidade, hsp_media, ordem) VALUES
    ('CEMIG',      'MG', 1.1900, 33.73, 5.20, 1),
    ('Light',      'RJ', 1.0500, 33.73, 4.80, 2),
    ('Enel SP',    'SP', 0.9800, 33.73, 4.90, 3),
    ('Neoenergia', 'BA', 1.0200, 33.73, 5.40, 4)
ON CONFLICT (nome) DO NOTHING;

-- Sazonalidade de geração (PDFModal.tsx, array monthlyData da linha 226).
-- Fatores = geração do mês / média anual (1.000 kWh).
INSERT INTO "SolarCosta_PerfilGeracaoMensal" (concessionaria_id, mes, fator)
SELECT c.id, m.mes, m.fator
  FROM "SolarCosta_Concessionarias" c
  CROSS JOIN (VALUES
        (1,  1.03713), (2,  1.03713), (3,  1.03713), (4,  1.03713),
        (5,  1.01793), (6,  0.99488), (7,  0.94110), (8,  0.94110),
        (9,  0.94110), (10, 1.01793), (11, 0.99872), (12, 0.99872)
     ) AS m(mes, fator)
 WHERE c.nome = 'CEMIG'
ON CONFLICT (concessionaria_id, mes) DO NOTHING;


-- =============================================================================
-- 5. DOMÍNIOS DE CADASTRO
-- =============================================================================

-- Origem do lead (LeadsKanbanView.tsx, linhas 372-376)
INSERT INTO "SolarCosta_OrigensLead" (nome, ordem) VALUES
    ('Google Ads', 1), ('Indicação', 2), ('Instagram', 3),
    ('Prospecção Ativa', 4), ('Site Solar Costa', 5), ('WhatsApp', 6)
ON CONFLICT (nome) DO NOTHING;

-- Tipo de telhado (LeadsKanbanView.tsx, linhas 614-618 + 'Shingle' usado no mock)
INSERT INTO "SolarCosta_TiposTelhado" (nome, fator_area, ordem) VALUES
    ('Colonial', 1.10, 1), ('Laje', 1.00, 2), ('Metálico', 1.00, 3),
    ('Fibrocimento', 1.05, 4), ('Solo/Estrutura', 1.30, 5), ('Shingle', 1.10, 6)
ON CONFLICT (nome) DO NOTHING;

-- Tipo de produto: unifica o slug do formulário com o rótulo do mock.
-- (types.ts tinha AMBOS na mesma union type — 'modulo' e 'Módulo fotovoltaico'.)
INSERT INTO "SolarCosta_TiposProduto" (codigo, label, ordem) VALUES
    ('modulo',    'Módulo fotovoltaico', 1),
    ('inversor',  'Inversor',            2),
    ('estrutura', 'Estrutura',           3),
    ('cabo',      'Cabeamento',          4),
    ('protecao',  'Proteção',            5),
    ('acessorio', 'Acessório',           6),
    ('outro',     'Outro',               7)
ON CONFLICT (codigo) DO UPDATE SET label = EXCLUDED.label;

-- Categorias financeiras (FinancialView.tsx, linhas 786-791 + mock de lançamentos)
INSERT INTO "SolarCosta_CategoriasFinanceiras" (nome, escopo, ordem) VALUES
    ('Venda de sistema', 'receita', 1),
    ('Serviços',         'receita', 2),
    ('Equipamentos',     'despesa', 3),
    ('Mão de obra',      'despesa', 4),
    ('Logística',        'despesa', 5),
    ('Impostos',         'despesa', 6),
    ('Marketing',        'despesa', 7),
    ('Outros',           'ambos',   8)
ON CONFLICT (nome) DO NOTHING;

-- Pastas de documentos (LeadDetailView.tsx, folderNames da linha 48)
INSERT INTO "SolarCosta_PastasDocumento" (nome, ordem) VALUES
    ('Documentos pessoais', 1), ('Conta de energia', 2), ('Proposta assinada', 3),
    ('Contrato', 4), ('Projeto e ART', 5), ('Fotos do local / telhado', 6),
    ('Financiamento / banco', 7)
ON CONFLICT (nome) DO NOTHING;

-- Bancos / linhas de financiamento
INSERT INTO "SolarCosta_BancosFinanciamento" (nome, juros_mes_padrao, parcelas_max, entrada_min_pct) VALUES
    ('BV Financeira – linha solar', 1.450, 72, 10.00),
    ('Banco do Brasil',             1.390, 60,  0.00),
    ('Santander',                   1.520, 60, 10.00),
    ('Sicoob',                      1.350, 60,  5.00),
    ('Solfácil',                    1.490, 72,  0.00)
ON CONFLICT (nome) DO NOTHING;


-- =============================================================================
-- 6. TEXTOS PADRÃO
-- =============================================================================

-- Presets de observação (PDFModal.tsx, observationPresets da linha 58)
INSERT INTO "SolarCosta_ObservacaoPresets" (contexto, label, texto, ordem) VALUES
    ('proposta', '📌 Validade 10 dias',
     '📍 Proposta comercial válida por 10 dias corridos a partir desta data.', 1),
    ('proposta', '⚡ Homologação CEMIG',
     '⚡ Incluso elaboração do projeto elétrico, emissão de ART/CREA e trâmite completo de homologação na CEMIG.', 2),
    ('proposta', '🏠 Telhado Colonial',
     '🏠 Estrutura de fixação em alumínio anodizado e aço inox própria para telhado colonial.', 3),
    ('proposta', '💳 Desconto PIX 5%',
     '💳 Desconto especial de 5% concedido para pagamento à vista via PIX ou Transferência Bancária.', 4),
    ('proposta', '📱 Monitoramento App',
     '📱 Inversor/Microinversor com conectividade Wi-Fi para acompanhamento da geração em tempo real via celular.', 5),
    ('proposta', '🛡️ Garantias Oficiais',
     '🛡️ 25 anos de garantia de eficiência dos módulos, 12 anos para inversores e 1 ano para os serviços de instalação.', 6)
ON CONFLICT (contexto, label) DO UPDATE SET texto = EXCLUDED.texto;

-- Cláusulas padrão do contrato (ContractsView.tsx, linha 60)
INSERT INTO "SolarCosta_ClausulasPadrao" (titulo, padrao, ordem) VALUES
    ('Objeto e escopo do fornecimento',                     true, 1),
    ('Preço, forma de pagamento e reajuste',                true, 2),
    ('Prazos de entrega, instalação e homologação',         true, 3),
    ('Obrigações do contratante e do contratado',           true, 4),
    ('Exclusões de escopo (obra civil, padrão de entrada)', true, 5),
    ('Garantias e assistência técnica',                     true, 6),
    ('Cessão de crédito ao agente financeiro',              true, 7),
    ('Rescisão, multas e foro',                             true, 8)
ON CONFLICT (titulo) DO NOTHING;


-- =============================================================================
-- 7. USUÁRIO ADMINISTRADOR DE BOOTSTRAP
--
--  ATENÇÃO: a senha abaixo é TEMPORÁRIA e deve ser trocada no primeiro acesso.
--  O hash é bcrypt (custo 12) gerado pelo próprio Postgres via pgcrypto, e é
--  compatível com bcrypt/bcryptjs no Node.
--  Em produção, prefira criar o admin pelo endpoint da API e NÃO rodar este
--  bloco — ou troque a senha imediatamente após o primeiro login.
-- =============================================================================
INSERT INTO "SolarCosta_Usuarios" (nome, email, senha_hash, cargo, status, crea)
VALUES ('Administrador Solar Costa',
        'admin@solarcosta.com.br',
        crypt('TrocarEsta@2026', gen_salt('bf', 12)),
        'Administrador',
        'ativo',
        NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "SolarCosta_UsuarioPermissoes"
    (usuario_id, criar_editar_leads, emitir_propostas, anexar_documentos, emitir_contratos,
     ver_lancamentos_financeiro, gerenciar_usuarios, gerenciar_obras, ver_auditoria)
SELECT id, true, true, true, true, true, true, true, true
  FROM "SolarCosta_Usuarios"
 WHERE email = 'admin@solarcosta.com.br'
ON CONFLICT (usuario_id) DO NOTHING;

COMMIT;
