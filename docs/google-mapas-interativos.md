# Visualizações Google no levantamento

O editor oferece Levantamento 2D, Satélite interativo e Google 3D. As ferramentas de águas, obstáculos, módulos, remoção, calibração, histórico e luz solar usam a mesma geometria em metros nas três vistas. No 3D, polígonos georreferenciados são sobrepostos ao terreno, inclusive com contornos ocluídos visíveis; não são uma reconstrução física da superfície do telhado. Sombras são projeções aproximadas no plano, sem perdas energéticas em kWh.

Localize o imóvel primeiro e clique na vista desejada. O SDK e o mapa só são inicializados ao abrir uma vista Google. Alternar de volta ao 2D preserva a geometria e sua câmera. Cada nova abertura de uma vista Google pode gerar consumo do provedor.

## Selecionar o imóvel e salvar

1. Localizar pelo endereço, abrir Google 3D e navegar até o imóvel.
2. Posicionar o centro da câmera no imóvel e clicar em **Usar centro como endereço do 2D**. O ponto escolhido torna-se a origem da imagem 2D e do desenho, com consulta reversa de endereço pelo servidor. Se ela falhar, manter as coordenadas e informar que o nome não está disponível; nunca reutilizar o endereço antigo como se fosse o novo.
3. Quando já existe desenho, confirmar a substituição antes de reiniciar os contornos do imóvel anterior. O histórico mantém o estado anterior para desfazer.
4. Desenhar dentro da moldura georreferenciada. Cliques fora dela mostram orientação para substituir o local, em vez de serem descartados silenciosamente. Os pontos do rascunho têm marcadores numerados.
5. Clicar em **Salvar vista 3D e desenho**. O fluxo grava a proposta usando seu salvamento existente; dados obrigatórios da proposta continuam necessários. O editor só fecha após sucesso. Falhas mantêm o desenho disponível para nova tentativa.

O JSON `levantamento_telhado` preserva `vistaGoogle` com modo, latitude, longitude, altitude, distância, inclinação e orientação da câmera; no satélite, preserva o zoom. Ao reabrir, a vista salva é restaurada. A geometria permanece no mesmo JSON. Não é necessário alterar a coluna do banco. É permitido guardar uma vista antes de distribuir módulos; isso não define a quantidade instalada como zero nem substitui o dimensionamento comercial. Geometria com escala não confirmada continua sendo rejeitada.

## Configuração

- Usar `GOOGLE_MAPS_BROWSER_KEY`, já disponibilizada pelo endpoint autenticado de configuração; nunca usar a chave de servidor no navegador.
- Habilitar Maps JavaScript API no projeto Google Cloud, com faturamento e cotas apropriados. Restringir a chave pelos referrers dos ambientes utilizados (incluindo localhost no desenvolvimento) e pelas APIs necessárias.
- A Elevation API fornece a altitude do terreno para enquadrar cidades acima do nível do mar. Quando ela não responde ou não está habilitada e ainda não há altitude salva, o editor solicita uma altitude conhecida ou habilitação da API; não abre uma vista distante de 4 km como alternativa. A câmera salva pode ser reaberta sem repetir a consulta de elevação.
- O CSP no Express e no modelo Nginx permite conexões Google para streaming do mapa. Aplicar ambas as configurações no deploy.

## Resolução e cobertura

O levantamento atual usa Static Maps com tamanho lógico de até 640 × 640 e `scale=2`, resultando em até 1280 × 1280 pixels. Ampliar o SVG não acrescenta detalhe. Satélite interativo busca novos tiles conforme a navegação, mas a resolução óptica e a data da imagem dependem da cobertura Google; não há garantia de imagem recente ou detalhe adicional em todos os endereços.

O 3D mostra a malha fotorrealista onde disponível, sem assegurar cobertura por edificação. Os módulos do levantamento são sobreposições geográficas, sem alturas individuais de engenharia. Os controles de câmera, logotipo e atribuição são os do Google e ficam visíveis.

## Verificação

Conferir os três botões com e sem localização e chave; abrir satélite e 3D; recentralizar; alternar e retornar ao desenho sem alteração; testar falha de inicialização e rede; fechar durante carregamento; verificar retorno ao imóvel em cidade elevada. Para teste real, usar chave restrita configurada. Testes com SDK simulado verificam integração e ciclo de vida, não comprovam cobertura ou qualidade dos dados Google.

Referências oficiais: [mapa 3D](https://developers.google.com/maps/documentation/javascript/examples/3d/simple-map), [API Map3DElement](https://developers.google.com/maps/documentation/javascript/reference/3d-map), [CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy).
