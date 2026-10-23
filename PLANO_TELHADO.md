# Levantamento e plano — localização e layout do telhado

## Implementação entregue em 23/10/2026

O editor foi unificado: busca de imagem por endereço/coordenadas e desenho usam a mesma área. Há escala Web Mercator calculada para a imagem (com confirmação/calibração pelo usuário), contornos, obstáculos, recuos, dimensões de módulos, distribuição e integração com geração/proposta/PDF. A imagem Google não é copiada para o JSON da proposta: é gravada a referência do enquadramento, e a imagem é requisitada novamente quando necessária; imagens próprias usam uma prévia raster com tamanho limitado.

A simulação geométrica usa as equações NOAA para posição solar por data, horário e fuso, compara incidência direta por água e projeta sombras de obstáculos de altura informada sobre águas planas. Não calcula sombras sobre águas inclinadas, perdas energéticas anuais por sombra ou irradiância meteorológica; as cores representam incidência relativa no instante escolhido. A geração comercial permanece pelo método HSP/perdas.

Testes: geometria, escala, posição solar, orientação e contrato de persistência; fluxo do editor no navegador com respostas Google simuladas (sem consumo). A consulta real a Google depende da sessão autenticada e da chave configurada. Catálogo técnico completo, strings/MPPT e simulação energética avançada continuam nas etapas de evolução abaixo.

Data: 23/10/2026. Tela: `/sistema/propostas/nova`.

Escopo desta entrega: levantamento do código atual, comparação com a reunião e plano para implementação. Nenhuma funcionalidade de produção foi alterada. A interface local não foi validada em navegador nem foram realizadas chamadas autenticadas às APIs pagas; os achados abaixo são de inspeção do código e da documentação dos provedores.

## Diretriz de custo

Priorizar operação sem novas assinaturas ou consumo obrigatório de APIs pagas. Isso é possível para desenho manual, imagem fornecida pelo usuário, distribuição de módulos, estimativas e dimensionamento elétrico próprio. Não equivale a custo total zero: desenvolvimento, armazenamento e processamento utilizam recursos existentes.

Não prometer análise automática completa de qualquer endereço com imagens recentes gratuitas. Google Solar exige faturamento habilitado e cobra por uso conforme SKU; franquias não garantem gratuidade permanente. Manter a integração atual como opção administrável, desativável no fluxo sem consumo pago, sem consultas automáticas nesse modo. O editor manual deve funcionar sem chave, internet ou retorno Solar após carregar seus dados locais.

## Situação atual e diferenças

| Recurso da reunião | Encontrado no sistema | Ajuste necessário |
|---|---|---|
| Endereço e localização | Geocoding no servidor, coordenada e imagem de satélite | Entrada direta de coordenadas e confirmação do imóvel; não depender de geocodificação paga |
| Avaliação automática | Building Insights do Google Solar | Separar resultado externo de levantamento manual e registrar procedência |
| Área, orientação e inclinação | Segmentos solares já carregam esses dados | Exibir valores por água; permitir polígonos e valores manuais; distinguir área em planta, superfície inclinada e área disponível |
| Medição do telhado | Capacidade aproximada por máscara de posições Google | Desenhar e editar contornos reais, cotas, recuos e obstáculos |
| Tipologia e ano da construção | Campo de telhado existente; sem identificação automática comprovada | Separar material de cobertura de tipologia; ano informado pelo usuário, opcional; número de segmentos não comprova tipologia |
| Imagem própria/drone | Não identificado no fluxo do editor | Upload com calibração de escala, norte e pontos de referência; ortofoto quando disponível |
| Fontes alternativas | Google Static Maps e Maps JS | Adaptador de fundo e imagem própria; não presumir licença de uso de Google Earth, Apple, Bing ou Mapbox |
| Painéis automáticos/manuais | Já existem distribuição, inclusão, remoção, movimento, giro, desfazer/refazer e capacidade máxima | Reaproveitar operações; trocar máscara aproximada por contorno com exclusões e validar módulo inteiro |
| Datasheet do módulo | Produto tem potência; editor permite dimensões; sem ficha técnica completa no tipo Produto | Vincular dimensões, potência e peso ao produto selecionado e congelar ficha na proposta |
| Geração e potencial anual | Cálculo por HSP/perdas na calculadora; insolação por segmento disponível | Calcular com quantidade realmente aplicada e modelo escolhido; estimativa mensal/anual por água, com premissas explícitas |
| Caminho do Sol e sombras | Não identificados | Posição solar por data/hora; sombras somente com alturas e geometria disponíveis |
| Mapa de calor | Sem camada espacial de irradiância identificada | Primeiro comparar águas; camada detalhada exige modelo espacial ou dados externos |
| Strings e inversores | Catálogo e itens comerciais existentes; sem editor de strings identificado | Cadastro elétrico, associação por MPPT/entrada e regras por tipo de inversor |
| Persistência e PDF | Layout, segmentos e imagem já previstos em proposta | Salvar levantamento completo, equipamentos, premissas e circuitos sem alterar propostas antigas |

