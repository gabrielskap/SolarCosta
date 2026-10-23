import React, { useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from './useGoogleMaps';
import { useDesenhoGoogle, lerCameraGoogle, type EdicaoGoogle } from './useDesenhoGoogle';

export function GoogleVistaImovel({ chave, latitude, longitude, modo, onVoltar, edicao, onSalvarVista, onSelecionarLocal, salvando=false }: {
  chave?: string | null; latitude: number; longitude: number; modo: 'satelite' | '3d'; onVoltar: () => void;
  edicao: EdicaoGoogle; onSalvarVista: (vista: NonNullable<EdicaoGoogle['dados']['vistaGoogle']>) => void;
  salvando?: boolean;
  onSelecionarLocal: (vista: NonNullable<EdicaoGoogle['dados']['vistaGoogle']>) => void;
}) {
  const api = useGoogleMaps(chave, true);
  const container = useRef<HTMLDivElement>(null);
  const recentralizar = useRef<() => void>(() => {});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [instancia,setInstancia] = useState<{mapa:any;biblioteca?:any}|null>(null);
  const [altitudeManual,setAltitudeManual] = useState('');
  const edicaoAtual = useRef(edicao); edicaoAtual.current = edicao;
  useDesenhoGoogle(instancia, modo, edicao);

  useEffect(() => {
    if (!api.pronto || !chave || !container.current) return;
    let vivo = true;
    const host = container.current;
    const limpar: Array<() => void> = [];
    const maps = (window as any).google.maps;
    setErro(''); setAviso(''); setCarregando(true);
    const temporizador = window.setTimeout(() => {
      if (vivo) { setCarregando(false); setErro('O mapa demorou para carregar. Confira a conexão, a chave e as APIs habilitadas, ou volte ao levantamento 2D.'); }
    }, 30000);
    const pronto = () => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro(''); } };
    const iniciar = async () => {
      const centro = { lat: latitude, lng: longitude };
      const salva = edicaoAtual.current.dados.vistaGoogle;
      const vista = salva?.modo === modo ? salva : undefined;
      if (modo === 'satelite') {
        const mapa = new maps.Map(host, { center: vista ? {lat:vista.latitude,lng:vista.longitude} : centro, zoom: vista?.zoom ?? 20, mapTypeId: 'satellite', tilt: 0,
          streetViewControl: false, mapTypeControl: false, fullscreenControl: false, gestureHandling: 'greedy' });
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
      // Elevation é opcional: sem ela, começar com uma vista ampla e informar a limitação.
      let altitude: number | undefined = altitudeManual.trim() ? Number(altitudeManual) : vista?.altitude;
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
      if (altitude === undefined) {
        clearTimeout(temporizador); setCarregando(false);
        setErro('Não foi possível obter a altitude para centralizar o 3D com precisão. Habilite a Elevation API para a chave de navegador ou informe abaixo a altitude conhecida do terreno.');
        return;
      }
      const camera = { center: { lat:vista?.latitude??latitude,lng:vista?.longitude??longitude,altitude }, range: vista?.distanciaM ?? 180, tilt: vista?.inclinacao ?? 45, heading: vista?.azimute ?? 0 };
      const mapa = new Map3DElement({ ...camera, mode: 'SATELLITE' });
      mapa.style.width = '100%'; mapa.style.height = '100%';
      const falhou = () => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível iniciar o Google 3D. Verifique a chave, o suporte gráfico do navegador e tente novamente.'); } };
      const estavel = (e: Event & { isSteady?: boolean }) => { if (e.isSteady) pronto(); };
      mapa.addEventListener('gmp-error', falhou);
      mapa.addEventListener('gmp-steadychange', estavel);
      host.replaceChildren(mapa);
      mapa.append(new Marker3DElement({position:centro,altitudeMode:'CLAMP_TO_GROUND',label:'Imóvel',drawsWhenOccluded:true}));
      setInstancia({mapa,biblioteca});
      recentralizar.current = () => Object.assign(mapa, camera);
      limpar.push(() => { mapa.removeEventListener('gmp-error', falhou); mapa.removeEventListener('gmp-steadychange', estavel); mapa.remove(); });
    };
    iniciar().catch(() => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível abrir esta visualização Google. Confira as APIs habilitadas e volte ao 2D para continuar.'); } });
    return () => { vivo = false; clearTimeout(temporizador); setInstancia(null); limpar.forEach(fn => fn()); host.replaceChildren(); recentralizar.current = () => {}; };
  }, [api.pronto, chave, latitude, longitude, modo, tentativa, altitudeManual]);

  const mensagem = !chave ? 'Configure GOOGLE_MAPS_BROWSER_KEY no servidor para habilitar os mapas interativos.' : api.erro || erro;
  return <section className="h-full min-h-0 flex flex-col rounded-lg overflow-hidden border bg-slate-100" aria-label={modo === '3d' ? 'Google Maps 3D' : 'Satélite interativo Google'}>
    <div className="shrink-0 bg-white border-b p-2 text-xs flex flex-wrap items-center gap-2">
      <strong>{modo === '3d' ? 'Google Maps 3D' : 'Satélite interativo'}</strong>
      <button type="button" className="rounded border px-2 py-1" onClick={() => recentralizar.current()}>Voltar ao imóvel</button>
      <button type="button" className="rounded border px-2 py-1" onClick={onVoltar}>Voltar ao levantamento 2D</button>
      <button type="button" disabled={!instancia||salvando} className="rounded border px-2 py-1 disabled:opacity-40" onClick={()=>{const v=instancia&&lerCameraGoogle(modo,instancia.mapa);if(v)onSelecionarLocal(v);}}>Usar centro como endereço do 2D</button>
      <button type="button" disabled={salvando||!instancia||!!mensagem} className="rounded bg-sky-800 text-white px-2 py-1 disabled:opacity-40" onClick={()=>{const vista=instancia&&lerCameraGoogle(modo,instancia.mapa);if(vista)onSalvarVista(vista);}}>{salvando?'Salvando…':modo==='3d'?'Salvar vista 3D e desenho':'Salvar vista e desenho'}</button>
      <span className="text-slate-600">{modo === '3d' ? 'Desenho geográfico sobre o terreno, sem reconstrução da altura do telhado. Sombras aproximadas no plano.' : 'Desenhe com as ferramentas do levantamento. O zoom busca novos detalhes conforme cobertura.'}</span>
    </div>
    {aviso && <p className="shrink-0 bg-amber-50 text-amber-900 text-xs p-2">{aviso}</p>}
    {!edicao.dados.satelite&&<p className="shrink-0 bg-amber-50 p-2 text-xs">Carregue a imagem por satélite para fixar a escala e habilitar o desenho georreferenciado.</p>}
    {modo==='3d'&&<label className="shrink-0 p-2 text-xs bg-white">Altitude conhecida do terreno (m, opcional)<input className="ml-2 border rounded w-24" type="number" min={-500} max={9000} defaultValue="" onBlur={e=>{const n=e.target.valueAsNumber;if(!e.target.value||Number.isFinite(n)&&n>=-500&&n<=9000)setAltitudeManual(e.target.value);}}/></label>}
    <div className="relative flex-1 min-h-0">
      <div ref={container} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 text-3xl" aria-hidden="true">+</div>
      {mensagem ? <div role="alert" className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"><p>{mensagem}</p><button type="button" className="rounded border px-3 py-2" onClick={onVoltar}>Continuar no 2D</button>{!api.erro && chave && <button type="button" className="underline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button>}</div> : (api.carregando || carregando) && <div role="status" className="absolute top-3 left-3 rounded bg-white shadow px-3 py-2 text-sm pointer-events-none">Carregando mapa…</div>}
    </div>
  </section>;
}
