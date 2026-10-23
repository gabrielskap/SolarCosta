# Visualizações Google no levantamento

O editor oferece Levantamento 2D, Satélite interativo e Google 3D. A busca por endereço abre automaticamente em 3D e limpa a câmera do endereço anterior. A imagem estática do 2D só é carregada ao usar essa vista quando há chave de navegador configurada.

As ferramentas de águas, obstáculos, módulos, remoção, calibração, histórico e luz solar usam a mesma geometria em metros nas três vistas. No 3D, polígonos e pontos são posicionados em relação à superfície visível (`RELATIVE_TO_MESH`), para não desaparecerem sob os edifícios; não são uma reconstrução física da superfície do telhado. Sombras são projeções aproximadas no plano, sem perdas energéticas em kWh.

O clique nativo fornece as coordenadas sobre a malha do Google. Durante o desenho, a calibração e a inserção/remoção de placas, o movimento do ponteiro é interceptado para não arrastar a câmera junto com o clique; o duplo clique também não aproxima o mapa. Use **Mover mapa e selecionar água** para navegar. Os eventos de pressionar e soltar continuam chegando ao Google para obter a posição real do clique. Sem posição nativa, o editor informa o problema em vez de estimar um ponto no solo.

Localize o imóvel primeiro e clique na vista desejada. O SDK e o mapa só são inicializados ao abrir uma vista Google. Alternar de volta ao 2D preserva a geometria e sua câmera. Cada nova abertura de uma vista Google pode gerar consumo do provedor.

## Selecionar o imóvel e salvar

1. Localizar pelo endereço, abrir Google 3D e navegar até o imóvel.
2. Posicionar o centro da câmera no imóvel e clicar em **Usar centro como endereço do 2D**. O ponto escolhido torna-se a origem da imagem 2D e do desenho, com consulta reversa de endereço pelo servidor. Se ela falhar, manter as coordenadas e informar que o nome não está disponível; nunca reutilizar o endereço antigo como se fosse o novo.
3. Quando já existe desenho, confirmar a substituição antes de reiniciar os contornos do imóvel anterior. O histórico mantém o estado anterior para desfazer.
4. Desenhar dentro da moldura georreferenciada. Cliques fora dela mostram orientação para substituir o local, em vez de serem descartados silenciosamente. Os pontos do rascunho têm marcadores numerados.
5. Clicar em **Salvar vista 3D e desenho**. O fluxo grava a proposta usando seu salvamento existente; dados obrigatórios da proposta continuam necessários. O editor permanece aberto após salvar para continuar o levantamento. Falhas mantêm o desenho disponível para nova tentativa.

O JSON `levantamento_telhado` preserva `vistaGoogle` com modo, latitude, longitude, altitude, distância, inclinação e orientação da câmera; no satélite, preserva o zoom. Ao reabrir, a vista salva é restaurada. A geometria permanece no mesmo JSON. Não é necessário alterar a coluna do banco. É permitido guardar uma vista antes de distribuir módulos; isso não define a quantidade instalada como zero nem substitui o dimensionamento comercial. Geometria com escala não confirmada continua sendo rejeitada.

## Configuração

- Usar `GOOGLE_MAPS_BROWSER_KEY`, já disponibilizada pelo endpoint autenticado de configuração; nunca usar a chave de servidor no navegador.
- Habilitar Maps JavaScript API no projeto Google Cloud, com faturamento e cotas apropriados. Restringir a chave pelos referrers dos ambientes utilizados (incluindo localhost no desenvolvimento) e pelas APIs necessárias.
- A altitude é automática: reutilizar a câmera salva ou consultar a Elevation API. Se ela não estiver disponível, enquadrar por `flyCameraTo` com `altitudeMode: RELATIVE_TO_GROUND`, deixando o próprio terreno Google resolver a elevação. O usuário não precisa informar altitude manualmente. A distância inicial ampla só prepara o carregamento; o editor espera o enquadramento final para indicar que está pronto.
- O CSP no Express e no modelo Nginx permite conexões Google para streaming do mapa. Aplicar ambas as configurações no deploy.

## Resolução e cobertura

O levantamento atual usa Static Maps com tamanho lógico de até 640 × 640 e `scale=2`, resultando em até 1280 × 1280 pixels. Ampliar o SVG não acrescenta detalhe. Satélite interativo busca novos tiles conforme a navegação, mas a resolução óptica e a data da imagem dependem da cobertura Google; não há garantia de imagem recente ou detalhe adicional em todos os endereços.

O 3D mostra a malha fotorrealista onde disponível, sem assegurar cobertura por edificação. Os módulos do levantamento são sobreposições geográficas, sem alturas individuais de engenharia. Os controles de câmera, logotipo e atribuição são os do Google e ficam visíveis.

## Verificação

Conferir os três botões com e sem localização e chave; abrir satélite e 3D; recentralizar; alternar e retornar ao desenho sem alteração; testar falha de inicialização e rede; fechar durante carregamento; verificar retorno ao imóvel em cidade elevada. Para teste real, usar chave restrita configurada. Testes com SDK simulado verificam integração e ciclo de vida, não comprovam cobertura ou qualidade dos dados Google.

## Capturar e armazenar imagens

Após inserir os pontos, escolher a pasta no seletor **Pasta das imagens** e clicar em **Capturar**. A pasta padrão é a de imagens/fotos já existente no cadastro do cliente (normalmente **Fotos do local / telhado**). A proposta precisa estar vinculada a um lead e o usuário precisa da permissão `anexar_documentos`.

A seleção nativa do navegador pede que o usuário compartilhe a aba atual. A captura usa a composição da tela, incluindo WebGL, pontos, módulos e créditos do Google; não tenta extrair um canvas WebGL vazio com html2canvas. A aba de origem é verificada por Capture Handle ou Region Capture. Selecionar outra aba ou uma tela inteira não envia imagem. O recorte preserva toda a área do mapa e sua atribuição. É necessário Chrome/Edge com as capacidades de captura disponíveis em HTTPS ou localhost.

O PNG, com até 2560 pixels por lado e 10 MB, é enviado pela rota autenticada existente de documentos, com nome que identifica o projeto, a vista e o instante. Os bytes são persistidos no banco de documentos do cliente e aparecem na pasta escolhida; não são arquivos gravados dentro do repositório do código. O fluxo só anuncia armazenamento após o servidor confirmar o envio. Se o upload falhar, a captura permanece em memória para tentar o envio novamente. Cancelamento não cria documento. Todos os tracks de compartilhamento são encerrados após a captura.

Em desenvolvimento, o service worker é desabilitado para evitar que a casca antiga do aplicativo esconda correções do editor. O comportamento offline de produção é mantido e deve ser testado por build + preview.

Referências oficiais: [mapa 3D](https://developers.google.com/maps/documentation/javascript/examples/3d/simple-map), [API Map3DElement](https://developers.google.com/maps/documentation/javascript/reference/3d-map), [CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy).
