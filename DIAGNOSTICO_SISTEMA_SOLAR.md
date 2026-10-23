# Diagnóstico técnico — Plataforma Solar Costa

Data: 23/10/2026. Referência Git: `1948c49`, incluindo o estado local não commitado observado nesta análise.

Escopo: diagnóstico do projeto e do fluxo associado a `http://localhost:3000/sistema/propostas/5593b3b3-365d-4bac-be75-bc557783b852/editar`. Nenhum código, configuração, dependência ou dado de negócio foi alterado. Este documento é o único arquivo criado pela análise.

## 1. Resumo executivo do estado atual

O produto é um CRM comercial com dimensionamento fotovoltaico simplificado, propostas, catálogo, contratos e obras. Existe um editor de levantamento de telhado utilizável pelo fluxo atual, com imagem de satélite ou imagem própria, escala em metros, desenho de águas e obstáculos, distribuição de módulos e simulação geométrica de luz solar em planta.

**A distinção central é entre o fluxo atual e o código anterior ainda presente:**

- A calculadora atual renderiza `LevantamentoManual`, em `src/components/ProposalCalculatorView.tsx:1185`. O botão de satélite desse editor chama Geocoding e Static Maps; não chama a análise automática da Solar API.
- `PainelTelhado.tsx` implementa outro fluxo: Geocoding → Google Solar Building Insights → empacotamento → imagem → editor Google Maps. Entretanto, a calculadora somente o importa; não existe montagem JSX de `PainelTelhado` no código pesquisado. Sua disponibilidade no repositório não equivale à disponibilidade na tela atual.
- Os endpoints de análise automática continuam registrados em `/api/solar`. Layouts antigos têm leitura e impressão preservadas.
- Não existe renderização 3D comprovada. O modelo atual é SVG 2D. O editor antigo também força `tilt: 0` e desativa a rotação do mapa.
- A posição solar e a incidência angular são cálculos reais aproximados. As sombras são projeções 2D de obstáculos com altura informada, somente sobre águas horizontais. Não há cálculo de perda de geração por essas sombras.
- A geração usa HSP, potência e percentual global de perdas. Não há modelo meteorológico horário nem integração comprovada com PVGIS, NASA POWER ou similar.

### Alcance da verificação

A URL da tela respondeu HTTP 200; isto comprova a entrega do frontend, não a carga autenticada da proposta. `http://localhost:4000/health` respondeu `status: ok`, e o código dessa sonda executa apenas `SELECT 1`. A tentativa inicial em `/api/health` retornou 404 porque a rota correta é `/health`.

Não foi aberta sessão autenticada nem carregada a proposta individual. A calculadora possui salvamento automático a cada 30 segundos (`ProposalCalculatorView.tsx`, `salvarAutomaticamente`); uma sessão autenticada poderia produzir escrita sem clique explícito. Não foram disparadas consultas Google: Geocoding e Solar consultam um cache que executa DELETE/INSERT/UPDATE no banco, e chamadas externas podem consumir serviços pagos. Logo, faturamento, cobertura real do endereço, validade de chaves, aplicação das migrações V019/V020 e persistência ponta a ponta **não foram confirmados**.

Verificações executadas, todas aprovadas: `npm run lint`, `npm --prefix server run lint` e execução local de `scripts/test-levantamento.ts` via `node_modules/.bin/tsx.cmd`. Os testes são locais, sem acesso ao banco ou a APIs; confirmam casos de geometria, escala, posição solar, câmera e validação do contrato JSON, não acurácia de campo nem renderização no navegador.

O checkout já apresentava alterações em `scripts/test-levantamento.ts`, `server/src/domain/levantamentoTelhado.ts`, `CanvasTelhado.tsx`, `LevantamentoManual.tsx` e `SimulacaoSolar.tsx`, além de `VIABILIDADE_EDITOR_TELHADO.md` não rastreado. Elas foram preservadas; as conclusões refletem os arquivos locais.

**Limite temporal do diagnóstico:** na conferência final surgiram alterações concorrentes adicionais em `server/src/app.ts`, `src/App.tsx` e `src/components/Sidebar.tsx`, além de novos arquivos `database/migrations/V021__cadastro_placas.sql`, `server/src/routes/placas.routes.ts`, `src/components/PlacasView.tsx` e `src/services/placas.ts`. Não foram produzidas por esta análise nem auditadas neste relatório. As conclusões sobre cadastro de dimensões/vínculo de placas referem-se ao estado lido antes dessas inclusões; não confirmam nem descartam funcionalidades desse trabalho concorrente. Os resultados TypeScript também se referem ao momento em que os comandos foram executados.

## 2. Arquitetura e tecnologias existentes

| Camada | Tecnologia e versão declarada | Evidência e responsabilidade |
|---|---|---|
| Frontend | TypeScript ~5.8.2, React ^19.0.1, React Router DOM ^7.18.3 | `package.json`, `src/main.tsx`, `src/App.tsx`; SPA com site público e CRM em `/sistema` |
| Build e estilos | Vite ^6.4.5, Tailwind ^4.1.14 | `vite.config.ts`; frontend na porta 3000, proxy `/api` para 4000 por padrão |
| Backend | Node.js, TypeScript, Express ^4.21.2 | `server/package.json`, `server/src/index.ts`, `server/src/app.ts`; API REST e entrega estática em produção |
| Dados | PostgreSQL com driver pg ^8.13.1 | `server/src/db.ts`; pool, SQL parametrizado e transações com ator de auditoria |
| Validação | Zod ^3.24.1 | `server/src/routes/propostas.routes.ts`, `server/src/schemas/levantamentoTelhado.ts` |
| Autenticação | bcryptjs ^2.4.3, jsonwebtoken ^9.0.2 | `server/src/auth/`, `server/src/routes/auth.routes.ts` |
| Visualização | SVG/DOM, Canvas 2D na importação, Recharts ^3.10.1 | Editor de telhado, gráficos da proposta e PDF |
| Documentos | puppeteer-core ^24.43.1 no servidor | `server/src/services/pdfDocumento.ts`, `renderInterno.ts`, `src/components/PDFModal.tsx` |
| PWA | vite-plugin-pwa ^1.3.0, Workbox | `vite.config.ts`, `src/sw.ts`, `src/pwa/` |
| IA declarada | @google/genai ^2.4.0 | Dependência no manifesto; nenhuma chamada ou importação de IA encontrada em `src`/`server/src` |

As versões acima são faixas declaradas, não uma afirmação sobre versões carregadas por processos em execução. A versão exata do PostgreSQL e do runtime de produção não foi confirmada.

