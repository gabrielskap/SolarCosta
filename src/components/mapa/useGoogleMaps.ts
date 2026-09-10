// Carregador da Maps JavaScript API.
//
// O script entra UMA vez por aba e só quando o editor de telhado abre pela
// primeira vez — nunca no boot do app. Dois motivos: Dynamic Maps é cobrado
// por carregamento de mapa, e não faz sentido pagar (nem baixar ~300 KB) por
// quem só vai emitir uma proposta sem olhar o telhado.
//
// A chave vem do /api/config, não de VITE_*. O Dockerfile roda `npm run build`
// sem nenhum ARG, então uma variável de build sairia `undefined` em produção e
// o mapa só quebraria depois do deploy. Vindo pela API, a chave também pode
// ser trocada sem rebuild.

import { useEffect, useState } from 'react';

/** Promise compartilhada: dois editores abrindo juntos carregam um script só. */
let carregamento: Promise<void> | null = null;

/** Chave usada na carga que já aconteceu — trocar de chave exige recarregar a aba. */
let chaveCarregada: string | null = null;

const ID_SCRIPT = 'google-maps-js';

/**
 * Injeta o <script> e resolve quando `google.maps` existir.
 *
 * Usa createElement em vez do snippet inline que a documentação do Google
 * sugere, e isso é de propósito: um <script src> passa na CSP com o host
 * liberado, enquanto o bootstrap inline exigiria 'unsafe-inline' em
 * script-src, afrouxando a política do painel inteiro (ver server/src/app.ts).
 */
function carregar(chave: string): Promise<void> {
  if (carregamento && chaveCarregada === chave) return carregamento;

  chaveCarregada = chave;
  carregamento = new Promise<void>((resolver, rejeitar) => {
    if (typeof window === 'undefined') {
      rejeitar(new Error('Sem window.'));
      return;
    }

    // Já carregado (outra montagem, ou HMR trocou o módulo mas não a página).
    if ((window as any).google?.maps) {
      resolver();
      return;
    }

    const existente = document.getElementById(ID_SCRIPT) as HTMLScriptElement | null;
    const script = existente ?? document.createElement('script');

    script.addEventListener('load', () => {
      if ((window as any).google?.maps) resolver();
      // Carregou mas não expôs a API: chave inválida, faturamento desligado ou
      // API não habilitada no projeto. O Google devolve 200 nesses casos e
      // reclama no console, então sem esta checagem a promise nunca resolveria.
      else rejeitar(new Error('O Google Maps carregou sem expor a API.'));
    });
    script.addEventListener('error', () =>
      rejeitar(new Error('Não foi possível carregar o Google Maps.')),
    );

    if (!existente) {
      script.id = ID_SCRIPT;
      script.async = true;
      script.defer = true;
      script.src =
        'https://maps.googleapis.com/maps/api/js' +
        `?key=${encodeURIComponent(chave)}` +
        '&libraries=geometry' +
        '&language=pt-BR&region=BR' +
        '&loading=async';
      document.head.appendChild(script);
    }
  });

  // Falha não fica grudada: uma queda de rede não pode condenar a aba a nunca
  // mais abrir o editor.
  carregamento.catch(() => {
    carregamento = null;
    chaveCarregada = null;
  });

  return carregamento;
}

export interface EstadoGoogleMaps {
  pronto: boolean;
  carregando: boolean;
  erro: string | null;
}

/**
 * Carrega a Maps JS API quando `ativo` fica verdadeiro.
 *
 * `chave` nula (não configurada na instalação) não é erro: é o recurso
 * desligado, e quem chama esconde o botão de expandir. É o mesmo desenho do
 * `google_maps_ativo` que já governa a busca por satélite.
 */
export function useGoogleMaps(chave: string | null | undefined, ativo: boolean): EstadoGoogleMaps {
  const [estado, setEstado] = useState<EstadoGoogleMaps>({
    pronto: false,
    carregando: false,
    erro: null,
  });

  useEffect(() => {
    if (!ativo || !chave) return;
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      setEstado({ pronto: true, carregando: false, erro: null });
      return;
    }

    let vivo = true;
    setEstado({ pronto: false, carregando: true, erro: null });

    carregar(chave).then(
      () => vivo && setEstado({ pronto: true, carregando: false, erro: null }),
      (e: Error) =>
        vivo && setEstado({ pronto: false, carregando: false, erro: e.message }),
    );

    return () => {
      vivo = false;
    };
  }, [chave, ativo]);

  return estado;
}
