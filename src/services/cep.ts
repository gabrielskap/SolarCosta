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

/**
 * Monta a linha que vai para o GEOCODING — diferente da que aparece na tela.
 *
 * A da tela separa logradouro e bairro com "–", que é apresentação; o Google
 * resolve melhor com vírgulas e com o CEP no fim, que desempata ruas homônimas
 * em cidades diferentes.
 *
 * Ex.: "Rua dos Ipês, 512, Santa Mônica, Uberlândia, MG, 38408-100"
 *
 * O número é o que decide entre um ponto sobre o telhado (ROOFTOP) e um chute
 * interpolado ao longo da via — por isso ele entra aqui mesmo quando o
 * consultor já editou a linha de endereço à mão.
 */
export function buildEnderecoBusca(e: EnderecoViaCEP, numero?: string): string {
  const numeroLimpo = numero?.trim();
  const logradouro = numeroLimpo && e.logradouro ? `${e.logradouro}, ${numeroLimpo}` : e.logradouro;
  return [logradouro, e.bairro, e.localidade, e.uf, e.cep].filter(Boolean).join(', ');
}