### Geoespacial e armazenamento

Não foram encontradas dependências diretas de Turf, Leaflet, OpenLayers, Three.js, Babylon.js ou Cesium nos manifestos. A geometria é própria; Google Maps é carregado por script remoto no fluxo antigo, não por SDK npm. As extensões SQL do schema inicial são pgcrypto, citext, unaccent e pg_trgm; não há declaração de PostGIS nas migrações examinadas.

`SolarCosta_Propostas` armazena entradas, resultados comerciais e snapshots. V005 adiciona coordenadas numéricas, IDs de localização, data da análise e layouts JSONB; V007 adiciona identificação de ajuste manual e dimensões do módulo; V020 adiciona `levantamento_telhado` JSONB. V019 cria cache compartilhado Google com expiração. O levantamento contém águas, obstáculos, módulos, dados da simulação, escala e referência da imagem. Imagem própria vira JPEG base64 dentro do JSON; a imagem de satélite é refeita a partir de coordenadas e zoom, sem blob permanente nesse campo.

`src/services/mappers.ts`, `mapProposta` e conversão de proposta para API, fazem a ponte camelCase ↔ snake_case, incluindo `levantamentoTelhado` ↔ `levantamento_telhado`. `server/src/routes/propostas.routes.ts` grava esse JSON em criação e atualização. O projeto solar é um subdocumento da proposta; não foi identificado um repositório separado de modelos BIM ou projetos 3D.

### Sessão e proteção

`tokens.ts` emite JWT e refresh aleatório; refresh é armazenado no banco como hash SHA-256, com rotação. `middleware.ts` verifica Bearer e carrega usuário ativo/permissões. `src/services/http.ts` mantém acesso em memória e refresh no localStorage, renova uma vez após 401 e compartilha renovações simultâneas. `app.ts` aplica Helmet/CSP e CORS. Rotas solares exigem login; não há orçamento de consumo por usuário implementado no router solar.

## 3. Mapas e imagens de satélite

### Fluxo atualmente exposto

`LevantamentoManual.buscarSatelite` permite endereço ou coordenadas. Endereço passa por `src/services/solar.ts` e `/api/solar/geocodificar`; o backend usa `geocodificar` de `googleSolar.ts`. O resultado inclui latitude, longitude, endereço formatado, place ID e precisão. Somente `ROOFTOP` é marcado confiável; resultados aproximados produzem aviso no editor.

Depois o editor chama `/api/solar/imagem`, sem análise automática de telhado. `imagemSatelite` consulta Google Static Maps, `maptype=satellite`, PNG e `scale=2`. O tamanho lógico máximo é 640 × 640, correspondendo a até 1280 × 1280 pixels retornados. A função limita zoom entre 16 e 20; o schema HTTP ainda admite 21, portanto existe divergência entre contrato e implementação. A interface atual oferece 18, 19 e 20.

`escalaSatelite` calcula metros por pixel lógico:

`mpp = 2π × 6378137 × cos(latitude) / (256 × 2^zoom)`.

`scale=2` aumenta a resolução raster sem duplicar a extensão geográfica. Essa coerência é coberta pelos testes. A escala é aproximada ao nível do solo: não modela ortorretificação do telhado, altura, relevo ou erro do provedor.

`CanvasTelhado` muda o `viewBox` SVG para zoom de 1 a 12 vezes e navegação por arrasto. Esse zoom amplia a imagem já carregada; não adquire pixels novos. Não existe rotação do raster nem perspectiva. O campo norte orienta cálculos, sem girar a fotografia. O enquadramento pode ser trocado por nova busca, que reinicia contornos/módulos após confirmação na interface.

### Imagem própria

`LevantamentoManual.importar` aceita JPG/PNG/WebP até 10 MB, reduz a maior dimensão para até 1200 px, converte para JPEG com qualidade 0,75 e tenta 0,4 se exceder 450 mil caracteres; rejeita se ainda exceder. A escala deve ser confirmada ou calibrada por dois pontos e distância conhecida. `preserveAspectRatio="none"` ajusta a imagem à planta; alterar dimensões com proporção incompatível pode distorcer a referência visual. A calibração multiplica coordenadas e dimensões por um fator único.

### Fluxo antigo disponível no código

`PainelTelhado`, `buscar`/consulta de telhado e `recalcular`, combina Geocoding, Building Insights, máscara de painéis e imagem. `useGoogleMaps.carregar` injeta Maps JS uma vez por aba, sob demanda, com callback e timeout de 20 s. `EditorTelhado` cria mapa satélite, zoom 15–22, `tilt:0`, `rotateControl:false`, com edição de módulos. Como o painel não é montado pela calculadora atual, esses controles não devem ser apresentados como recurso acessível nessa tela.

### Qualidade, datas e fornecedores

Existe um único fornecedor integrado para imagem aérea: Google. Importar foto própria não constitui integração com outro fornecedor. Não há seleção Mapbox/MapTiler/Bing/Azure.

Building Insights solicita `requiredQuality=HIGH`; normaliza data de captura, processamento e qualidade. `PainelTelhado` alerta para idade e possível diferença entre a imagem da análise e a fotografia do mapa. Static Maps, no fluxo atual, não fornece data de captura por essa implementação; `dataImagem` é informada manualmente. Nenhuma função demonstrou aquisição de ortofoto técnica de resolução garantida ou seleção de imagens históricas.

## 4. Medição e geometria de telhados

O motor efetivamente compartilhado é `server/src/domain/levantamentoTelhado.ts`; `src/utils/levantamentoTelhado.ts` o reexporta. São funções puras, sem serviço de reconhecimento de imagens.

| Recurso | Comportamento e evidência |
|---|---|
| Contorno | Cliques formam polígono; `fecharPoligono` verifica `poligonoValido`, cria água ou obstáculo e dá ID UUID |
| Validade | `poligonoValido` exige pelo menos três pontos, área mínima e ausência de cruzamentos |
| Área em planta | `areaPoligono` usa fórmula do cadarço: área horizontal em m² |
| Área inclinada | `areaSuperficie` soma `áreaHorizontal / cos(inclinação)` por água |
| Águas | Usuário cria, nomeia implicitamente e seleciona cada água; inclinação/azimute são informados, inicialmente zero |
| Obstáculos | Polígonos manuais com altura informada, inicialmente 1 m; sem classificação automática de árvore/chaminé |
| Calibração | Dois pontos e distância conhecida; também há escala aproximada automática para Static Maps |
| Edição | Remoção de água/obstáculo, propriedades, desfazer e correção do rascunho; não foi encontrado arrasto de vértices de contorno já fechado no editor atual |
| Persistência | JSONB versionado com geometria local, fotografia própria opcional e parâmetros; mapper/API presentes, round-trip real não testado |

