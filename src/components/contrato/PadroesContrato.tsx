// Padrões do contrato: o cadastro da contratada (com o representante legal) e
// os números do modelo — prazos, multas, garantias.
//
// Vale para contratos NOVOS. Cada contrato guarda a própria cópia (contratada
// e termos, V024), então mudar algo aqui não reescreve contrato já emitido —
// para trazer o cadastro novo a um contrato aberto, há "Recarregar do
// cadastro" no módulo da Solar Costa.
//
// As rotas exigem gerenciar_usuarios (painel.routes.ts): é administração do
// sistema, não atendimento de um cliente.

import React, { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { GarantiaContrato } from '../../types';
import { Api, type ConfigApp } from '../../services/api';
import { ErroApi } from '../../services/http';
import {
  CHAVES_PARAMETRO, NUMEROS_PADRAO, PARAMETRO_CONCESSIONARIA, PARAMETRO_GARANTIAS, garantiasDoParametro,
} from '../../contrato/padroes';
import { maskCEP, maskCNPJ, maskCPF, maskPhone } from '../../utils/format';
import { CabecalhoModulo, Campo, CampoNumero, Grade } from './campos';
import { TabelaGarantiasEditavel } from './modulos/ModuloGarantias';

interface Props {
  config: ConfigApp | null;
  podeEditar: boolean;
  onConfigAlterada: (config: ConfigApp) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const CAMPOS_EMPRESA = [
  'razao_social', 'cnpj', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'telefone', 'email', 'foro_padrao',
  'representante_nome', 'representante_nacionalidade', 'representante_rg', 'representante_cpf',
] as const;
type CampoEmpresa = (typeof CAMPOS_EMPRESA)[number];
type Numeros = typeof NUMEROS_PADRAO;

const ROTULOS_NUMEROS: Record<keyof Numeros, { rotulo: string; sufixo: string; inteiro: boolean; clausula: string }> = {
  prazoDespachoDias: { rotulo: 'Despacho pelo fornecedor', sufixo: 'dias', inteiro: true, clausula: '2.3' },
  prazoExecucaoDias: { rotulo: 'Entrega dos serviços', sufixo: 'dias corridos', inteiro: true, clausula: '2.4' },
  jurosMoraMesPct: { rotulo: 'Juros de mora', sufixo: '% ao mês', inteiro: false, clausula: '3.3' },
  multaMoratoriaPct: { rotulo: 'Multa moratória', sufixo: '%', inteiro: false, clausula: '3.3' },
  garantiaLegalDias: { rotulo: 'Garantia legal', sufixo: 'dias', inteiro: true, clausula: '7.3' },
  forcaMaiorDias: { rotulo: 'Força maior', sufixo: 'dias', inteiro: true, clausula: '9.1 a' },
  prazoCuraDias: { rotulo: 'Prazo para sanar descumprimento', sufixo: 'dias corridos', inteiro: true, clausula: '9.1 b' },
  multaRescisoriaContratantePct: { rotulo: 'Multa — contratante desiste', sufixo: '%', inteiro: false, clausula: '9.2' },
  multaRescisoriaContratadaPct: { rotulo: 'Multa — Solar Costa atrasa', sufixo: '%', inteiro: false, clausula: '9.2.1' },
  prazoPagamentoEstruturasDiasUteis: { rotulo: 'Pagamento de estruturas', sufixo: 'dias úteis', inteiro: true, clausula: '9.3' },
  numeroVias: { rotulo: 'Número de vias', sufixo: 'vias', inteiro: true, clausula: 'fecho' },
};

function lerNumeros(config: ConfigApp | null): Numeros {
  const saida = { ...NUMEROS_PADRAO };
  for (const k of Object.keys(NUMEROS_PADRAO) as (keyof Numeros)[]) {
    const bruto = config?.parametros.find((p) => p.chave === CHAVES_PARAMETRO[k])?.valor;
    const n = Number(bruto);
    if (bruto != null && bruto !== '' && Number.isFinite(n)) saida[k] = n;
  }
  return saida;
}

export const PadroesContrato: React.FC<Props> = ({ config, podeEditar, onConfigAlterada, showToast }) => {
  const [empresa, setEmpresa] = useState<Record<CampoEmpresa, string>>(() => {
    const e = config?.empresa ?? {};
    return Object.fromEntries(CAMPOS_EMPRESA.map((c) => [c, (e[c] as string) ?? ''])) as Record<CampoEmpresa, string>;
  });
  const [numeros, setNumeros] = useState<Numeros>(() => lerNumeros(config));
  const [concessionaria, setConcessionaria] = useState(
    () => config?.parametros.find((p) => p.chave === PARAMETRO_CONCESSIONARIA)?.valor ?? 'Cemig',
  );
  const [garantias, setGarantias] = useState<GarantiaContrato[]>(() => garantiasDoParametro(config));
  const [salvando, setSalvando] = useState(false);

  const somenteLeitura = !podeEditar;
  const mudarEmpresa = (campo: CampoEmpresa, valor: string) => setEmpresa((e) => ({ ...e, [campo]: valor }));

  const salvar = async () => {
    if (!config) return;
    setSalvando(true);
    try {
      // Campo vazio não vai: a rota usa COALESCE (ausente = não mexer) e
      // recusa '' em razão social, UF e e-mail.
      const corpo: Record<string, string> = {};
      for (const c of CAMPOS_EMPRESA) if (empresa[c].trim()) corpo[c] = empresa[c].trim();
      if (corpo.uf) corpo.uf = corpo.uf.toUpperCase();
      const r = await Api.salvarEmpresa(corpo);

      const parametros = [
        ...(Object.keys(numeros) as (keyof Numeros)[]).map((k) => ({ chave: CHAVES_PARAMETRO[k], valor: String(numeros[k]) })),
        { chave: PARAMETRO_CONCESSIONARIA, valor: concessionaria.trim() || 'Cemig' },
        {
          chave: PARAMETRO_GARANTIAS,
          valor: JSON.stringify(garantias.filter((g) => g.equipamento.trim() || g.prazo.trim() || g.causa.trim())),
        },
      ];
      const p = await Api.salvarParametros(parametros);

      onConfigAlterada({ ...config, empresa: r.empresa ?? config.empresa, parametros: p.parametros ?? config.parametros });
      showToast('Padrões salvos', 'success', 'Valem para os próximos contratos. Os já emitidos mantêm a própria cópia.');
    } catch (e) {
      showToast('Não foi possível salvar', 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.');
    } finally {
      setSalvando(false);
    }
  };

  const campo = (c: CampoEmpresa, rotulo: string, opcoes: { larga?: boolean; mascara?: (v: string) => string; dica?: string } = {}) => (
    <Campo
      rotulo={rotulo}
      valor={empresa[c]}
      onChange={(v) => mudarEmpresa(c, opcoes.mascara ? opcoes.mascara(v) : v)}
      somenteLeitura={somenteLeitura}
      larga={opcoes.larga}
      dica={opcoes.dica}
    />
  );

  return (
    <div className="space-y-6">
      {somenteLeitura && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Só o Administrador (ou quem gerencia usuários) altera os padrões do contrato.
        </p>
      )}

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <CabecalhoModulo titulo="Dados da Solar Costa" onde="Preâmbulo (II), assinatura e rodapé de todo contrato novo." />
        <Grade>
          {campo('razao_social', 'Razão social', { larga: true })}
          {campo('cnpj', 'CNPJ', { mascara: maskCNPJ })}
          {campo('telefone', 'Telefone', { mascara: maskPhone })}
          {campo('endereco', 'Endereço (rua e número)', { larga: true })}
          {campo('bairro', 'Bairro')}
          {campo('cep', 'CEP', { mascara: maskCEP })}
          {campo('cidade', 'Cidade')}
          {campo('uf', 'UF', { mascara: (v) => v.toUpperCase().slice(0, 2) })}
          {campo('email', 'E-mail para notificações', { dica: 'Cláusula 10.8.' })}
          {campo('foro_padrao', 'Foro padrão', { dica: 'Cláusula 10.12 — a comarca.' })}
        </Grade>
        <h4 className="font-bold text-slate-800 text-sm mt-6 mb-3">Representante legal</h4>
        <Grade>
          {campo('representante_nome', 'Nome')}
          {campo('representante_nacionalidade', 'Nacionalidade')}
          {campo('representante_rg', 'RG')}
          {campo('representante_cpf', 'CPF', { mascara: maskCPF })}
        </Grade>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <CabecalhoModulo titulo="Prazos, multas e vias" onde="Valores iniciais de cada contrato novo; o contrato pode mudá-los." />
        <Grade>
          {(Object.keys(ROTULOS_NUMEROS) as (keyof Numeros)[]).map((k) => {
            const def = ROTULOS_NUMEROS[k];
            return (
              <CampoNumero
                key={k}
                rotulo={def.rotulo}
                valor={numeros[k]}
                onChange={(n) => setNumeros((atual) => ({ ...atual, [k]: n }))}
                somenteLeitura={somenteLeitura}
                inteiro={def.inteiro}
                sufixo={def.sufixo}
                dica={`Cláusula ${def.clausula}.`}
              />
            );
          })}
          <Campo
            rotulo="Concessionária"
            valor={concessionaria}
            onChange={setConcessionaria}
            somenteLeitura={somenteLeitura}
            dica="Cláusula 9.4."
          />
        </Grade>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <CabecalhoModulo titulo="Tabela de garantias" onde="Cláusula 7.2 — prazos dos fornecedores." />
        <TabelaGarantiasEditavel garantias={garantias} onChange={setGarantias} somenteLeitura={somenteLeitura} />
      </div>

      {podeEditar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || !config}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar padrões
          </button>
        </div>
      )}
    </div>
  );
};
