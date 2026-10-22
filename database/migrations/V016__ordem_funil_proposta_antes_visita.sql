-- =============================================================================
--  SOLAR COSTA · V016 — "Proposta enviada" passa a vir antes de "Visita técnica"
--
--  A ordem do funil mudou no comercial: o orçamento sai da conta de luz e a
--  visita técnica só é agendada depois que o cliente reage à proposta. Mandar
--  técnico antes de ter proposta na mesa é deslocar gente para quem talvez nem
--  responda. O kanban de Leads, o funil do Dashboard e o relatório de funil já
--  foram reordenados no front (STAGES em src/components/LeadsKanbanView.tsx);
--  esta migration acerta o único lugar do banco que também declara a sequência.
--
--  O que NÃO muda: o enum "SolarCosta_EtapaLead" da V001 continua com os
--  rótulos na ordem antiga de declaração. Reordenar um enum no Postgres exige
--  recriar o tipo e reescrever toda coluna que o usa, e aqui isso não compraria
--  nada — nenhuma consulta do sistema faz ORDER BY etapa nem MIN/MAX sobre o
--  enum. A ordem do funil é dada pela coluna `ordem` desta view, e é ela que a
--  /api/painel devolve. Os rótulos são os mesmos seis de sempre, então nenhum
--  dado de lead precisa ser tocado: nada é migrado, nada é reescrito.
--
--  CREATE OR REPLACE VIEW mantém nome, tipo e ordem das colunas (etapa, ordem,
--  quantidade, valor) — só os números do VALUES mudam, que é o que o Postgres
--  exige para substituir uma view no lugar.
--
--  Toca APENAS a view criada pela V004, portanto já de posse do
--  solarcosta_migrator — a V009 criou objetos cujo dono ficou `postgres` e
--  qualquer migration que os alcance derruba o deploy. Não cria tabela nova e
--  não usa ALTER TYPE, então `npm run migrate` dá conta sozinho.
--
--  APLICANDO À MÃO NO DBEAVER (homologação): o runner não viu nada, então o
--  registro é seu. Sem esta linha o próximo deploy tenta aplicar de novo:
--
--    INSERT INTO "SolarCosta_SchemaMigrations" (versao)
--    VALUES ('V016__ordem_funil_proposta_antes_visita.sql');
--
--  O arquivo é re-executável de ponta a ponta — rodar duas vezes não quebra e
--  não duplica nada.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW "SolarCosta_vw_FunilLeads" AS
SELECT
    e.etapa,
    e.ordem,
    count(l.id)                          AS quantidade,
    COALESCE(SUM(l.valor_estimado), 0)   AS valor
FROM (VALUES
        ('Novo lead'::"SolarCosta_EtapaLead",       1),
        ('Contato feito',                           2),
        ('Proposta enviada',                        3),
        ('Visita técnica',                          4),
        ('Negociação',                              5),
        ('Fechado',                                 6)
     ) AS e(etapa, ordem)
LEFT JOIN "SolarCosta_Leads" l
       ON l.etapa = e.etapa AND l.excluido_em IS NULL
GROUP BY e.etapa, e.ordem
ORDER BY e.ordem;

COMMENT ON VIEW "SolarCosta_vw_FunilLeads" IS
    'Funil de leads. A coluna `ordem` é a sequência real das etapas e precisa '
    'bater com STAGES em src/components/LeadsKanbanView.tsx — desde a V016, '
    '"Proposta enviada" (3) vem antes de "Visita técnica" (4). A ordem de '
    'declaração do enum SolarCosta_EtapaLead (V001) é a antiga e não serve '
    'para ordenar nada.';

COMMIT;
