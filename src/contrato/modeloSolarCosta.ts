// Texto do contrato no modelo oficial da Solar Costa.
//
// Transcrito de "Modelo contrato Solar Costa.docx". Os valores que mudam de um
// contrato para outro viraram MARCADORES entre chaves — `{prazo_execucao_dias}`,
// `{valor_total}` — resolvidos por src/contrato/marcadores.ts. O resto é o
// texto do modelo, palavra por palavra, salvo estes acertos:
//   · 1.2.1 (iii) estava partido em dois parágrafos — virou um item só;
//   · erros de digitação: "Certifica se" (4.1.1), "dar se início" (2.4),
//     "9.2.1Caso a Solar costa", "concessionaria … sera … prejuízo as partes"
//     (9.4), "6.3.1." e "Solar Costa Ltda" sem ponto final (2.1);
//   · preâmbulo: a qualificação das partes é montada dos dados, com
//     "portador(a)/inscrito(a)" no lugar do gênero fixo e sem o "Sra";
//   · 10.8 ganhou o rótulo "Contratante:" antes do e-mail do cliente.
// O endereço com "coninio" e a data "Setembroo" do .docx eram dados, que agora
// vêm do formulário.
//
// Convenções do texto (ver src/contrato/renderizar.ts):
//   · cada linha é um parágrafo;
//   · `**trecho**` sai em negrito;
//   · a numeração no início da linha ("2.3.1", "(iv)", "a)") sai em negrito;
//   · `{tabela_garantias}` sozinho numa linha vira a tabela da cláusula 7.2.
//
// MUDAR ESTE TEXTO muda todo contrato que for reimpresso. Se a mudança for de
// conteúdo jurídico, suba MODELO_VERSAO e mantenha a versão anterior — o
// contrato assinado precisa continuar imprimindo o que foi assinado.

import type { ChaveSecaoContrato } from '../types';

export const MODELO_VERSAO = 1;

export const TITULO_CONTRATO =
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO DE SISTEMA DE GERAÇÃO DE ENERGIA SOLAR FOTOVOLTAICA';

export interface SecaoModelo {
  chave: ChaveSecaoContrato;
  /** Título impresso (vazio no preâmbulo, considerandos e fecho). */
  titulo: string;
  /** Nome curto para a lista do editor. */
  rotulo: string;
  texto: string;
}