O resultado inclinado não é área extraída de uma malha real: pressupõe água plana com inclinação uniforme e correta. Águas sobrepostas podem ser somadas duas vezes; não foi encontrada validação de interseção entre águas. Não há detecção automática de orientação/inclinação no editor atual.

O backend Google possui identificação automática por `roofSegmentStats`, áreas, azimutes e inclinações devolvidos pelo fornecedor. `telhadoPorCoordenada` copia `stats.areaMeters2` e `wholeRoofStats.areaMeters2`; não recalcula áreas nem conserva contorno real dos segmentos. O código trata esses valores como superfície do telhado, mas não há verificação independente da medição ou confirmação ao vivo do contrato do fornecedor. A máscara é inferida de centros dos painéis retornados, não de polígonos reais de borda.

Não existe número único e tecnicamente garantido de “área útil”: o modo manual aplica exclusão de obstáculos/recuos ao encaixe; o Google fornece `maxArrayAreaMeters2`, e o layout antigo aproxima área aproveitável pela máscara. Nenhum desses resultados demonstra capacidade estrutural ou área legalmente liberada para instalação.

## 5. Visualização 3D

Não foram encontrados renderer WebGL, modelos glTF/OBJ, malhas de telhado, DSM consumido, nuvem de pontos, tiles 3D ou integração Google 3D Maps no fluxo examinado. A tipologia de telhado e o ano de construção são metadados, sem geração de volume.

`FiguraLevantamento` e `TelhadoSatelite` desenham polígonos SVG sobre raster. Inclinação altera área e projeção dos módulos no modo manual, mas não produz coordenada Z. A altura do obstáculo serve à sombra aproximada; não cria edificação tridimensional. Não há altura do imóvel, câmera orbital, perspectiva, módulos 3D, importação BIM ou entorno volumétrico.

O mapa Google legado também é em planta: `EditorTelhado.tsx:333` instancia Maps com inclinação zero e rotação desativada. Portanto não é correto classificá-lo como visualização 3D apenas por usar Google Maps ou dados provenientes de uma análise externa de elevação.

## 6. Simulação solar e sombreamento

### Posição do Sol e incidência

`src/utils/posicaoSolar.ts`, `posicaoSolar`, implementa aproximação indicada no comentário como NOAA: dia do ano, equação do tempo, declinação, hora solar, ângulo horário, elevação e azimute. Recebe data, hora, latitude, longitude e fuso informado; não resolve fuso geográfico nem horário de verão automaticamente, e não aplica refração atmosférica.

`incidenciaDireta` usa:

`max(0, sin(elevação)cos(inclinação) + cos(elevação)sin(inclinação)cos(azimuteSolar − azimuteÁgua))`.

Sol abaixo do horizonte retorna zero. É um fator angular adimensional; não é irradiância em W/m² nem energia anual. `SimulacaoSolar` permite data e hora em passos de 15 minutos, fuso UTC−5 a UTC−2, mostra elevação/azimute e constrói trajetória diária com 97 amostras. Cores por água representam incidência instantânea; não há mapa espacial de irradiância por pixel ou célula.

### Sombras

`FiguraLevantamento` calcula comprimento `altura / tan(elevação)`, desloca o polígono do obstáculo em direção oposta ao Sol e une topo/arestas para pintar sombra. O desenho é recortado somente para águas com `inclinação === 0`. Não há ray tracing, diferença de cotas entre águas, relevo, árvores em volume ou edifícios vizinhos obtidos automaticamente. Obstáculos cadastrados manualmente podem representar elementos do entorno apenas nessa simplificação de plano comum.

As sombras não são integradas à incidência numérica nem à geração HSP. Não há percentual sombreado por painel, curva de perda elétrica, bypass, mismatch ou integração temporal/anual das sombras. A opção visual permanece disponível mesmo com telhado inclinado, mas essas águas não recebem projeção.

### Energia e economia

`src/utils/solar.ts`, `dimensionar`, executa:

1. `geracaoPorKwp = 30 × HSP × (1 − perdasPct/100)`.
2. Sem levantamento aplicado: quantidade = teto do consumo dividido pela geração por módulo.
3. Com levantamento aplicado: quantidade = número de placas desenhadas.
4. Potência = quantidade × Wp / 1000, arredondada a duas casas.
5. Geração mensal = potência × geraçãoPorKwp, arredondada a kWh inteiro.
6. Área estimada = quantidade × largura × comprimento; não desconta recuos nem mede área do telhado.

Entradas vêm da proposta, concessionária e parâmetros de configuração (`SolarCosta_Concessionarias.hsp_media`, `SolarCosta_Parametros`), com valores editáveis na calculadora. A origem meteorológica, estação, período histórico e incerteza do HSP cadastrado não são comprovados pelo código. Os quantis de insolação Google só orientam prioridade do empacotamento antigo; não alimentam a geração dessa fórmula.

`PDFModal.tsx:585` mantém 12 fatores sazonais fixos, aplicados à média mensal, com comentário de que espelham `SolarCosta_PerfilGeracaoMensal`; o trecho não consulta essa tabela. A geração anual da projeção é média mensal × 12, com degradação `0.993^(ano−2026)` no PDF. Isto é estimativa parametrizada, sem série meteorológica própria por endereço.

`projetarEconomia` usa geração × tarifa, 12 meses e reajuste padrão de 6% por 25 anos. O PDF inclui outras despesas/degradação. O cenário econômico não constitui simulação elétrica completa nem comprovação de compensação integral de toda energia produzida.

## 7. Distribuição de módulos e inversores

### Editor atual

`distribuir` exige escala confirmada, percorre águas válidas, orienta a malha por azimute relativo ao norte e projeta comprimento com `cos(inclinação)`. Permite retrato/paisagem, espaçamento e recuo. `cabe` verifica todos os vértices, cruzamento de arestas em concavidades e distância de bordas/obstáculos; `sobrepoe` recusa colisões. `inserirPlaca` aplica as mesmas verificações para inclusão por clique.

Limites: até 2000 módulos e teto de tentativas do algoritmo; preenchimento guloso por ordem das águas, uma fase da malha, sem otimização global. A quantidade obtida não é prova de máximo matemático. Não há arrasto de módulo ou rotação livre de módulo existente no editor manual atual; é possível excluir/inserir e redistribuir em paisagem.

