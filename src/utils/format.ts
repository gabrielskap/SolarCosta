// Máscaras, formatação e validação para formulários
// (CPF/CNPJ, telefone, CEP, e-mail e moeda em BRL).
//
// As funções de máscara são "à prova de digitação": recebem o valor atual do
// input (com ou sem máscara) e retornam sempre a versão formatada, podendo ser
// usadas diretamente em onChange.

/** Remove tudo que não for dígito. */
export const onlyDigits = (v: string | number | undefined | null): string =>
  String(v ?? '').replace(/\D+/g, '');

/* ============================== MÁSCARAS ============================== */

/** 000.000.000-00 */
export function maskCPF(value: string): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** 00.000.000/0000-00 */
export function maskCNPJ(value: string): string {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** Escolhe CPF ou CNPJ conforme a quantidade de dígitos (até 11 = CPF). */
export function maskCPFCNPJ(value: string): string {
  return onlyDigits(value).length <= 11 ? maskCPF(value) : maskCNPJ(value);
}

/** (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular). */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

/** 00000-000 */
export function maskCEP(value: string): string {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

/**
 * Máscara de moeda a partir de digitação livre. Os dígitos são interpretados
 * como centavos, então "12345" vira "1.234,56". Retorna string sem o "R$ ".
 */
export function maskCurrency(value: string): string {
  const d = onlyDigits(value);
  if (!d) return '';
  return (Number(d) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ============================ FORMATAÇÃO ============================ */

/** 1234.56 -> "R$ 1.234,56" */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

/** "R$ 1.234,56" | "1.234,56" -> 1234.56 */
export function parseCurrencyBRL(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = (value || '')
    .replace(/[^\d,-]/g, '') // mantém dígitos, vírgula e sinal
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/* ============================ VALIDAÇÃO ============================ */

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(cnpj[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calcDigit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(cnpj[12], 10)) return false;
  const d2 = calcDigit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === parseInt(cnpj[13], 10);
}

/** Valida CPF (11 díg.) ou CNPJ (14 díg.) conforme o comprimento. */
export function isValidCPFCNPJ(value: string): boolean {
  const len = onlyDigits(value).length;
  if (len === 11) return isValidCPF(value);
  if (len === 14) return isValidCNPJ(value);
  return false;
}

export function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Telefone brasileiro: 10 (fixo) ou 11 (celular) dígitos. */
export function isValidPhoneBR(value: string): boolean {
  const len = onlyDigits(value).length;
  return len === 10 || len === 11;
}

export function isValidCEP(value: string): boolean {
  return onlyDigits(value).length === 8;
}

/**
 * Rótulo do tipo do documento conforme o número de dígitos.
 * Útil para exibir "CPF"/"CNPJ" dinamicamente ao lado do campo.
 */
export function docLabel(value: string): 'CPF' | 'CNPJ' | 'CPF / CNPJ' {
  const len = onlyDigits(value).length;
  if (len === 0) return 'CPF / CNPJ';
  return len <= 11 ? 'CPF' : 'CNPJ';
}
