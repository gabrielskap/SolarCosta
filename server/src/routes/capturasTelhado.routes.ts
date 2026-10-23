import express, { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { exigirLogin, exigirPermissao, ator, type RequestAutenticado } from '../auth/middleware.js';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, conflito, naoEncontrado } from '../errors.js';
import { levantamentoTelhadoSchema } from '../schemas/levantamentoTelhado.js';
import { chaveCaptura } from '../domain/capturaTelhado.js';
import type { LevantamentoTelhado } from '../domain/levantamentoTelhado.js';
import { CAMPOS_CAPTURA, cancelarCaptura, documentoCaptura, obterCaptura, propostaDaCaptura } from '../services/capturasTelhado.js';
import { validarImagem } from '../services/imagemCaptura.js';

export const capturasTelhadoRouter=Router();
capturasTelhadoRouter.use(exigirLogin);
const alterar=exigirPermissao('emitir_propostas','anexar_documentos');
const params=z.object({id:z.string().uuid(),captura:z.string().uuid().optional()});
const tabela='"SolarCosta_CapturasTelhado"';

capturasTelhadoRouter.get('/:id/capturas-telhado',asyncHandler(async(req,res)=>{
  const {id}=params.parse(req.params);await propostaDaCaptura(id);
  const assinatura=z.string().regex(/^[a-f0-9]{64}$/).optional().parse(req.query.assinatura);
  const capturas=await consultar(`SELECT ${CAMPOS_CAPTURA} FROM ${tabela} WHERE proposta_id=$1
    AND ($2::text IS NULL OR assinatura=$2) ORDER BY criado_em DESC LIMIT 10`,[id,assinatura??null]);
  res.json({capturas});
}));

