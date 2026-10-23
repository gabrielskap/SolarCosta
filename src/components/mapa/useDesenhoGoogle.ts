import { useEffect, useRef } from 'react';
import type { LevantamentoTelhado, PontoLocal } from '../../utils/levantamentoTelhado';
import { dentro } from '../../utils/levantamentoTelhado';
import { criarGeorreferencia } from '../../utils/georreferenciaTelhado';
import { incidenciaDireta, posicaoSolar } from '../../utils/posicaoSolar';

export interface EdicaoGoogle {
  dados: LevantamentoTelhado; rascunho: PontoLocal[]; ferramenta: string;
  onPonto: (p: PontoLocal) => void; onRemover: (id: string) => void; onFechar: () => void;
  onCamera: (vista: NonNullable<LevantamentoTelhado['vistaGoogle']>) => void;
  onAviso: (mensagem: string) => void;
  aguaSelecionada?: string; onSelecionarAgua?: (id:string)=>void;
  placaSelecionada?: string;
}

export function lerCameraGoogle(modo: 'satelite' | '3d', mapa: any): NonNullable<LevantamentoTelhado['vistaGoogle']> | null {
  if (modo === 'satelite') {
    const centro = mapa.getCenter();
    return centro ? { modo, latitude: centro.lat(), longitude: centro.lng(), zoom: mapa.getZoom() } : null;
  }
  const c = mapa.center;
  return c ? { modo, latitude: c.lat, longitude: c.lng, altitude: c.altitude, distanciaM: mapa.range, inclinacao: mapa.tilt, azimute: ((mapa.heading ?? 0) % 360 + 360) % 360 } : null;
}

