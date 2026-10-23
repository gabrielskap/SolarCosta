# Especificação de evolução solar

Data: 23/10/2026. Estado: proposta técnica baseada em inspeção estática do repositório; nenhuma integração externa foi executada. As imagens fornecidas são referências visuais, não evidência das funcionalidades atuais.

## Objetivo e limites

Reintegrar Building Insights ao levantamento usado pela calculadora, com sugestões revisáveis e alternativa manual permanente. Preservar projetos salvos, equipamentos, preços, propostas e PDF. Esta especificação não autoriza migração destrutiva nem troca do editor. Camadas solares, energia física e 3D são entregas posteriores.

Não assumir como validados preços, franquias, cobertura ou permissões de retenção mencionados no diagnóstico e nos comentários do código. Conferir documentação oficial e contrato aplicável antes de ativar novos produtos ou persistir novos dados Google.

## Base confirmada no código

| Área | Evidência | Consequência |
| --- | --- | --- |
| Fluxo principal | `src/components/ProposalCalculatorView.tsx` abre `LevantamentoManual` | Integrar aqui, sem reativar o editor antigo como fluxo concorrente |
| Levantamento | `src/components/mapa/LevantamentoManual.tsx` importa Geocoding e imagem, sem `buscarTelhado` | Falta conectar a análise solar ao editor atual |
| Solar existente | `src/services/solar.ts`, `server/src/routes/solar.routes.ts`, `server/src/services/googleSolar.ts` | Reutilizar `GET /api/solar/telhado?lat=&lng=`, já autenticado |
| Dados disponíveis | Segmentos com centro, área, azimute, inclinação e quantil mediano; posições e dimensões dos módulos Google | Não há contorno poligonal das águas no contrato atual |
| Geometria | `server/src/domain/levantamentoTelhado.ts`, reexportado pelo frontend | Já existe motor compartilhado para o levantamento atual; ampliar essa base |
| Validação | `server/src/schemas/levantamentoTelhado.ts` | Já verifica contornos, associação às águas, limites, recuos, obstáculos e sobreposição; falta conferir retângulos e dimensões físicas dos módulos |
| Persistência | Migração V020, mappers e rotas de propostas | Preservar `levantamento_telhado` e leitura de versão 1 com origem manual |
| Cache | `server/src/services/cacheGoogle.ts` | Já existe cache compartilhado PostgreSQL, TTL de 24h e serialização por chave; imagens seguem outro caminho |
| Simulação | `FiguraLevantamento`, `SimulacaoSolar`, `src/utils/posicaoSolar.ts` | Há incidência e sombras visuais; isso não demonstra perdas energéticas em kWh |
| Energia persistida | Rotas de propostas aceitam `geracao_media_kwh` | Implementar cálculo autoritativo no servidor em entrega própria |

## Entrega 1 — Building Insights no levantamento atual

### Comportamento

1. Após localizar e conferir o imóvel, disponibilizar “Consultar análise solar”. Não consultar a cada renderização, movimento ou zoom.
2. Usar a coordenada confirmada da edificação. Geocoding aproximado exige conferência do ponto pelo usuário. O prédio mais próximo retornado pode ser outro imóvel: mostrar seu centro sobre a imagem e exigir associação consciente às águas.
3. Apresentar qualidade, data de levantamento e data de processamento separadamente. Nunca atribuir essas datas à imagem Static Maps exibida.
4. Exibir lista de segmentos: índice, área de superfície, inclinação, azimute e mediana de insolação, com unidade e fonte verificadas. Não chamar mediana de média.
5. Com uma água manual selecionada, permitir escolher um segmento e visualizar valores atuais e sugeridos. “Aplicar à água” altera apenas inclinação e azimute. Área Google é referência para comparação; não substitui a área calculada do polígono.
6. Aplicação deve entrar no histórico de desfazer. Como alterações de inclinação podem afetar a projeção física dos módulos, usar a invalidação de placas já adotada no editor, avisando previamente o usuário. Não sobrescrever módulo de catálogo, obstáculos, contornos ou outras águas.
7. Consultar, falhar, cancelar ou fechar a prévia não altera o levantamento nem os valores comerciais. Aplicar o levantamento continua passando pelo fluxo existente da calculadora e pela conferência de equipamentos.
8. Manter sugestões em estado transitório na primeira entrega. Persistir os valores efetivamente aceitos nos campos já existentes da água. Não alterar `origem: 'manual'`, não gravar resposta Google completa nem introduzir novos campos sem política de retenção definida.

