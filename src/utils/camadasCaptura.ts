/** Preserva desenho e atribuição fora do processamento por IA. */
export function mascaraCaptura(fundo:Uint8ClampedArray, original:Uint8ClampedArray, largura:number,altura:number,rodape:number) {
  const mask=new Uint8ClampedArray(largura*altura*4);
  for(let y=0;y<altura;y++)for(let x=0;x<largura;x++){
    const i=(y*largura+x)*4;
    const mudou=Math.max(Math.abs(fundo[i]-original[i]),Math.abs(fundo[i+1]-original[i+1]),Math.abs(fundo[i+2]-original[i+2]))>4;
    if(mudou||y>=altura-rodape)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=largura||yy>=altura)continue;
      const j=(yy*largura+xx)*4;mask[j]=mask[j+1]=mask[j+2]=255;
    }
  }
  for(let i=3;i<mask.length;i+=4)mask[i]=255;
  return mask;
}
export function fundoEstavel(a:Uint8ClampedArray,b:Uint8ClampedArray,largura:number,altura:number,rodape:number) {
  if(a.length!==b.length)return false;
  let alterados=0,total=0;
  for(let y=0;y<altura-rodape;y+=2)for(let x=0;x<largura;x+=2){
    const i=(y*largura+x)*4;total++;
    if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>8)alterados++;
  }
  return total>0&&alterados/total<0.002;
}
