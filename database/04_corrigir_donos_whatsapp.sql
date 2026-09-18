-- =============================================================================
--  SOLAR COSTA · Devolver ao migrator o dono das tabelas do WhatsApp
--
--  Rode UMA VEZ, conectado como superusuário (postgres) no banco SolarCosta,
--  DEPOIS do 03_papel_migracao.sql e ANTES do deploy que traz o V010.
--
--  ESTE É UM DOS POUCOS ARQUIVOS QUE SE RODA À MÃO. As migrations de
--  database/migrations/ NÃO: elas são aplicadas pelo `npm run migrate` no
--  deploy, e aplicá-las por fora é o que criou o problema que este arquivo
--  conserta. Aqui não há escolha — trocar o dono de uma tabela exige
--  superusuário, e o papel de migration não é um.
--
--  NO DBEAVER: não há linha em branco dentro do bloco DO abaixo, e isso é
--  proposital. A opção "linha em branco delimita instrução" vem ligada por
--  padrão e cortaria o bloco em fragmentos soltos, cada um com erro de
--  sintaxe. Se você reformatar este arquivo, mantenha as linhas `--` que
--  fazem o papel de respiro visual.
--
--  ---------------------------------------------------------------------------
--  O QUE ESTE ARQUIVO CONSERTA
--
--  O 03_papel_migracao.sql criou o `solarcosta_migrator` e passou a aplicar as
--  migrations por ele. Mas o V009 — as seis tabelas do WhatsApp — foi aplicado
--  ANTES disso, à mão, por um cliente conectado como `postgres`. Em PostgreSQL
--  quem cria é dono, então essas seis nasceram com dono `postgres`, enquanto as
--  42 anteriores ficaram com `solarcosta_migrator`.
--
--  Dono é o que dá poder de ALTER, COMMENT e DROP — e o migrator não tem nem
--  SELECT nelas. O sintoma aparece tarde e caro: a PRÓXIMA migration que tocar
--  em qualquer tabela do WhatsApp levanta "permission denied for table", o
--  `npm run migrate` sai com código 1, o `&&` do Dockerfile corta o
--  `npm start`, e o container não sobe. Exatamente o modo de falha que o
--  03_papel_migracao.sql veio resolver, sobrevivendo num canto.
--
--  O V010 já se protege disso (checa o privilégio e apenas avisa), mas a
--  proteção é um curativo: ela deixa os modelos de mensagem desatualizados.
--  Este arquivo é o conserto.
--
--  ---------------------------------------------------------------------------
--  POR QUE DINÂMICO EM VEZ DE SEIS ALTER TABLE
--
--  Nomear as seis resolveria hoje e falharia no dia em que alguém aplicasse
--  outra migration à mão — que é como este problema nasceu. O laço abaixo
--  alcança QUALQUER tabela `SolarCosta_%` cujo dono não seja o migrator, então
--  rodar este arquivo de novo depois de um incidente futuro conserta de novo.
--
--  Trocar o dono NÃO mexe nos GRANTs: `solarcosta_app` continua com
--  SELECT/INSERT/UPDATE/DELETE e `solarcosta_leitura` com SELECT, exatamente
--  como o 02_papeis.sql deixou.
-- =============================================================================

BEGIN;

DO $do$
DECLARE
    r        record;
    trocadas int := 0;
BEGIN
    FOR r IN
        SELECT c.relname,
               pg_get_userbyid(c.relowner) AS dono,
               CASE c.relkind WHEN 'r' THEN 'TABLE'
                              WHEN 'S' THEN 'SEQUENCE'
                              WHEN 'v' THEN 'VIEW'
                              WHEN 'm' THEN 'MATERIALIZED VIEW' END AS especie
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname LIKE 'SolarCosta\_%'
           AND c.relkind IN ('r', 'S', 'v', 'm')
           AND pg_get_userbyid(c.relowner) <> 'solarcosta_migrator'
         ORDER BY c.relname
    LOOP
        RAISE NOTICE 'dono de %  %  ->  solarcosta_migrator (era %)',
            r.especie, r.relname, r.dono;
        EXECUTE format('ALTER %s public.%I OWNER TO solarcosta_migrator',
                       r.especie, r.relname);
        trocadas := trocadas + 1;
    END LOOP;
    --
    IF trocadas = 0 THEN
        RAISE NOTICE 'Nada a fazer: tudo já pertence ao solarcosta_migrator.';
    ELSE
        RAISE NOTICE '% objeto(s) transferido(s).', trocadas;
    END IF;
END $do$;

COMMIT;

-- Confira depois de rodar — a consulta tem de voltar VAZIA:
--
--   SELECT tablename, tableowner
--     FROM pg_tables
--    WHERE tablename LIKE 'SolarCosta\_%'
--      AND tableowner <> 'solarcosta_migrator';
