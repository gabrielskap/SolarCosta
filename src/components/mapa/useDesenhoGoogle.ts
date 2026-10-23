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
}

export function lerCameraGoogle(modo: 'satelite' | '3d', mapa: any): NonNullable<LevantamentoTelhado['vistaGoogle']> | null {
  if (modo === 'satelite') {
    const centro = mapa.getCenter();
    return centro ? { modo, latitude: centro.lat(), longitude: centro.lng(), zoom: mapa.getZoom() } : null;
  }
  const c = mapa.center;
  return c ? { modo, latitude: c.lat, longitude: c.lng, altitude: c.altitude, distanciaM: mapa.range, inclinacao: mapa.tilt, azimute: ((mapa.heading ?? 0) % 360 + 360) % 360 } : null;
}

export function useDesenhoGoogle(instancia: { mapa: any; biblioteca?: any } | null, modo: 'satelite' | '3d', edicao: EdicaoGoogle) {
  const atual = useRef(edicao); atual.current = edicao;
  useEffect(() => {
    if (!instancia) return;
    const { mapa } = instancia;
    const clique = (e: any) => {
      const { dados, ferramenta, rascunho, onPonto, onRemover, onFechar } = atual.current;
      const geo = criarGeorreferencia(dados), pos = e.latLng ?? e.position;
      if (!geo) { atual.current.onAviso('Clique em Usar centro como endereço do 2D para fixar a área antes de desenhar.'); return; }
      if (!pos) { atual.current.onAviso('Clique sobre o imóvel, evitando o horizonte e os controles do mapa.'); return; }
      const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
      const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const p = geo.paraLocal(lat, lng);
      if (p.x < 0 || p.y < 0 || p.x > dados.larguraM || p.y > dados.alturaM) { atual.current.onAviso('Ponto fora da moldura do projeto. Use o centro como endereço do 2D para substituir a localização anterior.'); return; }
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
        if (vista) atual.current.onCamera(vista);
      }, 200);
    };
    if (modo === 'satelite') {
      const a = mapa.addListener('click', clique), b = mapa.addListener('idle', camera);
      return () => { a.remove(); b.remove(); clearTimeout(timer); };
    }
    mapa.addEventListener('gmp-click', clique);
    mapa.addEventListener('gmp-steadychange', camera);
    return () => { mapa.removeEventListener('gmp-click', clique); mapa.removeEventListener('gmp-steadychange', camera); clearTimeout(timer); };
  }, [instancia, modo]);

  const d = edicao.dados;
  useEffect(() => {
    const geo = criarGeorreferencia(d);
    if (!instancia || !geo) return;
    const { mapa, biblioteca } = instancia;
    const remover: Array<() => void> = [];
    const s = d.simulacao, loc = d.localizacao ?? d.satelite;
    const sol = s && loc ? posicaoSolar(s.data, s.hora, loc.latitude, loc.longitude, s.fuso) : null;
    const desenhar = (pontos: PontoLocal[], cor: string, linha = false) => {
      if (pontos.length < (linha ? 2 : 3)) return;
      const path = pontos.map(geo.paraGeo);
      if (modo === 'satelite') {
        const maps = (window as any).google.maps;
        const objeto = linha ? new maps.Polyline({ path, strokeColor: cor, strokeWeight: 3, clickable: false, map: mapa })
          : new maps.Polygon({ paths: path, fillColor: cor, fillOpacity: 0.5, strokeColor: cor, strokeWeight: 2, clickable: false, map: mapa });
        remover.push(() => objeto.setMap(null));
      } else {
        const objeto = linha ? new biblioteca.Polyline3DElement({ path, strokeColor: cor, strokeWidth: 3, altitudeMode: 'CLAMP_TO_GROUND', drawsOccludedSegments: true })
          : new biblioteca.Polygon3DElement({ path, fillColor: cor + '80', strokeColor: cor, strokeWidth: 2, altitudeMode: 'CLAMP_TO_GROUND', drawsOccludedSegments: true });
        mapa.append(objeto); remover.push(() => objeto.remove());
      }
    };
    for (const a of d.aguas) {
      let cor = '#0284c7';
      if (s?.mostrarIncidencia && sol) {
        const intensidade = incidenciaDireta(sol.elevacao, sol.azimute, a.inclinacao, a.azimute);
        cor = '#' + [Math.round(255 * intensidade), 100, Math.round(255 * (1 - intensidade))].map(v => v.toString(16).padStart(2, '0')).join('');
      }
      desenhar(a.pontos, cor);
    }
    d.obstaculos.forEach(a => desenhar(a.pontos, '#dc2626'));
    d.placas.forEach(a => desenhar(a.pontos, '#1e3a8a'));
    if (s?.mostrarSombras && sol && sol.elevacao > 0) for (const o of d.obstaculos) {
      const comprimento = o.alturaM / Math.tan(sol.elevacao * Math.PI / 180), ang = (sol.azimute - d.norte) * Math.PI / 180;
      const topo = o.pontos.map(p => ({ x: p.x - comprimento * Math.sin(ang), y: p.y + comprimento * Math.cos(ang) }));
      desenhar(topo, '#334155');
      o.pontos.forEach((p, i) => { const j = (i + 1) % o.pontos.length; desenhar([p, o.pontos[j], topo[j], topo[i]], '#334155'); });
    }
    desenhar(edicao.rascunho, '#d97706', true);
    edicao.rascunho.forEach((p,i)=>{
      if(modo==='satelite') {
        const maps=(window as any).google.maps;
        const marker=new maps.Marker({map:mapa,position:geo.paraGeo(p),label:String(i+1),clickable:false,icon:{path:maps.SymbolPath.CIRCLE,scale:7,fillColor:i===0?'#16a34a':'#d97706',fillOpacity:1,strokeWeight:1}});
        remover.push(()=>marker.setMap(null));
      }else{
        const marker=new biblioteca.Marker3DElement({position:geo.paraGeo(p),label:String(i+1),altitudeMode:'CLAMP_TO_GROUND',drawsWhenOccluded:true});
        mapa.append(marker);remover.push(()=>marker.remove());
      }
    });
    // Moldura delimita a área georreferenciada do projeto durante a navegação.
    desenhar([{ x: 0, y: 0 }, { x: d.larguraM, y: 0 }, { x: d.larguraM, y: d.alturaM }, { x: 0, y: d.alturaM }, { x: 0, y: 0 }], '#64748b', true);
    return () => remover.forEach(fn => fn());
  }, [instancia, modo, d.aguas, d.obstaculos, d.placas, d.simulacao, d.localizacao, d.satelite, d.larguraM, d.alturaM, d.norte, edicao.rascunho]);
}
