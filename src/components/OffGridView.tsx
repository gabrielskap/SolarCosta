import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarAparelhos, type Aparelho } from '../services/aparelhos';
import { abrirSimulacaoOffGrid, listarSimulacoesOffGrid, salvarSimulacaoOffGrid, type DadosOffGrid, type ResumoOffGrid } from '../services/offGrid';
import { ErroApi } from '../services/http';
import { LeadAutocomplete } from './LeadAutocomplete';
import { cargasOffGridPadrao, configOffGridPadrao, dimensionarSistema, type ConfigOffGrid } from '../utils/offGrid';

const novo = (): DadosOffGrid => ({ titulo: '', leadId: null, cliente: {nome:'',empresa:'',cnpj:'',telefone:'',email:''}, equipamentos: cargasOffGridPadrao().map(c => ({...c,tensaoV:220})), config: {...configOffGridPadrao} });
const erroTexto = (e: unknown) => e instanceof ErroApi ? e.mensagemCompleta : e instanceof Error ? e.message : 'Não foi possível concluir a operação.';
const numero = (v: number, casas = 2) => v.toLocaleString('pt-BR', {maximumFractionDigits:casas});
const campo = 'w-full border border-slate-300 rounded-lg px-3 py-2 bg-white';
const botao = 'rounded-lg bg-[#004276] text-white px-4 py-2 disabled:opacity-50';
const grupos: {titulo:string;campos:[keyof ConfigOffGrid,string,number,number?][]}[] = [
  {titulo:'3. Banco de baterias · Lítio (LiFePO4)',campos:[['eficienciaInversor','Eficiência do inversor (%)',0.01,100],['profundidadeDescarga','Profundidade de descarga · DoD (%)',0.01,100],['eficienciaCarga','Eficiência de carga (%)',0.01,100],['tensaoBateria','Tensão nominal da bateria (V)',0.01],['capacidadeBateriaAh','Capacidade unitária (Ah)',0.01]]},
  {titulo:'4. Sistema fotovoltaico',campos:[['irradiacaoSolar','Irradiação solar · HSP (h/dia)',0.01],['potenciaModuloWp','Potência do módulo (Wp)',0.01],['perdasSistema','Perdas do sistema (%)',0,99.99],['fatorDias','Fator dias (D)',0.01]]},
];

