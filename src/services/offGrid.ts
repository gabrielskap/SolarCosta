import { http } from './http';
import type { CargaOffGrid, ConfigOffGrid } from '../utils/offGrid';
export interface DadosOffGrid {
  titulo: string; leadId: string | null;
  cliente: { nome: string; empresa: string; cnpj: string; telefone: string; email: string };
  equipamentos: CargaOffGrid[]; config: ConfigOffGrid;
}
export interface ResumoOffGrid { id: string; titulo: string; leadId: string | null; atualizadoEm: string }
export interface SimulacaoOffGrid extends ResumoOffGrid { dados: DadosOffGrid }
export const listarSimulacoesOffGrid = async () => (await http.get<{ simulacoes: ResumoOffGrid[] }>('/api/off-grid')).simulacoes;
export const abrirSimulacaoOffGrid = async (id: string) => (await http.get<{ simulacao: SimulacaoOffGrid }>(`/api/off-grid/${id}`)).simulacao;
export const salvarSimulacaoOffGrid = async (dados: DadosOffGrid, id?: string) => (await (id
  ? http.put<{ simulacao: SimulacaoOffGrid }>(`/api/off-grid/${id}`, dados)
  : http.post<{ simulacao: SimulacaoOffGrid }>('/api/off-grid', dados))).simulacao;
