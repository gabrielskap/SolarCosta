import { http } from './http';
import { chaveCaptura, type CapturaTelhado } from '../../server/src/domain/capturaTelhado';
import type { LevantamentoTelhado } from '../utils/levantamentoTelhado';
import type { CapturaHD } from '../utils/capturarMapaHD';

export type { CapturaTelhado };
export async function assinaturaCaptura(dados:LevantamentoTelhado) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(chaveCaptura(dados)));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const caminho=(p:string,id?:string)=>`/api/propostas/${p}/capturas-telhado${id?'/'+id:''}`;
export const listarCapturas=(p:string,assinatura:string)=>http.get<{capturas:CapturaTelhado[]}>(`${caminho(p)}?assinatura=${assinatura}`);
export const cancelarCaptura=(p:string,id:string)=>http.post<{captura:CapturaTelhado}>(`${caminho(p,id)}/cancelar`);
export const imagemCaptura=(p:string,id:string)=>http.getBlob(`${caminho(p,id)}/imagem`);

export async function enviarCaptura(p:string,id:string,pastaId:number,melhorarIA:boolean,dados:LevantamentoTelhado,pacote:CapturaHD) {
  let {captura}=await http.post<{captura:CapturaTelhado}>(caminho(p),{id,pastaId,melhorarIA,dados,largura:pacote.largura,altura:pacote.altura});
  if(captura.estado!=='pendente'||captura.pronta)return captura;
  const arquivos:Array<['original'|'fundo'|'mascara',Blob]>= [['original',pacote.original]];
  if(melhorarIA)arquivos.push(['fundo',pacote.fundo],['mascara',pacote.mascara]);
  for(const [tipo,bytes] of arquivos)await http.postBinario(`${caminho(p,id)}/arquivos/${tipo}`,bytes);
  return (await http.post<{captura:CapturaTelhado}>(`${caminho(p,id)}/iniciar`)).captura;
}
