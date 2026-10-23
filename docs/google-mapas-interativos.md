# Visualizações Google no levantamento

O editor oferece Levantamento 2D, Satélite interativo e Google 3D. O 2D continua sendo a geometria autoritativa do projeto. As outras vistas são de inspeção do imóvel e entorno, sem alterar polígonos, módulos, propostas ou resultados energéticos.

Localize o imóvel primeiro e clique na vista desejada. O SDK e o mapa só são inicializados ao abrir uma vista Google. Alternar de volta ao 2D preserva a geometria e sua câmera. Cada nova abertura de uma vista Google pode gerar consumo do provedor.

## Configuração

- Usar `GOOGLE_MAPS_BROWSER_KEY`, já disponibilizada pelo endpoint autenticado de configuração; nunca usar a chave de servidor no navegador.
- Habilitar Maps JavaScript API no projeto Google Cloud, com faturamento e cotas apropriados. Restringir a chave pelos referrers dos ambientes utilizados (incluindo localhost no desenvolvimento) e pelas APIs necessárias.
- A Elevation API é opcional para a vista 3D: fornece a altitude real do terreno para enquadrar cidades acima do nível do mar. Quando ela não responde ou não está habilitada, a vista começa ampla e exibe aviso; não inventa uma altitude de engenharia.
- O CSP no Express e no modelo Nginx permite conexões Google para streaming do mapa. Aplicar ambas as configurações no deploy.

## Resolução e cobertura

O levantamento atual usa Static Maps com tamanho lógico de até 640 × 640 e `scale=2`, resultando em até 1280 × 1280 pixels. Ampliar o SVG não acrescenta detalhe. Satélite interativo busca novos tiles conforme a navegação, mas a resolução óptica e a data da imagem dependem da cobertura Google; não há garantia de imagem recente ou detalhe adicional em todos os endereços.

O 3D mostra a malha fotorrealista onde disponível, sem assegurar cobertura por edificação. Não representa um modelo editável dos módulos do projeto. Os controles de câmera, logotipo e atribuição são os do Google e ficam visíveis.

## Verificação

Conferir os três botões com e sem localização e chave; abrir satélite e 3D; recentralizar; alternar e retornar ao desenho sem alteração; testar falha de inicialização e rede; fechar durante carregamento; verificar retorno ao imóvel em cidade elevada. Para teste real, usar chave restrita configurada. Testes com SDK simulado verificam integração e ciclo de vida, não comprovam cobertura ou qualidade dos dados Google.

Referências oficiais: [mapa 3D](https://developers.google.com/maps/documentation/javascript/examples/3d/simple-map), [API Map3DElement](https://developers.google.com/maps/documentation/javascript/reference/3d-map), [CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy).