O editor cadastra modelo textual, dimensões, Wp e peso; há campos opcionais `produtoId` e `stringId` no contrato, mas não foi localizada interface que vincule automaticamente essas informações ao catálogo ou crie strings. `SuppliersProductsView`, `types.ts` e `catalogo.routes.ts` apresentam potência/categoria de produto, sem cadastro estruturado de largura/comprimento no contrato de produto examinado. O usuário informa dimensões no levantamento.

Aplicar o levantamento atualiza quantidade efetiva, Wp, potência, geração e área na calculadora. Linhas avulsas de módulos acompanham quantidade pelo efeito do dimensionamento; componentes de kit fechado são preservados. `validarProposta`, linhas 632–639, confere contagem de módulos do kit versus levantamento antes de gerar PDF. Rascunho/salvamento automático passam por validação menos restritiva. Essa comparação verifica quantidade, não equivalência de dimensões/modelo/Wp nem compatibilidade elétrica.

### Código antigo

`layoutModulos.calcularLayout` projeta lat/lng em plano local equirretangular e preenche segmentos por insolação mediana, com área como desempate. Usa discos ao redor dos centros de placas Google como máscara e testa centro/quatro cantos de cada módulo candidato. Não possui contorno exato, exclusão manual de obstáculos ou modelo estrutural. `criarModulo` usa dimensões em plano, sem fator de inclinação equivalente ao motor manual.

`edicaoLayout.ts` permite mover/adicionar/remover módulos, girar e transladar arranjos, redimensionar e ajustar quantidade. Permite sair da máscara intencionalmente com aviso. A colisão de `sobrepoe` retorna falso entre segmentos diferentes; giro e translação de arranjos não refazem validação global. Esses recursos estão no editor antigo, sem montagem comprovada no fluxo atual.

### Strings e inversores

Inversores são produtos/composição de kits e aparecem em documentos/obras. Não foram encontrados dimensionamento por MPPT, checagem de Voc/Vmp/Isc em temperatura, razão DC/AC, seleção automática de inversor, agrupamento elétrico de strings ou diagrama unifilar gerado a partir do layout. `stringId` opcional isolado é apenas capacidade do schema, não implementação dessas funcionalidades.

## 8. Integrações externas e custos

Situação abaixo separa código existente de operação externa, que não foi testada. Não foram lidos valores de credenciais. Presença de variáveis e flags não comprova serviço habilitado/faturado.

| Serviço/fornecedor | Finalidade e endpoint/SDK | Implementação | Situação atual | Cache e limites | Cobrança identificável no projeto |
|---|---|---|---|---|---|
| Google Geocoding | Endereço → coordenadas; `maps.googleapis.com/maps/api/geocode/json` | `googleSolar.geocodificar`, `solar.routes.ts`, `LevantamentoManual.buscarSatelite` | Integrado ao fluxo atual; operação externa não verificada | PostgreSQL 24 h por endereço normalizado; requisições simultâneas compartilhadas; texto 3–300 caracteres | Serviço externo potencialmente pago por consultas; sem tabela de preços ou controle financeiro no código |
| Google Static Maps | Raster satélite; `maps.googleapis.com/maps/api/staticmap` | `googleSolar.imagemSatelite`, rotas solar e documento público | Integrado ao editor/PDF; operação externa não verificada | Header privado de 24 h; sem cache binário compartilhado no servidor; zoom 16–20, até 640 lógico e scale 2 | Potencial consumo por nova consulta upstream; preço/contrato não identificado |
| Google Solar API | Segmentos e potencial; `solar.googleapis.com/v1/buildingInsights:findClosest` | `googleSolar.telhadoPorCoordenada`, `/api/solar/telhado`, `PainelTelhado` | Backend implementado; painel não montado na calculadora atual | JSON PostgreSQL 24 h, chave lat/lng com 6 casas, HIGH | Sem orçamento, métrica de custo ou preço cadastrado |
| Google Maps JavaScript | Mapa interativo satélite | `useGoogleMaps.carregar`, `EditorTelhado` | Código antigo presente, sem acesso pelo painel atual | Script compartilhado por aba; timeout 20 s; instâncias de mapa não têm orçamento próprio | Comentários reconhecem cobrança de Dynamic Maps; valores não identificados |
| Google 3D Maps / Photorealistic 3D Tiles | Entorno/modelo 3D | Nenhuma chamada encontrada | Ausente | Não aplicável | Não aplicável |
| Mapbox | Mapas/imagens | Nenhuma implementação encontrada | Ausente | Não aplicável | Não aplicável |
| MapTiler | Mapas/imagens | Nenhuma implementação encontrada | Ausente | Não aplicável | Não aplicável |
| Bing / Azure Maps | Mapas/imagens | Nenhuma implementação encontrada | Ausente | Não aplicável | Não aplicável |
| Dados meteorológicos/solares externos | Irradiância/séries meteorológicas | Nenhuma integração encontrada para PVGIS, NASA POWER ou API meteorológica no fluxo | Ausente; HSP é cadastro/entrada | Não aplicável | Não aplicável |
| Google GenAI | IA/processamento de imagens | Apenas dependência `@google/genai` | Dependência declarada, sem uso localizado | Não localizado | Nenhum consumo demonstrado |
| ViaCEP | Completar endereço por CEP; `viacep.com.br` | `src/services/cep.ts`, calculadora | Implementação acessível; serviço não testado | Não confundir consulta de CEP com geocoding do imóvel | Não identificado no projeto |

Outras integrações do CRM: uazapi/WhatsApp (`server/src/services/uazapi.ts` e serviços WhatsApp) e Banco do Brasil (`server/src/services/bb/`), além de geração de PDF com Chromium. Não participam da medição/irradiância e não foram auditadas integralmente neste escopo.

### Consumo, concorrência e licenciamento

`consultarCacheGoogle` mantém transação SQL e `pg_advisory_xact_lock` durante a consulta externa; limpa registros expirados, lê cache e grava resposta por 24 h. Evita duplicidade entre processos, mas pode ocupar conexões e manter esperas enquanto o Google demora. Não há `AbortController`/timeout no fetch desses serviços. Falhas externas não são armazenadas, permitindo repetição de chamadas sem cobertura.

No router autenticado não foi encontrado rate limit específico, cota individual, contador de chamadas, orçamento ou alarme financeiro. No acesso público à imagem há `limiteDocumento` e token válido; coordenadas são lidas do banco, evitando proxy arbitrário por query. Isso limita abuso, sem eliminar consumo repetido por links válidos.

