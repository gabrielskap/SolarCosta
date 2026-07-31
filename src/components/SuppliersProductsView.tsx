import React, { useState } from 'react';
import { Package, Truck, Search, Plus, Edit2, Trash2, ExternalLink, X, AlertTriangle, TrendingDown, PackageX } from 'lucide-react';
import { Produto, Fornecedor, User } from '../types';
import { maskCNPJ, maskPhone } from '../utils/format';

interface SuppliersProductsViewProps {
  produtos: Produto[];
  fornecedores: Fornecedor[];
  onSaveProduto: (produto: Produto) => void;
  onDeleteProduto: (id: string) => void;
  onSaveFornecedor: (fornecedor: Fornecedor) => void;
  onDeleteFornecedor: (id: string) => void;
  currentUser: User;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const SuppliersProductsView: React.FC<SuppliersProductsViewProps> = ({
  produtos,
  fornecedores,
  onSaveProduto,
  onDeleteProduto,
  onSaveFornecedor,
  onDeleteFornecedor,
  currentUser,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'produtos' | 'fornecedores'>('produtos');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);

  // Form product state
  const [nomeProd, setNomeProd] = useState('');
  const [tipoProd, setTipoProd] = useState<'modulo' | 'inversor' | 'estrutura' | 'cabo' | 'protecao' | 'acessorio'>('modulo');
  const [fornecedorIdProd, setFornecedorIdProd] = useState(fornecedores[0]?.id || 'f1');
  const [potenciaProd, setPotenciaProd] = useState('710 Wp');
  const [estoqueProd, setEstoqueProd] = useState(10);
  const [precoProd, setPrecoProd] = useState(640);

  // Form supplier state
  const [nomeForn, setNomeForn] = useState('');
  const [cnpjForn, setCnpjForn] = useState('');
  const [cidadeForn, setCidadeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [telefoneForn, setTelefoneForn] = useState('');
  const [siteForn, setSiteForn] = useState('');

  const filteredProducts = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.fornecedorNome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.cnpj.includes(searchQuery)
  );

  // ---- Controle de estoque ----
  const ESTOQUE_CRITICO = 10;
  const ESTOQUE_BAIXO = 25;
  const valorEstoque = produtos.reduce((acc, p) => acc + (p.preco || 0) * (p.estoque || 0), 0);
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
    setTipoProd(p.tipo);
    setFornecedorIdProd(p.fornecedorId);
    setPotenciaProd(p.potencia || '');
    setEstoqueProd(p.estoque);
    setPrecoProd(p.preco);
    setIsNewProductOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeProd) return;

    const fornObj = fornecedores.find(f => f.id === fornecedorIdProd);

    const prodObj: Produto = {
      id: editingProduct ? editingProduct.id : `prd-${Date.now()}`,
      codigo: editingProduct ? editingProduct.codigo : `PRD-00${produtos.length + 42}`,
      nome: nomeProd,
      tipo: tipoProd,
      fornecedorId: fornecedorIdProd,
      fornecedorNome: fornObj ? fornObj.nome : 'Aldo Solar',
      potencia: potenciaProd,
      estoque: Number(estoqueProd),
      preco: Number(precoProd)
    };

