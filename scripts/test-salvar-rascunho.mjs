import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: "export { Api } from './src/services/api'; export { http } from './src/services/http';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{"DEV":false}' },
});
const { Api, http } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const id = 'e944d60d-8951-4c2a-b03f-48ef29b936b5';
const chamadas = [];
const resposta = { proposta: { id, numero: 'PROP-001', status: 'rascunho', itens: [] } };
http.post = async () => { chamadas.push('POST'); return resposta; };
http.put = async (url) => { assert.equal(url, `/api/propostas/${id}`); chamadas.push('PUT'); return resposta; };
http.get = async () => { throw new Error('Consulta adicional indisponível'); };
http.patch = async () => { throw new Error('Emissão indisponível'); };

let proposta = { id: 'prop-1', status: 'rascunho', kitItens: [] };
proposta = await Api.persistProposta(proposta);
assert.equal(proposta.id, id);
await Api.persistProposta(proposta);
await Api.persistProposta(proposta);
assert.deepEqual(chamadas, ['POST', 'PUT', 'PUT']);

chamadas.length = 0;
const emitir = { id: 'prop-2', status: 'enviada', kitItens: [] };
await assert.rejects(Api.persistProposta(emitir), /Emissão indisponível/);
assert.equal(emitir.id, id);
await assert.rejects(Api.persistProposta(emitir), /Emissão indisponível/);
assert.deepEqual(chamadas, ['POST', 'PUT']);
console.log('Rascunhos: salvamentos repetidos e nova tentativa após falha na emissão reutilizam a proposta.');
