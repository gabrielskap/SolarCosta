/** Cache temporário e compartilhamento de consultas simultâneas bem-sucedidas. */
export class CacheConsulta {
  private valores = new Map<string, { em: number; valor: unknown }>();
  private pendentes = new Map<string, Promise<unknown>>();

  constructor(private ttlMs: number, private limite = 500) {}

  async consultar<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    const hit = this.valores.get(chave);
    if (hit && Date.now() - hit.em < this.ttlMs) return hit.valor as T;
    this.valores.delete(chave);

    const pendente = this.pendentes.get(chave);
    if (pendente) return pendente as Promise<T>;

    const consulta = Promise.resolve().then(buscar).then((valor) => {
      if (this.valores.size >= this.limite) {
        const primeira = this.valores.keys().next().value;
        if (primeira !== undefined) this.valores.delete(primeira);
      }
      this.valores.set(chave, { em: Date.now(), valor });
      return valor;
    });
    this.pendentes.set(chave, consulta);
    try {
      return await consulta;
    } finally {
      this.pendentes.delete(chave);
    }
  }
}

/** Preserva números e pontuação para não confundir imóveis distintos. */
export function normalizarEndereco(endereco: string): string {
  return endereco.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
}