export function useDesenhoGoogle(instancia: { mapa: any; biblioteca?: any } | null, modo: 'satelite' | '3d', edicao: EdicaoGoogle, somenteLeitura=false) {
  const atual = useRef(edicao); atual.current = edicao;
  useEffect(() => {
    if (!instancia || somenteLeitura) return;
    const { mapa } = instancia;
    let ponteiro: { x:number;y:number;tratado:boolean;id:number;movido:boolean } | null = null;
    const clique = (e: any) => {
      if((mapa.getDiv?.()??mapa).dataset?.capturando==='true')return;
      // isSteady indica carregamento/renderização da cena, não movimento da
      // câmera. O Google pode entregar gmp-click sem expor os PointerEvents
      // internos do mapa; esse clique com posição nativa também é válido.
      if(modo==='3d'&&(ponteiro?.tratado||ponteiro?.movido))return;
      const { dados, ferramenta, rascunho, onPonto, onRemover, onFechar } = atual.current;
      const geo = criarGeorreferencia(dados), pos = e.latLng ?? e.position ?? e.detail?.position;
      if (!geo) { atual.current.onAviso('Use Definir imóvel para fixar a área antes de desenhar.'); return; }
      if (!pos) { atual.current.onAviso('Clique sobre o imóvel, evitando o horizonte e os controles do mapa.'); return; }
      const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat ?? pos.latitude;
      const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng ?? pos.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if(modo==='3d'&&ponteiro)ponteiro.tratado=true;
      const p = geo.paraLocal(lat, lng);
      if (p.x < 0 || p.y < 0 || p.x > dados.larguraM || p.y > dados.alturaM) { atual.current.onAviso('Ponto fora da moldura do projeto. Use Definir imóvel para substituir a localização anterior.'); return; }
      if(ferramenta==='navegar'){
        const agua=[...dados.aguas].reverse().find(a=>dentro(p,a.pontos));
        if(agua)atual.current.onSelecionarAgua?.(agua.id);
        return;
      }
      e.preventDefault?.();
      if (ferramenta === 'remover') {
        const placa = [...dados.placas].reverse().find(a => dentro(p, a.pontos));
        if (placa) onRemover(placa.id);
      } else if ((ferramenta === 'agua' || ferramenta === 'obstaculo') && rascunho.length >= 3 && Math.hypot(p.x - rascunho[0].x, p.y - rascunho[0].y) < dados.larguraM / 100) onFechar();
      else onPonto(p);
    };
    let timer: ReturnType<typeof setTimeout>;
    const camera = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const vista = lerCameraGoogle(modo, mapa);
        if (vista&&(mapa.getDiv?.()??mapa).dataset?.capturando!=='true') atual.current.onCamera(vista);
      }, 200);
    };
    if (modo === 'satelite') {
      const a = mapa.addListener('click', clique), b = mapa.addListener('idle', camera);
      return () => { a.remove(); b.remove(); clearTimeout(timer); };
    }
    mapa.addEventListener('gmp-click', clique);
    // O Map3DElement reconhece o duplo clique pelos próprios PointerEvents, sem
    // depender do evento dblclick. Em edição, a câmera anterior ao clique é
    // restaurada se o gesto tentar movê-la; a roda do mouse continua livre.
    let fixa: { center:any;range:number;tilt:number;heading:number } | null = null, gestoAte = 0;
    const descer=(e:PointerEvent)=>{

      if(e.button!==0||e.isPrimary===false||e.composedPath().some(el=>el!==mapa&&el instanceof Element&&el.matches('button,a,input,select,[role="button"]'))) {ponteiro=null;return;}
      ponteiro={x:e.clientX,y:e.clientY,tratado:false,id:e.pointerId,movido:false};
      if(atual.current.ferramenta!=='navegar'){
        mapa.stopCameraAnimation?.();
        if(Date.now()>gestoAte)fixa={center:{...mapa.center},range:mapa.range,tilt:mapa.tilt,heading:mapa.heading};
        gestoAte=Date.now()+1500;
      }else{gestoAte=0;fixa=null;}
    };
    const travar=()=>{
      if(!fixa||atual.current.ferramenta==='navegar'||Date.now()>gestoAte)return;
      const c=mapa.center;
      if(c&&Math.abs(c.lat-fixa.center.lat)<1e-9&&Math.abs(c.lng-fixa.center.lng)<1e-9&&Math.abs(mapa.range-fixa.range)<0.01&&Math.abs(mapa.tilt-fixa.tilt)<0.01&&Math.abs(mapa.heading-fixa.heading)<0.01)return;
      mapa.stopCameraAnimation?.();Object.assign(mapa,fixa);
    };
    const eventosCamera=['gmp-centerchange','gmp-rangechange','gmp-tiltchange','gmp-headingchange'];
    eventosCamera.forEach(n=>mapa.addEventListener(n,travar));
    const roda=()=>{gestoAte=0;fixa=null;};
    mapa.addEventListener('wheel',roda,true);
    const mover=(e:PointerEvent)=>{
      if(ponteiro?.id!==e.pointerId)return;
      if(Math.hypot(e.clientX-ponteiro.x,e.clientY-ponteiro.y)>4)ponteiro.movido=true;
      // O SDK precisa receber down/up para produzir gmp-click com a posição
      // real da malha. Só o movimento é interceptado em edição: assim um
      // pequeno deslocamento do mouse não arrasta o telhado sob o cursor.
      if(atual.current.ferramenta!=='navegar')e.stopPropagation();
    };
    const cancelar=()=>{ponteiro=null;};
    const subir=(e:PointerEvent)=>{
      const inicio=ponteiro;
      if(!inicio||inicio.id!==e.pointerId)return;
      if(Math.hypot(e.clientX-inicio.x,e.clientY-inicio.y)>4)inicio.movido=true;
      // Sem position do Google não há interseção confiável com o telhado.
      // Nunca estimar um ponto no solo: isso deslocava o desenho em relação ao 2D.

    };
    mapa.addEventListener('pointerdown',descer,true);
    mapa.addEventListener('pointerup',subir,true);
    mapa.addEventListener('pointermove',mover,true);
    mapa.addEventListener('pointercancel',cancelar,true);
    const duploClique=(e:MouseEvent)=>{
      if(atual.current.ferramenta==='navegar')return;
      // O duplo clique não pode reenquadrar/aproximar o telhado durante edição.
      e.preventDefault();e.stopPropagation();
    };
    mapa.addEventListener('dblclick',duploClique,true);
    const estabilidade = (e: Event & {isSteady?:boolean}) => { if(e.isSteady)camera(); };
    mapa.addEventListener('gmp-steadychange', estabilidade);
    return () => { mapa.removeEventListener('gmp-click', clique); mapa.removeEventListener('pointerdown',descer,true);mapa.removeEventListener('pointerup',subir,true);mapa.removeEventListener('pointermove',mover,true);mapa.removeEventListener('pointercancel',cancelar,true);mapa.removeEventListener('dblclick',duploClique,true);mapa.removeEventListener('gmp-steadychange', estabilidade);eventosCamera.forEach(n=>mapa.removeEventListener(n,travar));mapa.removeEventListener('wheel',roda,true); clearTimeout(timer); };
  }, [instancia, modo, somenteLeitura]);

  useEffect(() => {
    if (!instancia || somenteLeitura || modo !== 'satelite') return;
    // Mesma regra do 3D: só Mover mapa arrasta ou aproxima por duplo clique.
    const navegar = edicao.ferramenta === 'navegar';
    instancia.mapa.setOptions?.({ draggable: navegar, disableDoubleClickZoom: !navegar });
  }, [instancia, modo, somenteLeitura, edicao.ferramenta]);

  const d = edicao.dados;
  useEffect(() => {
    const geo = criarGeorreferencia(d);
    if (!instancia || !geo) return;
    const { mapa, biblioteca } = instancia;
    const remover: Array<() => void> = [];
    const limpar=()=>remover.splice(0).forEach(fn=>fn());
    const renderizar=(fase='editor')=>{
    limpar();if(fase==='fundo')return;
    const exportando=fase==='contornos';
    const s = d.simulacao, loc = d.localizacao ?? d.satelite;
    const sol = s && loc ? posicaoSolar(s.data, s.hora, loc.latitude, loc.longitude, s.fuso) : null;
    const desenhar = (pontos: PontoLocal[], cor: string, linha = false, aguaId?:string, camada=10, contorno?:string) => {
      if (pontos.length < (linha ? 2 : 3)) return;
      // Separação visual sobre a malha: placas acima das águas, evitando
      // superfícies coplanares que piscam ou se encobrem ao girar a câmera.
      const path = pontos.map(p=>({...geo.paraGeo(p),...(modo==='3d'?{altitude:camada/100}:{})}));
      const selecionavel=!!aguaId && !somenteLeitura && !!atual.current.onSelecionarAgua && edicao.ferramenta==='navegar';
      const espessura=aguaId===edicao.aguaSelecionada?4:2;
      if (modo === 'satelite') {
        const maps = (window as any).google.maps;
        const objeto = linha ? new maps.Polyline({ path, zIndex: camada, strokeColor: cor, strokeWeight: 3, clickable: false, map: mapa })
          : new maps.Polygon({ paths: path, zIndex: camada, fillColor: cor, fillOpacity: exportando||camada===30?1:0.5, strokeColor: contorno??(camada===30?'#93c5fd':cor), strokeWeight: contorno?4:espessura, clickable: selecionavel, map: mapa });
        const listener=selecionavel?objeto.addListener('click',()=>atual.current.onSelecionarAgua?.(aguaId!)):undefined;
        remover.push(() => {listener?.remove();objeto.setMap(null);});
      } else {
        const Polygon=selecionavel?biblioteca.Polygon3DInteractiveElement:biblioteca.Polygon3DElement;
        const objeto = linha ? new biblioteca.Polyline3DElement({ path, zIndex: camada, strokeColor: cor, strokeWidth: 3, altitudeMode: 'RELATIVE_TO_MESH', drawsOccludedSegments: true })
          : new Polygon({ path, zIndex: camada, fillColor: cor + (exportando||camada===30?'ff':'80'), strokeColor: contorno??(camada===30?'#93c5fd':cor), strokeWidth: contorno?4:espessura, altitudeMode: 'RELATIVE_TO_MESH', drawsOccludedSegments: true });
        const selecionar=(e:Event)=>{e.stopPropagation();atual.current.onSelecionarAgua?.(aguaId!);};
        if(selecionavel)objeto.addEventListener('gmp-click',selecionar);
        mapa.append(objeto); remover.push(() => {objeto.removeEventListener('gmp-click',selecionar);objeto.remove();});
      }
    };
    for (const a of d.aguas) {
      let cor = '#0284c7';
      if (s?.mostrarIncidencia && sol) {
        const intensidade = incidenciaDireta(sol.elevacao, sol.azimute, a.inclinacao, a.azimute);
        cor = '#' + [Math.round(255 * intensidade), 100, Math.round(255 * (1 - intensidade))].map(v => v.toString(16).padStart(2, '0')).join('');
      }
      if(exportando)desenhar([...a.pontos,a.pontos[0]],cor,true);else desenhar(a.pontos, cor, false, a.id);
    }
    d.obstaculos.forEach(a => desenhar(exportando?[...a.pontos,a.pontos[0]]:a.pontos, '#dc2626',exportando,undefined,20));
    d.placas.forEach(a => desenhar(a.pontos, '#1e3a8a',false,undefined,30,!exportando&&a.id===edicao.placaSelecionada?'#f59e0b':undefined));
    if (!exportando && s?.mostrarSombras && sol && sol.elevacao > 0) for (const o of d.obstaculos) {
      const comprimento = o.alturaM / Math.tan(sol.elevacao * Math.PI / 180), ang = (sol.azimute - d.norte) * Math.PI / 180;
      const topo = o.pontos.map(p => ({ x: p.x - comprimento * Math.sin(ang), y: p.y + comprimento * Math.cos(ang) }));
      desenhar(topo, '#334155',false,undefined,40);
      o.pontos.forEach((p, i) => { const j = (i + 1) % o.pontos.length; desenhar([p, o.pontos[j], topo[j], topo[i]], '#334155',false,undefined,40); });
    }
    if(!exportando)desenhar(edicao.rascunho, '#d97706', true,undefined,50);
    if(!exportando)edicao.rascunho.forEach((p,i)=>{
      if(modo==='satelite') {
        const maps=(window as any).google.maps;
        const marker=new maps.Marker({map:mapa,position:geo.paraGeo(p),clickable:false,icon:{path:maps.SymbolPath.CIRCLE,scale:7,fillColor:i===0&&edicao.rascunho.length>=3?'#16a34a':'#d97706',fillOpacity:1,strokeWeight:1}});
        remover.push(()=>marker.setMap(null));
      }else{
        const fechar = i===0 && edicao.rascunho.length>=3 && ['agua','obstaculo'].includes(edicao.ferramenta);
        const Marker = fechar ? biblioteca.Marker3DInteractiveElement : biblioteca.Marker3DElement;
        const marker=new Marker({position:{...geo.paraGeo(p),altitude:0.5},altitudeMode:'RELATIVE_TO_MESH',drawsWhenOccluded:true});
        const template=document.createElement('template');
        template.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="'+(fechar?'#16a34a':'#d97706')+'" stroke="#fff" stroke-width="2"/></svg>';
        marker.append(template);
        const concluir=(e:Event)=>{e.stopPropagation();atual.current.onFechar();};
        if(fechar)marker.addEventListener('gmp-click',concluir);
        mapa.append(marker);remover.push(()=>{marker.removeEventListener('gmp-click',concluir);marker.remove();});
      }
    });
    // Nenhuma água é desenhada automaticamente: só geometria salva ou pontos marcados.
    };
    renderizar();
    const alvo=mapa.getDiv?.()??mapa;
    const mudar=(e:Event)=>renderizar((e as CustomEvent).detail);
    alvo.addEventListener('solarcosta-captura-fase',mudar);
    return () => {alvo.removeEventListener('solarcosta-captura-fase',mudar);limpar();};
  }, [instancia, modo, d.aguas, d.obstaculos, d.placas, d.simulacao, d.localizacao, d.satelite, d.larguraM, d.alturaM, d.norte, edicao.rascunho, edicao.ferramenta, edicao.aguaSelecionada, edicao.placaSelecionada, somenteLeitura]);
}