Os comentários do projeto afirmam permissões de armazenamento/cache e classificam dados derivados como próprios. **Esses comentários não comprovam conformidade contratual.** A retenção de respostas/derivados, imagens em PDFs e atribuição deve ser confrontada com os termos aplicáveis da conta; esta análise não validou contratos nem preços atuais e não afirma que um TTL específico seja permitido.

`FiguraLevantamento` tenta preservar créditos numa faixa inferior separada; no componente legado a sobreposição ocupa a imagem. `src/sw.ts` usa CacheFirst genérico para `request.destination === 'image'`, até 30 dias: pode capturar imagens públicas de telhado carregadas diretamente por URL, apesar do comentário de que APIs não são cacheadas. Imagens autenticadas obtidas por fetch/blob têm outro caminho. É um risco concreto de divergência entre política pretendida e cache efetivo, a verificar com SW ativo.

## 9. Fluxo funcional atual

| Etapa / ação do usuário | Execução e APIs | Cálculos | Dados armazenados e apresentados | Limitações |
|---|---|---|---|---|
| Abrir proposta | `App.tsx` resolve `propostas/:propostaId/editar`; API carrega proposta/itens/configuração | Reconstitui estado e dimensionamento | Entradas e snapshots previamente persistidos | Proposta individual não acessada neste diagnóstico |
| Informar cliente/endereço/consumo | Campos de calculadora; ViaCEP quando utilizado | HSP, perdas, Wp e consumo dimensionam quantidade | Dados comerciais e resultados vão à proposta | Endereço postal não garante ponto exato no telhado |
| Abrir levantamento | Monta `LevantamentoManual` com clone do snapshot ou estado novo | Planta inicial 30 × 20 m sem escala confirmada | Estado local do modal; ainda precisa aplicar | Não ativa reconhecimento automático Solar API |
| Buscar endereço ou coordenadas | Geocoding quando necessário, depois Static Maps via backend | Escala Web Mercator | Mostra raster e salva referência de localização/zoom no estado | Data de captura desconhecida; confirmar imóvel e escala |
| Importar imagem própria | Browser usa createImageBitmap e Canvas 2D; nenhuma API de IA | Redução e calibração por distância | JPEG limitado em base64, nome e geometria | Escala depende de referência confiável; troca limpa contornos |
| Desenhar águas/obstáculos | Cliques SVG e fechamento; sem API externa | Validade de polígono, área plana e correção por inclinação | Contornos, inclinação/azimute e alturas informadas | Sem detecção automática nem edição de vértices fechados comprovada |
| Simular luz | Funções locais de posição solar e projeção de sombras | Elevação/azimute, incidência e comprimento da sombra | Parâmetros de data/hora/fuso ficam no levantamento; mostra cores e sombra | Somente sombras em águas planas; não altera geração |
| Distribuir ou inserir placas | Motor local, retrato/paisagem e exclusão por clique | Contenção, recuo, colisão e projeção inclinada | Posições e quantidade no snapshot | Heurística limitada a 2000; não otimiza elétrica |
| Aplicar levantamento | Callback atualiza proposta em memória e limpa resultado de telhado antigo | Potência/geração usam placas aplicadas | Prévia, área real estimada, kWp e kWh | Aplicar no modal não é gravação independente; autosave da calculadora pode gravar depois |
| Ajustar kit/inversor | Seleção de catálogo e kits | Totais/preço; comparação de quantidade antes do PDF | Itens e componentes persistidos junto da proposta | Sem validação elétrica nem vínculo automático de dimensões |
| Salvar/gerar PDF | `salvar`, `onSaveProposal`, mappers e rotas SQL; PDF após sucesso | Economia/financiamento e gráficos | Snapshot, itens, resultados; imagem satélite pode ser requisitada novamente | Autosave 30 s; rascunhos aceitam inconsistências bloqueadas na emissão |
| Reabrir/compartilhar documento | Recupera JSON e, se satélite, solicita imagem; token público para imagem externa | Mantém geometria persistida | PDF/visualização do levantamento ou layout antigo | Foto atual pode diferir da usada no desenho; persistência real não testada |

## 10. Matriz completa de funcionalidades

“Implementado e funcional” abaixo significa comportamento comprovado no código e, quando aplicável, nos testes locais. Não certifica sucesso da API paga ou do banco em todas as instalações. Recursos cuja cadeia externa não foi exercitada recebem ressalva explícita.

