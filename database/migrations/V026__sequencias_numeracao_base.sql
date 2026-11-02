-- =============================================================================
--  SOLAR COSTA · V026 — garante as linhas de "SolarCosta_Sequencias"
--
--  SINTOMA: em produção, cadastrar lead devolvia 422 com
--      Sequencia "lead" nao cadastrada em SolarCosta_Sequencias
--
--  CAUSA: nenhuma rota informa `numero`. Quem preenche é o gatilho
--  "SolarCosta_tg_numero_Leads" (V003), que chama
--  "SolarCosta_fn_proximo_numero"('lead') — e essa função faz RAISE EXCEPTION
--  quando não acha a linha da chave. As linhas vinham do S001, que é passo
--  MANUAL (database/README.md) e, nessa instalação, nunca rodou por inteiro.
--  Resultado: toda tabela com numeração automática ficava impossível de
--  inserir, e o erro só aparecia no primeiro cadastro real.
--
--  Numeração não é dado de demonstração — é infraestrutura da tabela, do mesmo
--  jeito que o gatilho que a consome. Por isso ela passa a vir pela migration,
--  como a chave 'kit' já vinha desde a V018. O S001 continua existindo para a
--  instalação do zero; aqui o ON CONFLICT o torna inofensivo nas duas ordens.
--
--  O `ultimo_numero` NÃO é fixo: `numero` é UNIQUE nas quatro tabelas, então
--  semear 0 onde já existem registros faria o próximo INSERT colidir com um
--  número já gravado. Cada chave parte do maior número que a tabela realmente
--  tem — e a mesma conta corrige, de quebra, a linha que exista mas esteja
--  atrasada em relação aos dados (schema montado à mão, carga direta no banco).
--
--  Só DML sobre "SolarCosta_Sequencias": nada de COMMENT ou ALTER, que exigem
--  propriedade e derrubariam o deploy onde as tabelas são de outro papel
--  (ver a nota da V025).
-- =============================================================================

BEGIN;

DO $do$
DECLARE
    v_ano   integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    s       record;
    r       "SolarCosta_Sequencias"%ROWTYPE;
    v_max   integer;
BEGIN
    FOR s IN
        -- prefixo/usa_ano/largura iguais aos do S001 e da V018: os números já
        -- emitidos precisam continuar no mesmo formato ('#187', '2026-0184',
        -- 'OBRA 0184', 'KIT-0001').
        SELECT * FROM (VALUES
            ('lead',     'SolarCosta_Leads',     '#',     false, 3),
            ('proposta', 'SolarCosta_Propostas', '',      true,  4),
            ('contrato', 'SolarCosta_Contratos', '',      true,  4),
            ('obra',     'SolarCosta_Obras',     'OBRA ', false, 4),
            ('kit',      'SolarCosta_Kits',      'KIT-',  false, 4)
        ) AS v(chave, tabela, prefixo, usa_ano, largura)
    LOOP
        -- Maior número já gravado. O LIKE restringe ao formato da chave — e,
        -- quando ela usa ano, ao ano corrente, que é o único contador que a
        -- função enxerga. O `~ '\d$'` descarta número fora do padrão em vez de
        -- deixar o cast estourar; o grupo pega a última corrida de dígitos,
        -- que é o contador tanto em '#187' quanto em '2026-0184'.
        EXECUTE format(
            'SELECT COALESCE(max(regexp_replace(numero, ''^.*?(\d+)$'', ''\1'')::integer), 0)'
            '  FROM %I'
            ' WHERE numero LIKE %L AND numero ~ ''\d$''',
            s.tabela,
            s.prefixo || CASE WHEN s.usa_ano THEN v_ano::text ELSE '' END || '%'
        ) INTO v_max;

        SELECT * INTO r FROM "SolarCosta_Sequencias" WHERE chave = s.chave FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO "SolarCosta_Sequencias"
                (chave, prefixo, usa_ano, ano, ultimo_numero, largura)
            VALUES
                (s.chave, s.prefixo, s.usa_ano,
                 CASE WHEN s.usa_ano THEN v_ano END, v_max, s.largura);
            RAISE NOTICE '[V026] sequencia "%" criada a partir de % (maior numero em %)',
                s.chave, v_max, s.tabela;

        ELSIF r.usa_ano AND r.ano IS DISTINCT FROM v_ano AND v_max > 0 THEN
            -- Virada de ano com números do ano novo já gravados: a função
            -- reiniciaria em 1 e colidiria com eles. Adota o ano corrente.
            UPDATE "SolarCosta_Sequencias"
               SET ano = v_ano, ultimo_numero = v_max
             WHERE chave = s.chave;
            RAISE NOTICE '[V026] sequencia "%" realinhada para % -> %', s.chave, v_ano, v_max;

        ELSIF r.ultimo_numero < v_max AND (NOT r.usa_ano OR r.ano = v_ano) THEN
            UPDATE "SolarCosta_Sequencias"
               SET ultimo_numero = v_max
             WHERE chave = s.chave;
            RAISE NOTICE '[V026] sequencia "%" adiantada de % para %',
                s.chave, r.ultimo_numero, v_max;
        END IF;
    END LOOP;
END $do$;

COMMIT;
