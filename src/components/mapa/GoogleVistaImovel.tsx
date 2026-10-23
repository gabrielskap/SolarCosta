import React, { useEffect, useRef, useState } from 'react';
import type { ControleCaptura } from '../../utils/capturarMapaHD';
import { useGoogleMaps } from './useGoogleMaps';
import { useDesenhoGoogle, lerCameraGoogle, type EdicaoGoogle } from './useDesenhoGoogle';

export function GoogleVistaImovel({ chave, latitude, longitude, modo, onVoltar, edicao, onSalvarVista, onSelecionarLocal, salvando=false, somenteLeitura=false, onIndisponivel }: {
  chave?: string | null; latitude: number; longitude: number; modo: 'satelite' | '3d'; onVoltar: () => void;
  edicao: EdicaoGoogle; onSalvarVista: (vista: NonNullable<EdicaoGoogle['dados']['vistaGoogle']>) => void;
  salvando?: boolean;
  somenteLeitura?: boolean; onIndisponivel?: (mensagem:string)=>void;
  onSelecionarLocal: (vista: NonNullable<EdicaoGoogle['dados']['vistaGoogle']>) => void;
}) {
  const api = useGoogleMaps(chave, true);
  const container = useRef<HTMLDivElement>(null);
  const areaCaptura=useRef<HTMLDivElement>(null);
  const marcador=useRef<any>(null);
  const estabilidade=useRef({pronto:false,em:Date.now()});
  const recentralizar = useRef<() => void>(() => {});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [instancia,setInstancia] = useState<{mapa:any;biblioteca?:any}|null>(null);
  const edicaoAtual = useRef(edicao); edicaoAtual.current = edicao;
  useDesenhoGoogle(instancia, modo, edicao, somenteLeitura);

  useEffect(() => {
    if (!api.pronto || !chave || !container.current) return;
    let vivo = true;
    const host = container.current;
    const limpar: Array<() => void> = [];
    const maps = (window as any).google.maps;
    setErro(''); setCarregando(true);
    const temporizador = window.setTimeout(() => {
      if (vivo) { setCarregando(false); setErro('O mapa demorou para carregar. Confira a conexão, a chave e as APIs habilitadas, ou volte ao levantamento 2D.'); }
    }, 30000);
    const pronto = () => { if (vivo) { estabilidade.current={pronto:true,em:Date.now()}; clearTimeout(temporizador); setCarregando(false); setErro(''); } };
    const iniciar = async () => {
      const centro = { lat: latitude, lng: longitude };
      const salva = edicaoAtual.current.dados.vistaGoogle;
      const vista = salva?.modo === modo ? salva : undefined;
      if (modo === 'satelite') {
        const mapa = new maps.Map(host, { center: vista ? {lat:vista.latitude,lng:vista.longitude} : centro, zoom: vista?.zoom ?? 20, mapTypeId: 'satellite', tilt: 0,
          streetViewControl: false, mapTypeControl: false, fullscreenControl: false, gestureHandling: 'greedy', zoomControl: !somenteLeitura, rotateControl: !somenteLeitura, cameraControl: !somenteLeitura });
        const listener = maps.event.addListenerOnce(mapa, 'tilesloaded', pronto);
        new maps.Marker({map:mapa,position:centro,title:'Ponto confirmado do imóvel'});
        setInstancia({mapa});
        recentralizar.current = () => { mapa.setCenter(centro); mapa.setZoom(20); };
        limpar.push(() => { listener.remove(); maps.event.clearInstanceListeners(mapa); });
        return;
      }
      const biblioteca = await maps.importLibrary('maps3d');
      const { Map3DElement, Marker3DElement } = biblioteca;
      if (!vivo) return;
      // Altitude geográfica evita apontar a câmera para baixo do terreno em cidades altas.
      // Reutilizar a câmera salva ou resolver a elevação automaticamente.
      let altitude: number | undefined = vista?.altitude;
      if (altitude === undefined) try {
        const consulta = maps.importLibrary('elevation').then(({ ElevationService }: any) =>
          new ElevationService().getElevationForLocations({ locations: [centro] }));
        let timer: ReturnType<typeof setTimeout>;
        try {
          const r = await Promise.race([consulta, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 5000); })]);
          if (Number.isFinite(r.results?.[0]?.elevation)) altitude = r.results[0].elevation;
        } finally { clearTimeout(timer!); }
      } catch { /* A visualização continua disponível sem Elevation API. */ }
      if (!vivo) return;
      const camera = { center: { lat:vista?.latitude??latitude,lng:vista?.longitude??longitude,altitude:altitude??0 }, range: vista?.distanciaM ?? 180, tilt: vista?.inclinacao ?? 45, heading: vista?.azimute ?? 0 };
      const mapa = new Map3DElement({ ...camera, range:altitude===undefined?3000:camera.range, maxTilt:75, defaultUIHidden:somenteLeitura, mode: 'SATELLITE' });
      mapa.style.display = 'block'; mapa.style.width = '100%'; mapa.style.height = '100%';
      const falhou = () => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível iniciar o Google 3D. Verifique a chave, o suporte gráfico do navegador e tente novamente.'); } };
      let primeiroEnquadramento=true;
      const estavel = (e: Event & { isSteady?: boolean }) => {
        estabilidade.current={pronto:!!e.isSteady,em:Date.now()};
        if(!e.isSteady)return;
        if(primeiroEnquadramento&&altitude===undefined&&Math.abs(mapa.range-camera.range)>1)return;
        primeiroEnquadramento=false;pronto();
      };
      mapa.addEventListener('gmp-error', falhou);
      mapa.addEventListener('gmp-steadychange', estavel);
      host.replaceChildren(mapa);
      marcador.current=new Marker3DElement({position:centro,altitudeMode:'CLAMP_TO_GROUND',label:'Imóvel',drawsWhenOccluded:true});
      mapa.append(marcador.current);
      setInstancia({mapa,biblioteca});
      const enquadrar = () => {
        mapa.stopCameraAnimation?.();
        if (altitude!==undefined) Object.assign(mapa,camera);
        else mapa.flyCameraTo({endCamera:{...camera,altitudeMode:'RELATIVE_TO_GROUND'},durationMillis:0});
      };
      recentralizar.current = enquadrar;
      limpar.push(() => { mapa.stopCameraAnimation?.(); mapa.removeEventListener('gmp-error', falhou); mapa.removeEventListener('gmp-steadychange', estavel); mapa.remove(); });
      enquadrar();
    };
    iniciar().catch(() => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível abrir esta visualização Google. Confira as APIs habilitadas e volte ao 2D para continuar.'); } });
    return () => { vivo = false; clearTimeout(temporizador); setInstancia(null); limpar.forEach(fn => fn()); host.replaceChildren(); recentralizar.current = () => {}; };
  }, [api.pronto, chave, latitude, longitude, modo, tentativa, somenteLeitura]);

  useEffect(()=>{
    const area=areaCaptura.current;if(!area||!instancia||modo!=='3d')return;
    const preparar=(evento:Event)=>{
      evento.preventDefault();
      const {resolve,reject,signal}=(evento as CustomEvent).detail;
      const mapa=instancia.mapa,camera=lerCameraGoogle(modo,mapa);
      if(!camera||carregando){reject(new Error('Aguarde o mapa carregar.'));return;}
      const ui=mapa.defaultUIHidden;
      mapa.stopCameraAnimation?.();mapa.defaultUIHidden=true;mapa.dataset.capturando='true';
      marcador.current?.remove();
      const controle:ControleCaptura={camera,
        fase:v=>mapa.dispatchEvent(new CustomEvent('solarcosta-captura-fase',{detail:v})),
        esperar:async()=>{
          const inicio=Date.now();
          do{
            signal.throwIfAborted();if(!mapa.isConnected)throw new Error('O mapa foi fechado.');
            await new Promise(r=>setTimeout(r,150));
            if(estabilidade.current.pronto&&Date.now()-estabilidade.current.em>=600&&Date.now()-inicio>=600)return;
          }while(Date.now()-inicio<30000);
          throw new Error('O mapa não estabilizou. Aguarde os detalhes carregarem e tente novamente.');
        },
        restaurar:()=>{
          mapa.dispatchEvent(new CustomEvent('solarcosta-captura-fase',{detail:'editor'}));
          mapa.defaultUIHidden=ui;delete mapa.dataset.capturando;
          if(marcador.current&&mapa.isConnected)mapa.append(marcador.current);
        }
      };
      resolve(controle);
    };
    area.addEventListener('solarcosta-preparar-captura',preparar);
    return()=>area.removeEventListener('solarcosta-preparar-captura',preparar);
  },[instancia,modo,carregando]);

  const mensagem = !chave ? 'Configure GOOGLE_MAPS_BROWSER_KEY no servidor para habilitar os mapas interativos.' : api.erro || erro;
  useEffect(()=>{if(mensagem)onIndisponivel?.(mensagem);},[mensagem,onIndisponivel]);
  return <section className="h-full min-h-0 flex flex-col rounded-lg overflow-hidden border bg-slate-100" aria-label={modo === '3d' ? 'Google Maps 3D' : 'Satélite interativo Google'}>
    <div ref={areaCaptura} className="relative flex-1 min-h-0" data-area-captura-mapa data-mapa-pronto={!carregando&&!mensagem?'true':'false'}>
      {!somenteLeitura&&<div data-captura-ocultar className="absolute bottom-8 left-2 right-14 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none">
        <button type="button" className="pointer-events-auto rounded-lg border bg-white/95 shadow px-3 py-2 text-xs font-semibold" onClick={() => recentralizar.current()}>Centralizar imóvel</button>
            {!somenteLeitura&&<button type="button" disabled={salvando||!instancia||!!mensagem||carregando} className="pointer-events-auto rounded-lg bg-sky-800 text-white shadow px-3 py-2 text-xs font-semibold disabled:opacity-40" onClick={()=>{const vista=instancia&&lerCameraGoogle(modo,instancia.mapa);if(vista)onSalvarVista(vista);}}>{salvando?'Salvando…':'Salvar vista e desenho'}</button>}
        {!somenteLeitura&&<details className="relative pointer-events-auto text-xs">
          <summary className="cursor-pointer list-none rounded-lg border bg-white/95 shadow px-3 py-2 font-semibold" aria-label="Mais ações do mapa">Mais ações ···</summary>
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border bg-white p-2 shadow-xl">
            <button type="button" disabled={!instancia||salvando} className="w-full rounded p-2 text-left hover:bg-slate-100 disabled:opacity-40" onClick={()=>{const v=instancia&&lerCameraGoogle(modo,instancia.mapa);if(v)onSelecionarLocal(v);}}>Definir imóvel neste centro</button>

          </div>
        </details>}
      </div>}
      <div ref={container} className="absolute inset-0" />
      {!somenteLeitura&&<div data-captura-ocultar className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 text-3xl" aria-hidden="true">+</div>}
      {mensagem ? <div role="alert" className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"><p>{mensagem}</p><button type="button" className="rounded border px-3 py-2" onClick={onVoltar}>Continuar no 2D</button>{!api.erro && chave && <button type="button" className="underline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button>}</div> : (api.carregando || carregando) && <div role="status" className="absolute bottom-20 left-3 rounded bg-white shadow px-3 py-2 text-sm pointer-events-none">Carregando mapa…</div>}
    </div>
  </section>;
}