| Funcionalidade | Situação atual | Tecnologia utilizada | Arquivo principal | Limitação |
|---|---|---|---|---|
| Rota de edição de proposta | Implementado parcialmente | React Router / REST | `src/App.tsx` | HTML 200; proposta autenticada não verificada |
| Endereço → coordenadas | Implementado parcialmente | Google Geocoding | `server/src/services/googleSolar.ts` | Operação externa não verificada |
| Endereço por CEP | Implementado parcialmente | ViaCEP | `src/services/cep.ts` | Não identifica telhado; rede não testada |
| Imagem satélite | Implementado parcialmente | Static Maps / proxy | `server/src/services/googleSolar.ts` | Rede/licença/credenciais não confirmadas |
| Imagem própria | Implementado e funcional | Canvas 2D/JPEG | `src/components/mapa/LevantamentoManual.tsx` | Sem QA visual; compressão e calibração necessárias |
| Múltiplos provedores de satélite | Não implementado | — | `server/src/services/googleSolar.ts` | Apenas Google |
| Zoom e movimento da planta | Implementado e funcional | SVG viewBox | `src/components/mapa/CanvasTelhado.tsx` | Ampliação digital; testes da câmera aprovados |
| Rotação de mapa/perspectiva | Não implementado | — | `CanvasTelhado.tsx`, `EditorTelhado.tsx` | Mapa antigo também desativa rotação |
| Reconhecimento automático de telhado | Implementado parcialmente | Solar Building Insights | `server/src/services/googleSolar.ts` | Backend existe; painel fora do fluxo atual |
| Desenho manual de águas | Implementado e funcional | SVG + geometria própria | `LevantamentoManual.tsx` | Cliques; sem arrasto dos vértices fechados |
| Identificação automática de águas/inclinação | Implementado parcialmente | roofSegmentStats | `server/src/services/googleSolar.ts` | Apenas fluxo antigo/backend; não verificado ao vivo |
| Inclinação e azimute manuais | Implementado e funcional | Formulários | `LevantamentoManual.tsx` | Dependem da informação do usuário |
| Área horizontal | Implementado e funcional | Cadarço | `server/src/domain/levantamentoTelhado.ts` | Precisão depende da escala |
| Área de superfície inclinada | Implementado e funcional | Área / cos(inclinação) | Mesmo motor, `areaSuperficie` | Águas planas; sem deduplicar águas sobrepostas |
| Área útil/capacidade exata | Implementado parcialmente | Recuos e encaixe heurístico | Mesmo motor, `distribuir` | Quantidade obtida não é máximo garantido |
| Obstáculos manuais | Implementado e funcional | Polígonos e altura | `LevantamentoManual.tsx` | Sem reconhecimento automático |
| Recuperação e gravação de medições | Implementado parcialmente | JSONB / mappers / Zod | `server/src/routes/propostas.routes.ts` | Contrato testado; round-trip no banco não exercitado |
| Visualização/modelo 3D | Não implementado | — | `FiguraLevantamento` | Representação 2D |
| Altura real de edificação/entorno | Não implementado | — | `server/src/domain/levantamentoTelhado.ts` | Só altura manual dos obstáculos |
| Posição solar diária/anual por data | Implementado e funcional | Aproximação NOAA | `src/utils/posicaoSolar.ts` | Sem refração; fuso informado |
| Irradiância física horário/mês | Não implementado | — | `src/utils/solar.ts` | HSP não é motor de irradiância |
| Cor por incidência relativa | Implementado e funcional | Produto angular / SVG | `SimulacaoSolar.tsx`, `FiguraLevantamento` | Não é heatmap físico de energia |
| Sombras por horário | Implementado parcialmente | Projeção 2D por altura | `LevantamentoManual.tsx` | Apenas águas planas; não reduz geração |
| Sombras 3D de árvores/prédios | Não implementado | — | `FiguraLevantamento` | Sem entorno volumétrico |
| Orientação ideal otimizada | Não implementado | — | `src/utils/layoutModulos.ts` | Ordenar insolação antiga não otimiza azimute |
| Potência e geração mensal | Implementado e funcional | Wp × quantidade; HSP | `src/utils/solar.ts` | Estimativa simplificada e perdas globais |
| Produção anual e mensal sazonal | Implementado parcialmente | Fatores fixos / degradação | `src/components/PDFModal.tsx` | Sem dados meteorológicos locais |
| Perdas por sombra/mismatch/temperatura horária | Não implementado | — | `src/utils/solar.ts` | Apenas percentual global |
| Comparação persistida de cenários | Não implementado | — | `ProposalCalculatorView.tsx` | Editar entradas permite experimentar, sem comparador dedicado |
| Seleção comercial de módulos/inversores | Implementado e funcional | Catálogo / kits | `ProposalCalculatorView.tsx` | Sem seleção elétrica automática |
| Dimensões/peso do módulo no levantamento | Implementado e funcional | Campos e JSON | `LevantamentoManual.tsx` | Sem importação automática de datasheet |
| Distribuição automática de módulos | Implementado e funcional | Malha e contenção | `server/src/domain/levantamentoTelhado.ts` | Teto de iteração; não globalmente ótima |
| Inclusão/exclusão por clique | Implementado e funcional | SVG / inserirPlaca | `LevantamentoManual.tsx` | Sem movimentação livre de placa existente |
| Rotação/arrasto de módulos antigos | Implementado parcialmente | Maps JS / geometria local | `EditorTelhado.tsx`, `edicaoLayout.ts` | Fora do fluxo atual; limites menos estritos |
| Bordas, recuos, obstáculos no modo atual | Implementado e funcional | cabe / distância de segmentos | `server/src/domain/levantamentoTelhado.ts` | Recuos em planta; precisão depende da medição |
| Compatibilidade geométrica completa no servidor | Implementado parcialmente | Zod / superRefine | `server/src/schemas/levantamentoTelhado.ts` | Não comprova forma/dimensão física de cada placa |
| Strings/MPPT e validação de inversores | Não implementado | — | Schema contém apenas `stringId` opcional | Sem lógica ou interface elétrica encontrada |
| IA de reconhecimento de imagens | Não implementado | Dependência GenAI sem uso | `package.json` | Instalação declarada não comprova função |
| Google 3D, Mapbox, MapTiler, Bing/Azure | Não implementado | — | Busca em `src`, `server/src` e manifestos | Nenhuma integração encontrada |
| APIs Google habilitadas e cobrando nesta conta | Não foi possível verificar | Configuração externa | `server/src/config.ts` | Não foram consultadas credenciais/conta |

## 11. Problemas e limitações identificados

### Relevância alta para integridade técnica

1. **Reconhecimento automático não está no caminho da tela atual.** A importação de `PainelTelhado` e comentários antigos podem induzir análise equivocada. Evidência: calculadora monta somente `LevantamentoManual`; `buscarSatelite` não chama `/telhado`. Impacto: não prometer automação apenas porque serviço e componente existem.
2. **Resultados energéticos aceitos do cliente sem reconciliação técnica completa.** `propostaSchema` valida faixas de potência/quantidade/geração, mas não refaz HSP × Wp × quantidade nem verifica equivalência com `levantamento_telhado`. Impacto: requisição direta pode persistir resumo divergente da geometria. O frontend verifica contagem somente na emissão, não em todo rascunho.
3. **Quatro pontos não provam um módulo fisicamente correto.** O schema valida contenção/colisão, mas não exige que as quatro posições formem retângulo com dimensões e inclinação correspondentes ao módulo declarado; não chama `poligonoValido` para placas como faz com águas/obstáculos. Pode aceitar placas artificialmente pequenas ou degeneradas em payload direto.
4. **Sombras não alteram kWh.** `FiguraLevantamento` só desenha; `dimensionar` ignora localização, azimute, inclinação e sombra. Impacto: a imagem pode sugerir desempenho que a estimativa numérica não considera.
5. **Geometria com precisão condicionada.** Escala de solo em imagem satélite, calibração por usuário e inclinação manual não substituem levantamento topográfico. Águas sobrepostas não são recusadas, podendo duplicar área. Peso cadastrado não gera verificação de cargas/estrutura.
6. **Dois motores com premissas diferentes.** Modo manual projeta módulo por cos(inclinação); modo antigo desenha dimensões diretamente em plano e usa máscara circular, sem borda exata. `edicaoLayout.sobrepoe` ignora colisão entre segmentos e permite sair da máscara. Isso explica diferenças possíveis de capacidade e de aparência entre propostas antigas e novas.

### Matemática comercial e coerência de resultados

