import { http } from './http';
export interface PlacaSolar {
 id: string; produtoId: string | null; disponivel?: boolean; produtoNome?: string; produtoCodigo?: string; fabricante: string; modelo: string; potenciaWp: number; larguraM: number; alturaM: number; pesoKg: number; observacoes: string; ativo: boolean;
}
export async function listarPlacas() { return (await http.get<{placas: PlacaSolar[]}>('/api/placas')).placas; }
export async function salvarPlaca(placa: Omit<PlacaSolar, 'id'>, id?: string) {
 return id ? http.put(`/api/placas/${id}`, placa) : http.post('/api/placas', placa);
}