### Estados e concorrência

Estados explícitos: disponível para consulta, consultando, resultado, sem cobertura e erro. Manter desenho e salvamento manual disponíveis em todos os estados. Reutilizar o padrão de rodada de requisição do editor para descartar respostas de coordenadas antigas e de componentes desmontados. Desativar consultas duplicadas enquanto houver requisição ativa.

Tratar `telhado_sem_dados` e `google_maps_desligado` já existentes. Distinguir, no backend e no contrato de erro, indisponibilidade temporária, credencial/permissão recusada, limite do provedor e tempo excedido; não apresentar todo erro como falta de cobertura. Acrescentar timeout e validação da resposta externa antes da normalização. Não registrar chave, URL autenticada ou corpo bruto potencialmente sensível.

### Restrições geométricas

Building Insights no contrato atual não oferece polígonos das águas. Bounding box, centros e conjunto de módulos sugeridos não equivalem ao contorno real. Não criar retângulos fictícios nem inferir telhados completos a partir das placas Google. As dimensões de referência devem vir da resposta, sem assumir potência fixa de 400 Wp.

Convencionar azimute como 0° norte geográfico, crescendo no sentido horário; manter separado da rotação visual da planta (`norte`). Documentar coordenadas locais em metros na projeção horizontal. Não aplicar duas vezes a correção por inclinação em área e dimensões de módulos.

### Arquivos previstos

- `src/components/mapa/LevantamentoManual.tsx`: consulta, estados, seleção e aplicação revisável; extrair painel de sugestões se necessário para legibilidade.
- `src/services/solar.ts`: reutilizar `buscarTelhado`; harmonizar nomes/unidades sem quebrar consumidores legados.
- `server/src/services/googleSolar.ts`: validação do retorno, timeout e classificação de erros.
- `server/src/routes/solar.routes.ts`: manter autenticação e contrato compatível; acrescentar limites específicos se ausentes.
- `scripts/test-levantamento.ts` e testes novos direcionados: regressão geométrica e aplicação das sugestões.

Não modificar banco, motor comercial, PDF ou editor legado nesta entrega, salvo correção estritamente necessária e documentada.

### Critérios de aceite

- Projeto versão 1 anterior abre, permite edição, salva e reabre com geometria e equipamentos preservados quando nenhuma sugestão é aplicada.
- Consulta bem-sucedida não altera o projeto até aplicação explícita. Aplicação afeta somente a água escolhida e a invalidação prevista; desfazer restaura o estado anterior.
- Ausência de cobertura, chave desativada, erro, limite e timeout permitem continuar manualmente sem perda do desenho.
- Trocar coordenadas com consulta pendente não aplica resposta antiga. Montar ou reabrir o editor não dispara consulta solar automática.
- Segmento sem dados válidos não pode ser aplicado; 0° continua sendo valor válido. Resposta vazia ou malformada produz estado tratável.
- Área de superfície não é convertida em contorno, quantidade instalada ou geração. Módulos Google não substituem os selecionados no catálogo.
- Chaves permanecem no servidor. A rota continua inacessível sem login.
- Executar `npm run lint`, `npm --prefix server run lint` e `npx tsx scripts/test-levantamento.ts`; validar visualmente o editor com respostas controladas para sucesso, falha e concorrência. Teste real de cobertura é separado e exige ambiente configurado.

## Entregas seguintes e dependências

