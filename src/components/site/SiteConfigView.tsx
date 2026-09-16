// Configuração do Site — a tela que edita o site institucional.
//
// ESTA TELA BUSCA OS PRÓPRIOS DADOS, rompendo de propósito o padrão
// "componente burro + estado no App.tsx" do resto do CRM. Três razões:
//
//   · `carregarTudo()` dispara no login de TODO usuário; conteúdo do site e
//     metadados de imagem pesariam no boot de quem nunca abre esta tela.
//   · nenhuma outra tela consome esses dados, então não há o que compartilhar.
//   · App.tsx já tem quase 900 linhas e ganharia mais uma dezena de handlers.
//
// Não há rascunho: salvar publica. É por isso que cada ação dá um retorno
// explícito ("a alteração já está no ar") e que existe o link "Ver no site".

import React, { useEffect, useState } from 'react';
import { FileText, Globe, Image as ImageIcon, Loader2, Menu as MenuIcon, Plus, WifiOff } from 'lucide-react';
import { Api } from '../../services/api';
import { ErroApi } from '../../services/http';
import { Site, PAGINAS_FIXAS, type PaginaAdmin, type MenuAdmin, type SiteAdmin } from '../../services/site';
import type { MidiaSite } from '../../site/blocos/tipos';
import type { User } from '../../types';
import { EditorPagina } from './EditorPagina';
import { EditorMenus } from './EditorMenus';
import { EditorSeo } from './EditorSeo';
import { BibliotecaMidia } from './BibliotecaMidia';
import { NovaPaginaModal } from './NovaPaginaModal';

type Aba = 'paginas' | 'menus' | 'midia' | 'seo';

const ABAS: { id: Aba; rotulo: string; Icone: typeof FileText }[] = [
  { id: 'paginas', rotulo: 'Páginas', Icone: FileText },
  { id: 'menus', rotulo: 'Menus', Icone: MenuIcon },
  { id: 'midia', rotulo: 'Imagens', Icone: ImageIcon },
  { id: 'seo', rotulo: 'SEO e empresa', Icone: Globe },
];

interface Props {
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const SiteConfigView: React.FC<Props> = ({ currentUser, showToast }) => {
  const [aba, setAba] = useState<Aba>('paginas');
  const [dados, setDados] = useState<SiteAdmin | null>(null);
  const [empresa, setEmpresa] = useState<Record<string, any> | null>(null);
  const [slug, setSlug] = useState<string>('home');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalNovaPagina, setModalNovaPagina] = useState<{ nome?: string; caminho?: string } | null>(
    null,
  );

