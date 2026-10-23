import { createHash } from 'node:crypto';
import { consultarUm, emTransacao, type Ator, type Cliente } from '../db.js';
import pg from 'pg';
import { config } from '../config.js';
import { naoEncontrado } from '../errors.js';
import type { CapturaTelhado } from '../domain/capturaTelhado.js';
import { comporCaptura } from './imagemCaptura.js';
import { carregarUsuario } from '../auth/middleware.js';

export const CAMPOS_CAPTURA='id,proposta_id,lead_id,estado,assinatura,camera,largura,altura,melhorar_ia,modelo,original_id,final_id,mensagem,criado_em,pronta';
const TABELA='"SolarCosta_CapturasTelhado"';
export const TEMPO_IA=15*60*1000;

export async function documentoCaptura(c:Cliente, j:{lead_id:string;pasta_id:number;usuario_id:string}, nome:string,bytes:Buffer,mime:string) {
  const hash=createHash('sha256').update(bytes).digest('hex');
  const r=await c.query(`INSERT INTO "SolarCosta_LeadDocumentos"
    (lead_id,pasta_id,nome_arquivo,mime_type,extensao,tamanho_bytes,hash_sha256,conteudo,enviado_por_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [j.lead_id,j.pasta_id,nome,mime,mime==='image/png'?'png':'webp',bytes.length,hash,bytes,j.usuario_id]);
  await c.query(`SELECT "SolarCosta_fn_auditar"('criar','Lead',$1,$2,$3)`,
    [`Captura do telhado: ${nome}`,j.lead_id,`Imagem anexada em ${bytes.length} bytes`]);
  return r.rows[0].id as string;
}

export async function obterCaptura(propostaId:string,id:string):Promise<CapturaTelhado> {
  const j=await consultarUm<CapturaTelhado>(`SELECT ${CAMPOS_CAPTURA} FROM ${TABELA} WHERE proposta_id=$1 AND id=$2`,[propostaId,id]);
  if(!j)throw naoEncontrado('Captura');
  return j;
}

const ativos=new Map<string,AbortController>();
export function interromperCaptura(id:string){ativos.get(id)?.abort();}

/** Um lock PostgreSQL protege toda a inferência, inclusive entre réplicas da API. */
async function conexaoDaFila():Promise<Cliente> {
  // Lock de longa duração fora do pool HTTP: funciona inclusive com DATABASE_POOL_MAX=1.
  const c=new pg.Client({connectionString:config.DATABASE_URL,ssl:config.DATABASE_SSL?{rejectUnauthorized:false}:undefined,
    connectionTimeoutMillis:10000,application_name:'solarcosta-capturas'});
  c.on('error',()=>{});
  await c.connect();
  return Object.assign(c,{release:()=>c.end()}) as unknown as Cliente;
}

export function iniciarFilaCapturas(opcoes:{conectar?:()=>Promise<Cliente>}={}) {
  console.log(`[capturas] melhoria por IA ${process.env.TELHADO_IA_URL&&process.env.TELHADO_IA_TOKEN?'configurada':'desligada; captura original disponível'}`);
  let ocupado=false,parado=false;
  const executar=async()=>{
    if(ocupado||parado)return;ocupado=true;
    const c=await (opcoes.conectar??conexaoDaFila)().catch(()=>null);
    if(!c){ocupado=false;return;}
    let bloqueado=false;
    try {
      bloqueado=(await c.query('SELECT pg_try_advisory_lock(723023) AS ok')).rows[0].ok;
      if(!bloqueado)return;
      // Quem obtém o lock sabe que nenhum outro worker válido está processando.
      // Um processo morto deixa o original, nunca um trabalho eternamente em andamento.
      await c.query(`UPDATE ${TABELA} SET estado='falhou',mensagem='Processamento interrompido. O original foi preservado.',
        fundo=NULL,mascara=NULL,terminado_em=now() WHERE estado='processando'`);
      await c.query(`UPDATE ${TABELA} SET estado='falhou',mensagem='Envio incompleto expirou. Capture novamente.',fundo=NULL,mascara=NULL,terminado_em=now()
        WHERE estado='pendente' AND NOT pronta AND criado_em<now()-interval '30 minutes'`);
      const r=await c.query(`UPDATE ${TABELA} SET estado='processando',iniciado_em=now() WHERE id=(
        SELECT id FROM ${TABELA} WHERE estado='pendente' AND pronta ORDER BY criado_em LIMIT 1)
        RETURNING id,lead_id,pasta_id,usuario_id,usuario_nome,largura,altura,original_id,fundo,mascara`);
      const j=r.rows[0]; if(!j)return;
      const controller=new AbortController();ativos.set(j.id,controller);
      const timeout=setTimeout(()=>controller.abort(),TEMPO_IA);
      // A rota de cancelamento pode ter sido atendida por outra réplica.
      const vigiar=setInterval(()=>{void consultarUm(`SELECT estado FROM ${TABELA} WHERE id=$1`,[j.id])
        .then(v=>{if(v?.estado!=='processando')controller.abort();}).catch(()=>controller.abort());},2000);
      const conexaoPerdida=()=>controller.abort();c.on('error',conexaoPerdida);
      try {
        const usuario=await carregarUsuario(j.usuario_id);
        if(!usuario?.permissoes.anexar_documentos||!usuario.permissoes.emitir_propostas)throw new Error('Permissão revogada. O original foi preservado.');
        const atual=(await c.query(`SELECT p.lead_id FROM "SolarCosta_Propostas" p JOIN ${TABELA} t ON t.proposta_id=p.id
          WHERE t.id=$1 AND p.excluido_em IS NULL`,[j.id])).rows[0];
        if(atual?.lead_id!==j.lead_id)throw new Error('O cliente da proposta foi alterado ou a proposta foi removida. Original preservado.');
        const url=process.env.TELHADO_IA_URL,token=process.env.TELHADO_IA_TOKEN;
        if(!url||!token)throw new Error('A melhoria por IA não está configurada. O original foi preservado.');
        const origem=new URL(url);if(!['http:','https:'].includes(origem.protocol))throw new Error('Configuração inválida do serviço de IA.');
        const fator=Math.min(2,3840/Math.max(j.largura,j.altura));
        const response=await fetch(new URL('/upscale',origem),{method:'POST',signal:controller.signal,
          headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/png','X-Job-Id':j.id,
            'X-Output-Width':String(Math.round(j.largura*fator)),'X-Output-Height':String(Math.round(j.altura*fator))},body:j.fundo});
        if(!response.ok)throw new Error('O serviço de IA não concluiu a melhoria. O original foi preservado.');
        const chunks:Uint8Array[]=[];let tamanho=0;
        if(!response.body)throw new Error('Resposta vazia do serviço de IA.');
        for await(const chunk of response.body as any){tamanho+=chunk.length;if(tamanho>10*1024*1024){controller.abort();throw new Error('Resultado da IA acima de 10 MB.');}chunks.push(chunk);}
        const original=await consultarUm(`SELECT conteudo FROM "SolarCosta_LeadDocumentos" WHERE id=$1 AND excluido_em IS NULL`,[j.original_id]);
        if(!original?.conteudo)throw new Error('O documento original foi removido.');
        const bytes=await comporCaptura(original.conteudo,j.mascara,Buffer.concat(chunks));
        controller.signal.throwIfAborted();
        await emTransacao(async db=>{
          const linha=await db.query(`SELECT estado FROM ${TABELA} WHERE id=$1 FOR UPDATE`,[j.id]);
          if(linha.rows[0]?.estado!=='processando')return;
          const doc=await documentoCaptura(db,j,`telhado-${j.id}-IA.webp`,bytes,'image/webp');
          await db.query(`UPDATE ${TABELA} SET estado='concluido',final_id=$2,modelo='RealESRGAN_x4plus',
            mensagem='Imagem ampliada salva em Documentos.',fundo=NULL,mascara=NULL,terminado_em=now() WHERE id=$1`,[j.id,doc]);
        },{id:j.usuario_id,nome:j.usuario_nome});
      } catch(e) {
        const msg=controller.signal.aborted?'Processamento cancelado ou limite de 15 minutos atingido. O original foi preservado.':
          e instanceof TypeError?'O serviço local de IA está indisponível. O original foi preservado.':
          e instanceof Error?e.message:'Não foi possível melhorar a imagem. O original foi preservado.';
        await emTransacao(db=>db.query(`UPDATE ${TABELA} SET estado='falhou',mensagem=$2,fundo=NULL,mascara=NULL,terminado_em=now()
          WHERE id=$1 AND estado='processando'`,[j.id,msg]),{id:j.usuario_id,nome:j.usuario_nome});
      } finally {
        if(controller.signal.aborted&&process.env.TELHADO_IA_URL&&process.env.TELHADO_IA_TOKEN){
          await fetch(new URL('/jobs/'+j.id,process.env.TELHADO_IA_URL),{method:'DELETE',headers:{Authorization:'Bearer '+process.env.TELHADO_IA_TOKEN},signal:AbortSignal.timeout(5000)}).catch(()=>{});
        }
        clearTimeout(timeout);clearInterval(vigiar);ativos.delete(j.id);c.removeListener('error',conexaoPerdida);}
    } catch(e){console.error('[capturas] fila indisponível:',e instanceof Error?e.message:e);}
    finally {if(bloqueado)await c.query('SELECT pg_advisory_unlock(723023)').catch(()=>{});await c.release();ocupado=false;}
  };
  const timer=setInterval(()=>void executar(),2500);timer.unref();void executar();
  return ()=>{parado=true;clearInterval(timer);for(const ac of ativos.values())ac.abort();};
}

export async function propostaDaCaptura(id:string) {
  // Mesmo escopo de leitura das demais rotas de propostas: usuário autenticado.
  const p=await consultarUm(`SELECT p.id,p.lead_id,p.levantamento_telhado FROM "SolarCosta_Propostas" p
    JOIN "SolarCosta_Leads" l ON l.id=p.lead_id AND l.excluido_em IS NULL WHERE p.id=$1 AND p.excluido_em IS NULL`,[id]);
  if(!p)throw naoEncontrado('Proposta com cliente vinculado');
  return p;
}

export async function cancelarCaptura(propostaId:string,id:string,ator:Ator){
  await obterCaptura(propostaId,id);
  await emTransacao(c=>c.query(`UPDATE ${TABELA} SET estado='cancelado',mensagem='Cancelado. O original, se enviado, foi preservado.',
    fundo=NULL,mascara=NULL,terminado_em=now() WHERE proposta_id=$1 AND id=$2 AND estado IN ('pendente','processando')`,[propostaId,id]),ator);
  interromperCaptura(id);
}
