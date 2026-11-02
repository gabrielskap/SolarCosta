import { http } from './http';

export interface Aparelho { id: string; ambiente: string; nome: string; potenciaW: number }
export const listarAparelhos = async () => (await http.get<{ aparelhos: Aparelho[] }>('/api/aparelhos')).aparelhos;
export const salvarAparelho = (dados: Omit<Aparelho, 'id'>, id?: string) => id
  ? http.put(`/api/aparelhos/${id}`, dados)
  : http.post('/api/aparelhos', dados);
export const excluirAparelho = (id: string) => http.delete(`/api/aparelhos/${id}`);