## Evidências e pontos de atenção

- `src/components/mapa/PainelTelhado.tsx`: coordena busca e resultados; a abertura do editor depende de telhado e chave Maps. O próprio fluxo mantém o dimensionamento separado do layout.
- `src/components/mapa/EditorTelhado.tsx`: editor já funcional no código, com mapa Google, módulos e ajustes; recebe dimensões por propriedades, não uma ficha de equipamento completa.
- `src/utils/layoutModulos.ts` e `src/utils/edicaoLayout.ts`: funções geométricas reutilizáveis; máscara baseada em posições de painéis Google é aproximação, não levantamento do limite físico do telhado.
- `src/utils/solar.ts`: área estimada usa constantes de 2,58 × 2,25 m. Substituir pela dimensão efetiva do módulo; não confundir área de placas com área necessária incluindo recuos.
- `src/services/solar.ts`: legenda usa ano de processamento ou até ano corrente sem data; isso não comprova captura recente. Separar data da imagem, processamento e consulta; ausência deve aparecer como desconhecida. Revisar também os textos de imagem atual em `PainelTelhado.tsx`.
- `src/types.ts`, `src/services/mappers.ts`, `server/src/routes/propostas.routes.ts`: estender de ponta a ponta, incluindo validação, leitura e gravação. Não basta acrescentar campos no React.
- `server/src/services/googleSolar.ts`: já integra Geocoding, Building Insights e Static Maps; não foi identificada integração Data Layers nesse serviço. Revisar a política de cache/persistência por produto e conteúdo, sem assumir um prazo universal pelos comentários existentes.
- Migrações V005/V007 já dão base para geolocalização e layout manual. A próxima migração deve usar o próximo número disponível na ocasião da implementação.

## Plano de implementação em ordem

### 1. Base independente e correções de coerência

Manter React/Vite, Express e PostgreSQL existentes. Não introduzir Next.js, FastAPI, PostGIS ou IA apenas para reproduzir o fluxo. Criar modelo de levantamento independente de `TelhadoSolar`, com versão, origem, referência espacial, imagem, escala, águas, obstáculos, módulos e premissas.

Adicionar modo sem APIs pagas na configuração efetiva do servidor e cliente. Bloquear buscas automáticas nesse modo e oferecer desenho livre e imagem própria. Corrigir datas/legendas e dimensões fixas. Planejar adaptador do editor para fundo de imagem em SVG/canvas e manter Google como opção existente.

Aceite: criar um levantamento sem chave Google; propostas antigas continuam abrindo; nenhuma chamada Google ocorre no modo sem consumo pago; datas desconhecidas não aparecem como atuais.

### 2. Telhado manual, imagem e catálogo físico

Desenhar/editar cada água como polígono; informar inclinação, azimute e tipologia. Calibrar foto com distância conhecida e norte; sem referência métrica, não permitir exibir medidas como validadas. Foto oblíqua exige retificação ou levantamento adequado, não apenas uma escala global.

Cadastrar obstáculos e zonas excluídas; aplicar recuos configuráveis e espaçamento entre módulos. Guardar unidade e convenção de azimute. Calcular área em planta e superfície inclinada sem aplicar a correção duas vezes a dados externos.

Estender cadastro de produtos com fabricante/modelo, comprimento, largura, espessura e peso; armazenar fonte e revisão do datasheet. Equipamentos sem dimensão devem pedir preenchimento antes do layout físico.

Aceite: polígono em L, água inclinada e obstáculo central medidos corretamente; escala conhecida reproduz distância; troca de produto muda dimensões sem inventar valores ausentes.

### 3. Distribuição e integração com a proposta

Reutilizar empacotamento e operações atuais sobre a nova geometria. Validar contenção integral do retângulo, interseções com bordas/obstáculos e colisões, inclusive em polígonos côncavos; checar somente centro ou quatro cantos é insuficiente. Usar projeção coerente da placa sobre a água inclinada. Suportar retrato/paisagem, quantidade alvo e preenchimento por água; em telhado plano, prever inclinação de montagem e distância entre fileiras.

Dar identificador estável a cada módulo para futuras strings. Mostrar capacidade máxima separada de quantidade instalada. A ação “Aplicar layout à proposta” deve reconciliar quantidade, potência, itens/kit, geração e valores conforme regras comerciais explícitas; alterações devem ser revisáveis antes de salvar, especialmente em kits de preço fechado. Não alterar silenciosamente componentes do kit.

Aceite: reduzir 42 para 20 módulos atualiza potência e geração; lista comercial e PDF ficam coerentes; nenhuma placa atravessa recuo ou obstáculo; desfazer/refazer preserva IDs.

### 4. Potencial solar e geração

Primeiro manter HSP/perdas existentes como método aproximado, com geração mensal e anual claramente identificadas como estimativas. Se houver dados de irradiância e modelo de transposição adequados, evoluir para cálculo por orientação/inclinação de cada água. Não criar fatores arbitrários para aparentar precisão. Registrar fonte, período climático, perdas, método e versão do cálculo.

