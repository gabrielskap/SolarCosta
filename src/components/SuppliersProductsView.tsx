import React, { useEffect, useState } from 'react';
import { Package, Truck, Search, Plus, Edit2, Trash2, ExternalLink, AlertTriangle, Boxes, PackageX, ChevronDown, Info } from 'lucide-react';
import { ModalCabecalho } from './comuns/ModalCabecalho';
import { Produto, Fornecedor, Kit, KitItem, TipoProdutoSlug, User } from '../types';
import { slugDoTipoProduto } from '../services/mappers';
import { maskCNPJ, maskPhone } from '../utils/format';

interface SuppliersProductsViewProps {
  produtos: Produto[];
  fornecedores: Fornecedor[];
  kits: Kit[];
  onSaveProduto: (produto: Produto) => void;
  onDeleteProduto: (id: string) => void;
  onSaveFornecedor: (fornecedor: Fornecedor) => void;
  onDeleteFornecedor: (id: string) => void;
  onSaveKit: (kit: Kit) => void;
  onDeleteKit: (id: string) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  mode?: 'produtos' | 'kits' | 'fornecedores';
}

/** Linha da composição em edição. produtoId vazio = linha ainda não escolhida. */
interface LinhaKit {
  produtoId: string;
  qtd: number;
}

export const SuppliersProductsView: React.FC<SuppliersProductsViewProps> = ({
  produtos,
  fornecedores,
  kits,
  onSaveProduto,
  onDeleteProduto,
  onSaveFornecedor,
  onDeleteFornecedor,
  onSaveKit,
  onDeleteKit,
  currentUser,
  showToast,
  mode
}) => {
  const [activeTab, setActiveTab] = useState<'produtos' | 'fornecedores' | 'kits'>(mode || 'produtos');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (mode) {
      setActiveTab(mode);
    }
  }, [mode]);

  // Modals state
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [isNewKitOpen, setIsNewKitOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);

  // Form product state — sem preço: quem precifica é o kit, e produto avulso
  // tem o valor digitado na própria proposta.
  const [nomeProd, setNomeProd] = useState('');
  const [tipoProd, setTipoProd] = useState<TipoProdutoSlug>('modulo');
  const [fornecedorIdProd, setFornecedorIdProd] = useState(fornecedores[0]?.id || 'f1');
  const [potenciaProd, setPotenciaProd] = useState('710 Wp');
  const [estoqueProd, setEstoqueProd] = useState(10);

  // Form kit state
  const [nomeKit, setNomeKit] = useState('');
  const [descricaoKit, setDescricaoKit] = useState('');
  const [precoKit, setPrecoKit] = useState(0);
  const [linhasKit, setLinhasKit] = useState<LinhaKit[]>([]);

  // Form supplier state
  const [nomeForn, setNomeForn] = useState('');
  const [cnpjForn, setCnpjForn] = useState('');
  const [cidadeForn, setCidadeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [telefoneForn, setTelefoneForn] = useState('');
  const [siteForn, setSiteForn] = useState('');

  /* ---------------------------------------------------- fechar modais -- */
  /*
   * Fechar sempre limpa o registro em edição: sem isso, sair pelo X de uma
   * edição deixava `editingProduct`/`editingKit` apontando para o item antigo,
   * e só o botão de abrir é que corrigia o estado depois.
   */
  const fecharProduto = () => {
    setIsNewProductOpen(false);
    setEditingProduct(null);
  };

  const fecharKit = () => {
    setIsNewKitOpen(false);
    setEditingKit(null);
  };

  const fecharFornecedor = () => setIsNewSupplierOpen(false);

  // Esc fecha o formulário aberto — até aqui só o X e o Cancelar faziam isso.
  // O clique no fundo continua não fechando: são formulários longos e perder o
  // preenchimento por um clique fora da borda custa mais do que economiza.
  useEffect(() => {
    if (!isNewProductOpen && !isNewSupplierOpen && !isNewKitOpen) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      fecharProduto();
      fecharFornecedor();
      fecharKit();
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [isNewProductOpen, isNewSupplierOpen, isNewKitOpen]);

  /* ------------------------------------------------ estilo dos campos -- */
  /*
   * Os três formulários desenham o mesmo campo. Declarar uma vez evita que
   * voltem a divergir (hoje já há `border` sem cor em uns e `border-slate-200`
   * em outros) e deixa o foco consistente nos três.
   */
  const rotulo = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
  const campo =
    'w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 ' +
    'placeholder:font-normal placeholder:text-slate-400 transition ' +
    'focus:outline-none focus:bg-white focus:border-[#004276] focus:ring-4 focus:ring-[#004276]/10';
  const campoSelect = `${campo} appearance-none pr-10 cursor-pointer`;

  const filteredProducts = produtos.filter(p =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.fornecedorNome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.cnpj.includes(searchQuery)
  );

  const filteredKits = kits.filter(k =>
    k.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.codigo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---- Controle de estoque ----
  const ESTOQUE_CRITICO = 10;
  const ESTOQUE_BAIXO = 25;
  const itensEsgotados = produtos.filter(p => (p.estoque || 0) <= 0);
  const itensCriticos = produtos.filter(p => (p.estoque || 0) > 0 && (p.estoque || 0) < ESTOQUE_CRITICO);
  const itensBaixos = produtos.filter(p => (p.estoque || 0) >= ESTOQUE_CRITICO && (p.estoque || 0) < ESTOQUE_BAIXO);
  const alertas = [...itensEsgotados, ...itensCriticos];

  const stockBadge = (estoque: number) => {
    if (estoque <= 0) return { txt: 'Esgotado', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (estoque < ESTOQUE_CRITICO) return { txt: 'Crítico', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (estoque < ESTOQUE_BAIXO) return { txt: 'Baixo', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { txt: 'OK', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const handleOpenEditProduct = (p: Produto) => {
    setEditingProduct(p);
    setNomeProd(p.nome);
    // `p.tipo` chega da API como RÓTULO ('Estrutura'), mas o <select> abaixo
    // trabalha com slug — sem converter, o campo abria em branco ao editar.
    setTipoProd(slugDoTipoProduto(p.tipo));
    setFornecedorIdProd(p.fornecedorId);
    setPotenciaProd(p.potencia || '');
    setEstoqueProd(p.estoque);
    setIsNewProductOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeProd) return;

    const fornObj = fornecedores.find(f => f.id === fornecedorIdProd);

    const prodObj: Produto = {
      id: editingProduct ? editingProduct.id : `novo-${Date.now()}`,
      codigo: editingProduct ? editingProduct.codigo : `PRD-00${produtos.length + 42}`,
      nome: nomeProd,
      tipo: tipoProd,
      fornecedorId: fornecedorIdProd,
      fornecedorNome: fornObj ? fornObj.nome : 'Aldo Solar',
      potencia: potenciaProd,
      estoque: Number(estoqueProd),
      // Preço continua existindo na API (custo interno), mas o cadastro não o
      // pede mais: produto novo entra zerado e produto editado preserva o que
      // já tinha, em vez de ser zerado por um campo que a tela não mostra.
      preco: editingProduct?.preco ?? 0
    };

    onSaveProduto(prodObj);
    setIsNewProductOpen(false);
    setEditingProduct(null);
  };

  /* ------------------------------------------------------------- kits -- */

  const handleOpenNewKit = () => {
    setEditingKit(null);
    setNomeKit('');
    setDescricaoKit('');
    setPrecoKit(0);
    setLinhasKit([{ produtoId: produtos[0]?.id || '', qtd: 1 }]);
    setIsNewKitOpen(true);
  };

  const handleOpenEditKit = (k: Kit) => {
    setEditingKit(k);
    setNomeKit(k.nome);
    setDescricaoKit(k.descricao || '');
    setPrecoKit(k.preco);
    setLinhasKit(k.itens.map(i => ({ produtoId: i.produtoId, qtd: i.qtd })));
    setIsNewKitOpen(true);
  };

  const handleKitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeKit.trim()) return;

    const itens = linhasKit.filter(l => l.produtoId && l.qtd > 0);
    // Espelha o mínimo do backend (kitSchema): sem isso o POST falha e o erro
    // chega como "não foi possível salvar", sem dizer o que faltou.
    if (itens.length === 0) {
      showToast('Kit vazio', 'error', 'Escolha pelo menos um produto para compor o kit.');
      return;
    }

    onSaveKit({
      id: editingKit ? editingKit.id : `novo-${Date.now()}`,
      // `codigo` é gerado pelo servidor na criação (sequência KIT-0001).
      codigo: editingKit?.codigo ?? '',
      nome: nomeKit,
      descricao: descricaoKit,
      preco: Number(precoKit),
      itens: itens.map((l, i): KitItem => ({
        id: `linha-${i}`,
        produtoId: l.produtoId,
        produtoNome: produtos.find(p => p.id === l.produtoId)?.nome ?? '',
        qtd: Number(l.qtd),
      })),
    });

    setIsNewKitOpen(false);
    setEditingKit(null);
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForn) return;

    const fornObj: Fornecedor = {
      id: `novo-${Date.now()}`,
      nome: nomeForn,
      cnpj: cnpjForn || '00.000.000/0001-00',
      cidade: cidadeForn || 'Belo Horizonte/MG',
      contato: contatoForn || 'Comercial',
      telefone: telefoneForn || '(31) 3000-0000',
      email: `${nomeForn.toLowerCase().replace(/\s+/g, '')}@fornecedor.com.br`,
      site: siteForn || 'www.fornecedor.com.br',
      produtosCount: 0
    };

    onSaveFornecedor(fornObj);
    setIsNewSupplierOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {mode === 'produtos' && (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <span>Parâmetros</span>
                <span>/</span>
                <span className="text-[#004276]">Produtos</span>
              </div>
              <h1 className="text-2xl font-extrabold text-[#004276]">Cadastro de Produtos</h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Catálogo de equipamentos e componentes fotovoltaicos · {produtos.length} produtos cadastrados
              </p>
            </>
          )}

          {mode === 'kits' && (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <span>Parâmetros</span>
                <span>/</span>
                <span className="text-[#004276]">Kits</span>
              </div>
              <h1 className="text-2xl font-extrabold text-[#004276]">Cadastro de Kits</h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Composição de kits de instalação e precificação · {kits.length} kits cadastrados
              </p>
            </>
          )}

          {mode === 'fornecedores' && (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <span>Gestão</span>
                <span>/</span>
                <span className="text-[#004276]">Fornecedores</span>
              </div>
              <h1 className="text-2xl font-extrabold text-[#004276]">Fornecedores</h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Parceiros e distribuidores homologados · {fornecedores.length} fornecedores cadastrados
              </p>
            </>
          )}

          {!mode && (
            <>
              <h1 className="text-2xl font-extrabold text-[#004276]">Fornecedores e produtos</h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Catálogo de equipamentos e kits de instalação · {fornecedores.length} fornecedores cadastrados
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'produtos'
                  ? 'Buscar equipamento...'
                  : activeTab === 'kits'
                  ? 'Buscar kit de instalação...'
                  : 'Buscar fornecedor...'
              }
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004276] w-48 sm:w-64"
            />
          </div>

          {(mode === 'produtos' || !mode) && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setNomeProd('');
                setIsNewProductOpen(true);
              }}
              className="px-3.5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo produto
            </button>
          )}

          {(mode === 'kits' || !mode) && (
            <button
              onClick={handleOpenNewKit}
              className={`px-3.5 py-2 font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5 ${
                mode === 'kits'
                  ? 'bg-[#004276] hover:bg-[#003159] text-white'
                  : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Plus className="w-4 h-4" /> Novo kit de instalação
            </button>
          )}

          {(mode === 'fornecedores' || !mode) && (
            <button
              onClick={() => setIsNewSupplierOpen(true)}
              className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo fornecedor
            </button>
          )}
        </div>
      </div>

      {/* Tabs Header - only show if no specific mode is defined */}
      {!mode && (
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-1 w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('produtos')}
            className={`py-2 px-5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'produtos' ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Produtos ({produtos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('kits')}
            className={`py-2 px-5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'kits' ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Kits ({kits.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fornecedores')}
            className={`py-2 px-5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'fornecedores' ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Fornecedores ({fornecedores.length})</span>
          </button>
        </div>
      )}

      {/* PRODUTOS TAB */}
      {activeTab === 'produtos' && (
        <div className="space-y-4">
          {/* KPIs de estoque */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens no catálogo</span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">{produtos.length}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kits cadastrados</span>
                <Boxes className="w-4 h-4 text-[#004276]" />
              </div>
              <h3 className="text-xl font-black text-[#004276] mt-1">{kits.length}</h3>
              <p className="text-[10px] text-slate-500 font-medium">com preço de venda</p>
            </div>
            <div className={`p-4 rounded-2xl border shadow-sm ${itensCriticos.length ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Estoque crítico</span>
                <AlertTriangle className={`w-4 h-4 ${itensCriticos.length ? 'text-rose-500' : 'text-slate-300'}`} />
              </div>
              <h3 className="text-xl font-black text-rose-700 mt-1">{itensCriticos.length}</h3>
              <p className="text-[10px] text-slate-500 font-medium">abaixo de {ESTOQUE_CRITICO} un</p>
            </div>
            <div className={`p-4 rounded-2xl border shadow-sm ${itensEsgotados.length ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Esgotados</span>
                <PackageX className={`w-4 h-4 ${itensEsgotados.length ? 'text-rose-500' : 'text-slate-300'}`} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">{itensEsgotados.length}</h3>
              <p className="text-[10px] text-slate-500 font-medium">sem saldo</p>
            </div>
          </div>

          {/* Banner de reposição */}
          {alertas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-900">
                  {alertas.length} {alertas.length === 1 ? 'item precisa' : 'itens precisam'} de reposição
                </p>
                <p className="text-amber-800 mt-0.5">
                  {alertas.slice(0, 4).map(p => `${p.nome} (${p.estoque} un)`).join(' · ')}
                  {alertas.length > 4 ? ` · +${alertas.length - 4}` : ''}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="tabela-mobile w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                  <th className="p-3">CÓDIGO</th>
                  <th className="p-3">PRODUTO</th>
                  <th className="p-3">FORNECEDOR</th>
                  <th className="p-3">TIPO</th>
                  <th className="p-3">POTÊNCIA</th>
                  <th className="p-3">ESTOQUE</th>
                  <th className="p-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td data-label="CÓDIGO" className="p-3 font-mono font-bold text-slate-600">{p.codigo}</td>
                    <td data-label="PRODUTO" className="p-3 font-bold text-slate-900">{p.nome}</td>
                    <td data-label="FORNECEDOR" className="p-3 text-slate-600">{p.fornecedorNome}</td>
                    <td data-label="TIPO" className="p-3">
                      <span className="bg-blue-50 text-[#004276] font-bold px-2 py-0.5 rounded text-[10px] capitalize">
                        {p.tipo}
                      </span>
                    </td>
                    <td data-label="POTÊNCIA" className="p-3 font-medium text-slate-700">{p.potencia || '–'}</td>
                    <td data-label="ESTOQUE" className="p-3">
                      {(() => {
                        const b = stockBadge(p.estoque || 0);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{p.estoque} un</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${b.cls}`}>{b.txt}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td data-label="AÇÕES" className="p-3 text-right font-bold space-x-2">
                      <button
                        onClick={() => handleOpenEditProduct(p)}
                        className="text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDeleteProduto(p.id);
                          showToast('Produto excluído', 'info', `${p.nome} removido.`);
                        }}
                        className="text-rose-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* KITS TAB */}
      {activeTab === 'kits' && (
        <div className="space-y-4">
          {kits.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm mt-3">Nenhum kit cadastrado</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                O kit é o que tem preço de venda: um nome, um valor fechado e os produtos que o compõem.
              </p>
              <button
                onClick={handleOpenNewKit}
                className="mt-4 px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition"
              >
                + Novo kit de instalação
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKits.map((k) => (
                <div key={k.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold text-slate-400">{k.codigo}</p>
                      <h3 className="font-extrabold text-slate-900 text-sm truncate">{k.nome}</h3>
                      {k.descricao && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{k.descricao}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-[#004276]">
                        R$ {k.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {!!k.potenciaWpTotal && (
                        <p className="text-[10px] font-bold text-slate-400">
                          {(k.potenciaWpTotal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWp
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-1.5">
                    {k.itens.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-xs">
                        <span className={`truncate ${i.produtoAtivo === false ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                          {i.produtoNome}
                          {i.produtoAtivo === false && ' (excluído do catálogo)'}
                        </span>
                        <span className="font-bold text-slate-800 shrink-0 ml-2">
                          {i.qtd.toLocaleString('pt-BR')} un
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 text-xs font-bold pt-1">
                    <button onClick={() => handleOpenEditKit(k)} className="text-blue-600 hover:underline flex items-center gap-1">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        onDeleteKit(k.id);
                        showToast('Kit excluído', 'info', `${k.nome} removido do catálogo.`);
                      }}
                      className="text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FORNECEDORES TAB */}
      {activeTab === 'fornecedores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((f) => (
            <div key={f.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-blue-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-[#004276] text-base">{f.nome}</h3>
                  <p className="text-xs text-slate-400 font-mono">CNPJ: {f.cnpj}</p>
                </div>
                <span className="bg-blue-50 text-[#004276] font-bold px-2.5 py-1 rounded-full text-[10px]">
                  {f.produtosCount} equipamentos
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">LOCALIZAÇÃO</span>
                  <span className="font-semibold text-slate-800">{f.cidade}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">CONTATO DIRETO</span>
                  <span className="font-semibold text-slate-800">{f.contato} ({f.telefone})</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={`https://${f.site}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>{f.site}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={() => {
                    onDeleteFornecedor(f.id);
                    showToast('Fornecedor removido', 'info', `${f.nome} excluído.`);
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo/Editar Produto */}
      {isNewProductOpen && (
        <div className="modal-overlay modal-entrada-fundo modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <ModalCabecalho
              icone={Package}
              titulo={editingProduct ? 'Editar produto' : 'Cadastrar novo produto'}
              subtitulo={`${editingProduct ? editingProduct.codigo : 'Equipamento do catálogo'} · o preço fica no kit`}
              onFechar={fecharProduto}
            />

            <form onSubmit={handleProductSubmit} className="campos-modal flex-1 min-h-0 flex flex-col">
              <div className="modal-corpo campos-modal flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={rotulo}>
                    Nome do equipamento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeProd}
                    onChange={(e) => setNomeProd(e.target.value)}
                    placeholder="Ex: Painel TLC Tier 1 710 Wp"
                    className={campo}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>Tipo</label>
                    <div className="relative">
                      <select
                        value={tipoProd}
                        onChange={(e) => setTipoProd(e.target.value as TipoProdutoSlug)}
                        className={campoSelect}
                      >
                        <option value="modulo">Módulo</option>
                        <option value="inversor">Inversor / Micro</option>
                        <option value="estrutura">Estrutura</option>
                        <option value="cabo">Cabo</option>
                        <option value="protecao">Proteção</option>
                        <option value="acessorio">Acessório</option>
                        <option value="outro">Outro</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className={rotulo}>Fornecedor</label>
                    <div className="relative">
                      <select
                        value={fornecedorIdProd}
                        onChange={(e) => setFornecedorIdProd(e.target.value)}
                        className={campoSelect}
                      >
                        {fornecedores.map(f => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>Potência</label>
                    <input
                      type="text"
                      value={potenciaProd}
                      onChange={(e) => setPotenciaProd(e.target.value)}
                      placeholder="710 Wp"
                      className={campo}
                    />
                  </div>

                  <div>
                    <label className={rotulo}>Estoque</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={estoqueProd}
                        onChange={(e) => setEstoqueProd(Number(e.target.value))}
                        className={`${campo} pr-10 font-black`}
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        un
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <Info className="w-4 h-4 shrink-0 mt-px text-[#004276]" />
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Produto não tem preço: quem tem valor de venda é o <strong className="text-slate-800">kit de instalação</strong>.
                    Produto avulso na proposta tem o valor digitado lá.
                  </p>
                </div>
              </div>

              <div className="barra-acoes bg-white border-t border-slate-100 px-5 py-4 flex justify-end gap-2 text-xs">
                <button type="button" onClick={fecharProduto} className="btn-modal-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-salvar">
                  {editingProduct ? 'Salvar alterações' : 'Salvar produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Fornecedor */}
      {isNewSupplierOpen && (
        <div className="modal-overlay modal-entrada-fundo modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <ModalCabecalho
              icone={Truck}
              titulo="Cadastrar fornecedor"
              subtitulo="Parceiro de compra dos equipamentos"
              onFechar={fecharFornecedor}
            />

            <form onSubmit={handleSupplierSubmit} className="campos-modal flex-1 min-h-0 flex flex-col">
              <div className="modal-corpo campos-modal flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={rotulo}>
                    Nome da empresa / fornecedor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeForn}
                    onChange={(e) => setNomeForn(e.target.value)}
                    placeholder="Ex: Canadian Solar Brasil"
                    className={campo}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>CNPJ</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cnpjForn}
                      onChange={(e) => setCnpjForn(maskCNPJ(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      className={`${campo} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={rotulo}>Cidade / UF</label>
                    <input
                      type="text"
                      value={cidadeForn}
                      onChange={(e) => setCidadeForn(e.target.value)}
                      placeholder="São Paulo/SP"
                      className={campo}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>Contato</label>
                    <input
                      type="text"
                      value={contatoForn}
                      onChange={(e) => setContatoForn(e.target.value)}
                      placeholder="Carlos Andrade"
                      className={campo}
                    />
                  </div>
                  <div>
                    <label className={rotulo}>Telefone</label>
                    <input
                      type="text"
                      inputMode="tel"
                      value={telefoneForn}
                      onChange={(e) => setTelefoneForn(maskPhone(e.target.value))}
                      placeholder="(11) 4000-0000"
                      className={campo}
                    />
                  </div>
                </div>

                <div>
                  <label className={rotulo}>Website</label>
                  <input
                    type="text"
                    value={siteForn}
                    onChange={(e) => setSiteForn(e.target.value)}
                    placeholder="www.fornecedor.com.br"
                    className={campo}
                  />
                </div>

                <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Só o nome é obrigatório — os demais campos entram com um valor padrão
                    e podem ser completados depois.
                  </p>
                </div>
              </div>

              <div className="barra-acoes bg-white border-t border-slate-100 px-5 py-4 flex justify-end gap-2 text-xs">
                <button type="button" onClick={fecharFornecedor} className="btn-modal-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-salvar">
                  Salvar fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo/Editar Kit */}
      {isNewKitOpen && (
        <div className="modal-overlay modal-entrada-fundo modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel modal-entrada-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <ModalCabecalho
              icone={Boxes}
              titulo={editingKit ? 'Editar kit de instalação' : 'Cadastrar kit de instalação'}
              subtitulo={`${editingKit ? editingKit.codigo : 'Novo kit'} · conjunto com preço fechado de venda`}
              onFechar={fecharKit}
            />

            <form onSubmit={handleKitSubmit} className="campos-modal flex-1 min-h-0 flex flex-col">
              <div className="modal-corpo campos-modal flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={rotulo}>
                    Nome do kit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeKit}
                    onChange={(e) => setNomeKit(e.target.value)}
                    placeholder="Ex: Kit Residencial 8 kWp"
                    className={campo}
                  />
                </div>

                <div>
                  <label className={rotulo}>Descrição (opcional)</label>
                  <input
                    type="text"
                    value={descricaoKit}
                    onChange={(e) => setDescricaoKit(e.target.value)}
                    placeholder="Telhado cerâmico · inclui instalação"
                    className={campo}
                  />
                </div>

                {/* O preço é o dado mais importante do kit — ganha um bloco só dele. */}
                <div className="rounded-2xl border border-[#004276]/15 bg-gradient-to-br from-blue-50/80 to-slate-50 p-4">
                  <label className={rotulo}>Preço de venda</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precoKit}
                      onChange={(e) => setPrecoKit(Number(e.target.value))}
                      className={`${campo} pl-11 py-3 text-lg font-black text-[#004276] bg-white border-slate-200`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Valor fechado do kit — não é a soma dos produtos abaixo.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    {/* Sem o `rotulo` compartilhado: aqui o rótulo divide a linha
                        com o botão e não pode levar a margem inferior dele. */}
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Produtos do kit
                      {linhasKit.length > 0 && (
                        <span className="ml-1.5 text-slate-400 normal-case tracking-normal">
                          ({linhasKit.length})
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => setLinhasKit(prev => [...prev, { produtoId: produtos[0]?.id || '', qtd: 1 }])}
                      disabled={produtos.length === 0}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#004276] bg-blue-50 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar produto
                    </button>
                  </div>

                  {produtos.length === 0 && (
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-600" />
                      <p className="text-[11px] leading-relaxed text-amber-900">
                        Nenhum produto no catálogo ainda. Cadastre os equipamentos antes de montar o kit.
                      </p>
                    </div>
                  )}

                  {produtos.length > 0 && linhasKit.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setLinhasKit([{ produtoId: produtos[0]?.id || '', qtd: 1 }])}
                      className="w-full rounded-xl border-2 border-dashed border-slate-200 p-5 text-[11px] font-bold text-slate-400 hover:border-[#004276]/40 hover:text-[#004276] hover:bg-blue-50/40 transition"
                    >
                      + Adicionar o primeiro produto do kit
                    </button>
                  )}

                  <div className="space-y-2">
                    {linhasKit.map((linha, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 transition hover:border-slate-300"
                      >
                        <span className="hidden sm:flex w-6 h-6 shrink-0 rounded-lg bg-white border border-slate-200 items-center justify-center text-[10px] font-black text-slate-400">
                          {idx + 1}
                        </span>

                        <div className="relative flex-1 min-w-0">
                          <select
                            value={linha.produtoId}
                            onChange={(e) => setLinhasKit(prev =>
                              prev.map((l, i) => (i === idx ? { ...l, produtoId: e.target.value } : l))
                            )}
                            className={`${campoSelect} bg-white`}
                          >
                            <option value="">Selecione o produto…</option>
                            {produtos.map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>

                        <div className="relative w-[4.5rem] shrink-0">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={linha.qtd}
                            onChange={(e) => setLinhasKit(prev =>
                              prev.map((l, i) => (i === idx ? { ...l, qtd: Number(e.target.value) } : l))
                            )}
                            className={`${campo} bg-white px-2 pr-6 font-black text-center`}
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            un
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setLinhasKit(prev => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          aria-label="Remover produto do kit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="barra-acoes bg-white border-t border-slate-100 px-5 py-4 flex justify-end gap-2 text-xs">
                <button type="button" onClick={fecharKit} className="btn-modal-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-salvar">
                  {editingKit ? 'Salvar alterações' : 'Salvar kit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