### 2 — Integridade geométrica e energética

Validar no servidor módulos retangulares, ortogonalidade, dimensões projetadas conforme inclinação, orientação e tolerância numérica documentada. Verificar espaçamento mínimo entre módulos, além de sobreposição. Cobrir quadriláteros deformados, água inclinada, obstáculos, concavidades e manipulação do payload. Consolidar progressivamente usos de `layoutModulos.ts` e `edicaoLayout.ts` no motor atual, preservando leitura de propostas antigas.

Centralizar o cálculo energético no servidor antes de usá-lo para novas promessas comerciais. Auditar `src/utils/solar.ts`, rotas de propostas e projeções do PDF com exemplos numéricos independentes. Preservar resultados históricos; novos recálculos devem registrar versão do modelo e premissas. Não recalcular retroativamente propostas emitidas sem fluxo explícito de revisão.

### 3 — Data Layers e mapa de calor

Implementar acesso autenticado pelo backend, autorização, limites por usuário, timeout e métricas de consumo. Não aceitar URL arbitrária do cliente como alvo de proxy. Tratar credenciais e URLs temporárias como segredos. Antes de armazenar raster ou derivados, definir retenção e atribuição conforme condições aplicáveis.

Usar georreferenciamento do raster para alinhamento com o editor; testar pixel, metro, Web Mercator, rotação e resolução em pontos de controle. Distinguir fluxo anual, máscaras e alturas, com legenda e unidades próprias. Mapa colorido de incidência instantânea não deve aparecer como insolação anual medida.

Automatizar contornos somente após validar segmentação com máscaras e alturas ou outra fonte adequada. Oferecer prévia e correção manual; nunca converter bounding box em água definitiva.

### 4 — Modelo energético físico

Fazer prova de conceito Python com pvlib antes de decidir serviço separado ou processamento assíncrono. Definir fonte meteorológica, cobertura, período, fuso e qualidade. Entrada: geometria versionada, módulo, inversor, localização, orientação, inclinação e perdas discriminadas. Saída: kWh mensais/anuais, premissas e indicadores de qualidade.

Sombras visuais em um horário não equivalem a perdas anuais. Definir irradiância direta/difusa, obstruções, agregação temporal e limitações elétricas do modelo. Evitar descontar novamente sombras já incorporadas na fonte solar. Comparar cenários controlados e referência independente antes de substituir HSP; manter alternativa simplificada identificada quando faltarem dados.

### 5 — Modelo próprio 3D

Three.js deve consumir a mesma geometria do editor. A estrutura atual contém polígonos, azimutes e inclinações, mas não define alturas de beirais, cumeeiras ou continuidade entre águas. Projetar extensão versionada com planos/alturas, origem altimétrica e migração compatível antes de chamar o resultado de modelo real. No primeiro protótipo, alturas assumidas devem ser visíveis como aproximação.

Validar correspondência 2D/3D, dimensões dos módulos, coordenadas e obstáculos. Alterações futuras em 3D devem passar pelas mesmas regras e histórico do 2D.

### 6 — Contexto Google 3D opcional

Validar cobertura, APIs disponíveis, custos, atribuição e compatibilidade de sobreposição antes da implementação. Tratar malha fotorrealista como contexto de apresentação, sem substituir a geometria autoritativa. Ausência de cobertura deve preservar o modelo próprio e o levantamento manual.

## Operação e liberação

Disponibilizar a primeira entrega por configuração independente, mantendo o estado atual como alternativa de reversão. Medir consultas por usuário/projeto, acertos de cache, latência, falhas e consumo estimado sem registrar dados sensíveis desnecessários. Estabelecer cotas locais antes de ampliar consumo de APIs; alertas de orçamento não substituem bloqueios locais.

A próxima implementação deve começar exclusivamente pela entrega 1, com os critérios de aceite acima. Aprovar a precisão geométrica e energética antes de apresentar geração por sombras ou avançar para o 3D como ferramenta de engenharia.
