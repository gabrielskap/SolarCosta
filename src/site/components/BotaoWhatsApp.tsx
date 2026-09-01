// Atalho flutuante para o WhatsApp — o canal que o cliente de fato usa.
// Só aparece depois de uma rolagem, para não cobrir a chamada principal
// da primeira dobra.

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useConfigPublica } from '../contexto';
import { linkWhatsApp } from '../../services/publico';

export const BotaoWhatsApp: React.FC = () => {
  const { config } = useConfigPublica();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > 400);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  if (!visivel) return null;

  return (
    <a
      href={linkWhatsApp(
        config?.empresa ?? null,
        'Olá! Vim pelo site da Solar Costa e quero saber mais sobre energia solar.',
      )}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm pl-4 pr-5 py-3.5 rounded-full shadow-xl transition-all"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
};
