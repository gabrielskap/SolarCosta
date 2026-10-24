// Validação dos dois jsonb do contrato no modelo Solar Costa (V024).
//
// Espelho de `ContratadaContrato` e `TermosContrato` em src/types.ts. O texto
// das cláusulas fica no front (src/contrato/modeloSolarCosta.ts); aqui só se
// garante que os DADOS têm forma e tamanho sãos antes de irem para o banco.
//
// Tudo com `.default()` e nada de objeto opcional aninhado: o tsconfig da raiz
// também checa este arquivo, sem strict, e lá a inferência de um `.optional()`
// aninhado vira `{campo?: T}` e quebra quem consome o tipo.

import { z } from 'zod';

/**
 * Seções do modelo cujo texto pode ser personalizado. Tem de bater com
 * `SECOES` de src/contrato/modeloSolarCosta.ts — scripts/test-modelo-contrato.ts
 * confere.
 */
export const CHAVES_SECOES_CONTRATO = [
  'preambulo',
  'considerandos',
  'clausula_1',
  'clausula_2',
  'clausula_3',
  'clausula_4',
  'clausula_5',
  'clausula_6',
  'clausula_7',
  'clausula_8',
  'clausula_9',
  'clausula_10',
  'encerramento',
] as const;

export const MODELO_CONTRATO_VERSAO = 1;

const texto = (max: number) => z.string().max(max).default('');
const dias = z.coerce.number().int().min(0).max(3650);
const pct = z.coerce.number().min(0).max(100);

export const contratadaContratoSchema = z.object({
  razaoSocial: texto(200),
  cnpj: texto(20),
  endereco: texto(300),
  bairro: texto(120),
  cidade: texto(120),
  uf: texto(2),
  cep: texto(12),
  telefone: texto(30),
  email: texto(200),
  representanteNome: texto(200),
  representanteNacionalidade: texto(60),
  representanteRg: texto(40),
  representanteCpf: texto(20),
});

export const termosContratoSchema = z.object({
  contratanteNacionalidade: texto(60),
  contratanteEmail: texto(200),
  enderecoEntrega: texto(300),
  prazoDespachoDias: dias,
  prazoExecucaoDias: dias,
  valorExtenso: texto(300),
  condicoesPagamento: texto(2000),
  jurosMoraMesPct: pct,
  multaMoratoriaPct: pct,
  garantias: z
    .array(z.object({ equipamento: texto(120), prazo: texto(60), causa: texto(200) }))
    .max(20)
    .default([]),
  garantiaLegalDias: dias,
  forcaMaiorDias: dias,
  prazoCuraDias: dias,
  multaRescisoriaContratantePct: pct,
  multaRescisoriaContratadaPct: pct,
  prazoPagamentoEstruturasDiasUteis: dias,
  concessionaria: texto(120),
  emailContratada: texto(200),
  foro: texto(120),
  localAssinatura: texto(120),
  dataDocumento: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data do documento: use AAAA-MM-DD.')
    .default(''),
  numeroVias: z.coerce.number().int().min(1).max(10),
  testemunhas: z
    .array(z.object({ nome: texto(200), rg: texto(40), cpf: texto(20) }))
    .max(2, 'O modelo tem duas testemunhas.')
    .default([]),
  anexoItens: z
    .array(z.object({ qtd: texto(20), descricao: texto(300) }))
    .max(100, 'O Anexo I aceita até 100 itens.')
    .default([]),
  // `z.record` com enum na chave recusaria seção desconhecida só no TS; o
  // superRefine abaixo recusa também em tempo de execução.
  textos: z.record(z.string().max(20_000, 'Texto de cláusula muito longo.')).default({}),
}).superRefine((t, ctx) => {
  const validas: readonly string[] = CHAVES_SECOES_CONTRATO;
  for (const chave of Object.keys(t.textos)) {
    if (!validas.includes(chave)) {
      ctx.addIssue({ code: 'custom', path: ['textos', chave], message: `Seção de contrato desconhecida: ${chave}.` });
    }
  }
});

export type ContratadaContratoEntrada = z.infer<typeof contratadaContratoSchema>;
export type TermosContratoEntrada = z.infer<typeof termosContratoSchema>;
