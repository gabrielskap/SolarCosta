// Aproximação NOAA: https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF
// Ângulos geométricos, sem correção de refração atmosférica.
export function posicaoSolar(data:string,hora:number,latitude:number,longitude:number,fuso:number) {
  const [ano,mes,dia]=data.split('-').map(Number);
  const inicio=Date.UTC(ano,0,1),instante=Date.UTC(ano,mes-1,dia);
  const diasAno=(Date.UTC(ano+1,0,1)-inicio)/86400000;
  const ordem=(instante-inicio)/86400000+1;
  const g=2*Math.PI/diasAno*(ordem-1+(hora-12)/24);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const t=((hora*60+eq+4*longitude-60*fuso)%1440+1440)%1440;
  const ha=(t/4-180)*Math.PI/180,lat=latitude*Math.PI/180;
  const zen=Math.acos(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha))));
  const elevacao=90-zen*180/Math.PI;
  const azimute=((Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))*180/Math.PI+180)%360+360)%360;
  return {elevacao,azimute};
}
export function incidenciaDireta(elevacao:number,azimuteSol:number,inclinacao:number,azimuteAgua:number) {
  if(elevacao<=0)return 0;
  const r=Math.PI/180;
  return Math.max(0,Math.sin(elevacao*r)*Math.cos(inclinacao*r)+Math.cos(elevacao*r)*Math.sin(inclinacao*r)*Math.cos((azimuteSol-azimuteAgua)*r));
}
