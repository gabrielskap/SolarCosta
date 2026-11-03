// Executar em server: npx tsx ../scripts/test-proposta-solar-api.ts
// Usa tabelas temporárias e savepoints: testa as V033/V034 e reverte tudo ao terminar.
// TEST_PROPOSTA_ISOLADA=0 permite testar um banco de homologação já migrado.
import assert from 'node:assert/strict';
import {pool} from '../server/src/db';
import {emitirTokenAcesso} from '../server/src/auth/tokens';
import {criarApp} from '../server/src/app';
import {entradaSolarZerada,calcularProposta} from '../server/src/domain/propostaSolar';
import {paraProposta,deProposta} from '../src/services/mappers';
import {obterOuCriarLink} from '../server/src/services/linksPublicos';
import {financiamentoDaProposta} from '../server/src/domain/financiamento';
import {prepararBancoTemporario} from './proposta-api-banco-temporario';

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
  if (process.env.TEST_PROPOSTA_ISOLADA !== '0') await prepararBancoTemporario(c);
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
  assert.equal(paraProposta(criada.data.proposta).garantiasEquipamentos, undefined);
  const garantias = { modulosProduto: '15 anos', modulosPerformance: '30 anos', inversores: '10 anos' };
  const comGarantias = await api('POST','/api/propostas',{...corpo, garantias_equipamentos: garantias});
  assert.equal(comGarantias.status,201,JSON.stringify(comGarantias.data));
  assert.deepEqual(paraProposta(comGarantias.data.proposta).garantiasEquipamentos,garantias);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,422);
  const e={...entrada,anoInicial:2026,ucs:[{nome:'UC 1',meses:Array(12).fill(1000),adicionalKwh:0,disponibilidadeKwh:0}],hspMensal:Array(12).fill(5.2),moduloWp:710,perdasPct:24,larguraM:2,alturaM:1.1,inversorKw:14,oversizingPct:30,tarifa:1.19,taxaSem:33.73,disponibilidadeReais:99,taxaCom:33,investimento:22490};
  const completo={...corpo,tarifa_kwh:e.tarifa,modulo_wp:e.moduloWp,perdas_pct:e.perdasPct,iluminacao_publica_sem_sfcr:e.taxaSem,custo_disponibilidade:e.disponibilidadeReais,iluminacao_publica_com_sfcr:e.taxaCom,valor_total_ajustado:22490,itens:[{descricao:'Equipamentos teste',qtd:1,valor_unit:22490}],calculo_solar:{entradas:{...e,investimento:1,parcela:9999}}};
  const salva=await api('PUT',`/api/propostas/${id}`,{...completo,economia_mensal:999999,potencia_kwp:999,garantias_equipamentos:garantias});
  assert.equal(salva.status,200,JSON.stringify(salva.data));
  assert.equal(salva.data.proposta.calculo_solar.entradas.investimento,22490);
  assert.equal(salva.data.proposta.calculo_solar.entradas.parcela,0);
  const esperado=calcularProposta(e);
  assert.equal(salva.data.proposta.calculo_solar.economiaMensal,esperado.economiaMensal);
  assert.equal(Number(salva.data.proposta.potencia_kwp),esperado.potenciaKwp);
  const reaberta=paraProposta((await api('GET',`/api/propostas/${id}`)).data.proposta);
  assert.deepEqual(reaberta.garantiasEquipamentos,garantias);
  assert.deepEqual(deProposta(reaberta).garantias_equipamentos,garantias);
  for (const invalida of [{...garantias,inversores:'a'.repeat(121)},{...garantias,modulosProduto:15},{campoIndevido:'10 anos'}])
    assert.equal((await api('PUT',`/api/propostas/${id}`,{...completo,garantias_equipamentos:invalida})).status,422);
  assert.deepEqual(reaberta.calculoSolar,salva.data.proposta.calculo_solar);
  assert.deepEqual((deProposta(reaberta).calculo_solar as any).entradas,reaberta.calculoSolar!.entradas);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,200);
  const token=await obterOuCriarLink(c as any,'proposta',id,u.id);
  const publico=await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then(r=>r.json());
  assert.deepEqual(paraProposta(publico.documento).garantiasEquipamentos,garantias);
  assert.deepEqual(paraProposta(publico.documento).calculoSolar,reaberta.calculoSolar,'PDF público usa o mesmo snapshot do CRM.');
  // Condições financeiras são recalculadas, persistidas e iguais no CRM e PDF público.
  await query('UPDATE "SolarCosta_Propostas" SET status=\'rascunho\' WHERE id=$1',[id]);
  const financiada={...completo,forma_pagamento:'financiamento',valor_total_ajustado:15990,
    entrada_financiamento_pct:20,entrada_financiamento_valor:9999,parcelas_financiamento:36,juros_financiamento_mes_pct:2.2,
    economia_mensal:999999,calculo_solar:{entradas:{...e,parcela:999999,parcelas:999}}};
  const fs=await api('PUT',`/api/propostas/${id}`,financiada);
  assert.equal(fs.status,200,JSON.stringify(fs.data));
  assert.equal(fs.data.proposta.entrada_financiamento_valor,3198);
  assert.equal(fs.data.proposta.calculo_solar.entradas.parcela,518.13);
  assert.equal(fs.data.proposta.calculo_solar.entradas.parcelas,36);
  assert.equal(fs.data.proposta.economia_mensal,Number((esperado.economiaOperacional-518.13).toFixed(2)));
  const fr=paraProposta((await api('GET',`/api/propostas/${id}`)).data.proposta);
  assert.deepEqual(financiamentoDaProposta(fr),financiamentoDaProposta(paraProposta(fs.data.proposta)));
  const fp=await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then(r=>r.json());
  assert.deepEqual(financiamentoDaProposta(paraProposta(fp.documento)),financiamentoDaProposta(fr));
  const ajustes={entradaValor:1000,valorFinanciado:14000,parcela:600,totalPrestacoes:21000,jurosTotais:6500,totalPago:23000};
  const ajustada=await api('PUT',`/api/propostas/${id}`,{...financiada,financiamento_ajustes:ajustes});
  assert.equal(ajustada.status,200,JSON.stringify(ajustada.data));
  assert.deepEqual(ajustada.data.proposta.financiamento_ajustes,ajustes);
  assert.equal(ajustada.data.proposta.calculo_solar.entradas.parcela,600);
  assert.equal(ajustada.data.proposta.economia_mensal,Number((esperado.economiaOperacional-600).toFixed(2)));
  const ajusteReaberto=paraProposta((await api('GET',`/api/propostas/${id}`)).data.proposta);
  assert.deepEqual(ajusteReaberto.financiamentoAjustes,ajustes);
  assert.deepEqual(deProposta(ajusteReaberto).financiamento_ajustes,ajustes);
  const ajustePublico=await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then(r=>r.json());
  assert.deepEqual(paraProposta(ajustePublico.documento).financiamentoAjustes,ajustes);
  assert.equal(financiamentoDaProposta(paraProposta(ajustePublico.documento)).totalPago,23000);
  for (const invalido of [{parcela:-1},{jurosTotais:1.001},{valorFinanciado:0},{totalPago:null},{campoIndevido:1}])
    assert.equal((await api('PUT',`/api/propostas/${id}`,{...financiada,financiamento_ajustes:invalido})).status,422);
  const restaurada=await api('PUT',`/api/propostas/${id}`,{...financiada,financiamento_ajustes:null});
  assert.equal(restaurada.status,200,JSON.stringify(restaurada.data));
  assert.equal(restaurada.data.proposta.financiamento_ajustes,null);
  assert.equal(restaurada.data.proposta.calculo_solar.entradas.parcela,518.13);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,200);
  assert.equal((await api('PUT',`/api/propostas/${id}`,{...financiada,juros_financiamento_mes_pct:null})).status,422,'não incompletar proposta emitida');
  await query('UPDATE "SolarCosta_Propostas" SET status=\'rascunho\' WHERE id=$1',[id]);
  for (const faltando of [null,undefined,'']) {
    const pendente=await api('PUT',`/api/propostas/${id}`,{...financiada,juros_financiamento_mes_pct:faltando});
    assert.equal(pendente.status,200,JSON.stringify(pendente.data));
    assert.equal(pendente.data.proposta.juros_financiamento_mes_pct,null);
    assert.equal(pendente.data.proposta.calculo_solar.completo,false);
    for (const status of ['enviada','aceita']) assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status})).status,422);
  }
  for (const invalido of [{entrada_financiamento_pct:20.001},{juros_financiamento_mes_pct:2.2001},
    {juros_financiamento_mes_pct:-1},{parcelas_financiamento:1.5},{parcelas_financiamento:1201}])
    assert.equal((await api('PUT',`/api/propostas/${id}`,{...financiada,...invalido})).status,422,JSON.stringify(invalido));
  for (const pendente of [{parcelas_financiamento:null},{parcelas_financiamento:0},{entrada_financiamento_pct:100}]) {
    assert.equal((await api('PUT',`/api/propostas/${id}`,{...financiada,...pendente})).status,200);
    assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,422);
  }
  const taxaZero=await api('PUT',`/api/propostas/${id}`,{...financiada,entrada_financiamento_pct:0,juros_financiamento_mes_pct:0,parcelas_financiamento:13});
  assert.equal(taxaZero.status,200,JSON.stringify(taxaZero.data));
  assert.equal(taxaZero.data.proposta.juros_financiamento_mes_pct,0);
  assert.equal(taxaZero.data.proposta.calculo_solar.entradas.parcela,1230);
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,200);
  // Uma proposta antiga permanece sem snapshot se o usuário não revisar.
  await query('UPDATE "SolarCosta_Propostas" SET calculo_solar=NULL,status=\'rascunho\' WHERE id=$1',[id]);
  const {calculo_solar,...legada}=completo;
  const preservada=await api('PUT',`/api/propostas/${id}`,{...legada,economia_mensal:1234});
  assert.equal(preservada.status,200,JSON.stringify(preservada.data));
  assert.equal(preservada.data.proposta.calculo_solar,null);
  assert.equal(Number(preservada.data.proposta.economia_mensal),1234);
  // Legada: sem snapshot, ainda recalcular entrada e efeito da parcela na economia salva.
  const {calculo_solar:ignorado,...finLegada}=financiada;
  const fl=await api('PUT',`/api/propostas/${id}`,finLegada);
  assert.equal(fl.status,200,JSON.stringify(fl.data));
  assert.equal(fl.data.proposta.calculo_solar,null);
  assert.equal(fl.data.proposta.entrada_financiamento_valor,3198);
  assert.equal(fl.data.proposta.economia_mensal,Number((fl.data.proposta.economia_anual/12-518.13).toFixed(2)));
  await api('PUT',`/api/propostas/${id}`,{...finLegada,juros_financiamento_mes_pct:null});
  assert.equal((await api('PATCH',`/api/propostas/${id}/status`,{status:'enviada'})).status,422,'legada sem taxa exige revisão');
  console.log('Propostas API: cálculo, ajustes individuais, restauração, PDF público, validação, snapshot e preservação legada passaram.');
} finally {
  server.close();await query('ROLLBACK');
  (pool as any).connect=connect;(pool as any).query=poolQuery;(c as any).release=release;release();await pool.end();
}
