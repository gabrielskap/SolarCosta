import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
  ExternalLink,
  Handshake,
  Eye,
  Wrench,
} from 'lucide-react';
import { useSeo } from '../seo';
import { Secao, TituloSecao, Cartao, ChipIcone } from '../components/Secao';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import logoFull from '../../assets/logo-full.png';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO, enderecoCompleto } from '../../services/publico';

const PRINCIPIOS = [
  {
    Icone: Eye,
    titulo: 'Número que se sustenta',
    texto:
      'A geração projetada na proposta é a mesma que o simulador do site mostra, com as perdas reais embutidas. Prometer 100% de economia é fácil; entregar é outra história.',
    cor: 'blue' as const,
  },
  {
    Icone: Handshake,
    titulo: 'Uma empresa, um responsável',
    texto:
      'Projeto, instalação e homologação ficam com a gente. Não repassamos a obra para terceiros e depois some o telefone quando aparece um problema.',
    cor: 'emerald' as const,
  },
  {
    Icone: Wrench,
    titulo: 'Depois da instalação também',
    texto:
      'Sistema fotovoltaico dá pouca manutenção, mas não dá nenhuma. Seguimos disponíveis para limpeza, inspeção e dúvidas sobre a fatura.',
    cor: 'amber' as const,
  },
];

export const Sobre: React.FC = () => {
  useSeo({
    titulo: 'A empresa',
    descricao:
      'Solar Costa Energia Solar: empresa de energia fotovoltaica em Belo Horizonte, com responsável técnico registrado no CREA e equipe própria de instalação.',
  });

  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const telefone = empresa?.telefone || CONTATO_PADRAO.telefone;
  const email = empresa?.email || CONTATO_PADRAO.email;
  const cep = empresa?.cep || CONTATO_PADRAO.cep;
  const endereco = enderecoCompleto(empresa);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${endereco} ${cep}`)}`;

  /** Só o que está cadastrado em SolarCosta_Empresa — nada inventado. */
  const cadastro = [
    { rotulo: 'Razão social', valor: empresa?.razao_social },
    { rotulo: 'Nome fantasia', valor: empresa?.nome_fantasia },
    { rotulo: 'CNPJ', valor: empresa?.cnpj },
    { rotulo: 'Responsável técnico', valor: empresa?.responsavel_tecnico },
    { rotulo: 'CREA', valor: empresa?.crea },
  ].filter((i) => !!i.valor);

  return (
    <>
      <CabecalhoPagina
        rotulo="A empresa"
        titulo="Energia solar com engenharia por trás, não só com vendedor na frente."
        descricao="A Solar Costa projeta, instala e homologa sistemas fotovoltaicos em Belo Horizonte e na região metropolitana. Cada projeto sai com ART e responsável técnico registrado — o que garante que o sistema foi calculado por quem responde por ele."
      >
        {/* A marca completa fecha a apresentação institucional. */}
        <div className="mt-10 flex flex-wrap items-center gap-6 pt-8 border-t border-blue-800/60">
          <img
            src={logoFull}
            alt="Solar Costa Energia Solar"
            className="h-14 md:h-16 w-auto"
            width={1400}
            height={630}
          />
          <div className="font-mono text-xs text-blue-200/80 leading-relaxed">
            <p>{empresa?.razao_social || 'SOLAR COSTA ENERGIA SOLAR LTDA'}</p>
            {empresa?.cnpj && <p>CNPJ {empresa.cnpj}</p>}
          </div>
        </div>
      </CabecalhoPagina>

      <Secao>
        <div className="grid lg:grid-cols-3 gap-6">
          {PRINCIPIOS.map((p) => (
            <Cartao key={p.titulo} className="h-full" regua="from-blue-600 to-indigo-500">
              <ChipIcone Icone={p.Icone} cor={p.cor} />
              <h2 className="mt-4 text-lg font-black text-slate-900 tracking-tight">{p.titulo}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.texto}</p>
            </Cartao>
          ))}
        </div>
      </Secao>

      <Secao claro>
        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <TituloSecao
              rotulo="Transparência"
              titulo="Dados cadastrais"
              descricao="Antes de assinar qualquer contrato de energia solar, confira o CNPJ e o registro do responsável técnico da empresa. Aqui estão os nossos."
            />

            <Cartao className="mt-8" regua="from-emerald-500 to-teal-400">
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Registro
                </span>
              </div>
              <dl className="space-y-4">
                {cadastro.map((i) => (
                  <div key={i.rotulo} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {i.rotulo}
                    </dt>
                    <dd className="text-sm font-semibold text-slate-900 sm:text-right font-mono">
                      {i.valor}
                    </dd>
                  </div>
                ))}
                {cadastro.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Dados cadastrais indisponíveis no momento. Fale com a gente pelo telefone{' '}
                    {telefone}.
                  </p>
                )}
              </dl>
            </Cartao>
          </div>

          <div>
            <TituloSecao rotulo="Onde estamos" titulo="Atendimento e escritório" />

            <Cartao className="mt-8 space-y-5" regua="from-amber-500 to-orange-400">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-marca shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Endereço
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{endereco}</p>
                  <p className="text-sm text-slate-500">CEP {cep}</p>
                  <a
                    href={mapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-marca hover:underline mt-2"
                  >
                    Abrir no Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Telefone e WhatsApp
                  </p>
                  <a
                    href={`tel:${telefone.replace(/\D+/g, '')}`}
                    className="text-sm font-semibold text-slate-900 hover:text-marca mt-1 block"
                  >
                    {telefone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    E-mail
                  </p>
                  <a
                    href={`mailto:${email}`}
                    className="text-sm font-semibold text-slate-900 hover:text-marca mt-1 block break-all"
                  >
                    {email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Área de atendimento
                  </p>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    Belo Horizonte, Contagem, Betim, Nova Lima, Santa Luzia, Ribeirão das Neves,
                    Sabará, Vespasiano e demais cidades da região metropolitana.
                  </p>
                </div>
              </div>
            </Cartao>
          </div>
        </div>
      </Secao>

      <Secao>
        <Cartao className="p-10 md:p-14 text-center" regua="from-blue-600 to-indigo-500">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Vamos conversar sobre o seu projeto?
          </h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto leading-relaxed">
            Comece pelo simulador ou fale direto com um consultor. Nos dois caminhos, a visita
            técnica é gratuita.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contato"
              className="inline-flex items-center justify-center gap-2 bg-marca hover:bg-marca-escuro text-white font-extrabold px-6 py-4 rounded-xl shadow-md transition-all"
            >
              Falar com um consultor
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/simulador"
              className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-marca text-slate-700 hover:text-marca font-bold px-6 py-4 rounded-xl transition-all"
            >
              Abrir o simulador
            </Link>
          </div>
        </Cartao>
      </Secao>
    </>
  );
};
