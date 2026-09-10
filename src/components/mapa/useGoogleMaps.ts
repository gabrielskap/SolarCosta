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

/** Nome da função global que o Google chama quando a API termina de subir. */
const CALLBACK = '__solarCostaMapsPronto';

/** Desiste depois disso, em vez de deixar o editor num spinner eterno. */
const LIMITE_MS = 20000;

/** A API está carregada de verdade — a CLASSE existe, não só o namespace. */
function pronta(): boolean {
  return typeof (window as any).google?.maps?.Map === 'function';
}

/**
 * Injeta o <script> e resolve quando as classes do Maps existirem.
 *
 * Duas decisões que já custaram bug aqui:
 *
 * 1. `callback=` é OBRIGATÓRIO junto de `loading=async`. Sem ele o bootstrap
 *    assíncrono não popula `google.maps`, e o evento `load` do <script> dispara
 *    antes de existir qualquer coisa — dava "google.maps.Map is not a
 *    constructor" e, na tentativa seguinte, "carregou sem expor a API". O
 *    `load` diz que o ARQUIVO chegou; só o callback diz que a API subiu.
 *
 * 2. O <script> é criado por createElement, e não pelo snippet inline que a
 *    documentação sugere: um `<script src>` passa na CSP com o host liberado,
 *    enquanto o bootstrap inline exigiria 'unsafe-inline' em script-src,
 *    afrouxando a política do painel inteiro (ver server/src/app.ts).
 */
function carregar(chave: string): Promise<void> {
  if (carregamento && chaveCarregada === chave) return carregamento;

  chaveCarregada = chave;
  carregamento = new Promise<void>((resolver, rejeitar) => {
    if (typeof window === 'undefined') {
      rejeitar(new Error('Sem window.'));
      return;
    }

    // Já pronto (outra montagem, ou HMR trocou o módulo mas não a página).
    if (pronta()) {
      resolver();
      return;
    }

    let encerrado = false;
    const encerrar = (fn: () => void) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(temporizador);
      fn();
    };

    const temporizador = setTimeout(
      () => encerrar(() => rejeitar(new Error('O Google Maps demorou demais para responder.'))),
      LIMITE_MS,
    );

    // O Google chama isto quando a API terminou de subir. É o único sinal
    // confiável de que as classes existem.
    (window as any)[CALLBACK] = () => {
      encerrar(() => {
        if (pronta()) resolver();
        else rejeitar(new Error('O Google Maps respondeu sem expor o mapa.'));
      });
    };

    const existente = document.getElementById(ID_SCRIPT) as HTMLScriptElement | null;
    if (existente) {
      // Já está no DOM (HMR, ou uma carga anterior que falhou depois do
      // append). Não dá para re-disparar o callback: resta esperar o callback
      // em voo ou o temporizador.
      return;
    }

    const script = document.createElement('script');
    script.id = ID_SCRIPT;
    script.async = true;
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(chave)}` +
      `&callback=${CALLBACK}` +
      '&loading=async' +
      // Sem `libraries=`: o editor faz a própria geometria
      // (utils/layoutModulos) e não usa google.maps.geometry.
      '&language=pt-BR&region=BR';

    // Falha de REDE. Chave inválida, faturamento desligado ou API não
    // habilitada NÃO caem aqui: o Google devolve 200, reclama no console e
    // nunca chama o callback — quem pega esses casos é o temporizador.
    script.addEventListener('error', () =>
      encerrar(() => {
        script.remove();
        rejeitar(new Error('Não foi possível baixar o Google Maps.'));
      }),
    );

    document.head.appendChild(script);
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
    if (pronta()) {
      setEstado({ pronto: true, carregando: false, erro: null });
      return;
    }

    let vivo = true;
    setEstado({ pronto: false, carregando: true, erro: null });

    carregar(chave).then(
      () => vivo && setEstado({ pronto: true, carregando: false, erro: null }),
      (e: Error) => vivo && setEstado({ pronto: false, carregando: false, erro: e.message }),
    );

    return () => {
      vivo = false;
    };
  }, [chave, ativo]);

  return estado;
}
