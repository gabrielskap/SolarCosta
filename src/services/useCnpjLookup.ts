import { useEffect, useState } from 'react';

export interface DadosCnpj {
  razao_social?: string; nome_fantasia?: string; municipio?: string; uf?: string;
  ddd_telefone_1?: string; email?: string; cep?: string; logradouro?: string;
  numero?: string; bairro?: string; complemento?: string;
}

export function useCnpjLookup(documento: string, enabled: boolean, preencher: (dados: DadosCnpj) => void) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    const cnpj = documento.replace(/\D/g, '');
    setErro('');
    setLoading(false);
    if (!enabled || cnpj.length !== 14) return;
    const controller = new AbortController();
    let ativo = true;
    let timeout: ReturnType<typeof setTimeout>;
    const timer = setTimeout(async () => {
      setLoading(true);
      timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? 'CNPJ não encontrado.' : 'Consulta indisponível.');
        const dados: DadosCnpj = await response.json();
        if (ativo) preencher(dados);
      } catch (error) {
        if (ativo) setErro((error instanceof Error && error.name !== 'AbortError' ? error.message : 'A consulta demorou demais.') + ' Preencha os dados manualmente.');
      } finally {
        clearTimeout(timeout);
        if (ativo) setLoading(false);
      }
    }, 400);
    return () => { ativo = false; controller.abort(); clearTimeout(timer); clearTimeout(timeout); };
    // O preenchimento usa apenas setters de estado; a consulta depende do documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento, enabled]);
  return { loading, erro };
}