Mostrar comparação de exposição por água com legenda própria. Não chamar cores por segmento de mapa espacial de sombreamento. Um mapa detalhado pode vir posteriormente de simulação sobre malha ou camadas externas opcionais.

Aceite: geração usa potência instalada efetiva; entradas e versão permitem reproduzir valores da proposta; falta de dado não gera resultado técnico fictício.

### 5. Caminho solar, obstáculos e simulação de sombras

Implementar posição solar local para latitude, longitude, data, horário e fuso. Exibir trajetória e controles de horário. Com alturas e volumes informados, calcular projeção de sombras no plano de cada água. Separar sombra geométrica instantânea de perda energética anual, que exige integração temporal e dados de irradiância.

Aceite: cenários conhecidos de posição solar e obstáculos; horário sem Sol tratado; sem alturas/geometria, mostrar apenas trajetória e informar que sombras não foram calculadas. Sem prometer detecção automática de árvores ou construções pela foto.

### 6. Strings, inversores e microinversores

Cadastrar Voc, Vmp, Isc, Imp, coeficientes térmicos e limites do módulo; nos inversores, tensão máxima CC, faixa MPPT, tensão de partida, correntes operacionais/de curto, quantidade de MPPT/entradas, potência e fases. Microinversores precisam de modelo próprio por entrada, módulos suportados e circuito CA.

Selecionar módulos e criar strings por IDs, com cores e associação ao MPPT. Validar Voc em temperatura mínima, Vmp no intervalo térmico, correntes de strings paralelas, potência CC/CA e compatibilidade com o equipamento. Não aplicar regra de strings de inversor central a microinversor. Dados insuficientes resultam em pendência, nunca selo de aprovação.

Aceite: impedir referência duplicada de módulo e circuito sem equipamento; alertar limite violado; pendências e ligações persistem após reabrir; casos de referência conferidos com datasheets e responsável técnico.

### 7. Relatório, persistência e homologação

Salvar snapshot técnico de produto, geometria, calibração, fontes, imagem autorizada, premissas, strings e resultados com schema versionado. Para arquivos, aproveitar infraestrutura de armazenamento autenticada, com limites de tamanho/tipo e acesso por proposta; evitar base64 ilimitado no JSON. O PDF deve reproduzir o levantamento salvo sem consultar serviços externos novamente, respeitando as condições do provedor da imagem.

Homologar fluxo completo: criar, cancelar editor, aplicar, salvar, reabrir, duplicar e gerar PDF. Conferir propostas anteriores, permissões, modo sem APIs e comportamento de imagens ausentes. Executar checagem TypeScript/build existentes e testes direcionados de geometria, cálculo e limites elétricos; medir interação em telhados maiores antes de adicionar 3D.

## Dados propostos

- Levantamento versionado associado à proposta: origem, coordenada opcional, sistema de referência, data de captura/processamento separadas, calibração, tipo e ano informado.
- Água: ID estável, polígono em coordenadas métricas locais ou geográficas com referência explícita, inclinação, azimute, recuos e origem das medidas.
- Obstáculo: ID, geometria, altura e exclusão de instalação.
- Módulo instalado: ID, produto e snapshot técnico, água, posição, rotação e string opcional.
- Circuito: string/entrada de microinversor, módulos, inversor, MPPT/entrada e resultados de validação.
- Simulação: método, versão, fontes climáticas, perdas, temperaturas e resultados; distinguir hipótese de dado medido.

Usar colunas técnicas no catálogo e estrutura JSONB versionada para o levantamento é uma opção inicial compatível com o banco atual; normalizar circuitos se consultas e integridade exigirem. A validação deve existir também no backend.

## Prioridade recomendada

Entregar primeiro etapas 1–3: editor independente, medida confiável, módulos reais e proposta coerente. Em seguida estimativas transparentes, trajetória/sombras e dimensionamento elétrico. Automação por imagem, dados 3D externos e fontes premium ficam como evolução opcional, sem dependência comercial para o cliente usar o núcleo.

O fluxo atende ao pré-projeto remoto. Imagem aérea não determina capacidade estrutural, condições elétricas ocultas ou ano de construção; esses dados exigem informação do cliente ou verificação técnica.

## Referências consultadas

- Google Solar, cobrança: https://developers.google.com/maps/documentation/solar/usage-and-billing
- Building Insights: https://developers.google.com/maps/documentation/solar/building-insights
- Recursos Solar/Data Layers: https://developers.google.com/maps/documentation/solar/reference/rest
- OpenStreetMap, política de tiles: https://operations.osmfoundation.org/policies/tiles/ — mapas públicos não são fonte automática de imagem aérea nem infraestrutura com disponibilidade garantida.

Não foram estimados prazos fechados: precisam ser definidos por etapa após validar imagens disponíveis, fichas técnicas e critérios do responsável técnico. A ausência de novas mensalidades não elimina o esforço de implementação.
