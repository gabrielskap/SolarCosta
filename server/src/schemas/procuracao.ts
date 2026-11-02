// Validação dos dois jsonb da procuração (V027).
//
// Espelho de `OutorgadoProcuracao` e `TermosProcuracao` em src/types.ts, no
// molde de schemas/contrato.ts: o texto das seções fica no front
// (src/procuracao/modeloProcuracao.ts); aqui só se garante que os DADOS têm
// forma e tamanho sãos antes de irem para o banco.
//
// Tudo com `.default()` e nada de objeto opcional aninhado: o tsconfig da raiz
// também checa este arquivo, sem strict — ver o cabeçalho de schemas/contrato.ts.

import { z } from 'zod';

/**
 * Seções do modelo cujo texto pode ser personalizado. Tem de bater com
 * `SECOES` de src/procuracao/modeloProcuracao.ts — scripts/test-modelo-procuracao.ts
 * confere.
 */
export const CHAVES_SECOES_PROCURACAO = [
  'abertura',
  'outorgante',
  'outorgados',
  'poderes',
  'vigencia',
  'fecho',
] as const;

export const MODELO_PROCURACAO_VERSAO = 1;

const texto = (max: number) => z.string().max(max).default('');
/** '' = concordância neutra ("inscrito(a)"). */
const genero = z.enum(['', 'M', 'F']).default('');

export const outorgadoProcuracaoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome de cada outorgado.').max(200),
  genero,
  nacionalidade: texto(60),
  cpf: z.string().trim().min(1, 'Informe o CPF de cada outorgado.').max(20),
  rg: texto(40),
  endereco: texto(300),
});

export const outorgadosProcuracaoSchema = z
  .array(outorgadoProcuracaoSchema)
  .min(1, 'Informe ao menos um outorgado.')
  .max(5, 'A procuração aceita até 5 outorgados.');

export const termosProcuracaoSchema = z.object({
  outorganteGenero: genero,
  outorganteNacionalidade: texto(60),
  outorganteEstadoCivil: texto(60),
  outorganteProfissao: texto(120),
  // Outorgante pessoa jurídica: quem assina por ela.
  representanteNome: texto(200),
  representanteGenero: genero,
  representanteCpf: texto(20),
  concessionaria: texto(120),
  localAssinatura: texto(120),
  dataDocumento: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data do documento: use AAAA-MM-DD.')
    .default(''),
  // Mesmo motivo do contrato: o superRefine recusa seção desconhecida também
  // em tempo de execução, não só no TS.
  textos: z.record(z.string().max(20_000, 'Texto de seção muito longo.')).default({}),
}).superRefine((t, ctx) => {
  const validas: readonly string[] = CHAVES_SECOES_PROCURACAO;
  for (const chave of Object.keys(t.textos)) {
    if (!validas.includes(chave)) {
      ctx.addIssue({ code: 'custom', path: ['textos', chave], message: `Seção de procuração desconhecida: ${chave}.` });
    }
  }
});

export type OutorgadoProcuracaoEntrada = z.infer<typeof outorgadoProcuracaoSchema>;
export type TermosProcuracaoEntrada = z.infer<typeof termosProcuracaoSchema>;
