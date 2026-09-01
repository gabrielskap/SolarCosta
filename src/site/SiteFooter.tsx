// Rodapé do site.
//
// Os dados institucionais (CNPJ, endereço, responsável técnico, CREA) saem de
// SolarCosta_Empresa via /api/publico/config. Editar em Configurações do CRM
// muda o rodapé — nada aqui é texto chumbado que envelhece sozinho.

import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ShieldCheck, ExternalLink } from 'lucide-react';
import logoFull from '../assets/logo-full.png';
import { useConfigPublica } from './contexto';
import { CONTATO_PADRAO, enderecoCompleto, linkWhatsApp } from '../services/publico';

export const SiteFooter: React.FC = () => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const telefone = empresa?.telefone || CONTATO_PADRAO.telefone;
  const email = empresa?.email || CONTATO_PADRAO.email;
  const cep = empresa?.cep || CONTATO_PADRAO.cep;
  const endereco = enderecoCompleto(empresa);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${endereco} ${cep}`)}`;

  return (
    <footer className="bg-marca-profundo text-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <img src={logoFull} alt="Solar Costa Energia Solar" className="h-16 w-auto" />
          <p className="text-sm leading-relaxed text-blue-200/90">
            Projeto, instalação e homologação de sistemas fotovoltaicos em Belo Horizonte e região
            metropolitana. Da visita técnica ao monitoramento da geração.
          </p>
          <div className="w-12 h-1 bg-emerald-500 rounded-full" />
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-blue-300 tracking-wider uppercase mb-3">
            Navegação
          </h3>
          <ul className="space-y-2 text-sm">
            {[
              { para: '/', rotulo: 'Início' },
              { para: '/servicos', rotulo: 'Serviços' },
              { para: '/simulador', rotulo: 'Simulador de economia' },
              { para: '/sobre', rotulo: 'A empresa' },
              { para: '/contato', rotulo: 'Fale com um consultor' },
            ].map((l) => (
              <li key={l.para}>
                <Link to={l.para} className="hover:text-solar transition">
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-blue-300 tracking-wider uppercase mb-3">
            Serviços
          </h3>
          <ul className="space-y-2 text-sm text-blue-200/90">
            <li>Energia solar residencial</li>
            <li>Energia solar comercial e rural</li>
            <li>Projeto e homologação na concessionária</li>
            <li>Manutenção e monitoramento</li>
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-blue-300 tracking-wider uppercase mb-3">
            Contato
          </h3>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href={mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:text-solar transition"
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-solar" />
                <span>
                  {endereco}
                  <br />
                  CEP {cep}
                  <ExternalLink className="w-3 h-3 inline ml-1 opacity-60" />
                </span>
              </a>
            </li>
            <li>
              <a
                href={`tel:${telefone.replace(/\D+/g, '')}`}
                className="flex items-center gap-2 hover:text-solar transition"
              >
                <Phone className="w-4 h-4 shrink-0 text-solar" />
                {telefone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 hover:text-solar transition break-all"
              >
                <Mail className="w-4 h-4 shrink-0 text-solar" />
                {email}
              </a>
            </li>
          </ul>

          <a
            href={linkWhatsApp(empresa, 'Olá! Vim pelo site e gostaria de falar sobre energia solar.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>

      {/* Credenciais: é o que dá lastro técnico ao site, então fica visível. */}
      <div className="border-t border-blue-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[11px] font-mono text-blue-300/80">
          <p>
            {empresa?.razao_social || 'Solar Costa Energia Solar LTDA'}
            {empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ''}
          </p>
          {(empresa?.responsavel_tecnico || empresa?.crea) && (
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Responsável técnico: {empresa?.responsavel_tecnico}
              {empresa?.crea ? ` · CREA ${empresa.crea}` : ''}
            </p>
          )}
          <p>© {new Date().getFullYear()} Solar Costa. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
