-- Tipos usados pela API devem existir mesmo sem executar os seeds manuais.
INSERT INTO "SolarCosta_TiposProduto" (codigo, label, ordem) VALUES
    ('modulo', 'Módulo fotovoltaico', 1),
    ('inversor', 'Inversor', 2),
    ('estrutura', 'Estrutura', 3),
    ('cabo', 'Cabeamento', 4),
    ('protecao', 'Proteção', 5),
    ('acessorio', 'Acessório', 6),
    ('outro', 'Outro', 7)
ON CONFLICT (codigo) DO NOTHING;