7. **Projeção acumulada do PDF não soma economias anuais.** Em `PDFModal.tsx:617`, `acumuladoSemPoup` usa economia do ano atual × número de anos, com investimento subtraído apenas quando o ano é 2026. Assim deixa de manter o investimento nos anos seguintes e ignora a soma das economias heterogêneas anteriores. `acumuladoComPoup` multiplica por 1,003, sem série composta de aportes. Não equivale à acumulação de `projetarEconomia`.
8. **Horizonte fixado em 2026–2050.** A projeção longa/degradação/manutenção está ancorada em anos literais no PDF, não na data de emissão da proposta. Pode envelhecer incorretamente.
9. **Sazonalidade duplicada.** Fatores literais do PDF alegam espelhar tabela SQL; podem divergir do cadastro. Não há fonte regional dinâmica nesse trecho.
10. **Área estimada tem fallback diferente da geometria física.** `dimensionar` usa 2,58 × 2,25 m sem dimensões fornecidas; o editor novo inicia 1,30 × 2,38 m e o legado consulta parâmetros 2,38 × 1,30 m. V005 descreve a área maior como incluindo circulação, mas a função a trata como produto de dimensões. O significado da área pode mudar conforme exista levantamento.
11. **Modelo econômico simplificado.** Economia por geração × tarifa não limita automaticamente à energia efetivamente compensável, nem incorpora toda regra tarifária; PDF e calculadora usam premissas diferentes de degradação/manutenção. Não é uma conclusão sobre a legislação, mas uma limitação da fórmula observada.
12. **Sem garantia de rendimento/capacidade máxima.** Malha gulosa e limites de tentativas podem interromper busca; não exploram todas as rotações/fases ou otimização entre águas. A orientação correta do encaixe para azimutes oblíquos e diferentes nortes merece testes dedicados: os testes observados não demonstram validação exaustiva dessas combinações.

### Integração, desempenho e consumo

13. **Sem cache binário compartilhado de Static Maps.** Cada chamada que alcançar `imagemSatelite` faz fetch externo. Headers de navegador não evitam solicitações de usuários/processos diferentes ou geração de PDF. Reabertura/reimpressão pode gerar consumo repetido.
14. **Transação e conexão SQL durante fetch externo.** `cacheGoogle.ts` segura lock transacional enquanto espera Google; sem timeout próprio. Impacto: concorrência, pool ocupado e atrasos de outros pedidos. Expirados são apagados em cada consulta, inclusive hits; o cache é uma operação de escrita.
15. **Sem cota/orçamento solar próprio.** Login impede acesso anônimo às rotas privadas, mas não há limite de gastos por usuário ou coordenadas; falhas repetidas não possuem cache negativo.
16. **Cache PWA de imagens mais amplo que comentários.** Matcher global de imagens aceita rota pública de telhado e TTL de 30 dias; pode contrariar a intenção de 24 h e persistir referências por token no aparelho compartilhado. Efeito real depende de SW e caminho de carregamento.
17. **A imagem do satélite não é congelada com o projeto.** Geometria e coordenadas ficam persistidas; imagem é recarregada. Reprocessamento do mapa pode deslocar referência visual ou mostrar obra posterior. A data de análise Google não comprova data da imagem Static Maps.
18. **Custo computacional geométrico cresce com o layout.** Distribuição consulta obstáculos e módulos já inseridos repetidamente; schema verifica colisão par a par. Em milhares de placas/centenas de polígonos, browser/API podem bloquear por tempo perceptível; não há índice espacial/workers nesse motor.
19. **Imagem base64 aumenta payload e histórico local.** Até 450 mil caracteres no JSON, clonado por structuredClone a cada edição/desfazer (até aproximadamente 30 estados) e enviado em salvamentos. Parser global aceita 2 MB; geometrias muito complexas mais imagem podem alcançar o limite antes dos máximos individuais do schema.
20. **Carregador antigo pode não recuperar script pendente após timeout.** Em `useGoogleMaps.carregar`, erro de rede remove script, mas timeout mantém elemento com mesmo ID. Nova tentativa com script existente apenas aguarda callback/timeout, sem reinserção; recuperação não é garantida naquele estado.
21. **Contrato de zoom desalinhado.** Router aceita 21, serviço limita a 20; clientes que calculassem escala em 21 poderiam desalinhá-la da imagem devolvida. A interface atual até 20 evita esse caso no caminho usual.

### Manutenção, segurança e licenças

22. **Código e comentários antigos parcialmente desconectados.** Painel/editor legado e aviso de “buscar novamente” convivem com a nova interface; nomes não comprovam acessibilidade. Há duplicação de conceitos de layout, dados e interação, embora os utilitários solar/econômico tenham extração compartilhada útil.
23. **Dependência de IA sem uso encontrado.** `@google/genai` é candidata a revisão por falta de referências em código de aplicação; não foi removida nem declarada desnecessária em todos os contextos possíveis. Express/dotenv também aparecem no manifesto da raiz e servidor; isso merece inventário de scripts/build antes de qualquer remoção.
24. **Ausência de strict no frontend.** `tsconfig.json` não ativa strictNullChecks, e o schema contém comentário sobre inferência opcional nesse contexto. Compilar sem erro não demonstra ausência de estados inválidos em runtime.
25. **Termos de imagem e derivados não confirmados.** Comentários de ToS não são documentação contratual. Avaliar cache, persistência de áreas/orientações, impressão e atribuição com os termos reais da instalação; sem afirmar conformidade ou infração nesta análise.

## 12. Arquivos e componentes mais relevantes

