// Trilha de auditoria: registra "quem alterou o quê e quando".
// Diferente do `historico` (que existe por lead), esta trilha é global e cobre
// todas as entidades do sistema (leads, propostas, contratos, boletos,
// lançamentos, usuários, fornecedores, produtos, agendamentos e sessão).

import { AuditEntry, AuditAction, AuditEntity } from '../types';

const AUDIT_KEY = 'solar_costa_audit_v1';
const MAX_ENTRIES = 500;

// Alguns registros iniciais coerentes com os dados semeados, para que a tela de
// auditoria não comece vazia numa base nova.
const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: 'aud-seed-1',
    timestamp: '2026-07-30T18:12:00',
    usuario: 'Rafael Moura',
    acao: 'editar',
    entidade: 'Proposta',
    entidadeId: 'prop-184',
    alvo: 'Proposta 2026-0184 — Cristiano Duarte Almeida',
    detalhes: 'Status alterado para "enviada".',
  },
  {
    id: 'aud-seed-2',
    timestamp: '2026-07-30T09:40:00',
    usuario: 'Carlos Eduardo Costa',
    acao: 'criar',
    entidade: 'Contrato',
    entidadeId: 'cont-0184',
    alvo: 'Contrato 2026-0184 — Cristiano Duarte Almeida',
  },
  {
    id: 'aud-seed-3',
    timestamp: '2026-07-26T14:05:00',
    usuario: 'Ana Beatriz Santos',
    acao: 'baixa',
    entidade: 'Boleto',
    entidadeId: 'bol-4',
    alvo: 'Boleto 3/4 — Marcelo Ribeiro',
    detalhes: 'Baixa registrada (R$ 7.980,00).',
  },
  {
    id: 'aud-seed-4',
    timestamp: '2026-07-21T11:20:00',
    usuario: 'Thiago Gonçalves Leal',
    acao: 'mudanca_etapa',
    entidade: 'Lead',
    entidadeId: 'l13',
    alvo: 'Supermercado Costa Verde',
    detalhes: 'Negociação → Fechado.',
  },
];

function read(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(INITIAL_AUDIT));
      return INITIAL_AUDIT;
    }
    return JSON.parse(raw) as AuditEntry[];
  } catch (e) {
    console.error('Erro ao ler a trilha de auditoria', e);
    return INITIAL_AUDIT;
  }
}

function write(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (e) {
    console.error('Erro ao gravar a trilha de auditoria', e);
  }
}

export interface AuditInput {
  usuario: string;
  usuarioId?: string;
  acao: AuditAction;
  entidade: AuditEntity;
  entidadeId?: string;
  alvo: string;
  detalhes?: string;
}

export const AuditService = {
  /** Todos os registros, do mais recente para o mais antigo. */
  getAll(): AuditEntry[] {
    return read().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  /** Registra uma nova ação e devolve a lista atualizada (ordenada). */
  log(input: AuditInput): AuditEntry[] {
    const entry: AuditEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...input,
    };
    const updated = [entry, ...read()];
    write(updated);
    return updated.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  clear(): AuditEntry[] {
    write([]);
    return [];
  },
};
