import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function CampoSenha({ className = '', ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visivel, setVisivel] = useState(false);
  return <div className="relative">
    <input {...props} type={visivel ? 'text' : 'password'} className={`${className} pr-12`} />
    <button
      type="button"
      aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={visivel}
      onClick={() => setVisivel(v => !v)}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {visivel ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>;
}
