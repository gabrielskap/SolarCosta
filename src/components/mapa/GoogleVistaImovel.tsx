import React, { useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from './useGoogleMaps';

export function GoogleVistaImovel({ chave, latitude, longitude, modo, onVoltar }: {
  chave?: string | null; latitude: number; longitude: number; modo: 'satelite' | '3d'; onVoltar: () => void;
}) {
  const api = useGoogleMaps(chave, true);
  const container = useRef<HTMLDivElement>(null);
  const recentralizar = useRef<() => void>(() => {});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [tentativa, setTentativa] = useState(0);

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
      if (modo === 'satelite') {
        const mapa = new maps.Map(host, { center: centro, zoom: 20, mapTypeId: 'satellite', tilt: 0,
          streetViewControl: false, mapTypeControl: false, fullscreenControl: false, gestureHandling: 'greedy' });
        const listener = maps.event.addListenerOnce(mapa, 'tilesloaded', pronto);
        recentralizar.current = () => { mapa.setCenter(centro); mapa.setZoom(20); };
        limpar.push(() => { listener.remove(); maps.event.clearInstanceListeners(mapa); });
        return;
      }
      const { Map3DElement } = await maps.importLibrary('maps3d');
      if (!vivo) return;
      // Altitude geográfica evita apontar a câmera para baixo do terreno em cidades altas.
      // Elevation é opcional: sem ela, começar com uma vista ampla e informar a limitação.
      let altitude: number | undefined;
      try {
        const consulta = maps.importLibrary('elevation').then(({ ElevationService }: any) =>
          new ElevationService().getElevationForLocations({ locations: [centro] }));
        let timer: ReturnType<typeof setTimeout>;
        try {
          const r = await Promise.race([consulta, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 5000); })]);
          if (Number.isFinite(r.results?.[0]?.elevation)) altitude = r.results[0].elevation;
        } finally { clearTimeout(timer!); }
      } catch { /* A visualização continua disponível sem Elevation API. */ }
      if (!vivo) return;
      const camera = { center: { ...centro, altitude: altitude ?? 0 }, range: altitude === undefined ? 4000 : 300, tilt: 55, heading: 0 };
      if (altitude === undefined) setAviso('Altitude do terreno indisponível. Vista inicial ampla; navegue até o imóvel. A Elevation API permite centralização mais precisa.');
      const mapa = new Map3DElement({ ...camera, mode: 'SATELLITE' });
      mapa.style.width = '100%'; mapa.style.height = '100%';
      const falhou = () => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível iniciar o Google 3D. Verifique a chave, o suporte gráfico do navegador e tente novamente.'); } };
      const estavel = (e: Event & { isSteady?: boolean }) => { if (e.isSteady) pronto(); };
      mapa.addEventListener('gmp-error', falhou);
      mapa.addEventListener('gmp-steadychange', estavel);
      host.replaceChildren(mapa);
      recentralizar.current = () => Object.assign(mapa, camera);
      limpar.push(() => { mapa.removeEventListener('gmp-error', falhou); mapa.removeEventListener('gmp-steadychange', estavel); mapa.remove(); });
    };
    iniciar().catch(() => { if (vivo) { clearTimeout(temporizador); setCarregando(false); setErro('Não foi possível abrir esta visualização Google. Confira as APIs habilitadas e volte ao 2D para continuar.'); } });
    return () => { vivo = false; clearTimeout(temporizador); limpar.forEach(fn => fn()); host.replaceChildren(); recentralizar.current = () => {}; };
  }, [api.pronto, chave, latitude, longitude, modo, tentativa]);

  const mensagem = !chave ? 'Configure GOOGLE_MAPS_BROWSER_KEY no servidor para habilitar os mapas interativos.' : api.erro || erro;
  return <section className="h-full min-h-0 flex flex-col rounded-lg overflow-hidden border bg-slate-100" aria-label={modo === '3d' ? 'Google Maps 3D' : 'Satélite interativo Google'}>
    <div className="shrink-0 bg-white border-b p-2 text-xs flex flex-wrap items-center gap-2">
      <strong>{modo === '3d' ? 'Google Maps 3D' : 'Satélite interativo'}</strong>
      <button type="button" className="rounded border px-2 py-1" onClick={() => recentralizar.current()}>Voltar ao imóvel</button>
      <button type="button" className="rounded border px-2 py-1" onClick={onVoltar}>Voltar ao levantamento 2D</button>
      <span className="text-slate-600">{modo === '3d' ? 'Imóvel e entorno conforme cobertura Google. O desenho do projeto permanece no 2D.' : 'O zoom carrega novas imagens conforme disponibilidade. Medição e placas ficam no levantamento 2D.'}</span>
    </div>
    {aviso && <p className="shrink-0 bg-amber-50 text-amber-900 text-xs p-2">{aviso}</p>}
    <div className="relative flex-1 min-h-0">
      <div ref={container} className="absolute inset-0" />
      {mensagem ? <div role="alert" className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"><p>{mensagem}</p><button type="button" className="rounded border px-3 py-2" onClick={onVoltar}>Continuar no 2D</button>{!api.erro && chave && <button type="button" className="underline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button>}</div> : (api.carregando || carregando) && <div role="status" className="absolute top-3 left-3 rounded bg-white shadow px-3 py-2 text-sm pointer-events-none">Carregando mapa…</div>}
    </div>
  </section>;
}