export function OffGridView({podeSalvar=true}:{podeSalvar?:boolean}) {
  const [dados,setDados] = useState<DadosOffGrid>(novo);
  const [id,setId] = useState<string>();
  const [catalogo,setCatalogo] = useState<Aparelho[]>([]);
  const [catalogoErro,setCatalogoErro] = useState('');
  const [carregandoCatalogo,setCarregandoCatalogo] = useState(true);
  const [selecionado,setSelecionado] = useState('');
  const [buscaAparelho,setBuscaAparelho] = useState('');
  const [simulacoes,setSimulacoes] = useState<ResumoOffGrid[]>([]);
  const [editando,setEditando] = useState(false);
  const [carregandoLista,setCarregandoLista] = useState(true);
  const [ocupado,setOcupado] = useState(false);
  const [erro,setErro] = useState('');
  const [aviso,setAviso] = useState('');
  const [alterado,setAlterado] = useState(false);
  const atualizar = (patch:Partial<DadosOffGrid>) => {setDados(d => ({...d,...patch}));setAlterado(true);setAviso('');};
  useEffect(() => {
    listarAparelhos().then(setCatalogo).catch(e => setCatalogoErro(erroTexto(e))).finally(() => setCarregandoCatalogo(false));
    listarSimulacoesOffGrid().then(setSimulacoes).catch(e => setErro(erroTexto(e))).finally(()=>setCarregandoLista(false));
  },[]);
  let resultado:ReturnType<typeof dimensionarSistema>|undefined;
  let erroCalculo='';
  try {resultado=dimensionarSistema(dados.equipamentos,dados.config);}
  catch(e){erroCalculo=erroTexto(e);}
  const editarCarga = (indice:number,key:string,value:string|number) => atualizar({equipamentos:dados.equipamentos.map((c,i) => i===indice ? {...c,[key]:value} : c)});
  const metricas = resultado ? [
    ['Potência total demandada',numero(resultado.potenciaTotalW)+' W'],['Consumo diário',numero(resultado.consumoDiarioKWh)+' kWh/dia'],
    ['Consumo corrigido',numero(resultado.consumoCorrigidoKWh)+' kWh/dia'],['Inversor recomendado (+30%)',numero(resultado.potenciaInversorRecomendadaW)+' W'],
    ['Capacidade mínima do banco',numero(resultado.capacidadeMinimaAh)+' Ah'],['Energia mínima nominal do banco',numero(resultado.energiaMinimaBancoKWh)+' kWh'],
    ['Baterias necessárias',numero(resultado.quantidadeBaterias,0)+' unidades'],['Quantidade antes de arredondar',numero(resultado.quantidadeBateriasCalculada,4)],
    ['Geração por módulo',numero(resultado.geracaoModuloKWh,4)+' kWh/dia'],['Módulos necessários',numero(resultado.quantidadeModulos,0)+' unidades'],
    ['Potência fotovoltaica instalada',numero(resultado.potenciaSistemaKWp)+' kWp'],
  ] : [];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Dimensionamento OFF-Grid</h1><p className="text-slate-500">Levantamento de cargas, banco de baterias e módulos fotovoltaicos.</p></div>
    {erro && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{erro}</p>}
    {aviso && <p role="status" className="bg-green-50 text-green-800 p-3 rounded-lg">{aviso}</p>}
    {!editando ? <section className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Simulações cadastradas</h2><button className={botao} disabled={ocupado||!podeSalvar} onClick={()=>{setDados(novo());setId(undefined);setAlterado(false);setAviso('');setErro('');setEditando(true);}}>Criar novo</button></div>
      <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr><th className="p-4">Simulação</th><th className="p-4">Última atualização</th><th className="p-4">Ações</th></tr></thead><tbody>
        {simulacoes.map(s=><tr key={s.id} className="border-t"><td className="p-4 font-medium">{s.titulo}</td><td className="p-4">{new Date(s.atualizadoEm).toLocaleString('pt-BR')}</td><td className="p-4"><button className="text-sky-800 underline" disabled={ocupado} onClick={async()=>{
          setOcupado(true);setErro('');try{const simulacao=await abrirSimulacaoOffGrid(s.id);setDados(simulacao.dados);setId(simulacao.id);setAlterado(false);setAviso('');setEditando(true);}catch(e){setErro(erroTexto(e));}finally{setOcupado(false);}
        }}>Abrir simulação</button></td></tr>)}
        {!simulacoes.length&&<tr><td colSpan={3} className="p-6 text-slate-500">{carregandoLista?'Carregando simulações…':erro?'Não foi possível carregar as simulações.':'Nenhuma simulação cadastrada. Clique em Criar novo para começar.'}</td></tr>}
      </tbody></table></div>
    </section> : <>
    <div className="flex flex-wrap justify-between gap-3"><button className="text-sky-800 underline" disabled={ocupado} onClick={()=>{if(alterado&&!window.confirm('Voltar à listagem e descartar as alterações não salvas?'))return;setEditando(false);setErro('');setAviso('');}}>Voltar para simulações</button><p className="text-sm text-slate-500">{id?'Editar simulação':'Nova simulação'}{alterado?' · Alterações não salvas':''}</p></div>
    <form className="space-y-6" onSubmit={async e=>{
      e.preventDefault();if(!resultado||ocupado)return;setOcupado(true);setErro('');setAviso('');
      try{const s=await salvarSimulacaoOffGrid(dados,id);setId(s.id);setAlterado(false);setAviso('Simulação salva com sucesso.');setSimulacoes(lista=>[s,...lista.filter(item=>item.id!==s.id)]);setEditando(false);}
      catch(e){setErro(erroTexto(e));}finally{setOcupado(false);}
    }}>
      <fieldset disabled={ocupado} className="space-y-6">
        <section className="bg-white border rounded-xl p-3 space-y-2">
          <h2 className="font-bold text-sm text-slate-900">Resultados calculados</h2>
          {erroCalculo&&<p role="alert" className="bg-amber-50 text-amber-900 rounded-lg p-2 text-sm">{erroCalculo}</p>}
          <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2" aria-live="polite">{metricas.map(([label,value])=><div key={label} className="bg-slate-50 rounded-lg px-3 py-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-base font-bold text-[#004276]">{value}</dd></div>)}</dl>
          {resultado?.consultarFabricante&&<p role="alert" className="bg-amber-100 text-amber-900 p-2 rounded-lg text-sm font-bold">Consultar Powersafe — quantidade calculada superior a 10 baterias.</p>}
        </section>
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-lg">1. Dados do instalador/cliente</h2>
          <label className="block">Título da simulação<input required maxLength={200} className={campo} value={dados.titulo} onChange={e=>atualizar({titulo:e.target.value})}/></label>
          <div className="grid md:grid-cols-2 gap-4">
            <LeadAutocomplete leadId={dados.leadId} nome={dados.cliente.nome} onChange={lead=>{
              atualizar({leadId:lead?.id??null,...(lead?{cliente:{...dados.cliente,nome:lead.nome,cnpj:lead.cpf_cnpj??'',telefone:lead.telefone??'',email:lead.email??''}}:{})});
            }}/>
            {([['nome','Nome e sobrenome',200],['empresa','Empresa',200],['cnpj','CPF/CNPJ',20],['telefone','Telefone',30],['email','E-mail',200]] as const).map(([key,label,max])=><label key={key}>{label}<input required={key==='nome'} type={key==='email'?'email':'text'} maxLength={max} className={campo} value={dados.cliente[key]} onChange={e=>atualizar({cliente:{...dados.cliente,[key]:e.target.value}})}/></label>)}
          </div>
          <p className="text-xs text-slate-500">Os dados de identificação são salvos na simulação. Alterações aqui não alteram o cadastro do lead.</p>
        </section>
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-lg">2. Levantamento de cargas críticas para backup</h2>
          {catalogoErro&&<p role="alert" className="text-red-700">{catalogoErro}</p>}
          <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
            <input aria-label="Buscar equipamento cadastrado" type="search" className={campo} placeholder="Buscar aparelho ou ambiente" value={buscaAparelho} onChange={e=>{setBuscaAparelho(e.target.value);setSelecionado('');}}/>
            <select aria-label="Equipamento cadastrado" className={campo} value={selecionado} onChange={e=>setSelecionado(e.target.value)}><option value="">{carregandoCatalogo?'Carregando equipamentos…':'Selecione um equipamento cadastrado'}</option>{catalogo.filter(a=>`${a.ambiente} ${a.nome}`.toLocaleLowerCase('pt-BR').includes(buscaAparelho.toLocaleLowerCase('pt-BR'))).map(a=><option key={a.id} value={a.id}>{a.ambiente} · {a.nome} · {a.potenciaW} W</option>)}</select>
            <button type="button" className={botao} disabled={!selecionado||dados.equipamentos.length>=500} onClick={()=>{const a=catalogo.find(a=>a.id===selecionado);if(a)atualizar({equipamentos:[...dados.equipamentos,{id:crypto.randomUUID(),nome:a.nome,potenciaW:a.potenciaW,quantidade:1,horasDia:1,tensaoV:220}]});}}>Adicionar</button>
          </div>
          {!carregandoCatalogo&&!catalogo.length&&!catalogoErro&&<p className="text-sm text-slate-500">Nenhum aparelho cadastrado. Cadastre em <Link className="underline text-sky-800" to="/sistema/parametros/aparelhos">Parâmetros → Aparelhos</Link>.</p>}
          <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr>{['Equipamento','Tensão (V)','Potência (W)','Horas/dia','Quantidade','Demanda (W)','Consumo (Wh/dia)','Ações'].map(t=><th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>
            {dados.equipamentos.map((c,i)=><tr key={c.id} className="border-t"><td className="p-2 min-w-48">{c.nome}</td>
              {([['tensaoV',0.01,undefined,0.01],['potenciaW',0,undefined,0.01],['horasDia',0,24,0.01],['quantidade',0,undefined,1]] as const).map(([key,min,max,step])=><td key={key} className="p-2 min-w-28"><input aria-label={`${c.nome} · ${key}`} required type="number" min={min} max={max} step={step} className={campo} value={Number.isFinite(c[key])?c[key]:''} onChange={e=>editarCarga(i,key,e.target.valueAsNumber)}/></td>)}
              <td className="p-2 whitespace-nowrap">{resultado?numero(resultado.cargas[i].potenciaDemandadaW):'—'}</td><td className="p-2 whitespace-nowrap">{resultado?numero(resultado.cargas[i].consumoDiarioWh):'—'}</td>
              <td className="p-2"><button type="button" className="text-red-700 underline" onClick={()=>atualizar({equipamentos:dados.equipamentos.filter((_,n)=>n!==i)})}>Remover</button></td></tr>)}
          </tbody></table></div>
          {!dados.equipamentos.length&&<p>Adicione equipamentos para iniciar o levantamento.</p>}
        </section>
        <div className="grid xl:grid-cols-2 gap-6">{grupos.map(g=><section key={g.titulo} className="bg-white border rounded-xl p-5 space-y-4"><h2 className="font-bold text-lg">{g.titulo}</h2><div className="grid sm:grid-cols-2 gap-4">{g.campos.map(([key,label,min,max])=><label key={key}>{label}<input type="number" required min={min} max={max} step="any" className={campo} value={Number.isFinite(dados.config[key])?dados.config[key]:''} onChange={e=>atualizar({config:{...dados.config,[key]:e.target.valueAsNumber}})}/></label>)}</div></section>)}</div>
          <p className="text-sm text-slate-500">Dimensionamento simplificado da planilha, com mínimo de uma bateria. A margem de 30% do inversor é uma recomendação; avalie também os picos de partida. As fórmulas não verificam autonomia adicional, temperatura, compatibilidade do inversor, limites do MPPT ou ligações série/paralelo. O fator dias multiplica a geração por módulo e não representa autonomia do banco.</p>
        <div className="flex flex-wrap gap-3"><button disabled={!podeSalvar||!resultado||!dados.equipamentos.length} className={botao}>{id?'Salvar alterações':'Salvar simulação'}</button></div>
        {!podeSalvar&&<p className="text-sm text-slate-500">É necessária a permissão de emitir propostas para salvar simulações.</p>}
      </fieldset>
    </form>
    </>}
    {ocupado&&<p role="status">Processando simulação…</p>}
  </div>;
}
