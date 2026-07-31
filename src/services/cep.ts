// Camada de integração: consulta de CEP -> endereço via ViaCEP.
// Substitui o "gancho" antes simulado por toast por uma consulta real.
// Documentação: https://viacep.com.br/

import { onlyDigits } from '../utils/format';

export interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // cidade
  uf: string;
  ddd?: string;
  erro?: boolean;
}

export interface CepLookupResult {
  ok: boolean;
  /** Presente quando ok = true. */
  endereco?: EnderecoViaCEP;
  /** Mensagem amigável quando ok = false. */
  erro?: string;
}

/**
 * Consulta um CEP na ViaCEP. Nunca lança: sempre resolve com um
 * { ok, endereco?, erro? } para simplificar o tratamento na UI.
 */
export async function fetchAddressByCep(cepRaw: string): Promise<CepLookupResult> {
  const cep = onlyDigits(cepRaw);
  if (cep.length !== 8) {
    return { ok: false, erro: 'CEP deve conter 8 dígitos.' };
  }

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!resp.ok) {
      return { ok: false, erro: `Falha na consulta (HTTP ${resp.status}).` };
    }
    const data = (await resp.json()) as EnderecoViaCEP;
    if (data.erro) {
      return { ok: false, erro: 'CEP não encontrado.' };
    }
    return { ok: true, endereco: data };
  } catch (e) {
    return { ok: false, erro: 'Não foi possível consultar o CEP (sem conexão?).' };
  }
}

/**
 * Monta uma linha de endereço a partir do retorno da ViaCEP.
 * Ex.: "Rua dos Ipês, 512 – Santa Mônica" (o número é opcional).
 */
export function buildEnderecoLine(e: EnderecoViaCEP, numero?: string): string {
  const partes: string[] = [];
  if (e.logradouro) partes.push(numero ? `${e.logradouro}, ${numero}` : e.logradouro);
  if (e.bairro) partes.push(e.bairro);
  return partes.join(' – ');
}

/** "Cidade/UF" a partir do retorno da ViaCEP. */
export function buildCidadeUf(e: EnderecoViaCEP): string {
  if (e.localidade && e.uf) return `${e.localidade}/${e.uf}`;
  return e.localidade || '';
}
