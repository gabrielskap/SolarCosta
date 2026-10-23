import { z } from 'zod';
import { cabe, poligonoValido, sobrepoe, type PontoLocal } from '../domain/levantamentoTelhado.js';

const ponto=z.object({x:z.number().finite().min(0).max(500),y:z.number().finite().min(0).max(500)});
const poligono=z.array(ponto).min(3).max(200);
export const levantamentoTelhadoSchema=z.object({
  versao:z.literal(1),origem:z.literal('manual'),
  larguraM:z.number().min(1).max(500),alturaM:z.number().min(1).max(500),
  norte:z.number().min(0).lt(360),tipologia:z.string().max(80),
  anoConstrucao:z.number().int().min(1500).max(new Date().getFullYear()).optional(),
  // Prévia raster limitada; nenhum SVG ou URL externa é aceito.
  imagem:z.string().max(450000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
  imagemNome:z.string().max(255).optional(),dataImagem:z.string().date().optional(),
  localizacao:z.object({latitude:z.number().min(-85).max(85),longitude:z.number().min(-180).max(180),endereco:z.string().max(300).optional()}).optional(),
  simulacao:z.object({data:z.string().date(),hora:z.number().min(0).max(23.75),fuso:z.number().int().min(-5).max(-2),mostrarIncidencia:z.boolean(),mostrarSombras:z.boolean()}).optional(),
  satelite:z.object({latitude:z.number().min(-85).max(85),longitude:z.number().min(-180).max(180),zoom:z.number().int().min(16).max(20),larguraPx:z.number().int().min(100).max(640),alturaPx:z.number().int().min(100).max(640)}).optional(),
  escalaConfirmada:z.literal(true),
  aguas:z.array(z.object({id:z.string().uuid(),nome:z.string().max(100),pontos:poligono,inclinacao:z.number().min(0).max(75),azimute:z.number().min(0).lt(360)})).min(1).max(100),
  obstaculos:z.array(z.object({id:z.string().uuid(),pontos:poligono,alturaM:z.number().min(0).max(100)})).max(200),
  modulo:z.object({modelo:z.string().min(1).max(200),produtoId:z.string().uuid().optional(),larguraM:z.number().min(0.2).max(10),alturaM:z.number().min(0.2).max(10),potenciaWp:z.number().int().min(1).max(3000),pesoKg:z.number().min(0).max(200).optional()}),
  espacamentoM:z.number().min(0).max(5),recuoM:z.number().min(0).max(10),
  placas:z.array(z.object({id:z.string().uuid(),aguaId:z.string().uuid(),pontos:z.array(ponto).length(4),stringId:z.string().uuid().optional()})).min(1).max(2000),
}).superRefine((d,ctx)=>{
  const ids=d.aguas.map(a=>a.id);
  if(new Set(ids).size!==ids.length||new Set(d.placas.map(p=>p.id)).size!==d.placas.length)ctx.addIssue({code:'custom',message:'IDs do levantamento devem ser únicos.'});
  if(d.placas.some(p=>!ids.includes(p.aguaId)))ctx.addIssue({code:'custom',message:'Módulo associado a uma água inexistente.'});
  if([...d.aguas,...d.obstaculos,...d.placas].some(a=>a.pontos.some(p=>p.x>d.larguraM+1e-6||p.y>d.alturaM+1e-6)))ctx.addIssue({code:'custom',message:'Geometria fora das dimensões da planta.'});
  // O tsconfig do front (que também inspeciona os scripts de teste) não usa
  // strictNullChecks: a inferência Zod fica opcional lá, mas parse já validou.
  const pontos=(p:unknown)=>p as PontoLocal[];
  if([...d.aguas,...d.obstaculos].some(a=>!poligonoValido(pontos(a.pontos))))ctx.addIssue({code:'custom',message:'Contorno inválido ou cruzado.'});
  for(const [i,p] of d.placas.entries()) {
    const agua=d.aguas.find(a=>a.id===p.aguaId);
    if(agua&&!cabe(pontos(p.pontos),pontos(agua.pontos),d.obstaculos.map(o=>pontos(o.pontos)),d.recuoM)) {
      ctx.addIssue({code:'custom',message:'Módulo fora da água ou sobre obstáculo/recuo.'});break;
    }
    if(d.placas.slice(0,i).some(a=>sobrepoe(pontos(a.pontos),pontos(p.pontos)))){ctx.addIssue({code:'custom',message:'Há módulos sobrepostos.'});break;}
  }
});
