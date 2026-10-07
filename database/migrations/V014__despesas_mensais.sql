-- =============================================================================
--  SOLAR COSTA · V014 — despesas fixas da conta de energia
--
--  A folha "Despesas Mensais" da proposta compara o que o cliente paga HOJE
--  com o que vai pagar DEPOIS do sistema. As duas contas precisam de parcelas
--  fixas que a geração não compensa, e nenhuma delas existia na proposta:
--
--    sem SFCR → despesa de energia (consumo × tarifa) + iluminação pública
--    com SFCR → custo de disponibilidade + iluminação pública + prestação
--
--  Por que três colunas e não uma. Hoje o único número parecido no sistema é
--  SolarCosta_Concessionarias.custo_disponibilidade, que vale 33,73 para todas
--  as concessionárias e CONFLACIONA taxa mínima com iluminação pública (ver o
--  docblock de consumoAPartirDaConta em src/utils/solar.ts). Isso basta para o
--  simulador do site estimar consumo a partir do valor da conta, mas não para
--  imprimir uma proposta: na planilha que o comercial usa, a iluminação
--  pública depois do sistema é outro valor — o cliente cai para a faixa de
--  consumo mínimo, e a CIP é cobrada por faixa. Com um número só, a segunda
--  tabela repetiria a primeira e o total impresso estaria errado.
--
--  Por que na PROPOSTA e não na concessionária. A CIP é municipal, varia por
--  faixa de consumo e muda de ano para ano; o custo de disponibilidade depende
--  do tipo de ligação do imóvel (mono/bi/trifásico). Nenhum dos dois é
--  propriedade da concessionária, e um número negociado com o cliente não pode
--  mudar sozinho porque alguém editou um cadastro global depois do envio. O
--  valor da concessionária segue servindo de PRÉ-PREENCHIMENTO na calculadora.
--
--  DEFAULT 0 e não 33,73: proposta anterior a esta migration tem que reabrir
--  com as linhas zeradas, para o consultor preencher. Imprimir um número que
--  ninguém negociou seria pior do que imprimir zero.
--
--  Toca APENAS "SolarCosta_Propostas", criada pela V001 e portanto já de posse
--  do solarcosta_migrator — a V009 criou tabelas cujo dono ficou `postgres` e
--  qualquer migration que as alcance derruba o deploy. Não cria tabela nova
--  nem usa ALTER TYPE, então não exige registro à mão em SchemaMigrations.
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_Propostas"
    ADD COLUMN IF NOT EXISTS iluminacao_publica_sem_sfcr numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS custo_disponibilidade       numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iluminacao_publica_com_sfcr numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN "SolarCosta_Propostas".iluminacao_publica_sem_sfcr IS
    'Taxa de iluminação pública (CIP/COSIP) na conta ATUAL do cliente, em R$/mês. '
    'Linha (D) da folha de despesas mensais; entra no total "sem SFCR" junto da '
    'despesa de energia (consumo_kwh × tarifa_kwh).';

COMMENT ON COLUMN "SolarCosta_Propostas".custo_disponibilidade IS
    'Custo de disponibilidade em R$/mês — a parcela mínima que a concessionária '
    'cobra de quem gera a própria energia, função do tipo de ligação do imóvel. '
    'Linha (F) da folha de despesas mensais. Pré-preenchido a partir de '
    'SolarCosta_Concessionarias.custo_disponibilidade, mas editável por proposta.';

COMMENT ON COLUMN "SolarCosta_Propostas".iluminacao_publica_com_sfcr IS
    'Taxa de iluminação pública que o cliente CONTINUA pagando depois do '
    'sistema, em R$/mês. Linha (G) da folha de despesas mensais. Separada de '
    'iluminacao_publica_sem_sfcr porque a CIP é cobrada por faixa de consumo, e '
    'com a geração compensando o consumo faturado a faixa muda.';

COMMIT;
