// Configuração pública compartilhada pelas páginas do site.
//
// Uma única chamada a /api/publico/config alimenta rodapé, página "A empresa"
// e simulador. Se a API estiver fora, o site continua de pé com os dados de
// CONTATO_PADRAO — um site institucional não pode ficar em branco porque o
// banco caiu.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Publico, type ConfigPublica } from '../services/publico';

interface Estado {
  config: ConfigPublica | null;
  carregando: boolean;
}

const ContextoConfig = createContext<Estado>({ config: null, carregando: true });

export const ProvedorConfigPublica: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<Estado>({ config: null, carregando: true });

  useEffect(() => {
    let ativo = true;
    Publico.getConfig()
      .then((config) => {
        if (ativo) setEstado({ config, carregando: false });
      })
      .catch(() => {
        // Silêncio proposital: o site tem fallback para tudo que vem daqui.
        if (ativo) setEstado({ config: null, carregando: false });
      });
    return () => {
      ativo = false;
    };
  }, []);

  return <ContextoConfig.Provider value={estado}>{children}</ContextoConfig.Provider>;
};

export function useConfigPublica(): Estado {
  return useContext(ContextoConfig);
}
