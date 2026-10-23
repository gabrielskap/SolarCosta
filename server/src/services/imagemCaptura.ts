import sharp from 'sharp';
import { AppError } from '../errors.js';

export const LIMITE_IMAGEM = 10*1024*1024;
export async function validarImagem(bytes: Buffer, largura: number, altura: number): Promise<'image/png'|'image/webp'> {
  if(!bytes.length||bytes.length>LIMITE_IMAGEM)throw new AppError(422,'Cada imagem deve ter entre 1 byte e 10 MB.');
  try {
    const m=await sharp(bytes,{limitInputPixels:3840*3840,animated:false}).metadata();
    if(!['png','webp'].includes(m.format??'')||m.width!==largura||m.height!==altura||(m.pages??1)>1)throw new Error();
    // metadata() não decodifica a imagem inteira: force a validação do conteúdo.
    await sharp(bytes,{limitInputPixels:3840*3840}).stats();
    return m.format==='png'?'image/png':'image/webp';
  } catch { throw new AppError(422,'Imagem inválida ou dimensões diferentes da captura.'); }
}

/** Só o fundo passa pela rede neural; desenho e atribuição vêm do original. */
export async function comporCaptura(original: Buffer, mascara: Buffer, fundoIA: Buffer): Promise<Buffer> {
  const m=await sharp(original).metadata();
  const fator=Math.min(2,3840/Math.max(m.width!,m.height!));
  const width=Math.round(m.width!*fator),height=Math.round(m.height!*fator);
  await validarImagem(fundoIA,width,height);
  const alpha=await sharp(mascara).resize(width,height,{kernel:'nearest'}).extractChannel(0).raw().toBuffer();
  // removeAlpha() é aplicado pelo sharp depois de joinChannel(): separar as etapas.
  const rgb=await sharp(original).resize(width,height,{kernel:'lanczos3'}).removeAlpha().raw().toBuffer();
  const camada=await sharp(rgb,{raw:{width,height,channels:3}})
    .joinChannel(alpha,{raw:{width,height,channels:1}}).png().toBuffer();
  // Lossless mantém os pixels protegidos; se muito grande, recusar e conservar original.
  const final=await sharp(fundoIA).composite([{input:camada}]).webp({lossless:true}).toBuffer();
  if(final.length>LIMITE_IMAGEM)throw new AppError(422,'A imagem ampliada excedeu 10 MB. O original foi preservado.');
  return final;
}
