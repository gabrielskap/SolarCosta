// Executar em server: npx tsx ../scripts/test-proposta-solar-api.ts
// Usa transação externa e savepoints: reverte propostas e auditoria ao terminar.
import assert from 'node:assert/strict';
import {pool} from '../server/src/db';
import {emitirTokenAcesso} from '../server/src/auth/tokens';
import {criarApp} from '../server/src/app';
import {entradaSolarZerada,calcularProposta} from '../server/src/domain/propostaSolar';
import {paraProposta,deProposta} from '../src/services/mappers';
import {obterOuCriarLink} from '../server/src/services/linksPublicos';

const c=await pool.connect(), query=c.query.bind(c),release=c.release.bind(c);
await query('BEGIN');
let savepoint=0;
(c as any).query=(sql:any,values?:any)=>sql==='BEGIN'?query(`SAVEPOINT proposta_${++savepoint}`):sql==='COMMIT'?query(`RELEASE SAVEPOINT proposta_${savepoint--}`):sql==='ROLLBACK'?query(`ROLLBACK TO SAVEPOINT proposta_${savepoint--}`):query(sql,values);
(c as any).release=()=>{};
const connect=pool.connect.bind(pool),poolQuery=pool.query.bind(pool);
(pool as any).connect=async()=>c;(pool as any).query=(...args:any[])=>(c as any).query(...args);
const server=criarApp().listen(0,'127.0.0.1');
await new Promise<void>(r=>server.on('listening',r));
const base=`http://127.0.0.1:${(server.address() as any).port}`;
try {
  const u=(await query(`SELECT id,nome,cargo FROM "SolarCosta_Usuarios" WHERE cargo='Administrador' AND status='ativo' AND excluido_em IS NULL LIMIT 1`)).rows[0];
  assert(u,'Teste exige administrador ativo.');
  const headers={Authorization:`Bearer ${emitirTokenAcesso({sub:u.id,nome:u.nome,cargo:u.cargo})}`,'Content-Type':'application/json'};
  const api=async(method:string,path:string,body?:unknown)=>{const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const entrada=entradaSolarZerada();
  const corpo={cliente_nome:'Teste transacional cálculo solar',consumo_kwh:0,tarifa_kwh:0,hsp:0,perdas_pct:0,modulo_wp:0,potencia_kwp:0,modulos_qtd:0,forma_pagamento:'avista',itens:[],calculo_solar:{entradas:entrada}};
  const criada=await api('POST','/api/propostas',corpo);
  assert.equal(criada.status,201,JSON.stringify(criada.data));
  const id=criada.data.proposta.id;
  assert.equal(criada.data.proposta.calculo_solar.completo,false);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,422);
  const e={...entrada,anoInicial:2026,ucs:[{nome:'UC 1',meses:Array(12).fill(1000),adicionalKwh:0,disponibilidadeKwh:0}],hspMensal:Array(12).fill(5.2),moduloWp:710,perdasPct:24,larguraM:2,alturaM:1.1,inversorKw:14,oversizingPct:30,tarifa:1.19,taxaSem:33.73,disponibilidadeReais:99,taxaCom:33,investimento:22490};
  const completo={...corpo,tarifa_kwh:e.tarifa,modulo_wp:e.moduloWp,perdas_pct:e.perdasPct,iluminacao_publica_sem_sfcr:e.taxaSem,custo_disponibilidade:e.disponibilidadeReais,iluminacao_publica_com_sfcr:e.taxaCom,valor_total_ajustado:22490,itens:[{descricao:'Equipamentos teste',qtd:1,valor_unit:22490}],calculo_solar:{entradas:{...e,investimento:1,parcela:9999}}};
  const salva=await api('PUT',`/api/propostas/${id}`,{...completo,economia_mensal:999999,potencia_kwp:999});
  assert.equal(salva.status,200,JSON.stringify(salva.data));
  assert.equal(salva.data.proposta.calculo_solar.entradas.investimento,22490);
  assert.equal(salva.data.proposta.calculo_solar.entradas.parcela,0);
  const esperado=calcularProposta(e);
  assert.equal(salva.data.proposta.calculo_solar.economiaMensal,esperado.economiaMensal);
  assert.equal(Number(salva.data.proposta.potencia_kwp),esperado.potenciaKwp);
  const reaberta=paraProposta((await api('GET',`/api/propostas/${id}`)).data.proposta);
  assert.deepEqual(reaberta.calculoSolar,salva.data.proposta.calculo_solar);
  assert.deepEqual((deProposta(reaberta).calculo_solar as any).entradas,reaberta.calculoSolar!.entradas);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,200);
  const token=await obterOuCriarLink(c as any,'proposta',id,u.id);
  const publico=await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then(r=>r.json());
  assert.deepEqual(paraProposta(publico.documento).calculoSolar,reaberta.calculoSolar,'PDF público usa o mesmo snapshot do CRM.');
  // Uma proposta antiga permanece sem snapshot se o usuário não revisar.
  await query('UPDATE "SolarCosta_Propostas" SET calculo_solar=NULL,status=\'rascunho\' WHERE id=$1',[id]);
  const {calculo_solar,...legada}=completo;
  const preservada=await api('PUT',`/api/propostas/${id}`,{...legada,economia_mensal:1234});
  assert.equal(preservada.status,200,JSON.stringify(preservada.data));
  assert.equal(preservada.data.proposta.calculo_solar,null);
  assert.equal(Number(preservada.data.proposta.economia_mensal),1234);
  console.log('Propostas API: rascunho zero, bloqueio de emissão, recálculo autoritativo, snapshot, mapeamento e preservação legada passaram.');
} finally {
  server.close();await query('ROLLBACK');
  (pool as any).connect=connect;(pool as any).query=poolQuery;(c as any).release=release;release();await pool.end();
}