    onSaveProduto(prodObj);
    setIsNewProductOpen(false);
    setEditingProduct(null);
    showToast(
      editingProduct ? 'Produto atualizado' : 'Produto cadastrado',
      'success',
      `${nomeProd} gravado no catálogo.`
    );
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForn) return;

    const fornObj: Fornecedor = {
      id: `f-${Date.now()}`,
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
    showToast('Fornecedor cadastrado', 'success', `${nomeForn} adicionado aos parceiros.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#004276]">Fornecedores e produtos</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Catálogo de equipamentos e tabela de preços · {fornecedores.length} fornecedores cadastrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar equipamento..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004276] w-48 sm:w-64"
            />
          </div>

          <button
            onClick={() => {
              setEditingProduct(null);
              setNomeProd('');
              setIsNewProductOpen(true);
            }}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            + Novo produto
          </button>

          <button
            onClick={() => setIsNewSupplierOpen(true)}
            className="px-4 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-xs shadow transition"
          >
            + Novo fornecedor
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200 flex items-center gap-1 w-fit">
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
          onClick={() => setActiveTab('fornecedores')}
          className={`py-2 px-5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'fornecedores' ? 'bg-[#004276] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Fornecedores ({fornecedores.length})</span>
        </button>
      </div>

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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor em estoque</span>
                <TrendingDown className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-[#004276] mt-1">R$ {valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
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
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b">
                  <th className="p-3">CÓDIGO</th>
                  <th className="p-3">PRODUTO</th>
                  <th className="p-3">FORNECEDOR</th>
                  <th className="p-3">TIPO</th>
                  <th className="p-3">POTÊNCIA</th>
                  <th className="p-3">ESTOQUE</th>
                  <th className="p-3 text-right">PREÇO UNIT.</th>
                  <th className="p-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-600">{p.codigo}</td>
                    <td className="p-3 font-bold text-slate-900">{p.nome}</td>
                    <td className="p-3 text-slate-600">{p.fornecedorNome}</td>
                    <td className="p-3">
                      <span className="bg-blue-50 text-[#004276] font-bold px-2 py-0.5 rounded text-[10px] capitalize">
                        {p.tipo}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-700">{p.potencia || '–'}</td>
                    <td className="p-3">
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
                    <td className="p-3 text-right font-black text-[#004276]">
                      R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold space-x-2">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">{editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
              <button onClick={() => setIsNewProductOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1 uppercase">Nome do Equipamento</label>
                <input
                  type="text"
                  required
                  value={nomeProd}
                  onChange={(e) => setNomeProd(e.target.value)}
                  placeholder="Ex: Painel TLC Tier 1 710 Wp"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Tipo</label>
                  <select
                    value={tipoProd}
                    onChange={(e: any) => setTipoProd(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    <option value="modulo">Módulo</option>
                    <option value="inversor">Inversor / Micro</option>
                    <option value="estrutura">Estrutura</option>
                    <option value="cabo">Cabo</option>
                    <option value="protecao">Proteção</option>
                    <option value="acessorio">Acessório</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Fornecedor</label>
                  <select
                    value={fornecedorIdProd}
                    onChange={(e) => setFornecedorIdProd(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  >
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Potência</label>
                  <input
                    type="text"
                    value={potenciaProd}
                    onChange={(e) => setPotenciaProd(e.target.value)}
                    placeholder="710 Wp"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Estoque</label>
                  <input
                    type="number"
                    value={estoqueProd}
                    onChange={(e) => setEstoqueProd(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={precoProd}
                    onChange={(e) => setPrecoProd(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProductOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Fornecedor */}
      {isNewSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Cadastrar Fornecedor</h3>
              <button onClick={() => setIsNewSupplierOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1 uppercase">Nome da Empresa / Fornecedor</label>
                <input
                  type="text"
                  required
                  value={nomeForn}
                  onChange={(e) => setNomeForn(e.target.value)}
                  placeholder="Ex: Canadian Solar Brasil"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">CNPJ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cnpjForn}
                    onChange={(e) => setCnpjForn(maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Cidade / UF</label>
                  <input
                    type="text"
                    value={cidadeForn}
                    onChange={(e) => setCidadeForn(e.target.value)}
                    placeholder="São Paulo/SP"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Contato</label>
                  <input
                    type="text"
                    value={contatoForn}
                    onChange={(e) => setContatoForn(e.target.value)}
                    placeholder="Carlos Andrade"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 uppercase">Telefone</label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={telefoneForn}
                    onChange={(e) => setTelefoneForn(maskPhone(e.target.value))}
                    placeholder="(11) 4000-0000"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1 uppercase">Website</label>
                <input
                  type="text"
                  value={siteForn}
                  onChange={(e) => setSiteForn(e.target.value)}
                  placeholder="www.fornecedor.com.br"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004276] text-white font-bold rounded-xl shadow"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
