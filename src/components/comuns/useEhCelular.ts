import { useEffect, useState } from 'react';

/**
 * Ponto de corte de celular — o mesmo `md` (768px) que o Tailwind usa no resto
 * do sistema. Mantido em um lugar só para não haver componente decidindo em
 * 640px enquanto o CSS decide em 768px.
 */
export const CONSULTA_CELULAR = '(max-width: 767px)';

/**
 * Leitura imediata, fora do ciclo do React.
 *
 * Serve para inicializar estado (`useState(() => ehCelular() ? ... : ...)`)
 * quando a decisão é do primeiro render e NÃO deve mudar sozinha depois — caso
 * da visão padrão da agenda: se o usuário escolher a grade do mês no celular,
 * girar o aparelho não pode desfazer a escolha dele.
 */
export function ehCelular(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(CONSULTA_CELULAR).matches
    : false;
}

/**
 * Versão reativa: re-renderiza quando a largura cruza o ponto de corte.
 *
 * Para quando o componente precisa renderizar ESTRUTURAS diferentes (tabela vs.
 * cartões), e não apenas classes — nesses casos o certo continua sendo CSS.
 *
 * O valor inicial é síncrono para o primeiro render já sair no formato certo;
 * sem isso aparece a estrutura de desktop por um quadro.
 */
export function useEhCelular(): boolean {
  const [celular, setCelular] = useState(ehCelular);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(CONSULTA_CELULAR);
    const aoMudar = (e: MediaQueryListEvent) => setCelular(e.matches);
    mq.addEventListener('change', aoMudar);
    // Reavalia na montagem: a largura pode ter mudado entre o primeiro render
    // e o efeito (rotação de tela).
    setCelular(mq.matches);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  return celular;
}
