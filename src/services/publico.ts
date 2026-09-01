// Cliente das rotas abertas (/api/publico) usadas pelo site institucional.
//
// Diferença para services/api.ts: nada aqui manda Authorization nem dispara a
// renovação de sessão. O visitante do site não tem — e não precisa de — token.

import { http } from './http';

export interface EmpresaPublica {
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  responsavel_tecnico: string | null;
  crea: string | null;
}

export interface ConcessionariaPublica {
  nome: string;
  uf: string | null;
  tarifa_kwh: number | null;
  custo_disponibilidade: number | null;
  hsp_media: number | null;
}

export interface ConfigPublica {
  empresa: EmpresaPublica | null;
  concessionarias: ConcessionariaPublica[];
  /** Só o grupo `dimensionamento` de SolarCosta_Parametros. */
  parametros: Record<string, number>;
}

export interface LeadDoSite {
  nome: string;
  telefone: string;
  email?: string;
  cidade?: string;
  consumo_kwh?: number;
  mensagem?: string;
  /** Honeypot: fica escondido no formulário e sempre vai vazio. */
  website?: string;
}

export const Publico = {
  getConfig: () => http.getPublico<ConfigPublica>('/api/publico/config'),
  enviarLead: (dados: LeadDoSite) => http.postPublico<{ ok: true }>('/api/publico/leads', dados),
};

/** Lê um parâmetro de dimensionamento com fallback, como o `paramNum` do CRM. */
export function param(config: ConfigPublica | null, chave: string, padrao: number): number {
  const v = config?.parametros?.[chave];
  return typeof v === 'number' && Number.isFinite(v) ? v : padrao;
}

/* ------------------------------------------------------------ contato --- */

/** Dados de contato com fallback: o seed da empresa não preenche telefone. */
export const CONTATO_PADRAO = {
  telefone: '(31) 98658-8456',
  whatsapp: '5531986588456',
  email: 'solarcostamg@gmail.com',
  endereco: 'Rua Alzira Maria Ferreira, 241',
  bairro: 'Santa Mônica',
  cidade: 'Belo Horizonte',
  uf: 'MG',
  cep: '31.530-150',
} as const;

/** Só dígitos, com DDI 55 na frente — formato que o wa.me exige. */
export function numeroWhatsApp(empresa: EmpresaPublica | null): string {
  const bruto = empresa?.whatsapp || empresa?.telefone || '';
  const digitos = bruto.replace(/\D+/g, '');
  if (!digitos) return CONTATO_PADRAO.whatsapp;
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

export function linkWhatsApp(empresa: EmpresaPublica | null, mensagem: string): string {
  return `https://wa.me/${numeroWhatsApp(empresa)}?text=${encodeURIComponent(mensagem)}`;
}

/** "Rua X, 241 — Santa Mônica, Belo Horizonte/MG" */
export function enderecoCompleto(empresa: EmpresaPublica | null): string {
  const e = {
    endereco: empresa?.endereco || CONTATO_PADRAO.endereco,
    bairro: empresa?.bairro || CONTATO_PADRAO.bairro,
    cidade: empresa?.cidade || CONTATO_PADRAO.cidade,
    uf: empresa?.uf || CONTATO_PADRAO.uf,
  };
  return `${e.endereco} — ${e.bairro}, ${e.cidade}/${e.uf}`;
}
