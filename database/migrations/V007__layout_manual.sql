-- =============================================================================
--  SOLAR COSTA · V007 — Ajuste manual do layout de telhado
--
--  O V005 gravou o layout que NÓS calculamos a partir da análise do Google.
--  Ele acerta na maioria das casas e erra de formas previsíveis: azimute da
--  cumeeira alguns graus fora, puxadinho contado como telhado, laje nova que
--  não aparece na foto de referência. Agora o consultor pode corrigir isso no
--  editor em tela cheia (src/components/mapa/EditorTelhado.tsx).
--
--  A GEOMETRIA ajustada não precisou de coluna nova: `layout_modulos` já é
--  jsonb com os quatro cantos de cada placa em lat/lng, e uma placa movida à
--  mão é só outro conjunto de cantos. O que falta guardar é o CONTEXTO da
--  edição — as duas colunas abaixo.
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_Propostas"
    -- Marca que o layout saiu do editor, não do empacotamento automático.
    --
    -- Sem isto, reabrir a proposta não teria como saber se aquelas posições
    -- foram escolhidas ou calculadas, e o primeiro recálculo por mudança de
    -- consumo passaria por cima do trabalho do consultor sem avisar.
    ADD COLUMN IF NOT EXISTS layout_ajuste_manual boolean NOT NULL DEFAULT false,
    -- Medida física da placa usada no layout: {larguraM, alturaM, espacamentoM}.
    --
    -- Normalmente é igual aos parâmetros layout.modulo_* do sistema, e aí fica
    -- NULL. Preenchida quando o kit fechou com um módulo de outra potência —
    -- 550 Wp no lugar de 710 Wp, por exemplo. Sem ela, "Refazer automático"
    -- depois de reabrir a proposta voltaria a empacotar com a medida padrão e
    -- daria uma contagem diferente da que está impressa.
    ADD COLUMN IF NOT EXISTS layout_modulo        jsonb;

COMMENT ON COLUMN "SolarCosta_Propostas".layout_ajuste_manual IS
    'true = as posições em layout_modulos foram ajustadas no editor de telhado, '
    'não geradas pelo empacotamento automático.';

COMMENT ON COLUMN "SolarCosta_Propostas".layout_modulo IS
    'Medida da placa usada no layout: {larguraM, alturaM, espacamentoM}. '
    'NULL = valeram os parâmetros layout.modulo_largura_m / _altura_m / espacamento_m.';

-- O DROP antes do ADD é o que torna o arquivo re-executável: o PostgreSQL não
-- tem ADD CONSTRAINT IF NOT EXISTS, e sem isso rodar a migration duas vezes
-- aborta a transação inteira em "constraint already exists". Mesmo padrão do V005.
ALTER TABLE "SolarCosta_Propostas"
    DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_layout_modulo_objeto";

ALTER TABLE "SolarCosta_Propostas"
    -- jsonb aceita qualquer coisa; aqui precisa ser objeto, senão o mapper do
    -- front leria `.larguraM` de um número e o editor abriria com a placa zerada.
    ADD CONSTRAINT "SolarCosta_Propostas_layout_modulo_objeto"
        CHECK (layout_modulo IS NULL OR jsonb_typeof(layout_modulo) = 'object');

COMMIT;
