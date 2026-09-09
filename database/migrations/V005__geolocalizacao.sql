-- =============================================================================
--  SOLAR COSTA · V005 — Geolocalização e layout de telhado
--
--  Habilita a proposta a mostrar o telhado do cliente por satélite com os
--  módulos posicionados, como na figura que acompanha o orçamento.
--
--  O que é persistido e o que não é: o `place_id` e o id de edificação do
--  Google podem ser guardados sem prazo. A IMAGEM de satélite não — o ToS do
--  Google Maps Platform só permite cache temporário —, então ela é buscada de
--  novo toda vez que a proposta é impressa. O que guardamos é o layout que
--  NÓS calculamos (posição de cada módulo), que é dado nosso.
--
--  Por que o layout fica congelado na proposta: mesmo motivo de potencia_kwp
--  e economia_mensal já serem persistidos — a proposta impressa não pode
--  mudar porque o Google reprocessou a imagem ou o kit foi reajustado depois.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. LEADS — coordenada do imóvel, aproveitada ao gerar a proposta
-- =============================================================================

ALTER TABLE "SolarCosta_Leads"
    ADD COLUMN IF NOT EXISTS latitude   numeric(10,7),
    ADD COLUMN IF NOT EXISTS longitude  numeric(10,7),
    ADD COLUMN IF NOT EXISTS place_id   text;

COMMENT ON COLUMN "SolarCosta_Leads".place_id IS
    'Place ID do Google. Único dado do Maps que o ToS permite guardar sem prazo.';

-- =============================================================================
-- 2. PROPOSTAS — localização + layout congelado no momento da emissão
-- =============================================================================

ALTER TABLE "SolarCosta_Propostas"
    ADD COLUMN IF NOT EXISTS latitude            numeric(10,7),
    ADD COLUMN IF NOT EXISTS longitude           numeric(10,7),
    ADD COLUMN IF NOT EXISTS place_id            text,
    ADD COLUMN IF NOT EXISTS endereco_formatado  text,
    -- Id da edificação na Solar API ("buildings/ChIJ..."). Serve para reabrir
    -- a mesma análise sem depender de o geocoding cair no mesmo ponto.
    ADD COLUMN IF NOT EXISTS edificacao_id       text,
    -- Zoom usado no enquadramento, para a figura sair igual na reimpressão.
    ADD COLUMN IF NOT EXISTS mapa_zoom           smallint,
    -- Data da foto de satélite que embasou a análise. Vai impressa na proposta:
    -- costuma ter anos de atraso e o cliente precisa saber disso.
    ADD COLUMN IF NOT EXISTS telhado_imagem_data date,
    -- Área real do telhado medida pelo Google, distinta da área estimada pelo
    -- dimensionamento (proposta.area_por_modulo_m2, que embute espaçamento).
    ADD COLUMN IF NOT EXISTS telhado_area_m2     numeric(10,2),
    -- Um objeto por módulo: {cantos:[{lat,lng} x4], segmento, azimute}.
    ADD COLUMN IF NOT EXISTS layout_modulos      jsonb,
    -- Segmentos de telhado do Google: {indice, azimute, inclinacao, area}.
    ADD COLUMN IF NOT EXISTS layout_segmentos    jsonb;

COMMENT ON COLUMN "SolarCosta_Propostas".layout_modulos IS
    'Layout calculado por nós (src/utils/layoutModulos.ts), não o do Google: '
    'a Solar API posiciona placas de 400 Wp e a Solar Costa vende 710 Wp.';

-- jsonb aceita qualquer coisa; estas checagens barram o que quebraria o
-- desenho na hora de imprimir — array de objetos, e não um escalar solto.
--
-- O DROP antes do ADD é o que torna o arquivo re-executável: o PostgreSQL não
-- tem ADD CONSTRAINT IF NOT EXISTS, e sem isso rodar a migration duas vezes
-- (script aplicado à mão e depois o `npm run migrate` do deploy) aborta a
-- transação inteira em "constraint already exists".
ALTER TABLE "SolarCosta_Propostas"
    DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_layout_modulos_array",
    DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_layout_segmentos_array",
    DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_coordenada_completa";

ALTER TABLE "SolarCosta_Propostas"
    ADD CONSTRAINT "SolarCosta_Propostas_layout_modulos_array"
        CHECK (layout_modulos IS NULL OR jsonb_typeof(layout_modulos) = 'array'),
    ADD CONSTRAINT "SolarCosta_Propostas_layout_segmentos_array"
        CHECK (layout_segmentos IS NULL OR jsonb_typeof(layout_segmentos) = 'array'),
    -- Latitude sem longitude (ou vice-versa) é um meio-preenchimento que só
    -- apareceria na hora de renderizar o mapa em branco.
    ADD CONSTRAINT "SolarCosta_Propostas_coordenada_completa"
        CHECK ((latitude IS NULL) = (longitude IS NULL));

-- Propostas geradas para o mesmo imóvel (revisão de orçamento, segundo
-- sistema no mesmo telhado). O índice parcial evita indexar o grosso da
-- tabela, que ainda não tem place_id.
CREATE INDEX IF NOT EXISTS "SolarCosta_Propostas_place_id_idx"
    ON "SolarCosta_Propostas" (place_id)
    WHERE place_id IS NOT NULL;

-- =============================================================================
-- 3. PARÂMETROS — dimensão FÍSICA do módulo
--
--    Não confundir com `proposta.area_por_modulo_m2` (5,805 m²), que já
--    existe e responde outra pergunta: quanto de telhado o módulo consome
--    COM espaçamento e circulação. Aquele número continua valendo para a
--    área estimada da proposta.
--
--    Os valores abaixo são a placa em si, e só servem para desenhá-la em
--    escala sobre o satélite. Um módulo de 710 Wp mede ~2,38 x 1,30 m.
-- =============================================================================

INSERT INTO "SolarCosta_Parametros" (chave, valor, tipo, grupo, descricao) VALUES
    ('layout.modulo_largura_m',  '2.38', 'numero', 'dimensionamento',
     'Comprimento físico do módulo (m), usado só no desenho do telhado'),
    ('layout.modulo_altura_m',   '1.30', 'numero', 'dimensionamento',
     'Largura física do módulo (m), usado só no desenho do telhado'),
    ('layout.espacamento_m',     '0.02', 'numero', 'dimensionamento',
     'Folga entre módulos vizinhos na mesma fileira (m)')
ON CONFLICT (chave) DO NOTHING;

COMMIT;