| Caminho | Função/componente | Evidência técnica e dependências |
|---|---|---|
| `src/App.tsx` | Rota de proposta / carregamento lazy | Monta calculadora para criação/edição; React Router |
| `src/components/ProposalCalculatorView.tsx` | `ProposalCalculatorView`, `validarProposta`, `salvar` | Renderiza levantamento novo, calcula HSP, confere módulos na emissão e salva a cada 30 s |
| `src/components/mapa/LevantamentoManual.tsx` | `LevantamentoManual`, `FiguraLevantamento`, `buscarSatelite`, `calibrar` | Editor atual; importação Canvas, raster, desenho SVG e sombras |
| `src/components/mapa/CanvasTelhado.tsx` | `CanvasTelhado` | Navegação altera viewBox, com coordenadas físicas preservadas |
| `src/utils/cameraTelhado.ts` | `limitarCamera`, `aproximarCamera` | Limites e zoom ancorado; testados localmente |
| `server/src/domain/levantamentoTelhado.ts` | `areaPoligono`, `areaSuperficie`, `cabe`, `distribuir`, `inserirPlaca` | Motor puro em metros; polígonos/colisões/recuos/projeção |
| `src/utils/levantamentoTelhado.ts` | Reexportação do domínio | Compartilha implementação com backend, sem configuração/segreto |
| `server/src/schemas/levantamentoTelhado.ts` | `levantamentoTelhadoSchema`, `superRefine` | Zod, limites, IDs, contenção e colisão; não verifica datasheet |
| `src/components/mapa/SimulacaoSolar.tsx` | `SimulacaoSolar` | Inputs de data/hora/fuso, trajetória e cores relativas |
| `src/utils/posicaoSolar.ts` | `posicaoSolar`, `incidenciaDireta` | Aproximação geométrica sem meteorologia |
| `src/utils/solar.ts` | `dimensionar`, `projetarEconomia`, `parcelaFinanciamento` | Fórmulas HSP, economia e Price reutilizadas |
| `src/components/mapa/PainelTelhado.tsx` | `PainelTelhado`, `recalcular`, emissão de resultado | Fluxo anterior Google Solar, sem montagem atual encontrada |
| `src/components/mapa/EditorTelhado.tsx` | `EditorTelhado` | Maps JS em planta, módulo arrastável e ajustes de arranjo |
| `src/components/mapa/useGoogleMaps.ts` | `carregar`, `useGoogleMaps` | Script Maps remoto sob demanda, callback e timeout |
| `src/utils/layoutModulos.ts` | `criarPlano`, `criarModulo`, `calcularLayout`, `enquadrar`, `projetar` | Projeção local/máscara e sobreposição de módulos antigos |
| `src/utils/edicaoLayout.ts` | `criarContexto`, `moverModulo`, `girarSegmento`, `ajustarQuantidade` | Edição antiga sem restrição absoluta da máscara |
| `src/components/mapa/TelhadoSatelite.tsx` | `TelhadoSatelite` | Raster com SVG dos módulos em coordenadas projetadas |
| `src/services/solar.ts` | Adaptadores de geocoding/telhado/imagem | Cliente HTTP autenticado e object URL de imagem |
| `server/src/services/googleSolar.ts` | `geocodificar`, `telhadoPorCoordenada`, `imagemSatelite` | Fetch Google, normalização e checagem de chave no servidor |
| `server/src/services/cacheGoogle.ts` | `consultarCacheGoogle` | Lock SQL, expiração e persistência JSONB 24 h |
| `server/src/services/cacheConsulta.ts` | `CacheConsulta`, `normalizarEndereco` | Compartilha promises em voo; cache Google usa TTL de memória zero |
| `server/src/routes/solar.routes.ts` | `solarRouter` | Rotas autenticadas com schemas de endereço/coordenada/tamanho |
| `server/src/routes/propostas.routes.ts` | `propostaSchema`, handlers de criação/atualização | Persistência de entradas, saídas e levantamento |
| `src/services/mappers.ts` | `mapProposta` e conversão de payload | Leitura/escrita de layouts novos e antigos |
| `src/components/PDFModal.tsx` | `PDFModal`, fatores sazonais e projeção longa | Documento, layout e gráficos; fórmulas econômicas literais |
| `server/src/routes/publico.routes.ts` | `/documento/:token/telhado.png` | Imagem por token, rate limit e coordenadas do banco |
| `server/src/auth/`, `src/services/http.ts` | Tokens, middleware e cliente HTTP | JWT, refresh hash/rotação e permissões |
| `server/src/db.ts`, `database/migrations/` | Pool e schema | PostgreSQL, transações/auditoria e JSONB |
| `src/sw.ts` | Rotas Workbox | Casca PWA e regra genérica CacheFirst de imagens |
| `scripts/test-levantamento.ts` | Assertions locais | Evidência de casos geométricos/solares/câmera; não testa rede ou banco |

## 13. Funcionalidades aproveitáveis para evolução

Há base reutilizável sem evidência de necessidade de reconstrução completa:

- Motor geométrico puro compartilhado, com contenção em concavidades, obstáculos, recuos, escala e testes locais.
- Snapshot versionado em JSONB, mappers e validação Zod, integrados à proposta e aos documentos.
- Editor atual com imagem própria, calibração, desenho de águas e navegação independente do provedor de mapa.
- Cálculos de posição solar/incidência separados da UI, úteis como base geométrica, preservando suas limitações físicas.
- Proxy Google com chave no servidor e normalização de precisão; separação entre geocoding, análise e imagem.
- Cache compartilhado PostgreSQL com coalescência e locks, aproveitável após avaliação de tempo de transação/retention.
- Código antigo de Maps JS e edição de arranjos, passível de reaproveitamento seletivo; precisa reconciliar motores e conectividade da tela antes de ser tratado como recurso operacional.
- Dimensionamento/economia compartilhados com simulador público, catálogo e composição de kits, fluxo de PDF e infraestrutura de autenticação/auditoria.

Estes itens são ativos existentes, não uma proposta de implementação ou autorização para alteração.

## 14. Funcionalidades ainda não desenvolvidas

- Modelo tridimensional real do imóvel e entorno, alturas de edificação, importação de modelos e câmera em perspectiva.
- Reconhecimento automático próprio de telhado/obstáculos por IA; ativação de uma dependência não resolveria essa ausência.
- Integração de múltiplos provedores e ortofotos técnicas com qualidade/data verificáveis.
- Contornos reais automáticos de águas disponíveis ao editor atual; a Solar API antiga fornece segmentos e máscara aproximada.
- Modelo físico de irradiância/dados meteorológicos horários e anuais por endereço.
- Sombreamento sobre superfícies inclinadas e entorno em cotas distintas, perdas por painel/string e integração energética dessas perdas.
- Otimização global de arranjo/capacidade/orientação com comprovação das restrições.
- Projeto elétrico de strings/MPPT, validação térmica de tensões/correntes e dimensionamento de inversores.
- Comparador dedicado de cenários e rastreio da incerteza/origem dos dados solares.
- Vinculação completa de dimensões/modelos do layout ao catálogo e validação de coerência técnica no backend.
- Telemetria de consumo Google, orçamento/cotas individuais e cache binário compartilhado comprovado.

O estado atual sustenta levantamento geométrico e estimativa comercial simplificada. Não há evidência suficiente para classificá-lo como plataforma de simulação solar 3D ou de engenharia elétrica completa. Operação externa das APIs e a proposta específica permanecem não verificadas, conforme o escopo de somente leitura adotado.
