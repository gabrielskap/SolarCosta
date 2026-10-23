# Viabilidade dos ajustes do editor de telhado

Avaliação em 23/10/2026, com inspeção do código e documentação oficial. Escopo: modal, placas, medição, qualidade da imagem, visualização e sombras 3D. Não foi realizada consulta faturada para validar cobertura ou imagem de um imóvel real.

## Diagnóstico

O editor atual combina imagem raster do Google Static Maps com SVG em metros; não é um mapa 3D. O zoom muda o viewBox e amplia o mesmo arquivo. A geração comercial continua pelo método HSP/perdas; as cores solares mostram incidência geométrica instantânea. Não existem malha tridimensional, alturas de cada água, cota de referência, terreno ou geometria do entorno neste modelo.

Problemas encontrados e corrigidos nesta rodada:

- A modal usava limite de altura, espaçamentos extensos e duas colunas com rolagem. Agora ocupa a área disponível, mantém mapa e rodapé visíveis e separa ajustes em abas. Seletores substituem listas longas de águas/obstáculos. Em telas muito pequenas, ajustes ainda podem ter rolagem interna para preservar acesso e legibilidade.
- Não havia ferramenta de inclusão de módulo por clique, somente distribuição e remoção. Agora há Inserir placa, com verificação integral de contorno, recuo, obstáculos e colisões, além da distribuição existente.
- A imagem de mapa chegava com escala calculada, mas marcada como indisponível, bloqueando a distribuição até uma confirmação escondida. A escala da projeção passa a ficar disponível automaticamente; imagens próprias continuam exigindo dimensão ou calibração.
- A área já tinha cálculo geométrico, porém seu resultado e os controles ficavam dispersos. Agora aparece durante o desenho, ao fechar o contorno e no resumo. É possível fechar pelo primeiro ponto ou pelo botão Concluir.
- Os controles solares estavam em uma seção extensa da lateral. Agora podem ser abertos dentro da área do mapa. As sombras continuam sendo uma aproximação 2D para águas planas; a mudança de posição dos controles não cria uma simulação 3D.

## Viabilidade por requisito

| Pedido | Viabilidade | O que é necessário / limite |
|---|---|---|
| Modal sem rolagem geral | Alta; ajuste local realizado | Tela ampla, mapa flexível, abas, rodapé fixo. Em telas pequenas ou com texto ampliado, manter acesso por rolagem interna é necessário. |
| Inserir placas no telhado | Alta; inclusão por clique realizada | Água fechada, escala válida e espaço para o módulo inteiro. O preenchimento automático continua disponível; girar/arrastar uma placa individual pode evoluir depois. |
| Calcular área ligando os pontos | Alta; cálculo e escala automática do mapa disponíveis | Coordenadas em metros derivadas da projeção Web Mercator na latitude do enquadramento. Área projetada é diferente da superfície inclinada; esta última usa a inclinação informada. Foto oblíqua e relevo não são corrigidos só com uma escala. |
| Imagem nítida ao aproximar | Parcial com o raster atual | O servidor já pede 640 × 640 com scale=2 (até 1280 × 1280). Zoom digital não recupera informação. Recomenda-se fundo em mapa interativo com carregamento por nível, respeitando a melhor resolução disponível naquele endereço, ou ortofoto própria. Não prometer detalhe, atualidade ou zoom nativo universal. |
| Inclinar a imagem para ver em 3D | Possível como apresentação, insuficiente para engenharia | Transformar uma foto plana em perspectiva não cria alturas nem a forma real do telhado. Não apresentar esse efeito como levantamento tridimensional. |
| Telhado modelado em 3D | Alta com dados manuais; nova etapa | Gerar malha a partir dos contornos, inclinações, azimutes e cotas/alturas informadas. Requer reconstrução consistente de cumeeiras e encontro das águas. Three.js é uma opção sem assinatura de renderização, aproveitando a geometria local existente. |
| Imóvel/entorno real em 3D automaticamente | Condicionada a dados e cobertura | Fotogrametria/drone, DSM, LiDAR ou serviço de 3D Tiles/3D Maps. Google 3D exige integração, habilitação e avaliação de cobertura/cobrança; sua aparência não garante medidas ou geometria apropriadas ao dimensionamento. |
| Sombras solares 3D dentro do mapa | Alta com modelo 3D adequado; não implementada nesta rodada | Posição solar já existe. Faltam superfícies receptoras e volumes que geram sombra, alturas, referência vertical e renderer. Luz direcional e shadow maps permitem visualização, com teste de precisão e resolução. Sombras do entorno exigem também árvores e edificações próximas modeladas. |
| Perda anual por sombreamento | Viável, etapa distinta da visualização | Integrar incidência e obstrução ao longo do tempo com dados de irradiância/clima e modelo elétrico das placas/strings. Uma sombra desenhada ou cor de incidência não fornece essa perda. |

## Caminho recomendado sem nova assinatura obrigatória

1. Estabilizar o editor 2D: modal, inclusão, área automática, seleção e validação. Esta rodada entrega correções locais dessa base.
2. Acrescentar modo 3D de engenharia na mesma cena, com alternância 2D/3D, controles de órbita e malha das águas. Definir altura de referência, cotas dos vértices ou beiral/cumeeira e referência dos obstáculos. Persistir esses dados com versão compatível e validação no servidor.
3. Aplicar o Sol calculado à luz direcional, projetar sombras sobre águas inclinadas, módulos e chão, e testar horários e cenários de referência. Os controles de tempo permanecem sobre o mapa; PDF continua com vista documentada e premissas.
4. Separar o fundo fotográfico do modelo de engenharia. Usar fonte própria para independência de assinatura; integração Google interativa permanece opcional e sujeita a consumo. Adaptar persistência/PDF para registrar fonte e data, sem presumir licença para arquivar conteúdo do fornecedor.
5. Oferecer importação de DSM/ortofoto ou dados 3D externos como aceleração opcional. Só depois avaliar reconstrução automática por endereço e perdas anuais.

Critérios de aceite da próxima etapa 3D: módulos aderem à superfície correta; área real acompanha a inclinação; vértices das águas adjacentes se encontram; posições mantêm a referência ao alternar 2D/3D; sombras mudam conforme data e horário; noite não produz iluminação solar; ausência de dados do entorno aparece como limitação; renderização suporta o equipamento do consultor sem bloquear a proposta.

Não é possível garantir simultaneamente alta resolução recente, geometria real de qualquer endereço e ausência de custo de dados. É possível entregar editor e modelo 3D próprios, com dados informados/importados, sem uma nova API paga obrigatória. Desenvolvimento, processamento e armazenamento continuam usando recursos do projeto.

## Referências

- Static Maps: resolução, scale e disponibilidade de zoom: https://developers.google.com/maps/documentation/maps-static/start
- Google 3D Maps: recursos e cobertura: https://developers.google.com/maps/documentation/javascript/3d/overview
- Uso e cobrança de Maps JavaScript: https://developers.google.com/maps/documentation/javascript/usage-and-billing
- Solar Data Layers (DSM, imagem e fluxos solares): https://developers.google.com/maps/documentation/solar/data-layers
- Three.js, sombras: https://threejs.org/manual/en/shadows.html
- Posição solar NOAA utilizada pelo sistema: https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF
