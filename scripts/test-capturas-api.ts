// Executar a partir de server: npx tsx ../scripts/test-capturas-api.ts
// Todas as escritas, inclusive documentos e auditoria, são revertidas ao terminar.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import sharp from '../server/node_modules/sharp/lib/index.js';
import { pool } from '../server/src/db.ts';
import { emitirTokenAcesso } from '../server/src/auth/tokens.ts';
import { exigirPermissao } from '../server/src/auth/middleware.ts';
import { criarApp } from '../server/src/app.ts';
import { iniciarFilaCapturas } from '../server/src/services/capturasTelhado.ts';

const c=await pool.connect(),query=c.query.bind(c),release=c.release.bind(c);
await query('BEGIN');
let savepoint=0;
// As transações internas usam savepoints: nunca COMMIT na transação externa do teste.
(c as any).query=(sql:any,values?:any)=>typeof sql==='string'&&sql==='BEGIN'?query(`SAVEPOINT captura_${++savepoint}`):
  sql==='COMMIT'?query(`RELEASE SAVEPOINT captura_${savepoint--}`):sql==='ROLLBACK'?query(`ROLLBACK TO SAVEPOINT captura_${savepoint--}`):query(sql,values);
(c as any).release=()=>{};
const connect=pool.connect.bind(pool),poolQuery=pool.query.bind(pool);
(pool as any).connect=async()=>c;(pool as any).query=(...args:any[])=>(c as any).query(...args);
const app=criarApp(),server=app.listen(0,'127.0.0.1');
await new Promise<void>(r=>server.on('listening',r));
const base=`http://127.0.0.1:${(server.address() as any).port}`;
let parar:(()=>void)|undefined;
const ia=createServer(async(req,res)=>{
  if(req.method==='DELETE'){res.writeHead(204).end();return;}
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const input=Buffer.concat(chunks);assert(input.length>0);
  const bytes=await sharp(input).resize(Number(req.headers['x-output-width']),Number(req.headers['x-output-height'])).webp({lossless:true}).toBuffer();
  res.writeHead(200,{'Content-Type':'image/webp'}).end(bytes);
});
try{
  const u=(await query(`SELECT id,nome,cargo FROM "SolarCosta_Usuarios" WHERE cargo='Administrador' AND status='ativo' AND excluido_em IS NULL LIMIT 1`)).rows[0];
  const p=(await query(`SELECT id FROM "SolarCosta_Propostas" WHERE lead_id IS NOT NULL AND excluido_em IS NULL LIMIT 1`)).rows[0];
  const pasta=(await query(`SELECT id FROM "SolarCosta_PastasDocumento" WHERE ativo LIMIT 1`)).rows[0];
  assert(u&&p&&pasta,'Teste exige usuário administrador, proposta com lead e pasta ativa');
  const token=emitirTokenAcesso({sub:u.id,nome:u.nome,cargo:u.cargo});
  const headers={Authorization:`Bearer ${token}`};
  const url=(j?:string,suffix='')=>`${base}/api/propostas/${p.id}/capturas-telhado${j?'/'+j:''}${suffix}`;
  const request=async(j:string|undefined,suffix:string,body?:any)=>{
    const response=await fetch(url(j,suffix),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const dados={versao:1,origem:'manual',larguraM:30,alturaM:20,norte:0,tipologia:'Teste',escalaConfirmada:true,aguas:[],obstaculos:[],placas:[],
    modulo:{modelo:'Teste',larguraM:1,alturaM:2,potenciaWp:500},espacamentoM:0.03,recuoM:0.3,vistaGoogle:{modo:'3d',latitude:-19,longitude:-43}};
  const png=await sharp({create:{width:32,height:24,channels:3,background:'#748c9c'}}).png().toBuffer();
  const mask=await sharp({create:{width:32,height:24,channels:3,background:'#000'}}).png().toBuffer();
  const criar=async(ia=false)=>{
    const id=randomUUID();const r=await request(undefined,'',{id,pastaId:pasta.id,melhorarIA:ia,largura:32,altura:24,dados});
    assert.equal(r.status,201,JSON.stringify(r.data));return id;
  };
  const upload=async(id:string,tipo:string,bytes=png)=>fetch(url(id,`/arquivos/${tipo}`),{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:bytes});
  assert.equal((await fetch(url())).status,401,'sem login');
  let erro:any;
  exigirPermissao('anexar_documentos')({usuario:{permissoes:{anexar_documentos:false}}} as any,{} as any,e=>{erro=e;});
  assert.equal(erro.status,403,'sem permissão de anexar');
  const id=await criar();
  assert.equal((await request(id,'/iniciar')).status,409,'não inicia sem original');
  assert.equal((await upload(id,'original',Buffer.from('invalido'))).status,422,'valida bytes reais');
  assert.equal((await upload(id,'original')).status,200);
  assert.equal((await upload(id,'original')).status,200,'upload do original é idempotente');
  const iniciado=await request(id,'/iniciar');assert.equal(iniciado.data.captura.estado,'concluido');
  const imagem=await fetch(url(id,'/imagem'),{headers});assert.equal(imagem.status,200);
  assert.deepEqual(Buffer.from(await imagem.arrayBuffer()),png,'original preservado sem alteração');
  assert.equal((await request(id,'/iniciar')).status,202,'iniciar é idempotente');
  assert.equal((await upload(id,'fundo')).status,409,'captura finalizada não aceita sobrescrita');
  const novo=await criar(true);await upload(novo,'original');await upload(novo,'fundo');await upload(novo,'mascara',mask);
  await request(novo,'/iniciar');
  await new Promise<void>(r=>ia.listen(0,'127.0.0.1',r));
  process.env.TELHADO_IA_URL=`http://127.0.0.1:${(ia.address() as any).port}`;process.env.TELHADO_IA_TOKEN='test-only-token-with-more-than-32-chars';
  parar=iniciarFilaCapturas({conectar:()=>pool.connect()});
  let job:any;
  for(let i=0;i<80;i++){
    job=(await (await fetch(url(novo),{headers})).json()).captura;
    if(job.estado==='concluido'||job.estado==='falhou')break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(job.estado,'concluido',JSON.stringify(job));assert(job.final_id&&job.original_id!==job.final_id);
  const final=await fetch(url(novo,'/imagem'),{headers});assert.equal(final.headers.get('content-type'),'image/webp');
  const meta=await sharp(Buffer.from(await final.arrayBuffer())).metadata();assert.equal(meta.width,64);assert.equal(meta.height,48);
  const cancelado=await criar(true);await upload(cancelado,'original');await request(cancelado,'/cancelar');
  const result=(await (await fetch(url(cancelado),{headers})).json()).captura;
  assert.equal(result.estado,'cancelado');assert(result.original_id,'cancelamento preserva original');
  assert.equal((await upload(cancelado,'fundo')).status,409);
  const lista=await (await fetch(url()+`?assinatura=${job.assinatura}`,{headers})).json();
  assert(lista.capturas.some((j:any)=>j.id===novo),'consulta da prévia encontra assinatura compatível');
  const vazia=await (await fetch(url()+`?assinatura=${'0'.repeat(64)}`,{headers})).json();assert.equal(vazia.capturas.length,0,'desenho diferente não reaproveita captura');
  console.log('OK API: autenticação, permissão, uploads, idempotência, fila IA, original/final, cancelamento e prévia. Todas as escritas serão revertidas.');
} finally {
  parar?.();await new Promise<void>(r=>server.close(()=>r()));
  if(ia.listening)await new Promise<void>(r=>ia.close(()=>r()));
  await query('ROLLBACK');(pool as any).connect=connect;(pool as any).query=poolQuery;release();await pool.end();
}