capturasTelhadoRouter.post('/:id/capturas-telhado',alterar,asyncHandler(async(req:RequestAutenticado,res)=>{
  const {id}=params.parse(req.params);const p=await propostaDaCaptura(id);
  const d=z.object({id:z.string().uuid(),pastaId:z.number().int().positive(),melhorarIA:z.boolean(),
    largura:z.number().int().min(1).max(3840),altura:z.number().int().min(1).max(3840),dados:levantamentoTelhadoSchema}).parse(req.body);
  if(d.dados.vistaGoogle?.modo!=='3d')throw conflito('Abra o mapa 3D e conclua o contorno antes de capturar.');
  const pasta=await consultarUm('SELECT id FROM "SolarCosta_PastasDocumento" WHERE id=$1 AND ativo',[d.pastaId]);
  if(!pasta)throw naoEncontrado('Pasta ativa');
  const assinatura=createHash('sha256').update(chaveCaptura(d.dados as LevantamentoTelhado)).digest('hex');
  await emTransacao(async c=>{
    // ID fornecido pelo cliente permite repetir a criação após falha de rede, sem duplicar arquivos.
    await c.query(`INSERT INTO ${tabela}(id,proposta_id,lead_id,pasta_id,usuario_id,usuario_nome,assinatura,camera,largura,altura,melhorar_ia)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [d.id,id,p.lead_id,d.pastaId,req.usuario.id,req.usuario.nome,assinatura,JSON.stringify(d.dados.vistaGoogle),d.largura,d.altura,d.melhorarIA]);
    const j=(await c.query(`SELECT proposta_id,usuario_id,assinatura,pasta_id,melhorar_ia FROM ${tabela} WHERE id=$1`,[d.id])).rows[0];
    if(j.proposta_id!==id||j.usuario_id!==req.usuario.id||j.assinatura!==assinatura||j.pasta_id!==d.pastaId||j.melhorar_ia!==d.melhorarIA)throw conflito('Identificador de captura já utilizado.');
  },ator(req));
  res.status(201).json({captura:await obterCaptura(id,d.id)});
}));

capturasTelhadoRouter.get('/:id/capturas-telhado/:captura',asyncHandler(async(req,res)=>{
  const {id,captura}=params.parse(req.params);await propostaDaCaptura(id);
  res.json({captura:await obterCaptura(id,captura!)});
}));

// Um arquivo por requisição mantém o limite de 10 MB do proxy, sem base64 ou multipart.
capturasTelhadoRouter.post('/:id/capturas-telhado/:captura/arquivos/:tipo',alterar,
  express.raw({type:['image/png','image/webp'],limit:'10mb'}),asyncHandler(async(req,res)=>{
    const {id,captura}=params.parse(req.params);const p=await propostaDaCaptura(id);
    const tipo=z.enum(['original','fundo','mascara']).parse(req.params.tipo);
    const j=await obterCaptura(id,captura!);
    if(j.lead_id!==p.lead_id)throw conflito('O cliente da proposta foi alterado. Capture novamente.');
    if(!Buffer.isBuffer(req.body))throw conflito('Envie a imagem PNG ou WebP como corpo da requisição.');
    await validarImagem(req.body,j.largura,j.altura);
    await emTransacao(async c=>{
      const linha=(await c.query(`SELECT *,fundo IS NOT NULL AS tem_fundo FROM ${tabela} WHERE id=$1 FOR UPDATE`,[j.id])).rows[0];
      if(linha.estado!=='pendente'||linha.pronta)throw conflito('Esta captura não aceita novos arquivos.');
      if(tipo==='original'){
        if(linha.original_id)return;
        const doc=await documentoCaptura(c,linha,`telhado-${j.id}-original.${req.is('image/png')?'png':'webp'}`,req.body,req.is('image/png')?'image/png':'image/webp');
        await c.query(`UPDATE ${tabela} SET original_id=$2 WHERE id=$1`,[j.id,doc]);
      }else{
        if(!linha.original_id)throw conflito('Envie o original primeiro.');
        if(!linha.melhorar_ia)throw conflito('Esta captura não solicitou IA.');
        // tipo é enum validado, nunca um nome de coluna arbitrário.
        await c.query(`UPDATE ${tabela} SET ${tipo}=$2 WHERE id=$1`,[j.id,req.body]);
      }
    },ator(req));
    res.json({captura:await obterCaptura(id,j.id)});
  }));

capturasTelhadoRouter.post('/:id/capturas-telhado/:captura/iniciar',alterar,asyncHandler(async(req,res)=>{
  const {id,captura}=params.parse(req.params);const p=await propostaDaCaptura(id);
  await emTransacao(async c=>{
    const j=(await c.query(`SELECT * FROM ${tabela} WHERE id=$1 AND proposta_id=$2 FOR UPDATE`,[captura,id])).rows[0];
    if(!j)throw naoEncontrado('Captura');
    if(j.lead_id!==p.lead_id)throw conflito('O cliente da proposta foi alterado.');
    if(j.pronta||j.estado!=='pendente')return;
    if(!j.original_id||j.melhorar_ia&&(!j.fundo||!j.mascara))throw conflito('O envio da captura está incompleto.');
    await c.query(`UPDATE ${tabela} SET pronta=true,estado=$2,terminado_em=CASE WHEN $2='concluido' THEN now() ELSE NULL END,
      mensagem=$3 WHERE id=$1`,[j.id,j.melhorar_ia?'pendente':'concluido',j.melhorar_ia?'Na fila de melhoria por IA.':'Captura HD salva em Documentos.']);
  },ator(req));
  res.status(202).json({captura:await obterCaptura(id,captura!)});
}));

capturasTelhadoRouter.post('/:id/capturas-telhado/:captura/cancelar',alterar,asyncHandler(async(req,res)=>{
  const {id,captura}=params.parse(req.params);await propostaDaCaptura(id);
  await cancelarCaptura(id,captura!,ator(req));res.json({captura:await obterCaptura(id,captura!)});
}));

capturasTelhadoRouter.get('/:id/capturas-telhado/:captura/imagem',asyncHandler(async(req,res)=>{
  const {id,captura}=params.parse(req.params);const p=await propostaDaCaptura(id);
  const j=await obterCaptura(id,captura!);
  if(j.lead_id!==p.lead_id)throw naoEncontrado('Imagem');
  const doc=await consultarUm(`SELECT conteudo,mime_type FROM "SolarCosta_LeadDocumentos" WHERE id=ANY($1::uuid[])
    AND lead_id=$2 AND excluido_em IS NULL ORDER BY (id=$3) DESC LIMIT 1`,[[j.final_id,j.original_id].filter(Boolean),j.lead_id,j.final_id]);
  if(!doc?.conteudo)throw naoEncontrado('Imagem');
  res.set({'Content-Type':doc.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(doc.conteudo);
}));
