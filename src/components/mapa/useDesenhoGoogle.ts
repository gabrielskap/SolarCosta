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
    let estavel = true;
    const clique = (e: any) => {
      if((mapa.getDiv?.()??mapa).dataset?.capturando==='true')return;
      // Um toque parado pode emitir steady=false. Só bloquear animação sem gesto ou arrasto real.
      if(modo==='3d'&&((!estavel&&!ponteiro)||ponteiro?.tratado||ponteiro?.movido))return;
      const { dados, ferramenta, rascunho, onPonto, onRemover, onFechar } = atual.current;
      const geo = criarGeorreferencia(dados), pos = e.latLng ?? e.position ?? e.detail?.position;
      if (!geo) { atual.current.onAviso('Use Mais ações → Definir imóvel neste centro para fixar a área antes de desenhar.'); return; }
      if (!pos) { atual.current.onAviso('Clique sobre o imóvel, evitando o horizonte e os controles do mapa.'); return; }
      const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat ?? pos.latitude;
      const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng ?? pos.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if(modo==='3d'&&ponteiro)ponteiro.tratado=true;
      const p = geo.paraLocal(lat, lng);
      if (p.x < 0 || p.y < 0 || p.x > dados.larguraM || p.y > dados.alturaM) { atual.current.onAviso('Ponto fora da moldura do projeto. Use Mais ações → Definir imóvel neste centro para substituir a localização anterior.'); return; }
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
    const descer=(e:PointerEvent)=>{

      if(e.button!==0||e.isPrimary===false||e.composedPath().some(el=>el instanceof Element&&el.matches('button,a,input,select,[role="button"]'))) {ponteiro=null;return;}
      ponteiro={x:e.clientX,y:e.clientY,tratado:false,id:e.pointerId,movido:false};
    };
    const mover=(e:PointerEvent)=>{if(ponteiro?.id===e.pointerId&&Math.hypot(e.clientX-ponteiro.x,e.clientY-ponteiro.y)>4)ponteiro.movido=true;};
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
    const estabilidade = (e: Event & {isSteady?:boolean}) => { estavel = e.isSteady === true; if(estavel)camera(); };
    mapa.addEventListener('gmp-steadychange', estabilidade);
    return () => { mapa.removeEventListener('gmp-click', clique); mapa.removeEventListener('pointerdown',descer,true);mapa.removeEventListener('pointerup',subir,true);mapa.removeEventListener('pointermove',mover,true);mapa.removeEventListener('pointercancel',cancelar,true);mapa.removeEventListener('gmp-steadychange', estabilidade); clearTimeout(timer); };
  }, [instancia, modo, somenteLeitura]);

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
    const desenhar = (pontos: PontoLocal[], cor: string, linha = false, aguaId?:string) => {
      if (pontos.length < (linha ? 2 : 3)) return;
      const path = pontos.map(p=>({...geo.paraGeo(p),...(modo==='3d'?{altitude:0.1}:{})}));
      const selecionavel=!!aguaId && !somenteLeitura && !!atual.current.onSelecionarAgua && edicao.ferramenta==='navegar';
      const espessura=aguaId===edicao.aguaSelecionada?4:2;
      if (modo === 'satelite') {
        const maps = (window as any).google.maps;
        const objeto = linha ? new maps.Polyline({ path, strokeColor: cor, strokeWeight: 3, clickable: false, map: mapa })
          : new maps.Polygon({ paths: path, fillColor: cor, fillOpacity: exportando?1:0.5, strokeColor: cor, strokeWeight: espessura, clickable: selecionavel, map: mapa });
        const listener=selecionavel?objeto.addListener('click',()=>atual.current.onSelecionarAgua?.(aguaId!)):undefined;
        remover.push(() => {listener?.remove();objeto.setMap(null);});
      } else {
        const Polygon=selecionavel?biblioteca.Polygon3DInteractiveElement:biblioteca.Polygon3DElement;
        const objeto = linha ? new biblioteca.Polyline3DElement({ path, strokeColor: cor, strokeWidth: 3, altitudeMode: 'RELATIVE_TO_MESH', drawsOccludedSegments: true })
          : new Polygon({ path, fillColor: cor + (exportando?'ff':'80'), strokeColor: cor, strokeWidth: espessura, altitudeMode: 'RELATIVE_TO_MESH', drawsOccludedSegments: true });
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
    d.obstaculos.forEach(a => desenhar(exportando?[...a.pontos,a.pontos[0]]:a.pontos, '#dc2626',exportando));
    d.placas.forEach(a => desenhar(a.pontos, '#1e3a8a'));
    if (!exportando && s?.mostrarSombras && sol && sol.elevacao > 0) for (const o of d.obstaculos) {
      const comprimento = o.alturaM / Math.tan(sol.elevacao * Math.PI / 180), ang = (sol.azimute - d.norte) * Math.PI / 180;
      const topo = o.pontos.map(p => ({ x: p.x - comprimento * Math.sin(ang), y: p.y + comprimento * Math.cos(ang) }));
      desenhar(topo, '#334155');
      o.pontos.forEach((p, i) => { const j = (i + 1) % o.pontos.length; desenhar([p, o.pontos[j], topo[j], topo[i]], '#334155'); });
    }
    if(!exportando)desenhar(edicao.rascunho, '#d97706', true);
    if(!exportando)edicao.rascunho.forEach((p,i)=>{
      if(modo==='satelite') {
        const maps=(window as any).google.maps;
        const marker=new maps.Marker({map:mapa,position:geo.paraGeo(p),clickable:false,icon:{path:maps.SymbolPath.CIRCLE,scale:7,fillColor:i===0&&edicao.rascunho.length>=3?'#16a34a':'#d97706',fillOpacity:1,strokeWeight:1}});
        remover.push(()=>marker.setMap(null));
      }else{
        const fechar = i===0 && edicao.rascunho.length>=3 && ['agua','obstaculo'].includes(edicao.ferramenta);
        const Marker = fechar ? biblioteca.Marker3DInteractiveElement : biblioteca.Marker3DElement;
        const marker=new Marker({position:{...geo.paraGeo(p),altitude:0.1},altitudeMode:'RELATIVE_TO_MESH',drawsWhenOccluded:true});
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
  }, [instancia, modo, d.aguas, d.obstaculos, d.placas, d.simulacao, d.localizacao, d.satelite, d.larguraM, d.alturaM, d.norte, edicao.rascunho, edicao.ferramenta, edicao.aguaSelecionada, somenteLeitura]);
}