  const admin = currentUser.cargo === 'Administrador';
  const podeEditarEmpresa = admin || !!currentUser.permissoes?.gerenciarUsuarios;

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      // O cadastro da empresa vem junto porque a aba SEO o edita, e porque os
      // blocos que dependem dele precisam ser explicados na tela.
      const [site, config] = await Promise.all([Site.carregar(), Api.getConfig()]);
      setDados(site);
      setEmpresa(config?.empresa ?? null);
      if (site.paginas.length > 0 && !site.paginas.some((p) => p.slug === slug)) {
        setSlug(site.paginas[0]!.slug);
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível carregar o site.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------ escritas em memória -- */

  const trocarPagina = (pagina: PaginaAdmin) =>
    setDados((d) =>
      d ? { ...d, paginas: d.paginas.map((p) => (p.id === pagina.id ? pagina : p)) } : d,
    );

  const trocarMenus = (menus: MenuAdmin[]) => setDados((d) => (d ? { ...d, menus } : d));
  const trocarMidia = (midia: MidiaSite[]) => setDados((d) => (d ? { ...d, midia } : d));

  const criarPagina = async (novaPagina: { nome: string; caminho: string }) => {
    const pagina = await Site.criarPagina(novaPagina);
    setDados((d) => (d ? { ...d, paginas: [...d.paginas, pagina] } : d));
    setAba('paginas');
    setSlug(pagina.slug);
    setModalNovaPagina(null);
    showToast('Página criada', 'success', `${pagina.nome} já está no ar em ${pagina.caminho}`);
  };

  const excluirPagina = async (alvo: PaginaAdmin) => {
    if (
      !window.confirm(
        `Excluir a página "${alvo.nome}"? Os blocos dela somem junto, e o endereço ${alvo.caminho} deixa de existir no site.`,
      )
    )
      return;
    try {
      await Site.excluirPagina(alvo.id);
      const restantes = dados?.paginas.filter((p) => p.id !== alvo.id) ?? [];
      setDados((d) => (d ? { ...d, paginas: restantes } : d));
      if (slug === alvo.slug) setSlug(restantes[0]?.slug ?? 'home');
      showToast('Página excluída', 'success', alvo.nome);
    } catch (e) {
      showToast(
        'Não foi possível excluir a página',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.',
      );
    }
  };

  /* ----------------------------------------------------------- estados -- */

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-7 h-7 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Carregando o conteúdo do site…</p>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="max-w-md mx-auto text-center bg-white border border-slate-200 rounded-2xl p-8 mt-16">
        <WifiOff className="w-9 h-9 text-rose-500 mx-auto mb-4" />
        <h2 className="font-extrabold text-base text-slate-900 mb-2">
          Não foi possível abrir a configuração do site
        </h2>
        <p className="text-sm text-slate-600 mb-6">{erro}</p>
        <button
          onClick={() => void carregar()}
          className="px-4 py-2 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const pagina = dados.paginas.find((p) => p.slug === slug) ?? dados.paginas[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Configuração do Site</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Textos, imagens e menus do site institucional. O que você salva aqui vai ao ar na hora.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:border-[#004276] hover:text-[#004276] transition"
        >
          <Globe className="w-4 h-4" />
          Abrir o site
        </a>
      </div>

      {/* ------------------------------------------------------- abas --- */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 transition ${
              aba === a.id
                ? 'border-[#FFD100] text-[#004276] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <a.Icone className="w-4 h-4" />
            {a.rotulo}
          </button>
        ))}
      </div>

      {/* --------------------------------------------------- conteúdo --- */}
      {aba === 'paginas' && pagina && (
        <div className="grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] gap-5 items-start">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setModalNovaPagina({})}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#004276] border border-dashed border-slate-300 hover:border-[#004276] hover:bg-blue-50/40 rounded-xl px-3 py-2.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova página
            </button>

            <nav className="bg-white border border-slate-200 rounded-2xl p-2 space-y-1">
              {dados.paginas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSlug(p.slug)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    p.slug === slug
                      ? 'bg-[#004276] text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate">{p.nome}</span>
                  <span
                    className={`block text-[10px] font-mono ${
                      p.slug === slug ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {p.caminho}
                    {p.publicada ? '' : ' · fora do ar'}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <EditorPagina
              pagina={pagina}
              midia={dados.midia}
              onPaginaAlterada={trocarPagina}
              onMidiaAlterada={trocarMidia}
              podeExcluir={!PAGINAS_FIXAS.has(pagina.slug)}
              onExcluir={() => excluirPagina(pagina)}
              showToast={showToast}
            />
          </div>
        </div>
      )}

      {aba === 'menus' && (
        <EditorMenus
          menus={dados.menus}
          paginas={dados.paginas}
          onMenusAlterados={trocarMenus}
          onCriarPagina={(sugestao) => setModalNovaPagina(sugestao)}
          showToast={showToast}
        />
      )}

      {aba === 'midia' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <BibliotecaMidia
            midia={dados.midia}
            onMidiaAlterada={trocarMidia}
            showToast={showToast}
          />
        </div>
      )}

      {aba === 'seo' && (
        <EditorSeo
          paginas={dados.paginas}
          empresa={empresa}
          onPaginaAlterada={trocarPagina}
          onEmpresaAlterada={setEmpresa}
          podeEditarEmpresa={podeEditarEmpresa}
          showToast={showToast}
        />
      )}

      {modalNovaPagina && (
        <NovaPaginaModal
          nomeInicial={modalNovaPagina.nome}
          caminhoInicial={modalNovaPagina.caminho}
          onCriar={criarPagina}
          onFechar={() => setModalNovaPagina(null)}
        />
      )}
    </div>
  );
};
