// SEO por página e dados institucionais.
//
// Duas fontes num lugar só, porque quem edita o site edita as duas juntas:
//
//   · título e descrição de cada página → SolarCosta_SitePaginas
//   · cadastro da empresa               → SolarCosta_Empresa, via a rota
//     PATCH /api/config/empresa que já existia e até agora não tinha tela.
//
// O cadastro alimenta rodapé, herói, selo de credibilidade e a página "A
// empresa" — é por isso que ele aparece aqui e não só em Configurações.

import React, { useState } from 'react';
import { Globe, Loader2, Save } from 'lucide-react';
import { Api } from '../../services/api';
import { ErroApi } from '../../services/http';
import { Site, type PaginaAdmin } from '../../services/site';

interface Props {
  paginas: PaginaAdmin[];
  empresa: Record<string, any> | null;
  onPaginaAlterada: (pagina: PaginaAdmin) => void;
  onEmpresaAlterada: (empresa: Record<string, any>) => void;
  podeEditarEmpresa: boolean;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const ROTULO = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';
const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';

/** Campos do cadastro que aparecem no site público. */
const CAMPOS_EMPRESA: { chave: string; rotulo: string; larga?: boolean }[] = [
  { chave: 'razao_social', rotulo: 'Razão social', larga: true },
  { chave: 'nome_fantasia', rotulo: 'Nome fantasia' },
  { chave: 'cnpj', rotulo: 'CNPJ' },
  { chave: 'telefone', rotulo: 'Telefone' },
  { chave: 'whatsapp', rotulo: 'WhatsApp' },
  { chave: 'email', rotulo: 'E-mail' },
  { chave: 'site', rotulo: 'Site' },
  { chave: 'endereco', rotulo: 'Endereço', larga: true },
  { chave: 'bairro', rotulo: 'Bairro' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'uf', rotulo: 'UF' },
  { chave: 'cep', rotulo: 'CEP' },
  { chave: 'responsavel_tecnico', rotulo: 'Responsável técnico' },
  { chave: 'crea', rotulo: 'CREA' },
];

export const EditorSeo: React.FC<Props> = ({
  paginas,
  empresa,
  onPaginaAlterada,
  onEmpresaAlterada,
  podeEditarEmpresa,
  showToast,
}) => {
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const c of CAMPOS_EMPRESA) inicial[c.chave] = (empresa?.[c.chave] as string) ?? '';
    return inicial;
  });

  const erro = (e: unknown, acao: string) =>
    showToast(acao, 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.');

  const salvarPagina = async (
    pagina: PaginaAdmin,
    dados: { titulo_seo?: string; descricao_seo?: string; publicada?: boolean },
  ) => {
    try {
      const atualizada = await Site.salvarPagina(pagina.id, dados);
      // A resposta não traz os blocos; preserva os que já estão em memória.
      onPaginaAlterada({ ...atualizada, blocos: pagina.blocos });
      showToast('Página salva', 'success', pagina.nome);
    } catch (e) {
      erro(e, 'Não foi possível salvar a página');
    }
  };

  const salvarEmpresa = async () => {
    setSalvandoEmpresa(true);
    try {
      // `uf` tem length(2) no banco; mandar em maiúsculas evita um 422 por
      // causa de "mg" digitado em caixa baixa.
      const corpo = { ...form, uf: (form.uf ?? '').toUpperCase() };
      const r = await Api.salvarEmpresa(corpo);
      onEmpresaAlterada(r.empresa ?? corpo);
      showToast('Cadastro salvo', 'success', 'Rodapé e páginas do site já refletem a mudança.');
    } catch (e) {
      erro(e, 'Não foi possível salvar o cadastro');
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ SEO --- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-base font-black text-[#004276]">Título e descrição de busca</h3>
        <p className="text-xs text-slate-500 mt-1">
          É o que o Google mostra no resultado e o que aparece ao compartilhar o link. A descrição
          rende melhor entre 120 e 160 caracteres.
        </p>

        <div className="mt-5 space-y-4">
          {paginas.map((p) => (
            <LinhaSeo key={p.id} pagina={p} onSalvar={(d) => void salvarPagina(p, d)} />
          ))}
        </div>
      </div>

      {/* -------------------------------------------------- empresa --- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start gap-2">
          <Globe className="w-5 h-5 text-[#004276] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-black text-[#004276]">Dados da empresa no site</h3>
            <p className="text-xs text-slate-500 mt-1">
              Alimentam o rodapé, o selo de credibilidade, a página "A empresa" e o link do
              WhatsApp. Também são os dados usados em propostas e contratos.
            </p>
          </div>
        </div>

        {!podeEditarEmpresa && (
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Alterar o cadastro exige a permissão de gerenciar usuários, porque os mesmos dados vão
            para propostas e contratos. Peça a um administrador.
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CAMPOS_EMPRESA.map((c) => (
            <div key={c.chave} className={c.larga ? 'sm:col-span-2' : ''}>
              <label className={ROTULO}>{c.rotulo}</label>
              <input
                type="text"
                value={form[c.chave] ?? ''}
                disabled={!podeEditarEmpresa}
                maxLength={c.chave === 'uf' ? 2 : undefined}
                onChange={(e) => setForm((prev) => ({ ...prev, [c.chave]: e.target.value }))}
                className={`${CAMPO} disabled:bg-slate-100 disabled:text-slate-400`}
              />
            </div>
          ))}
        </div>

        {podeEditarEmpresa && (
          <div className="flex justify-end mt-5">
            <button
              type="button"
              onClick={() => void salvarEmpresa()}
              disabled={salvandoEmpresa}
              className="inline-flex items-center gap-2 bg-[#004276] hover:bg-[#003158] disabled:bg-slate-300 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              {salvandoEmpresa ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar cadastro
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- por página -- */

const LinhaSeo: React.FC<{
  pagina: PaginaAdmin;
  onSalvar: (d: { titulo_seo?: string; descricao_seo?: string; publicada?: boolean }) => void;
}> = ({ pagina, onSalvar }) => {
  const [titulo, setTitulo] = useState(pagina.tituloSeo);
  const [descricao, setDescricao] = useState(pagina.descricaoSeo);

  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{pagina.nome}</p>
          <p className="text-[11px] text-slate-500 font-mono">{pagina.caminho}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={pagina.publicada}
            onChange={(e) => onSalvar({ publicada: e.target.checked })}
            className="accent-[#004276]"
          />
          No ar
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo !== pagina.tituloSeo && onSalvar({ titulo_seo: titulo })}
          placeholder="Título na busca"
          className={CAMPO}
        />
        <div>
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() =>
              descricao !== pagina.descricaoSeo && onSalvar({ descricao_seo: descricao })
            }
            placeholder="Descrição na busca"
            className={CAMPO}
          />
          <p
            className={`text-[10px] mt-0.5 ${
              descricao.length > 160 ? 'text-amber-600 font-bold' : 'text-slate-400'
            }`}
          >
            {descricao.length} caracteres
            {descricao.length > 160 ? ' — o Google costuma cortar depois de 160' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
