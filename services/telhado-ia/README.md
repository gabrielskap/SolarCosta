# Capturas HD e Real-ESRGAN local

A API guarda o original em Documentos antes de iniciar a melhoria. Somente o fundo limpo vai para este serviço; contornos, placas e atribuição são recompostos pela API. A imagem final é WebP de até 3840 px no lado maior. Isso melhora a apresentação, sem recuperar detalhes verificáveis que não existam na imagem original. O PDF não muda.

## Desenvolvimento

Requer Python 3.12. Na raiz do projeto:

```powershell
python -m venv services/telhado-ia/.venv
services/telhado-ia/.venv/Scripts/python.exe -m pip install -r services/telhado-ia/requirements.txt
services/telhado-ia/.venv/Scripts/python.exe services/telhado-ia/download_weights.py
```

Configure em `server/.env`:

```dotenv
TELHADO_IA_URL=http://127.0.0.1:8000
TELHADO_IA_TOKEN=<gere uma credencial aleatória de pelo menos 32 caracteres>
```

Inicie `npm run dev:ia` em um terminal, além dos comandos normais do frontend e da API. Reinicie a API ao mudar o `.env`. `TELHADO_IA_PYTHON` pode apontar para outro executável Python. Em Linux, use `.venv/bin/python` nos comandos de instalação. Sem o serviço configurado, a captura HD continua funcionando e o original é preservado se a opção de IA for solicitada.

## Produção

Construa `services/telhado-ia/Dockerfile` como um serviço separado na mesma rede privada da API. O exemplo `compose.yaml` não publica portas. No Easypanel, use o nome DNS interno do serviço em `TELHADO_IA_URL`, com o mesmo `TELHADO_IA_TOKEN` nos dois serviços. Não exponha o serviço diretamente à internet.

Padrão: CPU, 2 threads, 1 inferência por vez, blocos de 128 px com bordas de 10 px, 4 GB de RAM recomendados e limite de 15 minutos. Telas maiores podem não concluir nesse prazo em CPUs lentas: nesse caso a prévia mantém o original. A API usa lock PostgreSQL entre réplicas; encerramentos interrompidos tornam o trabalho falho e conservam o original. Uploads incompletos expiram após 30 minutos. É possível cancelar trabalhos na aba Imagem do editor.

O build baixa somente os pesos oficiais `RealESRGAN_x4plus` v0.1.0 e valida SHA-256 `4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1`. Modelo e dependências diretas são fixados; não há download de modelos durante as requisições. Preserve a atribuição Google em todas as imagens.

## Validação

- `npx tsx scripts/test-capturas-imagens.ts`: máscara, créditos, composição, limites e assinatura.
- `node scripts/test-interacao-google.mjs`: eventos reais do editor, leitura e seleção.
- Em `server/`: `npx tsx ../scripts/test-capturas-api.ts`. Usa o banco configurado com usuário administrador, proposta vinculada e pasta ativa; todas as escritas ficam numa transação externa revertida no fim. Não executar simultaneamente com outro teste que modifique esses mesmos cadastros.
- `python -m unittest discover -s services/telhado-ia -p 'test_*.py'`: autenticação, cancelamento e ciclo HTTP.
- Compare visualmente uma captura real original com a melhoria antes de habilitar a opção na produção. A IA é desmarcada por padrão.

Fontes: [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN), [BasicSR RRDBNet](https://github.com/XPixelGroup/BasicSR/blob/v1.4.2/basicsr/archs/rrdbnet_arch.py). A implementação da arquitetura mantém compatibilidade com os pesos oficiais, com atribuição Apache-2.0 ao BasicSR e BSD-3-Clause ao Real-ESRGAN (ver arquivos LICENSE).