export const SECOES: SecaoModelo[] = [
  {
    chave: 'preambulo',
    titulo: '',
    rotulo: 'Preâmbulo — as partes',
    texto: `Pelo presente instrumento particular, de um lado:
(I) {contratante_qualificacao}, doravante denominado(a), simplesmente, “Contratante”.
E de outro lado,
(II) **{contratada_razao_social}**, sede na {contratada_endereco_completo}, inscrita no CNPJ: {contratada_cnpj}, neste ato representada por seu Representante Legal **{representante_nome}**, {representante_nacionalidade}, portador(a) da cédula de identidade RG nº {representante_rg} e inscrito(a) no CPF sob nº {representante_cpf}, doravante denominada, simplesmente, “Solar Costa” e, em conjunto com o Contratante, “Partes”.`,
  },
  {
    chave: 'considerandos',
    titulo: '',
    rotulo: 'Considerandos',
    texto: `Considerando que:
(i) O Contratante deseja adquirir serviços de Instalação e Projeto, módulos fotovoltaicos, e demais equipamentos componentes de um sistema de geração de energia solar fotovoltaica;
(ii) A Solar Costa é atuante no segmento de energia solar fotovoltaica, exercendo, dentre outras atividades, a instalação de módulos fotovoltaicos e demais equipamentos elétricos.
**Resolvem as Partes celebrar o presente “CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO DE SISTEMA DE GERAÇÃO DE ENERGIA SOLAR FOTOVOLTAICA” (“Contrato”), cujos termos e condições ora contratados as Partes obrigam-se a cumprir e a fazer cumprir por si, seus sucessores e cessionários, a qualquer título.**`,
  },
  {
    chave: 'clausula_1',
    titulo: 'CLÁUSULA PRIMEIRA - DO OBJETO',
    rotulo: '1 · Do objeto',
    texto: `1.1 É objeto deste Contrato a regulação da venda, pela Solar Costa ao Contratante, dos equipamentos descritos no Anexo I deste Contrato, os quais, em conjunto, compõem um sistema de geração de energia solar fotovoltaica (doravante “Sistema”).
1.2 É também, objeto deste Contrato a prestação, pela Solar Costa em favor da Contratante, dos Serviços de desenvolvimento de Projeto e de Instalação do Sistema.
1.2.1 Os Serviços de desenvolvimento de Projeto e de Instalação ora contratados englobam as providências necessárias incumbentes à Solar Costa para que o Sistema tenha condições de iniciar o seu pleno funcionamento, tais como:
(i) Desenvolvimento do Layout do sistema contendo especificações técnicas, diagrama unifilar e emissão da ART (Anotação de Responsabilidade Técnica) de execução, contendo as informações estritamente necessárias para atender as Normas Técnicas requisitadas pela concessionária de energia elétrica local para o acesso à rede;
(ii) Gestão da Execução do Projeto pela equipe de Engenharia da Solar Costa;
(iii) Execução da solicitação de vistoria fornecida pelo CONTRATANTE à rede de energia da concessionária do local onde será instalado o sistema;
(iv) Instalação do Sistema composto pelos equipamentos previstos no Anexo I deste Contrato;
(v) Montagem de estruturas metálicas para fixação dos módulos fotovoltaicos;
(vi) Fixação dos módulos fotovoltaicos e conexão elétrica do cabeamento do Sistema em corrente contínua e corrente alternada;
(vii) Fixação do inversor interativo;
(viii) Comissionamento do Sistema Fotovoltaico.`,
  },
  {
    chave: 'clausula_2',
    titulo: 'CLÁUSULA SEGUNDA - DA ENTREGA E INSTALAÇÃO DOS EQUIPAMENTOS',
    rotulo: '2 · Entrega e instalação',
    texto: `2.1 O Sistema deverá ser entregue pelo fornecedor da contratada, no seguinte endereço: {endereco_entrega}. A entrega do Sistema deverá ocorrer sempre em dias úteis, entre as 8h00 e às 18h00, cabendo às Partes ajustar previamente o melhor período para cumprimento dessa obrigação pela Solar Costa.
2.2 No momento da entrega, o Contratante, por si ou por meio de seu representante expressamente autorizado para tanto, deverão conferir o Sistema entregue e, uma vez constatado que a entrega corresponde ao Sistema descrito no Anexo I e que não apresenta indícios de avaria aparente, deverá o representante do Contratante assinar a respectiva Nota Fiscal de entrega, assim como, conforme o caso, a duplicata mercantil da venda.
2.2.1 Caso o Contratante e a Solar Costa se recusem a aceitar o Sistema por (a) inconsistência entre o objeto da entrega e a descrição do Sistema constante do Anexo I deste Contrato ou (b) em decorrência da verificação de algum vício e/ou defeito aparente em quaisquer dos componentes do Sistema, tais fatos deverão ser informados à transportadora durante o ato de entrega ainda na presença da transportadora, ocasião em que a Solar Costa poderá justificar eventual divergência, resguardada a equivalência técnica e funcional, e informar ao Contratante o procedimento a ser seguido para solucionar as eventuais falhas apontadas.
2.2.2 O Contratante reconhece, desde já, que os fatos descritos na cláusula “2.2.1” não gerarão qualquer penalidade para a Solar Costa, eximindo-a de quaisquer indenizações a eles correlata.
2.3 O Sistema adquirido pelo Contratante deverá ser despachado pelo fornecedor da Solar Costa no prazo máximo de {prazo_despacho} dias contados a partir da data do pagamento da primeira parcela do preço.
2.3.1 O prazo de {prazo_despacho} dias referido na cláusula 2.3 iniciar-se-á apenas após a assinatura deste Contrato e só terá início se, além da ocorrência dos eventos descritos acima, o Contratante tiver efetuado o pagamento da primeira parcela do preço a Solar Costa e quitado pagamento referente ao fornecedor, ou, em caso de financiamento bancário, a Instituição Financeira tiver realizado o depósito integral do valor financiado ao fornecedor.
2.3.2 Tendo em vista que o desenvolvimento do Projeto depende de informações e aprovações do Contratante, bem como que o local de instalação deve estar totalmente adequado ao recebimento do Sistema tão logo os equipamentos que o compõem sejam entregues ao Contratante, os prazos de despacho e de entrega poderão sofrer alteração em casos de obras no local de instalação, necessidade de adequação do local de instalação, demora pelo Contratante em aprovações e respostas solicitadas pela engenharia da Solar Costa, indisponibilidade do Contratante para recebimento dos equipamentos por motivo de viagem ou outros, bem como no caso de atraso no pagamento das parcelas do preço, que ensejará a interrupção das atividades da Solar Costa relativas a este contrato até a regularização dos pagamentos pelo Contratante.
2.4 A execução da obra dar-se-á início a partir do pagamento inicial com prazo total de entrega dos serviços contratados em até {prazo_execucao_dias} dias corridos, após o pagamento da primeira parcela do preço referente a Solar Costa e quitado pagamento referente ao fornecedor.
2.5 Caso o fornecedor dos equipamentos compareça na data e local determinados para a entrega do Sistema e não consiga efetivar a referida entrega, seja em decorrência (a) da ausência do representante do Contratante; (b) da recusa injustificada do Contratante em receber o Sistema; (c) da inexistência de local próprio para o armazenamento do Sistema; ou (d) de outra razão imputável ao Contratante, ficará este sujeito ao ressarcimento de todas as despesas incorridas pelo fornecedor dos equipamentos para a efetivação da entrega frustrada, tais como frete, frete adicional, pernoite, dentre outras.
2.6 Encerrada a instalação do Sistema pela Solar Costa e constatado seu pleno funcionamento pelas Partes, será fornecido ao Contratante o Termo de Conclusão da Instalação e Entrega da Obra, documento que atestará a conclusão dos Serviços de Instalação e o pleno funcionamento do Sistema, marcando assim o término da etapa de “Comissionamento do Sistema Fotovoltaico”, e que deverá ser assinado pelo técnico da Solar Costa e pelo Contratante.`,
  },
  {
    chave: 'clausula_3',
    titulo: 'CLÁUSULA TERCEIRA - PREÇO E FORMA DE PAGAMENTO',
    rotulo: '3 · Preço e pagamento',
    texto: `3.1 Como contraprestação pela venda do Sistema somada aos Serviços de desenvolvimento de Projeto e Instalação, o Contratante pagará o preço total de **{valor_total} ({valor_extenso})**, nas seguintes condições: {condicoes_pagamento}
3.2 O preço total bruto engloba todos os custos e despesas de transporte do Sistema, não sendo qualquer quantia adicional devida pelo Contratante a esse título, ressalvadas a hipóteses expressamente previstas neste Contrato.
3.3 Caso o Contratante deixe de pagar os valores devidos à Solar Costa na data do vencimento, fica o mesmo, nessa hipótese, obrigado a realizar o pagamento imediato das parcelas em atraso, acrescidas de juros de mora de {juros_mora} ao mês, ambos calculados pro rata die desde a data do inadimplemento e até a data do respectivo pagamento, acrescidas de multa moratória de {multa_moratoria} sobre o saldo remanescente do preço.
3.4 Caso o Contratante não realize tempestivamente o pagamento dos valores devidos, o fornecedor poderá deixar de efetuar a entrega do Sistema até que o pagamento seja realizado.
3.5 O atraso no pagamento de qualquer das parcelas poderá gerar o protesto imediato da dívida, independentemente do envio de notificação ao Contratante.
3.6 O preço total bruto engloba todos os custos e despesas referentes a aquisição de equipamentos e mão de obra, sendo que eventuais impostos incidentes em Notas Fiscais que ensejem cobranças a maior, tais como ICMS, Diferença de alíquota de ICMS referente a compra de mercadorias e equipamentos, INSS ou ISSQN de notas de serviço entre outros, deverão ser responsabilidade de Solar Costa.`,
  },
  {
    chave: 'clausula_4',
    titulo: 'CLÁUSULA QUARTA - OBRIGAÇÕES DA SOLAR COSTA',
    rotulo: '4 · Obrigações da Solar Costa',
    texto: `4.1 São obrigações da Solar Costa, dentre outras constantes deste Contrato:
4.1.1 Certificar-se da entrega do Sistema em perfeitas condições de uso e de acordo com as especificações técnicas constantes no Anexo I deste Contrato;
4.1.2 Realizar a entrega do Sistema no local e data previamente combinados entre as Partes;
4.1.3 A Solar Costa compromete-se a empregar técnicas apropriadas na execução dos Serviços de Instalação e desenvolvimento de Projeto contratados, primando sempre pela qualidade em sua execução, pela agilidade em sua prestação, e pelo cuidado com as propriedades do Contratante a que tiver acesso;
4.1.4 A Solar Costa compromete-se a planejar, conduzir e executar, por meio de mão de obra própria ou terceirizada, os serviços contratados, com integral observância das disposições deste Contrato, obedecendo aos prazos contratuais e à legislação pertinente.`,
  },
  {
    chave: 'clausula_5',
    titulo: 'CLÁUSULA QUINTA - OBRIGAÇÕES DO CONTRATANTE',
    rotulo: '5 · Obrigações do Contratante',
    texto: `5.1 São obrigações do Contratante, dentre outras constantes deste Contrato:
5.1.1 Pagar o preço na forma e data previstos neste Contrato;
5.1.2 Comunicar no prazo mínimo de 30 (trinta) dias de antecedência ao despacho à Solar Costa qualquer modificação no local de entrega do Sistema ou fatos que possam modificar o cumprimento dos prazos previamente acordados entre as Partes;
5.1.3 Prover local para receber e guardar o Sistema, a partir do momento em que forem entregues ao Contratante, visando à segurança e conservação do Sistema.
5.1.4 Indicar um representante para receber os componentes do Sistema e acompanhar a instalação do Sistema, que deverá ter poderes expressos para assinar a Nota Fiscal e o Termo de Conclusão da Instalação e Entrega da Obra.`,
  },
  {
    chave: 'clausula_6',
    titulo: 'CLÁUSULA SEXTA – LIMITAÇÕES DE RESPONSABILIDADE',
    rotulo: '6 · Limitações de responsabilidade',
    texto: `6.1 A Solar Costa não se responsabiliza por eventual necessidade de realização de obras e/ou alterações no padrão de entrada de energia da unidade consumidora do Contratante, caso estes eventos sejam necessários para adequada instalação do Sistema.
6.2 A Solar Costa fará a Solicitação de vistoria a concessionária local utilizando-se da ampla experiência em engenharia que possui, de forma eficiente respeitando as Normas Técnicas fornecidas (caso existam) pela concessionária local para acesso e conexão do Sistema à rede. A Solar Costa, porém, não se responsabiliza pelo prazo total da conexão e autorização pela concessionária, nem pela qualidade dos serviços prestados pela distribuidora local como vistoria e troca do medidor de energia, dado que esses fatores não estão sob o controle da Solar Costa.
6.3 A Solar Costa não se responsabilizará por danos causados na rede elétrica da edificação que não tenham sido comprovadamente causados pelo Sistema.
6.3.1 A verificação da causa dos danos será feita pela Solar Costa mediante solicitação do Contratante, que poderá indicar um técnico para acompanhar a verificação, arcando com os custos do mesmo.
6.4 Não estão incluídos no escopo deste Contrato: troca ou reparo de quadros elétricos da edificação, reparo de tomadas, passagem de cabos ou quaisquer outros itens que não se façam necessários a operação do Sistema. Os técnicos da Solar Costa não estão autorizados a executar serviços elétricos extras nas edificações que não as contidas no objeto deste Contrato.
6.5 A Solar Costa não poderá ser responsabilizada perante o Contratante caso haja alterações em regulamentos, normas ou leis referentes aos sistemas fotovoltaicos após a instalação do Sistema.
6.6 Nenhuma das Partes será considerada responsável pelo não cumprimento de suas obrigações no caso de força maior ou caso fortuito, na forma prevista em lei.`,
  },
  {
    chave: 'clausula_7',
    titulo: 'CLÁUSULA SÉTIMA – GARANTIA',
    rotulo: '7 · Garantia',
    texto: `7.1 As Partes também reconhecem que a Solar Costa adquire de terceiros peças, partes e equipamentos que compõem o Sistema, os quais, por sua natureza, possuem prazos de garantia distintos e independentes, fornecidos diretamente por seus respectivos desenvolvedores, fabricantes e fornecedores.
7.2 A Solar Costa, neste ato, informa ao Comprador o prazo da garantia concedida pelo(s) fornecedor(es) dos referidos componentes. Sendo os seguintes prazos abaixo:
{tabela_garantias}
7.3 No que tange ao Equipamento, a Solar Costa não oferece qualquer tipo de garantia adicional referente ao Sistema e às partes dele integrantes, declarando e garantindo o Contratante estar ciente dessa condição e anuindo expressamente com o fato de que qualquer garantia além do prazo legal de {garantia_legal} dias será prestada única, exclusiva e diretamente pelos fabricantes e fornecedores das partes e componentes do Sistema, pelo período especificado pelos fabricantes e fornecedores de cada parte e componente do Sistema.
7.3.1 Dessa forma, após o prazo de {garantia_legal_dias} dias de garantia legal fornecida pela Solar Costa, as garantias serão prestadas única, exclusiva e diretamente pelos fornecedores das peças, componentes, partes e acessórios do Sistema e de acordo com os termos e condições de cada fornecedor.
7.3.2 Em caso de necessidade de acionamento da garantia diretamente com o respectivo fabricante ou fornecedor, a Solar Costa irá auxiliar remotamente o Contratante, intermediando o contato entre o Contratante e o(s) fabricante(s) ou fornecedor(es) do(s) componentes integrantes do Sistema, devendo a atuação da Solar Costa nesse sentido ser expressamente requerida pelo Contratante.
7.4 A Solar Costa compromete-se a fornecer ao Contratante todos os termos das garantias ofertadas por seu(s) fabricante(s) ou fornecedor(es) ao Contratante.
7.5 Caso o Contratante pratique qualquer ato que resulte na perda da garantia, conforme descrito nos respectivos manuais de cada equipamento, nenhuma garantia poderá ser exigida, devendo o Contratante, pois, arcar com a responsabilidade isoladamente.
7.6 A garantia não cobre danos resultantes do mau uso dos equipamentos, defeitos ou danos ocorridos após modificação dos produtos, conserto por terceiros não autorizados; defeitos ou danos decorrentes de causas naturais, como descargas elétricas e tempestades;
7.7 A garantia também não abrange acessórios que não sejam objeto deste Contrato, ou que venham a ser agregados ao Sistema pelo Contratante. Tampouco abrange os danos e defeitos decorrentes da incorporação de acessórios não homologados pela Solar Costa ou pelos fornecedores dos componentes do Sistema.
7.8 No caso do contratante solicitar uma visita técnica para identificar falhas no equipamento, tal visita será cobrada pela mão de obra e deslocamento, bem como seja necessário fazer a troca ou substituição de peças. A garantia do fornecedor e fabricante cobre o equipamento e não cobre custos de mão de obra.`,
  },
  {
    chave: 'clausula_8',
    titulo: 'CLÁUSULA OITAVA – VIGÊNCIA E EFEITOS',
    rotulo: '8 · Vigência e efeitos',
    texto: `8.1 Este Contrato vigerá a partir da data de assinatura nele indicada e exaure-se com o pagamento integral do preço e aceite por escrito do Termo de Conclusão da Instalação e Entrega da Obra.
8.2 Toda e qualquer cláusula ou obrigação assumida por este instrumento contratual que, em razão de sua própria natureza, deva subsistir à rescisão ou término deste Contrato, permanecerá válida e eficaz mesmo após a rescisão ou extinção.
8.3 Este Contrato é celebrado em caráter irrevogável e irretratável, obrigando as Partes e seus sucessores a qualquer título, sendo que qualquer alteração somente produzirá efeitos jurídicos se efetuada por escrito.`,
  },
  {
    chave: 'clausula_9',
    titulo: 'CLÁUSULA NONA - RESCISÃO',
    rotulo: '9 · Rescisão',
    texto: `9.1 O presente Contrato poderá ser rescindido imediatamente nas seguintes hipóteses:
a) Na ocorrência de caso fortuito ou força maior que impeça o cumprimento do presente Contrato por mais de {forca_maior} dias, mediante prévia notificação;
b) Por descumprimento de toda e qualquer cláusula ou condição expressa neste Contrato, mediante prévia notificação, desde que não atendida no prazo de {prazo_cura_dias} dias corridos; e
c) Se uma das Partes vier a prejudicar a boa reputação e a imagem comercial da outra Parte;
9.1.1 A rescisão em qualquer das hipóteses supra ocorrerá a partir do recebimento da notificação formulada para tal fim.
9.2 Caso o Contratante desista da instalação do Sistema antes de sua entrega no local de instalação, será devida à Solar Costa, a multa rescisória de {multa_rescisoria_contratante} sobre o valor do Contrato, sem prejuízo das indenizações cabíveis, dado que a Solar Costa tem custos de desenvolvimento de Projetos e Engenharia prévios a entrega.
9.2.1 Caso a Solar Costa não cumpra com o prazo descrito na cláusula 2.4 será devida a Contratante, multa rescisória de {multa_rescisoria_contratada} sobre o valor do contrato, sem prejuízo das indenizações cabíveis.
9.3 Tendo em vista que algumas estruturas metálicas são desenvolvidas e/ou adquiridos especificamente para cada Projeto, inviabilizando ou tornando improvável a sua utilização em qualquer outro Projeto, em caso de rescisão após o desenvolvimento ou aquisição de referidos equipamento pela Solar Costa, o Contratante deverá também arcar com todos os custos referentes às estruturas metálicas adquiridas ou desenvolvidas especificamente para o projeto contratado, que deverão assim ser indicados pela Solar Costa e pagos pelo Contratante no prazo de {prazo_pagamento_estruturas_dias} dias úteis do envio da correspondente fatura pela Solar Costa.
9.4 Caso a concessionária de energia {concessionaria} não aprove o orçamento de conexão, após apresentar toda documentação exigida, esse contrato será cancelado sem prejuízo às partes.`,
  },
  {
    chave: 'clausula_10',
    titulo: 'CLÁUSULA DÉCIMA – DAS DISPOSIÇÕES GERAIS',
    rotulo: '10 · Disposições gerais',
    texto: `10.1 O Contratante está ciente e concorda, em caráter irrevogável e irretratável, que é reservado à Solar Costa, a qualquer tempo e incondicionalmente, o direito de ceder ou caucionar a terceiros, no todo ou em parte, os direitos creditórios decorrentes deste Contrato, independentemente de aviso ou notificação ao Contratante e de formalização instrumento aditivo;
10.2 As Partes declaram e garantem, mutuamente, que se encontram devidamente constituídas e registradas nos termos da Lei, que possuem todas as licenças e autorizações necessárias para exercer suas atividades empresariais e para celebrar o presente Contrato, que os signatários do presente instrumento são detentores de poderes e autorização de natureza societária para cumprir todos os seus deveres e obrigações dispostos neste Contrato, e que suas assinaturas e a concordância com os termos deste Contrato foram devidamente autorizadas por todos os atos societários necessários.
10.3 As Partes obrigam-se ao fiel cumprimento deste Contrato, por si e seus sucessores, a qualquer título.
10.4 A aceitação, omissão ou tolerância de qualquer uma das Partes em relação ao descumprimento pela outra Parte de qualquer cláusula ou condição deste Contrato será considerada mera liberalidade, não ocorrendo desoneração do cumprimento das obrigações assumidas, as quais permanecerão inalteradas, como se nenhuma aceitação, omissão ou tolerância houvesse ocorrido, não se constituindo, em nenhuma hipótese, novação.
10.5 Os direitos de cada Parte previstos neste Contrato (i) são cumulativos com outros direitos previstos em lei, a menos que expressamente os excluam; (ii) só admitem renúncia por escrito e específica; e (iii) são intransferíveis, salvo anuência expressa de todas as Partes.
10.6 Se qualquer disposição deste Contrato ou seus aditivos for considerada inválida e/ou ineficaz, as partes deverão envidar seus melhores esforços para substituí-la por outra de conteúdo similar e com os mesmos efeitos. A eventual invalidade e/ou ineficácia de uma ou mais cláusulas não afetará as demais disposições do presente Contrato.
10.7 Todas as notificações decorrentes deste Contrato deverão ser feitas por escrito e serão consideradas eficazes: (i) quando entregues pessoalmente à Parte a ser notificada, mediante protocolo; (ii) na data de entrega de carta com aviso de recebimento à Parte a ser notificada, enviada ao endereço de seu domicílio conforme consta deste Contrato; ou (iii) na transmissão da notificação por e-mail à Parte a ser notificada, desde que acompanhado de comprovante de entrega.
10.8 Os endereços de notificação poderão ser alterados por notificação enviada por uma Parte à outra, sendo que para efeito de qualquer notificação por e-mail, observar-se-á, enquanto não alterados, os e-mails abaixo fornecidos pelas Partes:
**Solar Costa: {email_contratada}**
**Contratante: {email_contratante}**
10.9 O presente instrumento reveste-se das características de título executivo extrajudicial (certeza, liquidez e exigibilidade) nos termos do artigo 784, III do Código de Processo Civil Brasileiro, constituindo documento hábil a instruir competente Ação de Execução para cobrar os valores devidos pelo Contratante, sem prejuízo da ação de rescisão contratual competente.
10.10 As Partes concordam que todas as informações de titularidade da outra Parte a que tiverem acesso, sob qualquer forma, em decorrência da execução deste Contrato, serão consideradas confidenciais e continuarão sendo de titularidade única e exclusiva da Parte que a revelou.
10.11 As Partes envidarão seus melhores esforços para a perfeita execução e observância deste Contrato, bem como para a solução de litígios eventualmente resultantes, tendo por base os princípios éticos que as norteiam, bem como os princípios legais que regem o ordenamento jurídico brasileiro.
10.12 As Partes elegem o foro da Comarca de {foro} para dirimir quaisquer conflitos oriundos deste Contrato, com renúncia de qualquer outro, por mais privilegiado que seja.`,
  },
  {
    chave: 'encerramento',
    titulo: '',
    rotulo: 'Fecho — local e data',
    texto: `E por estarem assim, justas e contratadas, assinam o presente em {numero_vias} vias, na presença das testemunhas abaixo indicadas.
{local_data}`,
  },
];

export const CHAVES_SECOES: ChaveSecaoContrato[] = SECOES.map((s) => s.chave);

export function secaoDoModelo(chave: ChaveSecaoContrato): SecaoModelo {
  const secao = SECOES.find((s) => s.chave === chave);
  if (!secao) throw new Error(`Seção de contrato desconhecida: ${chave}`);
  return secao;
}
